<script setup>
import { computed, defineAsyncComponent, inject, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { Save } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useEditorStore } from '@/stores/editor'
import { useTrayStore } from '@/stores/tray'
import { useUserHabitsStore } from '@/stores/userHabits'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import {
  useHtmlSourcePanelStore,
  DEFAULT_HTML_SOURCE_PANEL_WIDTH,
} from '@/stores/htmlSourcePanel'
import { useHtmlSourcePanelResize } from '@/composables/useHtmlSourcePanelResize'
import { hasHtmlImport } from '@/composables/useHtmlImporter'
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
import { shortcutTooltip, getShortcutLabel, useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { useWindowSize } from '@/composables/useWindowSize'
import { useToast } from '@/composables/useToast'
import { AI_CHAT_DOCKED } from '@/constants/floatingWindow'
import { useDockPanelResize } from '@/composables/useDockPanelResize'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'
import EditorCore from '@/components/editor/EditorCore.vue'
import HtmlSourceEditor from '@/components/editor/HtmlSourceEditor.vue'
import ExportMenu from '@/components/export/ExportMenu.vue'
import ExportTemplateIndicator from '@/components/export/ExportTemplateIndicator.vue'
import PackMenu from '@/components/zip/PackMenu.vue'
import KnowledgeTrigger from '@/components/knowledge/KnowledgeTrigger.vue'
import AiAssistantPlaceholder from '@/components/layout/AiAssistantPlaceholder.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SlideCopilotActionsHost from '@/components/slides/SlideCopilotActionsHost.vue'
import LessonPlanToPptDialog from '@/components/lesson/LessonPlanToPptDialog.vue'

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
const lessonPptTooltip = shortcutTooltip('教案生成课件', 'lessonToPpt')
const htmlSourceToggleTooltip = computed(() => {
  const baseLabel = htmlSourcePanelVisible.value ? '关闭 HTML 源码面板' : '编辑 HTML 源码'
  const hint = getShortcutLabel('toggleHtmlSourcePanel')
  return hint ? `${baseLabel} (${hint})` : baseLabel
})
const windowSize = useWindowSize()
const { isToolbarIconOnly } = windowSize

/**
 * AI 对话窗贴边（docked）状态。
 * 仅当 AI 对话窗处于 docked 模式且 visible 时才在右栏面板渲染 inline panel。
 */
const aiChatDockedState = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)
const aiChatDockTargetRef = ref(null)

/**
 * 将 docked 模式下的 AiChatWindow 挂载点提供给子组件（AiAssistantPlaceholder）。
 * 当 docked=false 时，A:AssistantPlaceholder 使用 :disabled 的 Teleport fallback 正常渲染到原位。
 */
provide('aiChatDockTarget', aiChatDockTargetRef)

/**
 * 教案生成课件注入：
 *  - AiAssistantPlaceholder 通过 inject('openLessonPlanDialog') 拿到本引用
 *  - 优先通过 inject 调用，确保 Pinia store 等响应式正确
 *  - 同步监听 window 事件作为兜底（处理跨 vue 实例 / 跨子树无法 inject 的场景）
 */
provide('openLessonPlanDialog', openLessonPlanToPptDialog)
const lessonPlanDialogEventHandler = (ev) => {
  // 只处理我们自己派发的事件，避免与其它功能冲突
  const source = ev?.detail?.source
  // AI 聊天面板与右键菜单已走 inject 路径，这里仅接管外部脚本调用
  if (source === 'external-tool' || source === 'shortcut-bridge') {
    try {
      openLessonPlanToPptDialog()
    } catch (err) {
      console.warn('[EditorLayout] openLessonPlanToPptDialog failed:', err)
    }
  }
}
function bindLessonPlanDialogWindowListener() {
  if (typeof window === 'undefined') return
  window.addEventListener('wpx:local-command:open-lesson-plan-dialog', lessonPlanDialogEventHandler)
}
function unbindLessonPlanDialogWindowListener() {
  if (typeof window === 'undefined') return
  window.removeEventListener('wpx:local-command:open-lesson-plan-dialog', lessonPlanDialogEventHandler)
}

/** 右栏宽度：未调整时根据 viewport 选择紧凑版或默认版（参考 AI_CHAT_DOCKED）；
 *  用户手动调整后（isCustomized）使用 composable 的 effectiveWidth。 */
