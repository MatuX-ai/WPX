const detector = require('./jcode-detector')
const launcher = require('./jcode-launcher')
const { clearAllJcodeMemory, getJcodeMemoryDir } = require('../jcode-memory-bridge')
const { getJcodeSettings } = require('./jcode-store')

const SWARM_TIMEOUT_MS = 60_000
const STREAM_TIMEOUT_MS = 5 * 60_000
const WS_CONNECT_TIMEOUT_MS = 10_000
const WS_CLOSE_NORMAL = 1000

class JcodeUnavailableError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'JcodeUnavailableError'
    this.status = status || null
  }
}

/**
 * 同步调用 jcode /jcode/swarm 端点。
 * @param {object} payload
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch }} [options]
 */
async function callJcodeSwarm(payload, options = {}) {
  const status = launcher.getStatus()
  if (status.state !== 'RUNNING') {
    throw new JcodeUnavailableError(`jcode 不可用,当前状态: ${status.state}`, status.state)
  }
  const host = status.host || '127.0.0.1'
  const port = status.port || 8765
  const url = `http://${host}:${port}/jcode/swarm`
  const timeoutMs = options.timeoutMs || SWARM_TIMEOUT_MS
  const f = options.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 500) } }
    if (!res.ok) {
      throw new JcodeUnavailableError(`jcode 返回 HTTP ${res.status}`, res.status)
    }
    launcher.markActivity()
    return body
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new JcodeUnavailableError('jcode 调用超时', 'timeout')
    }
    if (err instanceof JcodeUnavailableError) throw err
    throw new JcodeUnavailableError(err?.message || String(err), 'network')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 通过 WebSocket 连接到 jcode 流式端点,逐事件回调。
 *
 * 协议（与 jcode 需求文档 §3.5 一致）：
 *   1. 客户端连接 ws://{host}:{port}/jcode/stream
 *   2. 发送任务 JSON
 *   3. 逐条接收: { type: "progress", step, data } | { type: "result", data } | { type: "error", message }
 *
 * @param {object} payload - 任务 JSON（与 HTTP /jcode/swarm 一致）
 * @param {object} callbacks
 * @param {(event: object) => void} callbacks.onEvent - 每收到一条消息时调用
 * @param {(error: Error) => void} callbacks.onError - 连接/协议错误时调用
 * @param {() => void} callbacks.onDone - 正常关闭时调用
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ close: () => void }>} 返回关闭句柄,调用方可提前中断
 */
