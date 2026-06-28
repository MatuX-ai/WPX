import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHtmlSourceEditor } from '@/composables/useHtmlSourceEditor'

/**
 * 单元测试：HTML 源码编辑器 composable
 *
 * 覆盖：
 *  - mount 初始化（成功 / 失败）
 *  - updateContent 替换文档内容
 *  - flushCmToTiptap 同步到 Tiptap
 *  - destroy 清理资源
 *  - rebindTiptap 重新绑定 editor
 *
 * 注：CodeMirror 在 jsdom 中无法渲染真实 DOM，
 *    这里通过 mock EditorView / EditorState 验证我们的 API 调用链。
 */

// Mock CodeMirror 相关模块
vi.mock('@codemirror/state', () => {
  const EditorState = {
    create: vi.fn((config) => ({
      doc: { toString: () => config?.doc || '', length: (config?.doc || '').length },
      selection: { main: { anchor: 0, head: 0 } },
      ...config,
    })),
  }
  return { EditorState }
})

vi.mock('@codemirror/view', () => {
  const EditorView = vi.fn(function MockEditorView(opts) {
    this.opts = opts
    this.state = {
      doc: {
        toString: () => '',
        length: 0,
      },
      selection: { main: { anchor: 0, head: 0 } },
    }
    this.dispatch = vi.fn()
    this.destroy = vi.fn()
  })
  EditorView.theme = vi.fn(() => ({ __theme: true }))
  EditorView.lineWrapping = { __ext: 'lineWrapping' }
  EditorView.updateListener = { of: vi.fn((fn) => ({ __listener: fn })) }
  EditorView.prototype = {}
  return { EditorView, keymap: { of: vi.fn((arr) => ({ __keymap: arr })) }, lineNumbers: () => ({}), highlightActiveLine: () => ({}) }
})

vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: () => ({}),
  historyKeymap: [],
}))

vi.mock('@codemirror/lang-html', () => ({
  html: () => ({ __html: true }),
}))

vi.mock('@codemirror/search', () => ({
  searchKeymap: [],
}))

vi.mock('@codemirror/language', () => ({
  bracketMatching: () => ({}),
  indentOnInput: () => ({}),
}))

/**
 * 构造 mock Tiptap editor
 */
function buildMockTiptapEditor(initialAttrs = {}) {
  const listeners = {}
  const editor = {
    state: {
      doc: {
        attrs: { ...initialAttrs },
        content: { size: 100 },
        textBetween: vi.fn((from, to) => {
          if (from < 0 || to > 100) return ''
          // 简化：从 attrs.htmlSource 中截取
          const html = editor.state.doc.attrs.htmlSource || ''
          return html.substring(from, to)
        }),
      },
      selection: { from: 50, to: 50 },
    },
    commands: {
      setContent: vi.fn(() => true),
      setTextSelection: vi.fn(() => true),
      updateHtmlSource: vi.fn((html) => {
        editor.state.doc.attrs.htmlSource = html
        return true
      }),
    },
    on: vi.fn((event, cb) => {
      listeners[event] = cb
    }),
    off: vi.fn((event) => {
      delete listeners[event]
    }),
    _triggerUpdate: () => {
      if (listeners.update) listeners.update()
    },
  }
  return editor
}

