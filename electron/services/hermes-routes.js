/**
 * hermes-routes —— Hermes Gateway 适配层（Phase 3 / M3）
 *
 * 挂载到 local-server（Express）：
 * - GET  /api/hermes/health   探测网关可用性（网关自身 /health）
 * - POST /api/hermes/run      转发任务到网关（OpenAI 兼容 chat 直连）
 * - POST /api/hermes/stream   SSE 流式转发（透传）
 *
 * 预研结论：网关默认 127.0.0.1:8642，chat 端点走 OpenAI 方言。
 * 精确请求 schema 以《Gateway 预研报告》§5 实机验证为准——本模块用
 * `buildChatMessages` / `gatewayBase` 单点隔离，验证后只需改这两处。
 *
 * 设计：deps（gatewayBase / fetchImpl / timeoutMs）可注入，便于单测。
 * 失败一律返回 { ok:false, fallbackReason:'hermes_unavailable' }，供 ai-router 透明降级。
 */
const DEFAULT_GATEWAY_BASE = 'http://127.0.0.1:8642'
const DEFAULT_TIMEOUT_MS = 60_000

/** 组装 OpenAI 兼容 messages（system 角色声明定位 + user 任务） */
function buildChatMessages(payload = {}) {
  const task = String(payload.task || payload.params?.userMessage || '').trim()
  const messages = [
    {
      role: 'system',
      content:
        '你是 WPX 文档工作站的 Hermes 自主助手。执行用户任务，可多步推理；' +
        '结果用中文返回，保持结构化。',
    },
  ]
  if (task) {
    messages.push({ role: 'user', content: task })
  } else {
    messages.push({ role: 'user', content: '请说明你能做什么。' })
  }
  return messages
}

/** 构造网关请求地址（单点隔离，便于按实机验证校准） */
function buildGatewayUrl(gatewayBase, endpoint) {
  return `${String(gatewayBase || DEFAULT_GATEWAY_BASE).replace(/\/$/, '')}${endpoint}`
}

/**
 * 创建路由处理器
 * @param {{ gatewayBase?: string, gatewayKey?: string | (() => string | null), fetchImpl?: typeof fetch, timeoutMs?: number }} [deps]
 *  gatewayKey：API Server 鉴权（Authorization: Bearer <key>），可为字符串或返回当前 key 的函数
 */