function connectJcodeStream(payload, callbacks = {}, options = {}) {
  const status = launcher.getStatus()
  if (status.state !== 'RUNNING') {
    const err = new JcodeUnavailableError(
      `jcode 不可用,当前状态: ${status.state}`, status.state
    )
    setImmediate(() => { try { callbacks.onError?.(err) } catch { /* ignore */ } })
    return Promise.resolve({ close: () => {} })
  }

  const host = status.host || '127.0.0.1'
  const port = status.port || 8765
  const wsUrl = `ws://${host}:${port}/jcode/stream`
  const timeoutMs = options.timeoutMs || STREAM_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    // Node.js 22+ 内置 WebSocket
    const WebSocketCtor = globalThis.WebSocket
    if (!WebSocketCtor) {
      return reject(new JcodeUnavailableError('当前环境不支持 WebSocket', 'no_websocket'))
    }

    let socket = null
    let closedByClient = false
    let connectTimer = null
    let idleTimer = null

    const cleanup = () => {
      if (connectTimer) { clearTimeout(connectTimer); connectTimer = null }
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    }

    const doClose = (code = WS_CLOSE_NORMAL, reason = 'client close') => {
      if (closedByClient) return
      closedByClient = true
      cleanup()
      if (socket && (socket.readyState === WebSocketCtor.OPEN || socket.readyState === 1)) {
        try { socket.close(code, reason) } catch { /* ignore */ }
      }
    }

    try {
      socket = new WebSocketCtor(wsUrl)
    } catch (err) {
      cleanup()
      return reject(new JcodeUnavailableError(
        `无法创建 WebSocket 连接: ${err?.message || String(err)}`, 'ws_create_error'
      ))
    }

    // 连接超时
    connectTimer = setTimeout(() => {
      cleanup()
      const err = new JcodeUnavailableError('jcode WebSocket 连接超时', 'ws_connect_timeout')
      try { callbacks.onError?.(err) } catch { /* ignore */ }
      doClose(1001, 'connect timeout')
    }, WS_CONNECT_TIMEOUT_MS)

    // 全局空闲超时
    idleTimer = setTimeout(() => {
      const err = new JcodeUnavailableError('jcode 流式任务超时', 'ws_idle_timeout')
      try { callbacks.onError?.(err) } catch { /* ignore */ }
      doClose(1001, 'idle timeout')
    }, timeoutMs)

    const resetIdleTimer = () => {
      if (idleTimer) { clearTimeout(idleTimer) }
      idleTimer = setTimeout(() => {
        const err = new JcodeUnavailableError('jcode 流式任务超时', 'ws_idle_timeout')
        try { callbacks.onError?.(err) } catch { /* ignore */ }
        doClose(1001, 'idle timeout')
      }, timeoutMs)
    }

    socket.onopen = () => {
      if (closedByClient) return
      clearTimeout(connectTimer)
      connectTimer = null
      launcher.markActivity()

      // 发送任务
      try {
        socket.send(JSON.stringify(payload || {}))
      } catch (err) {
        cleanup()
        try { callbacks.onError?.(err) } catch { /* ignore */ }
        doClose(1011, 'send error')
        return
      }

      // 连接建立后立即返回控制句柄
      resolve({ close: () => doClose() })
    }

    socket.onmessage = (event) => {
      if (closedByClient) return
      resetIdleTimer()
      launcher.markActivity()

      let parsed = null
      try {
        parsed = JSON.parse(String(event.data || ''))
      } catch {
        // 非 JSON 消息：包装为 raw 事件透传
        try {
          callbacks.onEvent?.({ type: 'raw', data: String(event.data || '').slice(0, 1000) })
        } catch { /* ignore */ }
        return
      }

      if (!parsed || typeof parsed !== 'object') return

      // 按消息类型分发
      if (parsed.type === 'error') {
        try {
          callbacks.onEvent?.({
            type: 'error',
            message: parsed.message || 'jcode 引擎返回错误',
            at: Date.now(),
          })
        } catch { /* ignore */ }
        return
      }

      if (parsed.type === 'done' || parsed.type === 'result') {
        try { callbacks.onEvent?.(parsed) } catch { /* ignore */ }
        try { callbacks.onDone?.() } catch { /* ignore */ }
        doClose()
        return
      }

      // progress / 其他事件：透传
      try { callbacks.onEvent?.(parsed) } catch { /* ignore */ }
    }

    socket.onerror = (event) => {
      if (closedByClient) return
      cleanup()
      const msg = event?.message || 'jcode WebSocket 连接错误'
      try { callbacks.onError?.(new JcodeUnavailableError(msg, 'ws_error')) } catch { /* ignore */ }
    }

    socket.onclose = (event) => {
      cleanup()
      if (!closedByClient && event.code !== WS_CLOSE_NORMAL) {
        const reason = event.reason || `WebSocket 关闭 (code=${event.code})`
        try { callbacks.onError?.(new JcodeUnavailableError(reason, 'ws_closed')) } catch { /* ignore */ }
      }
      try { callbacks.onDone?.() } catch { /* ignore */ }
    }

    // AbortSignal 联动
    if (options.signal) {
      if (options.signal.aborted) {
        doClose(1001, 'aborted')
      } else {
        options.signal.addEventListener('abort', () => doClose(1001, 'aborted'), { once: true })
      }
    }
  })
}

