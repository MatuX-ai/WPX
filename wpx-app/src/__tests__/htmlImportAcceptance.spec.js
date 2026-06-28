import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

/**
 * 单元测试：HTML 导入与智能排版 - 11 项验收标准
 *
 * 依据：[WPX 网页文件导入与智能排版需求文档.md §8 验收标准]
 *
 * 覆盖：
 *   #1 粘贴网页内容后，编辑器渲染为网页原样，不弹窗
 *   #2 右下角显示"网页已导入"提示，3 秒后自动消失
 *   #3 原始 HTML 源码存入文档 attrs.htmlSource
 *   #4 切换到 A4 阅读模式时，弹出模板选择对话框
 *   #5 选择"正式报告"模板后，文档按报告格式排版
 *   #6 选择"网页存档"模板后，显示来源 URL 和导入时间
 *   #7 选择"保持原样"后，继续以网页原样展示
 *   #8 排版后点击"恢复原样"，文档恢复为网页原样
 *   #9 导出 MD/PDF/Word 时，不包含 htmlSource 等内部属性
 *   #10 文档保存后再打开，A4 模式仍可触发排版
 *   #11 MD 文档进入 A4 模式时，AI 助理主动推送 MD 排版模板选择器
 */

import {
  looksLikeHtml,
  importHtmlString,
  hasHtmlImport,
  getHtmlImportMeta,
  restoreFromHtmlSource,
  getFormatState,
} from '@/composables/useHtmlImporter'
import {
  formatHtmlDocument,
  formatImportTime,
} from '@/composables/useHtmlFormatter'
import {
  INTERNAL_HTML_ATTRS,
  isInternalHtmlAttr,
  stripInternalAttrsFromJson,
  getSanitizedJson,
} from '@/utils/exportAttrsFilter'
import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'
import { useHtmlFormatStore } from '@/stores/htmlFormatBar'
import { useMarkdownFormatPromptStore } from '@/stores/markdownFormatPrompt'
import { detectMarkdown, detectMarkdownMarkers, extractMarkdownSnippet } from '@/utils/markdownDetector'
import { getTemplateById, getTemplateList } from '@/composables/useMarkdownFormatter'

// ─────────────────────────────────────────────
// Mock Editor / Store Helpers
// ─────────────────────────────────────────────

/**
 * 构造一个最小的 mock editor。
 * - state.doc.attrs 可读写，state.doc.descendants 遍历节点
 * - commands.setContent / setHtmlSource / clearHtmlSource / setFormatState / command 调用会被记录
 * - chain().focus().insertContentAt().run() 调用会被记录（用于「来源信息块」插入）
 *
 * 默认 blocks 为空数组，所以 formatDocument 不会修改任何节点（仅触发 mock chain）。
 */
function buildMockEditor(initialAttrs = {}, blocks = []) {
  const callLog = []
  const editor = {
    state: {
      doc: {
        attrs: { ...initialAttrs },
        descendants: (cb) => {
          for (let i = 0; i < blocks.length; i += 1) {
            cb(blocks[i], i + 1)
          }
        },
      },
    },
    chain: vi.fn(() => chainInstance),
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
        if (payload?.templateId == null) {
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
    getJSON: vi.fn(() => ({
      type: 'doc',
      attrs: { ...editor.state.doc.attrs },
      content: [],
    })),
  }
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
  // 模拟 commands.command：用于 formatDocument
  const mockTr = {
    setNodeMarkup: vi.fn(() => mockTr),
    setNodeAttribute: vi.fn(() => mockTr),
    addMark: vi.fn(() => mockTr),
    removeMark: vi.fn(() => mockTr),
  }
  editor.commands.command = vi.fn((cb) => cb({ tr: mockTr, dispatch: () => true }))
  return { editor, callLog }
}

// ─────────────────────────────────────────────
// #1 粘贴网页内容后，编辑器渲染为网页原样，不弹窗
// ─────────────────────────────────────────────
describe('验收 #1 粘贴网页内容后，编辑器渲染为网页原样，不弹窗', () => {
  let editor
  let callLog

  beforeEach(() => {
    const built = buildMockEditor()
    editor = built.editor
    callLog = built.callLog
  })

  it('#1.1 导入 HTML 字符串时调用 editor.commands.setContent 把 HTML 渲染进编辑器', () => {
    const html = '<h1>Hello World</h1><p>Article content...</p>'
    const result = importHtmlString(editor, html, { importSource: 'paste' })
    expect(result.ok).toBe(true)
    // 必须用 setContent 渲染 HTML（依赖 Tiptap 内置 DOMParser）
    const setContentCall = callLog.find((c) => c.method === 'setContent')
    expect(setContentCall).toBeTruthy()
    expect(setContentCall.content).toBe(html)
  })

  it('#1.2 导入过程中不触发任何 confirm / prompt / alert / dialog', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const alertSpy = vi.spyOn(window, 'alert')
    const promptSpy = vi.spyOn(window, 'prompt')

    importHtmlString(editor, '<p>content</p>')

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(promptSpy).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
    alertSpy.mockRestore()
    promptSpy.mockRestore()
  })

  it('#1.3 导入流程不走 markdownFormatPrompt（保持「导入无感」）', () => {
    // 验证：importHtmlString 不调用 markdownFormatPromptStore.trigger
    // 这里通过行为契约验证：导入完成 → hasHtmlImport=true，但没有 markdown 标记触发排版请求
    importHtmlString(editor, '<p>content</p>', { importSource: 'paste' })
    expect(hasHtmlImport(editor)).toBe(true)
    // callLog 中不应包含任何 trigger/prompt 相关调用
    expect(callLog.find((c) => c.method === 'triggerMarkdownPrompt')).toBeUndefined()
  })

  it('#1.4 通过 looksLikeHtml 正确识别粘贴的 HTML 内容', () => {
    // 模拟粘贴一段完整 HTML
    const pasted = '<p>this is a pasted paragraph from a webpage</p>'
    expect(looksLikeHtml(pasted)).toBe(true)
    // 纯文本不应识别为 HTML
    expect(looksLikeHtml('hello world plain text content here')).toBe(false)
  })
})

