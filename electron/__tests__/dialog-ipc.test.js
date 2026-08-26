/**
 * dialog-ipc.test.js —— 文件保存对话框 IPC 处理器单元测试
 *
 * 覆盖：dialog:show-save-dialog 通道注册 + handleShowSaveDialog 边界条件
 * 运行：npm --prefix wpx-app run test:zip -- dialog-ipc
 */
import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ══════════════════════════════════════════════════════════════
// 1. Mock 基础设施
// ══════════════════════════════════════════════════════════════

/** 伪造 BrowserWindow.fromWebContents 返回的窗口 */
function makeFakeWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  }
}

/** 默认 payload：用户选择了一个 Markdown 文件 */
const DEFAULT_OK = {
  canceled: false,
  filePath: 'C:\\Users\\me\\Documents\\notes.md',
}

/** 构造依赖注入对象 */
function makeDeps({
  saveDialogResult = DEFAULT_OK,
  fakeWindow = makeFakeWindow(),
} = {}) {
  const dialog = {
    showSaveDialog: vi.fn(() => Promise.resolve(saveDialogResult)),
  }
  const BrowserWindow = {
    fromWebContents: vi.fn(() => fakeWindow),
  }
  return { deps: { dialog, BrowserWindow }, dialog, BrowserWindow, fakeWindow }
}

/** 构造一个模拟 IPC 事件对象 */
function makeEvent() {
  return { sender: { id: 1 } }
}

// ══════════════════════════════════════════════════════════════
// 2. Tests — handleShowSaveDialog
// ══════════════════════════════════════════════════════════════

