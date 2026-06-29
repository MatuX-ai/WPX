import { ref } from 'vue'
import { blobToDataUrl } from '@/utils/imageUtils'
import { markdownToHtml } from '@/utils/markdownToEditor'
import { toEditorContent } from '@/utils/aiSelection'
import { detectMarkdown, extractMarkdownSnippet } from '@/utils/markdownDetector'
import { hasImagesInDoc } from '@/composables/useMarkdownFormatter'
import { useMarkdownFormatPromptStore } from '@/stores/markdownFormatPrompt'
import { importHtmlString } from '@/composables/useHtmlImporter'
import { useToastStore } from '@/stores/toast'
import { getElectronAPI, isElectron } from '@/utils/electron'

export const DRAG_DROP_TEXT_EXTENSIONS = new Set(['.md', '.txt', '.html', '.htm'])
export const DRAG_DROP_DOCX_EXTENSIONS = new Set(['.docx', '.doc'])
export const DRAG_DROP_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])
export const DRAG_DROP_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png'])

function getFileExtension(filename = '') {
  const index = filename.lastIndexOf('.')
  return index >= 0 ? filename.slice(index).toLowerCase() : ''
}

/**
 * @param {File} file
 * @returns {'text' | 'image' | null}
 */
export function classifyDroppedFile(file) {
  if (!file) return null

  const ext = getFileExtension(file.name)
  if (DRAG_DROP_TEXT_EXTENSIONS.has(ext)) return 'text'
  if (DRAG_DROP_DOCX_EXTENSIONS.has(ext)) return 'docx'
  if (DRAG_DROP_IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (DRAG_DROP_IMAGE_MIME_TYPES.has(file.type)) return 'image'

  return null
}

/**
 * @param {File} file
 * @returns {boolean}
 */
export function isSupportedDropFile(file) {
  return classifyDroppedFile(file) != null
}

/**
 * @param {DataTransfer | null} dataTransfer
 * @returns {boolean}
 */
export function isExternalFileDrag(dataTransfer) {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types || []).includes('Files')
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadImageFile(file) {
  // Web 端：转为 data URL 后插入；桌面端可替换为上传到媒体服务并返回 URL
  return blobToDataUrl(file)
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function readTextFile(file) {
  return file.text()
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} text
 * @param {string} extension
 */
function insertTextFileContent(editor, text, extension) {
  if (!editor) return

  if (extension === '.md') {
    editor.chain().focus().insertContent(markdownToHtml(text)).run()
    return
  }

  // HTML 文件：走 useHtmlImporter 静默导入，原始源码存入 doc.attrs.htmlSource
  // 需求文档：HTML 导入不弹窗，由 A4 模式触发排版弹窗
  if (extension === '.html' || extension === '.htm') {
    importHtmlFileContent(editor, text)
    return
  }

  editor.chain().focus().insertContent(toEditorContent(text)).run()
}

/**
 * 通过 useHtmlImporter 导入 HTML 文件内容，并在右下角弹出轻量 toast「网页已导入」。
 * 不触发 markdownFormatPrompt（保持「导入无感」原则）。
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} htmlString
 */
function importHtmlFileContent(editor, htmlString) {
  const result = importHtmlString(editor, htmlString, { importSource: 'file' })
  // Pinia store 可在事件处理器中直接调用（不依赖组件实例）
  const toast = useToastStore()
  if (result.ok) {
    toast.info('网页已导入', 3000)
    return
  }
  // 失败时仍走通用插入（避免 HTML 被丢失）
  console.warn('[useDragDrop] importHtmlString failed:', result.error)
  toast.warning(result.message || 'HTML 导入失败', 3000)
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} src
 */
function insertImageContent(editor, src) {
  if (!editor || !src) return
  editor.chain().focus().setImage({ src, float: 'left' }).run()
}

/**
 * 编辑器拖放：外部文件拖入、选区拖出
 * @param {object} options
 * @param {() => import('@tiptap/core').Editor | null | undefined} options.getEditor
 * @param {(editor: import('@tiptap/core').Editor) => void} [options.onContentChange]
 */
export function useDragDrop({ getEditor, onContentChange } = {}) {
  const isDragOver = ref(false)

  function resetDragState() {
    isDragOver.value = false
  }

  function notifyChange() {
    const editor = getEditor?.()
    if (editor) {
      onContentChange?.(editor)
    }
  }

  /**
   * @param {File[]} files
   */
  async function processDroppedFiles(files) {
    const editor = getEditor?.()
    if (!editor || !files.length) return

    for (const file of files) {
      const kind = classifyDroppedFile(file)
      if (!kind) continue

      if (kind === 'text') {
        const text = await readTextFile(file)
        const ext = getFileExtension(file.name)
        insertTextFileContent(editor, text, ext)
        notifyChange()
        // Markdown 文档拖入：检测后向 store 推送排版提示
        if (ext === '.md' && text && detectMarkdown(text)) {
          const previewText = extractMarkdownSnippet(text, 80) || ''
          useMarkdownFormatPromptStore().trigger({
            source: 'dragdrop',
            previewText,
            hasImages: hasImagesInDoc(editor),
          })
        }
        continue
      }

      if (kind === 'docx') {
        // DOCX/DOC 文件：桌面端通过 IPC 使用 mammoth 转换为 HTML
        if (isElectron()) {
          const api = getElectronAPI()
          const filePath = file.path
          if (filePath && api?.files?.convertDocx) {
            const payload = await api.files.convertDocx(filePath)
            if (payload && payload.content) {
              const toast = useToastStore()
              editor.chain().focus().setContent(payload.content).run()
              notifyChange()
              toast.info(`已导入「${payload.title}」`, 3000)
            } else {
              const toast = useToastStore()
              toast.error('DOCX 文件转换失败，文件可能已损坏或格式不受支持', 5000)
            }
          }
        } else {
          const toast = useToastStore()
          toast.warning('DOCX 导入仅支持桌面端', 3000)
        }
        continue
      }

      if (kind === 'image') {
        const src = await uploadImageFile(file)
        insertImageContent(editor, src)
        notifyChange()
      }
    }
  }

  function handleDragEnter(event) {
    if (!isExternalFileDrag(event.dataTransfer)) return

    event.preventDefault()
    isDragOver.value = true
  }

  function handleDragOver(event) {
    if (!isExternalFileDrag(event.dataTransfer)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    isDragOver.value = true
  }

  function handleDragLeave(event) {
    const zone = event.currentTarget
    const related = event.relatedTarget
    if (related instanceof Node && zone.contains(related)) return

    resetDragState()
  }

  /**
   * @param {DragEvent} event
   */
  async function handleDrop(event) {
    if (!isExternalFileDrag(event.dataTransfer)) return

    event.preventDefault()
    resetDragState()

    const files = Array.from(event.dataTransfer?.files || []).filter(isSupportedDropFile)
    await processDroppedFiles(files)
  }

  const dropZoneHandlers = {
    dragenter: handleDragEnter,
    dragover: handleDragOver,
    dragleave: handleDragLeave,
    drop: handleDrop,
  }

  return {
    isDragOver,
    dropZoneHandlers,
    processDroppedFiles,
    resetDragState,
  }
}

/**
 * ProseMirror 选区拖出到桌面 / 其他应用
 * @param {import('prosemirror-view').EditorView} view
 * @param {DragEvent} event
 */
export function handleEditorDragStart(view, event) {
  const { from, to } = view.state.selection
  if (from === to || !event.dataTransfer) return false

  const text = view.state.doc.textBetween(from, to, '\n')
  if (!text) return false

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', text)
  return false
}

/** 供 TipTap editorProps 合并使用 */
export const editorDragOutProps = {
  handleDOMEvents: {
    dragstart: handleEditorDragStart,
  },
}