function registerJcodeRoutes(expressApp) {
  if (!expressApp) {
    throw new Error('[jcode-routes] expressApp is required')
  }

  /**
   * GET /api/jcode/health
   * 报告 jcode 引擎的当前状态、检测结果、偏好。
   */
  expressApp.get('/api/jcode/health', async (_req, res) => {
    try {
      const detection = await detector.detectJcode()
      const status = launcher.getStatus()
      const settings = getJcodeSettings()
      res.json({
        ok: true,
        detection,
        status,
        settings,
        timestamp: Date.now(),
      })
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) })
    }
  })

  /**
   * POST /api/jcode/swarm
   * body: { task, sessionId, params, context }
   * 同步调用 jcode 引擎,带 60s 超时。失败时回退提示。
   */
  expressApp.post('/api/jcode/swarm', async (req, res) => {
    const body = req.body || {}
    const settings = getJcodeSettings()
    if (!settings.enabled) {
      return res.status(200).json({
        ok: false,
        fallbackReason: 'jcode_disabled',
        message: 'jcode 未启用,已回退到云端 API',
      })
    }
    try {
      const result = await callJcodeSwarm(body)
      res.json({ ok: true, ...result })
    } catch (err) {
      if (err instanceof JcodeUnavailableError) {
        return res.status(200).json({
          ok: false,
          fallbackReason: 'jcode_unavailable',
          message: err.message,
          status: launcher.getStatus(),
        })
      }
      res.status(500).json({ ok: false, error: err?.message || String(err) })
    }
  })

  /**
   * POST /api/jcode/swarm/stream
   * 流式转发:通过 WebSocket 连接 jcode /jcode/stream 端点,
   * 将逐条进度事件以 SSE 格式推送给前端。
   *
   * SSE 协议:每个事件一行 `data: {json}\n\n`。
   * 若 WebSocket 不可用,回退到同步 HTTP /jcode/swarm 调用。
   */
  expressApp.post('/api/jcode/swarm/stream', async (req, res) => {
    const body = req.body || {}
    const settings = getJcodeSettings()
    if (!settings.enabled) {
      return res.status(200).json({
        ok: false,
        fallbackReason: 'jcode_disabled',
        message: 'jcode 未启用,已回退到云端 API',
      })
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    let closed = false
    const safeWrite = (event) => {
      if (closed) return
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch (err) {
        closed = true
        console.warn('[jcode-routes] SSE 写入失败:', err?.message || err)
      }
    }

    safeWrite({ type: 'start', task: body.task || null, at: Date.now() })

    // 检查 WebSocket 是否可用（Node.js 22+ 内置）
    const hasWebSocket = typeof globalThis.WebSocket === 'function'

    if (!hasWebSocket) {
      // 回退：同步 HTTP 调用
      try {
        const result = await callJcodeSwarm(body, { timeoutMs: STREAM_TIMEOUT_MS })
        safeWrite({ type: 'progress', step: 'completed', data: result, at: Date.now() })
        safeWrite({ type: 'result', data: result, at: Date.now() })
        safeWrite({ type: 'done' })
      } catch (err) {
        safeWrite({
          type: 'error',
          message: err?.message || String(err),
          reason: err instanceof JcodeUnavailableError ? 'jcode_unavailable' : 'internal',
          at: Date.now(),
        })
      } finally {
        if (!closed) res.end()
      }
      return
    }

    // 主路径：WebSocket 流式连接
    const abortController = new AbortController()
    req.on('close', () => {
      closed = true
      abortController.abort()
    })

    try {
      const handle = await connectJcodeStream(body, {
        onEvent: (event) => {
          safeWrite({ ...event, at: event.at || Date.now() })
        },
        onError: (err) => {
          safeWrite({
            type: 'error',
            message: err?.message || String(err),
            reason: err instanceof JcodeUnavailableError ? 'jcode_unavailable' : 'ws_error',
            at: Date.now(),
          })
        },
        onDone: () => {
          safeWrite({ type: 'done', at: Date.now() })
          if (!closed) res.end()
        },
      }, {
        timeoutMs: STREAM_TIMEOUT_MS,
        signal: abortController.signal,
      })

      // 若 connectJcodeStream 同步返回(引擎不可用),handle.close 为空操作
      if (handle && typeof handle.close === 'function') {
        req.on('close', () => {
          try { handle.close() } catch { /* ignore */ }
        })
      }
    } catch (err) {
      // connectJcodeStream reject → 回退到同步 HTTP
      console.warn('[jcode-routes] WebSocket 流式连接失败,回退 HTTP:', err?.message || err)
      try {
        const result = await callJcodeSwarm(body, { timeoutMs: STREAM_TIMEOUT_MS })
        safeWrite({ type: 'progress', step: 'completed', data: result, at: Date.now() })
        safeWrite({ type: 'result', data: result, at: Date.now() })
        safeWrite({ type: 'done' })
      } catch (fallbackErr) {
        safeWrite({
          type: 'error',
          message: fallbackErr?.message || String(fallbackErr),
          reason: fallbackErr instanceof JcodeUnavailableError ? 'jcode_unavailable' : 'internal',
          at: Date.now(),
        })
      } finally {
        if (!closed) res.end()
      }
    }
  })

  /**
   * POST /api/jcode/memory/clear
   * 清空 jcode 本地语义记忆 + WPX memory-service。
   */
  expressApp.post('/api/jcode/memory/clear', async (_req, res) => {
    try {
      const result = await clearAllJcodeMemory()
      res.json({ ok: result.ok, ...result })
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) })
    }
  })

  /**
   * GET /api/jcode/memory/path
   * 返回 jcode 记忆文件所在目录(用于诊断)。
   */
  expressApp.get('/api/jcode/memory/path', (_req, res) => {
    res.json({ ok: true, path: getJcodeMemoryDir() })
  })
}

module.exports = {
  registerJcodeRoutes,
  callJcodeSwarm,
  connectJcodeStream,
  JcodeUnavailableError,
}
