/**
 * file-ipc.js —— 文件读写 IPC 处理器（P0-3 安全修复 2026-11-10）
 *
 * 从 main.js 拆出的 file:read-document / file:write-document /
 * file:write-binary / file:get-modified-time / file:convert-docx /
 * dialog:open-file 注册逻辑，统一接入两层防护：
 *
 * 1. IPC 发送方验证（isTrustedSender）：
 *    - 仅接受应用受管窗口的「主 frame」（iframe / 子 frame 一律拒绝）；
 *    - 发送方 WebContents 必须属于 WindowManager 管理的窗口；
 *    - 远程内容 / 伪造 WebContents 无法通过窗口归属校验。
 * 2. 精确路径授权（file-access 服务）：
 *    - 读操作须持有该真实路径的 read 授权；
 *    - 写操作须持有该真实路径的 write 授权；
 *    - 授权仅由系统对话框选择 / 窗口 docPath 签发，渲染层无法自造。
 *
 * 依赖全部注入（不直接 require('electron')），便于单测覆盖真实 handler 链。
 */
'use strict'

const DENY_READ = Object.freeze({ error: '无权访问该文件', contentType: 'access-denied' })
const DENY_WRITE = Object.freeze({ ok: false, error: '未授权写入该路径' })

/**
 * 判断 IPC 事件发送方是否可信：必须是受管窗口的主 frame。
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {{ findWindowIdByWebContents: (wc: unknown) => number | null }} deps
 */
function isTrustedSender(event, deps) {
  const sender = event && event.sender
  if (!sender || typeof sender.isDestroyed !== 'function' || sender.isDestroyed()) return false
  // 子 frame / iframe / webview 内嵌页不得调用特权文件 IPC
  const frame = event.senderFrame
  if (!frame || frame !== sender.mainFrame) return false
  if (!deps || typeof deps.findWindowIdByWebContents !== 'function') return false
  return deps.findWindowIdByWebContents(sender) !== null
}

/**
 * window:create 的 docPath 授权转移校验：
 * 新窗口要携带 docPath，发送方窗口必须已持有该路径的 read + write 授权
 * （即该路径来自本窗口的对话框选择或自身 docPath），否则拒绝携带。
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function authorizeDocPathTransfer({ event, docPath, fileAccess, findWindowIdByWebContents }) {
  if (!docPath) return { ok: true }
  if (!isTrustedSender(event, { findWindowIdByWebContents })) {
    return { ok: false, error: 'UNTRUSTED_SENDER' }
  }
  const [read, write] = await Promise.all([
    fileAccess.check(event.sender.id, docPath, 'read'),
    fileAccess.check(event.sender.id, docPath, 'write'),
  ])
  if (!read || !write) return { ok: false, error: 'UNAUTHORIZED_PATH' }
  return { ok: true }
}

/**
 * 注册全部文件相关 IPC 处理器（替换 main.js 中无防护的原始实现）。
 * @param {{
 *   ipcMain: any,
 *   fsp: typeof import('node:fs/promises'),
 *   fileAccess: import('./file-access').FileAccessService,
 *   findWindowIdByWebContents: (wc: unknown) => number | null,
 *   convertDocxFile?: (p: string) => Promise<any>,
 *   convertExcelFile?: (p: string) => Promise<any>,
 *   convertPptxFile?: (p: string) => Promise<any>,
 *   readAssociatedFilePayload?: (p: string) => Promise<any>,
 *   dialog?: any,
 *   FILE_OPEN_FILTERS?: Array<{ name: string, extensions: string[] }>,
 * }} deps
 */
