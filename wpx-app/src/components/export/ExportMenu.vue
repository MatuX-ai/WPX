<script setup>
import { onMounted, onUnmounted, ref, watch, inject, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { downloadBlob, exportViaApi } from '@/utils/documentExport'
import {
  analyzeExportFonts,
  collectDocumentEmbedFonts,
  detectCommercialFontUsage,
  getCommercialFontIdSet,
  replaceCommercialFontsInEditor,
  resolveSourceHanSansFamily,
} from '@/utils/exportFontAnalysis'
import { consumeTokensForExport } from '@/utils/tokenApi'
import { normalizeHtmlPrintPaper } from '@/constants/htmlPrintPaper'
import { useAuth } from '@/composables/useAuth'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useUserHabits } from '@/composables/useUserHabits'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import ExportFontConfirm from '@/components/fonts/ExportFontConfirm.vue'
import ExportOptionsConfirm from '@/components/export/ExportOptionsConfirm.vue'
import ExportHtmlOptionsConfirm from '@/components/export/ExportHtmlOptionsConfirm.vue'

const props = defineProps({
  getMarkdown: {
    type: Function,
    required: true,
  },
  getFormatSnapshot: {
    type: Function,
    default: null,
  },
  getEditor: {
    type: Function,
    default: null,
  },
  getDocumentTitle: {
    type: Function,
    default: null,
  },
  filename: {
    type: String,
    default: 'document',
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const authStore = useAuthStore()
const userPreferencesStore = useUserPreferencesStore()
const { isGuest } = storeToRefs(authStore)
const { login, isLoggingIn } = useAuth()
const { recordSave, getRecentDocumentTypes } = useUserHabits()
const { isOffline, networkRequiredTooltip } = useOnlineStatus()
const toast = useToast()

const EXPORT_OPTIONS = [
  { key: 'markdown', label: '导出 Markdown', format: null, requiresNetwork: false },
  { key: 'docx', label: '导出 Word (.docx)', format: 'docx', requiresNetwork: true },
  { key: 'pdf', label: '导出 PDF', format: 'pdf', requiresNetwork: true },
  { key: 'html', label: '导出 HTML', format: 'html', requiresNetwork: true },
]

const menuRef = ref(null)
const isOpen = ref(false)
const loading = ref(false)
const confirmLoading = ref(false)
const errorMessage = ref('')
const documentType = ref('')
const recentTypes = ref([])

const exportConfirmVisible = ref(false)
const exportAnalysis = ref(null)
const pendingExportOption = ref(null)
const optionsConfirmVisible = ref(false)
const pendingExportOptions = ref(null)
const htmlOptionsConfirmVisible = ref(false)
const pendingHtmlExportOptions = ref(null)
const headingCount = ref(0)
/** @type {import('vue').Ref<{ getEditor?: () => unknown } | null> | null} */
const editorHostRef = inject('editorHostRef', null)

const defaultPaperOptions = computed(() => {
  const paper = userPreferencesStore.paper || {}
  return {
    paperSize: paper.paperSize,
    paperMargin: paper.paperMargin,
    customMargin: paper.customMargin,
    headerFooter: paper.headerFooter,
    autoPaginate: true,
    fitImagesToWidth: true,
    generateToc: false,
  }
})

const defaultHtmlOptions = computed(() => ({
  documentMode: 'full',
  fitImagesToWidth: true,
  autoPaginate: true,
  generateToc: false,
  printPaper: 'A4',
}))

function resolveExportEditor() {
  const fromProp = props.getEditor?.()
  if (fromProp) return fromProp
  return editorHostRef?.value?.getEditor?.() ?? null
}

function refreshRecentTypes() {
  recentTypes.value = getRecentDocumentTypes()
}

function toggleMenu(event) {
  event.stopPropagation()
  if (loading.value || confirmLoading.value) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    refreshRecentTypes()
  }
}

function closeMenu() {
  isOpen.value = false
}

function closeExportConfirm() {
  exportConfirmVisible.value = false
  exportAnalysis.value = null
  pendingExportOption.value = null
}

function dismissExportConfirm() {
  if (confirmLoading.value) return
  closeExportConfirm()
}

function closeOptionsConfirm() {
  if (loading.value) return
  optionsConfirmVisible.value = false
  pendingExportOptions.value = null
}

function closeHtmlOptionsConfirm() {
  if (loading.value) return
  htmlOptionsConfirmVisible.value = false
  pendingHtmlExportOptions.value = null
}

function countHeadingsInMarkdown(markdown) {
  if (!markdown) return 0
  const lines = markdown.split(/\r?\n/)
  let count = 0
  for (const line of lines) {
    if (/^\s{0,3}#{1,6}\s+\S/.test(line)) {
      count += 1
    }
  }
  return count
}

function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    closeMenu()
  }
}

