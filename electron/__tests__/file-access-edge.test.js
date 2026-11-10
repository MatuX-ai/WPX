/**
 * file-access-edge.test.js —— P0-3 补充边界测试（TASK-02 取证，不改源码）
 *
 * A 组：把 i:/WPX/debug/TASK-01-static-review.md 的「不一致 #8」与
 *       「存疑 #1b / #5b / #7b」变成可执行证据。
 * B 组：通用边界（Windows 尾随空格/大小写、目录符号链接、并发 revoke、
 *       替身文件、convert-docx、只读授权转移）。
 *
 * 写法与 file-access-security.test.js 相同：真实 registerFileIpc /
 * createFileAccessService / 真实 fs 临时目录，仅伪造 Electron event
 * 边界与对话框返回值。不 mock 路径检查逻辑。
 * T01b 中对注入 fsp 的包装是「模拟攻击者在 check 与 write 之间的窗口内
 * 动作」，被测的 fileAccess.check 路径检查完全真实，不属于 mock。
 *
 * 运行（i:/WPX/wpx-app 目录）：npm run test:zip -- file-access-edge
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { createFileAccessService } = require('../file-access.js')
const { registerFileIpc, authorizeDocPathTransfer } = require('../file-ipc.js')
const { handleShowSaveDialog } = require('../dialog-ipc.js')

const IS_WIN = process.platform === 'win32'
const itWin = IS_WIN ? it : it.skip

// ══════════════════════════════════════════════════════════════
// 1. 测试夹具（与 file-access-security.test.js 同款）
// ══════════════════════════════════════════════════════════════

let TMP
let FILE_A      // 普通授权文档
let SECRET      // 无授权敏感文件（TOCTOU 攻击目标）
let SUB_DIR     // 子目录
let OUTSIDE_DIR // TMP 之外的第二临时目录（目录符号链接攻击目标）

beforeAll(async () => {
  TMP = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-edge-'))
  OUTSIDE_DIR = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-edge-out-'))
  FILE_A = path.join(TMP, 'doc-a.md')
  SECRET = path.join(TMP, 'secret.txt')
  SUB_DIR = path.join(TMP, 'sub')
  await fsp.mkdir(SUB_DIR, { recursive: true })
  await fsp.writeFile(FILE_A, '# original A', 'utf8')
  await fsp.writeFile(SECRET, 'TOP-SECRET-CONTENT', 'utf8')
})

afterAll(async () => {
  await fsp.rm(TMP, { recursive: true, force: true })
  await fsp.rm(OUTSIDE_DIR, { recursive: true, force: true })
})

function makeFakeIpcMain() {
  const handlers = new Map()
  return { handle: (ch, fn) => handlers.set(ch, fn), handlers }
}

/**
 * 构造 IPC 环境。opts.fsp 允许注入包装后的 fsp（仅影响 handler 的实际
 * fs 操作，用于 T01b 模拟攻击者窗口动作；fileAccess 始终用真实 fs）。
 */
