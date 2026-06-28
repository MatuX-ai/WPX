import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJcodeSettingsStore } from '@/stores/jcodeSettings'

const { jcodeApiMock, electronMock } = vi.hoisted(() => ({
  jcodeApiMock: {
    detectJcode: vi.fn(),
    getJcodeStatus: vi.fn(),
    getJcodeSettings: vi.fn(),
    setJcodeSettings: vi.fn(),
    startJcode: vi.fn(),
    stopJcode: vi.fn(),
    clearJcodeMemory: vi.fn(),
    markJcodeInstallHintShown: vi.fn(),
    callJcodeSwarm: vi.fn(),
    isJcodeAvailable: vi.fn(() => true),
    onJcodeStatusChanged: vi.fn(() => () => {}),
  },
  electronMock: {
    isElectron: vi.fn(() => true),
    getElectronAPI: vi.fn(() => ({
      preferences: { set: vi.fn(async () => ({ ok: true })) },
    })),
  },
}))

vi.mock('@/utils/jcodeApi', () => jcodeApiMock)
vi.mock('@/utils/electron', () => electronMock)

describe('jcodeSettings — 状态与偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    jcodeApiMock.isJcodeAvailable.mockReturnValue(true)
    jcodeApiMock.onJcodeStatusChanged.mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrate() 拉取 detect + status + settings 后填充状态', async () => {
    jcodeApiMock.detectJcode.mockResolvedValue({
      installed: true,
      path: '/usr/local/bin/jcode',
      version: '0.9.2',
      meetsRequirement: true,
    })
    jcodeApiMock.getJcodeStatus.mockResolvedValue({
      state: 'RUNNING',
      pid: 12345,
      port: 8765,
      version: '0.9.2',
      lastError: null,
    })
    jcodeApiMock.getJcodeSettings.mockResolvedValue({
      enabled: true,
      useForComplexTasks: true,
      preStart: false,
      lastDetectedVersion: '0.9.2',
    })

    const store = useJcodeSettingsStore()
    await store.hydrate()

    expect(store.hydrated).toBe(true)
    expect(store.installed).toBe(true)
    expect(store.runtime.path).toBe('/usr/local/bin/jcode')
    expect(store.runtime.state).toBe('RUNNING')
    expect(store.settings.enabled).toBe(true)
    expect(store.summary).toBe('running')
  })

  it('summary 在不同 state 下正确归类', async () => {
    const store = useJcodeSettingsStore()
    store.applyRuntime({ installed: true, state: 'STOPPED' })
    expect(store.summary).toBe('stopped')

    store.applyRuntime({ installed: true, state: 'STARTING' })
    expect(store.summary).toBe('starting')

    store.applyRuntime({ installed: true, state: 'RUNNING' })
    expect(store.summary).toBe('running')

    store.applyRuntime({ installed: true, state: 'SLEEPING' })
    expect(store.summary).toBe('sleeping')

    store.applyRuntime({ installed: true, state: 'FAILED' })
    expect(store.summary).toBe('failed')

    store.applyRuntime({ installed: false, state: 'STOPPED' })
    expect(store.summary).toBe('not_installed')
  })

  it('updateSettings 在 IPC 失败时返回 error 且不更新 store', async () => {
    jcodeApiMock.setJcodeSettings.mockResolvedValue({
      ok: false,
      error: 'IPC 失败',
    })
    const store = useJcodeSettingsStore()
    const before = store.settings.enabled
    const result = await store.updateSettings({ enabled: true })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('IPC 失败')
    expect(store.settings.enabled).toBe(before)
  })

  it('updateSettings 成功时同步到 preferences + 内存', async () => {
    jcodeApiMock.setJcodeSettings.mockResolvedValue({
      ok: true,
      settings: { enabled: true, useForComplexTasks: false, preStart: true, lastDetectedVersion: '0.9.2' },
    })
    const store = useJcodeSettingsStore()
    const result = await store.updateSettings({ enabled: true })
    expect(result.ok).toBe(true)
    expect(store.settings.enabled).toBe(true)
    expect(store.settings.useForComplexTasks).toBe(false)
    expect(store.settings.preStart).toBe(true)
  })

  it('Web 环境（isJcodeAvailable=false）下 hydrate 直接置为 hydrated 且不报错', async () => {
    jcodeApiMock.isJcodeAvailable.mockReturnValue(false)
    const store = useJcodeSettingsStore()
    await store.hydrate()
    expect(store.hydrated).toBe(true)
    expect(jcodeApiMock.detectJcode).not.toHaveBeenCalled()
  })

  it('Web 环境下的 updateSettings 仅更新内存，不调 IPC', async () => {
    jcodeApiMock.isJcodeAvailable.mockReturnValue(false)
    const store = useJcodeSettingsStore()
    const result = await store.updateSettings({ enabled: true })
    expect(result.ok).toBe(true)
    expect(jcodeApiMock.setJcodeSettings).not.toHaveBeenCalled()
    expect(store.settings.enabled).toBe(true)
  })

  it('onJcodeStatusChanged 回调触发时实时更新 runtime 状态', async () => {
    let capturedCallback = null
    jcodeApiMock.onJcodeStatusChanged.mockImplementation((cb) => {
      capturedCallback = cb
      return () => {}
    })
    jcodeApiMock.detectJcode.mockResolvedValue({
      installed: true,
      path: '/usr/bin/jcode',
      version: '0.9.0',
      meetsRequirement: true,
    })
    jcodeApiMock.getJcodeStatus.mockResolvedValue({
      state: 'STOPPED',
      pid: null,
      port: null,
      version: '0.9.0',
      lastError: null,
    })
    jcodeApiMock.getJcodeSettings.mockResolvedValue({
      enabled: false,
      useForComplexTasks: true,
      preStart: false,
      lastDetectedVersion: '0.9.0',
    })

    const store = useJcodeSettingsStore()
    await store.hydrate()

    expect(store.runtime.state).toBe('STOPPED')
    // 模拟主进程广播
    capturedCallback?.({ state: 'RUNNING', pid: 999, port: 8765 })
    expect(store.runtime.state).toBe('RUNNING')
    expect(store.runtime.pid).toBe(999)
    expect(store.runtime.port).toBe(8765)
  })

  it('startEngine / stopEngine / clearMemory 直接透传到 jcodeApi', async () => {
    jcodeApiMock.startJcode.mockResolvedValue({ ok: true })
    jcodeApiMock.stopJcode.mockResolvedValue({ ok: true })
    jcodeApiMock.clearJcodeMemory.mockResolvedValue({ ok: true })

    const store = useJcodeSettingsStore()
    expect(await store.startEngine()).toEqual({ ok: true })
    expect(await store.stopEngine()).toEqual({ ok: true })
    expect(await store.clearMemory()).toEqual({ ok: true })
  })
})
