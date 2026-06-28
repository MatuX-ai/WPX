import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 单元测试：HTML 智能排版引擎
 *
 * - formatImportTime：ISO 时间格式化
 * - formatHtmlDocument：核心入口（含错误分支）
 * - hasHtmlImportMeta / readHtmlImportMeta：纯封装
 *
 * 注：formatDocument 来自 useMarkdownFormatter，已被 useHtmlFormatter 内部使用，
 *     这里通过 mock editor 间接验证 formatDocument 被调用。
 */

import {
  formatImportTime,
  formatHtmlDocument,
  hasHtmlImportMeta,
  readHtmlImportMeta,
} from '@/composables/useHtmlFormatter'

/**
 * 构造 mock editor，含 HTML 源码场景。
 * - chain().focus().insertContentAt(pos, html, opts).run() 被记录
 * - commands.setFormatState / setContent 被记录
 * - state.doc.attrs / state.doc.descendants 被 mock
 */
function buildMockEditor({ attrs = {}, descendants = [] } = {}) {
  const callLog = []
  const chainInstance = {
    focus: vi.fn(() => chainInstance),
    insertContentAt: vi.fn((pos, html, opts) => {
      callLog.push({ method: 'insertContentAt', pos, html, opts })
      return chainInstance
    }),
    run: vi.fn(() => {
      callLog.push({ method: 'run' })
      return true
    }),
  }

  // 模拟 editor.commands.command：useMarkdownFormatter.formatDocument 内部会通过这个命令
  // 调用回调，回调里 tr 上的 setNodeMarkup 会被记录。这里使用 noop tr，保证回调不报错。
  const mockTr = {
    setNodeMarkup: vi.fn(() => mockTr),
    setNodeAttribute: vi.fn(() => mockTr),
    addMark: vi.fn(() => mockTr),
    removeMark: vi.fn(() => mockTr),
  }
  const commandMock = vi.fn((cb) => {
    return cb({ tr: mockTr, dispatch: () => true })
  })

  const editor = {
    state: {
      doc: {
        attrs: { ...attrs },
        descendants: (cb) => {
          for (let i = 0; i < descendants.length; i += 1) {
            cb(descendants[i], i + 1)
          }
        },
        nodeAt: (pos) => descendants[pos - 1] || null,
      },
    },
    chain: vi.fn(() => chainInstance),
    commands: {
      setContent: vi.fn(),
      command: commandMock,
      setFormatState: vi.fn((payload) => {
        callLog.push({ method: 'setFormatState', payload })
        if (payload.templateId != null) {
          editor.state.doc.attrs.lastFormattedTemplate = payload.templateId
          editor.state.doc.attrs.lastFormattedAt = payload.formattedAt
        }
        return true
      }),
    },
  }
  return { editor, callLog, chainInstance }
}

