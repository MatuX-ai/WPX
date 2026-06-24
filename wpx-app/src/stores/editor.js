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
  }

  function setChatInputActive(active) {
    chatInputActive.value = active
    if (active && selection.value.hasSelection) {
      frozenSelection.value = { ...selection.value }
    }
    if (!active) {
      frozenSelection.value = null
    }
  }

  function setPendingReplace(range) {
    pendingReplace.value = range
  }

  function clearPendingReplace() {
    pendingReplace.value = null
  }

  function requestReplace(text, range) {
    replaceRequest.value = {
      text,
      from: range.from,
      to: range.to,
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

  return {
    selection,
    frozenSelection,
    chatInputActive,
    pendingReplace,
    replaceRequest,
    activeSelection,
    setSelection,
    setChatInputActive,
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
  }
})
