<script setup>
import { computed, defineAsyncComponent, inject, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { Save } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useEditorStore } from '@/stores/editor'
import { useTrayStore } from '@/stores/tray'
import { useUserHabitsStore } from '@/stores/userHabits'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { provideEditorOverlay } from '@/composables/useEditorOverlay'
import { useAutoSave } from '@/composables/useAutoSave'
import { useElectronFileOpen } from '@/composables/useElectronFileOpen'
import { useLaunchDocument } from '@/composables/useLaunchDocument'
import { useWindowCloseInterceptor } from '@/composables/useWindowCloseInterceptor'
import {
  refreshDocumentSaveStatusOnFocus,
  syncDocumentSource,
} from '@/composables/useDocumentFocusRefresh'
import { useUserHabits } from '@/composables/useUserHabits'
import { useEditorFonts } from '@/composables/useEditorFonts'
import { shortcutTooltip, useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { useWindowSize } from '@/composables/useWindowSize'
import { useToast } from '@/composables/useToast'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'
import EditorCore from '@/components/editor/EditorCore.vue'
import ExportMenu from '@/components/export/ExportMenu.vue'
import ExportTemplateIndicator from '@/components/export/ExportTemplateIndicator.vue'
import PackMenu from '@/components/zip/PackMenu.vue'
import KnowledgeTrigger from '@/components/knowledge/KnowledgeTrigger.vue'
import AiAssistantPlaceholder from '@/components/layout/AiAssistantPlaceholder.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SlideCopilotActionsHost from '@/components/slides/SlideCopilotActionsHost.vue'

// 异步加载重型组件（减少初始 chunk）
const KnowledgePanel = defineAsyncComponent(() =>
  import('@/components/knowledge/KnowledgePanel.vue')
)
const ImageEditor = defineAsyncComponent(() =>
  import('@/components/image/ImageEditor.vue')
)
const CloseConfirmDialog = defineAsyncComponent(() =>
  import('@/components/library/CloseConfirmDialog.vue')
)
const SaveDialog = defineAsyncComponent(() =>
  import('@/components/library/SaveDialog.vue')
)
const PdfImportDialog = defineAsyncComponent(() =>
  import('@/components/editor/PdfImportDialog.vue')
)
import { extractTitleFromMarkdown } from '@/utils/libraryApi'
import { markdownToHtml } from '@/utils/markdownToEditor'
import { toEditorContent } from '@/utils/aiSelection'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { zipFeatureAvailable } from '@/utils/zipApi'
import { getDocPathFromUrl } from '@/utils/windowContext'
import { useWindowStore } from '@/stores/window'
import {
  getPaperWidthPx,
  isFocusModeApplicable,
} from '@/constants/paperPreferences'
import {
  cancelWindowClose,
  confirmWindowClose,
} from '@/utils/windowControls'

const KNOWLEDGE_PANEL_WIDTH = 320

const appStore = useAppStore()
const editorStore = useEditorStore()
const trayStore = useTrayStore()
const habitsStore = useUserHabitsStore()
const windowStore = useWindowStore()
const userPreferencesStore = useUserPreferencesStore()
const floatingWindows = useFloatingWindows()
const overlay = provideEditorOverlay()
const toast = useToast()
const { applyFontToEditor } = useEditorFonts()
const zipArchiveHost = inject('zipArchiveHost', ref(null))
const { applyFormat } = useUserHabits()

const {
  knowledgePanelOpen,
  imageEditSession,
  closeKnowledgePanel,
  closeImageEdit,
  completeImageEdit,
  toggleAiPanel,
} = overlay

const saveTooltip = shortcutTooltip('保存到文库', 'save')
const windowSize = useWindowSize()
const { isToolbarIconOnly } = windowSize

const editorRef = ref(null)
provide('editorHostRef', editorRef)
const editorOutput = ref({ html: '', json: null, markdown: '' })
const closeConfirmVisible = ref(false)
const closeSaveDialogVisible = ref(false)
const closeFlowSaving = ref(false)
const packing = ref(false)
const pdfImportVisible = ref(false)
let closeCheckInProgress = false
let unsubscribeAiChatToggle = null

const focusModeActive = computed(() =>
  isFocusModeApplicable(
    userPreferencesStore.paper?.focusMode === true,
    userPreferencesStore.paper?.paperSize,
  ),
)
const focusModePaperWidthPx = computed(() => getPaperWidthPx(userPreferencesStore.paper?.paperSize))
const editorContainerStyle = computed(() => ({
  '--knowledge-panel-width': `${KNOWLEDGE_PANEL_WIDTH}px`,
  '--wpx-paper-width': `${focusModePaperWidthPx.value}px`,
}))

const { scheduleAutoSave } = useAutoSave(() => ({
  content: getMarkdown(),
  title: getDefaultTitle(),
}))

function onEditorChange(payload) {
  editorOutput.value = payload
  appStore.setDocumentTitle(getDefaultTitle())
  scheduleAutoSave()
}

function getMarkdown() {
  return editorRef.value?.getMarkdown() || editorOutput.value.markdown || ''
}

function getFormatSnapshot() {
  return editorRef.value?.getFormatSnapshot?.() || null
}

function getDefaultTitle() {
  return extractTitleFromMarkdown(getMarkdown())
}

function openSaveDialog() {
  appStore.openSaveDialog({
    content: getMarkdown(),
    defaultTitle: getDefaultTitle(),
  })
}

async function handlePackDocument(payload) {
  const host = zipArchiveHost.value
  if (!host?.packDocument) return

  packing.value = true
  try {
    await host.packDocument(payload)
  } finally {
    packing.value = false
  }
}

function openPdfImportDialog() {
  pdfImportVisible.value = true
}

function handlePdfImportConfirm(payload) {
  if (!payload?.markdown) return
  editorStore.requestKnowledgeImport({
    mode: 'insert',
    content: payload.markdown,
    title: payload.title || 'PDF 导入',
    type: 'markdown',
  })
  pdfImportVisible.value = false
  toast.success(
    payload.mode === 'ocr'
      ? `已 OCR 导入 ${payload.pageCount} 页 PDF`
      : `已提取 ${payload.pageCount} 页 PDF 文本`,
  )
}

function createNewDocument(template = null) {
  appStore.openDocument()
  nextTick(() => {
    editorRef.value?.loadMarkdown('')
    editorOutput.value = { html: '', json: null, markdown: '' }
    appStore.resetDocumentState()
    editorStore.clearPendingReplace()

    if (template?.format) {
      nextTick(() => applyFormat(template.format))
    }

    if (template?.documentType) {
      habitsStore.setSessionDocumentType(template.documentType)
    }
  })
}

function handleEmptyStateCreate() {
  createNewDocument()
}

function handleEmptyStateImport() {
  overlay.openKnowledgePanel()
}

function handleTemplateCreate(template) {
  createNewDocument(template)
}

function openExternalDocument(payload) {
  appStore.openDocument()
  nextTick(async () => {
    editorRef.value?.loadMarkdown(payload.content || '')
    editorOutput.value = {
      html: '',
      json: null,
      markdown: payload.content || '',
    }
    if (payload.title) {
      appStore.setDocumentTitle(payload.title)
    }
    appStore.markDocumentDirty()

    const sourcePath = payload.path || getDocPathFromUrl()
    if (sourcePath) {
      await syncDocumentSource(sourcePath)
    }
  })
}

useElectronFileOpen(openExternalDocument)

function hasUnsavedChanges() {
  if (!appStore.hasOpenDocument) return false
  if (appStore.documentSaveStatus === 'unsaved' || appStore.documentSaveStatus === 'saving') {
    return true
  }

  const tiptapEditor = editorRef.value?.getEditor?.()
  if (tiptapEditor?.storage?.collab?.isDirty === true) {
    return true
  }

  return false
}

function resetCloseFlow() {
  closeCheckInProgress = false
  closeConfirmVisible.value = false
  closeSaveDialogVisible.value = false
  closeFlowSaving.value = false
}

function handleWindowCloseCheck() {
  if (closeCheckInProgress) return
  closeCheckInProgress = true

  if (!hasUnsavedChanges()) {
    resetCloseFlow()
    confirmWindowClose()
    return
  }

  closeConfirmVisible.value = true
}

function handleCloseConfirmDiscard() {
  resetCloseFlow()
  confirmWindowClose()
}

function handleCloseConfirmCancel() {
  resetCloseFlow()
  cancelWindowClose()
}

function handleCloseConfirmSave() {
  closeConfirmVisible.value = false
  closeSaveDialogVisible.value = true
}

function handleCloseSaveDialogSaved(item) {
  appStore.notifyDocumentSaved(item)
  trayStore.addRecentDocument(item)
  resetCloseFlow()
  confirmWindowClose()
}

function handleCloseSaveDialogClose() {
  if (closeFlowSaving.value) return
  closeSaveDialogVisible.value = false
  closeCheckInProgress = false
  cancelWindowClose()
}

function handleBeforeUnload(event) {
  if (!isElectron() && hasUnsavedChanges()) {
    event.preventDefault()
    event.returnValue = ''
  }
}

useWindowCloseInterceptor(handleWindowCloseCheck)

useLaunchDocument({
  onOpen: openExternalDocument,
  onBlank: () => createNewDocument(),
})

useGlobalShortcuts({
  onNewDocument: () => {
    if (isElectron()) return
    createNewDocument()
  },
  onSave: openSaveDialog,
  onToggleAiChat: () => toggleAiPanel(),
  onOpenImageEditor: () => editorRef.value?.openImageEditor?.(),
  getEditor: () => editorRef.value?.getEditor?.(),
})

let handledNewDocumentTick = 0

function tryHandleNewDocument(tick = appStore.newDocumentTick) {
  if (tick <= handledNewDocumentTick) return
  handledNewDocumentTick = tick
  createNewDocument()
}

watch(() => appStore.newDocumentTick, tryHandleNewDocument)

watch(() => windowStore.focusGeneration, () => {
  refreshDocumentSaveStatusOnFocus()
})

onMounted(() => {
  tryHandleNewDocument()
  applyPendingKnowledgeImport()
  window.addEventListener('beforeunload', handleBeforeUnload)

  if (windowStore.isWindowFocused) {
    refreshDocumentSaveStatusOnFocus()
  }

  if (isElectron()) {
    const api = getElectronAPI()
    if (typeof api?.onAiChatToggle === 'function') {
      unsubscribeAiChatToggle = api.onAiChatToggle(() => {
        toggleAiPanel()
      })
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  unsubscribeAiChatToggle?.()
  unsubscribeAiChatToggle = null
})

function handleImageEditorApply(blob) {
  completeImageEdit(blob)
}

function handleImageEditorCancel() {
  closeImageEdit()
}

watch(
  () => editorStore.imageEditSession,
  (session) => {
    if (session) {
      floatingWindows.openWindow(FLOATING_WINDOW_ID.IMAGE_EDITOR)
      return
    }
    if (floatingWindows.isOpen(FLOATING_WINDOW_ID.IMAGE_EDITOR)) {
      floatingWindows.closeWindow(FLOATING_WINDOW_ID.IMAGE_EDITOR)
    }
  },
)

async function waitForEditorInstance(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const editor = editorRef.value?.getEditor?.()
    if (editor) return editor
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return null
}

function getKnowledgeDocumentTitle(title, content) {
  const fromFilename = title?.replace(/\.[^.]+$/i, '').trim()
  if (fromFilename) return fromFilename
  return extractTitleFromMarkdown(content) || '未命名文档'
}

function buildKnowledgeInsertContent(content, type) {
  if (type === 'markdown') {
    return markdownToHtml(content)
  }
  return toEditorContent(content)
}

async function handleKnowledgeOpenAsDocument({ content, title, type }) {
  appStore.openDocument()
  await nextTick()
  editorRef.value?.loadMarkdown(content || '')
  editorOutput.value = {
    html: '',
    json: null,
    markdown: content || '',
  }
  appStore.setDocumentTitle(getKnowledgeDocumentTitle(title, content))
  appStore.clearDocumentSource()
  appStore.markDocumentDirty()
  closeKnowledgePanel()
  toast.success('已作为新文档打开')
}

async function handleKnowledgeInsert({ content, type }) {
  if (!appStore.hasOpenDocument) {
    appStore.openDocument()
    await nextTick()
    editorRef.value?.loadMarkdown?.('')
    editorOutput.value = { html: '', json: null, markdown: '' }
  }

  await nextTick()

  const ed = await waitForEditorInstance()
  if (!ed) {
    toast.error('编辑器未就绪，无法插入内容')
    return
  }

  ed.chain().focus().insertContent(buildKnowledgeInsertContent(content, type)).run()
  editorOutput.value = {
    html: ed.getHTML(),
    json: ed.getJSON(),
    markdown: editorRef.value?.getMarkdown() || '',
  }
  appStore.markDocumentDirty()
  scheduleAutoSave()
  toast.success('已插入编辑器')
}

async function applyPendingKnowledgeImport() {
  const request = editorStore.pendingKnowledgeImport
  if (!request) return

  try {
    if (request.mode === 'open') {
      await handleKnowledgeOpenAsDocument(request)
    } else {
      await handleKnowledgeInsert(request)
    }
  } finally {
    editorStore.clearPendingKnowledgeImport()
  }
}

watch(() => editorStore.pendingKnowledgeImport, applyPendingKnowledgeImport, { flush: 'post' })

/**
 * 监听来自 PPT 工作流最后一页的“插入 SlideDeck”请求。
 * 调用 SlideDeckNode 扩展提供的 insertSlideDeck 命令，在当前光标处插入幻灯片节点。
 */
async function applyPendingSlideDeckInsert() {
  const request = editorStore.pendingSlideDeckInsert
  if (!request || !Array.isArray(request.slides) || request.slides.length === 0) {
    return
  }

  try {
    if (!appStore.hasOpenDocument) {
      appStore.openDocument()
      await nextTick()
      editorRef.value?.loadMarkdown?.('')
      editorOutput.value = { html: '', json: null, markdown: '' }
    }

    await nextTick()
    const ed = await waitForEditorInstance()
    if (!ed) {
      toast.error('编辑器未就绪，无法插入幻灯片')
      return
    }

    const inserted = ed.chain()
      .focus()
      .insertSlideDeck({
        slides: JSON.stringify(request.slides),
        theme: request.theme || 'light',
      })
      .run()

    if (!inserted) {
      toast.error('插入幻灯片失败：当前编辑器不支持 SlideDeck 节点')
      return
    }

    editorOutput.value = {
      html: ed.getHTML(),
      json: ed.getJSON(),
      markdown: editorRef.value?.getMarkdown() || '',
    }
    appStore.markDocumentDirty()
    scheduleAutoSave()
    const total = request.slides.length
    toast.success(`已插入 ${total} 页幻灯片到编辑器`)
  } finally {
    editorStore.clearPendingSlideDeckInsert()
  }
}

watch(() => editorStore.pendingSlideDeckInsert, applyPendingSlideDeckInsert, { flush: 'post' })

watch(
  () => editorStore.pendingFontApply,
  async (request) => {
    if (!request?.fontItem) return

    if (!appStore.hasOpenDocument) {
      appStore.openDocument()
      await nextTick()
      editorRef.value?.loadMarkdown?.('')
      editorOutput.value = { html: '', json: null, markdown: '' }
    }

    await nextTick()

    const editor = await waitForEditorInstance()
    if (!editor) {
      toast.error('编辑器未就绪，无法应用字体')
      editorStore.clearPendingFontApply()
      return
    }

    const applied = await applyFontToEditor(editor, request.fontItem)
    editorStore.clearPendingFontApply()

    if (!applied) {
      toast.error('应用字体失败')
    }
  },
)
</script>

<template>
  <div
    class="editor-layout"
    :style="editorContainerStyle"
    :data-focus-mode="focusModeActive ? 'true' : 'false'"
    :data-paper-size="userPreferencesStore.paper?.paperSize || 'none'"
  >
    <div class="editor-layout__workspace">
      <main class="editor-layout__main">
        <div
          class="editor-layout__editor"
          :class="{
            'editor-layout__editor--empty': !appStore.hasOpenDocument,
            'editor-layout__editor--focus': focusModeActive,
          }"
          @mousedown="floatingWindows.handleEditorAreaClick()"
        >
          <EmptyState
            v-if="!appStore.hasOpenDocument"
            @create="handleEmptyStateCreate"
            @import="handleEmptyStateImport"
            @use-template="handleTemplateCreate"
          />
          <EditorCore v-else ref="editorRef" @change="onEditorChange">
            <template #toolbar-actions>
              <button
                type="button"
                class="editor-layout__pdf-btn wpx-btn"
                :class="{ 'editor-layout__pdf-btn--icon-only': isToolbarIconOnly }"
                title="导入 PDF（含扫描版 OCR）"
                aria-label="导入 PDF（含扫描版 OCR）"
                @click="openPdfImportDialog"
              >
                <svg
                  v-if="isToolbarIconOnly"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  aria-hidden="true"
                >
                  <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke-linejoin="round" />
                  <path d="M14 3v5h5" stroke-linejoin="round" />
                  <path d="M9 14h6M9 17h4" stroke-linecap="round" />
                </svg>
                <span v-else>导入 PDF</span>
              </button>
              <button
                type="button"
                class="editor-layout__save-btn wpx-btn"
                :class="{ 'editor-layout__save-btn--icon-only': isToolbarIconOnly }"
                :title="saveTooltip"
                :aria-label="saveTooltip"
                @click="openSaveDialog"
              >
                <Save v-if="isToolbarIconOnly" :size="16" aria-hidden="true" />
                <span v-else>保存</span>
              </button>
              <ExportMenu
                :get-markdown="getMarkdown"
                :get-format-snapshot="getFormatSnapshot"
                :get-editor="() => editorRef.value?.getEditor?.()"
                :get-document-title="getDefaultTitle"
                :icon-only="isToolbarIconOnly"
                filename="document"
              />
              <PackMenu
                v-if="isElectron() && zipFeatureAvailable()"
                :get-markdown="getMarkdown"
                :get-document-path="() => appStore.documentSourcePath || getDocPathFromUrl()"
                :icon-only="isToolbarIconOnly"
                :loading="packing"
                @pack="handlePackDocument"
              />
            </template>
          </EditorCore>
        </div>
      </main>
    </div>

    <div class="editor-layout__overlays" aria-hidden="false">
      <KnowledgePanel
        :open="knowledgePanelOpen"
        @close="closeKnowledgePanel()"
      />
      <KnowledgeTrigger />
      
      <AiAssistantPlaceholder />
      
      <SlideCopilotActionsHost />
      
      <ExportTemplateIndicator />

      <Transition name="image-editor-pop">
        <ImageEditor
          v-if="imageEditSession"
          :image-url="imageEditSession.src"
          :style="{ zIndex: floatingWindows.getZIndex(FLOATING_WINDOW_ID.IMAGE_EDITOR) }"
          @apply="handleImageEditorApply"
          @cancel="handleImageEditorCancel"
          @mousedown="floatingWindows.handleWindowFocus(FLOATING_WINDOW_ID.IMAGE_EDITOR)"
        />
      </Transition>
    </div>

    <CloseConfirmDialog
      :visible="closeConfirmVisible"
      :saving="closeFlowSaving"
      @save="handleCloseConfirmSave"
      @discard="handleCloseConfirmDiscard"
      @cancel="handleCloseConfirmCancel"
    />

    <SaveDialog
      :visible="closeSaveDialogVisible"
      :content="getMarkdown()"
      :default-title="getDefaultTitle()"
      @close="handleCloseSaveDialogClose"
      @saved="handleCloseSaveDialogSaved"
    />

    <PdfImportDialog
      :visible="pdfImportVisible"
      @close="pdfImportVisible = false"
      @confirm="handlePdfImportConfirm"
    />
  </div>
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
  position: relative;
  background: var(--theme-bg);
  color: var(--theme-fg);
}

.editor-layout__workspace {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.editor-layout__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.editor-layout__editor {
  flex: 1;
  min-height: 0;
  padding: 0 16px 24px;
}

.editor-layout__editor--empty {
  display: flex;
  padding: 0 16px 24px;
  min-height: calc(100vh - var(--title-bar-height, 36px));
}

/* ── 焦点写作模式 ── */
.editor-layout__editor--focus {
  background: var(--wpx-focus-mode-bg, #f0f0f0);
  padding: 24px 16px 32px;
  transition: background-color 0.3s ease, padding 0.3s ease;
}

.editor-layout__editor--focus :deep(.editor-shell) {
  margin: 0 auto;
  max-width: var(--wpx-paper-width, 794px);
  min-height: calc(100vh - var(--title-bar-height, 36px) - 64px);
  box-shadow: var(--wpx-focus-mode-paper-shadow);
  transition:
    max-width 0.3s ease,
    box-shadow 0.3s ease;
}

.editor-layout__editor--focus :deep(.editor-toolbar) {
  border-radius: 10px 10px 0 0;
}

.editor-layout__editor--focus :deep(.editor-drop-zone),
.editor-layout__editor--focus :deep(.editor-content) {
  background: var(--theme-surface, #fff);
  border-radius: 0 0 10px 10px;
}

.editor-layout__editor--focus :deep(.editor-prose) {
  max-width: var(--wpx-paper-width, 794px);
  margin: 0 auto;
  padding: 32px 40px;
  transition: max-width 0.3s ease, padding 0.3s ease;
}

/* 图片、表格、代码块不设 max-width 约束，允许超出纸张宽度 */
.editor-layout__editor--focus :deep(.editor-prose img),
.editor-layout__editor--focus :deep(.editor-prose .editor-image),
.editor-layout__editor--focus :deep(.editor-prose figure),
.editor-layout__editor--focus :deep(.editor-prose .editor-table),
.editor-layout__editor--focus :deep(.editor-prose table),
.editor-layout__editor--focus :deep(.editor-prose pre) {
  max-width: none;
  width: auto;
}

.editor-layout__editor :deep(.editor-shell) {
  min-height: calc(100vh - var(--title-bar-height, 36px));
  display: flex;
  flex-direction: column;
  border-color: var(--theme-border);
  background: var(--theme-surface);
  box-shadow: var(--theme-shadow-sm);
}

.editor-layout__editor :deep(.editor-content) {
  flex: 1 1 auto;
  min-height: 0;
}

.editor-layout__save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: var(--theme-fg);
  background: var(--theme-bg);
  cursor: pointer;
}

.editor-layout__save-btn:hover {
  background: var(--theme-bg-muted);
  border-color: var(--theme-accent);
  color: var(--theme-accent);
}

.editor-layout__save-btn--icon-only {
  width: 28px;
  padding: 0;
}

.editor-layout__pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: var(--theme-fg);
  background: var(--theme-bg);
  cursor: pointer;
}

.editor-layout__pdf-btn:hover {
  background: var(--theme-bg-muted);
  border-color: var(--theme-accent);
  color: var(--theme-accent);
}

.editor-layout__pdf-btn--icon-only {
  width: 28px;
  padding: 0;
}

.editor-layout__overlays {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* 勿对全部子节点启用 pointer-events：AI 对话窗/ImageEditor 宿主层为 inset:0，会拦截整页点击 */
</style>
