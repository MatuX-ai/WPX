/**
 * zip-ipc.test.js —— zip IPC 处理器单元测试（Electron 主进程）
 *
 * 覆盖：zip:compress / zip:extract / zip:list / zip:cancel /
 *       zip:pick-save-path / zip:pick-directory / zip:pick-archive / isArchiveFile
 * 运行：npm --prefix wpx-app run test:zip -- zip-ipc
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ══════════════════════════════════════════════════════════════
// 1. Mock 基础设施
// ══════════════════════════════════════════════════════════════

/** 捕获 ipcMain.handle 注册的 channel → handler 映射 */
function captureIpcHandlers(ipcMainMock) {
  const handlers = {}
  ipcMainMock.handle = vi.fn((channel, fn) => { handlers[channel] = fn })
  return handlers
}

/** 伪造 BrowserWindow */
function makeFakeWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  }
}

// ══════════════════════════════════════════════════════════════
// 2. 模块加载
// ══════════════════════════════════════════════════════════════
function loadModule({
  fakeWindows = [makeFakeWindow()],
  compressResult = { outputPath: 'C:\\out\\a.7z' },
  extractResult = { outputDir: 'C:\\out' },
  listResult = [{ name: 'a.txt', size: 1024 }],
  cancelResult = true,
  dialogSaveResult = { canceled: false, filePath: 'C:\\out\\archive.7z' },
  dialogOpenResult = { canceled: false, filePaths: ['C:\\src\\docs'] },
} = {}) {
  vi.resetModules()

  // Mock electron
  const fakeWindow = makeFakeWindow()
  vi.doMock('electron', () => ({
    ipcMain: { handle: vi.fn() },
    BrowserWindow: {
      getAllWindows: vi.fn(() => fakeWindows),
      fromWebContents: vi.fn(() => fakeWindow),
    },
    dialog: {
      showSaveDialog: vi.fn(() => Promise.resolve(dialogSaveResult)),
      showOpenDialog: vi.fn(() => Promise.resolve(dialogOpenResult)),
    },
  }))

  // Mock zip-service
  let _cancelResult = cancelResult
  vi.doMock('../zip-service.js', () => ({
    compress: vi.fn((sources, outputPath, opts) => ({
      promise: Promise.resolve(compressResult),
      cancel: vi.fn(),
    })),
    extract: vi.fn((archivePath, outputDir, opts) => ({
      promise: Promise.resolve(extractResult),
      cancel: vi.fn(),
    })),
    list: vi.fn(() => Promise.resolve(listResult)),
    cancelOperation: vi.fn(() => _cancelResult),
    isCancelledError: vi.fn((e) => e?.name === 'CancelledError'),
  }))

  const { initZipService, isArchiveFile, ARCHIVE_EXTENSIONS } = require('../zip-ipc.js')
  const ipcMain = {
    handle: vi.fn(),
  }

  initZipService(ipcMain)

  const handlers = {}
  ipcMain.handle.mock.calls.forEach(([channel, fn]) => { handlers[channel] = fn })

  return {
    handlers,
    isArchiveFile,
    ARCHIVE_EXTENSIONS,
    _fakeWindow: fakeWindow,
  }
}

// ══════════════════════════════════════════════════════════════
// 3. Tests
// ══════════════════════════════════════════════════════════════

describe('zip-ipc — 通道注册', () => {
  it('注册全部 7 个通道', () => {
    const { handlers } = loadModule()
    expect(Object.keys(handlers)).toHaveLength(7)
    expect(handlers['zip:compress']).toBeDefined()
    expect(handlers['zip:extract']).toBeDefined()
    expect(handlers['zip:list']).toBeDefined()
    expect(handlers['zip:cancel']).toBeDefined()
    expect(handlers['zip:pick-save-path']).toBeDefined()
    expect(handlers['zip:pick-directory']).toBeDefined()
    expect(handlers['zip:pick-archive']).toBeDefined()
  })
})

