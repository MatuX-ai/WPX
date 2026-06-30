<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  Minus,
  Presentation,
  Redo2,
  Search,
  Table2,
  Undo2,
} from '@lucide/vue'
import { useEditorStore } from '@/stores/editor'
import { useAppStore } from '@/stores/app'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useUserHabits, extractFormatFromEditor } from '@/composables/useUserHabits'
import { editorDragOutProps, useDragDrop } from '@/composables/useDragDrop'
import { shortcutTooltip } from '@/composables/useGlobalShortcuts'
import { useWindowSize } from '@/composables/useWindowSize'
import { useToast } from '@/composables/useToast'
import { toEditorContent } from '@/utils/aiSelection'
import { tiptapJsonToMarkdown } from '@/utils/tiptapToMarkdown'
import { markdownToHtml } from '@/utils/markdownToEditor'
import { blobToDataUrl } from '@/utils/imageUtils'
import { detectMarkdown, extractMarkdownSnippet } from '@/utils/markdownDetector'
import { hasImagesInDoc } from '@/composables/useMarkdownFormatter'
import { useMarkdownFormatPromptStore } from '@/stores/markdownFormatPrompt'
import {
  extractHtmlFromClipboard,
  hasHtmlImport,
} from '@/composables/useHtmlImporter'
import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'
import { getSanitizedJson } from '@/utils/exportAttrsFilter'
import {
  findNextMatch,
  replaceAllMatches,
  replaceCurrentSelection,
} from '@/utils/editorFindReplace'
import { EditorImage } from '@/extensions/EditorImage'
import { FontFamily, FontSize, LineHeight, ParagraphIndent } from '@/extensions/DocumentFormat'
import { SlideDeckNode } from '@/extensions/SlideDeckNode'
import { HtmlSourceExtension } from '@/extensions/HtmlSourceExtension'
import TableInsertDialog from '@/components/editor/TableInsertDialog.vue'
import TableBubbleMenu from '@/components/editor/TableBubbleMenu.vue'
import ImageBubbleMenu from '@/components/editor/ImageBubbleMenu.vue'
import FindReplaceDialog from '@/components/editor/FindReplaceDialog.vue'
import ImageUrlDialog from '@/components/editor/ImageUrlDialog.vue'
import FontFamilySelect from '@/components/editor/FontFamilySelect.vue'
import EditorContextMenu from '@/components/context/EditorContextMenu.vue'
import { useEditorOverlayOptional } from '@/composables/useEditorOverlay'
import { setActiveEditor, clearActiveEditor } from '@/composables/useEditorRegistry'

const HEADING_OPTIONS = [
  { label: '正文', value: '' },
  { label: '标题 1', value: 1 },
  { label: '标题 2', value: 2 },
  { label: '标题 3', value: 3 },
  { label: '标题 4', value: 4 },
  { label: '标题 5', value: 5 },
  { label: '标题 6', value: 6 },
]

const props = defineProps({
  content: {
    type: [Object, String],
    default: null,
  },
  placeholder: {
    type: String,
    default: '开始写作，支持 Markdown 快捷键（如 # 标题、**加粗**）…',
  },
})

const emit = defineEmits(['change', 'lesson-to-ppt-open'])

const editorStore = useEditorStore()
const appStore = useAppStore()
const userPreferencesStore = useUserPreferencesStore()
const editorOverlay = useEditorOverlayOptional()
const windowSize = useWindowSize()
const { isToolbarIconOnly } = windowSize
const { bindEditor, unbindEditor, applyFormat } = useUserHabits()
const toast = useToast()
const formatPromptStore = useMarkdownFormatPromptStore()
const toolbarVersion = ref(0)
const showTableDialog = ref(false)
const showFindReplace = ref(false)
const showImageUrlDialog = ref(false)
const tableRows = ref(3)
const tableCols = ref(3)
const imageInputRef = ref(null)
const fontFamilySelectRef = ref(null)
const contextMenu = ref({
  open: false,
  x: 0,
  y: 0,
})

function refreshToolbar() {
  toolbarVersion.value += 1
}

function syncSelection(currentEditor) {
  const { from, to } = currentEditor.state.selection
  const hasSelection = from !== to

  editorStore.setSelection({
    text: hasSelection ? currentEditor.state.doc.textBetween(from, to, '\n') : '',
    from,
    to,
    hasSelection,
  })
}

function applyReplaceRequest(request) {
  const currentEditor = editor.value
  if (!currentEditor || !request) return

  const content = toEditorContent(request.text)

  currentEditor
    .chain()
    .focus()
    .setTextSelection({ from: request.from, to: request.to })
    .insertContent(content)
    .run()

  emitContent(currentEditor)
  syncSelection(currentEditor)
  editorStore.clearReplaceRequest()
  editorStore.clearPendingReplace()
}

