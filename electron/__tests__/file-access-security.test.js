/**
 * file-access-security.test.js —— P0-3 Electron IPC 文件访问安全回归测试
 *
 * 覆盖真实 IPC 业务链：registerFileIpc 注册的真实 handler +
 * createFileAccessService 的真实 fs realpath（临时目录），不 mock 路径检查。
 *
 * 运行（i:/WPX/wpx-app 目录）：npm run test:zip -- file-access-security
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { createFileAccessService, validateRequestedPath } = require('../file-access.js')
const {
  registerFileIpc,
  isTrustedSender,
  authorizeDocPathTransfer,
} = require('../file-ipc.js')
const { handleShowSaveDialog } = require('../dialog-ipc.js')

// ══════════════════════════════════════════════════════════════
// 1. 测试夹具：临时文件 + 伪造 IPC 环境（真实 fs，真实 handler 链）
// ══════════════════════════════════════════════════════════════

let TMP
let FILE_A      // 窗口 A 授权的文档
let FILE_B      // 窗口 B 授权的文档
let SECRET      // 无任何授权的敏感文件
let SUB_DIR     // 子目录（写新文件 / 穿越测试用）
let SYMLINK     // 符号链接测试文件

beforeAll(async () => {
  TMP = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-p03-'))
  FILE_A = path.join(TMP, 'doc-a.md')
  FILE_B = path.join(TMP, 'doc-b.md')
  SECRET = path.join(TMP, 'secret.txt')
  SUB_DIR = path.join(TMP, 'sub')
  await fsp.mkdir(SUB_DIR, { recursive: true })
  await fsp.writeFile(FILE_A, '# original A', 'utf8')
  await fsp.writeFile(FILE_B, '# original B', 'utf8')
  await fsp.writeFile(SECRET, 'TOP-SECRET-CONTENT', 'utf8')
})

afterAll(async () => {
  await fsp.rm(TMP, { recursive: true, force: true })
})

/** 伪造 ipcMain：捕获 handle 注册，支持按通道调用真实 handler */
function makeFakeIpcMain() {
  const handlers = new Map()
  return { handle: (ch, fn) => handlers.set(ch, fn), handlers }
}

/**
 * 构造完整 IPC 环境：真实 registerFileIpc + 真实 fileAccess + 真实 fs，
 * 仅模拟 Electron 的 event 边界。trustedWindows 决定 isTrustedSender 结果。
 */
function makeEnv({ trustedWindows = [1, 2] } = {}) {
  const fileAccess = createFileAccessService()
  const trusted = new Set(trustedWindows)
  const findWindowIdByWebContents = (wc) => (wc && trusted.has(wc.id) ? wc.id : null)
  const ipc = makeFakeIpcMain()
  const dialog = {
    showOpenDialog: async () => ({ canceled: false, filePaths: [FILE_A] }),
  }
  registerFileIpc({
    ipcMain: ipc,
    fsp,
    fileAccess,
    findWindowIdByWebContents,
    convertDocxFile: async (p) => ({ content: 'docx-html', path: p, contentType: 'docx-html' }),
    convertExcelFile: async (p) => ({ content: 'excel-md', path: p, contentType: 'excel-md' }),
    convertPptxFile: async (p) => ({ content: 'pptx', path: p, contentType: 'slides' }),
    readAssociatedFilePayload: async (p) => ({
      content: await fsp.readFile(p, 'utf8'),
      path: p,
      contentType: 'markdown',
    }),
    dialog,
    FILE_OPEN_FILTERS: [],
  })
  /** 按通道调用真实 handler（senderFrame 默认为窗口主 frame） */
  const call = (channel, senderId, ...args) =>
    ipc.handlers.get(channel)(makeEvent(senderId), ...args)
  return { fileAccess, ipc, call, dialog, trusted, findWindowIdByWebContents }
}

/** 伪造 IpcMainInvokeEvent；opts.untrusted=true 模拟未注册的 WebContents */
function makeEvent(senderId, opts = {}) {
  const sender = {
    id: senderId,
    isDestroyed: () => Boolean(opts.destroyed),
    mainFrame: { id: `main-${senderId}` },
  }
  return {
    sender,
    senderFrame: opts.iframe ? { id: `sub-frame-${senderId}` } : sender.mainFrame,
  }
}

/** 模拟窗口创建时的 docPath 授权（对应 main.js createManagedWindow） */
async function grantDocPath(env, senderId, docPath) {
  return env.fileAccess.grant(senderId, docPath, { read: true, write: true })
}