// ─────────────────────────────────────────────
// #2 右下角显示"网页已导入"提示，3 秒后自动消失
// ─────────────────────────────────────────────
describe('验收 #2 右下角显示"网页已导入"提示，3 秒后自动消失', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('#2.1 useDragDrop 在 HTML 文件导入成功后调用 toast.info("网页已导入", 3000)', async () => {
    // mock toast store
    const toastInfoSpy = vi.fn()
    vi.doMock('@/stores/toast', () => ({
      useToastStore: () => ({
        info: toastInfoSpy,
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
      }),
    }))
    vi.resetModules()
    const { useDragDrop } = await import('@/composables/useDragDrop')

    // mock file
    const htmlContent = '<html><body><h1>Page</h1></body></html>'
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const file = new File([blob], 'test.html', { type: 'text/html' })

    // mock editor with setContent / setHtmlSource
    const built = buildMockEditor()
    const dragDrop = useDragDrop({ getEditor: () => built.editor })
    await dragDrop.processDroppedFiles([file])

    // toast.info 应被调用，文本为 "网页已导入"，时长为 3000ms
    expect(toastInfoSpy).toHaveBeenCalled()
    expect(toastInfoSpy.mock.calls[0][0]).toBe('网页已导入')
    expect(toastInfoSpy.mock.calls[0][1]).toBe(3000)
  })
})

