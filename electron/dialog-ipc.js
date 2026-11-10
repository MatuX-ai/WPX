/**
 * dialog-ipc.js —— 文件保存 / 打开对话框相关 IPC 处理器
 *
 * 设计动机：
 * - 让 dialog:show-save-dialog 与 dialog:open-file 等薄包装可以从 main.js 拆出来，
 *   既符合「主进程 = 进程生命周期 / 菜单 / 窗口管理」的职责边界，也便于单测。
 * - 模块导出 registerDialogIpc({ ipcMain, dialog, BrowserWindow })，
 *   接受依赖注入的 Electron 句柄，避免在测试时启动真实的 Electron。
 */

/** 默认 Markdown 过滤器 */
const DEFAULT_MARKDOWN_FILTERS = [{ name: 'Markdown', extensions: ['md'] }]

/**
 * 处理 `dialog:show-save-dialog` IPC：弹原生保存对话框，把 payload
 * `{ title, defaultPath, filters }` 透传给 dialog.showSaveDialog。
 *
 * 返回结构：`{ canceled, filePath }`，其中 canceled 必为 boolean，
 * filePath 在用户取消或未选择时为 null。
 *
 * @param {{ dialog: any, BrowserWindow: any, onFilePicked?: (event: any, filePath: string) => Promise<void> | void }} deps 依赖注入的 Electron 句柄
 * @param {Electron.IpcMainInvokeEvent} event IPC 事件对象
 * @param {{ title?: string, defaultPath?: string, filters?: Array }} [payload]
 * @returns {Promise<{ canceled: boolean, filePath: string | null }>}
 */
async function handleShowSaveDialog({ dialog, BrowserWindow, onFilePicked }, event, payload = {}) {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const { title, defaultPath, filters } = safePayload

  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(senderWindow ?? undefined, {
    title: typeof title === 'string' ? title : '保存到本地',
    defaultPath: typeof defaultPath === 'string' ? defaultPath : undefined,
    filters: Array.isArray(filters) ? filters : DEFAULT_MARKDOWN_FILTERS,
  })

  const filePath = result.filePath || null
  // P0-3：用户在系统对话框亲手选定的保存路径 → 由主进程签发写授权，
  // 后续 file:write-document / file:write-binary 才被允许写入该路径。
  if (!result.canceled && filePath && typeof onFilePicked === 'function') {
    await onFilePicked(event, filePath)
  }

  return {
    canceled: Boolean(result.canceled),
    filePath,
  }
}

/**
 * 注册对话框相关 IPC 处理器到主进程。
 *
 * @param {{ ipcMain: any, dialog: any, BrowserWindow: any }} deps
 */
function registerDialogIpc(deps) {
  const { ipcMain } = deps || {}
  if (!ipcMain || typeof ipcMain.handle !== 'function') return

  ipcMain.handle('dialog:show-save-dialog', (event, payload) =>
    handleShowSaveDialog(deps, event, payload),
  )
}

module.exports = {
  handleShowSaveDialog,
  registerDialogIpc,
  DEFAULT_MARKDOWN_FILTERS,
}