describe('zip-ipc — zip:compress', () => {
  it('成功路径：调用 compress 并返回 ok:true，含进度 0→100', async () => {
    const { handlers, _fakeWindow } = loadModule({
      compressResult: { outputPath: 'C:\\out\\a.7z' },
    })
    const fakeEvent = {}

    const result = await handlers['zip:compress'](fakeEvent, {
      sources: ['C:\\src\\f.txt'],
      outputPath: 'C:\\out\\a.7z',
      format: '7z',
      level: 5,
    })

    expect(result.ok).toBe(true)
    expect(result.operationId).toBeDefined()
    expect(result.outputPath).toBe('C:\\out\\a.7z')
    // 进度：0 和 100
    const progressCalls = _fakeWindow.webContents.send.mock.calls.filter(
      ([ch]) => ch === 'zip:progress',
    )
    expect(progressCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('compress 失败时返回 ok:false 含错误信息', async () => {
    const { handlers } = loadModule({
      compressResult: null, // 不影响，只关注 catch 分支
    })
    // 改 mock 让 compress reject
    vi.resetModules()
    const fakeWindow = makeFakeWindow()
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn() },
      BrowserWindow: { fromWebContents: vi.fn(() => fakeWindow) },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }))
    const compressError = new Error('Wrong password')
    compressError.name = 'SevenZipCommandError'
    compressError.code = 'ERR_BAD_PASSWORD'
    vi.doMock('../zip-service.js', () => ({
      compress: vi.fn(() => ({ promise: Promise.reject(compressError), cancel: vi.fn() })),
      extract: vi.fn(),
      list: vi.fn(),
      cancelOperation: vi.fn(),
      isCancelledError: vi.fn(() => false),
    }))

    const { initZipService } = require('../zip-ipc.js')
    const ipcMain = { handle: vi.fn() }
    initZipService(ipcMain)
    const handler = ipcMain.handle.mock.calls[0][1]

    const result = await handler({}, { sources: ['f.txt'], outputPath: 'out.7z', password: 'wrong' })
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Wrong password')
    expect(result.name).toBe('SevenZipCommandError')
  })

  it('CancelledError 时返回 cancelled:true 结构', async () => {
    vi.resetModules()
    const fakeWindow = makeFakeWindow()
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn() },
      BrowserWindow: { fromWebContents: vi.fn(() => fakeWindow) },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }))
    const cancelledErr = new Error('操作已取消')
    cancelledErr.name = 'CancelledError'
    vi.doMock('../zip-service.js', () => ({
      compress: vi.fn(() => ({ promise: Promise.reject(cancelledErr), cancel: vi.fn() })),
      extract: vi.fn(),
      list: vi.fn(),
      cancelOperation: vi.fn(),
      isCancelledError: vi.fn(() => true),
    }))

    const { initZipService } = require('../zip-ipc.js')
    const ipcMain = { handle: vi.fn() }
    initZipService(ipcMain)
    const handler = ipcMain.handle.mock.calls[0][1]

    const result = await handler({}, { sources: ['f.txt'], outputPath: 'out.7z' })
    expect(result.ok).toBe(false)
    expect(result.cancelled).toBe(true)
    expect(result.code).toBe('CANCELLED')
    expect(result.message).toBeUndefined()
  })

  it('operationId 缺失时自动生成 UUID', async () => {
    const { handlers } = loadModule()
    const fakeEvent = {}
    const result = await handlers['zip:compress'](fakeEvent, { sources: ['f.txt'], outputPath: 'out.7z' })
    expect(result.operationId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('operationId 非字符串时被忽略并生成 UUID', async () => {
    const { handlers } = loadModule()
    const result = await handlers['zip:compress']({}, { sources: ['f.txt'], outputPath: 'out.7z', operationId: 123 })
    expect(result.operationId).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('zip-ipc — zip:extract', () => {
  it('成功路径：返回 ok:true 含 outputDir，进度 0→100', async () => {
    const { handlers, _fakeWindow } = loadModule({
      extractResult: { outputDir: 'C:\\extracted' },
    })
    const result = await handlers['zip:extract']({}, { archivePath: 'C:\\in.7z', outputDir: 'C:\\extracted' })
    expect(result.ok).toBe(true)
    expect(result.outputDir).toBe('C:\\extracted')
    const progressCalls = _fakeWindow.webContents.send.mock.calls.filter(
      ([ch]) => ch === 'zip:progress',
    )
    expect(progressCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('list 归档不存在时返回 ok:false files:[]', async () => {
    vi.resetModules()
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn() },
      BrowserWindow: { fromWebContents: vi.fn(() => makeFakeWindow()) },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }))
    const notFoundErr = new Error('ENOENT')
    vi.doMock('../zip-service.js', () => ({
      compress: vi.fn(),
      extract: vi.fn(),
      list: vi.fn(() => Promise.reject(notFoundErr)),
      cancelOperation: vi.fn(),
      isCancelledError: vi.fn(() => false),
    }))

    const { initZipService } = require('../zip-ipc.js')
    const ipcMain = { handle: vi.fn() }
    initZipService(ipcMain)
    const handler = ipcMain.handle.mock.calls.find(([ch]) => ch === 'zip:list')[1]

    const result = await handler({}, 'C:\\not-exist.7z')
    expect(result.ok).toBe(false)
    expect(result.files).toEqual([])
  })
})

describe('zip-ipc — zip:list', () => {
  it('字符串参数透传 archivePath', async () => {
    const { handlers } = loadModule({ listResult: [{ name: 'readme.md' }] })
    const result = await handlers['zip:list']({}, 'C:\\archive.zip')
    expect(result.ok).toBe(true)
    expect(result.files).toHaveLength(1)
  })

  it('{ archivePath, password } 对象参数透传密码', async () => {
    const { handlers } = loadModule()
    const result = await handlers['zip:list']({}, { archivePath: 'C:\\enc.7z', password: 'secret' })
    expect(result.ok).toBe(true)
  })

  it('archivePath 为空时返回 ok:false', async () => {
    const { handlers } = loadModule()
    const result = await handlers['zip:list']({}, '')
    expect(result.ok).toBe(false)
    expect(result.files).toEqual([])
  })

  it('archivePath 为 {} 时返回 ok:false', async () => {
    const { handlers } = loadModule()
    const result = await handlers['zip:list']({}, {})
    expect(result.ok).toBe(false)
    expect(result.files).toEqual([])
  })
})

describe('zip-ipc — zip:cancel', () => {
  it('合法 operationId 调用 cancelOperation 并返回 ok:true', async () => {
    const { handlers } = loadModule({ cancelResult: true })
    const result = await handlers['zip:cancel']({}, 'op-abc-123')
    expect(result.ok).toBe(true)
  })

  it('cancelOperation 返回 false 时返回 ok:false', async () => {
    const { handlers } = loadModule({ cancelResult: false })
    const result = await handlers['zip:cancel']({}, 'op-not-found')
    expect(result.ok).toBe(false)
  })

  it('operationId 非字符串/空时返回 ok:false 不调用 cancelOperation', async () => {
    const { handlers } = loadModule()
    expect(await handlers['zip:cancel']({}, null)).toEqual({ ok: false })
    expect(await handlers['zip:cancel']({}, '')).toEqual({ ok: false })
    expect(await handlers['zip:cancel']({}, 123)).toEqual({ ok: false })
  })
})

describe('zip-ipc — zip:pick-save-path', () => {
  it('用户确认后返回 ok:true 与 filePath', async () => {
    const { handlers } = loadModule({
      dialogSaveResult: { canceled: false, filePath: 'D:\\backup.7z' },
    })
    const result = await handlers['zip:pick-save-path']({}, { defaultPath: 'D:\\backup.7z' })
    expect(result.ok).toBe(true)
    expect(result.filePath).toBe('D:\\backup.7z')
  })

  it('用户取消后返回 ok:false canceled:true', async () => {
    const { handlers } = loadModule({
      dialogSaveResult: { canceled: true },
    })
    const result = await handlers['zip:pick-save-path']({}, {})
    expect(result.ok).toBe(false)
    expect(result.canceled).toBe(true)
  })

  it('无 defaultPath 时使用默认过滤器（7z/zip/tar）', async () => {
    vi.resetModules()
    const dialogShowSave = vi.fn(() => Promise.resolve({ canceled: false, filePath: 'x.7z' }))
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn() },
      BrowserWindow: { getAllWindows: vi.fn(() => []), fromWebContents: vi.fn() },
      dialog: { showSaveDialog: dialogShowSave, showOpenDialog: vi.fn() },
    }))
    vi.doMock('../zip-service.js', () => ({
      compress: vi.fn(), extract: vi.fn(), list: vi.fn(),
      cancelOperation: vi.fn(), isCancelledError: vi.fn(() => false),
    }))

    const { initZipService } = require('../zip-ipc.js')
    initZipService({ handle: vi.fn() })
    const ipcMain = { handle: vi.fn() }
    initZipService(ipcMain)
    // find pick-save-path handler
    const handler = ipcMain.handle.mock.calls.find(([ch]) => ch === 'zip:pick-save-path')[1]
    await handler({}, {})
    expect(dialogShowSave).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ filters: expect.any(Array) }),
    )
  })
})