describe('formatImportTime', () => {
  it('空值返回空字符串', () => {
    expect(formatImportTime(null)).toBe('')
    expect(formatImportTime(undefined)).toBe('')
    expect(formatImportTime('')).toBe('')
  })

  it('非法字符串回退到原字符串', () => {
    expect(formatImportTime('not-a-date')).toBe('not-a-date')
  })

  it('合法 ISO 字符串格式化为 YYYY-MM-DD HH:MM', () => {
    const out = formatImportTime('2024-06-15T10:30:00Z')
    // 视测试环境时区，至少应匹配前 10 位的日期
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})

describe('formatHtmlDocument - 错误分支', () => {
  it('null editor 返回错误', () => {
    const result = formatHtmlDocument(null, 'article')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('editor-unavailable')
  })

  it('编辑器无 htmlSource 返回错误', () => {
    const { editor } = buildMockEditor({ attrs: {} })
    const result = formatHtmlDocument(editor, 'article')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no-html-source')
  })

  it('未知模板 id 返回错误', () => {
    const { editor } = buildMockEditor({
      attrs: { htmlSource: '<p>x</p>' },
    })
    const result = formatHtmlDocument(editor, 'not-exist')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('template-not-found')
  })
})

describe('formatHtmlDocument - 正常路径', () => {
  let editor
  let callLog
  let chainInstance

  beforeEach(() => {
    const built = buildMockEditor({
      attrs: {
        htmlSource: '<p>content</p>',
        sourceUrl: 'https://example.com',
        importedAt: '2024-06-15T10:30:00Z',
        importSource: 'paste',
      },
    })
    editor = built.editor
    callLog = built.callLog
    chainInstance = built.chainInstance
  })

  it('article 模板：调用 setFormatState 标记排版完成', () => {
    const result = formatHtmlDocument(editor, 'article')
    expect(result.ok).toBe(true)
    expect(result.templateId).toBe('article')
    expect(result.templateLabel).toBeTruthy()
    const formatCall = callLog.find((c) => c.method === 'setFormatState')
    expect(formatCall).toBeTruthy()
    expect(formatCall.payload.templateId).toBe('article')
  })

  it('article 模板：不插入来源信息块（默认行为）', () => {
    formatHtmlDocument(editor, 'article')
    expect(callLog.find((c) => c.method === 'insertContentAt')).toBeUndefined()
  })

  it('webpage-archive 模板：自动插入「来源信息块」到文档开头', () => {
    formatHtmlDocument(editor, 'webpage-archive')
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall).toBeTruthy()
    expect(insertCall.pos).toBe(0)
    expect(insertCall.html).toContain('来源：')
    expect(insertCall.html).toContain('https://example.com')
    expect(insertCall.html).toContain('抓取时间：')
    expect(insertCall.html).toContain('粘贴导入')
    expect(insertCall.html).toContain('<hr />')
  })

  it('article + insertWebpageHeader:true 时显式插入来源信息块', () => {
    formatHtmlDocument(editor, 'article', { insertWebpageHeader: true })
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall).toBeTruthy()
    expect(insertCall.html).toContain('来源：')
  })

  it('article + generateHeader:true 时也插入来源信息块', () => {
    formatHtmlDocument(editor, 'article', { generateHeader: true })
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall).toBeTruthy()
  })

  it('报告模板 (report) 不插入来源信息块', () => {
    formatHtmlDocument(editor, 'report')
    expect(callLog.find((c) => c.method === 'insertContentAt')).toBeUndefined()
  })

  it('webpage-archive 的来源信息块对 sourceUrl 做 HTML 转义', () => {
    const built = buildMockEditor({
      attrs: {
        htmlSource: '<p>x</p>',
        sourceUrl: 'https://x.com/?a=1&b=<script>',
        importedAt: '2024-06-15T10:30:00Z',
        importSource: 'paste',
      },
    })
    formatHtmlDocument(built.editor, 'webpage-archive')
    const insertCall = built.callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).not.toContain('<script>')
    expect(insertCall.html).toContain('&lt;script&gt;')
    expect(insertCall.html).toContain('&amp;')
  })

  it('sourceUrl 缺失时显示「（未指定）」', () => {
    const built = buildMockEditor({
      attrs: {
        htmlSource: '<p>x</p>',
        importedAt: '2024-06-15T10:30:00Z',
        importSource: 'paste',
      },
    })
    formatHtmlDocument(built.editor, 'webpage-archive')
    const insertCall = built.callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).toContain('（未指定）')
  })

  it('importSource 为 file 时显示「文件导入」', () => {
    const built = buildMockEditor({
      attrs: {
        htmlSource: '<p>x</p>',
        sourceUrl: 'https://x.com',
        importedAt: '2024-06-15T10:30:00Z',
        importSource: 'file',
      },
    })
    formatHtmlDocument(built.editor, 'webpage-archive')
    const insertCall = built.callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).toContain('文件导入')
  })

  it('hasImages=true 含 image 节点', () => {
    const built = buildMockEditor({
      attrs: { htmlSource: '<p>x</p>' },
      descendants: [
        { isBlock: true, type: { name: 'image' }, attrs: {}, content: { size: 1 } },
      ],
    })
    const result = formatHtmlDocument(built.editor, 'article')
    expect(result.hasImages).toBe(true)
  })

  it('hasImages=false 无 image 节点', () => {
    const built = buildMockEditor({
      attrs: { htmlSource: '<p>x</p>' },
      descendants: [
        { isBlock: true, type: { name: 'paragraph' }, attrs: {}, content: { size: 1 } },
      ],
    })
    const result = formatHtmlDocument(built.editor, 'article')
    expect(result.hasImages).toBe(false)
  })

  it('返回 message 包含模板 label', () => {
    const result = formatHtmlDocument(editor, 'webpage-archive')
    expect(result.message).toContain('网页存档')
  })

  it('成功消息格式：✅ 已按【XX】格式排版', () => {
    const result = formatHtmlDocument(editor, 'article')
    expect(result.message).toMatch(/已按.+格式排版/)
  })
})

describe('hasHtmlImportMeta / readHtmlImportMeta', () => {
  it('hasHtmlImportMeta 是 hasHtmlImport 的封装', () => {
    const { editor } = buildMockEditor({ attrs: { htmlSource: '<p>x</p>' } })
    expect(hasHtmlImportMeta(editor)).toBe(true)
    expect(hasHtmlImportMeta(null)).toBe(false)
  })

  it('readHtmlImportMeta 返回完整元数据', () => {
    const { editor } = buildMockEditor({
      attrs: {
        htmlSource: '<p>x</p>',
        sourceUrl: 'https://x.com',
        importedAt: '2024-06-15T10:30:00Z',
        importSource: 'paste',
      },
    })
    const meta = readHtmlImportMeta(editor)
    expect(meta.htmlSource).toBe('<p>x</p>')
    expect(meta.sourceUrl).toBe('https://x.com')
    expect(meta.importedAt).toBe('2024-06-15T10:30:00Z')
    expect(meta.importSource).toBe('paste')
  })

  it('无元数据时 readHtmlImportMeta 返回 null', () => {
    const { editor } = buildMockEditor({ attrs: {} })
    expect(readHtmlImportMeta(editor)).toBeNull()
  })
})
