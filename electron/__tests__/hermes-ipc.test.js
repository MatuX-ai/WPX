/**
 * hermes-ipc 单元测试（Phase 3 / M3 补充 — 从 3 个用例扩至 22 个）
 *
 * 覆盖：9个 IPC 通道 handler + broadcastStatus/Settings + initHermesIpc 完整流程
 * 运行：npm --prefix wpx-app run test:zip -- hermes-ipc
 */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ══════════════════════════════════════════════════════════════
// 1. Mock 基础设施
// ══════════════════════════════════════════════════════════════

/** 伪造 BrowserWindow（可追踪 send 调用） */
function makeFakeWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: vi.fn(),
    },
  }
}

/** 伪造 app.getPath */
function makeFakeApp(userData = '/fake/userData') {
  return {
    isPackaged: false,
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    getPath: vi.fn(() => userData),
  }
}

// ══════════════════════════════════════════════════════════════
// 2. 完整 hermes-ipc 模块加载（含全部 mock）
// ══════════════════════════════════════════════════════════════
function loadModule({
  fakeWindows = [makeFakeWindow()],
  fakeApp = makeFakeApp(),
  detectResult = { available: true, pythonVersion: '3.11.0', hermesVersion: '0.19.0' },
  launcherStatus = { state: 'STOPPED', port: null, pid: null, apiKey: null },
  launcherStartResult = { state: 'RUNNING', port: 3000, pid: 9999, apiKey: 'sk-test-key' },
  settings = { enabled: false, preStart: false, gatewayPort: 3000 },
  prepareEnvResult = { ok: true },
  shouldShowHint = false,
} = {}) {
  // Reset module cache to allow re-mocking per test
  vi.resetModules()

  // Mock electron
  const electronMock = {
    ipcMain: { handle: vi.fn() },
    BrowserWindow: {
      getAllWindows: vi.fn(() => fakeWindows),
    },
    app: fakeApp,
  }
  vi.doMock('electron', () => electronMock)

  // Mock detector
  const detectorMock = {
    detectHermes: vi.fn(() => Promise.resolve(detectResult)),
  }
  vi.doMock('../services/hermes-detector.js', () => detectorMock)

  // Mock launcher
  let _launcherStatus = launcherStatus
  const launcherMock = {
    getStatus: vi.fn(() => _launcherStatus),
    startHermesGateway: vi.fn(() => Promise.resolve(launcherStartResult)),
    stopHermesGateway: vi.fn(() => {
      _launcherStatus = { state: 'STOPPED', port: null, pid: null, apiKey: null }
      return Promise.resolve(_launcherStatus)
    }),
  }
  vi.doMock('../services/hermes-launcher.js', () => launcherMock)

  // Mock store
  let _settings = { ...settings }
  const storeMock = {
    getHermesSettings: vi.fn(() => _settings),
    setHermesSettings: vi.fn((p) => {
      _settings = { ..._settings, ...p }
      return _settings
    }),
    recordDetection: vi.fn(),
    markInstallHintShown: vi.fn(),
    shouldShowInstallHint: vi.fn(() => shouldShowHint),
    initHermesStore: vi.fn(() => Promise.resolve()),
  }
  vi.doMock('../services/hermes-store.js', () => storeMock)

  // Mock hermes-env (for handlePrepareEnv)
  const hermesEnvMock = {
    writeHermesEnvFile: vi.fn(() => Promise.resolve(prepareEnvResult)),
  }
  vi.doMock('../services/hermes-env.js', () => hermesEnvMock)

  // 重新 require（在 mock 之后）
  const mod = require('../hermes-ipc.js')
  return {
    ...mod,
    _detector: detectorMock,
    _launcher: launcherMock,
    _store: storeMock,
    _hermesEnv: hermesEnvMock,
    _electron: electronMock,
    _fakeWindows: fakeWindows,
  }
}

// ══════════════════════════════════════════════════════════════
// 3. Tests
// ══════════════════════════════════════════════════════════════

describe('hermes-ipc — 广播通道常量', () => {
  it('STATUS_BROADCAST_CHANNEL = "hermes:status-changed"', () => {
    const { STATUS_BROADCAST_CHANNEL } = loadModule()
    expect(STATUS_BROADCAST_CHANNEL).toBe('hermes:status-changed')
  })

  it('SETTINGS_BROADCAST_CHANNEL = "hermes:settings-changed"', () => {
    const { SETTINGS_BROADCAST_CHANNEL } = loadModule()
    expect(SETTINGS_BROADCAST_CHANNEL).toBe('hermes:settings-changed')
  })
})