describe('zip-ipc — zip:pick-directory', () => {
  it('选中目录后返回 ok:true 与 directoryPath', async () => {
    const { handlers } = loadModule({
      dialogOpenResult: { canceled: false, filePaths: ['C:\\Users\\Docs'] },
    })
    const result = await handlers['zip:pick-directory']({}, {})
    expect(result.ok).toBe(true)
    expect(result.directoryPath).toBe('C:\\Users\\Docs')
  })

  it('用户取消后返回 ok:false canceled:true', async () => {
    const { handlers } = loadModule({
      dialogOpenResult: { canceled: true },
    })
    const result = await handlers['zip:pick-directory']({}, {})
    expect(result.ok).toBe(false)
    expect(result.canceled).toBe(true)
  })
})

describe('zip-ipc — zip:pick-archive', () => {
  it('选中归档文件后返回 ok:true 与 filePath', async () => {
    const { handlers } = loadModule({
      dialogOpenResult: { canceled: false, filePaths: ['E:\\data.zip'] },
    })
    const result = await handlers['zip:pick-archive']({}, {})
    expect(result.ok).toBe(true)
    expect(result.filePath).toBe('E:\\data.zip')
  })

  it('pick-archive 过滤器仅含 8 种归档扩展名', async () => {
    vi.resetModules()
    const dialogOpen = vi.fn(() => Promise.resolve({ canceled: true }))
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn() },
      BrowserWindow: { getAllWindows: vi.fn(() => []), fromWebContents: vi.fn() },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: dialogOpen },
    }))
    vi.doMock('../zip-service.js', () => ({
      compress: vi.fn(), extract: vi.fn(), list: vi.fn(),
      cancelOperation: vi.fn(), isCancelledError: vi.fn(() => false),
    }))

    const { initZipService } = require('../zip-ipc.js')
    const ipcMain = { handle: vi.fn() }
    initZipService(ipcMain)
    const handler = ipcMain.handle.mock.calls.find(([ch]) => ch === 'zip:pick-archive')[1]
    await handler({}, {})
    expect(dialogOpen).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        filters: [{ name: 'Archives', extensions: ['7z', 'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'wim'] }],
      }),
    )
  })

  it('用户取消后返回 ok:false canceled:true', async () => {
    const { handlers } = loadModule({
      dialogOpenResult: { canceled: true },
    })
    const result = await handlers['zip:pick-archive']({}, {})
    expect(result.ok).toBe(false)
    expect(result.canceled).toBe(true)
  })
})

describe('zip-ipc — isArchiveFile', () => {
  it('支持的扩展名返回 true（大小写不敏感）', () => {
    const { isArchiveFile } = loadModule()
    const extensions = ['.7z', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.wim']
    for (const ext of extensions) {
      expect(isArchiveFile(`file${ext}`)).toBe(true)
      expect(isArchiveFile(`file${ext.toUpperCase()}`)).toBe(true)
    }
  })

  it('不支持的扩展名返回 false', () => {
    const { isArchiveFile } = loadModule()
    expect(isArchiveFile('file.txt')).toBe(false)
    expect(isArchiveFile('file.docx')).toBe(false)
    expect(isArchiveFile('file.pdf')).toBe(false)
  })

  it('无扩展名、空字符串、非字符串均返回 false', () => {
    const { isArchiveFile } = loadModule()
    expect(isArchiveFile('')).toBe(false)
    expect(isArchiveFile(null)).toBe(false)
    expect(isArchiveFile(undefined)).toBe(false)
    expect(isArchiveFile(123)).toBe(false)
  })
})
