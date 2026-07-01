'use strict'

/**
 * Vercel Node.js Function (2026+ Rust 运行时) req.body 解析兜底
 *
 * 背景：
 *   Vercel 的 IncomingMessage 实现把 req.body 改成了 lazy getter，
 *   并对 Content-Type 做了严格校验（带 charset 等变体会抛 'invalid media type'）。
 *   Express body-parser 在调用 req.body getter 时会触发异常，导致 500。
 *
 * 解决：
 *   手动从 req 的 'data'/'end' 事件读取原始 stream，按 content-type 解析为对象，
 *   再 Object.defineProperty 覆盖 req.body，标记 req._body=true，
 *   这样 Express body-parser 会跳过重复解析。
 *
 * 在 /api/admin/handler.js 和 /api/proxy 转发层都需要，
 * 因此放在 /api/_shared/ 下（带下划线前缀，Vercel 不视为独立 Function）。
 */

async function parseBody(req) {
  // 如果有 Content-Length 表示请求有 body，走 stream 读取才是唯一可靠方式。
  // Vercel Rust 运行时 req.body getter 对 application/json 返回不可靠的空对象 {}，
  // Express body-parser 也依赖这个 getter，所以需要预读+覆盖 req.body 防止
  // body-parser 触发异常或后续访问拿到空对象。
  const cl = parseInt(String(req.headers['content-length'] || '0'), 10) || 0
  const ct = String(req.headers['content-type'] || '').toLowerCase()
  const expectBody = cl > 0 && (
    ct.includes('application/json') ||
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('text/')
  )

  if (!expectBody) {
    // 没有 body或不被预解析的 Content-Type：安全返回空对象，覆盖 getter 防止后续抛错
    try {
      void req.body // 探测 getter
    } catch (_) {}
    return {}
  }

  return await new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const buf = Buffer.concat(chunks)
      const text = buf.toString('utf8')
      if (!text) {
        finish({})
        return
      }
      try {
        if (ct.includes('application/json')) {
          finish(JSON.parse(text))
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          finish(Object.fromEntries(new URLSearchParams(text)))
        } else {
          finish({})
        }
      } catch (_) {
        finish({})
      }
    })
    req.on('error', () => finish({}))
    // 安全网：1.5s 仍收不到 'end'，强制结束，以避免函数挂死。
    setTimeout(() => finish({}), 1500)
  })
}

/**
 * 覆盖 req.body 的 lazy getter，让后续 req.body 访问返回我们解析的结果
 * 同时标记 req._body=true 让 Express body-parser 跳过（避免重复解析 stream）
 *
 * Vercel 2026+ Rust 实现里 req.body 是 non-configurable accessor（只能读不能覆盖），
 * Object.defineProperty({value}) 会被静默吞掉。必须先 deleteProperty 再赋值。
 */
function installParsedBody(req, parsed) {
  // 1) 尝试 delete 原有 accessor（仅会生效如果它是 configurable）
  try { Reflect.deleteProperty(req, 'body') } catch (_) {}
  // 2) 直接赋值（现在 req.body 是 own data property）
  try { req.body = parsed } catch (_) {
    // 3) 如果仍无效，fallback 用 defineProperty
    try {
      Object.defineProperty(req, 'body', {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true
      })
    } catch (_) { /* 最后兑底，放弃覆盖，body-parser 会拿到原始空对象 */ }
  }
  req._body = true
}

module.exports = { parseBody, installParsedBody }