describe('dialog-ipc — handleShowSaveDialog', () => {
  it('用户确认选择 → 返回 { canceled:false, filePath:<路径> }', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps({ saveDialogResult: DEFAULT_OK })

    const result = await handleShowSaveDialog(deps, makeEvent(), {})

    expect(result).toEqual({ canceled: false, filePath: 'C:\\Users\\me\\Documents\\notes.md' })
    expect(deps.dialog.showSaveDialog).toHaveBeenCalledTimes(1)
  })

  it('用户取消 → 返回 { canceled:true, filePath:null }', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps({
      saveDialogResult: { canceled: true, filePath: undefined },
    })

    const result = await handleShowSaveDialog(deps, makeEvent(), {})

    expect(result.canceled).toBe(true)
    expect(result.filePath).toBeNull()
  })

  it('dialog 返回 canceled=false 但 filePath 为空字符串 → filePath 归一为 null', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps({
      saveDialogResult: { canceled: false, filePath: '' },
    })

    const result = await handleShowSaveDialog(deps, makeEvent(), {})

    expect(result.canceled).toBe(false)
    expect(result.filePath).toBeNull()
  })

  it('默认过滤器为 Markdown (.md)，未传 filters 时使用默认', async () => {
    const { handleShowSaveDialog, DEFAULT_MARKDOWN_FILTERS } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    await handleShowSaveDialog(deps, makeEvent(), {})

    expect(deps.dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        filters: DEFAULT_MARKDOWN_FILTERS,
      }),
    )
  })

  it('filters 为非数组（字符串/数字）时回退到默认 Markdown 过滤器', async () => {
    const { handleShowSaveDialog, DEFAULT_MARKDOWN_FILTERS } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    await handleShowSaveDialog(deps, makeEvent(), { filters: 'not-an-array' })
    expect(deps.dialog.showSaveDialog.mock.calls[0][1].filters).toEqual(DEFAULT_MARKDOWN_FILTERS)

    await handleShowSaveDialog(deps, makeEvent(), { filters: 42 })
    expect(deps.dialog.showSaveDialog.mock.calls[1][1].filters).toEqual(DEFAULT_MARKDOWN_FILTERS)
  })

  it('payload.filters 是数组时透传自定义过滤器', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps()
    const customFilters = [
      { name: 'Markdown', extensions: ['md'] },
      { name: '纯文本', extensions: ['txt'] },
    ]

    await handleShowSaveDialog(deps, makeEvent(), { filters: customFilters })

    expect(deps.dialog.showSaveDialog.mock.calls[0][1].filters).toEqual(customFilters)
  })

  it('payload.title 是字符串时透传给 dialog', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    await handleShowSaveDialog(deps, makeEvent(), { title: '保存到本地文件' })

    expect(deps.dialog.showSaveDialog.mock.calls[0][1].title).toBe('保存到本地文件')
  })

  it('payload.title 不是字符串时回退到「保存到本地」', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    await handleShowSaveDialog(deps, makeEvent(), { title: 123 })
    expect(deps.dialog.showSaveDialog.mock.calls[0][1].title).toBe('保存到本地')

    await handleShowSaveDialog(deps, makeEvent(), { title: null })
    expect(deps.dialog.showSaveDialog.mock.calls[1][1].title).toBe('保存到本地')
  })

  it('payload.defaultPath 是字符串时透传给 dialog', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    await handleShowSaveDialog(deps, makeEvent(), { defaultPath: 'D:\\drafts\\doc.md' })

    expect(deps.dialog.showSaveDialog.mock.calls[0][1].defaultPath).toBe('D:\\drafts\\doc.md')
  })

  it('payload.defaultPath 不是字符串时不传（undefined）', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    await handleShowSaveDialog(deps, makeEvent(), { defaultPath: 0 })
    expect(deps.dialog.showSaveDialog.mock.calls[0][1].defaultPath).toBeUndefined()
  })

  it('payload 不是对象时回退为 {}（不抛异常）', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    for (const bad of [null, undefined, 'oops', 0, true, []]) {
      await expect(handleShowSaveDialog(deps, makeEvent(), bad)).resolves.toBeDefined()
    }
  })

  it('BrowserWindow.fromWebContents 返回 senderWindow → 透传给 dialog 第一参数', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const fakeWindow = makeFakeWindow()
    const { deps } = makeDeps({ fakeWindow })

    await handleShowSaveDialog(deps, makeEvent(), {})

    expect(deps.BrowserWindow.fromWebContents).toHaveBeenCalledWith(makeEvent().sender)
    expect(deps.dialog.showSaveDialog.mock.calls[0][0]).toBe(fakeWindow)
  })

  it('BrowserWindow.fromWebContents 返回 null 时 → 传 undefined 给 dialog', async () => {
    const { handleShowSaveDialog } = require('../dialog-ipc.js')
    const { deps } = makeDeps({ fakeWindow: null })

    await handleShowSaveDialog(deps, makeEvent(), {})

    expect(deps.dialog.showSaveDialog.mock.calls[0][0]).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════
// 3. Tests — registerDialogIpc
// ══════════════════════════════════════════════════════════════

describe('dialog-ipc — registerDialogIpc', () => {
  it('调用 ipcMain.handle 注册 dialog:show-save-dialog 通道', () => {
    const { registerDialogIpc } = require('../dialog-ipc.js')
    const handlers = {}
    const ipcMain = { handle: vi.fn((channel, fn) => { handlers[channel] = fn }) }
    const { deps } = makeDeps()

    registerDialogIpc({ ipcMain, ...deps })

    expect(handlers['dialog:show-save-dialog']).toBeDefined()
    expect(typeof handlers['dialog:show-save-dialog']).toBe('function')
  })

  it('注册的 handler 与 handleShowSaveDialog 行为一致', async () => {
    const { registerDialogIpc } = require('../dialog-ipc.js')
    const handlers = {}
    const ipcMain = { handle: vi.fn((channel, fn) => { handlers[channel] = fn }) }
    const { deps } = makeDeps({
      saveDialogResult: { canceled: false, filePath: 'C:\\out\\doc.md' },
    })

    registerDialogIpc({ ipcMain, ...deps })
    const result = await handlers['dialog:show-save-dialog'](makeEvent(), { title: '保存文档' })

    expect(result).toEqual({ canceled: false, filePath: 'C:\\out\\doc.md' })
    expect(deps.dialog.showSaveDialog.mock.calls[0][1].title).toBe('保存文档')
  })

  it('ipcMain 缺失时不抛异常（容错）', () => {
    const { registerDialogIpc } = require('../dialog-ipc.js')
    const { deps } = makeDeps()

    expect(() => registerDialogIpc({ ...deps })).not.toThrow()
    expect(() => registerDialogIpc({ ...deps, ipcMain: null })).not.toThrow()
    expect(() => registerDialogIpc({ ...deps, ipcMain: {} })).not.toThrow()
  })
})
