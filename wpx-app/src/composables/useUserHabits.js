import { onBeforeUnmount } from 'vue'
import { useUserHabitsStore, normalizeFormatSnapshot } from '@/stores/userHabits'
import { recordMemoryEvent } from '@/utils/memoryApi'
import { isElectron } from '@/utils/electron'

function formatsEqual(a, b) {
  if (!a || !b) return false
  return (
    a.font === b.font &&
    a.fontSize === b.fontSize &&
    a.lineHeight === b.lineHeight &&
    a.heading === b.heading
  )
}

/**
 * Read active format marks / block styles from a TipTap editor instance.
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 */
export function extractFormatFromEditor(editor) {
  if (!editor) {
    return normalizeFormatSnapshot({})
  }

  const headingAttrs = editor.getAttributes('heading')
  const heading = editor.isActive('heading') ? headingAttrs.level ?? null : null

  return normalizeFormatSnapshot({
    font: editor.getAttributes('fontFamily').fontFamily || null,
    fontSize: editor.getAttributes('fontSize').fontSize || null,
    lineHeight: editor.getAttributes('lineHeight').lineHeight || null,
    heading,
  })
}

/**
 * Track editor formatting habits and document save metadata.
 */
export function useUserHabits() {
  const store = useUserHabitsStore()
  let boundEditor = null
  let lastRecordedFormat = null
  let detachListener = null

  function recordFormatUsage(format, documentType) {
    const snapshot = normalizeFormatSnapshot(format)
    if (
      !snapshot.font &&
      !snapshot.fontSize &&
      !snapshot.lineHeight &&
      snapshot.heading == null
    ) {
      return
    }

    store.recordFormatUsage(documentType, snapshot)
    lastRecordedFormat = snapshot

    if (isElectron()) {
      recordMemoryEvent({
        action: 'format',
        documentType: documentType || store.sessionDocumentType,
        format: snapshot,
      }).catch((error) => {
        console.warn('[useUserHabits] Failed to record format memory:', error)
      })
    }
  }

  function handleTransaction({ editor }) {
    const nextFormat = extractFormatFromEditor(editor)
    if (formatsEqual(lastRecordedFormat, nextFormat)) return

    recordFormatUsage(nextFormat)
  }

  function bindEditor(editor) {
    unbindEditor()

    if (!editor) return

    boundEditor = editor
    lastRecordedFormat = extractFormatFromEditor(editor)
    editor.on('transaction', handleTransaction)

    detachListener = () => {
      editor.off('transaction', handleTransaction)
    }
  }

  function unbindEditor() {
    detachListener?.()
    detachListener = null
    boundEditor = null
    lastRecordedFormat = null
  }

  function recordSave(documentType, format) {
    const snapshot = format
      ? normalizeFormatSnapshot(format)
      : extractFormatFromEditor(boundEditor)

    store.recordSave(documentType, snapshot)
    lastRecordedFormat = snapshot

    if (isElectron()) {
      recordMemoryEvent({
        action: 'save',
        documentType,
        format: snapshot,
      }).catch((error) => {
        console.warn('[useUserHabits] Failed to record save memory:', error)
      })
    }
  }

  function getHabits(documentType) {
    return store.getHabits(documentType)
  }

  function applyFormat(format) {
    if (!boundEditor || !format) return

    const chain = boundEditor.chain().focus()

    if (format.font) {
      chain.setMark('fontFamily', { fontFamily: format.font })
    }

    if (format.fontSize) {
      chain.setMark('fontSize', { fontSize: format.fontSize })
    }

    if (format.lineHeight) {
      chain.setMark('lineHeight', { lineHeight: format.lineHeight })
    }

    if (format.heading != null) {
      chain.setHeading({ level: Number(format.heading) })
    }

    chain.run()
  }

  onBeforeUnmount(() => {
    unbindEditor()
  })

  return {
    bindEditor,
    unbindEditor,
    extractFormatFromEditor,
    recordFormatUsage,
    recordSave,
    getHabits,
    applyFormat,
    getRecentDocumentTypes: () => store.getRecentDocumentTypes(),
    sessionDocumentType: store.sessionDocumentType,
    setSessionDocumentType: store.setSessionDocumentType,
  }
}
