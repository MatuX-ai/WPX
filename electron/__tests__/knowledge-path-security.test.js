/**
 * knowledge-path-security.test.js —— knowledge-service id/docId/verId 路径安全测试（TASK-08）
 *
 * 覆盖：
 *  - 正向：合法 UUID 的 preview / versions / version-content / rollback / delete 全流程正常
 *  - 反向：TASK-07 K1-a / K1-c / K2 / K3 攻击构造全部被拒，越界替身文件不变
 *  - K1-b / K1-d 维持原拒绝行为
 *
 * 手法：真实服务函数 + 真实 fs 临时根；仅伪造 electron 模块边界
 * （本文件在 test/setup.js 之后再包一层 Module._load，提供完整 app/ipcMain/BrowserWindow 空壳）。
 *
 * 运行：npm --prefix wpx-app run test:zip -- knowledge-path-security
 */
import { describe, it, expect, beforeAll } from 'vitest'
import Module from 'node:module'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ══════════════════════════════════════════════════════════════
// 1. electron 模块边界 mock（真实 fs / 真实业务逻辑，零 mock 业务）
// ══════════════════════════════════════════════════════════════

let fakeUserData = ''
const handledChannels = []
const parentLoad = Module._load
Module._load = function loadWithKnowledgeElectronMock(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: false,
        isReady: () => true,
        whenReady: () => Promise.resolve(),
        getPath: (name) => (name === 'userData' ? fakeUserData : os.tmpdir()),
      },
      ipcMain: { handle: (channel) => handledChannels.push(channel) },
      BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
    }
  }
  return parentLoad.call(this, request, parent, isMain)
}

const service = require('../knowledge-service.js')

// ══════════════════════════════════════════════════════════════
// 2. 夹具
// ══════════════════════════════════════════════════════════════

let tmpRoot = ''
let knowledgeRoot = ''
let escapeDir = ''

/** TASK-07 原版攻击构造：textDir 出发 2 级 .. 到 tmpRoot，再进 escape 替身区 */
function traversalId(name) {
  return ['..', '..', 'escape', name].join(path.sep)
}

async function seedDb(items) {
  const dbPath = path.join(knowledgeRoot, 'db.json')
  await fsp.writeFile(dbPath, JSON.stringify({ items }), 'utf8')
}

/** 在真实 versions 目录内造一个合法版本（manifest + ver.txt/ver.json） */
async function seedVersion(docId, verId, content) {
  const verDir = path.join(knowledgeRoot, 'versions', docId)
  await fsp.mkdir(verDir, { recursive: true })
  await fsp.writeFile(path.join(verDir, `${verId}.txt`), content, 'utf8')
  await fsp.writeFile(
    path.join(verDir, `${verId}.json`),
    JSON.stringify({ verId, docId, createdAt: '2026-11-10T00:00:00.000Z', charCount: content.length }, null, 2),
    'utf8',
  )
  const manifest = [{ verId, docId, createdAt: '2026-11-10T00:00:00.000Z', charCount: content.length }]
  await fsp.writeFile(path.join(verDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
}

function makeDbItem(id, filename = 'doc.txt') {
  return {
    id,
    filename,
    type: 'text',
    source: 'file',
    uploadedAt: '2026-11-10T00:00:00.000Z',
    charCount: 20,
    parseStatus: 'parsed',
    errorMessage: '',
    storedFilename: '',
  }
}

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-knowledge-sec-'))
  fakeUserData = tmpRoot
  knowledgeRoot = path.join(tmpRoot, 'knowledge')
  escapeDir = path.join(tmpRoot, 'escape')

  // 越界替身文件（库根之外、临时根之内）
  await fsp.mkdir(path.join(escapeDir, 'k1victim'), { recursive: true })
  await fsp.mkdir(path.join(escapeDir, 'k2dir'), { recursive: true })
  await fsp.writeFile(path.join(escapeDir, 'victim.txt'), 'K1-SECRET-CONTENT-7f3a', 'utf8')
  await fsp.writeFile(path.join(escapeDir, 'k1victim', 'k1ver.txt'), 'K1-VERSION-CONTENT-9b2c', 'utf8')
  await fsp.writeFile(path.join(escapeDir, 'k2dir', 'k2ver.txt'), 'K2-ROLLBACK-CONTENT-4d8e', 'utf8')
  await fsp.writeFile(path.join(escapeDir, 'k3victim.txt'), 'K3-VICTIM-CONTENT-1a6f', 'utf8')

  await service.initKnowledgeService()
  expect(handledChannels).toContain('knowledge:preview')
})

// ══════════════════════════════════════════════════════════════
// 3. 正向：合法 UUID 全流程（防修复过度）
// ══════════════════════════════════════════════════════════════

