/**
 * 主进程模型 HTTP 转发（流式）
 *
 * 设置页「测试连接」与 AI 对话共用主进程 fetch，避开渲染进程 CORS。
 * 事件协议（models:fetch-event）：
 *   { requestId, type: 'meta', status, statusText, headers }
 *   { requestId, type: 'chunk', chunk: base64 }
 *   { requestId, type: 'end' }
 *   { requestId, type: 'error', message }
 */
const { ipcMain } = require('electron')

/** @type {Map<string, AbortController>} */
const inflight = new Map()

/**
 * @param {Record<string, string> | undefined} headers
 * @returns {Record<string, string>}
 */
function normalizeHeaders(headers) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!headers || typeof headers !== 'object') return out
  for (const [key, value] of Object.entries(headers)) {
    if (value == null || value === '') continue
    out[String(key)] = String(value)
  }
  return out
}

/**
 * @param {import('electron').IpcMainEvent} event
 * @param {{
 *   requestId?: string,
 *   url?: string,
 *   method?: string,
 *   headers?: Record<string, string>,
 *   body?: string,
 * }} payload
 * @param {typeof fetch} [fetchImpl]
 */
async function handleFetchStream(event, payload = {}, fetchImpl = globalThis.fetch) {
  const requestId = String(payload.requestId || '').trim()
  const url = String(payload.url || '').trim()
  const method = String(payload.method || 'GET').toUpperCase()
  const headers = normalizeHeaders(payload.headers)
  const body = payload.body != null ? String(payload.body) : undefined

  const send = (message) => {
    if (event.sender.isDestroyed()) return
    event.sender.send('models:fetch-event', { requestId, ...message })
  }

  if (!requestId) {
    send({ type: 'error', message: '缺少 requestId' })
    return
  }

  if (!url) {
    send({ type: 'error', message: '缺少请求 URL' })
    return
  }

  // 仅允许 http(s)，防止 file/自定义协议滥用
  if (!/^https?:\/\//i.test(url)) {
    send({ type: 'error', message: '仅支持 http(s) 模型接口' })
    return
  }

  const previous = inflight.get(requestId)
  if (previous) {
    previous.abort()
    inflight.delete(requestId)
  }

  const controller = new AbortController()
  inflight.set(requestId, controller)

  try {
    const init = {
      method,
      headers,
      signal: controller.signal,
    }
    if (body != null && method !== 'GET' && method !== 'HEAD') {
      init.body = body
    }

    const response = await fetchImpl(url, init)

    /** @type {Record<string, string>} */
    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    send({
      type: 'meta',
      status: response.status,
      statusText: response.statusText || '',
      headers: responseHeaders,
    })

    if (!response.body) {
      const text = await response.text().catch(() => '')
      if (text) {
        send({ type: 'chunk', chunk: Buffer.from(text, 'utf8').toString('base64') })
      }
      send({ type: 'end' })
      return
    }

    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (controller.signal.aborted) break
      if (value && value.byteLength > 0) {
        send({
          type: 'chunk',
          chunk: Buffer.from(value).toString('base64'),
        })
      }
    }
    send({ type: 'end' })
  } catch (error) {
    if (controller.signal.aborted) {
      send({ type: 'error', message: '请求已取消' })
    } else {
      console.error('[model-fetch]', error)
      send({
        type: 'error',
        message: error?.message || String(error),
      })
    }
  } finally {
    if (inflight.get(requestId) === controller) {
      inflight.delete(requestId)
    }
  }
}

/**
 * @param {{ requestId?: string }} payload
 */
function handleFetchAbort(_event, payload = {}) {
  const requestId = String(payload.requestId || '').trim()
  if (!requestId) return
  const controller = inflight.get(requestId)
  if (controller) {
    controller.abort()
    inflight.delete(requestId)
  }
}

function registerModelFetchIpcHandlers() {
  ipcMain.removeAllListeners('models:fetch-stream')
  ipcMain.removeAllListeners('models:fetch-abort')
  ipcMain.on('models:fetch-stream', (event, payload) => {
    void handleFetchStream(event, payload)
  })
  ipcMain.on('models:fetch-abort', (event, payload) => {
    handleFetchAbort(event, payload)
  })
}

module.exports = {
  registerModelFetchIpcHandlers,
  handleFetchStream,
  handleFetchAbort,
  normalizeHeaders,
}