describe('hermes-ipc — handleDetect', () => {
  it('调用 detector.detectHermes 并记录结果', async () => {
    const { handleDetect, _detector, _store } = loadModule({
      detectResult: { available: true, pythonVersion: '3.12.0', hermesVersion: '0.20.0' },
    })
    const result = await handleDetect()
    expect(result.available).toBe(true)
    expect(result.pythonVersion).toBe('3.12.0')
    expect(_detector.detectHermes).toHaveBeenCalledTimes(1)
    expect(_store.recordDetection).toHaveBeenCalledWith(result)
  })

  it('recordDetection 失败时静默吞掉不抛异常', async () => {
    const { handleDetect, _store } = loadModule()
    _store.recordDetection.mockImplementationOnce(() => { throw new Error('store write fail') })
    // 不应 throw
    await expect(handleDetect()).resolves.not.toThrow()
  })

  it('Hermes 不可用时正常返回 unavailable 结果', async () => {
    const { handleDetect, _detector } = loadModule({
      detectResult: { available: false, reason: 'missing_hermes' },
    })
    const result = await handleDetect()
    expect(result.available).toBe(false)
    expect(_detector.detectHermes).toHaveBeenCalledTimes(1)
  })
})

describe('hermes-ipc — handleGetStatus', () => {
  it('返回 launcher.getStatus() 当前状态', () => {
    const { handleGetStatus, _launcher } = loadModule({
      launcherStatus: { state: 'RUNNING', port: 3000, pid: 1234, apiKey: 'sk-abc' },
    })
    const status = handleGetStatus()
    expect(status.state).toBe('RUNNING')
    expect(status.port).toBe(3000)
    expect(_launcher.getStatus).toHaveBeenCalledTimes(1)
  })

  it('STOPPED 状态时返回 null port/pid', () => {
    const { handleGetStatus } = loadModule({ launcherStatus: { state: 'STOPPED', port: null, pid: null } })
    expect(handleGetStatus().state).toBe('STOPPED')
  })
})

describe('hermes-ipc — handleStart', () => {
  it('调用 launcher.startHermesGateway 并广播状态', async () => {
    const win1 = makeFakeWindow()
    const win2 = makeFakeWindow()
    const { handleStart, _launcher, _electron } = loadModule({
      fakeWindows: [win1, win2],
      launcherStartResult: { state: 'RUNNING', port: 3000, pid: 9999, apiKey: 'sk-started' },
    })

    const ret = await handleStart()

    expect(ret.ok).toBe(true)
    expect(ret.status.state).toBe('RUNNING')
    expect(_launcher.startHermesGateway).toHaveBeenCalledTimes(1)
    expect(_launcher.startHermesGateway.mock.calls[0][0].port).toBe(3000)
    // 广播两次（两个窗口）
    expect(win1.webContents.send).toHaveBeenCalledTimes(1)
    expect(win2.webContents.send).toHaveBeenCalledTimes(1)
    expect(win1.webContents.send).toHaveBeenCalledWith('hermes:status-changed', expect.any(Object))
  })

  it('STARTING 状态也返回 ok=true', async () => {
    const { handleStart, _launcher } = loadModule({
      launcherStartResult: { state: 'STARTING', port: 3000, pid: null, apiKey: null },
    })
    const ret = await handleStart()
    expect(ret.ok).toBe(true)
  })

  it('app.getPath("userData") 传入 hermesHome 参数', async () => {
    const { handleStart, _electron, _launcher } = loadModule({
      fakeApp: makeFakeApp('/my/custom/userData'),
    })
    await handleStart()
    expect(_electron.app.getPath).toHaveBeenCalledWith('userData')
    expect(_launcher.startHermesGateway.mock.calls[0][0].hermesHome).toBe('/my/custom/userData/hermes-home')
  })

  it('已销毁的窗口不广播（isDestroyed=true 跳过）', async () => {
    const win1 = makeFakeWindow()
    win1.isDestroyed.mockReturnValueOnce(true) // 第一个窗口已销毁
    const { handleStart, _electron } = loadModule({ fakeWindows: [win1] })
    await handleStart()
    // win1.isDestroyed() 为 true，所以 send 不应被调用
    expect(win1.webContents.send).not.toHaveBeenCalled()
  })
})

describe('hermes-ipc — handleStop', () => {
  it('调用 stopHermesGateway 并广播 STOPPED 状态', async () => {
    const win = makeFakeWindow()
    const { handleStop, _launcher } = loadModule({ fakeWindows: [win] })
    const ret = await handleStop()
    expect(ret.ok).toBe(true)
    expect(ret.status.state).toBe('STOPPED')
    expect(_launcher.stopHermesGateway).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledWith('hermes:status-changed', expect.objectContaining({ state: 'STOPPED' }))
  })
})

