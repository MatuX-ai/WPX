// Vercel Serverless Function: API 反向代理
// 路由：/api/*  ->  https://api.prowpx.com/admin/*
// 用途：避免浏览器跨域（CORS），让 prowpx.com 与业务 API 同源
// 管理后台部署在 https://prowpx.com/admin 下，前端 /api/* 请求
// 由本 Serverless Function 反代到后端 https://api.prowpx.com/admin/*
//
// 环境变量（在 Vercel 控制台配置）：
//   API_TARGET = https://api.prowpx.com/admin   （默认）

const TARGET = process.env.API_TARGET || 'https://api.prowpx.com/admin'

// 不透传的请求头（hop-by-hop + 主机头）
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length'
])

function buildHeaders(req) {
  const out = {}
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (v == null) continue
    const lk = k.toLowerCase()
    if (HOP_BY_HOP.has(lk)) continue
    out[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  // 标识真实来源（供后端审计）
  out['X-Forwarded-Host'] = req.headers.host || ''
  out['X-Forwarded-Proto'] = 'https'
  return out
}

function buildTargetUrl(req) {
  // /api/proxy?path=xxx&...
  // 重写规则：/api/foo/bar -> /api/proxy?path=foo/bar
  const path = (req.query && req.query.path) || ''
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  // 把原 query 去掉 path 参数后拼到目标 URL
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === 'path') continue
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x))
    else if (v != null) params.append(k, String(v))
  }
  const qs = params.toString()
  const tail = qs ? '?' + qs : ''
  return `${TARGET}/${path}${tail}`
}

module.exports = async (req, res) => {
  // CORS 预检直接放行（同源不会出现，但安全起见保留）
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const url = buildTargetUrl(req)

  // 构造 fetch 选项
  const init = {
    method: req.method,
    headers: buildHeaders(req),
    redirect: 'manual'
  }

  // 仅对有 body 的方法转发 body
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
      // Vercel 默认已解析 JSON / 文本
      init.body = JSON.stringify(req.body)
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json'
    } else if (req.body != null) {
      init.body = req.body
    }
  }

  try {
    const upstream = await fetch(url, init)

    // 透传响应头（去除 hop-by-hop + 禁用 CORS 相关头）
    const headers = upstream.headers
    const passthrough = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'content-disposition',
      'x-request-id',
      'x-trace-id'
    ]
    for (const k of passthrough) {
      const v = headers.get(k)
      if (v) res.setHeader(k, v)
    }

    res.status(upstream.status)
    // 透传 body
    if (upstream.body) {
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.end(buf)
    } else {
      res.end()
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/proxy] error:', err)
    res.status(502).json({
      code: 502,
      message: 'API gateway error: ' + (err && err.message ? err.message : 'unknown')
    })
  }
}

// Vercel Function 运行时配置
// 绕过 vercel.json 中 `functions` 字段的 glob 模式匹配问题
// (CLI 54.10.2 回归 bug + 自定义 Root Directory 项目)
module.exports.config = {
  memory: 256,
  maxDuration: 10
}
