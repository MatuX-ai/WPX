/**
 * hermesSettings.spec.js —— Hermes 网关设置 store（M3-C）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHermesSettingsStore } from '@/stores/hermesSettings'

const apiMocks = {
  detect: vi.fn(),
  getSettings: vi.fn(),
  getStatus: vi.fn(),
  setSettings: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  prepareEnv: vi.fn(),
}

vi.mock('@/utils/hermesApi', () => ({
  detectHermes: (...a) => apiMocks.detect(...a),
  getHermesSettings: (...a) => apiMocks.getSettings(...a),
  getHermesStatus: (...a) => apiMocks.getStatus(...a),
  setHermesSettings: (...a) => apiMocks.setSettings(...a),
  startHermes: (...a) => apiMocks.start(...a),
  stopHermes: (...a) => apiMocks.stop(...a),
  prepareHermesEnv: (...a) => apiMocks.prepareEnv(...a),
  isHermesAvailable: () => true,
  onHermesStatusChanged: () => () => {},
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('hermesSettings store — hydrate', () => {
  it('拉取探测 + 设置 + 状态并合并到 runtime', async () => {
    apiMocks.detect.mockResolvedValue({
      ok: true,
      state: 'available',
      python: { version: '3.12.7' },
      hermes: { version: '0.19.0' },
    })
    apiMocks.getSettings.mockResolvedValue({ settings: { enabled: true, gatewayPort: 8642, preStart: false } })
    apiMocks.getStatus.mockResolvedValue({ state: 'RUNNING', pid: 1, port: 8642, lastError: null })

    const store = useHermesSettingsStore()
    await store.hydrate()

    expect(store.hydrated).toBe(true)
    expect(store.detected).toBe(true)
    expect(store.running).toBe(true)
    expect(store.runtime.pythonVersion).toBe('3.12.7')
    expect(store.settings.enabled).toBe(true)
    expect(store.summary).toBe('running')
  })

  it('未安装时 summary 映射正确', async () => {
    apiMocks.detect.mockResolvedValue({ ok: false, state: 'missing_python', python: { version: null }, hermes: { version: null } })
    apiMocks.getSettings.mockResolvedValue({ settings: {} })
    apiMocks.getStatus.mockResolvedValue({ state: 'STOPPED' })

    const store = useHermesSettingsStore()
    await store.hydrate()
    expect(store.summary).toBe('missing_python')
  })
})

describe('hermesSettings store — updateSettings / start / stop / prepareEnv', () => {
  it('updateSettings 合并并返回结果', async () => {
    apiMocks.setSettings.mockResolvedValue({ enabled: true, gatewayPort: 8642 })
    const store = useHermesSettingsStore()
    const result = await store.updateSettings({ enabled: true })
    expect(result.ok).toBe(true)
    expect(store.settings.enabled).toBe(true)
  })

  it('start / stop 转发 IPC 结果', async () => {
    apiMocks.start.mockResolvedValue({ ok: true, status: { state: 'RUNNING' } })
    apiMocks.stop.mockResolvedValue({ ok: true, status: { state: 'STOPPED' } })
    const store = useHermesSettingsStore()
    expect((await store.start()).ok).toBe(true)
    expect((await store.stop()).ok).toBe(true)
  })

  it('prepareEnv 转发 Key 注入', async () => {
    apiMocks.prepareEnv.mockResolvedValue({ ok: true, path: '/x/.env', keys: ['OPENAI_API_KEY'] })
    const store = useHermesSettingsStore()
    const result = await store.prepareEnv({ apiKey: 'sk-1' })
    expect(result.ok).toBe(true)
    expect(apiMocks.prepareEnv).toHaveBeenCalledWith({ apiKey: 'sk-1' })
  })
})