function emitContent(editor) {
  // 实时同步：保留 doc.attrs.htmlSource 等（供运行时功能如「恢复原样」「重新触发排版」使用）
  // 注意：仅在编辑器内运行时保留 attrs；导出时通过 getSanitizedJson 净化。
  const json = editor.getJSON()
  emit('change', {
    html: editor.getHTML(),
    json,
    markdown: tiptapJsonToMarkdown(json),
  })
}

/**
 * 获取**导出用**的 MD 字符串：剥离 doc.attrs.htmlSource 等内部属性。
 * 适用于 saveDocument / exportDocx / exportMd 等"对外"导出场景。
 * @returns {string}
 */
function getMarkdownForExport() {
  const currentEditor = editor.value
  if (!currentEditor) return ''
  const sanitized = getSanitizedJson(currentEditor) || { type: 'doc', content: [] }
  return tiptapJsonToMarkdown(sanitized)
}

/**
 * 获取**导出用**的 HTML 字符串：doc 节点的内部 attrs 不参与渲染，
 * 但保险起见仍然基于净化后的 JSON 调用 editor.getHTML()。
 * @returns {string}
 */
function getHtmlForExport() {
  const currentEditor = editor.value
  if (!currentEditor) return ''
  // editor.getHTML() 不会输出 doc.attrs，因此无需额外过滤
  return currentEditor.getHTML()
}

/**
 * 检测文本是否含 Markdown 标记，若是则向 store 推送排版提示请求。
 * @param {'paste' | 'import' | 'dragdrop'} source 触发来源
 * @param {string} text 待检测文本
 */
function notifyMarkdownDetected(source, text) {
  if (!text || typeof text !== 'string') return
  if (!detectMarkdown(text)) return
  const currentEditor = editor.value
  const previewText = extractMarkdownSnippet(text, 80) || ''
  const hasImages = currentEditor ? hasImagesInDoc(currentEditor) : false
  formatPromptStore.trigger({ source, previewText, hasImages })
}

function openContextMenu(event) {
  event.preventDefault()
  const currentEditor = editor.value
  if (!currentEditor) return

  syncSelection(currentEditor)
  contextMenu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
  }
}

const editor = useEditor({
  content: props.content ?? '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    TextStyle,
    Color,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    // MD 智能排版引擎：把 data-indent 注入 paragraph/heading schema。
    // 必须在 TextAlign 之后注册，避免 addGlobalAttributes 合并顺序冲突。
    ParagraphIndent,
    FontFamily,
    FontSize,
    LineHeight,
    // HTML 导入扩展：把 htmlSource / sourceUrl / importedAt / importSource / lastFormattedTemplate /
    // lastFormattedAt 注入到 doc schema，保证随文档 JSON 持久化、跨窗口传输。
    HtmlSourceExtension,
    EditorImage.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'editor-image',
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'editor-table',
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    SlideDeckNode,
  ],
  editorProps: {
    attributes: {
      class: 'editor-prose outline-none min-h-[280px] px-4 py-3',
    },
    handleDOMEvents: {
      ...editorDragOutProps.handleDOMEvents,
      contextmenu: (_view, event) => {
        openContextMenu(event)
        return true
      },
    },
    handlePaste: (_view, event) => {
      const items = event.clipboardData?.items
      if (!items) return false

      // 1) 图片粘贴优先（已有逻辑）
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue

        const file = item.getAsFile()
        if (!file) continue

        const reader = new FileReader()
        reader.onload = () => {
          editor.value
            ?.chain()
            .focus()
            .setImage({ src: String(reader.result), float: 'left' })
            .run()
        }
        reader.readAsDataURL(file)
        return true
      }

      // 2) HTML 粘贴检测（新增，优先级高于纯文本）
      //    从其他网页/富文本编辑器复制的内容会同时含 text/html 和 text/plain。
      //    仅当 HTML 长度 > 100 才视为真实 HTML，避免误判普通文本中偶然出现的尖括号。
      //    注意：必须使用 insertContent 而非 importHtmlString，因为
      //    importHtmlString 内部调用 setContent 会替换整个文档内容，
      //    导致 Ctrl+V 粘贴时清空页面原有内容。
      const htmlContent = extractHtmlFromClipboard(event.clipboardData)
      if (htmlContent) {
        // 大小检查：超过 2MB 拒绝（与 importHtmlString 的 validateHtmlSize 一致）
        if (htmlContent.length * 2 > 2 * 1024 * 1024) {
          toast.warning('粘贴内容过大，已拒绝（超过 2MB）', 3000)
          return true
        }
        try {
          // 在光标位置插入 HTML，保留文档原有内容
          // 注意：必须使用完整可选链避免 editor.value 为 null 时抛 TypeError
          editor.value?.chain()?.focus()?.insertContent(htmlContent)?.run()
          // 写入 htmlSource 元数据（用于焦点模式排版弹窗检测）
          editor.value?.commands?.setHtmlSource?.({
            htmlSource: htmlContent,
            sourceUrl: null,
            importedAt: new Date().toISOString(),
            importSource: 'paste',
          })
          toast.info('网页内容已插入', 3000)
          if (userPreferencesStore.paper.focusMode) {
            useHtmlFormatPromptStore().trigger({ source: 'manual' })
          }
        } catch (e) {
          console.warn('[EditorCore] HTML paste failed:', e)
          toast.warning('HTML 粘贴失败：' + (e?.message || '未知错误'), 3000)
        }
        return true
      }

      // 3) 纯文本粘贴：检测 Markdown 标记，命中则推送排版提示
      const pastedText = event.clipboardData?.getData?.('text/plain') || ''
      if (pastedText) {
        notifyMarkdownDetected('paste', pastedText)
      }

      return false
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    emitContent(currentEditor)
    refreshToolbar()
    fontFamilySelectRef.value?.refreshLabel?.()
  },
  onSelectionUpdate: ({ editor: currentEditor }) => {
    refreshToolbar()
    syncSelection(currentEditor)
    fontFamilySelectRef.value?.refreshLabel?.()
  },
  onTransaction: refreshToolbar,
})