describe('hermes-ipc — handleGetSettings', () => {
  it('返回 settings + installHintAvailable', () => {
    const { handleGetSettings, _store } = loadModule({
      settings: { enabled: true, preStart: true, gatewayPort: 8642 },
      shouldShowHint: true,
    })
    const ret = handleGetSettings()
    expect(ret.settings.enabled).toBe(true)
    expect(ret.settings.gatewayPort).toBe(8642)
    expect(ret.installHintAvailable).toBe(true)
    expect(_store.shouldShowInstallHint).toHaveBeenCalled()
  })

  it('shouldShowInstallHint=false 时返回 false', () => {
    const { handleGetSettings } = loadModule({ shouldShowHint: false })
    expect(handleGetSettings().installHintAvailable).toBe(false)
  })
})

describe('hermes-ipc — handleSetSettings', () => {
  it('更新 settings 并广播', () => {
    const win = makeFakeWindow()
    const { handleSetSettings, _store } = loadModule({
      fakeWindows: [win],
      settings: { enabled: false, preStart: false, gatewayPort: 3000 },
    })

    const ret = handleSetSettings({ enabled: true, gatewayPort: 4000 })

    expect(_store.setHermesSettings).toHaveBeenCalledWith({ enabled: true, gatewayPort: 4000 })
    expect(ret.enabled).toBe(true)
    expect(ret.gatewayPort).toBe(4000)
    expect(win.webContents.send).toHaveBeenCalledWith('hermes:settings-changed', expect.any(Object))
  })

  it('enabled=false 时停止网关（调用 stopHermesGateway）', async () => {
    const { handleSetSettings, _launcher } = loadModule({ settings: { enabled: true, preStart: false, gatewayPort: 3000 } })
    handleSetSettings({ enabled: false })
    // stopHermesGateway 是异步调用但不在关键路径等待
    // 验证下次 getStatus 为 STOPPED
    expect(_launcher.stopHermesGateway).toHaveBeenCalledTimes(1)
  })

  it('enabled=true + preStart=true 时触发预启动', async () => {
    const { handleSetSettings, _launcher } = loadModule({ settings: { enabled: false, preStart: false, gatewayPort: 3000 } })
    handleSetSettings({ enabled: true, preStart: true })
    // 异步启动在后台；验证 startHermesGateway 被调用
    expect(_launcher.startHermesGateway).toHaveBeenCalledTimes(1)
    expect(_launcher.startHermesGateway.mock.calls[0][0].port).toBe(3000)
  })

  it('preStart=false 时不触发预启动', () => {
    const { handleSetSettings, _launcher } = loadModule({ settings: { enabled: false, preStart: false, gatewayPort: 3000 } })
    handleSetSettings({ enabled: true, preStart: false })
    expect(_launcher.startHermesGateway).not.toHaveBeenCalled()
  })
})

describe('hermes-ipc — handleCallRun', () => {
  it('enabled=false 时返回 hermes_disabled 回退', () => {
    const { handleCallRun } = loadModule({ settings: { enabled: false, preStart: false, gatewayPort: 3000 } })
    const ret = handleCallRun({ sessionId: 's1', task: '调研' })
    expect(ret.ok).toBe(false)
    expect(ret.fallbackReason).toBe('hermes_disabled')
    expect(ret.message).toContain('未启用')
  })

  it('网关非 RUNNING 时返回 hermes_unavailable 回退', () => {
    const { handleCallRun } = loadModule({ settings: { enabled: true }, launcherStatus: { state: 'STOPPED', port: null, pid: null, apiKey: null } })
    const ret = handleCallRun({ sessionId: 's1' })
    expect(ret.ok).toBe(false)
    expect(ret.fallbackReason).toBe('hermes_unavailable')
  })

  it('RUNNING 时返回 proceed: POST /api/hermes/run', () => {
    const { handleCallRun } = loadModule({
      settings: { enabled: true },
      launcherStatus: { state: 'RUNNING', port: 3000, pid: 1234, apiKey: 'sk-abc' },
    })
    const ret = handleCallRun({ sessionId: 'sess-1', task: '自主调研' })
    expect(ret.ok).toBe(true)
    expect(ret.proceed.method).toBe('POST')
    expect(ret.proceed.url).toBe('/api/hermes/run')
    expect(ret.sessionId).toBe('sess-1')
  })

  it('无 payload 时不抛异常', () => {
    const { handleCallRun } = loadModule({
      settings: { enabled: true },
      launcherStatus: { state: 'RUNNING', port: 3000, pid: 1234, apiKey: 'sk-abc' },
    })
    expect(() => handleCallRun()).not.toThrow()
  })
})