const aiDockResize = useDockPanelResize({
  defaultWidth: AI_CHAT_DOCKED.defaultW,
  minWidth: AI_CHAT_DOCKED.minW,
  maxWidth: AI_CHAT_DOCKED.maxW,
  keyboardStep: AI_CHAT_DOCKED.keyboardStep,
  snapPoints: AI_CHAT_DOCKED.snapPoints,
  snapThreshold: AI_CHAT_DOCKED.snapThreshold,
})

const aiDockPanelWidth = computed(() => {
  if (aiDockResize.isCustomized.value) {
    return aiDockResize.effectiveWidth.value
  }
  return windowSize.isCompactWidth.value ? AI_CHAT_DOCKED.compactW : AI_CHAT_DOCKED.defaultW
})

/** 是否当前处于贴边模式且面板可见 */
const showAiDockPanel = computed(
  () => aiChatDockedState.isDocked.value && aiChatDockedState.visible.value,
)

const editorRef = ref(null)
provide('editorHostRef', editorRef)
const editorOutput = ref({ html: '', json: null, markdown: '' })

/**
 * HTML 源码编辑面板：
 *  - 仅在 currentEditor 含 htmlSource 时才显示 <>> 按钮
 *  - 点击按钮 toggle 面板可见性
 *  - 宽度通过 useHtmlSourcePanelResize 控制（同步到 store）
 *  - 切换文档时自动 syncWithDocument（hasHtmlSource=false → 关闭面板）
 */
const htmlSourcePanelStore = useHtmlSourcePanelStore()
const htmlSourceResize = useHtmlSourcePanelResize()

const htmlSourceAvailable = computed(() => {
  const ed = editorRef.value?.getEditor?.()
  return hasHtmlImport(ed)
})

const htmlSourcePanelVisible = computed(() => {
  return htmlSourceAvailable.value && htmlSourcePanelStore.visible
})

const htmlSourceEditorInstance = computed(() => editorRef.value?.getEditor?.() || null)
const htmlSourceInitialHtml = computed(
  () => htmlSourceEditorInstance.value?.state?.doc?.attrs?.htmlSource || '',
)

function toggleHtmlSourcePanel() {
  if (!htmlSourceAvailable.value) {
    // 快捷键可能绕过 UI 可见性，这里补一条降级提示
    toast.warning('当前文档未导入 HTML，无法编辑源码')
    return
  }
  htmlSourcePanelStore.toggle()
}

/**
 * 容器宽度 CSS 变量：仅在面板可见时生效。
 */
const workspaceStyle = computed(() => ({
  ...editorContainerStyle.value,
  '--wpx-html-source-panel-width': `${htmlSourcePanelVisible.value ? htmlSourceResize.effectiveWidth.value : DEFAULT_HTML_SOURCE_PANEL_WIDTH}px`,
}))

/**
 * 监听编辑器变化，文档无 htmlSource 时自动隐藏面板。
 */
watch(htmlSourceAvailable, (available) => {
  htmlSourcePanelStore.syncWithDocument(available)
})

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

/* ───────── 教案 → 课件（教师专用） ───────── */
import { useLessonPptStore } from '@/stores/lessonPpt'
import { usePPTWorkflow } from '@/composables/usePPTWorkflow'
const lessonPptStore = useLessonPptStore()
const pptWorkflow = usePPTWorkflow()
const lessonDialogVisible = ref(false)

function openLessonPlanToPptDialog() {
  if (!appStore.hasOpenDocument) {
    toast.warning('请先打开一份教案')
    return
  }
  const md = getMarkdown()
  if (!md || md.trim().length < 30) {
    toast.warning('教案内容过少，无法识别章节')
    return
  }
  lessonPptStore.openDialog()
  lessonDialogVisible.value = true
}

function onLessonDialogUpdate(visible) {
  lessonDialogVisible.value = visible
  if (!visible) lessonPptStore.closeDialog()
}