describe('useHtmlSourceEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mount 在 parent 缺失时返回 ready=false 并触发 onError', () => {
    const onError = vi.fn()
    const cm = useHtmlSourceEditor({
      getEditor: () => buildMockTiptapEditor(),
      onError,
    })
    const result = cm.mount(null, '<html></html>')
    expect(result.ready).toBe(false)
    expect(result.view).toBeNull()
    expect(onError).toHaveBeenCalled()
  })

  it('mount 成功时返回 EditorView 实例', () => {
    const editor = buildMockTiptapEditor()
    const cm = useHtmlSourceEditor({ getEditor: () => editor })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const result = cm.mount(parent, '<html></html>')
    expect(result.ready).toBe(true)
    expect(result.view).toBeTruthy()

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('updateContent 替换 CodeMirror 文档', () => {
    const editor = buildMockTiptapEditor()
    const cm = useHtmlSourceEditor({ getEditor: () => editor })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '')
    // 设置一个非空的初始 doc
    cm.getView().state.doc.toString = () => ''
    cm.getView().state.doc.length = 0
    cm.updateContent('<p>hello</p>')
    expect(cm.getView().dispatch).toHaveBeenCalled()

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('updateContent 内容相同时不触发 dispatch', () => {
    const editor = buildMockTiptapEditor()
    const cm = useHtmlSourceEditor({ getEditor: () => editor })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '<p>hello</p>')
    cm.getView().state.doc.toString = () => '<p>hello</p>'
    cm.getView().state.doc.length = 12
    cm.updateContent('<p>hello</p>')
    expect(cm.getView().dispatch).not.toHaveBeenCalled()

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('flushCmToTiptap 写入 htmlSource + setContent', () => {
    const editor = buildMockTiptapEditor()
    const cm = useHtmlSourceEditor({ getEditor: () => editor })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '<p>init</p>')
    cm.getView().state.doc.toString = () => '<p>edited</p>'
    cm.getView().state.doc.length = 14

    const ok = cm.flushCmToTiptap()
    expect(ok).toBe(true)
    expect(editor.commands.updateHtmlSource).toHaveBeenCalledWith('<p>edited</p>')
    expect(editor.commands.setContent).toHaveBeenCalled()

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('flushCmToTiptap 当值未变时跳过', () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>same</p>' })
    const cm = useHtmlSourceEditor({ getEditor: () => editor })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '<p>same</p>')
    cm.getView().state.doc.toString = () => '<p>same</p>'
    cm.getView().state.doc.length = 11

    const ok = cm.flushCmToTiptap()
    expect(ok).toBe(false)
    expect(editor.commands.setContent).not.toHaveBeenCalled()

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('flushCmToTiptap 在 editor 缺失时静默返回 false', () => {
    const cm = useHtmlSourceEditor({ getEditor: () => null })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '')
    cm.getView().state.doc.toString = () => 'content'
    cm.getView().state.doc.length = 7

    const ok = cm.flushCmToTiptap()
    expect(ok).toBe(false)

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('destroy 调用 view.destroy 并解绑 Tiptap 监听', () => {
    const editor = buildMockTiptapEditor()
    const cm = useHtmlSourceEditor({ getEditor: () => editor })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '')
    const view = cm.getView()
    cm.destroy()
    expect(view.destroy).toHaveBeenCalled()
    expect(editor.off).toHaveBeenCalledWith('update', expect.any(Function))
    expect(cm.getView()).toBeNull()

    document.body.removeChild(parent)
  })

  it('rebindTiptap 切换到新 editor', () => {
    const editor1 = buildMockTiptapEditor()
    const editor2 = buildMockTiptapEditor()
    let current = editor1
    const cm = useHtmlSourceEditor({ getEditor: () => current })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '')
    expect(editor1.on).toHaveBeenCalledWith('update', expect.any(Function))

    current = editor2
    cm.rebindTiptap()
    expect(editor2.on).toHaveBeenCalledWith('update', expect.any(Function))

    cm.destroy()
    document.body.removeChild(parent)
  })

  it('onChange 回调在 flushCmToTiptap 成功后触发', () => {
    const editor = buildMockTiptapEditor()
    const onChange = vi.fn()
    const cm = useHtmlSourceEditor({ getEditor: () => editor, onChange })
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    cm.mount(parent, '<p>init</p>')
    cm.getView().state.doc.toString = () => '<p>changed</p>'
    cm.getView().state.doc.length = 15

    cm.flushCmToTiptap()
    expect(onChange).toHaveBeenCalledWith('<p>changed</p>')

    cm.destroy()
    document.body.removeChild(parent)
  })
})