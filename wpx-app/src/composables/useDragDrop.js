import { ref } from 'vue'
import { blobToDataUrl } from '@/utils/imageUtils'
import { markdownToHtml } from '@/utils/markdownToEditor'
import { toEditorContent } from '@/utils/aiSelection'

export const DRAG_DROP_TEXT_EXTENSIONS = new Set(['.md', '.txt'])
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

  editor.chain().focus().insertContent(toEditorContent(text)).run()
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
        insertTextFileContent(editor, text, getFileExtension(file.name))
        notifyChange()
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
