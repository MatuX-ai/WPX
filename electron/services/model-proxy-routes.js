/**
 * 自定义模型 API 代理（解决渲染进程直连第三方模型的 CORS 问题）
 *
 * 设置页「测试连接」走主进程 fetch，所以能通；
 * AI 对话原先在渲染进程用 AI SDK 直连 api.deepseek.com 等，Chromium CORS 会失败，
 * 被归一成「未配置 / 无法连接」。
 *
 * 本路由挂在 local-server（仅 127.0.0.1）：
 *   任意方法  /api/model-proxy/*
 *   Header: X-WPX-Upstream-Base = https://api.deepseek.com/v1
 *   Header: Authorization = Bearer <key>（可省略，省略时用 model-secrets 中的 text Key）
 *
 * 转发到 `${upstreamBase}${suffix}`，支持 SSE 流式响应透传。
 */
const { Readable } = require('node:stream')
const { getDecryptedApiKey } = require('./model-secrets-store')

const HOP_BY_HOP = new Set([
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'upgrade',
  'host',
])

/**
 * @param {string} upstreamBase
 * @param {string} originalUrl
 */
function buildUpstreamUrl(upstreamBase, originalUrl) {
  const base = String(upstreamBase || '').trim().replace(/\/$/, '')
  if (!base) return ''

  let suffix = String(originalUrl || '')
  const qIndex = suffix.indexOf('?')
  const pathPart = qIndex >= 0 ? suffix.slice(0, qIndex) : suffix
  const query = qIndex >= 0 ? suffix.slice(qIndex) : ''

  const stripped = pathPart.replace(/^\/api\/model-proxy/, '') || '/'
  return `${base}${stripped.startsWith('/') ? stripped : `/${stripped}`}${query}`
}

/**
 * @param {import('express').Express} expressApp
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
function registerModelProxyRoutes(expressApp, deps = {}) {
  if (!expressApp) throw new Error('[model-proxy] expressApp is required')
  const fetchImpl = deps.fetchImpl || globalThis.fetch

  // Express 5 的 path-to-regexp 不再支持 `/*` 通配；用 mount 前缀捕获全部子路径。
  expressApp.use('/api/model-proxy', (req, res) => proxyRequest(req, res, fetchImpl))
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {typeof fetch} fetchImpl
 */
async function proxyRequest(req, res, fetchImpl) {
  try {
    const upstreamBase = String(req.get('x-wpx-upstream-base') || '').trim()
    const targetUrl = buildUpstreamUrl(upstreamBase, req.originalUrl)

    if (!targetUrl) {
      res.status(400).json({
        error: '缺少上游地址',
        message: '请通过 X-WPX-Upstream-Base 指定模型 API 根地址（如 https://api.deepseek.com/v1）',
      })
      return
    }

    let authorization = String(req.get('authorization') || '').trim()
    if (!authorization) {
      const storedKey = getDecryptedApiKey('text')
      if (storedKey) {
        authorization = `Bearer ${storedKey}`
      }
    }

    if (!authorization) {
      res.status(401).json({
        error: '未配置 API Key',
        message: '请先在「我的模型」中保存 API Key',
      })
      return
    }

    /** @type {Record<string, string>} */
    const headers = {
      Authorization: authorization,
      Accept: req.get('accept') || 'application/json',
    }
    const contentType = req.get('content-type')
    if (contentType) headers['Content-Type'] = contentType

    const method = String(req.method || 'GET').toUpperCase()
    const hasBody = !['GET', 'HEAD'].includes(method)
    const body = hasBody
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}))
      : undefined

    if (hasBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const upstream = await fetchImpl(targetUrl, { method, headers, body })

    res.status(upstream.status)

    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return
      // 避免把上游 CORS 头回传给渲染进程造成干扰
      if (key.toLowerCase().startsWith('access-control-')) return
      try {
        res.setHeader(key, value)
      } catch {
        // 忽略非法 header
      }
    })

    if (!upstream.body) {
      const text = await upstream.text().catch(() => '')
      res.end(text)
      return
    }

    const nodeStream = Readable.fromWeb(upstream.body)
    nodeStream.on('error', (error) => {
      console.error('[model-proxy] upstream stream error:', error?.message || error)
      if (!res.headersSent) {
        res.status(502).json({ error: '模型代理流式传输失败', message: error?.message || String(error) })
      } else {
        res.destroy(error)
      }
    })
    nodeStream.pipe(res)
  } catch (error) {
    console.error('[model-proxy]', error)
    if (!res.headersSent) {
      res.status(502).json({
        error: '模型代理请求失败',
        message: error?.message || String(error),
      })
    }
  }
}

module.exports = {
  registerModelProxyRoutes,
  buildUpstreamUrl,
}