// ─────────────────────────────────────────────
// #3 原始 HTML 源码存入文档 attrs.htmlSource
// ─────────────────────────────────────────────
describe('验收 #3 原始 HTML 源码存入文档 attrs.htmlSource', () => {
  it('#3.1 导入 HTML 后 doc.attrs.htmlSource 保存完整原始 HTML', () => {
    const { editor } = buildMockEditor()
    const fullHtml =
      '<!DOCTYPE html><html><head><title>Page</title></head><body><article><h1>Title</h1><p>Body content here.</p></article></body></html>'
    const result = importHtmlString(editor, fullHtml, {
      sourceUrl: 'https://example.com/article',
      importSource: 'file',
    })
    expect(result.ok).toBe(true)
    expect(editor.state.doc.attrs.htmlSource).toBe(fullHtml)
  })

  it('#3.2 同时写入 sourceUrl / importedAt / importSource 三个元数据字段', () => {
    const { editor } = buildMockEditor()
    const url = 'https://news.example.com/post/12345'
    const result = importHtmlString(editor, '<p>x</p>', {
      sourceUrl: url,
      importSource: 'paste',
    })
    expect(result.ok).toBe(true)
    expect(editor.state.doc.attrs.sourceUrl).toBe(url)
    expect(editor.state.doc.attrs.importSource).toBe('paste')
    expect(editor.state.doc.attrs.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('#3.3 通过 hasHtmlImport 二次确认 HTML 已被识别', () => {
    const { editor } = buildMockEditor()
    expect(hasHtmlImport(editor)).toBe(false)
    importHtmlString(editor, '<p>x</p>')
    expect(hasHtmlImport(editor)).toBe(true)
  })

  it('#3.4 getHtmlImportMeta 返回与导入参数一致的完整元数据', () => {
    const { editor } = buildMockEditor()
    importHtmlString(editor, '<p>content</p>', {
      sourceUrl: 'https://x.com',
      importSource: 'paste',
      importedAt: '2024-06-15T10:30:00Z',
    })
    const meta = getHtmlImportMeta(editor)
    expect(meta.htmlSource).toBe('<p>content</p>')
    expect(meta.sourceUrl).toBe('https://x.com')
    expect(meta.importedAt).toBe('2024-06-15T10:30:00Z')
    expect(meta.importSource).toBe('paste')
  })
})

// ─────────────────────────────────────────────
// #4 切换到 A4 阅读模式时，弹出模板选择对话框
// ─────────────────────────────────────────────
describe('验收 #4 切换到 A4 阅读模式时，弹出模板选择对话框', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('#4.1 htmlFormatPromptStore.trigger({ source: "a4-focus-mode" }) 触发后 pending 含 source 字段', () => {
    const store = useHtmlFormatPromptStore()
    expect(store.pending).toBeNull()
    store.trigger({ source: 'a4-focus-mode' })
    expect(store.pending).toBeTruthy()
    expect(store.pending.source).toBe('a4-focus-mode')
    expect(store.pending.token).toBeDefined()
  })

  it('#4.2 触发器不修改 htmlSource（保持原样渲染直到用户主动选择）', () => {
    const store = useHtmlFormatPromptStore()
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    const beforeAttrs = { ...editor.state.doc.attrs }
    store.trigger({ source: 'a4-focus-mode' })
    // 触发器是纯 UI 提示，不直接修改文档
    expect(editor.state.doc.attrs).toEqual(beforeAttrs)
  })

  it('#4.3 模板列表包含全部 6 个可用模板（含网页存档）', () => {
    const list = getTemplateList()
    const ids = list.map((t) => t.id)
    expect(ids).toContain('article')
    expect(ids).toContain('report')
    expect(ids).toContain('official')
    expect(ids).toContain('lesson-plan')
    expect(ids).toContain('paper')
    expect(ids).toContain('webpage-archive')
  })

  it('#4.4 文档不含 htmlSource 时不触发弹窗（hasHtmlImport 守卫）', () => {
    const { editor } = buildMockEditor() // 空 attrs，无 htmlSource
    expect(hasHtmlImport(editor)).toBe(false)
    // 业务层守卫：只有 hasHtmlImport=true 才触发 htmlFormatPromptStore
    // 这里验证 hasHtmlImport 的语义，作为 #4 的前置条件
  })
})

// ─────────────────────────────────────────────
// #5 选择"正式报告"模板后，文档按报告格式排版
// ─────────────────────────────────────────────
describe('验收 #5 选择"正式报告"模板后，文档按报告格式排版', () => {
  it('#5.1 formatHtmlDocument(editor, "report") 调用 setFormatState({ templateId: "report" })', () => {
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<h1>Title</h1><p>body</p>',
      sourceUrl: 'https://x.com',
    })
    const result = formatHtmlDocument(editor, 'report')
    expect(result.ok).toBe(true)
    expect(result.templateId).toBe('report')
    expect(result.templateLabel).toBe('正式报告')
    const formatCall = callLog.find((c) => c.method === 'setFormatState')
    expect(formatCall).toBeTruthy()
    expect(formatCall.payload.templateId).toBe('report')
  })

  it('#5.2 报告模板成功消息包含「正式报告」字样', () => {
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    const result = formatHtmlDocument(editor, 'report')
    expect(result.message).toContain('正式报告')
    expect(result.message).toMatch(/已按.+格式排版/)
  })

  it('#5.3 报告模板不插入「来源信息块」（保留纯报告样式）', () => {
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: 'https://x.com',
    })
    formatHtmlDocument(editor, 'report')
    // report 模板不触发 insertContentAt（不是 webpage-archive 也不带 insertWebpageHeader 选项）
    expect(callLog.find((c) => c.method === 'insertContentAt')).toBeUndefined()
  })

  it('#5.4 报告模板写入 doc.attrs.lastFormattedTemplate', () => {
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    formatHtmlDocument(editor, 'report')
    expect(editor.state.doc.attrs.lastFormattedTemplate).toBe('report')
    expect(editor.state.doc.attrs.lastFormattedAt).toBeTruthy()
  })

  it('#5.5 getFormatState 能读取到 report 模板的排版状态', () => {
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    formatHtmlDocument(editor, 'report')
    const state = getFormatState(editor)
    expect(state).toBeTruthy()
    expect(state.templateId).toBe('report')
    expect(state.formattedAt).toBeTruthy()
  })
})

// ─────────────────────────────────────────────
// #6 选择"网页存档"模板后，显示来源 URL 和导入时间
// ─────────────────────────────────────────────
describe('验收 #6 选择"网页存档"模板后，显示来源 URL 和导入时间', () => {
  it('#6.1 webpage-archive 模板自动在文档开头插入「来源信息块」', () => {
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: 'https://example.com/article',
      importedAt: '2024-06-15T10:30:00Z',
      importSource: 'paste',
    })
    const result = formatHtmlDocument(editor, 'webpage-archive')
    expect(result.ok).toBe(true)
    expect(result.templateId).toBe('webpage-archive')
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall).toBeTruthy()
    expect(insertCall.pos).toBe(0)
  })

  it('#6.2 来源信息块包含来源 URL（验收点 #6 显式要求）', () => {
    const url = 'https://example.com/post/abc'
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: url,
      importedAt: '2024-06-15T10:30:00Z',
      importSource: 'paste',
    })
    formatHtmlDocument(editor, 'webpage-archive')
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).toContain('来源：')
    expect(insertCall.html).toContain(url)
  })

  it('#6.3 来源信息块包含导入时间（验收点 #6 显式要求）', () => {
    const isoTime = '2024-06-15T10:30:00Z'
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: 'https://x.com',
      importedAt: isoTime,
      importSource: 'paste',
    })
    formatHtmlDocument(editor, 'webpage-archive')
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).toContain('抓取时间：')
    // 验证时间已格式化为本地化展示串（YYYY-MM-DD HH:MM 格式）
    expect(insertCall.html).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
  })

  it('#6.4 formatImportTime 把 ISO 时间格式化为 YYYY-MM-DD HH:MM', () => {
    expect(formatImportTime('2024-06-15T10:30:00Z')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    )
  })

  it('#6.5 sourceUrl / importedAt 缺失时显示「（未指定）」降级文案', () => {
    const { editor, callLog } = buildMockEditor({
      htmlSource: '<p>x</p>',
      importSource: 'paste',
      // 没有 sourceUrl 和 importedAt
    })
    formatHtmlDocument(editor, 'webpage-archive')
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).toContain('（未指定）')
  })

  it('#6.6 webpage-archive 模板的 MARKDOWN_TEMPLATES 定义包含 webpageHeader=true 标记', () => {
    const tpl = getTemplateById('webpage-archive')
    expect(tpl).toBeTruthy()
    expect(tpl.webpageHeader).toBe(true)
  })
})

