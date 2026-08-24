/**
 * 多窗口上下文：从启动 URL 解析 windowId / docPath，并提供按窗口隔离的存储键。
 */

/**
 * @returns {URLSearchParams}
 */
export function getLaunchSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams()
  }

  const fromSearch = new URLSearchParams(window.location.search)
  if (fromSearch.has('windowId') || fromSearch.has('docPath')) {
    return fromSearch
  }

  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex >= 0) {
    return new URLSearchParams(hash.slice(queryIndex + 1))
  }

  return fromSearch
}

/**
 * @returns {number}
 */
export function parseWindowIdFromUrl() {
  const raw = getLaunchSearchParams().get('windowId')
  if (!raw) return 0

  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id >= 0 ? id : 0
}

/**
 * 在 Vue 应用挂载前调用，将 windowId 写入全局。
 * @returns {number}
 */
export function initWindowContext() {
  const windowId = parseWindowIdFromUrl()

  if (typeof window !== 'undefined') {
    window.__WPX_WINDOW_ID__ = windowId
  }

  return windowId
}

/**
 * @returns {number}
 */
export function getWindowId() {
  if (typeof window !== 'undefined' && typeof window.__WPX_WINDOW_ID__ === 'number') {
    return window.__WPX_WINDOW_ID__
  }
  return 0
}

/**
 * @returns {string}
 */
export function getDocPathFromUrl() {
  return getLaunchSearchParams().get('docPath') || ''
}

/**
 * 读取 AI 模式下的用户意图（作为 Hermes 流式任务的输入）。
 * @returns {string}
 */
export function getLaunchIntentFromUrl() {
  return getLaunchSearchParams().get('intent') || ''
}

/**
 * 读取新窗口启动模式：'normal' | 'blank' | 'ai' | 'template'。
 * - normal：常规窗口（首启动 / 任务栏点击恢复）仍走草稿恢复逻辑
 * - blank：强制空白，工具栏【新建】选择完全空白时触发
 * - ai：强制空白 + 启动后调用 AI 流式写文
 * - template：强制空白 + 启动后按 templateId 应用冷启动模板
 * @returns {string}
 */
export function getLaunchModeFromUrl() {
  const mode = getLaunchSearchParams().get('mode')
  if (mode === 'blank' || mode === 'ai' || mode === 'template') return mode
  return 'normal'
}

/**
 * 读取模板模式下的冷启动模板 ID（与 cold-start-templates.js 中的 id 对齐）。
 * @returns {string}
 */
export function getLaunchTemplateIdFromUrl() {
  return getLaunchSearchParams().get('templateId') || ''
}

/**
 * 为需要按窗口隔离的 localStorage 键附加 windowId 后缀。
 * @param {string} baseKey
 * @returns {string}
 */
export function scopedStorageKey(baseKey) {
  const windowId = getWindowId()
  return windowId > 0 ? `${baseKey}:w${windowId}` : baseKey
}

/**
 * @param {import('vue-router').RouteLocationNormalizedLoaded | { name?: string | symbol | null }} route
 * @returns {boolean}
 */
export function isEditorRoute(route) {
  return route.name === 'editor'
}
