/**
 * 文库路由端到端测试
 *
 * 模拟 Electron 环境 + Express 实例，注册 library 路由后通过 HTTP fetch 验证：
 *   - GET  /api/library/health
 *   - POST /api/library/analyze
 *   - POST /api/library/save（含 frontmatter 落盘）
 *   - GET  /api/library/tree（含目录树 + 标签云）
 *   - GET  /api/library/search
 *   - GET  /api/library/document
 *
 * 验证两件事：
 *   1. 端点全部可用，避免 Electron 桌面端 fetch 报 "Failed to fetch"。
 *   2. 数据格式与 Python library-service.py 一致，确保 web/桌面可共享同一份文库。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 准备临时 userData 目录，避免污染真实数据
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wpx-library-test-'))

let expressApp
let server
let baseUrl
let originalApp

beforeEach(async () => {
  vi.resetModules()

  // Mock electron.app.getPath('userData') → 临时目录
  originalApp = (await import('node:module')).default
  const Module = (await import('node:module')).default
  const originalLoad = Module._load
  Module._load = function loadWithMock(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          isPackaged: false,
          isReady: () => true,
          whenReady: () => Promise.resolve(),
          getPath: (key) => (key === 'userData' ? tempRoot : os.tmpdir()),
        },
        ipcMain: { handle: () => {} },
        BrowserWindow: { getAllWindows: () => [] },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  // Mock user-data-service getPreferences 返回空配置（走 userData 回退）
  vi.doMock(path.join(__dirname, '..', 'user-data-service.js'), () => ({
    getPreferences: () => ({
      general: {},
      libraryRootPath: '',
    }),
  }))

  const express = (await import('express')).default
  const { registerLibraryRoutes } = await import('../services/library-routes.js')

  expressApp = express()
  expressApp.use(express.json({ limit: '10mb' }))
  registerLibraryRoutes(expressApp)

  await new Promise((resolve) => {
    server = expressApp.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
})

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve))
    server = null
  }
  // 清空临时目录
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  } catch {}
})

describe('library-routes — 文库 HTTP 端点', () => {
  it('GET /api/library/health 返回根目录与文档数', async () => {
    const res = await fetch(`${baseUrl}/api/library/health`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(typeof data.libraryRoot).toBe('string')
    expect(data.documents).toBe(0)
  })

  it('POST /api/library/analyze 提取标题、路径、标签、摘要', async () => {
    const content = [
      '# 周报 2026 Q3',
      '',
      '本周完成了 WPX 编辑器优化与文库重构方案。',
      '- 解决了 saveDocument "Failed to fetch" 问题',
      '- 集成 hermes gateway',
    ].join('\n')

    const res = await fetch(`${baseUrl}/api/library/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title: '' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('周报 2026 Q3')
    expect(data.path).toBe('工作/周报')
    expect(data.tags).toContain('周报')
    expect(typeof data.summary).toBe('string')
    expect(data.summary.length).toBeGreaterThan(0)
  })

  it('POST /api/library/save 支持 format=txt 纯文本落盘', async () => {
    const res = await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '纯文本笔记',
        content: '这是纯文本内容',
        path: '知识库/笔记',
        tags: ['笔记'],
        summary: '',
        suggestedPath: '',
        format: 'txt',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.item.format).toBe('txt')
    expect(data.filePath.endsWith('.txt')).toBe(true)
    expect(fs.existsSync(data.filePath)).toBe(true)
    const written = fs.readFileSync(data.filePath, 'utf8')
    expect(written).toContain('这是纯文本内容')
    expect(written.startsWith('---')).toBe(false)
  })

  it('POST /api/library/save 支持 format=docx 的 base64 二进制落盘', async () => {
    const payload = Buffer.from('PK\x03\x04fake-docx').toString('base64')
    const res = await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Word 文档',
        content: '# 正文',
        path: '工作/方案',
        tags: [],
        summary: '',
        suggestedPath: '',
        format: 'docx',
        contentBase64: payload,
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.item.format).toBe('docx')
    expect(data.item.editable).toBe(false)
    expect(data.filePath.endsWith('.docx')).toBe(true)
    expect(fs.readFileSync(data.filePath).equals(Buffer.from(payload, 'base64'))).toBe(true)

    const openRes = await fetch(
      `${baseUrl}/api/library/document?relativePath=${encodeURIComponent(data.item.relativePath)}`,
    )
    expect(openRes.status).toBe(415)
  })

  it('POST /api/library/save 写入 frontmatter + body', async () => {
    const payload = {
      title: 'WPX Vite 构建优化计划',
      content: '# 概述\n\n优化 Vite 构建耗时与产物体积。',
      path: '技术/方案',
      tags: ['vite', '优化', '构建'],
      summary: '记录 Vite 构建优化的方案与目标指标',
      suggestedPath: '未分类',
    }

    const res = await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.item.title).toBe('WPX Vite 构建优化计划')
    expect(data.item.path).toBe('技术/方案')
    expect(data.item.tags).toEqual(['vite', '优化', '构建'])

    // 验证磁盘文件存在 + frontmatter 格式
    expect(fs.existsSync(data.filePath)).toBe(true)
    const written = fs.readFileSync(data.filePath, 'utf8')
    expect(written).toContain('---')
    expect(written).toContain('title: "WPX Vite 构建优化计划"')
    expect(written).toContain('path: 技术/方案')
    expect(written).toContain('tags: ["vite", "优化", "构建"]')
    expect(written).toContain('优化 Vite 构建耗时与产物体积')
  })

  it('GET /api/library/tree 在 save 后能列出已保存文档', async () => {
    await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '教案 A',
        content: '教案正文',
        path: '工作/方案',
        tags: ['教案'],
        summary: '',
        suggestedPath: '',
      }),
    })

    const res = await fetch(`${baseUrl}/api/library/tree`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(1)
    expect(data.tree.children.length).toBeGreaterThan(0)

    // 标签云至少包含 '教案'
    expect(data.tags.some((t) => t.tag === '教案')).toBe(true)
  })

  it('GET /api/library/search 按正文/标题/标签匹配', async () => {
    await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Vite 优化',
        content: '本文讨论 vite 构建优化与按需加载',
        path: '技术/API',
        tags: ['vite'],
        summary: '',
        suggestedPath: '',
      }),
    })

    const res = await fetch(`${baseUrl}/api/library/search?q=vite`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items.length).toBe(1)
    expect(data.items[0].title).toBe('Vite 优化')
    expect(data.items[0].snippet).toContain('vite')
  })

  it('GET /api/library/document 按相对路径取回内容', async () => {
    const saved = await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'README',
        content: '正文 body',
        path: '工作/笔记',
        tags: [],
        summary: 'summary',
        suggestedPath: '',
      }),
    })
    const savedData = await saved.json()

    const res = await fetch(
      `${baseUrl}/api/library/document?relativePath=${encodeURIComponent(savedData.item.relativePath)}`,
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('README')
    // 内容尾部保留一个换行符（save 写入时主动添加以保证 EOF 行为）
    expect(data.content.replace(/\n$/, '')).toBe('正文 body')
    expect(data.path).toBe('工作/笔记')
  })

  it('GET /api/library/document 对路径穿越做拦截', async () => {
    // ../package.json 经过 normalizePath 后 .. 段被剔除，
    // 落到的文件既不是 .md/.markdown/.txt 也不是真实文档，返回 404。
    const res = await fetch(
      `${baseUrl}/api/library/document?relativePath=${encodeURIComponent('../package.json')}`,
    )
    expect(res.status).toBe(404)
  })

  it('POST /api/library/save 重复标题时追加时间戳避免覆盖', async () => {
    const payload = {
      title: '同名文档',
      content: '第一条',
      path: '工作/笔记',
      tags: [],
      summary: '',
      suggestedPath: '',
    }
    const first = await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const firstData = await first.json()

    const second = await fetch(`${baseUrl}/api/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, content: '第二条' }),
    })
    const secondData = await second.json()

    expect(firstData.filePath).not.toBe(secondData.filePath)
    expect(fs.existsSync(firstData.filePath)).toBe(true)
    expect(fs.existsSync(secondData.filePath)).toBe(true)
  })
})