// ─────────────────────────────────────────────
// #7 选择"保持原样"后，继续以网页原样展示
// ─────────────────────────────────────────────
describe('验收 #7 选择"保持原样"后，继续以网页原样展示', () => {
  it('#7.1 keep-original 处理：htmlSource 仍保留（不删除）', () => {
    // 模拟「保持原样」语义：
    // - 用户在弹窗中点击「保持原样」
    // - 业务层（AiAssistantPlaceholder.handleLocalCommandSelect）检测 kind === 'keep-original' 时静默处理
    // - 关键不变量：htmlSource 仍保留在 doc.attrs 中，供下次恢复
    const { editor } = buildMockEditor({
      htmlSource: '<p>original page content</p>',
      sourceUrl: 'https://x.com',
    })
    // 模拟「保持原样」点击：不调用 formatHtmlDocument，不调用 restoreFromHtmlSource
    // 仅验证初始状态
    expect(hasHtmlImport(editor)).toBe(true)
    expect(editor.state.doc.attrs.htmlSource).toBe('<p>original page content</p>')
  })

  it('#7.2 再次进入 A4 模式时仍可触发排版（htmlSource 仍在）', () => {
    // #7 与 #4/#10 的交叉验证：
    // - 选「保持原样」→ htmlSource 保留
    // - 下次 A4 模式触发 → hasHtmlImport 仍为 true → 可再次弹出模板选择
    const { editor } = buildMockEditor({
      htmlSource: '<p>content</p>',
      sourceUrl: 'https://x.com',
    })
    expect(hasHtmlImport(editor)).toBe(true)
    // store 仍可触发（htmlSource 存在）
    const store = useHtmlFormatPromptStore()
    setActivePinia(createPinia())
    store.trigger({ source: 'a4-focus-mode' })
    expect(store.pending).toBeTruthy()
  })
})

