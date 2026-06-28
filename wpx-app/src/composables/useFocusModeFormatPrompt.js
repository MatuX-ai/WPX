import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'
import { useMarkdownFormatPromptStore } from '@/stores/markdownFormatPrompt'
import { hasHtmlImport } from '@/composables/useHtmlImporter'
import { getActiveEditor } from '@/composables/useEditorRegistry'
import { detectMarkdown } from '@/utils/markdownDetector'

/**
 * @typedef {'html' | 'markdown' | null} FocusFormatKind
 *
 * 触发结果分类:
 *   - 'html'     → 触发了 htmlFormatPromptStore
 *   - 'markdown' → 触发了 markdownFormatPromptStore
 *   - null       → 未触发(无 editor / 内容不匹配任何格式)
 */

/**
 * WPX A4 阅读模式智能排版触发器
 *
 * 职责:
 *   当用户切换到 A4 阅读模式(焦点模式开启)后,根据当前激活编辑器的内容类型,
 *   主动触发对应格式的排版选择弹窗。
 *
 * 优先级:
 *   1. HTML 导入来源 → 触发 htmlFormatPromptStore (source: a4-focus-mode)
 *   2. 含 Markdown 标记 → 触发 markdownFormatPromptStore (source: a4-focus-mode)
 *   3. 都不匹配 → 不打扰用户
 *
 * 设计要点:
 *   - 单一职责:本 composable 只负责「检测 + 触发」,不负责切换 focus mode 本身
 *     (切换由调用方 userPreferencesStore.toggleFocusMode() 处理)
 *   - 可单测:`trigger(editor)` 接受可选 editor 参数,便于单元测试注入 mock editor
 *   - 可复用:TitleBar、AiAssistantPlaceholder、命令面板、未来设置面板等都可复用
 *   - 幂等:对同一文档重复触发不会产生副作用(Pinia store 内部用 token 区分)
 *
 * 用法:
 *   const { trigger } = useFocusModeFormatPrompt()
 *   await userPreferencesStore.toggleFocusMode()
 *   if (userPreferencesStore.paper?.focusMode === true) {
 *     trigger() // 自动使用 getActiveEditor()
 *   }
 *
 * @returns {{
 *   trigger: (editor?: import('@tiptap/core').Editor | null) => FocusFormatKind
 * }}
 */
export function useFocusModeFormatPrompt() {
  const htmlPromptStore = useHtmlFormatPromptStore()
  const formatPromptStore = useMarkdownFormatPromptStore()

  /**
   * 触发 A4 模式智能排版选择器。
   *
   * 行为契约:
   *   - 若传入 editor 则使用传入值;否则使用 getActiveEditor()
   *   - 无可用 editor → 静默返回 null(不抛异常,避免在初始化早期炸掉)
   *   - 检测 hasHtmlImport → 触发 HTML store → 返回 'html'
   *   - 否则检测 detectMarkdown → 触发 MD store → 返回 'markdown'
   *   - 都不匹配 → 返回 null(不打扰用户)
   *
   * @param {import('@tiptap/core').Editor | null} [editor]
   * @returns {FocusFormatKind}
   */
  function trigger(editor) {
    const target = editor ?? getActiveEditor()
    if (!target) return null

    // 优先级 1:网页导入来源 → HTML 排版弹窗
    if (hasHtmlImport(target)) {
      htmlPromptStore.trigger({ source: 'a4-focus-mode' })
      return 'html'
    }

    // 优先级 2:含 Markdown 标记 → MD 排版弹窗
    const docText = target.state?.doc?.textContent || ''
    if (detectMarkdown(docText)) {
      formatPromptStore.trigger({ source: 'a4-focus-mode' })
      return 'markdown'
    }

    return null
  }

  return { trigger }
}

export default useFocusModeFormatPrompt