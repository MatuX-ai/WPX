import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { isEditorRoute } from '@/utils/windowContext'

/** @typedef {'newDocument' | 'save' | 'toggleAiChat' | 'openImageEditor' | 'bold' | 'italic' | 'toggleHtmlSourcePanel'} ShortcutId */

/** @type {Record<ShortcutId, { win: string, mac: string }>} */
export const GLOBAL_SHORTCUTS = {
  newDocument: { win: 'Ctrl+N', mac: '⌘N' },
  save: { win: 'Ctrl+S', mac: '⌘S' },
  toggleAiChat: { win: 'Ctrl+Shift+W', mac: '⌘⇧W' },
  openImageEditor: { win: 'Ctrl+Shift+I', mac: '⌘⇧I' },
  bold: { win: 'Ctrl+B', mac: '⌘B' },
  italic: { win: 'Ctrl+I', mac: '⌘I' },
  toggleHtmlSourcePanel: { win: 'Ctrl+Shift+H', mac: '⌘⇧H' },
}

function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    || (navigator.userAgentData?.platform === 'macOS')
}

/**
 * @param {ShortcutId} id
 * @returns {string}
 */
export function getShortcutLabel(id) {
  const entry = GLOBAL_SHORTCUTS[id]
  if (!entry) return ''
  return isApplePlatform() ? entry.mac : entry.win
}

/**
 * @param {string} actionLabel
 * @param {ShortcutId} id
 * @returns {string}
 */
export function shortcutTooltip(actionLabel, id) {
  const hint = getShortcutLabel(id)
  return hint ? `${actionLabel} (${hint})` : actionLabel
}

function isFormField(element) {
  const tag = element.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * @param {KeyboardEvent} event
 * @param {import('pinia').Store} appStore
 */
function shouldBypassShortcuts(event, appStore) {
  const target = event.target
  if (!(target instanceof Element)) return false

  if (appStore.saveDialog.open) return true
  if (target.closest('.save-dialog')) return true
  if (target.closest('.ai-chat-window')) return true
  if (target.closest('.tui-image-editor')) return true
  if (target.closest('.settings-card')) return true

  if (isFormField(target) && !target.closest('.ProseMirror')) {
    return true
  }

  if (target.isContentEditable && !target.closest('.ProseMirror')) {
    return true
  }

  return false
}

/**
 * @param {KeyboardEvent} event
 */
function hasModifier(event) {
  return event.ctrlKey || event.metaKey
}

/**
 * 全局 / 编辑器快捷键
 * @param {object} handlers
 * @param {() => boolean} [handlers.enabled]
 * @param {() => void} [handlers.onNewDocument]
 * @param {() => void} [handlers.onSave]
 * @param {() => void} [handlers.onToggleAiChat]
 * @param {() => void} [handlers.onOpenImageEditor]
 * @param {() => void} [handlers.onToggleHtmlSourcePanel]
 * @param {() => import('@tiptap/core').Editor | null | undefined} [handlers.getEditor]
 */
export function useGlobalShortcuts(handlers = {}) {
  const route = useRoute()
  const appStore = useAppStore()

  function isEnabled() {
    if (handlers.enabled) {
      return handlers.enabled()
    }
    return isEditorRoute(route)
  }

  function handleKeydown(event) {
    if (!isEnabled()) return
    if (shouldBypassShortcuts(event, appStore)) return
    if (!hasModifier(event)) return

    const key = event.key.toLowerCase()
    const editor = handlers.getEditor?.()

    if (event.shiftKey && key === 'w') {
      event.preventDefault()
      handlers.onToggleAiChat?.()
      return
    }

    if (event.shiftKey && key === 'i') {
      if (editor?.isActive?.('image')) {
        event.preventDefault()
        handlers.onOpenImageEditor?.()
      }
      return
    }

    if (event.shiftKey && key === 'h') {
      event.preventDefault()
      handlers.onToggleHtmlSourcePanel?.()
      return
    }

    if (!event.shiftKey && key === 'n') {
      event.preventDefault()
      handlers.onNewDocument?.()
      return
    }

    if (!event.shiftKey && key === 's') {
      event.preventDefault()
      handlers.onSave?.()
      return
    }

    if (!event.shiftKey && (key === 'b' || key === 'i')) {
      if (!editor?.isFocused) return

      event.preventDefault()
      if (key === 'b') {
        editor.chain().focus().toggleBold().run()
      } else {
        editor.chain().focus().toggleItalic().run()
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    getShortcutLabel,
    shortcutTooltip,
    GLOBAL_SHORTCUTS,
  }
}
