/**
 * Storybook mock for @/composables/useFloatingWindows
 * Replaces the real implementation that depends on appStore/editorStore
 * with a predictable static-position state.
 * Uses reactive refs so each story gets fresh defaults.
 */
import { ref } from 'vue'

export const FLOATING_WINDOW_ID = {
  AI_AVATAR: 'aiAvatar',
  AI_CHAT: 'aiChat',
  IMAGE_EDITOR: 'imageEditor',
}

// Singleton state that survives story transitions
const _posX = ref(80)
const _posY = ref(60)
const _windowW = ref(400)
const _windowH = ref(500)
const _visible = ref(true)
const _pinned = ref(false)

if (typeof window !== 'undefined') {
  window.__wpxFloatingState = {
    posX: _posX,
    posY: _posY,
    windowW: _windowW,
    windowH: _windowH,
    visible: _visible,
    pinned: _pinned,
  }
}

export function useFloatingWindowState(_id) {
  return {
    id: _id || 'aiChat',
    visible: _visible,
    pinned: _pinned,
    posX: _posX,
    posY: _posY,
    windowW: _windowW,
    windowH: _windowH,
    zIndex: ref(1001),
    minW: ref(300),
    minH: ref(300),
    open: () => { _visible.value = true },
    close: () => { _visible.value = false },
    togglePin: () => { _pinned.value = !_pinned.value },
    focus: () => {},
    clampToParent: () => {},
    updateConstraints: () => {},
  }
}

export function useFloatingWindows() {
  return {
    allWindows: [],
    open: () => {},
    close: () => {},
    togglePin: () => {},
    focus: () => {},
    getWindowState: () => useFloatingWindowState(),
  }
}

export function constrainFloatingWindow() {}
export function snapFloatingWindowPosition() {}
export function getFloatingParentBounds() {
  return { left: 0, top: 0, width: 1200, height: 800 }
}
export const FLOATING_WINDOW_EDGE_SNAP = {}
