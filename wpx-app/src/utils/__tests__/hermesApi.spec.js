/**
 * hermesApi.spec.js —— Hermes API 渲染进程 IPC 封装单元测试（M3-C 新增）
 *
 * 被测：wpx-app/src/utils/hermesApi.js
 * 运行：npm --prefix wpx-app run test -- hermesApi
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ══════════════════════════════════════════════════════════════
// 1. Mock 基础设施
// ══════════════════════════════════════════════════════════════

/** 构造 fake hermes API 对象（可按用例定制） */
function makeFakeHermesApi(overrides = {}) {
  return {
    detect: vi.fn(),
    getStatus: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getSettings: vi.fn(),
    setSettings: vi.fn(),
    callRun: vi.fn(),
    prepareEnv: vi.fn(),
    markInstallHintShown: vi.fn(),
    onStatusChanged: vi.fn(() => vi.fn()), // 返回 unsubscribe no-op
    onSettingsChanged: vi.fn(() => vi.fn()),
    ...overrides,
  }
}

/** 构造 fake electronAPI（含 hermes 嵌套） */
function makeFakeElectronAPI(hermesApi) {
  return {
    hermes: hermesApi,
  }
}

// ══════════════════════════════════════════════════════════════
// 2. 模块加载（在 mock 之后）
// ══════════════════════════════════════════════════════════════
function loadModule({ isElectronVal = true, electronAPI = null } = {}) {
  vi.resetModules()

  vi.mock('@/utils/electron', () => ({
    isElectron: vi.fn(() => isElectronVal),
    getElectronAPI: vi.fn(() => electronAPI),
  }))

  return import('@/utils/hermesApi').then((m) => m)
}

// ══════════════════════════════════════════════════════════════
// 3. Tests
// ══════════════════════════════════════════════════════════════

describe('hermesApi — 环境检测', () => {
  it('非 Electron 环境 isHermesAvailable 返回 false', async () => {
    const mod = await loadModule({ isElectronVal: false })
    expect(mod.isHermesAvailable()).toBe(false)
  })

  it('Electron 但无 hermes API 时返回 false', async () => {
    const mod = await loadModule({ isElectronVal: true, electronAPI: {} })
    expect(mod.isHermesAvailable()).toBe(false)
  })

  it('Electron + hermes API 存在时返回 true', async () => {
    const fakeHermes = makeFakeHermesApi()
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(mod.isHermesAvailable()).toBe(true)
  })
})