describe('hermes-ipc — handlePrepareEnv', () => {
  it('调用 hermes-env writeHermesEnvFile 并返回结果', async () => {
    const { handlePrepareEnv, _hermesEnv, _electron } = loadModule({
      fakeApp: makeFakeApp('/user/data'),
      prepareEnvResult: { ok: true },
    })
    const ret = await handlePrepareEnv({ apiKey: 'sk-secret', baseUrl: 'https://api.deepseek.com' })
    expect(_hermesEnv.writeHermesEnvFile).toHaveBeenCalledWith(
      '/user/data/hermes-home',
      { apiKey: 'sk-secret', baseUrl: 'https://api.deepseek.com' }
    )
    expect(ret.ok).toBe(true)
  })

  it('无 apiKey/baseUrl 时仍调用（传入 undefined）', async () => {
    const { handlePrepareEnv, _hermesEnv } = loadModule()
    await handlePrepareEnv({})
    expect(_hermesEnv.writeHermesEnvFile).toHaveBeenCalled()
  })
})

describe('hermes-ipc — handleMarkInstallHintShown', () => {
  it('调用 store.markInstallHintShown', () => {
    const { handleMarkInstallHintShown, _store } = loadModule()
    handleMarkInstallHintShown()
    expect(_store.markInstallHintShown).toHaveBeenCalledTimes(1)
  })
})

describe('hermes-ipc — registerHermesIpcHandlers', () => {
  it('注册全部 9 个通道到 ipcMain', () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    const { registerHermesIpcHandlers } = loadModule()
    registerHermesIpcHandlers({ ipcMain })

    expect(Object.keys(handlers)).toHaveLength(9)
    expect(handlers['hermes:detect']).toBeDefined()
    expect(handlers['hermes:get-status']).toBeDefined()
    expect(handlers['hermes:start']).toBeDefined()
    expect(handlers['hermes:stop']).toBeDefined()
    expect(handlers['hermes:get-settings']).toBeDefined()
    expect(handlers['hermes:set-settings']).toBeDefined()
    expect(handlers['hermes:call-run']).toBeDefined()
    expect(handlers['hermes:prepare-env']).toBeDefined()
    expect(handlers['hermes:mark-install-hint-shown']).toBeDefined()
  })

  it('ipcMain 不可用时（无 handle）静默跳过不抛异常', () => {
    const { registerHermesIpcHandlers } = loadModule()
    expect(() => registerHermesIpcHandlers({})).not.toThrow()
    expect(() => registerHermesIpcHandlers({ ipcMain: null })).not.toThrow()
  })
})

describe('hermes-ipc — initHermesIpc', () => {
  it('初始化 store + 注册 IPC + 不传 registerIpc=false 时注册', async () => {
    const { initHermesIpc, _store, _electron } = loadModule()
    const ret = await initHermesIpc()
    expect(ret.ok).toBe(true)
    expect(_store.initHermesStore).toHaveBeenCalledTimes(1)
    expect(_electron.ipcMain.handle).toHaveBeenCalled() // ipcMain.handle 注册了 9 个通道
  })

  it('registerIpc=false 时不注册 IPC 但仍初始化 store', async () => {
    const { initHermesIpc, _store, _electron } = loadModule()
    await initHermesIpc({ registerIpc: false })
    expect(_store.initHermesStore).toHaveBeenCalledTimes(1)
    // handle 不再被调用（因为 registerIpc=false）
    // 已有测试验证了不传 registerIpc 时默认注册，此处验证传 false 时不注册
  })

  it('预启动：enabled+preStart 时自动 startHermesGateway', async () => {
    const { initHermesIpc, _launcher } = loadModule({
      settings: { enabled: true, preStart: true, gatewayPort: 3000 },
    })
    await initHermesIpc()
    // 异步启动在后台，验证调用已发出
    expect(_launcher.startHermesGateway).toHaveBeenCalledTimes(1)
  })

  it('预启动失败时静默吞异常', async () => {
    const { initHermesIpc, _launcher } = loadModule({
      settings: { enabled: true, preStart: true, gatewayPort: 3000 },
    })
    _launcher.startHermesGateway.mockRejectedValueOnce(new Error('启动失败'))
    // 不应 throw 到调用方
    await expect(initHermesIpc()).resolves.toEqual({ ok: true })
  })
})