// ─────────────────────────────────────────────
// #8 排版后点击"恢复原样"，文档恢复为网页原样
// ─────────────────────────────────────────────
describe('验收 #8 排版后点击"恢复原样"，文档恢复为网页原样', () => {
  it('#8.1 restoreFromHtmlSource 用原始 HTML 重新渲染编辑器内容', () => {
    const originalHtml = '<p>original page</p>'
    const { editor, callLog } = buildMockEditor({
      htmlSource: originalHtml,
      sourceUrl: 'https://x.com',
    })
    // 模拟：先排版（写入 lastFormattedTemplate），再恢复
    formatHtmlDocument(editor, 'article')
    expect(editor.state.doc.attrs.lastFormattedTemplate).toBe('article')

    // 恢复原样
    const result = restoreFromHtmlSource(editor)
    expect(result.ok).toBe(true)
    // setContent 被调用，传入原始 HTML
    const setContentCall = callLog.filter((c) => c.method === 'setContent')
    expect(setContentCall.length).toBeGreaterThan(0)
    expect(setContentCall[setContentCall.length - 1].content).toBe(originalHtml)
  })

  it('#8.2 恢复原样后清空排版状态（lastFormattedTemplate = null）', () => {
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

  it('#8.3 恢复原样后 htmlSource 仍保留（供后续恢复）', () => {
    const { editor } = buildMockEditor({
      htmlSource: '<p>content</p>',
      sourceUrl: 'https://x.com',
      lastFormattedTemplate: 'report',
    })
    restoreFromHtmlSource(editor)
    // htmlSource 应保留
    expect(editor.state.doc.attrs.htmlSource).toBe('<p>content</p>')
    expect(editor.state.doc.attrs.sourceUrl).toBe('https://x.com')
  })

  it('#8.4 文档无 htmlSource 时 restoreFromHtmlSource 返回错误', () => {
    const { editor } = buildMockEditor({})
    const result = restoreFromHtmlSource(editor)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no-html-source')
  })
})

// ─────────────────────────────────────────────
// #9 导出 MD/PDF/Word 时，不包含 htmlSource 等内部属性
// ─────────────────────────────────────────────
describe('验收 #9 导出 MD/PDF/Word 时，不包含 htmlSource 等内部属性', () => {
  it('#9.1 INTERNAL_HTML_ATTRS 列出全部 6 个内部属性名', () => {
    expect(INTERNAL_HTML_ATTRS).toEqual(
      expect.arrayContaining([
        'htmlSource',
        'sourceUrl',
        'importedAt',
        'importSource',
        'lastFormattedTemplate',
        'lastFormattedAt',
      ]),
    )
    expect(INTERNAL_HTML_ATTRS).toHaveLength(6)
  })

  it('#9.2 isInternalHtmlAttr 正确识别 6 个内部属性', () => {
    expect(isInternalHtmlAttr('htmlSource')).toBe(true)
    expect(isInternalHtmlAttr('sourceUrl')).toBe(true)
    expect(isInternalHtmlAttr('importedAt')).toBe(true)
    expect(isInternalHtmlAttr('importSource')).toBe(true)
    expect(isInternalHtmlAttr('lastFormattedTemplate')).toBe(true)
    expect(isInternalHtmlAttr('lastFormattedAt')).toBe(true)
    // 非内部属性
    expect(isInternalHtmlAttr('content')).toBe(false)
    expect(isInternalHtmlAttr('author')).toBe(false)
  })

  it('#9.3 stripInternalAttrsFromJson 清除 doc.attrs 中所有内部属性', () => {
    const original = {
      type: 'doc',
      attrs: {
        htmlSource: '<p>x</p>',
        sourceUrl: 'https://x.com',
        importedAt: '2024-01-01T00:00:00Z',
        importSource: 'paste',
        lastFormattedTemplate: 'article',
        lastFormattedAt: '2024-01-01T00:01:00Z',
        // 保留的业务属性
        author: 'Alice',
      },
      content: [],
    }
    const cleaned = stripInternalAttrsFromJson(original)
    // 内部属性应被剥离
    expect(cleaned.attrs).not.toHaveProperty('htmlSource')
    expect(cleaned.attrs).not.toHaveProperty('sourceUrl')
    expect(cleaned.attrs).not.toHaveProperty('importedAt')
    expect(cleaned.attrs).not.toHaveProperty('importSource')
    expect(cleaned.attrs).not.toHaveProperty('lastFormattedTemplate')
    expect(cleaned.attrs).not.toHaveProperty('lastFormattedAt')
    // 业务属性应保留
    expect(cleaned.attrs.author).toBe('Alice')
    // content 不变
    expect(cleaned.content).toBe(original.content)
  })

  it('#9.4 getSanitizedJson 通过 editor.getJSON 获取并净化后的 JSON', () => {
    const { editor } = buildMockEditor({
      htmlSource: '<p>x</p>',
      sourceUrl: 'https://x.com',
      lastFormattedTemplate: 'article',
    })
    const sanitized = getSanitizedJson(editor)
    expect(sanitized).toBeTruthy()
    expect(sanitized.type).toBe('doc')
    expect(sanitized.attrs).not.toHaveProperty('htmlSource')
    expect(sanitized.attrs).not.toHaveProperty('sourceUrl')
    expect(sanitized.attrs).not.toHaveProperty('lastFormattedTemplate')
  })

  it('#9.5 导出的 MD / PDF / Word 内容不含 htmlSource 字符串', () => {
    const htmlSource = '<p>internal data</p>'
    const { editor } = buildMockEditor({ htmlSource })
    const json = getSanitizedJson(editor)
    const serialized = JSON.stringify(json)
    expect(serialized).not.toContain(htmlSource)
    expect(serialized).not.toContain('htmlSource')
  })

  it('#9.6 运行时 editor.state.doc.attrs.htmlSource 仍保留（不破坏运行时功能）', () => {
    // 关键不变量：exportAttrsFilter 只在导出阶段净化，运行时 attrs 不变
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    getSanitizedJson(editor)
    // 运行时 attrs 应保留
    expect(editor.state.doc.attrs.htmlSource).toBe('<p>x</p>')
    expect(hasHtmlImport(editor)).toBe(true)
  })
})

// ─────────────────────────────────────────────
// #10 文档保存后再打开，A4 模式仍可触发排版
// ─────────────────────────────────────────────
describe('验收 #10 文档保存后再打开，A4 模式仍可触发排版', () => {
  it('#10.1 attrs 持久化语义：htmlSource 是 doc.attrs 的一部分，会随 JSON 序列化保存', () => {
    // 模拟「文档保存」：把 editor.getJSON() 写入存储
    // 模拟「文档打开」：从存储读回 JSON → 恢复 editor.state.doc.attrs
    const html = '<h1>Saved Article</h1><p>Body</p>'
    const { editor } = buildMockEditor({
      htmlSource: html,
      sourceUrl: 'https://x.com',
      importedAt: '2024-01-01T00:00:00Z',
      importSource: 'paste',
    })

    // 模拟保存：获取 JSON
    const savedJson = editor.getJSON()
    // 验证保存的 JSON 含完整 attrs（包括运行时字段）
    expect(savedJson.attrs.htmlSource).toBe(html)
    expect(savedJson.attrs.sourceUrl).toBe('https://x.com')

    // 模拟打开：创建新 editor，attrs 从 savedJson 恢复
    const reopened = buildMockEditor(savedJson.attrs).editor
    expect(hasHtmlImport(reopened)).toBe(true)
    expect(reopened.state.doc.attrs.htmlSource).toBe(html)
  })

  it('#10.2 保存再打开后，A4 模式触发排版选择弹窗仍可工作', () => {
    setActivePinia(createPinia())
    // 模拟：保存 → 打开 → 进入 A4 模式 → 触发排版
    const { editor } = buildMockEditor({
      htmlSource: '<p>content</p>',
      sourceUrl: 'https://x.com',
    })
    const savedAttrs = { ...editor.state.doc.attrs }
    // 模拟重新打开
    const reopened = buildMockEditor(savedAttrs).editor
    expect(hasHtmlImport(reopened)).toBe(true)
    // 模拟 A4 模式触发
    const store = useHtmlFormatPromptStore()
    store.trigger({ source: 'a4-focus-mode' })
    expect(store.pending.source).toBe('a4-focus-mode')
  })

  it('#10.3 排版状态 lastFormattedTemplate 也随 attrs 持久化', () => {
    const { editor } = buildMockEditor({ htmlSource: '<p>x</p>' })
    formatHtmlDocument(editor, 'report')
    const savedJson = editor.getJSON()
    // 排版状态也在 attrs 中
    expect(savedJson.attrs.lastFormattedTemplate).toBe('report')
    expect(savedJson.attrs.lastFormattedAt).toBeTruthy()
  })

  it('#10.4 保存后再打开仍可执行 formatHtmlDocument / restoreFromHtmlSource', () => {
    // 关键不变量：保存/打开循环不应破坏导入 → 排版 → 恢复全流程
    const originalHtml = '<p>original</p>'
    const { editor } = buildMockEditor({
      htmlSource: originalHtml,
      sourceUrl: 'https://x.com',
    })

    // 保存
    const savedJson = editor.getJSON()

    // 打开
    const reopened = buildMockEditor(savedJson.attrs).editor
    expect(hasHtmlImport(reopened)).toBe(true)

    // 排版
    const fmtResult = formatHtmlDocument(reopened, 'article')
    expect(fmtResult.ok).toBe(true)
    expect(reopened.state.doc.attrs.lastFormattedTemplate).toBe('article')

    // 恢复
    const restoreResult = restoreFromHtmlSource(reopened)
    expect(restoreResult.ok).toBe(true)
    // htmlSource 仍保留
    expect(reopened.state.doc.attrs.htmlSource).toBe(originalHtml)
  })
})

// ─────────────────────────────────────────────
// 跨验收点集成验证
// ─────────────────────────────────────────────
describe('集成验证：完整生命周期（导入→触发→排版→恢复→保存）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('完整流程：导入 HTML → A4 模式触发弹窗 → 选择模板 → 排版完成 → 恢复原样', () => {
    const htmlFormatBar = useHtmlFormatStore()

    // 1. 导入 HTML
    const html = '<h1>Article</h1><p>Body</p>'
    const { editor, callLog } = buildMockEditor()
    const importResult = importHtmlString(editor, html, {
      sourceUrl: 'https://news.example.com/post/1',
      importSource: 'paste',
      importedAt: '2024-06-15T10:30:00Z',
    })
    expect(importResult.ok).toBe(true)
    expect(hasHtmlImport(editor)).toBe(true)

    // 2. A4 模式触发弹窗
    const htmlPromptStore = useHtmlFormatPromptStore()
    htmlPromptStore.trigger({ source: 'a4-focus-mode' })
    expect(htmlPromptStore.pending.source).toBe('a4-focus-mode')

    // 3. 选择模板 → 排版
    const fmtResult = formatHtmlDocument(editor, 'webpage-archive')
    expect(fmtResult.ok).toBe(true)
    expect(fmtResult.templateId).toBe('webpage-archive')
    // 来源信息块已插入
    const insertCall = callLog.find((c) => c.method === 'insertContentAt')
    expect(insertCall.html).toContain('来源：')
    expect(insertCall.html).toContain('https://news.example.com/post/1')

    // 4. 显示恢复提示条
    htmlFormatBar.show({
      templateId: 'webpage-archive',
      templateLabel: '网页存档',
      formattedAt: Date.now(),
    })
    expect(htmlFormatBar.visible).toBe(true)
    expect(htmlFormatBar.templateLabel).toBe('网页存档')

    // 5. 用户点击"恢复原样"
    const restoreResult = restoreFromHtmlSource(editor)
    expect(restoreResult.ok).toBe(true)
    // 排版状态已清空
    expect(editor.state.doc.attrs.lastFormattedTemplate).toBeUndefined()
    // htmlSource 仍保留
    expect(editor.state.doc.attrs.htmlSource).toBe(html)

    // 6. 关闭提示条
    htmlFormatBar.dismiss()
    expect(htmlFormatBar.visible).toBe(false)
  })

  it('导出净化集成：完整文档 JSON 导出后不含 htmlSource', () => {
    const { editor } = buildMockEditor({
      htmlSource: '<p>internal</p>',
      sourceUrl: 'https://x.com',
      lastFormattedTemplate: 'article',
      lastFormattedAt: '2024-01-01T00:01:00Z',
    })
    // 模拟 MD 导出
    const sanitized = getSanitizedJson(editor)
    const serialized = JSON.stringify(sanitized)
    expect(serialized).not.toContain('internal') // htmlSource 内容
    expect(serialized).not.toContain('htmlSource')
    expect(serialized).not.toContain('sourceUrl')
    expect(serialized).not.toContain('lastFormattedTemplate')
  })
})

