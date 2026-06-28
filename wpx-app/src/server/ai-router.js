/**
 * WPX AI 调度中心(ai-router)
 *
 * 职责：
 * 1. shouldUseJcode(message, options) — 决策：本次任务是否走 jcode 引擎
 * 2. routeTask(payload, options) — 主入口：调用 jcode,失败/未启用时返回降级标记
 *
 * 设计原则：
 * - shouldUseJcode 是纯函数,可在客户端 Composable 中直接复用做 UI 提示
 * - routeTask 通过 fetch 调 local-server 的 /api/jcode/swarm
 *   (local-server 由 Electron 主进程启动,URL 通过环境变量 WPX_LOCAL_SERVER_URL 注入)
 * - 降级透明：返回 { ok:false, fallbackReason, message },前端可据此 toast 提示
 * - 不缓存结果,每次决策都基于最新 userMessage + options
 *
 * 路由规则参照需求文档 §6.3：
 * 复杂模式 → jcode；简单模式 → 云端 API；用户强制 → jcode；其余按长度判断
 */

const COMPLEX_PATTERNS = [
  /教案|教案生成/,
  /PPT|幻灯片|演示文稿/,
  /论文|开题报告|文献综述/,
  /分析.*资料库|分析.*文档/,
  /多章节|长篇|全书/,
  /高性能模式/,
]

const SIMPLE_PATTERNS = [
  /润色|改写|翻译|总结|摘要|缩写|扩写/,
  /改.*字体|换.*颜色|加粗|斜体/,
]

const COMPLEX_LENGTH_THRESHOLD = 200

/**
 * @param {string} userMessage
 * @param {{
 *   forceJcode?: boolean,
 *   simpleOverrides?: boolean,
 *   lengthThreshold?: number,
 * }} [options]
 * @returns {boolean}
 */
export function shouldUseJcode(userMessage, options = {}) {
  const text = String(userMessage || '').trim()
  if (!text) return false

  if (options.forceJcode) return true
  if (options.simpleOverrides) return false

  // 简单模式优先(命中即返回 false)
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(text)) return false
  }

  // 复杂模式命中
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(text)) return true
  }

  // 长度阈值
  const threshold = options.lengthThreshold || COMPLEX_LENGTH_THRESHOLD
  if (text.length > threshold) return true

  // 多步骤指令(包含「然后」)
  if (/然后/.test(text)) return true

  return false
}

/**
 * @returns {string|null} local-server 的 base URL,没有则返回 null
 */
function resolveLocalServerUrl() {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.WPX_LOCAL_SERVER_URL) return process.env.WPX_LOCAL_SERVER_URL
  }
  // 前端调用时(没有 process):返回 null,fallback 由 fetch 兜底
  return null
}

/**
 * @param {{
 *   task: string,
 *   sessionId?: string,
 *   params?: object,
 *   context?: object,
 * }} payload
 * @param {{
 *   forceJcode?: boolean,
 *   localServerUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   signal?: AbortSignal,
 * }} [options]
 * @returns {Promise<{ ok: boolean, fallbackReason?: string, message?: string, data?: any, status?: any }>}
 */
export async function routeTask(payload, options = {}) {
  const userMessage = String(payload?.params?.userMessage || payload?.userMessage || '')
  const wantJcode = options.forceJcode === true
    ? true
    : (payload?.context?.forceJcode === true || shouldUseJcode(userMessage))

  if (!wantJcode) {
    return {
      ok: true,
      engine: 'cloud',
      skippedJcode: true,
    }
  }

  const localServerUrl = options.localServerUrl || resolveLocalServerUrl()
  if (!localServerUrl) {
    return {
      ok: false,
      fallbackReason: 'local_server_unavailable',
      message: 'jcode 适配层未启动(local-server 不可用),已切换至云端 AI',
    }
  }

  const fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null)
  if (!fetchImpl) {
    return {
      ok: false,
      fallbackReason: 'fetch_unavailable',
      message: '当前环境不支持网络请求,已切换至云端 AI',
    }
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs || 60_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const signal = options.signal || controller.signal

  try {
    const url = `${localServerUrl.replace(/\/$/, '')}/api/jcode/swarm`
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: payload.task || 'unspecified',
        sessionId: payload.sessionId || null,
        params: payload.params || {},
        context: payload.context || {},
      }),
      signal,
    })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 500) } }

    if (!res.ok) {
      return {
        ok: false,
        fallbackReason: 'http_error',
        message: `jcode 适配层返回 HTTP ${res.status}`,
        status: res.status,
        data: body,
      }
    }

    if (body && body.ok === false) {
      // jcode 不可用(disabled / unavailable)— 透明降级
      return {
        ok: false,
        fallbackReason: body.fallbackReason || 'jcode_unavailable',
        message: body.message || 'jcode 暂不可用,已切换至云端 AI',
        data: body,
      }
    }

    return {
      ok: true,
      engine: 'jcode',
      data: body,
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        fallbackReason: 'jcode_timeout',
        message: 'jcode 调用超时,已切换至云端 AI',
      }
    }
    return {
      ok: false,
      fallbackReason: 'jcode_error',
      message: err?.message || String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

export const COMPLEX_PATTERN_LIST = COMPLEX_PATTERNS
export const SIMPLE_PATTERN_LIST = SIMPLE_PATTERNS
