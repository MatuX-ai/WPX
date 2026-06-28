/**
 * jcodeApi - jcode 引擎 IPC 适配层
 *
 * 负责把渲染进程对 jcode 引擎的所有需求（探测 / 启停 / 设置 / 调用 / 清理），
 * 映射为 window.electronAPI.jcode.* 的 IPC 调用。在非 Electron 环境下（如 Web），
 * 全部降级为「不可用」结果，保证零侵入。
 *
 * 设计原则：
 * 1. 全部走 window.electronAPI.jcode.*，不直接依赖具体 IPC 通道名
 * 2. 不抛错：失败返回 { ok: false, error }，调用方按需提示
 * 3. 与 modelApi / knowledgeApi 风格保持一致
 */
import { getElectronAPI, isElectron } from '@/utils/electron'

/**
 * @returns {boolean}
 */
export function isJcodeAvailable() {
  if (!isElectron()) return false
  const api = getElectronAPI()?.jcode
  return Boolean(api && typeof api.detect === 'function')
}

/** @type {null | ((payload: any) => void)} */
let cachedStatusHandler = null

/**
 * @param {(status: any) => void} callback
 * @returns {() => void} 取消订阅
 */
export function onJcodeStatusChanged(callback) {
  if (!isJcodeAvailable()) return () => {}
  const api = getElectronAPI().jcode
  if (typeof api.onStatusChanged !== 'function') return () => {}
  // 默认绑定一次，避免重复订阅
  if (cachedStatusHandler) {
    api.onStatusChanged(callback)
  } else {
    cachedStatusHandler = callback
    api.onStatusChanged(callback)
  }
  return () => {
    if (typeof api.offStatusChanged === 'function') {
      api.offStatusChanged(callback)
    }
  }
}

/**
 * @returns {Promise<{ installed: boolean, path: string|null, version: string, meetsRequirement: boolean }>}
 */
export async function detectJcode() {
  if (!isJcodeAvailable()) {
    return { installed: false, path: null, version: '', meetsRequirement: false }
  }
  try {
    const result = await getElectronAPI().jcode.detect()
    return {
      installed: Boolean(result?.installed),
      path: result?.path ?? null,
      version: result?.version ?? '',
      meetsRequirement: Boolean(result?.meetsRequirement),
    }
  } catch (error) {
    console.warn('[jcodeApi] detect failed:', error?.message || error)
    return { installed: false, path: null, version: '', meetsRequirement: false }
  }
}

/**
 * @returns {Promise<{ state: string, pid: number|null, port: number|null, version: string, lastError: string|null }>}
 */
export async function getJcodeStatus() {
  if (!isJcodeAvailable()) {
    return { state: 'unavailable', pid: null, port: null, version: '', lastError: null }
  }
  try {
    const result = await getElectronAPI().jcode.getStatus()
    return {
      state: result?.state ?? 'stopped',
      pid: result?.pid ?? null,
      port: result?.port ?? null,
      version: result?.version ?? '',
      lastError: result?.lastError ?? null,
    }
  } catch (error) {
    return {
      state: 'failed',
      pid: null,
      port: null,
      version: '',
      lastError: error?.message || String(error),
    }
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function startJcode() {
  if (!isJcodeAvailable()) {
    return { ok: false, error: '当前环境不支持 jcode 引擎' }
  }
  try {
    const result = await getElectronAPI().jcode.start()
    return { ok: Boolean(result?.ok), error: result?.error }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function stopJcode() {
  if (!isJcodeAvailable()) {
    return { ok: false, error: '当前环境不支持 jcode 引擎' }
  }
  try {
    const result = await getElectronAPI().jcode.stop()
    return { ok: Boolean(result?.ok), error: result?.error }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

/**
 * @returns {Promise<{ enabled: boolean, useForComplexTasks: boolean, preStart: boolean, lastDetectedVersion: string }>}
 */
export async function getJcodeSettings() {
  if (!isJcodeAvailable()) {
    return {
      enabled: false,
      useForComplexTasks: true,
      preStart: false,
      lastDetectedVersion: '',
    }
  }
  try {
    const result = await getElectronAPI().jcode.getSettings()
    // jcode-ipc.js 返回 { settings, installHintAvailable }；早期实现可能直接返回 settings
    const raw = (result && typeof result === 'object' && 'settings' in result)
      ? result.settings
      : result
    return {
      enabled: Boolean(raw?.enabled),
      useForComplexTasks: raw?.useForComplexTasks !== false,
      preStart: Boolean(raw?.preStart),
      lastDetectedVersion: raw?.lastDetectedVersion ?? '',
    }
  } catch (error) {
    console.warn('[jcodeApi] getJcodeSettings failed:', error?.message || error)
    return {
      enabled: false,
      useForComplexTasks: true,
      preStart: false,
      lastDetectedVersion: '',
    }
  }
}

/**
 * @param {{
 *   enabled?: boolean,
 *   useForComplexTasks?: boolean,
 *   preStart?: boolean,
 *   lastDetectedVersion?: string,
 * }} partial
 * @returns {Promise<{ ok: boolean, settings?: any, error?: string }>}
 */
export async function setJcodeSettings(partial) {
  if (!isJcodeAvailable()) {
    return { ok: false, error: '当前环境不支持 jcode 引擎' }
  }
  try {
    const result = await getElectronAPI().jcode.setSettings(partial)
    return { ok: true, settings: result }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

/**
 * @param {{ task: string, sessionId?: string, params?: object, context?: object }} payload
 * @returns {Promise<{ ok: boolean, data?: any, error?: string, fallbackReason?: string }>}
 */
export async function callJcodeSwarm(payload) {
  if (!isJcodeAvailable()) {
    return { ok: false, error: '当前环境不支持 jcode 引擎', fallbackReason: 'jcode_unavailable' }
  }
  try {
    const result = await getElectronAPI().jcode.callSwarm(payload)
    return result
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error),
      fallbackReason: 'ipc_error',
    }
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function clearJcodeMemory() {
  if (!isJcodeAvailable()) {
    return { ok: false, error: '当前环境不支持 jcode 引擎' }
  }
  try {
    const result = await getElectronAPI().jcode.clearMemory()
    return { ok: Boolean(result?.ok), error: result?.error }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

/**
 * 标记"安装引导提示已经显示过"，避免重复打扰
 * @returns {Promise<{ ok: boolean }>}
 */
export async function markJcodeInstallHintShown() {
  if (!isJcodeAvailable()) return { ok: true }
  try {
    const result = await getElectronAPI().jcode.markInstallHintShown()
    return { ok: Boolean(result?.ok !== false) }
  } catch {
    return { ok: true }
  }
}