function isExportOptionDisabled(option) {
  return Boolean(option.requiresNetwork && isOffline.value)
}

function exportOptionTitle(option) {
  if (isExportOptionDisabled(option)) return networkRequiredTooltip
  return option.label
}

function applyRecentType(type) {
  documentType.value = type
}

function resolveDocumentTitle() {
  return props.getDocumentTitle?.() || props.filename || '未命名文档'
}

async function performExport(option, exportOptions = null) {
  const markdown = props.getMarkdown()
  if (!markdown?.trim()) {
    const message = '文档内容为空，无法导出'
    errorMessage.value = message
    toast.warning(message)
    return
  }

  const typeLabel = documentType.value.trim()
  if (typeLabel) {
    recordSave(typeLabel, props.getFormatSnapshot?.())
    refreshRecentTypes()
  }

  if (!option.format) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, `${props.filename}.md`)
    return
  }

  const editor = resolveExportEditor()
  const embedFonts =
    editor && (option.format === 'pdf' || option.format === 'docx')
      ? collectDocumentEmbedFonts(editor)
      : []

  const exportOptionsPayload = {}
  let exportContent = markdown

  if (embedFonts.length > 0 && editor) {
    exportOptionsPayload.embedFonts = embedFonts
    exportOptionsPayload.contentFormat = 'html'
    exportContent = editor.getHTML()
  }

  if (option.format === 'html') {
    const htmlOptions = exportOptions && typeof exportOptions === 'object' ? exportOptions : null
    exportOptionsPayload.exportOptions = buildHtmlExportOptionsPayload(htmlOptions)
  } else if (exportOptions && typeof exportOptions === 'object') {
    exportOptionsPayload.exportOptions = buildExportOptionsPayload(exportOptions)
  }

  await exportViaApi(exportContent, option.format, props.filename, exportOptionsPayload)

  // 导出成功后，若勾选了同步到资料库则提交
  const submitToKnowledge =
    exportOptions && typeof exportOptions === 'object'
      ? exportOptions.submitToKnowledge
      : false
  if (submitToKnowledge && isElectron()) {
    try {
      const api = getElectronAPI()
      await api.knowledge.upload({
        filename: `${resolveDocumentTitle()}.md`,
        data: new TextEncoder().encode(markdown),
      })
    } catch (err) {
      console.warn('[ExportMenu] 同步到资料库失败:', err)
      // 不阻断主流程
    }
  }
}

function buildExportOptionsPayload(options) {
  const margin = options.paperMargin === 'custom'
    ? {
        top: clampMargin(options.customMargin?.top),
        bottom: clampMargin(options.customMargin?.bottom),
        left: clampMargin(options.customMargin?.left),
        right: clampMargin(options.customMargin?.right),
      }
    : null

  return {
    paper: {
      paperSize: options.paperSize,
      paperMargin: options.paperMargin,
      ...(margin ? { customMargin: margin } : {}),
      headerFooter: options.headerFooter,
    },
    autoPaginate: options.autoPaginate !== false,
    fitImagesToWidth: options.fitImagesToWidth !== false,
    generateToc: Boolean(options.generateToc),
  }
}

/**
 * HTML 导出选项载荷
 *
 * HTML 没有「纸张 / 页边距 / 页眉页脚」概念，paper 字段对后端 buildHtmlFitCss
 * 不生效，但 printPaper 会被 buildHtmlFitCss 读取用于生成 @page { size }。
 */
