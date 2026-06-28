import { onBeforeUnmount } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { searchKeymap } from '@codemirror/search'
import { bracketMatching, indentOnInput } from '@codemirror/language'

/**
 * WPX HTML 源码编辑器 composable
 *
 * 职责：
 *  1. 初始化 CodeMirror 6 EditorView 挂载到指定 DOM 容器
 *  2. 双向同步：CodeMirror → Tiptap（防抖 300ms）+ Tiptap → CodeMirror
 *  3. 滚动/选区位置保持：setContent 前后记录锚点，变更后尽量恢复
 *  4. 提供 destroy 方法释放内存
 *
 * 数据流：
 *   CodeMirror 编辑 → dispatch 事件 → debounce(300ms) → editor.commands.updateHtmlSource(html)
 *                                                    → editor.commands.setContent(html)
 *   Tiptap 编辑   → editor.on('update') → diff → CodeMirror dispatch({changes})
 *
 * 设计要点：
 *  - 防抖避免高频输入导致 setContent 卡顿
 *  - 反向同步时检测值是否相等，相等则跳过（防止循环）
 *  - 锚点恢复失败时退回到位置 0，避免崩溃
 *  - 仅暴露简单 API（mount / update / destroy），不在 composable 内 watch editor 生命周期
 *
 * @param {{
 *   getEditor: () => (object | null),  // Tiptap editor 引用获取函数
 *   debounceMs?: number,                // 防抖延迟，默认 300
 *   onError?: (err: Error) => void,     // 初始化/同步错误回调
 *   onChange?: (html: string) => void,  // 同步回调（可选，便于外部监听）
 * }} options
 */
