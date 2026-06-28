import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 单元测试：HTML 文件导入工具
 *
 * - looksLikeHtml：检测字符串是否像 HTML
 * - extractHtmlFromClipboard：从 clipboardData 提取 text/html（>100 字符）
 * - detectHtmlInClipboard：HTML 检测布尔值
 * - getHtmlImportMeta：读取 doc.attrs 元数据
 * - hasHtmlImport：是否存在 htmlSource
 * - importHtmlString：写入文档 + 元数据 + 大小阈值
 * - clearHtmlAttrs：清除元数据
 * - restoreFromHtmlSource：从 htmlSource 重新渲染
 * - getFormatState：读取最近排版状态
 */

import {
  looksLikeHtml,
  extractHtmlFromClipboard,
  detectHtmlInClipboard,
  getHtmlImportMeta,
  hasHtmlImport,
  importHtmlString,
  clearHtmlAttrs,
  restoreFromHtmlSource,
  getFormatState,
} from '@/composables/useHtmlImporter'

/**
 * 构造一个最小的 mock editor。
 * - state.doc.attrs 可读写
 * - commands.setContent / setHtmlSource / clearHtmlSource / setFormatState 调用会被记录
 */
function buildMockEditor(initialAttrs = {}) {
  const callLog = []
  const editor = {
    state: {
      doc: {
        attrs: { ...initialAttrs },
      },
    },
    commands: {
      setContent: vi.fn((content, opts) => {
        callLog.push({ method: 'setContent', content, opts })
        return true
      }),
      setHtmlSource: vi.fn((payload) => {
        callLog.push({ method: 'setHtmlSource', payload })
        Object.assign(editor.state.doc.attrs, payload)
        return true
      }),
      clearHtmlSource: vi.fn(() => {
        callLog.push({ method: 'clearHtmlSource' })
        editor.state.doc.attrs = {}
        return true
      }),
      setFormatState: vi.fn((payload) => {
        callLog.push({ method: 'setFormatState', payload })
        if (payload.templateId == null) {
          delete editor.state.doc.attrs.lastFormattedTemplate
          delete editor.state.doc.attrs.lastFormattedAt
        } else {
          editor.state.doc.attrs.lastFormattedTemplate = payload.templateId
          if (payload.formattedAt) {
            editor.state.doc.attrs.lastFormattedAt = payload.formattedAt
          }
        }
        return true
      }),
    },
  }
  return { editor, callLog }
}

describe('looksLikeHtml', () => {
  it('非字符串返回 false', () => {
    expect(looksLikeHtml(null)).toBe(false)
    expect(looksLikeHtml(undefined)).toBe(false)
    expect(looksLikeHtml(42)).toBe(false)
  })

  it('空字符串返回 false', () => {
    expect(looksLikeHtml('')).toBe(false)
  })

  it('短字符串（< 16 字符）返回 false', () => {
    expect(looksLikeHtml('<p>hi</p>')).toBe(false) // 9 chars
    expect(looksLikeHtml('<h1>x</h1>')).toBe(false) // 9 chars
  })

  it('DOCTYPE html 开头识别为 HTML', () => {
    expect(looksLikeHtml('<!DOCTYPE html><html><body>x</body></html>')).toBe(true)
  })

  it('<html> 标签识别为 HTML', () => {
    expect(looksLikeHtml('<html lang="en"><body><p>content</p></body></html>')).toBe(true)
  })

  it('含完整 <tag>...</tag> 配对的 HTML 片段识别', () => {
    expect(looksLikeHtml('<p>this is a paragraph</p>')).toBe(true)
    expect(looksLikeHtml('<div><span>nested</span></div>')).toBe(true)
  })

  it('含多个自闭合标签（>=2 个）识别', () => {
    const html = '<br/><hr/><img src="x" alt="y"/>'
    expect(looksLikeHtml(html)).toBe(true)
  })

  it('纯文本返回 false', () => {
    expect(looksLikeHtml('this is just plain text content with no tags at all')).toBe(false)
  })
})

