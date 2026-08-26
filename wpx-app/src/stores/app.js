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
  /** 资料库预览中的临时标题（优先于 documentTitle 显示在顶栏） */
  const browsingTitle = ref(null)
  /** @type {import('vue').Ref<'saved' | 'unsaved' | 'saving'>} */
  const documentSaveStatus = ref('saved')
  const isDocumentSaved = computed(() => documentSaveStatus.value === 'saved')
  const displayDocumentTitle = computed(
    () => browsingTitle.value || documentTitle.value || '未命名文档',
  )
  const newDocumentTick = ref(0)
  const hasOpenDocument = ref(false)
  /** @type {import('vue').Ref<{ path?: string, content: string, title?: string, format?: object | null } | null>} */
  const pendingExternalFile = ref(null)
  const documentSourcePath = ref('')
  const documentSourceMtime = ref(null)
  const documentSourceExtension = ref('')
  const saveStatusRefreshTick = ref(0)
  const libraryRefreshTick = ref(0)

  function toggleAiPanel() {
    aiPanelOpen.value = !aiPanelOpen.value
  }

  function toggleKnowledgePanel() {
    knowledgePanelOpen.value = !knowledgePanelOpen.value
    if (!knowledgePanelOpen.value) {
      browsingTitle.value = null
    }
  }

  function closeKnowledgePanel() {
    knowledgePanelOpen.value = false
    browsingTitle.value = null
  }

  function setBrowsingTitle(title) {
    const next = typeof title === 'string' ? title.trim() : ''
    browsingTitle.value = next || null
  }

  function clearBrowsingTitle() {
    browsingTitle.value = null
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

  /**
   * 仅在能从正文抽出标题时更新；避免空稿 / 无 H1 时把已有文件名标题冲掉。
   * @param {string | null | undefined} title
   */
  function setDocumentTitleIfPresent(title) {
    const next = title?.trim()
    if (!next || next === '未命名文档') return
    documentTitle.value = next
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
    browsingTitle.value = null
    documentSaveStatus.value = 'saved'
    lastSavedDocument.value = null
    clearDocumentSource()
  }

  /**
   * @param {{ path: string, mtimeMs?: number | null, extension?: string }} source
   */
  function setDocumentSource({ path, mtimeMs = null, extension } = {}) {
    documentSourcePath.value = path || ''
    documentSourceMtime.value = mtimeMs ?? null
    if (typeof extension === 'string' && extension) {
      documentSourceExtension.value = extension
    } else if (path) {
      const match = String(path).match(/(\.[A-Za-z0-9]+)$/)
      if (match) documentSourceExtension.value = match[1].toLowerCase()
    }
  }

  function clearDocumentSource() {
    documentSourcePath.value = ''
    documentSourceMtime.value = null
    documentSourceExtension.value = ''
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
    browsingTitle,
    displayDocumentTitle,
    setBrowsingTitle,
    clearBrowsingTitle,
    isDocumentSaved,
    documentSaveStatus,
    setDocumentTitle,
    setDocumentTitleIfPresent,
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
    documentSourceExtension,
    saveStatusRefreshTick,
    libraryRefreshTick,
    setDocumentSource,
    clearDocumentSource,
    bumpSaveStatusRefresh,
    bumpLibraryRefresh,
  }
})
