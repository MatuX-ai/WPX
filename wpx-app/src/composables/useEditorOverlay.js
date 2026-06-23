import { computed, inject, provide } from 'vue'
import { useAppStore } from '@/stores/app'
import { useEditorStore } from '@/stores/editor'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'

export const EditorOverlayKey = Symbol('editorOverlay')

/**
 * 在 EditorLayout 中 provide 浮层状态，供子组件 inject 使用
 */
export function provideEditorOverlay() {
  const appStore = useAppStore()
  const editorStore = useEditorStore()
  const floatingWindows = useFloatingWindows()

  const overlay = {
    floatingWindows,

    knowledgePanelOpen: computed(() => appStore.knowledgePanelOpen),
    toggleKnowledgePanel: () => appStore.toggleKnowledgePanel(),
    openKnowledgePanel: () => {
      appStore.knowledgePanelOpen = true
    },
    closeKnowledgePanel: () => appStore.closeKnowledgePanel(),

    aiPanelOpen: computed(() => floatingWindows.isOpen(FLOATING_WINDOW_ID.AI_CHAT)),
    toggleAiPanel: () => floatingWindows.toggleWindow(FLOATING_WINDOW_ID.AI_CHAT),
    openAiPanel: () => floatingWindows.openWindow(FLOATING_WINDOW_ID.AI_CHAT),
    closeAiPanel: () => floatingWindows.closeWindow(FLOATING_WINDOW_ID.AI_CHAT),

    imageEditSession: computed(() => editorStore.imageEditSession),
    imageEditorOpen: computed(() => floatingWindows.isOpen(FLOATING_WINDOW_ID.IMAGE_EDITOR)),
    openImageEdit: (payload) => {
      editorStore.openImageEdit(payload)
      floatingWindows.openWindow(FLOATING_WINDOW_ID.IMAGE_EDITOR)
    },
    closeImageEdit: () => {
      floatingWindows.closeWindow(FLOATING_WINDOW_ID.IMAGE_EDITOR)
    },
    completeImageEdit: (blob) => editorStore.completeImageEdit(blob),

    handleEditorAreaClick: () => floatingWindows.handleEditorAreaClick(),
  }

  provide(EditorOverlayKey, overlay)
  return overlay
}

/**
 * 注入 EditorLayout 提供的浮层状态
 */
export function useEditorOverlay() {
  const overlay = inject(EditorOverlayKey, null)
  if (!overlay) {
    throw new Error('useEditorOverlay() must be used within EditorLayout')
  }
  return overlay
}

/**
 * 可选注入：不在 EditorLayout 内时返回 null
 */
export function useEditorOverlayOptional() {
  return inject(EditorOverlayKey, null)
}