describe('正向：合法 UUID 流程不受影响', () => {
  it('preview(合法 UUID) → 返回内容', async () => {
    const docId = randomUUID()
    await seedDb([makeDbItem(docId)])
    await fsp.mkdir(path.join(knowledgeRoot, 'text'), { recursive: true })
    await fsp.writeFile(path.join(knowledgeRoot, 'text', `${docId}.txt`), 'GOOD-CONTENT-a1', 'utf8')

    const r = await service.getKnowledgePreview(docId)
    expect(r.content).toBe('GOOD-CONTENT-a1')
    expect(r.id).toBe(docId)
  })

  it('versions(合法 UUID) → 返回 manifest', async () => {
    const docId = randomUUID()
    const verId = randomUUID()
    await seedVersion(docId, verId, 'VER-CONTENT-b2')

    const r = await service.getDocVersions(docId)
    expect(r.docId).toBe(docId)
    expect(r.versions).toHaveLength(1)
    expect(r.versions[0].verId).toBe(verId)
  })

  it('version-content(合法 UUID, 合法 verId) → 返回内容与 meta', async () => {
    const docId = randomUUID()
    const verId = randomUUID()
    await seedVersion(docId, verId, 'VER-CONTENT-c3')

    const r = await service.getVersionContent(docId, verId)
    expect(r.content).toBe('VER-CONTENT-c3')
    expect(r.docId).toBe(docId)
    expect(r.verId).toBe(verId)
    expect(r.meta.verId).toBe(verId)
  })

  it('rollback(合法 UUID, 合法 verId) → 正文回滚成功', async () => {
    const docId = randomUUID()
    const verId = randomUUID()
    await seedDb([makeDbItem(docId)])
    await seedVersion(docId, verId, 'VER-CONTENT-d4')
    await fsp.mkdir(path.join(knowledgeRoot, 'text'), { recursive: true })
    await fsp.writeFile(path.join(knowledgeRoot, 'text', `${docId}.txt`), 'CURRENT-d4', 'utf8')

    const r = await service.rollbackToVersion(docId, verId)
    expect(r.success).toBe(true)
    const now = await fsp.readFile(path.join(knowledgeRoot, 'text', `${docId}.txt`), 'utf8')
    expect(now).toBe('VER-CONTENT-d4')
  })

  it('delete(合法 UUID) → 删除正文并更新 db', async () => {
    const docId = randomUUID()
    await seedDb([makeDbItem(docId)])
    await fsp.mkdir(path.join(knowledgeRoot, 'text'), { recursive: true })
    const textFile = path.join(knowledgeRoot, 'text', `${docId}.txt`)
    await fsp.writeFile(textFile, 'TO-DELETE-e5', 'utf8')

    const r = await service.deleteKnowledge(docId)
    expect(r.success).toBe(true)
    expect(fs.existsSync(textFile)).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// 4. 反向：TASK-07 K1-a / K1-c / K2 / K3 全部转为拒绝
// ══════════════════════════════════════════════════════════════

describe('反向：TASK-07 攻击构造全部被拒', () => {
  it('K1-a preview(穿越 id) → 资料不存在，越界替身内容不变', async () => {
    const victim = path.join(escapeDir, 'victim.txt')
    await seedDb([makeDbItem(traversalId('victim'))])

    await expect(service.getKnowledgePreview(traversalId('victim'))).rejects.toThrow('资料不存在')
    expect(await fsp.readFile(victim, 'utf8')).toBe('K1-SECRET-CONTENT-7f3a')
  })

  it('K1-c version-content(穿越 docId, verId) → 版本内容不存在，替身不变', async () => {
    const victim = path.join(escapeDir, 'k1victim', 'k1ver.txt')

    await expect(service.getVersionContent(traversalId('k1victim'), 'k1ver')).rejects.toThrow(
      '版本内容不存在',
    )
    expect(await fsp.readFile(victim, 'utf8')).toBe('K1-VERSION-CONTENT-9b2c')
  })

  it('K2 rollback(穿越 docId, verId) → 拒绝且库根之外不落文件', async () => {
    const escaped = path.join(escapeDir, 'k2dir.txt')

    await expect(service.rollbackToVersion(traversalId('k2dir'), 'k2ver')).rejects.toThrow(
      '版本内容不存在',
    )
    expect(fs.existsSync(escaped)).toBe(false)
  })

  it('K3 delete(穿越 id) → 资料不存在，越界替身仍存在', async () => {
    const victim = path.join(escapeDir, 'k3victim.txt')
    await seedDb([makeDbItem(traversalId('k3victim'))])

    await expect(service.deleteKnowledge(traversalId('k3victim'))).rejects.toThrow('资料不存在')
    expect(await fsp.readFile(victim, 'utf8')).toBe('K3-VICTIM-CONTENT-1a6f')
  })

  it('反向补充：穿越 verId 同样被拒', async () => {
    const docId = randomUUID()
    await expect(service.getVersionContent(docId, ['..', '..', 'evil'].join(path.sep))).rejects.toThrow(
      '版本内容不存在',
    )
  })

  it('反向补充：versions(穿越 docId) → 返回空版本列表（不泄露路径）', async () => {
    const r = await service.getDocVersions(traversalId('k1victim'))
    expect(r).toEqual({ versions: [] })
  })
})

// ══════════════════════════════════════════════════════════════
// 5. 原拒绝行为维持（K1-b / K1-d）
// ══════════════════════════════════════════════════════════════

describe('维持原拒绝行为', () => {
  it('K1-b preview(合法 UUID 但 db 无记录) → 资料不存在', async () => {
    await seedDb([])
    await expect(service.getKnowledgePreview(randomUUID())).rejects.toThrow('资料不存在')
  })

  it('K1-d version-content(绝对路径 docId) → 版本内容不存在', async () => {
    const absDoc = path.join(escapeDir, 'k1victim')
    await expect(service.getVersionContent(absDoc, 'k1ver')).rejects.toThrow('版本内容不存在')
  })
})