const { isDragOver, dropZoneHandlers } = useDragDrop({
  getEditor: () => editor.value,
  onContentChange: emitContent,
})

function getMarkdown() {
  const currentEditor = editor.value
  if (!currentEditor) return ''
  return tiptapJsonToMarkdown(currentEditor.getJSON())
}

defineExpose({
  getMarkdown,
  getMarkdownForExport,
  getHtmlForExport,
  getFormatSnapshot,
  loadMarkdown,
  openImageEditor,
  getEditor: () => editor.value,
})

function getFormatSnapshot() {
  return extractFormatFromEditor(editor.value)
}

function loadMarkdown(markdown) {
  const currentEditor = editor.value
  if (!currentEditor) return

  const source = markdown || ''
  currentEditor.commands.setContent(markdownToHtml(source))
  emitContent(currentEditor)
  syncSelection(currentEditor)

  // 导入 Markdown 文档后检测是否需要排版
  if (source) {
    notifyMarkdownDetected('import', source)
  }
}

function handleExternalFileOpen(payload) {
  if (!payload || payload.content == null) return

  appStore.openDocument()

  nextTick(() => {
    const currentEditor = editor.value
    if (!currentEditor) {
      // 编辑器未就绪，保留 pending 数据供后续重试
      return
    }

    // 编辑器确认就绪后消费 pending 数据
    appStore.takePendingExternalFile()

    if (payload.contentType === 'html') {
      // DOCX 等导入返回 HTML，直接设置到编辑器
      currentEditor.commands.setContent(payload.content)
    } else {
      loadMarkdown(payload.content)
    }

    if (payload.title) {
      appStore.setDocumentTitle(payload.title)
    }

    appStore.markDocumentDirty()

    if (payload.format) {
      nextTick(() => applyFormat(payload.format))
    }

    // Excel 导入后展示统计信息 / 截断警告
    if (payload.contentType === 'markdown' && payload.sheetCount) {
      const warnings = Array.isArray(payload.warnings) ? payload.warnings : []
      if (warnings.length) {
        toast.warning(
          `已导入 ${payload.sheetCount} 个工作表，部分内容已截断：\n${warnings.join('\n')}`,
          5000,
        )
      } else {
        toast.success(`已导入 ${payload.sheetCount} 个 Excel 工作表`, 2500)
      }
    }
  })
}

let unsubscribeExternalFileOpen = null

onMounted(() => {
  // 注册到全局编辑器注册中心，供本地指令层 / 命令面板等使用
  setActiveEditor(editor.value)

  if (!isElectron()) return

  const api = getElectronAPI()
  const subscribe =
    api?.files?.onOpenFile ||
    api?.onOpenFile ||
    api?.files?.onOpenMarkdown ||
    api?.onOpenMarkdownFile

  if (typeof subscribe === 'function') {
    unsubscribeExternalFileOpen = subscribe(handleExternalFileOpen)
  }

  const pending = appStore.pendingExternalFile
  if (pending) {
    handleExternalFileOpen(pending)
  }
})