function buildHtmlExportOptionsPayload(options) {
  const fallback = defaultHtmlOptions.value
  const base = { ...fallback, ...(options || {}) }
  return {
    autoPaginate: base.autoPaginate !== false,
    fitImagesToWidth: base.fitImagesToWidth !== false,
    generateToc: Boolean(base.generateToc),
    printPaper: normalizeHtmlPrintPaper(base.printPaper),
    documentMode: base.documentMode === 'fragment' ? 'fragment' : 'full',
  }
}

function clampMargin(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 20
  return Math.min(100, Math.max(0, Math.round(numeric)))
}

async function handleExport(option) {
  if (option.requiresNetwork && isOffline.value) return

  closeMenu()
  errorMessage.value = ''

  const markdown = props.getMarkdown()
  if (!markdown?.trim()) {
    const message = '文档内容为空，无法导出'
    errorMessage.value = message
    toast.warning(message)
    return
  }

  // Markdown 直接下载，不需要走 API 选项确认
  if (!option.format) {
    loading.value = true
    try {
      await performExport(option)
    } finally {
      loading.value = false
    }
    return
  }

  // 记录文档类型
  const typeLabel = documentType.value.trim()
  if (typeLabel) {
    recordSave(typeLabel, props.getFormatSnapshot?.())
    refreshRecentTypes()
  }

  pendingExportOption.value = option
  pendingExportOptions.value = null
  pendingHtmlExportOptions.value = null
  headingCount.value = countHeadingsInMarkdown(markdown)

  if (option.format === 'html') {
    htmlOptionsConfirmVisible.value = true
  } else {
    optionsConfirmVisible.value = true
  }
}

async function handleConfirmOptions(options) {
  optionsConfirmVisible.value = false
  pendingExportOptions.value = options
  await runExportWithOptions(options)
}

async function handleConfirmHtmlOptions(options) {
  htmlOptionsConfirmVisible.value = false
  pendingHtmlExportOptions.value = options
  await runExportWithOptions(options)
}