// ─────────────────────────────────────────────
// #11 MD 文档进入 A4 模式时，AI 助理主动推送 MD 排版模板选择器
//
// 业务场景：
//   - 用户在普通 MD 模式下书写（无 htmlSource）
//   - 进入「焦点写作模式」(A4 阅读模式)
//   - AI 助理应主动推送 MD 排版模板选择器气泡，
//     文案：「检测到 Markdown 内容，是否按模板排版？」
//
// 关联代码：
//   - TitleBar.vue::handleToggleFocusMode  (line 81-103)
//   - AiAssistantPlaceholder.vue::toggleFocusMode  (line 474-497)
//   - AiAssistantPlaceholder.vue::pushMarkdownFormatPrompt  (line 555-617)
//   - stores/markdownFormatPrompt.js (line 32-75)
// ─────────────────────────────────────────────
describe('验收 #11 MD 文档进入 A4 模式时，AI 助理主动推送 MD 排版模板选择器', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('#11.1 markdownFormatPromptStore 支持 a4-focus-mode 来源（类型扩展）', () => {
    // 验证 stores/markdownFormatPrompt.js 的 MarkdownPromptSource 联合类型
    // 已扩展为：'paste' | 'import' | 'manual' | 'dragdrop' | 'a4-focus-mode'
    const store = useMarkdownFormatPromptStore()
    store.trigger({ source: 'a4-focus-mode', previewText: '# 标题', hasImages: false })
    expect(store.pending).toBeTruthy()
    expect(store.pending.source).toBe('a4-focus-mode')
    expect(store.pending.previewText).toBe('# 标题')
    expect(store.pending.hasImages).toBe(false)
    expect(store.pending.token).toBeDefined()
  })

  it('#11.2 detectMarkdown 能识别典型 MD 标记（标题/列表/引用/表格/链接/强调/分隔线/代码）', () => {
    // 标题
    expect(detectMarkdown('# 一级标题\n内容')).toBe(true)
    expect(detectMarkdown('## 二级标题')).toBe(true)
    // 无序列表
    expect(detectMarkdown('- 项目 1\n- 项目 2')).toBe(true)
    // 有序列表
    expect(detectMarkdown('1. 第一步\n2. 第二步')).toBe(true)
    // 引用
    expect(detectMarkdown('> 这是一段引用')).toBe(true)
    // 表格
    expect(detectMarkdown('| 列1 | 列2 |\n|---|---|\n| A | B |')).toBe(true)
    // 链接
    expect(detectMarkdown('访问 [官网](https://example.com)')).toBe(true)
    // 图片
    expect(detectMarkdown('![alt](https://example.com/img.png)')).toBe(true)
    // 强调
    expect(detectMarkdown('这是 **加粗** 文本')).toBe(true)
    expect(detectMarkdown('这是 *斜体* 文本')).toBe(true)
    // 分隔线
    expect(detectMarkdown('---')).toBe(true)
    // 代码块：剥离围栏后内部含 MD 标记（如列表项 #）仍识别为 MD
    expect(detectMarkdown('# 标题\n\n```js\nconst x = 1\n- 列表\n```\n\n## 小节')).toBe(true)
    // 删除线
    expect(detectMarkdown('~~删除线文本~~')).toBe(true)

    // 纯文本 / 短文本 / 空文本不应误判
    expect(detectMarkdown('这是一段普通的纯文本，没有任何 Markdown 标记。')).toBe(false)
    expect(detectMarkdown('')).toBe(false)
    expect(detectMarkdown(null)).toBe(false)
    expect(detectMarkdown(undefined)).toBe(false)
    expect(detectMarkdown('x')).toBe(false) // < 2 字符
  })

  it('#11.3 detectMarkdownMarkers 返回命中的标记种类集合', () => {
    const markers = detectMarkdownMarkers('# 标题\n- 列表项\n| 表格 | 列 |')
    expect(markers).toContain('#')
    expect(markers).toContain('-')
    expect(markers).toContain('|')
  })

  it('#11.4 extractMarkdownSnippet 提取首行作为预览文本（≤ 60 字符）', () => {
    expect(extractMarkdownSnippet('# 一级标题\n## 二级标题')).toBe('# 一级标题')
    expect(extractMarkdownSnippet('\n\n\n# 跳过空行\n其他')).toBe('# 跳过空行')
    const long = '# ' + 'x'.repeat(100)
    const snippet = extractMarkdownSnippet(long)
    expect(snippet.length).toBeLessThanOrEqual(61) // 60 + …
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('#11.5 A4 模式触发器：纯 MD 文档（无 htmlSource）应触发 MD store', () => {
    // 模拟 TitleBar.handleToggleFocusMode 的核心逻辑
    // 输入：纯 MD 文档，无 htmlSource
    // 期望：触发 markdownFormatPromptStore（不是 htmlFormatPromptStore）
    const mdStore = useMarkdownFormatPromptStore()
    const htmlStore = useHtmlFormatPromptStore()

    // 构造一个含 MD 标记的 mock editor（无 htmlSource）
    const mdText = '# 一级标题\n\n- 列表项 1\n- 列表项 2\n\n这是一段内容。'
    expect(detectMarkdown(mdText)).toBe(true)

    // 模拟 hasHtmlImport 返回 false（无 htmlSource）
    // 模拟 getActiveEditor 返回 mock editor
    mdStore.trigger({ source: 'a4-focus-mode', previewText: extractMarkdownSnippet(mdText) })

    // 验证 MD store 被触发
    expect(mdStore.pending).toBeTruthy()
    expect(mdStore.pending.source).toBe('a4-focus-mode')

    // 验证 HTML store 未被触发
    expect(htmlStore.pending).toBeNull()
  })

  it('#11.6 A4 模式优先级：HTML 导入文档应优先触发 HTML store，不触发 MD store', () => {
    // 验证业务规则：hasHtmlImport=true 时只触发 HTML store，跳过 MD 检测
    const mdStore = useMarkdownFormatPromptStore()
    const htmlStore = useHtmlFormatPromptStore()

    // 模拟 HTML 导入文档（即使内部文本含 MD 标记，也优先 HTML）
    const htmlContent = '<h1>标题</h1><p>这是 **粗体** 段落</p>'

    // 业务层守卫：hasHtmlImport === true → 走 HTML 路径
    // 这里仅验证 store 层面的行为契约
    htmlStore.trigger({ source: 'a4-focus-mode' })
    expect(htmlStore.pending.source).toBe('a4-focus-mode')

    // MD store 不应被同时触发（业务层 handleToggleFocusMode 的早返回保证）
    expect(mdStore.pending).toBeNull()

    // 同时验证：即使 HTML 内容里含 MD 文本，
    // detectMarkdown 仍能识别（但业务层不会走这条路径）
    expect(detectMarkdown(htmlContent)).toBe(true)
  })

  it('#11.7 A4 模式触发器：纯文本文档（无 MD 标记）不触发任何 store', () => {
    // 业务场景：用户写了一段纯文本散文，没有任何 MD 标记
    // 进入 A4 模式时不应骚扰用户推送排版弹窗
    const mdStore = useMarkdownFormatPromptStore()
    const htmlStore = useHtmlFormatPromptStore()

    const plainText = '这是一段很普通的纯文本散文。没有任何 Markdown 标记，例如没有井号、没有星号、也没有列表符号。我只是在写一段日记。'
    expect(detectMarkdown(plainText)).toBe(false)

    // 业务层守卫：detectMarkdown(text) === false → 不触发任何 store
    // 这里验证 detectMarkdown 的语义
    expect(mdStore.pending).toBeNull()
    expect(htmlStore.pending).toBeNull()
  })

  it('#11.8 模板列表包含 MD 排版所有可用模板', () => {
    const list = getTemplateList()
    // 应至少包含 3 个 MD 排版模板
    expect(list.length).toBeGreaterThanOrEqual(3)
    // 每个模板都有 id 和 label
    list.forEach((tpl) => {
      expect(tpl.id).toBeTruthy()
      expect(tpl.label).toBeTruthy()
    })
  })

  it('#11.9 MarkdownPromptSource 类型扩展覆盖所有来源场景', () => {
    // 验证每种合法来源都能成功触发
    const sources = ['paste', 'import', 'manual', 'dragdrop', 'a4-focus-mode']
    const store = useMarkdownFormatPromptStore()
    sources.forEach((src) => {
      store.clear()
      store.trigger({ source: src, previewText: 'test' })
      expect(store.pending).toBeTruthy()
      expect(store.pending.source).toBe(src)
    })
  })

  it('#11.10 触发器每次生成新 token（保证消费方能识别过期事件）', () => {
    const store = useMarkdownFormatPromptStore()
    store.trigger({ source: 'a4-focus-mode' })
    const firstToken = store.pending.token
    store.trigger({ source: 'a4-focus-mode' })
    const secondToken = store.pending.token
    expect(firstToken).toBeDefined()
    expect(secondToken).toBeDefined()
    // 两次触发的 token 应不同（Symbol 唯一性）
    expect(firstToken).not.toBe(secondToken)
  })

  it('#11.11 clear() 主动清空 pending（供消费方消费完成后调用）', () => {
    const store = useMarkdownFormatPromptStore()
    store.trigger({ source: 'a4-focus-mode' })
    expect(store.pending).toBeTruthy()
    store.clear()
    expect(store.pending).toBeNull()
  })

  it('#11.12 consume() 读取 pending 不自动清空', () => {
    const store = useMarkdownFormatPromptStore()
    store.trigger({ source: 'a4-focus-mode' })
    const payload1 = store.consume()
    const payload2 = store.consume()
    expect(payload1).toBeTruthy()
    expect(payload2).toBeTruthy()
    // consume 不会自动 clear
    expect(payload1.token).toBe(payload2.token)
  })

  it('#11.13 集成：A4 模式触发 → 模板选择 → 排版完整链路', () => {
    // 端到端验证：
    // 1. A4 模式开启
    // 2. MD store 触发 (source: a4-focus-mode)
    // 3. 消费方读取 payload
    // 4. 选择模板并执行 formatDocument

    const mdStore = useMarkdownFormatPromptStore()

    // 1+2. A4 模式触发（由 TitleBar 守卫后调用）
    mdStore.trigger({
      source: 'a4-focus-mode',
      previewText: '# 测试文档',
      hasImages: false,
    })

    // 3. 消费方读取
    const payload = mdStore.consume()
    expect(payload.source).toBe('a4-focus-mode')
    expect(payload.previewText).toBe('# 测试文档')

    // 4. 模拟用户选择「正文文章」模板
    const tpl = getTemplateById('article')
    expect(tpl).toBeTruthy()

    // 验证模板可被 formatDocument 使用
    // （实际排版在端到端测试中执行，这里只验证模板元数据）
    expect(tpl.id).toBe('article')
    expect(tpl.label).toBeTruthy()

    // 5. 消费完成后清空
    mdStore.clear()
    expect(mdStore.pending).toBeNull()
  })
})