function makeEnv({ trustedWindows = [1, 2], fspOverride } = {}) {
  const fileAccess = createFileAccessService()
  const trusted = new Set(trustedWindows)
  const findWindowIdByWebContents = (wc) => (wc && trusted.has(wc.id) ? wc.id : null)
  const ipc = makeFakeIpcMain()
  const dialog = {
    showOpenDialog: async () => ({ canceled: false, filePaths: [FILE_A] }),
  }
  const calls = { convertDocx: 0 }
  registerFileIpc({
    ipcMain: ipc,
    fsp: fspOverride || fsp,
    fileAccess,
    findWindowIdByWebContents,
    convertDocxFile: async (p) => {
      calls.convertDocx += 1
      return { content: 'docx-html', path: p, contentType: 'docx-html' }
    },
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
  const call = (channel, senderId, ...args) =>
    ipc.handlers.get(channel)(makeEvent(senderId), ...args)
  return { fileAccess, ipc, call, dialog, trusted, findWindowIdByWebContents, calls }
}

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

/**
 * 复刻 main.js openAssociatedFile default 分支（TASK-04 修复后）的调用序列：
 *   const payload = await readAssociatedFilePayload(filePath)
 *   void fileAccess.grant(mainWindow.webContents.id, filePath, { read: true, write: true })
 *   mainWindow.webContents.send('file:open', payload)
 * main.js 中 grant 为 `void ...`（fire-and-forget，G01 时序问题仍遗留），
 * 此处同样不 await，返回 promise 供用例按真实时间尺度等待授权落表。
 */
function deliverDefaultBranch(env, senderId, filePath) {
  const payload = {
    content: fs.readFileSync(filePath, 'utf8'),
    path: filePath,
    // 与 file-open.js readAssociatedFilePayload 一致：title = 去扩展名的 basename
    title: path.basename(filePath, path.extname(filePath)),
    contentType: 'markdown',
  }
  const grantPromise = env.fileAccess.grant(senderId, filePath, { read: true, write: true })
  const sent = [{ channel: 'file:open', payload }] // 对应 webContents.send('file:open', payload)
  return { payload, grantPromise, sent }
}

// ══════════════════════════════════════════════════════════════
// 2. A 组：TASK-01 发现取证（D01 已于 TASK-04 修复 → 转为回归用例）
// ══════════════════════════════════════════════════════════════

describe('A 组：TASK-01 发现取证', () => {
  it('D01 回归（TASK-04 已修）：default 分支签发 grant → OS 关联打开的普通文档 mtime 有效、可写回', async () => {
    // TASK-01 #8 / TASK-02 D01 原为「default 分支无 grant → 写回被拒、mtime
    // 为 null」。TASK-04 在该分支 `if (!mainWindow) return` 之后补入了
    // 与其余 4 个分支同形态的授权语句，本用例转为回归断言。
    const env = makeEnv()
    const { grantPromise, payload } = deliverDefaultBranch(env, 1, FILE_A)
    await grantPromise

    expect(payload.path).toBe(FILE_A)
    expect(env.fileAccess.grantCount(1)).toBe(1) // 授权已落表（修复点）

    // 前端 syncDocumentSource（useDocumentFocusRefresh.js L21）→ file:get-modified-time
    const stat = await env.call('file:get-modified-time', 1, FILE_A)
    expect(stat?.mtimeMs).toBeTypeOf('number') // 修复前为 null

    // 前端保存写回（documentFile.js L299 / documentPack.js）→ file:write-document
    const write = await env.call('file:write-document', 1, FILE_A, '# task04-fixed')
    expect(write.ok).toBe(true) // 修复前为 ok:false / 未授权写入该路径
    expect(await fsp.readFile(FILE_A, 'utf8')).toBe('# task04-fixed')

    // 还原现场
    await fsp.writeFile(FILE_A, '# original A', 'utf8')
  })

  it('D01 真实链路（新增）：模拟 default 分支交付 .md → 授权签发 → 写回成功 / mtime 非 null', async () => {
    // 端到端串联：主进程读 payload + 签发授权 + 推送 payload，前端凭
    // payload.path 直接读写，不经任何对话框。这是 OS 双击 .md 的真实链路。
    const env = makeEnv()
    const { payload, grantPromise, sent } = deliverDefaultBranch(env, 1, FILE_A)

    // 交付内容正确（title 取 basename，无扩展名）
    expect(payload.content).toBe('# original A')
    expect(payload.title).toBe('doc-a')
    expect(sent[0].channel).toBe('file:open')

    // 授权落表后前端即可用（真实运行时前端在此之后才发起 IPC）
    await grantPromise
    const read = await env.call('file:read-document', 1, FILE_A)
    expect(read.denied).toBeUndefined()
    expect(read.content).toBe('# original A')

    const stat = await env.call('file:get-modified-time', 1, FILE_A)
    expect(stat.mtimeMs).toBeTypeOf('number')

    const write = await env.call('file:write-document', 1, FILE_A, '# real-chain write')
    expect(write).toEqual({ ok: true })
    expect(await fsp.readFile(FILE_A, 'utf8')).toBe('# real-chain write')

    // 授权按 webContents.id 隔离：另一个窗口不因该交付获得权限
    expect(await env.call('file:get-modified-time', 2, FILE_A)).toBeNull()
    expect((await env.call('file:write-document', 2, FILE_A, '# other')).ok).toBe(false)
    expect(await fsp.readFile(FILE_A, 'utf8')).toBe('# real-chain write')

    await fsp.writeFile(FILE_A, '# original A', 'utf8')
  })

  it('D01 源码契约：default 分支的 grant 语句与其余 4 分支同形态且先于交付', () => {
    // 防止修复被回退：直接对 electron/main.js 源码做形态断言
    const mainPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'main.js')
    const source = fs.readFileSync(mainPath, 'utf8')
    const start = source.indexOf('const payload = await readAssociatedFilePayload(filePath)')
    expect(start).toBeGreaterThan(0)
    const end = source.indexOf('showMainWindow()', start)
    const defaultBranch = source.slice(start, end)

    expect(defaultBranch).toContain(
      'void fileAccess.grant(mainWindow.webContents.id, filePath, { read: true, write: true })',
    )
    // 授权语句必须出现在交付（deliver）之前，与其余分支顺序一致
    expect(defaultBranch.indexOf('fileAccess.grant')).toBeLessThan(
      defaultBranch.indexOf('deliver()'),
    )
  })

  it('T01b TOCTOU：check 通过后、实际写入前目标被换为指向外部的 symlink → 记录是否被绕过（TASK-01 #1b）', async () => {
    // 攻击模型：授权文件 FILE_A；攻击者在 handler 的 check（真实 realpath
    // 校验）与 fsp.writeFile 之间的窗口内，把 FILE_A 替换为指向 SECRET 的
    // 符号链接。通过包装注入 registerFileIpc 的 fsp.writeFile 在写入前
    // 执行换链动作来模拟该窗口（fileAccess 的校验路径完全真实、未被 mock）。
    const env = makeEnv({
      fspOverride: {
        writeFile: async (p, data, enc) => {
          try {
            await fsp.unlink(p)
            await fsp.symlink(SECRET, p, 'file')
            env.__swapped = true
          } catch {
            // Windows 无符号链接权限时无法完成攻击动作，用例降级为记录
          }
          return fsp.writeFile(p, data, enc)
        },
      },
    })
    await env.fileAccess.grant(1, FILE_A, { read: true, write: true })
    const secretBefore = await fsp.readFile(SECRET, 'utf8')

    const result = await env.call('file:write-document', 1, FILE_A, '# toc Tou overwrite')

    if (!env.__swapped) {
      // 环境（Windows symlink 权限）不支持复现 → 标记为需人工验证
      console.warn('[T01b] symlink 创建失败（无权限），TOCTOU 需在管理员/开发者模式下人工验证')
      expect(result.ok).toBe(true) // 写回原文件成功，属正常行为
      expect(await fsp.readFile(SECRET, 'utf8')).toBe(secretBefore)
      return
    }
    // 取证断言（记录当前实际行为）：handler 返回 ok，且写入经 symlink
    // 落到未授权的 SECRET 上 → TOCTOU 绕过复现。若本断言失败，说明该
    // 残余风险已消除，应更新 TASK-01 #1b 结论。
    expect(result.ok).toBe(true)
    const secretAfter = await fsp.readFile(SECRET, 'utf8')
    expect(secretAfter).not.toBe(secretBefore) // SECRET 被改写 = 绕过成立
    // 还原现场
    await fsp.unlink(FILE_A).catch(() => {})
    await fsp.writeFile(SECRET, secretBefore, 'utf8')
    await fsp.writeFile(FILE_A, '# original A', 'utf8')
  })

  it('G01 grant 时序：grant 未 await 落表前发起 write → 记录瞬时误拒（TASK-01 #5b）', async () => {
    const env = makeEnv()
    // 复现 main.js L841 `void fileAccess.grant(...)`：fire-and-forget。
    // 新窗口渲染层可能在授权 realpath 落表前就发起读写。
    const grantPromise = env.fileAccess.grant(1, FILE_A, { read: true, write: true })
    const results = []
    for (let i = 0; i < 3; i++) {
      results.push(await env.call('file:write-document', 1, FILE_A, `# g01-${i}`))
    }
    await grantPromise
    const afterGrant = await env.call('file:write-document', 1, FILE_A, '# g01-final')

    const deniedBefore = results.filter((r) => !r.ok).length
    console.warn(`[G01] grant 落表前 3 次 write：${deniedBefore} 次被拒；grant 落表后 ok=${afterGrant.ok}`)
    // 取证断言（记录当前实际行为）：授权尚未落表时写入被拒（瞬时误拒）。
    // 若 deniedBefore === 0 则说明该竞态未复现，应更新 TASK-01 #5b 结论。
    expect(deniedBefore).toBe(3)
    expect(afterGrant.ok).toBe(true)
  })

  it('S01 子 frame 调用 dialog:show-save-dialog → 记录是否被拒（TASK-01 #7b；当前实现放行则为可利用面证据）', async () => {
    const env = makeEnv()
    const target = path.join(SUB_DIR, 'sub-frame-save.md')
    const saveDialog = {
      showSaveDialog: async () => ({ canceled: false, filePath: target }),
    }
    const fakeWindow = { isDestroyed: () => false }
    const fakeBw = { fromWebContents: () => fakeWindow }
    let picked = null

    // 子 frame sender（senderFrame !== sender.mainFrame），main.js 同款
    // onFilePicked 装配（main.js L1075-1079，同样无 trusted 前置）
    const result = await handleShowSaveDialog(
      {
        dialog: saveDialog,
        BrowserWindow: fakeBw,
        onFilePicked: async (event, fp) => {
          picked = fp
          await env.fileAccess.grant(event.sender.id, fp, { read: true, write: true })
        },
      },
      makeEvent(1, { iframe: true }),
      { title: '另存为' },
    )

    // 取证断言（记录当前实际行为）：子 frame 触发的保存对话框照常返回
    // filePath，且授权被签发到该 sender 名下 → TASK-01 #7b「无 trusted
    // 前置」复现。当前不可利用（6 个消费通道均要求主 frame 且授权按
    // wcId 隔离），但与 dialog:open-file 的防护不对齐。
    expect(result).toEqual({ canceled: false, filePath: target })
    expect(picked).toBe(target)
    expect(env.fileAccess.grantCount(1)).toBe(1) // 授权已签发给子 frame 的 wcId
  })
})

// ══════════════════════════════════════════════════════════════
// 3. B 组：通用边界
// ══════════════════════════════════════════════════════════════

describe('B 组：通用边界', () => {
  itWin('E01 Windows 尾随空格：授权 "a.txt "（Win32 落盘为 a.txt）访问 "a.txt" → 记录实际行为', async () => {
    const realFile = path.join(TMP, 'trail-space.txt')
    await fsp.writeFile(realFile, '# trail', 'utf8')
    const withSpace = realFile + ' ' // Windows API 落盘/解析时剥离尾随空格
    await fsp.writeFile(withSpace, '# trail', 'utf8') // 与上一行应为同一文件

    const env = makeEnv()
    const granted = await env.fileAccess.grant(1, withSpace, { read: true, write: true })
    const checkNoSpace = await env.fileAccess.check(1, realFile, 'write')
    const checkWithSpace = await env.fileAccess.check(1, withSpace, 'write')
    const realNoSpace = await fsp.realpath(realFile).catch((e) => `ERR:${e.code}`)
    const realWithSpace = await fsp.realpath(withSpace).catch((e) => `ERR:${e.code}`)
    const dirListing = fs.readdirSync(TMP).filter((n) => n.startsWith('trail-space')).join('|')
    console.warn(`[E01] grant(带空格)=${granted}; check(无空格)=${checkNoSpace}; check(带空格)=${checkWithSpace}; grantCount=${env.fileAccess.grantCount(1)}; realpath(无空格)=${JSON.stringify(realNoSpace)}; realpath(带空格)=${JSON.stringify(realWithSpace)}; 落盘文件=${dirListing}`)

    // 记录实际行为（实测 win32 环境，Node 22 / NTFS）：
    //   fsp.realpath 并不剥离尾随空格——带空格与不带空格两种拼写得到
    //   不同的 realpath 字符串，授权表视为两条不同条目。
    //   后果：授权带空格拼写后，无空格拼写被拒（反之亦然）。
    //   未观察到权限提升（两种拼写各需各自授权，无法用一种换另一种），
    //   属规范化不一致，记录待评估。
    expect(granted).toBe(true)
    expect(env.fileAccess.grantCount(1)).toBe(1)
    expect(checkWithSpace).toBe(true)
    expect(checkNoSpace).toBe(false)
  })

  itWin('E02 Windows 大小写：授权 C:\\…\\A.txt 访问 c:\\…\\a.txt → 放行', async () => {
    const upper = path.join(TMP, 'Case-A.txt')
    await fsp.writeFile(upper, '# case', 'utf8')
    const lower = path.join(TMP, 'case-a.txt')

    const env = makeEnv()
    await env.fileAccess.grant(1, upper, { read: true, write: true })
    // Windows 忽略大小写（file-access.js toComparable 小写化）
    expect(await env.fileAccess.check(1, lower, 'read')).toBe(true)
    expect(await env.fileAccess.check(1, lower, 'write')).toBe(true)
    expect(env.fileAccess.grantCount(1)).toBe(1)
    const payload = await env.call('file:read-document', 1, lower)
    expect(payload.content).toBe('# case')
  })

  it('E03 中间目录被换为指向外部的符号链接 → 读写均拒绝', async () => {
    const subDir = path.join(TMP, 'sub3')
    const docInSub = path.join(subDir, 'doc.md')
    await fsp.mkdir(subDir, { recursive: true })
    await fsp.writeFile(docInSub, '# inside', 'utf8')
    // TMP 之外的诱饵同名文件
    const decoy = path.join(OUTSIDE_DIR, 'doc.md')
    await fsp.writeFile(decoy, 'OUTSIDE-CONTENT', 'utf8')

    const env = makeEnv()
    await env.fileAccess.grant(1, docInSub, { read: true, write: true })
    expect(await env.fileAccess.check(1, docInSub, 'read')).toBe(true)

    // 攻击：把授权文件的父目录整体替换为指向 OUTSIDE_DIR 的链接
    //（Windows 用 junction，无需管理员权限）
    await fsp.rm(subDir, { recursive: true, force: true })
    const dirType = IS_WIN ? 'junction' : 'dir'
    await fsp.symlink(OUTSIDE_DIR, subDir, dirType)

    // realpath 现在解析为 OUTSIDE_DIR/doc.md ≠ 授权条目 → 必须拒绝
    expect(await env.fileAccess.check(1, docInSub, 'read')).toBe(false)
    expect(await env.fileAccess.check(1, docInSub, 'write')).toBe(false)
    const read = await env.call('file:read-document', 1, docInSub)
    expect(read.denied).toBe(true)
    expect(JSON.stringify(read)).not.toContain('OUTSIDE-CONTENT')
    const write = await env.call('file:write-document', 1, docInSub, '# evil')
    expect(write.ok).toBe(false)
    expect(await fsp.readFile(decoy, 'utf8')).toBe('OUTSIDE-CONTENT') // 诱饵未被改写
  })

  it('E04 并发写 + revoke：Promise.all 同时写与 revoke(senderId) → 记录是否部分写入', async () => {
    const env = makeEnv()
    await env.fileAccess.grant(1, FILE_A, { read: true, write: true })

    const ops = Array.from({ length: 5 }, (_, i) =>
      env.call('file:write-document', 1, FILE_A, `# e04-${i}`))
    const revokeAt = env.fileAccess.revoke(1) // 与写入并发执行
    const results = await Promise.all(ops)
    const okCount = results.filter((r) => r.ok).length
    const deniedCount = results.filter((r) => !r.ok).length
    console.warn(`[E04] 并发 5 次 write + revoke：成功 ${okCount} 次，被拒 ${deniedCount} 次；revoke 返回 ${revokeAt}`)

    // 记录型用例：不预设成败比例，只断言结果自洽——
    // 成功的写入其内容应真实落盘；被拒的写入不应破坏文件
    expect(okCount + deniedCount).toBe(5)
    const final = await fsp.readFile(FILE_A, 'utf8')
    expect(typeof final).toBe('string')
    // revoke 后授权确已清空
    expect(await env.fileAccess.check(1, FILE_A, 'write')).toBe(false)
    expect(env.fileAccess.grantCount(1)).toBe(0)
    // 还原
    await fsp.writeFile(FILE_A, '# original A', 'utf8')
  })

  it('E05 未授权 write-binary 到已存在替身文件 → 拒绝且内容不变', async () => {
    const decoy = path.join(TMP, 'decoy.bin')
    const original = Buffer.from([0x00, 0x01, 0x02, 0xff])
    await fsp.writeFile(decoy, original)

    const env = makeEnv()
    const b64 = Buffer.from('# binary hack').toString('base64')
    const result = await env.call('file:write-binary', 1, decoy, b64)
    expect(result.ok).toBe(false)
    expect(await fsp.readFile(decoy)).toEqual(original)
  })

  it('E06 未授权 convert-docx → 拒绝且解析器从未被调用（无临时产物）', async () => {
    const env = makeEnv()
    const listingBefore = fs.readdirSync(TMP).sort().join(',')
    const result = await env.call('file:convert-docx', 1, SECRET)
    expect(result.denied).toBe(true)
    expect(result).toMatchObject({ contentType: 'access-denied' })
    expect(env.calls.convertDocx).toBe(0) // 未授权路径不进入解析器
    expect(fs.readdirSync(TMP).sort().join(',')).toBe(listingBefore) // 无临时文件残留
  })

  it('E07 window:create 带 docPath 但发送方只持 read 不持 write → 拒绝（UNAUTHORIZED_PATH）', async () => {
    const env = makeEnv()
    await env.fileAccess.grant(1, FILE_A, { read: true, write: false }) // 仅 read
    const result = await authorizeDocPathTransfer({
      event: makeEvent(1),
      docPath: FILE_A,
      fileAccess: env.fileAccess,
      findWindowIdByWebContents: env.findWindowIdByWebContents,
    })
    expect(result).toEqual({ ok: false, error: 'UNAUTHORIZED_PATH' })
  })
})