async function runExportWithOptions(options) {
  const option = pendingExportOption.value
  if (!option) return

  loading.value = true

  try {
    const editor = resolveExportEditor()
    const localUsage = editor ? await detectCommercialFontUsage(editor).catch(() => null) : null

    if (localUsage?.hasCommercialFonts) {
      if (isGuest.value) {
        exportConfirmVisible.value = true
        exportAnalysis.value = null
        return
      }

      const markdown = props.getMarkdown()
      const analysis = await analyzeExportFonts(editor, markdown).catch(() => null)
      if (analysis?.hasCommercialFonts) {
        exportAnalysis.value = analysis
        exportConfirmVisible.value = true
        return
      }
    }

    await performExport(option, options)
    toast.success('导出成功')
  } catch (error) {
    const message = error?.message || '导出失败，请稍后重试'
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

async function handleConfirmExport() {
  if (!exportAnalysis.value || !pendingExportOption.value) return

  confirmLoading.value = true

  try {
    if (exportAnalysis.value.totalCost > 0) {
      await consumeTokensForExport({
        fonts: exportAnalysis.value.fonts
          .filter((font) => !font.deduplicated && font.charCount > 0)
          .map((font) => ({
            font_id: font.fontId,
            char_count: font.charCount,
          })),
        doc_hash: exportAnalysis.value.docHash,
        doc_name: resolveDocumentTitle(),
      })
    }

    const option = pendingExportOption.value
    const exportOptions =
      option?.format === 'html'
        ? pendingHtmlExportOptions.value
        : pendingExportOptions.value
    closeExportConfirm()
    loading.value = true
    await performExport(option, exportOptions)
    toast.success('导出成功')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    confirmLoading.value = false
    loading.value = false
  }
}

function handleRecharge() {
  closeExportConfirm()
  void router.push({ name: 'token-recharge' })
}

async function handleGuestLogin() {
  await login()
}

async function handleUseFreeFont() {
  const editor = resolveExportEditor()
  const option = pendingExportOption.value
  const exportOptions =
    option?.format === 'html'
      ? pendingHtmlExportOptions.value
      : pendingExportOptions.value

  if (!editor || !option) return

  confirmLoading.value = true

  try {
    const commercialFontIds = await getCommercialFontIdSet()
    const targetFamily = await resolveSourceHanSansFamily()
    replaceCommercialFontsInEditor(editor, commercialFontIds, targetFamily)

    closeExportConfirm()
    loading.value = true
    await performExport(option, exportOptions)
    toast.success('已改用思源黑体并完成导出')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    confirmLoading.value = false
    loading.value = false
  }
}

async function loadExportAnalysisForPendingExport() {
  const option = pendingExportOption.value
  const editor = resolveExportEditor()
  const markdown = props.getMarkdown()

  if (!option || !editor || !markdown?.trim() || isGuest.value) {
    return
  }

  const analysis = await analyzeExportFonts(editor, markdown).catch(() => null)
  if (analysis?.hasCommercialFonts) {
    exportAnalysis.value = analysis
    exportConfirmVisible.value = true
  }
}

watch(isGuest, (guest) => {
  if (!guest && exportConfirmVisible.value) {
    void loadExportAnalysisForPendingExport()
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  refreshRecentTypes()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="menuRef" class="relative inline-block text-left">
    <button
      type="button"
      class="wpx-btn inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      :class="iconOnly ? 'p-1.5' : 'px-3 py-1.5'"
      :disabled="loading || confirmLoading"
      :title="iconOnly ? (loading ? '导出中…' : '导出') : '导出文档'"
      :aria-label="loading ? '导出中' : '导出文档'"
      @click="toggleMenu"
    >
      <svg
        v-if="loading"
        class="h-4 w-4 animate-spin text-brand-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <template v-else-if="iconOnly">
        <svg
          class="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
        </svg>
      </template>
      <template v-else>
        <span>{{ loading ? '导出中…' : '导出' }}</span>
        <svg
          class="h-4 w-4 text-slate-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </template>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 z-50 mt-1 w-60 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
    >
      <div class="border-b border-slate-100 px-3 py-2">
        <label class="mb-1 block text-xs font-medium text-slate-500" for="export-document-type">
          文档类型标签
        </label>
        <input
          id="export-document-type"
          v-model="documentType"
          type="text"
          class="wpx-input w-full rounded-md px-2 py-1.5 text-sm text-slate-700"
          placeholder="如：周报、需求文档"
          @keydown.stop
        />
        <div v-if="recentTypes.length" class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="type in recentTypes"
            :key="type"
            type="button"
            class="wpx-btn rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
            @click="applyRecentType(type)"
          >
            {{ type }}
          </button>
        </div>
      </div>

      <button
        v-for="option in EXPORT_OPTIONS"
        :key="option.key"
        type="button"
        class="block w-full px-3 py-2 text-left text-sm transition"
        :class="
          isExportOptionDisabled(option)
            ? 'cursor-not-allowed text-slate-400'
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        "
        :disabled="isExportOptionDisabled(option)"
        :title="exportOptionTitle(option)"
        @click="handleExport(option)"
      >
        {{ option.label }}
      </button>
    </div>

    <ExportFontConfirm
      :visible="exportConfirmVisible"
      :is-guest="isGuest"
      :login-loading="isLoggingIn"
      :fonts="exportAnalysis?.fonts || []"
      :total-cost="exportAnalysis?.totalCost || 0"
      :balance="exportAnalysis?.balance || 0"
      :sufficient="exportAnalysis?.sufficient ?? true"
      :shortfall="exportAnalysis?.shortfall || 0"
      :loading="confirmLoading"
      @confirm="handleConfirmExport"
      @recharge="handleRecharge"
      @login="handleGuestLogin"
      @use-free-font="handleUseFreeFont"
      @close="dismissExportConfirm"
    />

    <ExportOptionsConfirm
      :visible="optionsConfirmVisible"
      :defaults="defaultPaperOptions"
      :heading-count="headingCount"
      :format="pendingExportOption?.format || ''"
      :loading="loading || confirmLoading"
      @confirm="handleConfirmOptions"
      @close="closeOptionsConfirm"
    />

    <ExportHtmlOptionsConfirm
      :visible="htmlOptionsConfirmVisible"
      :defaults="defaultHtmlOptions"
      :heading-count="headingCount"
      :loading="loading || confirmLoading"
      @confirm="handleConfirmHtmlOptions"
      @close="closeHtmlOptionsConfirm"
    />

    <p v-if="errorMessage" class="sr-only" role="status">{{ errorMessage }}</p>
  </div>
</template>
