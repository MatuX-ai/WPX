import { isElectron } from '@/utils/electron'

let cachedBaseUrl = null
let resolvePromise = null

/**
 * 获取本地 API 基址：Electron 下由 preload 注入随机端口；Web 下使用 Vite 代理或环境变量。
 * @returns {Promise<string>}
 */
export async function getLocalApiBase() {
  if (cachedBaseUrl !== null) {
    return cachedBaseUrl
  }

  if (!resolvePromise) {
    resolvePromise = (async () => {
      if (isElectron()) {
        const baseUrl = await window.electronAPI?.localServer?.getBaseUrl?.()
        if (baseUrl) {
          cachedBaseUrl = String(baseUrl).replace(/\/$/, '')
          return cachedBaseUrl
        }
      }

      const exportUrl = (import.meta.env.VITE_EXPORT_API_URL || '').replace(/\/$/, '')
      const removeBgUrl = (import.meta.env.VITE_REMOVE_BG_API_URL || '').replace(/\/$/, '')

      cachedBaseUrl = exportUrl || removeBgUrl || ''
      return cachedBaseUrl
    })()
  }

  return resolvePromise
}

/**
 * 预加载本地 API 地址（建议在 Electron 应用启动时调用一次）
 */
export function primeLocalApiBase() {
  return getLocalApiBase()
}