describe('extractHtmlFromClipboard / detectHtmlInClipboard', () => {
  it('null clipboardData 返回 null', () => {
    expect(extractHtmlFromClipboard(null)).toBeNull()
    expect(detectHtmlInClipboard(null)).toBe(false)
  })

  it('无 text/html 数据返回 null', () => {
    const cd = { getData: (type) => (type === 'text/plain' ? 'plain text' : '') }
    expect(extractHtmlFromClipboard(cd)).toBeNull()
    expect(detectHtmlInClipboard(cd)).toBe(false)
  })

  it('text/html 长度 <= 100 视为非 HTML（避免误判）', () => {
    const cd = { getData: (type) => (type === 'text/html' ? '<p>tiny</p>' : '') }
    expect(extractHtmlFromClipboard(cd)).toBeNull()
    expect(detectHtmlInClipboard(cd)).toBe(false)
  })

  it('text/html 长度 > 100 返回原始内容', () => {
    const html = '<p>' + 'a'.repeat(150) + '</p>'
    const cd = { getData: (type) => (type === 'text/html' ? html : '') }
    expect(extractHtmlFromClipboard(cd)).toBe(html)
    expect(detectHtmlInClipboard(cd)).toBe(true)
  })

  it('clipboardData.getData 抛错时返回 null', () => {
    const cd = {
      getData: () => {
        throw new Error('security error')
      },
    }
    expect(extractHtmlFromClipboard(cd)).toBeNull()
  })
})

describe('getHtmlImportMeta / hasHtmlImport', () => {
  it('null editor 返回 null / false', () => {
    expect(getHtmlImportMeta(null)).toBeNull()
    expect(hasHtmlImport(null)).toBe(false)
  })

  it('editor 无 attrs 返回 null / false', () => {
    const { editor } = buildMockEditor({})
    expect(getHtmlImportMeta(editor)).toBeNull()
    expect(hasHtmlImport(editor)).toBe(false)
  })

  it('含 htmlSource 时返回完整元数据', () => {
    const { editor } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: 'https://example.com',
      importedAt: '2024-01-01T00:00:00Z',
      importSource: 'paste',
      lastFormattedTemplate: 'article',
      lastFormattedAt: '2024-01-01T00:01:00Z',
    })
    expect(hasHtmlImport(editor)).toBe(true)
    const meta = getHtmlImportMeta(editor)
    expect(meta.htmlSource).toBe('<p>x</p>')
    expect(meta.sourceUrl).toBe('https://example.com')
    expect(meta.importedAt).toBe('2024-01-01T00:00:00Z')
    expect(meta.importSource).toBe('paste')
    expect(meta.lastFormattedTemplate).toBe('article')
  })
})

