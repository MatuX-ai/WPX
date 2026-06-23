/**
 * 桌面端窗口控制 API 抽象层
 * 兼容 Electron preload (window.wpx.window / window.electronAPI) 与浏览器降级
 *
 * 托盘相关 API 见 window.electronAPI.tray（由 electron/preload.js + main.js 实现）
 */

import { isElectron } from '@/utils/electron'

export function detectPlatform() {
  const api = getWindowApi()
  if (api?.platform === 'darwin') return 'macos'
  if (api?.platform === 'win32') return 'windows'
  if (api?.platform === 'linux') return 'windows'

  if (typeof navigator === 'undefined') return 'windows'

  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''

  if (/Mac|iPhone|iPad|iPod/.test(ua) || platform.includes('Mac')) {
    return 'macos'
  }

  return 'windows'
}

function getWindowApi() {
  if (typeof window === 'undefined') return null
  return window.wpx?.window ?? window.electronAPI ?? null
}

export function hasNativeWindowControls() {
  if (!isElectron()) return false
  const api = getWindowApi()
  return Boolean(api?.minimize && api?.close)
}

export async function queryIsMaximized() {
  const api = getWindowApi()
  if (typeof api?.isMaximized === 'function') {
    return api.isMaximized()
  }
  return Boolean(document.fullscreenElement)
}

export function minimizeWindow() {
  getWindowApi()?.minimize?.()
}

export async function toggleMaximizeWindow() {
  const api = getWindowApi()

  if (typeof api?.maximizeRestore === 'function') {
    api.maximizeRestore()
    if (typeof api?.isMaximized === 'function') {
      return api.isMaximized()
    }
    return true
  }

  if (typeof api?.isMaximized === 'function') {
    const maximized = await api.isMaximized()
    if (maximized) {
      api.unmaximize?.()
      return false
    }
    api.maximize?.()
    return true
  }

  if (typeof api?.toggleMaximize === 'function') {
    return api.toggleMaximize()
  }

  if (typeof api?.maximize === 'function') {
    api.maximize()
    return true
  }

  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.()
    return true
  }

  await document.exitFullscreen?.()
  return false
}

export function closeWindow() {
  const api = getWindowApi()
  if (typeof api?.requestClose === 'function') {
    api.requestClose()
    return
  }
  api?.close?.()
}

export function confirmWindowClose() {
  getWindowApi()?.confirmClose?.()
}

export function cancelWindowClose() {
  getWindowApi()?.cancelClose?.()
}
