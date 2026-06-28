import { isElectron } from '@/utils/electron'

let cachedBaseUrl = null
let resolvePromise = null

/**
 * 获取本地 API 基址：Electron 下由 preload 注入随机端口；Web 下使用 Vite 代理或环境变量。
 * @returns {Promise<string>}
 */
export async function getLocalApiBase() {
  // 关键：仅在“真正拿到非空地址”后才缓存，避免空串被永久冻结导致后续导出 fetch 拿到相对路径而失败。
  if (cachedBaseUrl) {
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
        // Electron 环境拿不到本地服务地址 → 必须抛错让上游明曝问题，
        // 避免空串被缓存后后续 fetch(/api/export) 始终走相对路径从而报 "Failed to fetch"。
        // 同时重置 resolvePromise 以允许后续重试（local-server 可能延迟启动）。
        resolvePromise = null
        const err = new Error('本地导出服务尚未启动或地址不可用')
        err.code = 'WPX_LOCAL_API_UNAVAILABLE'
        throw err
      }

      const exportUrl = (import.meta.env.VITE_EXPORT_API_URL || '').replace(/\/$/, '')
      const removeBgUrl = (import.meta.env.VITE_REMOVE_BG_API_URL || '').replace(/\/$/, '')
      const resolved = exportUrl || removeBgUrl

      if (resolved) {
        cachedBaseUrl = resolved
      } else {
        // 没有配置任何 API 地址时，不缓存空串，允许后续重试。
        // 调用方 fetch('/api/export', ...) 走相对路径，依赖 Vite proxy 或同源部署。
        resolvePromise = null
      }
      return resolved
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