// 监听 editor 实例变化（Tiptap 异步初始化 / props.content 改变触发重建），
// 重新同步到全局注册中心，避免持有陈旧的 ProseMirror state 引用。
watch(
  () => editor.value,
  (next, prev) => {
    if (prev) clearActiveEditor(prev)
    if (next) setActiveEditor(next)
  },
)

// 监听 appStore.pendingExternalFile：当编辑器已挂载但外部文件被队列时加载
watch(
  () => appStore.pendingExternalFile,
  (payload) => {
    if (payload) {
      handleExternalFileOpen(payload)
    }
  },
  { immediate: false },
)

function applyHeading(level) {
  const currentEditor = editor.value
  if (!currentEditor) return

  if (!level) {
    currentEditor.chain().focus().setParagraph().run()
    return
  }

  currentEditor.chain().focus().setHeading({ level: Number(level) }).run()
}

function applyTextColor(event) {
  const currentEditor = editor.value
  if (!currentEditor) return

  const color = event.target.value
  if (!color) {
    currentEditor.chain().focus().unsetColor().run()
    return
  }

  currentEditor.chain().focus().setColor(color).run()
}

function applyTextAlign(align) {
  editor.value?.chain().focus().setTextAlign(align).run()
}

function insertHorizontalRule() {
  editor.value?.chain().focus().setHorizontalRule().run()
}

function openFindReplace() {
  showFindReplace.value = true
}

function handleFindNext(payload) {
  const currentEditor = editor.value
  if (!currentEditor) return

  const match = findNextMatch(currentEditor, payload.query, {
    caseSensitive: payload.caseSensitive,
    from: currentEditor.state.selection.to,
  })

  if (!match) {
    toast.info('未找到匹配内容')
    return
  }

  currentEditor.chain().focus().setTextSelection(match).run()
}

function handleReplace(payload) {
  const currentEditor = editor.value
  if (!currentEditor) return

  const replaced = replaceCurrentSelection(currentEditor, payload)
  if (replaced) {
    emitContent(currentEditor)
    return
  }

  handleFindNext(payload)
  const { from, to } = currentEditor.state.selection
  if (from === to) return

  currentEditor
    .chain()
    .focus()
    .insertContentAt({ from, to }, payload.replacement)
    .run()
  emitContent(currentEditor)
}

function handleReplaceAll(payload) {
  const currentEditor = editor.value
  if (!currentEditor) return

  const count = replaceAllMatches(currentEditor, payload)
  if (!count) {
    toast.info('未找到匹配内容')
    return
  }

  emitContent(currentEditor)
  toast.success(`已替换 ${count} 处`)
}

function openImageUrlDialog() {
  showImageUrlDialog.value = true
}

function confirmImageUrl(url) {
  const currentEditor = editor.value
  if (!currentEditor || !url) return

  currentEditor.chain().focus().setImage({ src: url, float: 'left' }).run()
  emitContent(currentEditor)
  showImageUrlDialog.value = false
}

const activeFormat = computed(() => {
  toolbarVersion.value
  const ed = editor.value
  if (!ed) {
    return {
      heading: '',
      color: '#0f172a',
      textAlign: 'left',
    }
  }

  const headingAttrs = ed.getAttributes('heading')
  const heading = ed.isActive('heading') ? headingAttrs.level ?? '' : ''

  return {
    heading,
    color: ed.getAttributes('textStyle').color || '#0f172a',
    textAlign: ed.getAttributes('paragraph').textAlign
      || ed.getAttributes('heading').textAlign
      || 'left',
  }
})