describe('importHtmlString', () => {
  let editor
  let callLog

  beforeEach(() => {
    const built = buildMockEditor()
    editor = built.editor
    callLog = built.callLog
  })

  it('null editor 返回错误', () => {
    const result = importHtmlString(null, '<p>x</p>')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('editor-unavailable')
  })

  it('空字符串返回错误', () => {
    const result = importHtmlString(editor, '')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('html-empty')
  })

  it('超 2MB 的 HTML 拒绝导入', () => {
    // 构造 ~2.1MB 字符串（每个字符按 UTF-16 占 2 字节，1.1M 字符 ≈ 2.2MB）
    const big = 'x'.repeat(1100000)
    const result = importHtmlString(editor, big)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('html-too-large')
  })

  it('正常导入：setContent + setHtmlSource 被调用', () => {
    const html = '<h1>Hello</h1><p>world</p>'
    const result = importHtmlString(editor, html, {
      sourceUrl: 'https://x.com',
      importSource: 'paste',
    })
    expect(result.ok).toBe(true)
    expect(result.htmlSource).toBe(html)
    expect(result.sourceUrl).toBe('https://x.com')
    expect(callLog.some((c) => c.method === 'setContent')).toBe(true)
    expect(callLog.some((c) => c.method === 'setHtmlSource')).toBe(true)
  })

  it('未传 importSource 时默认为 paste', () => {
    importHtmlString(editor, '<p>x</p>')
    const call = callLog.find((c) => c.method === 'setHtmlSource')
    expect(call.payload.importSource).toBe('paste')
  })

  it('未传 importedAt 时填入 ISO 时间戳', () => {
    importHtmlString(editor, '<p>x</p>')
    const call = callLog.find((c) => c.method === 'setHtmlSource')
    expect(call.payload.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('editor.commands.setContent 抛错时返回错误', () => {
    editor.commands.setContent = vi.fn(() => {
      throw new Error('parse-fail')
    })
    const result = importHtmlString(editor, '<p>x</p>')
    expect(result.ok).toBe(false)
    expect(result.message).toContain('HTML 解析失败')
  })
})

describe('clearHtmlAttrs', () => {
  it('null editor 返回 { ok: false }', () => {
    const result = clearHtmlAttrs(null)
    expect(result.ok).toBe(false)
  })

  it('调用 editor.commands.clearHtmlSource 并清空 attrs', () => {
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: 'https://x.com',
    })
    const result = clearHtmlAttrs(editor)
    expect(result.ok).toBe(true)
    expect(callLog.some((c) => c.method === 'clearHtmlSource')).toBe(true)
    expect(editor.state.doc.attrs).toEqual({})
  })

  it('editor 抛错时返回 { ok: false }', () => {
    const { editor } = buildMockEditor()
    editor.commands.clearHtmlSource = vi.fn(() => {
      throw new Error('boom')
    })
    const result = clearHtmlAttrs(editor)
    expect(result.ok).toBe(false)
  })
})

describe('restoreFromHtmlSource', () => {
  it('null editor 返回错误', () => {
    const result = restoreFromHtmlSource(null, '<p>x</p>')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('editor-unavailable')
  })

  it('未传入 htmlSource 时从 doc.attrs.htmlSource 读取', () => {
    const html = '<p>original</p>'
    const { editor, callLog } = buildMockEditor({
      htmlSource: html,
      sourceUrl: 'https://x.com',
    })
    const result = restoreFromHtmlSource(editor)
    expect(result.ok).toBe(true)
    const setContentCall = callLog.find((c) => c.method === 'setContent')
    expect(setContentCall.content).toBe(html)
  })

  it('显式传入 htmlSource 时优先使用参数', () => {
    const newHtml = '<p>override</p>'
    const { editor, callLog } = buildMockEditor({ htmlSource: '<p>old</p>' })
    const result = restoreFromHtmlSource(editor, newHtml)
    expect(result.ok).toBe(true)
    const setContentCall = callLog.find((c) => c.method === 'setContent')
    expect(setContentCall.content).toBe(newHtml)
  })

  it('doc.attrs.htmlSource 为空时返回错误', () => {
    const { editor } = buildMockEditor({})
    const result = restoreFromHtmlSource(editor)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no-html-source')
  })

  it('恢复后清空排版状态（lastFormattedTemplate）', () => {
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      lastFormattedTemplate: 'article',
      lastFormattedAt: '2024-01-01T00:01:00Z',
    })
    restoreFromHtmlSource(editor)
    const formatCall = callLog.find((c) => c.method === 'setFormatState')
    expect(formatCall).toBeTruthy()
    expect(formatCall.payload.templateId).toBeNull()
  })
})

describe('getFormatState', () => {
  it('null editor 返回 null', () => {
    expect(getFormatState(null)).toBeNull()
  })

  it('无 lastFormattedTemplate 返回 null', () => {
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    expect(getFormatState(editor)).toBeNull()
  })

  it('含 lastFormattedTemplate 返回完整状态', () => {
    const { editor } = buildMockEditor({
      htmlSource: '<p>x</p>',
      lastFormattedTemplate: 'article',
      lastFormattedAt: '2024-01-01T00:01:00Z',
    })
    const state = getFormatState(editor)
    expect(state).toBeTruthy()
    expect(state.templateId).toBe('article')
    expect(state.formattedAt).toBe('2024-01-01T00:01:00Z')
    expect(state.htmlSource).toBe('<p>x</p>')
  })
})
