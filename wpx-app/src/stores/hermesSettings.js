/**
 * hermesSettings Store（Phase 3 / M3-C）
 *
 * 集中管理 Hermes Agent 网关的用户偏好、运行时状态、状态广播。
 * 模式与 jcodeSettings store 一致：hydrate / updateSettings / start / stop。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  detectHermes as detectHermesApi,
  getHermesSettings as getHermesSettingsApi,
  getHermesStatus as getHermesStatusApi,
  isHermesAvailable,
  onHermesStatusChanged,
  prepareHermesEnv as prepareHermesEnvApi,
  setHermesSettings as setHermesSettingsApi,
  startHermes as startHermesApi,
  stopHermes as stopHermesApi,
} from '@/utils/hermesApi'

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  preStart: false,
  autoRoute: false,
  gatewayPort: 8642,
  lastDetectedState: '',
})

function createDefaultRuntime() {
  return {
    state: 'unavailable', // 探测态：available | missing_python | python_too_old | missing_hermes
    processState: 'STOPPED', // 进程态：STOPPED | STARTING | RUNNING | STOPPING | ERROR
    pythonVersion: null,
    hermesVersion: null,
    pid: null,
    port: null,
    lastError: null,
  }
}

export const useHermesSettingsStore = defineStore('hermesSettings', () => {
  const settings = ref({ ...DEFAULT_SETTINGS })
  const runtime = ref(createDefaultRuntime())
  const hydrated = ref(false)
  let unsubscribeStatus = null

  const available = computed(() => isHermesAvailable())
  const enabled = computed(() => settings.value.enabled === true)
  const detected = computed(() => runtime.value.state === 'available')
  const running = computed(() => runtime.value.processState === 'RUNNING' || runtime.value.processState === 'STARTING')

  /** 综合摘要：detection | process */
  const summary = computed(() => {
    if (!runtime.value.pythonVersion) {
      if (runtime.value.state === 'missing_python') return 'missing_python'
      if (runtime.value.state === 'python_too_old') return 'python_too_old'
      if (runtime.value.state === 'missing_hermes') return 'missing_hermes'
      return 'unknown'
    }
    if (runtime.value.processState === 'RUNNING') return 'running'
    if (runtime.value.processState === 'STARTING') return 'starting'
    if (runtime.value.processState === 'ERROR') return 'failed'
    return 'stopped'
  })

  function applySettings(next) {
    if (!next || typeof next !== 'object') return
    settings.value = { ...DEFAULT_SETTINGS, ...next }
  }

  function applyRuntime(partial) {
    if (!partial || typeof partial !== 'object') return
    runtime.value = { ...runtime.value, ...partial }
  }

  async function hydrate() {
    if (!isHermesAvailable()) {
      hydrated.value = true
      return
    }
    try {
      const [detectResult, settingsResult, statusResult] = await Promise.all([
        detectHermesApi(),
        getHermesSettingsApi(),
        getHermesStatusApi(),
      ])
      if (detectResult) {
        applyRuntime({
          state: detectResult.state || 'unavailable',
          pythonVersion: detectResult.python?.version || null,
          hermesVersion: detectResult.hermes?.version || null,
        })
      }
      if (settingsResult?.settings) {
        applySettings(settingsResult.settings)
      }
      if (statusResult) {
        applyRuntime({
          processState: statusResult.state || 'STOPPED',
          pid: statusResult.pid,
          port: statusResult.port,
          lastError: statusResult.lastError,
        })
      }
    } catch (error) {
      // 静默：网关不可用时不阻塞设置页
      console.warn('[hermesSettings] hydrate 失败:', error?.message || error)
    } finally {
      hydrated.value = true
    }
  }

  async function updateSettings(partial) {
    if (!isHermesAvailable()) return { ok: false, error: 'Hermes 仅桌面端可用' }
    const merged = { ...settings.value, ...(partial || {}) }
    const next = await setHermesSettingsApi(merged)
    if (next) applySettings(next)
    return { ok: Boolean(next), settings: next }
  }

  async function start() {
    if (!isHermesAvailable()) return { ok: false, error: 'Hermes 仅桌面端可用' }
    const result = await startHermesApi()
    return result || { ok: false, error: '启动失败（IPC 不可用）' }
  }

  async function stop() {
    if (!isHermesAvailable()) return { ok: false, error: 'Hermes 仅桌面端可用' }
    const result = await stopHermesApi()
    return result || { ok: false, error: '停止失败（IPC 不可用）' }
  }

  /** M3-C：注入模型 Key 到 HERMES_HOME/.env */
  async function prepareEnv(payload) {
    if (!isHermesAvailable()) return { ok: false, error: 'Hermes 仅桌面端可用' }
    const result = await prepareHermesEnvApi(payload)
    return result || { ok: false, error: '写入失败（IPC 不可用）' }
  }

  function subscribeStatus() {
    if (unsubscribeStatus) return unsubscribeStatus
    unsubscribeStatus = onHermesStatusChanged((status) => {
      if (status && typeof status === 'object') {
        applyRuntime({
          processState: status.state || runtime.value.processState,
          pid: status.pid,
          port: status.port,
          lastError: status.lastError,
        })
      }
    })
    return unsubscribeStatus
  }

  return {
    settings,
    runtime,
    hydrated,
    available,
    enabled,
    detected,
    running,
    summary,
    hydrate,
    updateSettings,
    start,
    stop,
    prepareEnv,
    subscribeStatus,
  }
})

export default useHermesSettingsStore
