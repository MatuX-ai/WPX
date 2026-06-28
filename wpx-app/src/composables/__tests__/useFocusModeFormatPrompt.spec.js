import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

/**
 * 单元测试：useFocusModeFormatPrompt — A4 模式智能排版触发器
 *
 * 覆盖矩阵：
 *   - 无 editor → 静默返回 null
 *   - 显式传入 editor 时覆盖 getActiveEditor
 *   - HTML 导入文档 → 触发 htmlFormatPromptStore，返回 'html'
 *   - 含 Markdown 标记 → 触发 markdownFormatPromptStore，返回 'markdown'
 *   - 纯文本 / 不含 MD 标记 → 不触发，返回 null
 *   - 优先级：HTML > MD（HTML 导入时不会触发 MD store）
 *   - 同一文档重复触发 → 两次都成功（Pinia 内部用 token 区分）
 */

// ─── Mock useEditorRegistry ─────────────────────────────
let activeEditorRef = null
vi.mock('@/composables/useEditorRegistry', () => ({
  getActiveEditor: () => activeEditorRef,
}))

// ─── Helpers ────────────────────────────────────────────

/**
 * 构造最小 mock editor：
 * - state.doc.attrs 可读
 * - state.doc.textContent 可配置
 * - 通过 initialAttrs.htmlSource 控制 hasHtmlImport 的返回值
 */
function buildMockEditor({ textContent = '', htmlSource = undefined } = {}) {
  const editor = {
    state: {
      doc: {
        attrs: htmlSource !== undefined ? { htmlSource } : {},
        textContent,
      },
    },
  }
  return editor
}

// ─── Tests ─────────────────────────────────────────────

