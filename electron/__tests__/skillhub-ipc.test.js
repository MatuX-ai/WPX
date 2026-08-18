/**
 * skillhub-ipc 单元测试（Phase 1 / M1.5）
 *
 * 运行：npm --prefix wpx-app test:zip -- skillhub-ipc
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const {
  sanitizeSegment,
  buildSkillMdRelativePath,
  writeSkillMdFiles,
  registerSkillhubIpcHandlers,
} = require('../skillhub-ipc.js')

/** @type {string} */
let tmpDir

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'skillhub-ipc-test-'))
})

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true })
})

// ═════════════════════════════════════════════════
// 1. sanitizeSegment
// ═════════════════════════════════════════════════
describe('skillhub-ipc — sanitizeSegment', () => {
  it('剥离路径分隔符与盘符', () => {
    expect(sanitizeSegment('a/b\\c')).toBe('a-b-c')
    expect(sanitizeSegment('C:')).toBe('c')
  })

  it('剥离 .. 与 Windows 非法字符', () => {
    expect(sanitizeSegment('..')).toBe('skill')
    expect(sanitizeSegment('a<b>c:d"e|f?g*h')).toBe('abcdefgh')
  })

  it('空值回退 fallback', () => {
    expect(sanitizeSegment('')).toBe('skill')
    expect(sanitizeSegment(null, 'default')).toBe('default')
    expect(sanitizeSegment(undefined, 'default')).toBe('default')
  })
})

// ═════════════════════════════════════════════════
// 2. buildSkillMdRelativePath
// ═════════════════════════════════════════════════
describe('skillhub-ipc — buildSkillMdRelativePath', () => {
  it('三段路径：skills/<category>/<subcategory>/<id>/SKILL.md', () => {
    expect(buildSkillMdRelativePath({
      id: 'lesson-plan',
      category: 'education',
      subcategory: 'teaching-prep',
    })).toBe('skills/education/teaching-prep/lesson-plan/SKILL.md')
  })

  it('无 subcategory 时压缩为两段', () => {
    expect(buildSkillMdRelativePath({ id: 'organize', category: 'study' })).toBe('skills/study/organize/SKILL.md')
  })

  it('恶意路径片段被净化', () => {
    expect(buildSkillMdRelativePath({ id: '../../etc', category: 'a/b', subcategory: '..' }))
      .toBe('skills/a-b/etc/SKILL.md')
  })

  it('缺省回退：general / skill', () => {
    expect(buildSkillMdRelativePath({})).toBe('skills/general/skill/SKILL.md')
  })
})

// ═════════════════════════════════════════════════
// 3. writeSkillMdFiles（真实文件系统）
// ═════════════════════════════════════════════════
describe('skillhub-ipc — writeSkillMdFiles', () => {
  it('写入多份 SKILL.md 并返回路径', async () => {
    const { written, paths } = await writeSkillMdFiles(tmpDir, [
      { id: 'a', category: 'edu', subcategory: 'prep', content: '# A\n\nbody' },
      { id: 'b', category: 'college', content: '# B\n\nbody' },
    ])
    expect(written).toBe(2)
    expect(paths).toHaveLength(2)
    expect(fs.existsSync(path.join(tmpDir, 'skills/edu/prep/a/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'skills/college/b/SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(tmpDir, 'skills/edu/prep/a/SKILL.md'), 'utf8')).toBe('# A\n\nbody')
  })

  it('恶意路径片段被净化后安全写入目标目录内（不越界）', async () => {
    const { written, paths } = await writeSkillMdFiles(tmpDir, [
      { id: '..', category: '..', content: 'x' },
    ])
    // .. 被净化回退为 general/skill，文件仍落在目标目录内
    expect(written).toBe(1)
    expect(paths[0]).toContain(tmpDir)
    expect(fs.existsSync(path.join(tmpDir, 'skills/general/skill/SKILL.md'))).toBe(true)
  })
})

// ═════════════════════════════════════════════════
// 4. IPC handler 接线（mock ipcMain / dialog）
// ═════════════════════════════════════════════════
describe('skillhub-ipc — registerSkillhubIpcHandlers', () => {
  it('注册 skillhub:export 与 skillhub:import-file 两个通道', () => {
    const handlers = {}
    const ipcMain = {
      handle: vi.fn((channel, fn) => { handlers[channel] = fn }),
    }
    const dialog = {}
    registerSkillhubIpcHandlers({ ipcMain, dialog })
    expect(ipcMain.handle).toHaveBeenCalledTimes(2)
    expect(handlers['skillhub:export']).toBeTypeOf('function')
    expect(handlers['skillhub:import-file']).toBeTypeOf('function')
  })

  it('单文件导出：保存对话框确认后写入文件', async () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    const savePath = path.join(tmpDir, 'out-SKILL.md')
    const dialog = {
      showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: savePath })),
    }
    registerSkillhubIpcHandlers({ ipcMain, dialog })
    const result = await handlers['skillhub:export']({}, { files: [{ id: 'demo', content: '# Demo\n\nbody' }] })
    expect(result.ok).toBe(true)
    expect(result.path).toBe(savePath)
    expect(fs.readFileSync(savePath, 'utf8')).toBe('# Demo\n\nbody')
  })

  it('单文件导出：用户取消 → canceled:true 且不写文件', async () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    const dialog = { showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: null })) }
    registerSkillhubIpcHandlers({ ipcMain, dialog })
    const result = await handlers['skillhub:export']({}, { files: [{ id: 'demo', content: 'x' }] })
    expect(result).toEqual({ ok: false, canceled: true })
  })

  it('多文件导出：选目录后按相对路径写入', async () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    const dialog = {
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [tmpDir] })),
    }
    registerSkillhubIpcHandlers({ ipcMain, dialog })
    const result = await handlers['skillhub:export']({}, {
      files: [
        { id: 'x', category: 'edu', content: 'x-body' },
        { id: 'y', category: 'edu', subcategory: 'prep', content: 'y-body' },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.written).toBe(2)
    expect(fs.existsSync(path.join(tmpDir, 'skills/edu/x/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'skills/edu/prep/y/SKILL.md'))).toBe(true)
  })

  it('导入：选择文件后返回内容', async () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    const importPath = path.join(tmpDir, 'import-SKILL.md')
    await fsp.writeFile(importPath, '---\nname: imported\ndescription: 导入\n---\n正文', 'utf8')
    const dialog = {
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [importPath] })),
    }
    registerSkillhubIpcHandlers({ ipcMain, dialog })
    const result = await handlers['skillhub:import-file']()
    expect(result.ok).toBe(true)
    expect(result.path).toBe(importPath)
    expect(result.content).toContain('name: imported')
  })

  it('导入：用户取消 → canceled:true', async () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    const dialog = { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) }
    registerSkillhubIpcHandlers({ ipcMain, dialog })
    const result = await handlers['skillhub:import-file']()
    expect(result).toEqual({ ok: false, canceled: true })
  })

  it('缺 ipcMain/dialog 时静默跳过', () => {
    expect(() => registerSkillhubIpcHandlers({})).not.toThrow()
  })
})
