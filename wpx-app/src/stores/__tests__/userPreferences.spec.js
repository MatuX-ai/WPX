import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { usePreferencesStore } from '@/stores/preferences'

const REMOTE_LISTENERS = []

function buildElectronApiMock() {
  return {
    preferences: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockImplementation(async (partial) => partial),
      onChanged: vi.fn().mockImplementation((callback) => {
        REMOTE_LISTENERS.push(callback)
        return () => {
          const index = REMOTE_LISTENERS.indexOf(callback)
          if (index >= 0) REMOTE_LISTENERS.splice(index, 1)
        }
      }),
    },
  }
}

function installElectronMock() {
  REMOTE_LISTENERS.length = 0
  const api = buildElectronApiMock()
  globalThis.window = globalThis.window || {}
  globalThis.window.__WPX_ELECTRON__ = true
  globalThis.window.electronAPI = api
  return api
}

function uninstallElectronMock() {
  if (globalThis.window) {
    delete globalThis.window.__WPX_ELECTRON__
    delete globalThis.window.electronAPI
  }
}

describe('userPreferences — paper 状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    REMOTE_LISTENERS.length = 0
  })

  it('初始默认值符合需求：A4 / normal / 20mm / none / focusMode=false', () => {
    const store = useUserPreferencesStore()
    expect(store.paper.paperSize).toBe('A4')
    expect(store.paper.paperMargin).toBe('normal')
    expect(store.paper.customMargin).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })
    expect(store.paper.headerFooter).toBe('none')
    expect(store.paper.focusMode).toBe(false)
  })

  it('setPaperSize 持久化 paperSize 字段并通过 preferences store 同步', async () => {
    const store = useUserPreferencesStore()
    const api = installElectronMock()

    await store.setPaperSize('Letter')

    expect(store.paper.paperSize).toBe('Letter')
    expect(api.preferences.set).toHaveBeenCalledWith(
      expect.objectContaining({
        paper: expect.objectContaining({ paperSize: 'Letter' }),
      }),
    )

    const preferencesStore = usePreferencesStore()
    expect(preferencesStore.data.paper.paperSize).toBe('Letter')

    uninstallElectronMock()
  })

  it('setPaperMargin 持久化 paperMargin 字段', async () => {
    const store = useUserPreferencesStore()
    const api = installElectronMock()

    await store.setPaperMargin('narrow')

    expect(store.paper.paperMargin).toBe('narrow')
    expect(api.preferences.set).toHaveBeenCalledWith(
      expect.objectContaining({
        paper: expect.objectContaining({ paperMargin: 'narrow' }),
      }),
    )

    uninstallElectronMock()
  })

  it('setCustomMargin 自动切换 paperMargin 为 custom 并规范化范围', async () => {
    const store = useUserPreferencesStore()
    installElectronMock()

    await store.setCustomMargin({ top: 35, bottom: -5, left: 'abc', right: 200 })

    expect(store.paper.paperMargin).toBe('custom')
    expect(store.paper.customMargin).toEqual({ top: 35, bottom: 0, left: 0, right: 100 })

    uninstallElectronMock()
  })

  it('resetCustomMargin 还原到默认 20mm 但保留其他字段', async () => {
    const store = useUserPreferencesStore()
    installElectronMock()

    await store.setCustomMargin({ top: 5 })
    expect(store.paper.customMargin.top).toBe(5)

    await store.resetCustomMargin()
    expect(store.paper.customMargin).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })

    uninstallElectronMock()
  })

  it('setHeaderFooter 持久化 headerFooter 字段', async () => {
    const store = useUserPreferencesStore()
    installElectronMock()

    await store.setHeaderFooter('pageNumber')

    expect(store.paper.headerFooter).toBe('pageNumber')

    uninstallElectronMock()
  })

  it('setFocusMode / toggleFocusMode 正确切换 focus 开关', async () => {
    const store = useUserPreferencesStore()
    installElectronMock()

    expect(store.paper.focusMode).toBe(false)

    await store.setFocusMode(true)
    expect(store.paper.focusMode).toBe(true)

    await store.toggleFocusMode()
    expect(store.paper.focusMode).toBe(false)

    uninstallElectronMock()
  })

  it('savePaper 支持一次性更新多个字段', async () => {
    const store = useUserPreferencesStore()
    installElectronMock()

    await store.savePaper({
      paperSize: '16K',
      paperMargin: 'wide',
      headerFooter: 'custom',
      focusMode: true,
    })

    expect(store.paper).toEqual(
      expect.objectContaining({
        paperSize: '16K',
        paperMargin: 'wide',
        headerFooter: 'custom',
        focusMode: true,
      }),
    )

    uninstallElectronMock()
  })

  it('resetPaperToDefaults 还原所有纸张字段', async () => {
    const store = useUserPreferencesStore()
    installElectronMock()

    await store.savePaper({ paperSize: 'mobile', focusMode: true })
    expect(store.paper.paperSize).toBe('mobile')

    await store.resetPaperToDefaults()
    expect(store.paper.paperSize).toBe('A4')
    expect(store.paper.focusMode).toBe(false)

    uninstallElectronMock()
  })

  it('hydrateFromPreferences 接收 paper 部分时同步 paper 状态', () => {
    const store = useUserPreferencesStore()

    store.hydrateFromPreferences({
      paperSize: 'Letter',
      paperMargin: 'narrow',
      headerFooter: 'pageNumber',
      focusMode: true,
    })

    expect(store.paper).toEqual(
      expect.objectContaining({
        paperSize: 'Letter',
        paperMargin: 'narrow',
        headerFooter: 'pageNumber',
        focusMode: true,
      }),
    )
    expect(store.hydrated).toBe(true)
  })

  it('hydrateFromPreferences 接收 agent 部分时仍同步 agent 状态', () => {
    const store = useUserPreferencesStore()

    store.hydrateFromPreferences({ assistantName: 'WPX 小助手' })

    expect(store.agent.assistantName).toBe('WPX 小助手')
    expect(store.hydrated).toBe(true)
  })

  it('subscribeRemoteChanges 监听 IPC 广播并同步远端 paper 更新', () => {
    installElectronMock()

    const store = useUserPreferencesStore()
    const unsubscribe = store.subscribeRemoteChanges()
    expect(typeof unsubscribe).toBe('function')

    expect(REMOTE_LISTENERS).toHaveLength(1)
    const remoteListener = REMOTE_LISTENERS[0]
    remoteListener({
      paper: { paperSize: 'mobile', focusMode: true },
    })

    expect(store.paper.paperSize).toBe('mobile')
    expect(store.paper.focusMode).toBe(true)

    store.disposeRemoteSubscription()
    expect(REMOTE_LISTENERS).toHaveLength(0)

    uninstallElectronMock()
  })

  it('在非 Electron 环境下 subscribeRemoteChanges 不订阅', () => {
    uninstallElectronMock()
    const store = useUserPreferencesStore()
    const unsubscribe = store.subscribeRemoteChanges()
    expect(unsubscribe).toBeNull()
  })
})