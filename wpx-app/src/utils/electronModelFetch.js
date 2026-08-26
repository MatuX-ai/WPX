/**
 * Electron 主进程流式 fetch 适配器。
 * 与设置页「测试连接」走同一网络栈（主进程），避免渲染进程 CORS / file:// Origin。
 */
import { getElectronAPI } from '@/utils/electron'

/**
 * @param {HeadersInit | undefined} headers
 * @returns {Record<string, string>}
 */
function headersToObject(headers) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!headers) return out

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }

  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (!pair || pair.length < 2) continue
      out[String(pair[0])] = String(pair[1])
    }
    return out
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue
    out[String(key)] = String(value)
  }
  return out
}

/**
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64) {
  const binary = atob(String(base64 || ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * @returns {boolean}
 */
export function canUseElectronModelFetch() {
  const api = getElectronAPI()?.models
  return Boolean(api?.startFetch && api?.onFetchEvent)
}

/**
 * 创建可交给 AI SDK 的 fetch 实现（返回标准 Response + ReadableStream）。
 * @returns {typeof fetch}
 */
export function createElectronModelFetch() {
  /** @type {typeof fetch} */
  return async function electronModelFetch(input, init = {}) {
    const api = getElectronAPI()?.models
    if (!api?.startFetch || !api?.onFetchEvent) {
      throw new Error('当前环境不支持主进程模型请求')
    }

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `model-fetch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    const url = typeof input === 'string' ? input : String(input?.url || input)
    const method = String(init.method || 'GET').toUpperCase()
    const headers = headersToObject(init.headers)
    let body
    if (init.body != null && method !== 'GET' && method !== 'HEAD') {
      body = typeof init.body === 'string' ? init.body : String(init.body)
    }

    /** @type {ReadableStreamDefaultController<Uint8Array> | null} */
    let streamController = null
    /** @type {Uint8Array[]} */
    const pendingChunks = []
    let ended = false
    /** @type {Error | null} */
    let streamError = null

    /** @type {(value?: unknown) => void} */
    let resolveMeta
    /** @type {(reason?: unknown) => void} */
    let rejectMeta
    const metaPromise = new Promise((resolve, reject) => {
      resolveMeta = resolve
      rejectMeta = reject
    })

    let metaSettled = false

    const flushPending = () => {
      if (!streamController) return
      for (const chunk of pendingChunks) {
        streamController.enqueue(chunk)
      }
      pendingChunks.length = 0
      if (streamError) {
        try {
          streamController.error(streamError)
        } catch {
          // ignore
        }
        return
      }
      if (ended) {
        try {
          streamController.close()
        } catch {
          // ignore
        }
      }
    }

    const unsubscribe = api.onFetchEvent((event) => {
      if (!event || event.requestId !== requestId) return

      if (event.type === 'meta') {
        if (metaSettled) return
        metaSettled = true
        resolveMeta({
          status: Number(event.status) || 0,
          statusText: String(event.statusText || ''),
          headers: event.headers && typeof event.headers === 'object' ? event.headers : {},
        })
        return
      }

      if (event.type === 'chunk') {
        const bytes = base64ToUint8Array(event.chunk)
        if (streamController) {
          try {
            streamController.enqueue(bytes)
          } catch {
            // stream 已关闭时忽略
          }
        } else {
          pendingChunks.push(bytes)
        }
        return
      }

      if (event.type === 'end') {
        ended = true
        unsubscribe()
        if (streamController) {
          try {
            streamController.close()
          } catch {
            // ignore
          }
        }
        return
      }

      if (event.type === 'error') {
        const err = new Error(String(event.message || '模型请求失败'))
        streamError = err
        unsubscribe()
        if (!metaSettled) {
          metaSettled = true
          rejectMeta(err)
        }
        if (streamController) {
          try {
            streamController.error(err)
          } catch {
            // ignore
          }
        }
      }
    })

    const onAbort = () => {
      try {
        api.abortFetch?.({ requestId })
      } catch {
        // ignore
      }
      const err = new Error('请求已取消')
      err.name = 'AbortError'
      streamError = err
      unsubscribe()
      if (!metaSettled) {
        metaSettled = true
        rejectMeta(err)
      }
      if (streamController) {
        try {
          streamController.error(err)
        } catch {
          // ignore
        }
      }
    }

    if (init.signal) {
      if (init.signal.aborted) {
        onAbort()
      } else {
        init.signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    // 先订阅再发起，避免 meta/chunk 竞态丢失
    api.startFetch({
      requestId,
      url,
      method,
      headers,
      body,
    })

    const meta = await metaPromise
    const stream = new ReadableStream({
      start(controller) {
        streamController = controller
        flushPending()
      },
      cancel() {
        try {
          api.abortFetch?.({ requestId })
        } catch {
          // ignore
        }
      },
    })

    return new Response(stream, {
      status: meta.status,
      statusText: meta.statusText,
      headers: meta.headers,
    })
  }
}
