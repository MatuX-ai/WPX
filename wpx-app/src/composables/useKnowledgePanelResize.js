import { computed, getCurrentScope, onBeforeUnmount, onScopeDispose, ref, watch } from 'vue'

export const KNOWLEDGE_PANEL_WIDTH_KEY = 'wpx-knowledge-panel-width'
export const KNOWLEDGE_PANEL_DEFAULT_WIDTH = 420
export const KNOWLEDGE_PANEL_MIN_WIDTH = 320
export const KNOWLEDGE_PANEL_MAX_WIDTH = 720
export const KNOWLEDGE_PANEL_SNAP_POINTS = [320, 420, 520, 640]

function readStoredWidth() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(KNOWLEDGE_PANEL_WIDTH_KEY)
    if (raw == null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function writeStoredWidth(width) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KNOWLEDGE_PANEL_WIDTH_KEY, String(width))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * 资料库左侧抽屉宽度拖拽（分隔条在面板右侧：右拖变宽、左拖变窄）。
 */
export function useKnowledgePanelResize(options = {}) {
  const {
    defaultWidth = KNOWLEDGE_PANEL_DEFAULT_WIDTH,
    minWidth = KNOWLEDGE_PANEL_MIN_WIDTH,
    maxWidth = KNOWLEDGE_PANEL_MAX_WIDTH,
    snapPoints = KNOWLEDGE_PANEL_SNAP_POINTS,
    snapThreshold = 12,
    keyboardStep = 16,
    persist = true,
  } = options

  const stored = persist ? readStoredWidth() : null
  const userWidth = ref(
    stored != null
      ? Math.max(minWidth, Math.min(maxWidth, Math.round(stored)))
      : null,
  )
  const isResizing = ref(false)

  let dragStartX = 0
  let dragStartWidth = 0

  const effectiveWidth = computed(() =>
    userWidth.value == null ? defaultWidth : userWidth.value,
  )

  function clamp(value) {
    if (!Number.isFinite(value)) return effectiveWidth.value
    return Math.max(minWidth, Math.min(maxWidth, Math.round(value)))
  }

  function applySnap(value) {
    if (!Array.isArray(snapPoints) || snapPoints.length === 0 || snapThreshold <= 0) {
      return value
    }
    let nearest = null
    let nearestDist = Infinity
    for (const point of snapPoints) {
      const dist = Math.abs(point - value)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = point
      }
    }
    if (nearest != null && nearestDist <= snapThreshold) {
      return clamp(nearest)
    }
    return value
  }

  function setWidth(nextValue) {
    userWidth.value = clamp(nextValue)
  }

  function startResize(event) {
    if (!event || event.button !== 0) return
    event.preventDefault?.()
    event.stopPropagation?.()

    dragStartX = event.clientX
    dragStartWidth = effectiveWidth.value
    isResizing.value = true

    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  function handleMouseMove(event) {
    if (!isResizing.value || typeof event?.clientX !== 'number') return
    // 右拖 → deltaX 正 → 左栏变宽
    setWidth(dragStartWidth + (event.clientX - dragStartX))
  }

  function handleMouseUp() {
    if (!isResizing.value) return
    isResizing.value = false

    if (typeof document !== 'undefined') {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    const snapped = applySnap(effectiveWidth.value)
    if (snapped !== effectiveWidth.value) {
      userWidth.value = clamp(snapped)
    }
  }

  function handleKeydown(event) {
    if (!event || typeof event.key !== 'string') return
    const step = event.shiftKey ? keyboardStep * 4 : keyboardStep
    let nextWidth = null
    let handled = true

    switch (event.key) {
      case 'ArrowRight':
        nextWidth = effectiveWidth.value + step
        break
      case 'ArrowLeft':
        nextWidth = effectiveWidth.value - step
        break
      case 'Home':
        nextWidth = maxWidth
        break
      case 'End':
        nextWidth = minWidth
        break
      case 'Enter':
      case ' ':
      case 'Spacebar':
        userWidth.value = null
        break
      default:
        handled = false
    }

    if (!handled) return
    event.preventDefault?.()
    if (nextWidth != null) setWidth(nextWidth)
  }

  function reset() {
    userWidth.value = null
  }

  if (persist) {
    watch(
      effectiveWidth,
      (width) => {
        writeStoredWidth(width)
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty('--knowledge-panel-width', `${width}px`)
        }
      },
      { immediate: true, flush: 'sync' },
    )
  }

  const cleanup = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(cleanup)
  } else {
    onBeforeUnmount(cleanup)
  }

  return {
    effectiveWidth,
    userWidth,
    isResizing,
    isCustomized: computed(() => userWidth.value != null),
    startResize,
    handleKeydown,
    setWidth,
    reset,
    minWidth,
    maxWidth,
  }
}
