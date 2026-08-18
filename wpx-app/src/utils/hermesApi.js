/**
 * hermesApi —— Hermes Agent 本地网关渲染进程 IPC 封装（Phase 3 / M3-C）
 */
import { getElectronAPI, isElectron } from '@/utils/electron'

function getHermesApi() {
  if (!isElectron()) return null
  return getElectronAPI()?.hermes ?? null
}

/** 探测 Python + hermes CLI */
export async function detectHermes() {
  const api = getHermesApi()
  if (!api?.detect) return null
  return api.detect()
}

/** 网关进程状态 */
export async function getHermesStatus() {
  const api = getHermesApi()
  if (!api?.getStatus) return null
  return api.getStatus()
}

/** 启动网关 */
export async function startHermes() {
  const api = getHermesApi()
  if (!api?.start) return null
  return api.start()
}

/** 停止网关 */
export async function stopHermes() {
  const api = getHermesApi()
  if (!api?.stop) return null
  return api.stop()
}

/** 网关偏好（enabled / preStart / gatewayPort） */
export async function getHermesSettings() {
  const api = getHermesApi()
  if (!api?.getSettings) return null
  return api.getSettings()
}

export async function setHermesSettings(partial) {
  const api = getHermesApi()
  if (!api?.setSettings) return null
  return api.setSettings(partial)
}

/** 转发标记（实际执行走 /api/hermes/run） */
export async function callHermesRun(payload) {
  const api = getHermesApi()
  if (!api?.callRun) return null
  return api.callRun(payload)
}

/** M3-C：写入 HERMES_HOME/.env（模型 Key 注入） */
export async function prepareHermesEnv(payload) {
  const api = getHermesApi()
  if (!api?.prepareEnv) return null
  return api.prepareEnv(payload)
}

/** 标记安装引导已展示 */
export async function markHermesInstallHintShown() {
  const api = getHermesApi()
  if (!api?.markInstallHintShown) return null
  return api.markInstallHintShown()
}

/** 订阅网关状态广播 */
export function onHermesStatusChanged(callback) {
  const api = getHermesApi()
  if (typeof api?.onStatusChanged === 'function') {
    return api.onStatusChanged(callback)
  }
  return () => {}
}

/** 订阅设置广播 */
export function onHermesSettingsChanged(callback) {
  const api = getHermesApi()
  if (typeof api?.onSettingsChanged === 'function') {
    return api.onSettingsChanged(callback)
  }
  return () => {}
}

export function isHermesAvailable() {
  return isElectron() && Boolean(getElectronAPI()?.hermes)
}