function registerFileIpc(deps) {
  const {
    ipcMain, fsp, fileAccess, findWindowIdByWebContents,
    convertDocxFile, convertExcelFile, convertPptxFile,
    readAssociatedFilePayload, dialog, FILE_OPEN_FILTERS,
  } = deps
  const trusted = (event) => isTrustedSender(event, { findWindowIdByWebContents })

  ipcMain.handle('file:read-document', async (event, filePath) => {
    if (!trusted(event)) return { ...DENY_READ, denied: true }
    if (!filePath || typeof filePath !== 'string') return null
    if (!(await fileAccess.check(event.sender.id, filePath, 'read'))) {
      return { ...DENY_READ, denied: true }
    }
    return readDocumentPayload(filePath, {
      convertDocxFile, convertExcelFile, convertPptxFile, readAssociatedFilePayload,
    })
  })
  ipcMain.handle('file:write-document', async (event, filePath, content) => {
    if (!trusted(event)) return { ...DENY_WRITE }
    if (!filePath || typeof filePath !== 'string') return { ok: false, error: '无效路径' }
    if (!(await fileAccess.check(event.sender.id, filePath, 'write'))) {
      return { ...DENY_WRITE }
    }
    try {
      await fsp.writeFile(filePath, content ?? '', 'utf8')
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '无法写入文档' }
    }
  })

  ipcMain.handle('file:write-binary', async (event, filePath, base64) => {
    if (!trusted(event)) return { ...DENY_WRITE }
    if (!filePath || typeof filePath !== 'string') return { ok: false, error: '无效路径' }
    if (typeof base64 !== 'string' || base64.length === 0) {
      return { ok: false, error: '无效文件内容' }
    }
    if (!(await fileAccess.check(event.sender.id, filePath, 'write'))) {
      return { ...DENY_WRITE }
    }
    try {
      await fsp.writeFile(filePath, Buffer.from(base64, 'base64'))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '无法写入文件' }
    }
  })
  ipcMain.handle('file:get-modified-time', async (event, filePath) => {
    if (!trusted(event)) return null
    if (!filePath || typeof filePath !== 'string') return null
    if (!(await fileAccess.check(event.sender.id, filePath, 'read'))) return null
    try {
      const stat = await fsp.stat(filePath)
      return { mtimeMs: stat.mtimeMs }
    } catch {
      return null
    }
  })

  ipcMain.handle('file:convert-docx', async (event, filePath) => {
    if (!trusted(event)) return { ...DENY_READ, denied: true }
    if (!filePath || typeof filePath !== 'string') return null
    if (!(await fileAccess.check(event.sender.id, filePath, 'read'))) {
      return { ...DENY_READ, denied: true }
    }
    return convertDocxFile(filePath)
  })



  // 系统打开对话框：用户亲手选择的文件 → 主进程签发 read + write 授权
  ipcMain.handle('dialog:open-file', async (event) => {
    if (!trusted(event) || !dialog) return null
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILE_OPEN_FILTERS,
    })
    if (result.canceled || !result.filePaths.length) return null
    const picked = result.filePaths[0]
    await fileAccess.grant(event.sender.id, picked, { read: true, write: true })
    return picked
  })
}
/**
 * 按扩展名读取文档（与原 main.js file:read-document 主体一致）。
 * @private
 */
async function readDocumentPayload(filePath, converters) {
  const { convertDocxFile, convertExcelFile, convertPptxFile, readAssociatedFilePayload } = converters
  const ext = require('node:path').extname(filePath).toLowerCase()
  if (ext === '.docx' || ext === '.doc') {
    return convertDocxFile(filePath)
  }
  if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm') {
    try {
      return await convertExcelFile(filePath)
    } catch (error) {
      return { error: error.message, path: filePath, contentType: 'excel-error' }
    }
  }
  if (ext === '.ppt') {
    return {
      error: '不支持旧版 .ppt，请先另存为 .pptx',
      path: filePath,
      contentType: 'pptx-error',
    }
  }
  if (ext === '.pptx') {
    try {
      return await convertPptxFile(filePath)
    } catch (error) {
      return { error: error.message, path: filePath, contentType: 'pptx-error' }
    }
  }
  return readAssociatedFilePayload(filePath)
}

module.exports = {
  isTrustedSender,
  authorizeDocPathTransfer,
  registerFileIpc,
  DENY_READ,
  DENY_WRITE,
}