function createHermesHandlers(deps = {}) {
  const gatewayBase = deps.gatewayBase || DEFAULT_GATEWAY_BASE
  const fetchImpl = deps.fetchImpl || globalThis.fetch
  const timeoutMs = deps.timeoutMs || DEFAULT_TIMEOUT_MS

  function resolveGatewayKey() {
    const key = typeof deps.gatewayKey === 'function' ? deps.gatewayKey() : deps.gatewayKey
    return key ? String(key) : ''
  }

  /**
   * 组装请求头：Bearer 鉴权 + 可选会话延续（X-Hermes-Session-Id）
   * @param {{ sessionId?: string | null }} [payload]
   */
  function buildHeaders(payload) {
    const headers = { 'Content-Type': 'application/json' }
    const key = resolveGatewayKey()
    if (key) headers.Authorization = `Bearer ${key}`
    const sessionId = payload?.sessionId
    if (sessionId) headers['X-Hermes-Session-Id'] = String(sessionId)
    return headers
  }

  function withTimeout(url, options) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // M4：组合外部 signal（如客户端断开）与超时 signal
    const external = options.signal
    const onExternalAbort = () => controller.abort()
    if (external) {
      if (external.aborted) {
        controller.abort()
      } else {
        external.addEventListener('abort', onExternalAbort)
      }
    }
    return fetchImpl(url, { ...options, signal: controller.signal }).finally(() => {
      clearTimeout(timer)
      if (external) external.removeEventListener('abort', onExternalAbort)
    })
  }

  /** GET /api/hermes/health */
  async function health(_req, res) {
    try {
      const headers = {}
      const key = resolveGatewayKey()
      if (key) headers.Authorization = `Bearer ${key}`
      const upstream = await withTimeout(buildGatewayUrl(gatewayBase, '/health'), { headers })
      if (!upstream.ok) {
        res.json({ ok: false, gatewayUp: false, gatewayBase, status: upstream.status })
        return
      }
      let body = null
      try { body = await upstream.json() } catch { body = null }
      res.json({ ok: true, gatewayUp: true, gatewayBase, data: body })
    } catch (error) {
      res.json({
        ok: false,
        gatewayUp: false,
        gatewayBase,
        fallbackReason: 'hermes_unavailable',
        message: error?.name === 'AbortError' ? '网关健康检查超时' : error?.message || String(error),
      })
    }
  }

  /** POST /api/hermes/run */
  async function run(req, res) {
    const payload = req.body || {}
    try {
      const messages = buildChatMessages(payload)
      const upstream = await withTimeout(buildGatewayUrl(gatewayBase, '/v1/chat/completions'), {
        method: 'POST',
        headers: buildHeaders(payload),
        body: JSON.stringify({ model: payload.model || 'hermes', messages, stream: false }),
      })
      if (!upstream.ok) {
        res.json({
          ok: false,
          fallbackReason: 'hermes_http_error',
          message: `网关返回 HTTP ${upstream.status}`,
          status: upstream.status,
        })
        return
      }
      let body = null
      try { body = await upstream.json() } catch { body = null }
      res.json({
        ok: true,
        engine: 'hermes',
        sessionId: payload.sessionId || null,
        data: body,
      })
    } catch (error) {
      res.json({
        ok: false,
        fallbackReason: 'hermes_unavailable',
        message: error?.name === 'AbortError' ? '网关调用超时' : error?.message || String(error),
      })
    }
  }

  /** POST /api/hermes/stream（SSE 透传；客户端断开时中止上游） */
  async function stream(req, res) {
    const payload = req.body || {}
    // M4：客户端断开 → 中止上游 fetch（避免网关侧悬挂）
    const controller = new AbortController()
    const onClientClose = () => controller.abort()
    req.once?.('close', onClientClose)
    try {
      const messages = buildChatMessages(payload)
      const upstream = await withTimeout(buildGatewayUrl(gatewayBase, '/v1/chat/completions'), {
        method: 'POST',
        headers: buildHeaders(payload),
        body: JSON.stringify({ model: payload.model || 'hermes', messages, stream: true }),
        signal: controller.signal,
      })
      if (!upstream.ok || !upstream.body) {
        res.status(upstream.status || 502).json({
          ok: false,
          fallbackReason: 'hermes_http_error',
          message: `网关流式返回 HTTP ${upstream.status}`,
        })
        return
      }
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      const reader = upstream.body.getReader()
      const pump = async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
        } finally {
          res.end()
        }
      }
      void pump()
    } catch (error) {
      if (!res.headersSent) {
        res.json({
          ok: false,
          fallbackReason: 'hermes_unavailable',
          message: error?.name === 'AbortError' ? '网关流式调用超时' : error?.message || String(error),
        })
      } else {
        res.end()
      }
    }
  }

  return { health, run, stream }
}

/**
 * 注册到 local-server
 * @param {import('express').Express} expressApp
 * @param {{ gatewayBase?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [deps]
 */
function registerHermesRoutes(expressApp, deps) {
  const handlers = createHermesHandlers(deps)
  expressApp.get('/api/hermes/health', handlers.health)
  expressApp.post('/api/hermes/run', handlers.run)
  expressApp.post('/api/hermes/stream', handlers.stream)
}

module.exports = {
  DEFAULT_GATEWAY_BASE,
  buildChatMessages,
  buildGatewayUrl,
  createHermesHandlers,
  registerHermesRoutes,
}
