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
import {
  findNextMatch,
  replaceAllMatches,
  replaceCurrentSelection,
} from '@/utils/editorFindReplace'
import { EditorImage } from '@/extensions/EditorImage'
import { FontFamily, FontSize, LineHeight } from '@/extensions/DocumentFormat'
import { SlideDeckNode } from '@/extensions/SlideDeckNode'
import TableInsertDialog from '@/components/editor/TableInsertDialog.vue'
import TableBubbleMenu from '@/components/editor/TableBubbleMenu.vue'
import ImageBubbleMenu from '@/components/editor/ImageBubbleMenu.vue'
import FindReplaceDialog from '@/components/editor/FindReplaceDialog.vue'
import ImageUrlDialog from '@/components/editor/ImageUrlDialog.vue'
import FontFamilySelect from '@/components/editor/FontFamilySelect.vue'
import EditorContextMenu from '@/components/context/EditorContextMenu.vue'
import { useEditorOverlayOptional } from '@/composables/useEditorOverlay'

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

const emit = defineEmits(['change'])

const editorStore = useEditorStore()
const appStore = useAppStore()
const editorOverlay = useEditorOverlayOptional()
const windowSize = useWindowSize()
const { isToolbarIconOnly } = windowSize
const { bindEditor, unbindEditor, applyFormat } = useUserHabits()
const toast = useToast()
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
  const json = editor.getJSON()
  emit('change', {
    html: editor.getHTML(),
    json,
    markdown: tiptapJsonToMarkdown(json),
  })
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
    FontFamily,
    FontSize,
    LineHeight,
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

function getFormatSnapshot() {
  return extractFormatFromEditor(editor.value)
}

function loadMarkdown(markdown) {
  const currentEditor = editor.value
  if (!currentEditor) return

  currentEditor.commands.setContent(markdownToHtml(markdown || ''))
  emitContent(currentEditor)
  syncSelection(currentEditor)
}

function handleExternalFileOpen(payload) {
  if (!payload || payload.content == null) return

  appStore.openDocument()

  nextTick(() => {
    loadMarkdown(payload.content)

    if (payload.title) {
      appStore.setDocumentTitle(payload.title)
    }

    appStore.markDocumentDirty()

    if (payload.format) {
      nextTick(() => applyFormat(payload.format))
    }
  })
}

let unsubscribeExternalFileOpen = null

onMounted(() => {
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

  const pending = appStore.takePendingExternalFile()
  if (pending) {
    handleExternalFileOpen(pending)
  }
})

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

defineExpose({
  getMarkdown,
  getFormatSnapshot,
  getEditor: () => editor.value,
  loadMarkdown,
  openImageEditor,
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
  top: var(--title-bar-height, 36px);
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

.editor-content :deep(.editor-image[data-float='none']) {
  display: block;
  float: none;
  clear: both;
  margin: 0.75rem 0;
  max-width: 100%;
}

.editor-content :deep(.editor-image[data-float='none'][data-align='center']) {
  margin-left: auto;
  margin-right: auto;
}

.editor-content :deep(.editor-image[data-float='none'][data-align='right']) {
  margin-left: auto;
  margin-right: 0;
}

.editor-content :deep(.editor-image[data-float='none'][data-align='left']) {
  margin-left: 0;
  margin-right: auto;
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
