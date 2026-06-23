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
  }
})