// ══════════════════════════════════════════════════════════════
// 2. 基本安全测试（T01–T10）
// ══════════════════════════════════════════════════════════════

describe('P0-3 基本安全测试', () => {
  it('T01 未授权读取任意文件 → 拒绝', async () => {
    const { call } = makeEnv()
    const result = await call('file:read-document', 1, SECRET)
    expect(result).toMatchObject({ contentType: 'access-denied', denied: true })
    expect(JSON.stringify(result)).not.toContain('TOP-SECRET')
  })

  it('T02 未授权写入任意文件 → 拒绝且文件不变', async () => {
    const { call } = makeEnv()
    const before = await fsp.readFile(SECRET, 'utf8')
    const result = await call('file:write-document', 1, SECRET, '# hacked')
    expect(result.ok).toBe(false)
    expect(await fsp.readFile(SECRET, 'utf8')).toBe(before)
  })

  it('T03 未授权 write-binary → 拒绝且文件不变', async () => {
    const { call } = makeEnv()
    const before = await fsp.readFile(SECRET, 'utf8')
    const b64 = Buffer.from('# binary hack').toString('base64')
    const result = await call('file:write-binary', 1, SECRET, b64)
    expect(result.ok).toBe(false)
    expect(await fsp.readFile(SECRET, 'utf8')).toBe(before)
  })

  it('T04 ../ 路径穿越 → 拒绝（授权精确比对，归一化后不等于授权路径）', async () => {
    const env = makeEnv()
    await env.fileAccess.grant(1, FILE_A, { read: true, write: true })
    // 归一化后指向 SECRET（未授权）的穿越构造
    const traversal = path.join(TMP, 'sub', '..', '..', 'secret.txt')
    expect(await env.fileAccess.check(1, traversal, 'read')).toBe(false)
    const result = await env.call('file:read-document', 1, traversal)
    expect(result.denied).toBe(true)
    // 写方向同样拒绝
    expect(await env.fileAccess.check(1, traversal, 'write')).toBe(false)
  })

  it('T05 相对路径 → 按策略拒绝（授权只接受绝对路径）', async () => {
    const { call } = makeEnv()
    expect(validateRequestedPath('relative/doc.md')).toMatchObject({ ok: false })
    const result = await call('file:read-document', 1, 'relative/doc.md')
    expect(result.denied).toBe(true)
    const w = await call('file:write-document', 1, 'relative/doc.md', 'x')
    expect(w.ok).toBe(false)
  })

  it('T06 伪造授权凭据 / 控制字符路径 → 拒绝（授权表无 token 可伪造，路径含 NUL 拒绝）', async () => {
    const { call } = makeEnv()
    // 本方案无客户端可持有的 token；等价攻击 = 携带非法字符的路径
    const nulPath = FILE_A + '\u0000.evil'
    const result = await call('file:read-document', 1, nulPath)
    expect(result.denied).toBe(true)
    const w = await call('file:write-document', 1, nulPath, 'x')
    expect(w.ok).toBe(false)
  })

  it('T07 窗口 B 使用窗口 A 的授权 → 拒绝', async () => {
    const env = makeEnv()
    await env.fileAccess.grant(1, FILE_A, { read: true, write: true })
    // 窗口 2 试图访问窗口 1 的授权文件
    expect(await env.fileAccess.check(2, FILE_A, 'read')).toBe(false)
    const read = await env.call('file:read-document', 2, FILE_A)
    expect(read.denied).toBe(true)
    const write = await env.call('file:write-document', 2, FILE_A, '# by B')
    expect(write.ok).toBe(false)
    // 窗口 1 自身仍正常
    expect(await env.fileAccess.check(1, FILE_A, 'read')).toBe(true)
  })

  it('T08 不可信 WebContents（未注册窗口）→ 拒绝', async () => {
    const env = makeEnv({ trustedWindows: [1] })
    const sender = { id: 99, isDestroyed: () => false, mainFrame: { id: 'm99' } }
    const event = { sender, senderFrame: sender.mainFrame }
    expect(isTrustedSender(event, { findWindowIdByWebContents: env.findWindowIdByWebContents })).toBe(false)
    // 伪造已销毁的 sender 同样拒绝
    const destroyed = makeEvent(1, { destroyed: true })
    expect(isTrustedSender(destroyed, { findWindowIdByWebContents: env.findWindowIdByWebContents })).toBe(false)
  })

  it('T09 iframe / 子 frame 调用特权 IPC → 拒绝', async () => {
    const env = makeEnv()
    await env.fileAccess.grant(1, FILE_A, { read: true, write: true })
    // 即使窗口与路径都合法，子 frame 也必须被拒
    const event = makeEvent(1, { iframe: true })
    expect(isTrustedSender(event, { findWindowIdByWebContents: env.findWindowIdByWebContents })).toBe(false)
    const result = await env.ipc.handlers.get('file:read-document')(event, FILE_A)
    expect(result.denied).toBe(true)
    const w = await env.ipc.handlers.get('file:write-document')(event, FILE_A, 'x')
    expect(w.ok).toBe(false)
  })

  it('T10 授权后符号链接被换指向范围外 → 拒绝', async () => {
    const realFile = path.join(TMP, 'real-doc.md')
    await fsp.writeFile(realFile, '# real', 'utf8')
    const env = makeEnv()
    await env.fileAccess.grant(1, realFile, { read: true, write: true })
    expect(await env.fileAccess.check(1, realFile, 'read')).toBe(true)
    // 攻击者把授权文件替换为指向 SECRET 的符号链接
    if (SYMLINK) { /* noop */ }
    try { await fsp.unlink(realFile) } catch { /* ignore */ }
    try {
      await fsp.symlink(SECRET, realFile, 'file')
    } catch {
      // Windows 无符号链接权限时跳过该攻击步骤，验证跳过原因
      expect(fs.existsSync(realFile)).toBe(false)
      return
    }
    const result = await env.call('file:read-document', 1, realFile)
    expect(result.denied).toBe(true, 'symlink 换指向后必须拒绝')
    expect(JSON.stringify(result)).not.toContain('TOP-SECRET')
    const w = await env.call('file:write-document', 1, realFile, '# overwrite secret')
    expect(w.ok).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// 3. 正常业务测试（T11–T17）
// ══════════════════════════════════════════════════════════════

describe('P0-3 正常业务测试', () => {
  it('T11 用户通过打开对话框选择 Markdown → 正常读取', async () => {
    const { call } = makeEnv()
    // dialog:open-file 真实 handler：用户选择 FILE_A → 主进程签发授权
    const picked = await call('dialog:open-file', 1)
    expect(picked).toBe(FILE_A)
    const payload = await call('file:read-document', 1, FILE_A)
    expect(payload).toMatchObject({ path: FILE_A, contentType: 'markdown' })
    expect(payload.content).toBe('# original A')
  })

  it('T12 打开文件后正常保存（写回原文档）', async () => {
    const { call } = makeEnv()
    await call('dialog:open-file', 1) // 授权 read+write
    const result = await call('file:write-document', 1, FILE_A, '# saved by user')
    expect(result.ok).toBe(true)
    expect(await fsp.readFile(FILE_A, 'utf8')).toBe('# saved by user')
    // mtime 刷新（useDocumentFocusRefresh 依赖）仍可用
    const stat = await call('file:get-modified-time', 1, FILE_A)
    expect(typeof stat.mtimeMs).toBe('number')
    await fsp.writeFile(FILE_A, '# original A', 'utf8') // 还原
  })

  it('T13 另存为新路径（show-save-dialog 授权 → writeBinary 成功）', async () => {
    const env = makeEnv()
    const newTarget = path.join(SUB_DIR, 'export.pdf')
    const fakeWindow = { isDestroyed: () => false }
    const saveDialog = {
      showSaveDialog: async () => ({ canceled: false, filePath: newTarget }),
    }
    const fakeBw = { fromWebContents: () => fakeWindow }
    // 真实 handleShowSaveDialog + onFilePicked 授权回调（main.js 同款装配）
    const pick = await handleShowSaveDialog(
      { dialog: saveDialog, BrowserWindow: fakeBw, onFilePicked: async (event, fp) => {
        await env.fileAccess.grant(event.sender.id, fp, { read: true, write: true })
      } },
      makeEvent(1),
      { title: '导出 PDF' },
    )
    expect(pick).toEqual({ canceled: false, filePath: newTarget })
    const b64 = Buffer.from('%PDF-fake').toString('base64')
    const result = await env.call('file:write-binary', 1, newTarget, b64)
    expect(result.ok).toBe(true)
    expect(await fsp.readFile(newTarget)).toEqual(Buffer.from('%PDF-fake'))
  })

  it('T14 导出场景（convert-docx 授权读取）不受影响', async () => {
    const env = makeEnv()
    await env.fileAccess.grant(1, FILE_A, { read: true, write: true })
    const payload = await env.call('file:convert-docx', 1, FILE_A)
    expect(payload).toMatchObject({ content: 'docx-html', path: FILE_A })
    // 未授权的 convert-docx 拒绝
    const denied = await env.call('file:convert-docx', 2, FILE_B)
    expect(denied.denied).toBe(true)
  })

  it('T15 多窗口分别打开自己的文档，不能互用授权', async () => {
    const env = makeEnv()
    await grantDocPath(env, 1, FILE_A)
    await grantDocPath(env, 2, FILE_B)
    // 各自读写正常
    expect(await env.call('file:read-document', 1, FILE_A)).toMatchObject({ contentType: 'markdown' })
    expect(await env.call('file:read-document', 2, FILE_B)).toMatchObject({ contentType: 'markdown' })
    // 跨窗口全部拒绝
    expect((await env.call('file:read-document', 1, FILE_B)).denied).toBe(true)
    expect((await env.call('file:read-document', 2, FILE_A)).denied).toBe(true)
    expect((await env.call('file:write-document', 2, FILE_A, 'x')).ok).toBe(false)
    expect((await env.call('file:write-binary', 1, FILE_B, 'eG1s')).ok).toBe(false)
  })

  it('T16 窗口关闭后授权撤销', async () => {
    const env = makeEnv()
    await grantDocPath(env, 1, FILE_A)
    expect(await env.fileAccess.check(1, FILE_A, 'read')).toBe(true)
    expect(env.fileAccess.grantCount(1)).toBe(1)
    // main.js window 'closed' → fileAccess.revoke(wcId)
    env.fileAccess.revoke(1)
    expect(await env.fileAccess.check(1, FILE_A, 'read')).toBe(false)
    expect((await env.call('file:read-document', 1, FILE_A)).denied).toBe(true)
    expect(env.fileAccess.grantCount(1)).toBe(0)
  })

  it('T17 重新打开应用（新会话重新签发授权）→ 打开和保存仍有效', async () => {
    // 模拟重启：全新 fileAccess 实例 + 全新窗口，重新走授权流程
    const env = makeEnv()
    expect(await env.fileAccess.check(1, FILE_A, 'read')).toBe(false)
    // (a) 窗口以 docPath 创建（OS 关联打开）→ createManagedWindow 签发
    await grantDocPath(env, 1, FILE_A)
    expect((await env.call('file:read-document', 1, FILE_A)).contentType).toBe('markdown')
    expect((await env.call('file:write-document', 1, FILE_A, '# again')).ok).toBe(true)
    // (b) 或经对话框重新选择 → 授权后同样有效
    const env2 = makeEnv()
    await env2.call('dialog:open-file', 1)
    expect((await env2.call('file:read-document', 1, FILE_A)).content).toBe('# again')
  })
})

// ══════════════════════════════════════════════════════════════
// 4. window:create 授权转移（authorizeDocPathTransfer）
// ══════════════════════════════════════════════════════════════

describe('P0-3 window:create docPath 授权转移', () => {
  const baseDeps = (env) => ({
    fileAccess: env.fileAccess,
    findWindowIdByWebContents: env.findWindowIdByWebContents,
  })

  it('无 docPath → 直接放行（空白/AI 新建窗口不受影响）', async () => {
    const env = makeEnv()
    const result = await authorizeDocPathTransfer({
      event: makeEvent(1), docPath: undefined, ...baseDeps(env),
    })
    expect(result).toEqual({ ok: true })
  })

  it('发送方已持有授权 → 转移成功（TitleBar 打开新窗口场景）', async () => {
    const env = makeEnv()
    await env.call('dialog:open-file', 1) // 对话框签发
    const result = await authorizeDocPathTransfer({
      event: makeEvent(1), docPath: FILE_A, ...baseDeps(env),
    })
    expect(result).toEqual({ ok: true })
  })

  it('发送方未持有授权 → 拒绝携带（渲染层不能凭空指定路径）', async () => {
    const env = makeEnv()
    const result = await authorizeDocPathTransfer({
      event: makeEvent(1), docPath: SECRET, ...baseDeps(env),
    })
    expect(result).toEqual({ ok: false, error: 'UNAUTHORIZED_PATH' })
  })

  it('不可信发送方 → 拒绝', async () => {
    const env = makeEnv({ trustedWindows: [1] })
    const result = await authorizeDocPathTransfer({
      event: makeEvent(99), docPath: FILE_A, ...baseDeps(env),
    })
    expect(result).toEqual({ ok: false, error: 'UNTRUSTED_SENDER' })
  })
})