watch(
  () => editor.value,
  (currentEditor) => {
    if (currentEditor) {
      bindEditor(currentEditor)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unsubscribeExternalFileOpen?.()
  unbindEditor()
  // 从全局注册中心注销，避免外部代码持有已销毁的 editor
  clearActiveEditor(editor.value)
})

function openTableDialog() {
  tableRows.value = 3
  tableCols.value = 3
  showTableDialog.value = true
}

/**
 * 在当前光标位置插入一个 SlideDeck 节点。
 * 该命令由 SlideDeckNode 扩展通过 addCommands 注册。
 */
function insertSlideDeck() {
  const currentEditor = editor.value
  if (!currentEditor) return
  const ok = currentEditor.chain().focus().insertSlideDeck().run()
  if (ok) {
    toast.success('已插入演示文稿节点')
  } else {
    toast.error('插入失败')
  }
}

function closeContextMenu() {
  contextMenu.value.open = false
}

function handleContextMenuAiRewrite() {
  editorOverlay?.openAiPanel()
  editorStore.setChatInputActive(true)
}

function handleContextMenuInsertImage() {
  imageInputRef.value?.click()
}

function handleContextMenuLessonToPpt() {
  // 教案 → 课件：通知父组件打开 LessonPlanToPptDialog
  emit('lesson-to-ppt-open')
}

async function handleImageFileSelected(event) {
  const file = event.target.files?.[0]
  const currentEditor = editor.value
  if (!file || !currentEditor) return

  const src = await blobToDataUrl(file)
  currentEditor.chain().focus().setImage({ src, float: 'left' }).run()
  emitContent(currentEditor)
  event.target.value = ''
}

function closeTableDialog() {
  showTableDialog.value = false
}

function confirmInsertTable() {
  const currentEditor = editor.value
  if (!currentEditor) return

  currentEditor
    .chain()
    .focus()
    .insertTable({
      rows: tableRows.value,
      cols: tableCols.value,
      withHeaderRow: true,
    })
    .run()

  closeTableDialog()
}

function openImageEditor() {
  const currentEditor = editor.value
  if (!currentEditor?.isActive('image')) return

  const { selection } = currentEditor.state
  if (!selection.node || selection.node.type.name !== 'image') return

  editorStore.openImageEdit({
    pos: selection.from,
    src: selection.node.attrs.src,
  })
}

async function applyImageEditResult(result) {
  const currentEditor = editor.value
  if (!currentEditor || result.pos == null) return

  const dataUrl = await blobToDataUrl(result.blob)
  currentEditor
    .chain()
    .focus()
    .setNodeSelection(result.pos)
    .updateAttributes('image', { src: dataUrl })
    .run()

  emitContent(currentEditor)
  editorStore.clearImageEditResult()
}

watch(
  () => editorStore.replaceRequest,
  (request) => {
    if (request) {
      applyReplaceRequest(request)
    }
  },
)

watch(
  () => editorStore.imageEditResult,
  (result) => {
    if (result) {
      applyImageEditResult(result)
    }
  },
)

const toolbarItems = computed(() => {
  toolbarVersion.value
  windowSize.breakpoint.value
  const ed = editor.value
  if (!ed) return []

  return [
    {
      key: 'bold',
      icon: Bold,
      title: shortcutTooltip('加粗', 'bold'),
      ariaLabel: '加粗',
      active: ed.isActive('bold'),
      disabled: !ed.can().chain().focus().toggleBold().run(),
      action: () => ed.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      icon: Italic,
      title: shortcutTooltip('斜体', 'italic'),
      ariaLabel: '斜体',
      active: ed.isActive('italic'),
      disabled: !ed.can().chain().focus().toggleItalic().run(),
      action: () => ed.chain().focus().toggleItalic().run(),
    },
    { key: 'divider-1', type: 'divider' },
    {
      key: 'insertTable',
      icon: Table2,
      title: '插入表格',
      ariaLabel: '插入表格',
      active: false,
      disabled: false,
      action: openTableDialog,
    },
    {
      key: 'insertImage',
      icon: ImagePlus,
      title: '插入图片',
      ariaLabel: '插入图片',
      active: false,
      disabled: false,
      action: handleContextMenuInsertImage,
    },
    {
      key: 'insertImageUrl',
      icon: Link2,
      title: '插入图片链接',
      ariaLabel: '插入图片链接',
      active: false,
      disabled: false,
      action: openImageUrlDialog,
    },
    {
      key: 'insertSlideDeck',
      icon: Presentation,
      title: '插入演示文稿',
      ariaLabel: '插入演示文稿',
      active: false,
      disabled: false,
      action: insertSlideDeck,
    },
    {
      key: 'horizontalRule',
      icon: Minus,
      title: '插入分隔线',
      ariaLabel: '插入分隔线',
      active: false,
      disabled: !ed.can().chain().focus().setHorizontalRule().run(),
      action: insertHorizontalRule,
    },
    { key: 'divider-2', type: 'divider' },
    {
      key: 'findReplace',
      icon: Search,
      title: '查找与替换',
      ariaLabel: '查找与替换',
      active: showFindReplace.value,
      disabled: false,
      action: openFindReplace,
    },
    {
      key: 'undo',
      icon: Undo2,
      title: '撤销',
      ariaLabel: '撤销',
      active: false,
      disabled: !ed.can().chain().focus().undo().run(),
      action: () => ed.chain().focus().undo().run(),
    },
    {
      key: 'redo',
      icon: Redo2,
      title: '重做',
      ariaLabel: '重做',
      active: false,
      disabled: !ed.can().chain().focus().redo().run(),
      action: () => ed.chain().focus().redo().run(),
    },
  ]
})
</script>

<template>
  <div class="editor-shell rounded-xl border border-slate-200 bg-white shadow-sm">
    <div
      v-if="editor"
      class="editor-toolbar"
      :class="{ 'editor-toolbar--icon-only': isToolbarIconOnly }"
      role="toolbar"
      aria-label="文档格式工具栏"
    >
      <div class="editor-toolbar__primary">
        <template v-for="item in toolbarItems" :key="item.key">
          <span
            v-if="item.type === 'divider'"
            class="editor-toolbar__divider"
            aria-hidden="true"
          />
          <button
            v-else
            type="button"
            :title="item.title"
            :aria-label="item.ariaLabel || item.title"
            :aria-pressed="item.active ? 'true' : 'false'"
            :disabled="item.disabled"
            class="editor-toolbar__btn"
            :class="{ 'editor-toolbar__btn--active': item.active }"
            @click="item.action"
          >
            <component :is="item.icon" :size="16" aria-hidden="true" />
          </button>
        </template>

        <span class="editor-toolbar__divider" aria-hidden="true" />

        <FontFamilySelect
          ref="fontFamilySelectRef"
          :editor="editor"
          :compact="isToolbarIconOnly"
        />

        <label
          class="editor-toolbar__heading"
          :title="isToolbarIconOnly ? '标题样式' : undefined"
        >
          <Heading2 v-if="isToolbarIconOnly" :size="16" aria-hidden="true" />
          <select
            class="editor-toolbar__heading-select"
            :class="{ 'sr-only': isToolbarIconOnly }"
            aria-label="标题样式"
            :value="activeFormat.heading || ''"
            @change="applyHeading($event.target.value ? Number($event.target.value) : '')"
          >
            <option v-for="option in HEADING_OPTIONS" :key="option.label" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="editor-toolbar__color" title="文字颜色">
          <input
            type="color"
            class="editor-toolbar__color-input"
            aria-label="文字颜色"
            :value="activeFormat.color"
            @input="applyTextColor"
          />
        </label>

        <button
          type="button"
          class="editor-toolbar__btn"
          :class="{ 'editor-toolbar__btn--active': activeFormat.textAlign === 'left' }"
          title="左对齐"
          aria-label="左对齐"
          @click="applyTextAlign('left')"
        >
          <AlignLeft :size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="editor-toolbar__btn"
          :class="{ 'editor-toolbar__btn--active': activeFormat.textAlign === 'center' }"
          title="居中"
          aria-label="居中"
          @click="applyTextAlign('center')"
        >
          <AlignCenter :size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="editor-toolbar__btn"
          :class="{ 'editor-toolbar__btn--active': activeFormat.textAlign === 'right' }"
          title="右对齐"
          aria-label="右对齐"
          @click="applyTextAlign('right')"
        >
          <AlignRight :size="16" aria-hidden="true" />
        </button>
      </div>

      <div v-if="$slots['toolbar-actions']" class="editor-toolbar__actions">
        <slot name="toolbar-actions" />
      </div>
    </div>

    <TableBubbleMenu v-if="editor" :editor="editor" />
    <ImageBubbleMenu v-if="editor" :editor="editor" @edit-image="openImageEditor" />

    <TableInsertDialog
      :visible="showTableDialog"
      :rows="tableRows"
      :cols="tableCols"
      @update:rows="tableRows = $event"
      @update:cols="tableCols = $event"
      @confirm="confirmInsertTable"
      @cancel="closeTableDialog"
    />

    <div
      class="editor-drop-zone"
      :class="{ 'editor-drop-zone--active': isDragOver }"
      @dragenter="dropZoneHandlers.dragenter"
      @dragover="dropZoneHandlers.dragover"
      @dragleave="dropZoneHandlers.dragleave"
      @drop="dropZoneHandlers.drop"
    >
      <EditorContent :editor="editor" class="editor-content" />
    </div>

    <input
      ref="imageInputRef"
      type="file"
      accept="image/jpeg,image/png,image/jpg"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="handleImageFileSelected"
    />

    <EditorContextMenu
      :open="contextMenu.open"
      :anchor-x="contextMenu.x"
      :anchor-y="contextMenu.y"
      :editor="editor"
      :has-selection="editorStore.selection.hasSelection"
      @close="closeContextMenu"
      @insert-table="openTableDialog"
      @insert-image="handleContextMenuInsertImage"
      @ai-rewrite="handleContextMenuAiRewrite"
      @lesson-to-ppt="handleContextMenuLessonToPpt"
    />

    <FindReplaceDialog
      :visible="showFindReplace"
      @close="showFindReplace = false"
      @find-next="handleFindNext"
      @replace="handleReplace"
      @replace-all="handleReplaceAll"
    />

    <ImageUrlDialog
      :visible="showImageUrlDialog"
      @close="showImageUrlDialog = false"
      @confirm="confirmImageUrl"
    />

    <div
      v-if="editorStore.selection.hasSelection"
      class="border-t border-brand-100 bg-brand-50 px-4 py-2 text-xs text-brand-700"
    >
      已选中 {{ editorStore.selection.text.length }} 字 · 打开 AI 助手并输入指令即可修改选区
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  position: sticky;
  /*
   * 修复：top 从 var(--title-bar-height, 36px) 调整为 0。
   *
   * 原因（语义层避免 sticky 与 padding-top 的“双重占位”临界）：
   * sticky 元素的 top 是相对 scrollport（.app-main--immersive）顶部 + top 值。
   * 原版 top = 36px 正好等于 .editor-layout（AppLayout 中 :deep 设置）的 padding-top = 36px，
   * 两个 36px 占位在同一个 viewport 边界上同时占据：1) padding 把 .editor-shell 推到 viewport 36px，
   * 2) sticky top = 36px 锁定 scrollport 顶部 + 36px = 同样 viewport 36px。
   * 当“自然位置 = sticky 阈值”时，Chromium 中两个独立背景 blur 合成层在 sub-pixel 舍入阶段
   * 各自 round-to-pixel，与 fixed TitleBar（z-index: 80）下边造成 ~1px 的双重合成继继。
   *
   * 现在 top = 0：sticky 阈值 = scrollport 顶部 = viewport 0，
   * 但 sticky 元素的自然位置仍是 viewport 36px（padding-top 提供）。
   * natural (36) ≥ threshold (0)，sticky 不介入，元素仍在 viewport 36px。
   * 视觉上与原版一致，但 sticky 阈值与 padding-top 不再重叠在一起，
   * 消除了“自然位置 = 阈值”这个临界条件，1px 合成继继不再出现。
   */
  top: 0;
  z-index: var(--z-editor-toolbar, 70);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: var(--editor-toolbar-height, 36px);
  padding: 0 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border, #e2e8f0) 38%, transparent);
  background: color-mix(in srgb, var(--theme-bg-subtle, #f8fafc) 52%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.editor-toolbar__primary {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
}

.editor-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.editor-toolbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-fg-muted, #475569);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.editor-toolbar__btn:hover:not(:disabled) {
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #0f172a);
}

.editor-toolbar__btn--active {
  background: var(--theme-bg, #fff);
  color: var(--theme-accent, #7c3aed);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 25%, transparent);
}

.editor-toolbar__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.editor-toolbar__divider {
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: var(--theme-border, #e2e8f0);
  flex-shrink: 0;
}

.editor-toolbar__heading {
  display: inline-flex;
  align-items: center;
  height: 28px;
  margin-left: 2px;
}

.editor-toolbar__heading-select {
  height: 28px;
  max-width: 88px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 6px;
  background: var(--theme-bg, #fff);
  padding: 0 6px;
  font-size: 12px;
  color: var(--theme-fg, #334155);
}

.editor-toolbar__color {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
}

.editor-toolbar__color-input {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.editor-toolbar--icon-only .editor-toolbar__heading-select {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.editor-drop-zone {
  position: relative;
  flex: 1 1 auto;
  min-height: 280px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.editor-drop-zone--active::after {
  content: '';
  position: absolute;
  inset: 4px;
  border: 2px dashed #2563eb;
  border-radius: 8px;
  pointer-events: none;
  z-index: 5;
}

.editor-content :deep(.tiptap) {
  color: #0f172a;
}

.editor-content :deep(.tiptap p.is-editor-empty:first-child::before),
.editor-content :deep(.tiptap p.is-empty::before) {
  color: #94a3b8;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.editor-content :deep(.editor-prose h1) {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 1.25rem 0 0.75rem;
}

.editor-content :deep(.editor-prose h2) {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
  margin: 1rem 0 0.5rem;
}

.editor-content :deep(.editor-prose h3) {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  margin: 0.875rem 0 0.5rem;
}

.editor-content :deep(.editor-prose h4) {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.45;
  margin: 0.75rem 0 0.5rem;
}

.editor-content :deep(.editor-prose h5) {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  margin: 0.625rem 0 0.375rem;
}

.editor-content :deep(.editor-prose h6) {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.5;
  margin: 0.5rem 0 0.375rem;
  color: #475569;
}

.editor-content :deep(.editor-prose) {
  font-size: var(--wpx-editor-base-font-size, 16px);
}

.editor-content :deep(.editor-prose p) {
  margin: 0.5rem 0;
  line-height: 1.75;
  text-indent: 0;
}

/* MD 智能排版引擎：data-indent 由 useMarkdownFormatter 设置，
   以 CSS 变量映射为 text-indent，避免覆盖 Tiptap 原生 attrs。 */
.editor-content :deep(.editor-prose p[data-indent='2em']) {
  text-indent: 2em;
}

.editor-content :deep(.editor-prose ul),
.editor-content :deep(.editor-prose ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.editor-content :deep(.editor-prose ul) {
  list-style-type: disc;
}

.editor-content :deep(.editor-prose ol) {
  list-style-type: decimal;
}

.editor-content :deep(.editor-prose li) {
  margin: 0.25rem 0;
}

.editor-content :deep(.editor-prose blockquote) {
  border-left: 3px solid #c4b5fd;
  color: #475569;
  margin: 0.75rem 0;
  padding: 0.25rem 0 0.25rem 1rem;
}

.editor-content :deep(.editor-prose pre) {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.875rem;
  margin: 0.75rem 0;
  overflow-x: auto;
  padding: 0.75rem 1rem;
}

.editor-content :deep(.editor-prose code) {
  background: #f1f5f9;
  border-radius: 0.25rem;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.875em;
  padding: 0.125rem 0.375rem;
}

.editor-content :deep(.editor-prose pre code) {
  background: transparent;
  padding: 0;
}

.editor-content :deep(.editor-image) {
  border-radius: 0.5rem;
  height: auto;
  max-width: 100%;
  cursor: pointer;
}

.editor-content :deep(.editor-image[data-float='left']),
.editor-content :deep(.editor-image[data-float='right']) {
  display: inline-block;
  max-width: min(100%, 420px);
}

.editor-content :deep(.editor-image[data-float='left']) {
  float: left;
  margin: 0 12px 8px 0;
}

.editor-content :deep(.editor-image[data-float='right']) {
  float: right;
  margin: 0 0 8px 12px;
}

/*
 * AI「对齐图片」本地指令（alignImages / fill 模式）将 data-float 设为 'none'，
 * 并在 HTML attribute 输出 width="100%"。
 *
 * 关键修复：HTML5 <img> 的 width attribute 仅允许「非负整数」，
 * 浏览器会把 width="100%" 当作 100 像素，而非 CSS 百分比，
 * 导致 importHtml 后看不到任何「撑满宽度」效果。
 *
 * 因此这里用 CSS 强制 width: 100% 真正撑满父容器，
 * 同时配合 max-width: 100% 防止超出。
 * alignImages(narrow) 会使用 data-fill="narrow" 单独采用 65%。
 */
.editor-content :deep(.editor-image[data-float='none']) {
  display: block;
  float: none;
  clear: both;
  margin: 0.75rem auto;
  max-width: 100%;
  width: 100%;
  height: auto;
}

.editor-content :deep(.editor-image[data-float='none'][data-align='left']) {
  margin-left: 0;
  margin-right: auto;
}

.editor-content :deep(.editor-image[data-float='none'][data-align='right']) {
  margin-left: auto;
  margin-right: 0;
}

.editor-content :deep(.editor-image[data-float='none'][data-fill='narrow']) {
  width: 65%;
}

.editor-content :deep(.editor-image[data-float='none'][data-fill='keep']) {
  width: auto;
}

.editor-content :deep(.editor-prose)::after {
  content: '';
  display: block;
  clear: both;
}

.editor-content :deep(.ProseMirror-selectednode.editor-image) {
  border-radius: 0.5rem;
  box-shadow: 0 0 0 2px #3b82f6;
  outline: none;
}

.editor-content :deep(.editor-table),
.editor-content :deep(.tiptap table) {
  border-collapse: collapse;
  margin: 0.75rem 0;
  overflow: hidden;
  table-layout: fixed;
  width: 100%;
}

.editor-content :deep(.tiptap td),
.editor-content :deep(.tiptap th) {
  border: 1px solid #e2e8f0;
  box-sizing: border-box;
  min-width: 2rem;
  padding: 0.375rem 0.5rem;
  position: relative;
  vertical-align: top;
}

.editor-content :deep(.tiptap th) {
  background-color: #f8fafc;
  font-weight: 600;
  text-align: left;
}

.editor-content :deep(.tiptap .selectedCell::after) {
  background: rgba(124, 58, 237, 0.12);
  content: '';
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

.editor-content :deep(.tiptap .column-resize-handle) {
  background-color: #7c3aed;
  bottom: -2px;
  pointer-events: none;
  position: absolute;
  right: -2px;
  top: 0;
  width: 4px;
}
</style>