export function useHtmlSourceEditor(options = {}) {
  const {
    getEditor,
    debounceMs = 300,
    onError,
    onChange,
  } = options

  /** @type {EditorView | null} */
  let view = null

  /** 防抖计时器 */
  let debounceTimer = null

  /** 当前同步方向：'cm' (CodeMirror→Tiptap) | 'tiptap' (Tiptap→CodeMirror) | null */
  let syncDirection = null

  /** Tiptap update 监听器引用，用于销毁时解绑 */
  let tiptapUpdateListener = null

  /** Tiptap 当前引用的弱引用，用于销毁时解绑 */
  let boundTiptapEditor = null

  /**
   * WPX 主题：匹配现有 CSS 变量
   * 通过 EditorView.theme 把 CodeMirror 内部颜色绑定到 WPX 主题变量，
   * 实现暗色模式自动跟随。
   */
  function buildWpxTheme() {
    return EditorView.theme(
      {
        '&': {
          color: 'var(--theme-fg, #0f172a)',
          backgroundColor: 'var(--theme-bg, #ffffff)',
          height: '100%',
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-content': {
          caretColor: 'var(--theme-accent, #7c3aed)',
          fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
          fontSize: '13px',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--theme-bg-subtle, #f8fafc)',
          color: 'var(--theme-fg-muted, #94a3b8)',
          border: 'none',
          borderRight: '1px solid var(--theme-border, #e2e8f0)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--theme-bg-subtle, #f1f5f9)',
          color: 'var(--theme-accent, #7c3aed)',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in srgb, var(--theme-accent, #7c3aed) 6%, transparent)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--theme-accent, #7c3aed)',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'color-mix(in srgb, var(--theme-accent, #7c3aed) 18%, transparent)',
        },
        // HTML 标签高亮（基于 Lezer highlight tags）
        '.tok-tagName, .tok-tag': { color: '#7c3aed' },
        '.tok-attributeName': { color: '#2563eb' },
        '.tok-attributeValue': { color: '#059669' },
        '.tok-string': { color: '#059669' },
        '.tok-comment': { color: '#94a3b8', fontStyle: 'italic' },
        '.tok-keyword': { color: '#db2777' },
        '.tok-punctuation': { color: '#64748b' },
      },
      { dark: false },
    )
  }

  /** 暗色主题：与 .dark / [data-theme="dark"] 选择器对应 */
  function buildWpxDarkTheme() {
    return EditorView.theme(
      {
        '&': {
          color: 'var(--theme-fg, #e2e8f0)',
          backgroundColor: 'var(--theme-bg, #1e293b)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--theme-bg-subtle, #0f172a)',
          color: 'var(--theme-fg-muted, #64748b)',
          borderRight: '1px solid var(--theme-border, #334155)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--theme-bg-subtle, #1e293b)',
          color: 'var(--theme-accent, #a78bfa)',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in srgb, var(--theme-accent, #a78bfa) 8%, transparent)',
        },
        '.tok-tagName, .tok-tag': { color: '#a78bfa' },
        '.tok-attributeName': { color: '#60a5fa' },
        '.tok-attributeValue': { color: '#34d399' },
        '.tok-string': { color: '#34d399' },
        '.tok-comment': { color: '#64748b', fontStyle: 'italic' },
        '.tok-keyword': { color: '#f472b6' },
        '.tok-punctuation': { color: '#94a3b8' },
      },
      { dark: true },
    )
  }

  /**
   * 初始化 CodeMirror 6 并挂载到容器。
   * @param {HTMLElement} parent DOM 父容器
   * @param {string} initialHtml 初始 HTML 源码
   * @returns {{ view: EditorView, ready: boolean }}
   */
  function mount(parent, initialHtml = '') {
    if (!parent) {
      const err = new Error('[useHtmlSourceEditor] mount: parent 容器为 null')
      if (typeof onError === 'function') onError(err)
      else console.warn(err.message)
      return { view: null, ready: false }
    }

    try {
      const state = EditorState.create({
        doc: initialHtml || '',
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          indentOnInput(),
          highlightActiveLine(),
          html(),
          buildWpxTheme(),
          buildWpxDarkTheme(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of(handleUpdate),
        ],
      })

      view = new EditorView({
        state,
        parent,
      })

      // 绑定 Tiptap 反向同步
      bindTiptapReverseSync()

      return { view, ready: true }
    } catch (err) {
      if (typeof onError === 'function') onError(err)
      else console.error('[useHtmlSourceEditor] CodeMirror 初始化失败：', err)
      return { view: null, ready: false }
    }
  }

  /**
   * CodeMirror update 事件处理：监听文档变化触发同步。
   * @param {import('@codemirror/view').ViewUpdate} update
   */
  function handleUpdate(update) {
    if (!update.docChanged) return
    scheduleSyncFromCm()
  }

  /**
   * 防抖调度：从 CodeMirror 同步到 Tiptap
   */
  function scheduleSyncFromCm() {
    if (!view) return
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      flushCmToTiptap()
    }, debounceMs)
  }

  /**
   * 立即执行：从 CodeMirror 同步到 Tiptap
   * @returns {boolean} 是否成功执行
   */
  function flushCmToTiptap() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (!view) return false
    const editor = typeof getEditor === 'function' ? getEditor() : null
    if (!editor) return false

    const html = view.state.doc.toString()
    const currentSource = editor.state?.doc?.attrs?.htmlSource
    if (currentSource === html) {
      // 值未变化，跳过以避免循环
      return false
    }

    try {
      // 1. 保存选区锚点
      const anchor = captureSelectionAnchor(editor)

      // 2. 写入 htmlSource + 触发 Tiptap 重渲染
      syncDirection = 'cm'
      if (typeof editor.commands?.updateHtmlSource === 'function') {
        editor.commands.updateHtmlSource(html)
      }
      editor.commands.setContent(html, { emitUpdate: false })

      // 3. 恢复选区
      restoreSelectionAnchor(editor, anchor)
      syncDirection = null

      if (typeof onChange === 'function') onChange(html)
      return true
    } catch (err) {
      syncDirection = null
      if (typeof onError === 'function') onError(err)
      else console.error('[useHtmlSourceEditor] 同步失败：', err)
      return false
    }
  }

  /**
   * 绑定 Tiptap 反向同步：editor.on('update') → CodeMirror
   */
  function bindTiptapReverseSync() {
    const editor = typeof getEditor === 'function' ? getEditor() : null
    if (!editor || boundTiptapEditor === editor) return

    // 解绑旧引用
    if (tiptapUpdateListener && boundTiptapEditor) {
      boundTiptapEditor.off('update', tiptapUpdateListener)
      tiptapUpdateListener = null
    }

    tiptapUpdateListener = () => {
      // 当前是 CM → Tiptap 触发的 setContent，不要回写到 CM（避免循环）
      if (syncDirection === 'cm') return
      syncFromTiptapToCm()
    }
    editor.on('update', tiptapUpdateListener)
    boundTiptapEditor = editor
  }

  /**
   * 反向同步：Tiptap → CodeMirror
   * 仅当 Tiptap 当前的 htmlSource 与 CodeMirror 内容不一致时更新 CodeMirror。
   */
  function syncFromTiptapToCm() {
    if (!view) return false
    const editor = typeof getEditor === 'function' ? getEditor() : null
    if (!editor) return false

    try {
      const html = editor.state?.doc?.attrs?.htmlSource
      if (typeof html !== 'string') return false
      const cmCurrent = view.state.doc.toString()
      if (cmCurrent === html) return false

      // 使用 dispatch 替换文档内容，保留选区/滚动位置
      const len = cmCurrent.length
      const selection = view.state.selection.main
      syncDirection = 'tiptap'
      view.dispatch({
        changes: { from: 0, to: len, insert: html },
        selection: {
          anchor: Math.min(selection.anchor, html.length),
          head: Math.min(selection.head, html.length),
        },
      })
      syncDirection = null
      return true
    } catch (err) {
      syncDirection = null
      if (typeof onError === 'function') onError(err)
      else console.warn('[useHtmlSourceEditor] Tiptap 反向同步失败：', err)
      return false
    }
  }

  /**
   * 主动更新 CodeMirror 内容（外部切换文档时使用）
   * @param {string} html
   */
  function updateContent(html) {
    if (!view) return false
    const next = typeof html === 'string' ? html : ''
    const current = view.state.doc.toString()
    if (current === next) return false

    try {
      syncDirection = 'tiptap'
      view.dispatch({
        changes: { from: 0, to: current.length, insert: next },
        selection: { anchor: 0, head: 0 },
      })
      syncDirection = null
      return true
    } catch (err) {
      syncDirection = null
      if (typeof onError === 'function') onError(err)
      else console.warn('[useHtmlSourceEditor] updateContent 失败：', err)
      return false
    }
  }

  /**
   * 捕获选区锚点（用于 setContent 后恢复位置）
   * @param {object} editor Tiptap editor
   * @returns {{ from: number, to: number, anchorText: string, anchorFrom: number, anchorBefore: string }|null}
   */
  function captureSelectionAnchor(editor) {
    try {
      const selection = editor.state.selection
      const doc = editor.state.doc
      const from = Math.min(selection.from, doc.content.size)
      const to = Math.min(selection.to, doc.content.size)
      // 锚点：选区前 30 字符 + 选区文本
      const beforeStart = Math.max(0, from - 30)
      const anchorBefore = doc.textBetween(beforeStart, from, '\n')
      const anchorText = doc.textBetween(from, to, '\n')
      return { from, to, anchorText, anchorFrom: from, anchorBefore }
    } catch {
      return null
    }
  }

  /**
   * 恢复选区锚点
   * @param {object} editor
   * @param {{ from: number, to: number, anchorText: string, anchorFrom: number, anchorBefore: string }|null} anchor
   */
  function restoreSelectionAnchor(editor, anchor) {
    if (!editor || !anchor) return
    try {
      const newDocSize = editor.state.doc.content.size
      // 优先按 anchorBefore + anchorText 文本匹配恢复
      const target = findPositionByAnchor(editor, anchor)
      const nextFrom = target != null ? target : Math.min(anchor.from, newDocSize)
      const nextTo =
        anchor.anchorText && target != null
          ? Math.min(target + anchor.anchorText.length, newDocSize)
          : Math.min(anchor.to, newDocSize)
      editor.commands.setTextSelection({ from: nextFrom, to: nextTo })
    } catch (err) {
      // 恢复失败时不抛出，避免破坏主流程
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[useHtmlSourceEditor] 恢复选区失败：', err)
      }
    }
  }

  /**
   * 通过 anchorBefore + anchorText 文本匹配查找选区起点
   * @param {object} editor
   * @param {{ anchorText: string, anchorBefore: string, anchorFrom: number }} anchor
   * @returns {number|null}
   */
  function findPositionByAnchor(editor, anchor) {
    try {
      const doc = editor.state.doc
      const docText = doc.textBetween(0, doc.content.size, '\n')
      // 尝试 1：完整匹配 anchorBefore + anchorText
      if (anchor.anchorBefore && anchor.anchorText) {
        const idx = docText.indexOf(anchor.anchorBefore + anchor.anchorText)
        if (idx >= 0) return idx + anchor.anchorBefore.length
      }
      // 尝试 2：仅匹配 anchorBefore
      if (anchor.anchorBefore) {
        const idx = docText.indexOf(anchor.anchorBefore)
        if (idx >= 0) return idx + anchor.anchorBefore.length
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 销毁 EditorView，释放内存
   */
  function destroy() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (tiptapUpdateListener && boundTiptapEditor) {
      boundTiptapEditor.off('update', tiptapUpdateListener)
    }
    tiptapUpdateListener = null
    boundTiptapEditor = null

    if (view) {
      try {
        view.destroy()
      } catch (err) {
        console.warn('[useHtmlSourceEditor] view.destroy 失败：', err)
      }
      view = null
    }
  }

  /**
   * 重新绑定 Tiptap editor（当 EditorCore 的 editor 引用变化时调用）
   */
  function rebindTiptap() {
    bindTiptapReverseSync()
  }

  /**
   * 当前 CodeMirror EditorView 引用（只读）
   */
  function getView() {
    return view
  }

  /** 组件卸载时自动清理（如果 composable 在 setup 期间被调用） */
  onBeforeUnmount(() => {
    destroy()
  })

  return {
    mount,
    destroy,
    updateContent,
    flushCmToTiptap,
    rebindTiptap,
    getView,
  }
}

export default useHtmlSourceEditor