function onLessonDialogConfirm({ config, parseResult }) {
  // 1) 关闭弹窗
  lessonDialogVisible.value = false
  lessonPptStore.closeDialog()
  // 2) 提取首行作为主题
  const md = getMarkdown()
  const titleMatch = md.match(/^#\s+(.+)$/m)
  const topic = titleMatch ? titleMatch[1].trim() : getDefaultTitle() || '本节课'
  // 3) 启动工作流，注入 lesson-plan context 与学科配置
  pptWorkflow.startWorkflow(topic, {
    context: 'lesson-plan',
    lessonPlanConfig: {
      subject: config.subject,
      stage: config.stage,
      templateId: config.templateId,
      textbookVersion: config.textbookVersion,
      lessonNumber: config.lessonNumber,
      studentContext: config.studentContext,
      includeBlackboard: config.includeBlackboard,
      includeReflection: config.includeReflection,
      includeHomework: config.includeHomework,
      outline: parseResult?.outline || [],
      matchedTemplate: parseResult?.matchedTemplate || '',
    },
  })
  // 4) 打开 AI 助手，便于用户继续对话调整
  overlay.toggleAiPanel()
  toast.success(`已开始生成课件：${topic}`)
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
  onToggleHtmlSourcePanel: toggleHtmlSourcePanel,
  onLessonToPpt: openLessonPlanToPptDialog,
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
  bindLessonPlanDialogWindowListener()

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
  unbindLessonPlanDialogWindowListener()
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
    :style="workspaceStyle"
    :data-focus-mode="focusModeActive ? 'true' : 'false'"
    :data-paper-size="userPreferencesStore.paper?.paperSize || 'none'"
    :data-ai-docked="showAiDockPanel ? 'true' : 'false'"
    :data-html-source-panel="htmlSourcePanelVisible ? 'true' : 'false'"
  >
    <div class="editor-layout__workspace">
      <HtmlSourceEditor
        v-if="htmlSourcePanelVisible"
        :editor="htmlSourceEditorInstance"
        :initial-html="htmlSourceInitialHtml"
      />
      <div
        v-if="htmlSourcePanelVisible"
        class="editor-layout__source-resizer"
        :class="{ 'editor-layout__source-resizer--resizing': htmlSourceResize.isResizing.value }"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整 HTML 源码面板宽度"
        :aria-valuenow="htmlSourceResize.effectiveWidth.value"
        :aria-valuemin="htmlSourceResize.minWidth"
        :aria-valuemax="htmlSourceResize.maxWidth"
        tabindex="0"
        data-testid="html-source-resizer"
        @mousedown="htmlSourceResize.startResize"
        @keydown="htmlSourceResize.handleKeydown"
      />
      <main class="editor-layout__main">
        <div
          class="editor-layout__editor"
          :class="{
            'editor-layout__editor--empty': !appStore.hasOpenDocument,
            'editor-layout__editor--focus': focusModeActive,
            'editor-layout__editor--ai-docked': showAiDockPanel,
          }"
          @mousedown="floatingWindows.handleEditorAreaClick()"
        >
          <EmptyState
            v-if="!appStore.hasOpenDocument"
            @create="handleEmptyStateCreate"
            @import="handleEmptyStateImport"
            @use-template="handleTemplateCreate"
          />
          <EditorCore v-else ref="editorRef" @change="onEditorChange" @lesson-to-ppt-open="openLessonPlanToPptDialog">
            <template #toolbar-actions>
              <button
                type="button"
                class="editor-layout__lesson-btn wpx-btn"
                :title="lessonPptTooltip"
                :aria-label="lessonPptTooltip"
                data-testid="lesson-to-ppt-btn"
                @click="openLessonPlanToPptDialog"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M3 9h18" stroke-linecap="round" />
                  <path d="M8 14h5" stroke-linecap="round" />
                </svg>
              </button>
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
              <button
                v-if="htmlSourceAvailable"
                type="button"
                class="editor-toolbar__btn editor-toolbar__btn--html-source"
                :class="{ 'editor-toolbar__btn--active': htmlSourcePanelVisible }"
                :title="htmlSourceToggleTooltip"
                :aria-label="htmlSourceToggleTooltip"
                :aria-pressed="htmlSourcePanelVisible ? 'true' : 'false'"
                data-testid="html-source-toggle"
                @click="toggleHtmlSourcePanel"
              >
                <span aria-hidden="true">&lt;/&gt;</span>
                <span v-if="!isToolbarIconOnly" class="ml-1">源码</span>
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

      <!--
        AI 助手贴边容器（docked 模式）：
          - 只在 docked=true 且 visible=true 时渲染。
          - 子组件 AiAssistantPlaceholder 会把 AiChatWindow Teleport 到这个节点。
          - 高度与 workspace 同步，撑满垂直空间。
        分隔条（resizer）：
          - 鼠标拖拽改变右栏宽度（mousedown → mousemove → mouseup）。
          - 键盘 Arrow/Home/End + Shift 加速调整。
          - 释放后按 snapPoints 自动吸附。
      -->
      <div
        v-if="showAiDockPanel"
        class="editor-layout__ai-dock-resizer"
        :class="{ 'editor-layout__ai-dock-resizer--resizing': aiDockResize.isResizing.value }"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整 AI 助手面板宽度"
        :aria-valuenow="aiDockPanelWidth"
        :aria-valuemin="AI_CHAT_DOCKED.minW"
        :aria-valuemax="AI_CHAT_DOCKED.maxW"
        :aria-valuetext="`${aiDockPanelWidth} 像素`"
        :title="`拖动调整 AI 助手面板宽度（${aiDockPanelWidth}px）`"
        tabindex="0"
        @mousedown="aiDockResize.startResize"
        @keydown="aiDockResize.handleKeydown"
      />
      <aside
        v-if="showAiDockPanel"
        ref="aiChatDockTargetRef"
        class="editor-layout__ai-dock"
        :style="{ '--ai-dock-width': `${aiDockPanelWidth}px` }"
        aria-label="AI 助手贴边面板"
      />
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

    <LessonPlanToPptDialog
      :visible="lessonDialogVisible"
      :markdown="getMarkdown()"
      @update:visible="onLessonDialogUpdate"
      @confirm="onLessonDialogConfirm"
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

/*
 * 焦点写作模式下保留 AI「对齐图片」指令的语义：
 *  - fill 模式仍占满文本区域宽度（100%）
 *  - narrow 模式为窄边距居中（65%）
 *  - keep / 未设置时回落 width: auto（默认原始尺寸）
 * 同时复位 margin-left/right：避免 .editor-prose max-width 限制时双侧自动外边距失效。
 */
.editor-layout__editor--focus :deep(.editor-prose .editor-image[data-float='none']) {
  margin: 0.75rem auto;
}

.editor-layout__editor--focus
  :deep(.editor-prose .editor-image[data-float='none'][data-fill='fill']) {
  width: 100%;
}

.editor-layout__editor--focus
  :deep(.editor-prose .editor-image[data-float='none'][data-fill='narrow']) {
  width: 65%;
}

.editor-layout__editor--focus
  :deep(.editor-prose .editor-image[data-float='none'][data-fill='keep']) {
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

/*
 * “生成课件”始终为图标按钮，参照 .editor-layout__pdf-btn--icon-only 模式。
 * 原实现依赖 :class="{ '...--icon-only': isToolbarIconOnly }" 动态切换；
 * 在窗口非变窄状态会渲染「生成课件」文字，导致工具栏过于拥挤。
 * 改造点：
 *   1) 始终 28x28 图标按钮，占位稳定不变形；
 *   2) 文字提示依赖 :title / :aria-label（不占布局空间）；
 *   3) 视觉与保存、PDF 导入等兄弟按钮保持一致。
 */
.editor-layout__lesson-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  background: var(--theme-bg);
  color: var(--theme-fg);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.editor-layout__lesson-btn:hover {
  background: var(--theme-bg-muted);
  border-color: color-mix(in srgb, var(--theme-accent) 35%, var(--theme-border));
  color: var(--theme-accent);
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

/* ── AI 助手贴边（docked）右栏 ── */
.editor-layout__ai-dock {
  flex-shrink: 0;
  width: var(--ai-dock-width, 400px);
  min-width: var(--ai-dock-width, 400px);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--theme-bg, #fff);
  border-left: 1px solid var(--theme-border, #e2e8f0);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* 当 docked 右栏出现时，为主编辑器区预留右侧空间 */
.editor-layout__editor--ai-docked {
  padding-right: 8px;
}

/* ── AI 助手贴边右栏拖拽手柄（resizer）── */
.editor-layout__ai-dock-resizer {
  flex-shrink: 0;
  /* 主区与右栏之间设置 4px 热区，两侧边缘预留 2px 叠加，避免出现双线。 */
  width: 4px;
  height: 100%;
  margin-left: -2px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 2;
  /* 避免选中拖拽区域中的文本/子元素 */
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 0.15s ease;
}

.editor-layout__ai-dock-resizer:hover,
.editor-layout__ai-dock-resizer:focus-visible {
  background: var(--theme-accent, #7c3aed);
  outline: none;
}

.editor-layout__ai-dock-resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 28px;
  border-radius: 1px;
  background: var(--theme-border, #e2e8f0);
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.editor-layout__ai-dock-resizer:hover::after,
.editor-layout__ai-dock-resizer:focus-visible::after {
  background: rgba(255, 255, 255, 0.85);
  opacity: 1;
}

.editor-layout__ai-dock-resizer--resizing {
  background: var(--theme-accent, #7c3aed) !important;
}

.editor-layout__ai-dock-resizer--resizing::after {
  background: rgba(255, 255, 255, 0.95);
  opacity: 1;
}
</style>