describe('hermesApi — detectHermes', () => {
  it('非 Electron 环境返回 null 不抛错', async () => {
    const mod = await loadModule({ isElectronVal: false })
    await expect(mod.detectHermes()).resolves.toBe(null)
  })

  it('Electron 但 API 缺失时返回 null 不抛错', async () => {
    const mod = await loadModule({ isElectronVal: true, electronAPI: {} })
    await expect(mod.detectHermes()).resolves.toBe(null)
  })

  it('正常调用透传到 api.detect', async () => {
    const fakeHermes = makeFakeHermesApi({
      detect: vi.fn(() => Promise.resolve({ available: true, pythonVersion: '3.12.0' })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.detectHermes()
    expect(result.available).toBe(true)
    expect(fakeHermes.detect).toHaveBeenCalledTimes(1)
  })

  it('IPC reject 时错误透传到调用方', async () => {
    const fakeHermes = makeFakeHermesApi({
      detect: vi.fn(() => Promise.reject(new Error('network down'))),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    await expect(mod.detectHermes()).rejects.toThrow('network down')
  })
})

describe('hermesApi — getHermesStatus / startHermes / stopHermes', () => {
  it('getHermesStatus 透传 getStatus', async () => {
    const fakeHermes = makeFakeHermesApi({
      getStatus: vi.fn(() => Promise.resolve({ state: 'RUNNING', port: 3000, pid: 9999 })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.getHermesStatus()
    expect(result.state).toBe('RUNNING')
    expect(fakeHermes.getStatus).toHaveBeenCalledTimes(1)
  })

  it('startHermes 透传 start', async () => {
    const fakeHermes = makeFakeHermesApi({
      start: vi.fn(() => Promise.resolve({ ok: true, status: { state: 'RUNNING' } })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.startHermes()
    expect(result.ok).toBe(true)
    expect(fakeHermes.start).toHaveBeenCalledTimes(1)
  })

  it('stopHermes 透传 stop', async () => {
    const fakeHermes = makeFakeHermesApi({
      stop: vi.fn(() => Promise.resolve({ ok: true, status: { state: 'STOPPED' } })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.stopHermes()
    expect(result.ok).toBe(true)
    expect(fakeHermes.stop).toHaveBeenCalledTimes(1)
  })

  it('Electron 但通道缺失时各方法返回 null', async () => {
    const fakeHermes = makeFakeHermesApi({ getStatus: undefined, start: undefined, stop: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(await mod.getHermesStatus()).toBe(null)
    expect(await mod.startHermes()).toBe(null)
    expect(await mod.stopHermes()).toBe(null)
  })
})

describe('hermesApi — getHermesSettings / setHermesSettings', () => {
  it('getHermesSettings 透传 getSettings', async () => {
    const fakeHermes = makeFakeHermesApi({
      getSettings: vi.fn(() => Promise.resolve({ enabled: true, gatewayPort: 8642 })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.getHermesSettings()
    expect(result.enabled).toBe(true)
    expect(fakeHermes.getSettings).toHaveBeenCalledTimes(1)
  })

  it('setHermesSettings 透传 partial 参数并原样返回', async () => {
    const nextSettings = { enabled: true, gatewayPort: 9000 }
    const fakeHermes = makeFakeHermesApi({
      setSettings: vi.fn(() => Promise.resolve(nextSettings)),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.setHermesSettings({ enabled: true, gatewayPort: 9000 })
    expect(fakeHermes.setSettings).toHaveBeenCalledWith({ enabled: true, gatewayPort: 9000 })
    expect(result).toEqual(nextSettings)
  })

  it('API 缺失时返回 null', async () => {
    const fakeHermes = makeFakeHermesApi({ getSettings: undefined, setSettings: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(await mod.getHermesSettings()).toBe(null)
    expect(await mod.setHermesSettings({ enabled: true })).toBe(null)
  })
})

describe('hermesApi — callHermesRun', () => {
  it('透传 sessionId 和 task 到 callRun 通道', async () => {
    const payload = { sessionId: 'sess-1', task: '自主调研三款产品' }
    const fakeHermes = makeFakeHermesApi({
      callRun: vi.fn(() => Promise.resolve({ ok: true, proceed: { method: 'POST', url: '/api/hermes/run' } })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.callHermesRun(payload)
    expect(fakeHermes.callRun).toHaveBeenCalledWith(payload)
    expect(result.ok).toBe(true)
  })

  it('未启用降级对象原样透传（不二次包装）', async () => {
    const fallback = { ok: false, fallbackReason: 'hermes_disabled', message: 'Hermes 未启用' }
    const fakeHermes = makeFakeHermesApi({ callRun: vi.fn(() => Promise.resolve(fallback)) })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.callHermesRun({ task: 'x' })
    expect(result).toEqual(fallback)
    expect(result.fallbackReason).toBe('hermes_disabled')
  })

  it('API 缺失时返回 null', async () => {
    const fakeHermes = makeFakeHermesApi({ callRun: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(await mod.callHermesRun({ task: 'x' })).toBe(null)
  })
})

describe('hermesApi — prepareHermesEnv / markHermesInstallHintShown', () => {
  it('prepareHermesEnv 透传 apiKey 和 baseUrl', async () => {
    const fakeHermes = makeFakeHermesApi({
      prepareEnv: vi.fn(() => Promise.resolve({ ok: true, keys: ['OPENAI_API_KEY'] })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.prepareHermesEnv({ apiKey: 'sk-secret', baseUrl: 'https://api.deepseek.com' })
    expect(fakeHermes.prepareEnv).toHaveBeenCalledWith({ apiKey: 'sk-secret', baseUrl: 'https://api.deepseek.com' })
    expect(result.ok).toBe(true)
  })

  it('prepareHermesEnv API 缺失时返回 null', async () => {
    const fakeHermes = makeFakeHermesApi({ prepareEnv: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(await mod.prepareHermesEnv({ apiKey: 'x' })).toBe(null)
  })

  it('markHermesInstallHintShown 透传', async () => {
    const fakeHermes = makeFakeHermesApi({
      markInstallHintShown: vi.fn(() => Promise.resolve({ ok: true })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const result = await mod.markHermesInstallHintShown()
    expect(fakeHermes.markInstallHintShown).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('markHermesInstallHintShown API 缺失时返回 null', async () => {
    const fakeHermes = makeFakeHermesApi({ markInstallHintShown: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(await mod.markHermesInstallHintShown()).toBe(null)
  })
})

describe('hermesApi — 订阅（onHermesStatusChanged / onHermesSettingsChanged）', () => {
  it('onHermesStatusChanged 返回 unsubscribe 函数', async () => {
    const unsubscribed = vi.fn()
    const fakeHermes = makeFakeHermesApi({
      onStatusChanged: vi.fn(() => unsubscribed),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const cb = vi.fn()
    const unsub = mod.onHermesStatusChanged(cb)
    expect(typeof unsub).toBe('function')
    expect(fakeHermes.onStatusChanged).toHaveBeenCalledWith(cb)
  })

  it('onHermesStatusChanged API 缺失时返回 no-op', async () => {
    const fakeHermes = makeFakeHermesApi({ onStatusChanged: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const cb = vi.fn()
    const unsub = mod.onHermesStatusChanged(cb)
    unsub() // no-op，不抛错
    expect(cb).not.toHaveBeenCalled()
  })

  it('onHermesSettingsChanged 行为与 onStatusChanged 一致', async () => {
    const fakeHermes = makeFakeHermesApi({
      onSettingsChanged: vi.fn(() => vi.fn()),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const cb = vi.fn()
    mod.onHermesSettingsChanged(cb)
    expect(fakeHermes.onSettingsChanged).toHaveBeenCalledWith(cb)
  })

  it('onHermesSettingsChanged API 缺失时返回 no-op', async () => {
    const fakeHermes = makeFakeHermesApi({ onSettingsChanged: undefined })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    expect(() => mod.onHermesSettingsChanged(vi.fn())()).not.toThrow()
  })
})

describe('hermesApi — 并发', () => {
  it('多次调用各通道独立不被共享状态干扰', async () => {
    const fakeHermes = makeFakeHermesApi({
      getStatus: vi.fn()
        .mockResolvedValueOnce({ state: 'RUNNING', port: 3000 })
        .mockResolvedValueOnce({ state: 'STOPPED', port: null }),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    const [r1, r2] = await Promise.all([mod.getHermesStatus(), mod.getHermesStatus()])
    expect(r1.state).toBe('RUNNING')
    expect(r2.state).toBe('STOPPED')
    expect(fakeHermes.getStatus).toHaveBeenCalledTimes(2)
  })

  it('start 与 stop 并发发起各通道均被调用', async () => {
    const fakeHermes = makeFakeHermesApi({
      start: vi.fn(() => Promise.resolve({ ok: true })),
      stop: vi.fn(() => Promise.resolve({ ok: true })),
    })
    const mod = await loadModule({ isElectronVal: true, electronAPI: makeFakeElectronAPI(fakeHermes) })
    await Promise.all([mod.startHermes(), mod.stopHermes()])
    expect(fakeHermes.start).toHaveBeenCalledTimes(1)
    expect(fakeHermes.stop).toHaveBeenCalledTimes(1)
  })
})
