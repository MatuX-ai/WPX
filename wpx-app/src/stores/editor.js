import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const emptySelection = () => ({
  text: '',
  from: null,
  to: null,
  hasSelection: false,
})

export const useEditorStore = defineStore('editor', () => {
  const selection = ref(emptySelection())
  const frozenSelection = ref(null)
  /** 最近一次非空选区：编辑器失焦折叠选区后仍可供 AI 替换使用 */
  const lastNonEmptySelection = ref(null)
  const chatInputActive = ref(false)
  const pendingReplace = ref(null)
  const replaceRequest = ref(null)
  const imageEditSession = ref(null)
  const imageEditResult = ref(null)

  const activeSelection = computed(() => {
    if (chatInputActive.value && frozenSelection.value?.hasSelection) {
      return frozenSelection.value
    }
    return selection.value
  })

  function setSelection(nextSelection) {
    selection.value = {
      ...nextSelection,
      hasSelection: Boolean(
        nextSelection.text &&
          nextSelection.from != null &&
          nextSelection.to != null &&
          nextSelection.from !== nextSelection.to,
      ),
    }
    if (selection.value.hasSelection) {
      lastNonEmptySelection.value = { ...selection.value }
    }
  }

  function setChatInputActive(active) {
    chatInputActive.value = active
    if (active) {
      if (selection.value.hasSelection) {
        frozenSelection.value = { ...selection.value }
      }
      return
    }
    // blur 时保留 frozenSelection：Playwright fill / 短暂失焦后 Enter 发送仍需选区替换
  }

  function freezeSelectionFromEditor() {
    const source = selection.value.hasSelection
      ? selection.value
      : lastNonEmptySelection.value
    if (source?.hasSelection) {
      frozenSelection.value = { ...source }
    }
  }

  function clearChatSelectionFreeze() {
    frozenSelection.value = null
    lastNonEmptySelection.value = null
  }

  function setPendingReplace(range) {
    pendingReplace.value = range
  }

  function clearPendingReplace() {
    pendingReplace.value = null
  }

  /**
   * @param {string} text
   * @param {{ from: number, to: number }} range
   * @param {{ asMarkdown?: boolean }} [options] asMarkdown=true 时按 Markdown 解析后插入
   */
  function requestReplace(text, range, options = {}) {
    replaceRequest.value = {
      text,
      from: range.from,
      to: range.to,
      asMarkdown: Boolean(options?.asMarkdown),
      ts: Date.now(),
    }
  }

  function clearReplaceRequest() {
    replaceRequest.value = null
  }

  function openImageEdit({ src, pos }) {
    imageEditSession.value = { src, pos }
  }

  function closeImageEdit() {
    imageEditSession.value = null
  }

  function completeImageEdit(blob) {
    if (!imageEditSession.value) return
    imageEditResult.value = {
      blob,
      pos: imageEditSession.value.pos,
      ts: Date.now(),
    }
    imageEditSession.value = null
  }

  function clearImageEditResult() {
    imageEditResult.value = null
  }

  /** @type {import('vue').Ref<{ fontItem: object, ts: number } | null>} */
  const pendingFontApply = ref(null)

  function requestApplyFont(fontItem) {
    pendingFontApply.value = {
      fontItem,
      ts: Date.now(),
    }
  }

  function clearPendingFontApply() {
    pendingFontApply.value = null
  }

  /** @type {import('vue').Ref<{ mode: 'insert' | 'open', content: string, title?: string, type?: string, ts: number } | null>} */
  const pendingKnowledgeImport = ref(null)

  function requestKnowledgeImport(payload) {
    pendingKnowledgeImport.value = {
      ...payload,
      ts: Date.now(),
    }
  }

  function clearPendingKnowledgeImport() {
    pendingKnowledgeImport.value = null
  }

  /**
   * 待插入的 SlideDeck 节点请求（来自 PPT 工作流的最后一步）。
   * EditorLayout 监听此 ref，调用 editor.insertSlideDeck() 将幻灯片节点插入文档。
   * @type {import('vue').Ref<{ slides: Array<{ component: string, props: object }>, theme?: 'light'|'dark', title?: string, ts: number } | null>}
   */
  const pendingSlideDeckInsert = ref(null)

  function requestSlideDeckInsert(payload) {
    if (!payload || !Array.isArray(payload.slides)) {
      return
    }
    pendingSlideDeckInsert.value = {
      slides: payload.slides.slice(),
      theme: payload.theme === 'dark' ? 'dark' : 'light',
      title: payload.title || '',
      ts: Date.now(),
    }
  }

  function clearPendingSlideDeckInsert() {
    pendingSlideDeckInsert.value = null
  }

  /**
   * 待发送的 AI 写文意图（来自【新建文档 → AI 帮我写】的 URL 启动参数）。
   * EditorLayout 写入 → AiAssistantPlaceholder 监听 → 调用 handleSend 派发给 AI。
   * 若用户未接入大模型，handleSend 会通过 MISSING_CUSTOM_API 错误码自动弹窗引导。
   * @type {import('vue').Ref<{ text: string, ts: number } | null>}
   */
  const pendingAiIntent = ref(null)

  function requestAiIntent(text) {
    const value = typeof text === 'string' ? text.trim() : ''
    if (!value) return
    pendingAiIntent.value = {
      text: value,
      ts: Date.now(),
    }
  }

  function clearPendingAiIntent() {
    pendingAiIntent.value = null
  }

  return {
    selection,
    frozenSelection,
    chatInputActive,
    pendingReplace,
    replaceRequest,
    activeSelection,
    setSelection,
    setChatInputActive,
    freezeSelectionFromEditor,
    clearChatSelectionFreeze,
    setPendingReplace,
    clearPendingReplace,
    requestReplace,
    clearReplaceRequest,
    imageEditSession,
    imageEditResult,
    openImageEdit,
    closeImageEdit,
    completeImageEdit,
    clearImageEditResult,
    pendingFontApply,
    requestApplyFont,
    clearPendingFontApply,
    pendingKnowledgeImport,
    requestKnowledgeImport,
    clearPendingKnowledgeImport,
    pendingSlideDeckInsert,
    requestSlideDeckInsert,
    clearPendingSlideDeckInsert,
    pendingAiIntent,
    requestAiIntent,
    clearPendingAiIntent,
  }
})
