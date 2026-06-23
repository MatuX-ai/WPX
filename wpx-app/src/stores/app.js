import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const aiPanelOpen = ref(false)
  const knowledgePanelOpen = ref(false)
  const saveDialog = ref({
    open: false,
    content: '',
    defaultTitle: '未命名文档',
  })
  const lastSavedDocument = ref(null)
  const documentTitle = ref('未命名文档')
  /** @type {import('vue').Ref<'saved' | 'unsaved' | 'saving'>} */
  const documentSaveStatus = ref('saved')
  const isDocumentSaved = computed(() => documentSaveStatus.value === 'saved')
  const newDocumentTick = ref(0)
  const hasOpenDocument = ref(false)
  /** @type {import('vue').Ref<{ path?: string, content: string, title?: string, format?: object | null } | null>} */
  const pendingExternalFile = ref(null)
  const documentSourcePath = ref('')
  const documentSourceMtime = ref(null)
  const saveStatusRefreshTick = ref(0)
  const libraryRefreshTick = ref(0)

  function toggleAiPanel() {
    aiPanelOpen.value = !aiPanelOpen.value
  }

  function toggleKnowledgePanel() {
    knowledgePanelOpen.value = !knowledgePanelOpen.value
  }

  function closeKnowledgePanel() {
    knowledgePanelOpen.value = false
  }

  function openSaveDialog({ content = '', defaultTitle = '未命名文档' } = {}) {
    saveDialog.value = { open: true, content, defaultTitle }
  }

  function closeSaveDialog() {
    saveDialog.value = { ...saveDialog.value, open: false }
  }

  function notifyDocumentSaved(item) {
    lastSavedDocument.value = item
    if (item?.title) {
      documentTitle.value = item.title
    }
    documentSaveStatus.value = 'saved'
  }

  function setDocumentTitle(title) {
    documentTitle.value = title?.trim() || '未命名文档'
  }

  function setDocumentSaveStatus(status) {
    documentSaveStatus.value = status
  }

  function markDocumentDirty() {
    documentSaveStatus.value = 'unsaved'
  }

  function markDocumentSaved() {
    documentSaveStatus.value = 'saved'
  }

  function requestNewDocument() {
    newDocumentTick.value += 1
  }

  function openDocument() {
    hasOpenDocument.value = true
  }

  function closeDocument() {
    hasOpenDocument.value = false
  }

  function resetDocumentState() {
    documentTitle.value = '未命名文档'
    documentSaveStatus.value = 'saved'
    lastSavedDocument.value = null
    clearDocumentSource()
  }

  /**
   * @param {{ path: string, mtimeMs?: number | null }} source
   */
  function setDocumentSource({ path, mtimeMs = null }) {
    documentSourcePath.value = path || ''
    documentSourceMtime.value = mtimeMs ?? null
  }

  function clearDocumentSource() {
    documentSourcePath.value = ''
    documentSourceMtime.value = null
  }

  function bumpSaveStatusRefresh() {
    saveStatusRefreshTick.value += 1
  }

  function bumpLibraryRefresh() {
    libraryRefreshTick.value += 1
  }

  function queueExternalFile(payload) {
    pendingExternalFile.value = payload
  }

  function takePendingExternalFile() {
    const payload = pendingExternalFile.value
    pendingExternalFile.value = null
    return payload
  }

  return {
    aiPanelOpen,
    toggleAiPanel,
    knowledgePanelOpen,
    toggleKnowledgePanel,
    closeKnowledgePanel,
    saveDialog,
    openSaveDialog,
    closeSaveDialog,
    lastSavedDocument,
    notifyDocumentSaved,
    documentTitle,
    isDocumentSaved,
    documentSaveStatus,
    setDocumentTitle,
    setDocumentSaveStatus,
    markDocumentDirty,
    markDocumentSaved,
    newDocumentTick,
    requestNewDocument,
    hasOpenDocument,
    openDocument,
    closeDocument,
    resetDocumentState,
    pendingExternalFile,
    queueExternalFile,
    takePendingExternalFile,
    documentSourcePath,
    documentSourceMtime,
    saveStatusRefreshTick,
    libraryRefreshTick,
    setDocumentSource,
    clearDocumentSource,
    bumpSaveStatusRefresh,
    bumpLibraryRefresh,
  }
})
