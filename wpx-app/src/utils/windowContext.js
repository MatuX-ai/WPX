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
