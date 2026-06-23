/**
 * Electron 环境检测与 preload API 访问
 *
 * 主进程可通过 preload 暴露：
 * - electronAPI.onOpenMarkdownFile(callback)
 * - electronAPI.files.onOpenMarkdown(callback)
 * 并在 OS 层注册 .md 文件关联。
 */

/**
 * @returns {boolean}
 */
export function isElectron() {
  if (typeof window === 'undefined') return false

  if (window.__WPX_ELECTRON__ === true) return true

  if (window.electronAPI) return true

  if (window.location?.protocol === 'file:') return true

  if (typeof process !== 'undefined' && process?.type === 'renderer') {
    return true
  }

  return false
}

/**
 * @returns {Record<string, unknown> | null}
 */
export function getElectronAPI() {
  if (!isElectron()) return null
  return window.electronAPI
}

/**
 * @returns {boolean}
 */
export function hasTraySupport() {
  const api = getElectronAPI()
  return Boolean(api?.tray?.hideMainWindow || api?.tray?.show)
}