describe('useFocusModeFormatPrompt', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    activeEditorRef = null
  })

  it('#1 无可用 editor 时静默返回 null（不抛异常）', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')
    const { useHtmlFormatPromptStore } = await import('@/stores/htmlFormatPrompt')
    const { trigger } = useFocusModeFormatPrompt()
    activeEditorRef = null
    const result = trigger()
    expect(result).toBeNull()
    expect(useMarkdownFormatPromptStore().pending).toBeNull()
    expect(useHtmlFormatPromptStore().pending).toBeNull()
  })

  it('#2 显式传入 null editor 也静默返回 null', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { trigger } = useFocusModeFormatPrompt()
    const result = trigger(null)
    expect(result).toBeNull()
  })

  it('#3 显式传入 undefined 时回退到 getActiveEditor（也为 null）→ 返回 null', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { trigger } = useFocusModeFormatPrompt()
    activeEditorRef = null
    const result = trigger(undefined)
    expect(result).toBeNull()
  })

  it('#4 HTML 导入文档 → 触发 HTML store，返回 "html"', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useHtmlFormatPromptStore } = await import('@/stores/htmlFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    const editor = buildMockEditor({ htmlSource: '<h1>Page</h1>' })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(editor)

    expect(result).toBe('html')
    const htmlStore = useHtmlFormatPromptStore()
    expect(htmlStore.pending).toBeTruthy()
    expect(htmlStore.pending.source).toBe('a4-focus-mode')

    // 优先级验证：MD store 不应被触发
    expect(useMarkdownFormatPromptStore().pending).toBeNull()
  })

  it('#5 含 Markdown 标题 → 触发 MD store，返回 "markdown"', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')
    const { useHtmlFormatPromptStore } = await import('@/stores/htmlFormatPrompt')

    const mdText = '# 一级标题\n\n- 列表项 1\n- 列表项 2'
    const editor = buildMockEditor({ textContent: mdText })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(editor)

    expect(result).toBe('markdown')
    const mdStore = useMarkdownFormatPromptStore()
    expect(mdStore.pending).toBeTruthy()
    expect(mdStore.pending.source).toBe('a4-focus-mode')
    expect(useHtmlFormatPromptStore().pending).toBeNull()
  })

  it('#6 含 Markdown 列表 → 触发 MD store', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    const editor = buildMockEditor({ textContent: '1. 第一步\n2. 第二步' })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(editor)

    expect(result).toBe('markdown')
    expect(useMarkdownFormatPromptStore().pending.source).toBe('a4-focus-mode')
  })

  it('#7 纯文本文档（无 MD 标记）→ 不触发任何 store，返回 null', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')
    const { useHtmlFormatPromptStore } = await import('@/stores/htmlFormatPrompt')

    const editor = buildMockEditor({
      textContent: '这是一段很普通的纯文本散文。没有任何 Markdown 标记，例如没有井号、没有星号、也没有列表符号。',
    })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(editor)

    expect(result).toBeNull()
    expect(useMarkdownFormatPromptStore().pending).toBeNull()
    expect(useHtmlFormatPromptStore().pending).toBeNull()
  })

  it('#8 优先级：HTML 导入 + 含 MD 文本 → 仍只触发 HTML store（不触发 MD）', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useHtmlFormatPromptStore } = await import('@/stores/htmlFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    // 模拟一个既是 HTML 导入、文本中又含 MD 标记的文档
    const editor = buildMockEditor({
      htmlSource: '<h1>标题</h1>',
      textContent: '# 标题\n\n- 列表',
    })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(editor)

    // 优先级 1：HTML import 命中 → 直接返回
    expect(result).toBe('html')
    expect(useHtmlFormatPromptStore().pending.source).toBe('a4-focus-mode')
    // MD store 不应被触发
    expect(useMarkdownFormatPromptStore().pending).toBeNull()
  })

  it('#9 显式传入 editor 时覆盖 getActiveEditor（不读取 activeEditorRef）', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    // 设置 activeEditor 为一个不含 MD 的纯文本 editor
    activeEditorRef = buildMockEditor({ textContent: 'plain text without any markdown markers here at all' })

    // 但显式传入一个含 MD 的 editor
    const explicitEditor = buildMockEditor({ textContent: '# 显式传入的 MD 内容' })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(explicitEditor)

    // 应该使用显式传入的 editor
    expect(result).toBe('markdown')
    expect(useMarkdownFormatPromptStore().pending.source).toBe('a4-focus-mode')
  })

  it('#10 不传 editor 时使用 getActiveEditor()', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    // 设置 activeEditorRef 为含 MD 的 editor
    activeEditorRef = buildMockEditor({ textContent: '# Active MD' })

    const { trigger } = useFocusModeFormatPrompt()
    const result = trigger() // 不传参数

    expect(result).toBe('markdown')
    expect(useMarkdownFormatPromptStore().pending.source).toBe('a4-focus-mode')
  })

  it('#11 重复触发 → 两次都成功（幂等）', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    const editor = buildMockEditor({ textContent: '# 标题\n\n- 列表' })
    const { trigger } = useFocusModeFormatPrompt()

    const first = trigger(editor)
    const firstToken = useMarkdownFormatPromptStore().pending?.token
    expect(first).toBe('markdown')
    expect(firstToken).toBeDefined()

    // 清理模拟消费
    useMarkdownFormatPromptStore().clear()

    const second = trigger(editor)
    const secondToken = useMarkdownFormatPromptStore().pending?.token
    expect(second).toBe('markdown')
    expect(secondToken).toBeDefined()

    // 两次触发 token 不同（Symbol 唯一性）
    expect(firstToken).not.toBe(secondToken)
  })

  it('#12 editor.state.doc.textContent 为空字符串 → 不触发 MD', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { useMarkdownFormatPromptStore } = await import('@/stores/markdownFormatPrompt')

    const editor = buildMockEditor({ textContent: '' })
    const { trigger } = useFocusModeFormatPrompt()

    const result = trigger(editor)

    expect(result).toBeNull()
    expect(useMarkdownFormatPromptStore().pending).toBeNull()
  })

  it('#13 editor.state 为 undefined（异常状态）→ 不抛异常，返回 null', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')
    const { trigger } = useFocusModeFormatPrompt()

    const brokenEditor = { state: undefined }
    const result = trigger(brokenEditor)

    // hasHtmlImport(brokenEditor) 应返回 false（不抛异常）→ 走 MD 检测
    // state.doc 为 undefined → textContent || '' = '' → detectMarkdown('') = false → 返回 null
    expect(result).toBeNull()
  })

  it('#14 不同文档结构 → trigger 返回对应类型（综合验证）', async () => {
    const { useFocusModeFormatPrompt } = await import('@/composables/useFocusModeFormatPrompt')

    const cases = [
      { name: 'HTML 导入', editor: buildMockEditor({ htmlSource: '<p>x</p>' }), expected: 'html' },
      { name: 'MD 标题', editor: buildMockEditor({ textContent: '# 标题' }), expected: 'markdown' },
      { name: 'MD 列表', editor: buildMockEditor({ textContent: '- a\n- b' }), expected: 'markdown' },
      { name: 'MD 引用', editor: buildMockEditor({ textContent: '> 引用内容' }), expected: 'markdown' },
      { name: 'MD 表格', editor: buildMockEditor({ textContent: '| 列1 | 列2 |\n|---|---|' }), expected: 'markdown' },
      { name: 'MD 链接', editor: buildMockEditor({ textContent: '访问 [官网](https://example.com)' }), expected: 'markdown' },
      { name: '纯文本', editor: buildMockEditor({ textContent: 'just plain text content here without any markers' }), expected: null },
    ]

    const { trigger } = useFocusModeFormatPrompt()
    cases.forEach(({ name, editor, expected }) => {
      const result = trigger(editor)
      expect(result, `case: ${name}`).toBe(expected)
    })
  })
})