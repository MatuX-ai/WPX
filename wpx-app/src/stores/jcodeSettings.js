/**
 * jcodeSettings Store
 *
 * 集中管理 jcode 引擎的用户偏好、运行时状态、状态广播。
 * 遵循与 useModelSettingsStore 一致的"hydrate / save / 持久化"模式。
 *
 * 数据流：
 *   ① store.hydrate() — 启动时调 IPC 拉取 detect + settings + status
 *   ② store.updateSettings(partial) — 调 setJcodeSettings IPC + 持久化
 *   ③ onJcodeStatusChanged 订阅 — 实时刷新 status
 *
 * 持久化：偏好经 preferences.set({ jcode: ... }) 落到主进程 electron-store。
 *         运行时 status (state / pid / port) 不持久化，仅运行时持有。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  callJcodeSwarm as callJcodeSwarmApi,
  clearJcodeMemory as clearJcodeMemoryApi,
  detectJcode as detectJcodeApi,
  getJcodeSettings as getJcodeSettingsApi,
  getJcodeStatus as getJcodeStatusApi,
  isJcodeAvailable,
  markJcodeInstallHintShown as markHintApi,
  onJcodeStatusChanged,
  setJcodeSettings as setJcodeSettingsApi,
  startJcode as startJcodeApi,
  stopJcode as stopJcodeApi,
} from '@/utils/jcodeApi'
import { getElectronAPI } from '@/utils/electron'

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  useForComplexTasks: true,
  preStart: false,
  lastDetectedVersion: '',
})

function createDefaultRuntime() {
  return {
    installed: false,
    path: null,
    version: '',
    meetsRequirement: false,
    state: 'unavailable',
    pid: null,
    port: null,
    lastError: null,
  }
}

export const useJcodeSettingsStore = defineStore('jcodeSettings', () => {
  const settings = ref({ ...DEFAULT_SETTINGS })
  const runtime = ref(createDefaultRuntime())
  const hydrated = ref(false)
  let unsubscribeStatus = null

  const available = computed(() => isJcodeAvailable())
  const enabled = computed(() => settings.value.enabled === true)
  const installed = computed(() => runtime.value.installed === true)
  const state = computed(() => {
    const raw = String(runtime.value.state || '').toLowerCase()
    if (!raw) return 'unavailable'
    if (raw === 'unavailable' || raw === 'not_installed') return raw
    // 主进程 launcher.state 是大写（RUNNING / STOPPED / SLEEPING / FAILED / STARTING）
    if (runtime.value.installed) return raw
    return 'not_installed'
  })
  const summary = computed(() => {
    const s = state.value
    if (!runtime.value.installed || s === 'not_installed') return 'not_installed'
    if (s === 'running') return 'running'
    if (s === 'starting') return 'starting'
    if (s === 'sleeping') return 'sleeping'
    if (s === 'failed') return 'failed'
    if (s === 'stopped' || s === 'unavailable') return 'stopped'
    return 'stopped'
  })

  function applySettings(next) {
    if (!next || typeof next !== 'object') return
    settings.value = {
      ...DEFAULT_SETTINGS,
      ...next,
    }
  }

  function applyRuntime(partial) {
    if (!partial || typeof partial !== 'object') return
    runtime.value = {
      ...runtime.value,
      ...partial,
    }
  }

  /**
   * 初始化 / 拉取最新数据。在挂载时调一次即可。
   * @returns {Promise<void>}
   */
  async function hydrate() {
    if (!isJcodeAvailable()) {
      hydrated.value = true
      return
    }
    try {
      const [detectResult, settingsResult, statusResult] = await Promise.all([
        detectJcodeApi(),
        getJcodeSettingsApi(),
        getJcodeStatusApi(),
      ])
      applyRuntime({
        installed: detectResult.installed,
        path: detectResult.path,
        version: detectResult.version || statusResult.version,
        meetsRequirement: detectResult.meetsRequirement,
        state: statusResult.state,
        pid: statusResult.pid,
        port: statusResult.port,
        lastError: statusResult.lastError,
      })
      applySettings(settingsResult)
    } catch (error) {
      console.warn('[jcodeSettings] hydrate failed:', error?.message || error)
    } finally {
      hydrated.value = true
    }

    // 订阅状态广播
    if (!unsubscribeStatus) {
      unsubscribeStatus = onJcodeStatusChanged((status) => {
        if (!status) return
        applyRuntime({
          state: status.state ?? runtime.value.state,
          pid: status.pid ?? runtime.value.pid,
          port: status.port ?? runtime.value.port,
          lastError: status.lastError ?? null,
          version: status.version || runtime.value.version,
        })
      })
    }
  }

  /**
   * 持久化偏好到主进程 electron-store + 触发 jcode-store IPC。
   * @param {Partial<typeof DEFAULT_SETTINGS>} partial
   */
  async function updateSettings(partial) {
    if (!isJcodeAvailable()) {
      // Web 环境：仅更新内存
      applySettings({ ...settings.value, ...partial })
      return { ok: true, settings: { ...settings.value, ...partial } }
    }
    const merged = { ...settings.value, ...partial }
    const ipcResult = await setJcodeSettingsApi(merged)
    if (ipcResult?.ok) {
      applySettings(ipcResult.settings || merged)
      // 同步到 preferences store（用于跨设备/迁移），不影响 electron-store 行为
      try {
        const api = getElectronAPI()
        if (api?.preferences?.set) {
          await api.preferences.set({ jcode: ipcResult.settings || merged })
        }
      } catch (error) {
        console.warn('[jcodeSettings] preferences.set failed:', error?.message || error)
      }
      return { ok: true, settings: ipcResult.settings || merged }
    }
    return { ok: false, error: ipcResult?.error || '保存失败' }
  }

  async function startEngine() {
    return startJcodeApi()
  }

  async function stopEngine() {
    return stopJcodeApi()
  }

  async function clearMemory() {
    return clearJcodeMemoryApi()
  }

  async function markInstallHintShown() {
    return markHintApi()
  }

  async function callSwarm(payload) {
    return callJcodeSwarmApi(payload)
  }

  /**
   * 卸载监听。在 Pinia dispose 时调用，避免内存泄漏。
   */
  function dispose() {
    if (unsubscribeStatus) {
      unsubscribeStatus()
      unsubscribeStatus = null
    }
  }

  return {
    settings,
    runtime,
    hydrated,
    available,
    enabled,
    installed,
    state,
    summary,
    hydrate,
    updateSettings,
    startEngine,
    stopEngine,
    clearMemory,
    markInstallHintShown,
    callSwarm,
    applySettings,
    applyRuntime,
    dispose,
  }
})
