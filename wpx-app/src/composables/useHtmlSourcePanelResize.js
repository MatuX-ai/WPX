import { computed, getCurrentScope, onBeforeUnmount, onScopeDispose, ref } from 'vue'

/**
 * HTML 源码编辑面板宽度拖拽 composable
 *
 * 与 useDockPanelResize 的区别：
 *  - useDockPanelResize 用于右栏（resizer 在面板左侧），鼠标左拖变宽、右拖变窄
 *  - 本 composable 用于左栏（resizer 在面板右侧），鼠标右拖变宽、左拖变窄
 *
 * 状态写入 useHtmlSourcePanelStore，避免 EditorLayout 与 EditorCore
 * 之间的额外 props / emits 传递。
 *
 * 设计要点：
 *  - 状态持久化：宽度写到 store，关闭/重开面板后保留用户调整
 *  - 键盘支持：ArrowRight 变宽，ArrowLeft 变窄（与拖拽方向一致）
 *  - snapPoints 吸附：释放鼠标后吸附到最近的吸附点
 *  - 自动清理：组件卸载时移除全局事件监听
 */

import {
  HTML_SOURCE_PANEL_SNAP_POINTS,
  MAX_HTML_SOURCE_PANEL_WIDTH,
  MIN_HTML_SOURCE_PANEL_WIDTH,
  useHtmlSourcePanelStore,
} from '@/stores/htmlSourcePanel'

/**
 * @param {{
 *   snapPoints?: number[],
 *   snapThreshold?: number,
 *   keyboardStep?: number,
 * }} [options]
 */
export function useHtmlSourcePanelResize(options = {}) {
  const {
    snapPoints = HTML_SOURCE_PANEL_SNAP_POINTS,
    snapThreshold = 12,
    keyboardStep = 16,
  } = options

  const store = useHtmlSourcePanelStore()

  /** 拖拽过程中记录的起始鼠标 X 与起始宽度 */
  let dragStartX = 0
  let dragStartWidth = 0

  /** 是否正在拖拽中（用于 UI 高亮 / 禁用其他交互） */
  const isResizing = ref(false)

  /**
   * 把目标宽度夹紧到 [MIN_HTML_SOURCE_PANEL_WIDTH, MAX_HTML_SOURCE_PANEL_WIDTH]
   */
  function clamp(value) {
    if (!Number.isFinite(value)) return store.effectiveWidth
    return Math.max(
      MIN_HTML_SOURCE_PANEL_WIDTH,
      Math.min(MAX_HTML_SOURCE_PANEL_WIDTH, Math.round(value)),
    )
  }

  /**
   * 在 [snapPoints] 中查找距离 value 最近的点，若距离 ≤ snapThreshold 则吸附。
   */
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

  /**
   * mousedown 处理器：开始一次拖拽会话。
   */
  function startResize(event) {
    if (!event || event.button !== 0) return
    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (typeof event.stopPropagation === 'function') event.stopPropagation()

    dragStartX = event.clientX
    dragStartWidth = store.effectiveWidth
    isResizing.value = true

    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  function handleMouseMove(event) {
    if (!isResizing.value) return
    if (!event || typeof event.clientX !== 'number') return
    // 鼠标向右拖 → deltaX 为正 → 左面板变宽
    const deltaX = event.clientX - dragStartX
    const nextWidth = dragStartWidth + deltaX
    store.setWidth(nextWidth)
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

    // 释放鼠标后按 snapPoints 吸附
    const snapped = applySnap(store.effectiveWidth)
    if (snapped !== store.effectiveWidth) {
      store.setWidth(snapped)
    }
  }

  /**
   * keydown 处理器：键盘调整宽度
   * - ArrowRight → 变宽（增加宽度）
   * - ArrowLeft  → 变窄（减少宽度）
   * - Home       → 设为最大宽度
   * - End        → 设为最小宽度
   * - Enter / Space → 重置为默认宽度
   * 按住 Shift 时步长 ×4
   */
  function handleKeydown(event) {
    if (!event || typeof event.key !== 'string') return
    const step = event.shiftKey ? keyboardStep * 4 : keyboardStep
    let nextWidth = null
    let handled = true

    switch (event.key) {
      case 'ArrowRight':
        nextWidth = store.effectiveWidth + step
        break
      case 'ArrowLeft':
        nextWidth = store.effectiveWidth - step
        break
      case 'Home':
        nextWidth = MAX_HTML_SOURCE_PANEL_WIDTH
        break
      case 'End':
        nextWidth = MIN_HTML_SOURCE_PANEL_WIDTH
        break
      case 'Enter':
      case ' ':
      case 'Spacebar':
        store.resetWidth()
        break
      default:
        handled = false
    }

    if (!handled) return

    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (nextWidth != null) {
      store.setWidth(nextWidth)
    }
  }

  /**
   * 组件卸载 / scope 停止时清理全局监听，避免内存泄漏。
   */
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
    /** 当前实际生效的宽度（默认或用户值） */
    effectiveWidth: computed(() => store.effectiveWidth),
    /** 是否正在拖拽中 */
    isResizing,
    /** 是否被用户自定义过（区别于默认） */
    isCustomized: computed(() => store.isCustomized),
    /** mousedown 处理器：绑定到分隔条 */
    startResize,
    /** keydown 处理器：绑定到可聚焦的分隔条 */
    handleKeydown,
    /** 重置为默认宽度 */
    reset: store.resetWidth,
    /** 计算属性：当前宽度占 min-max 区间的 0~1 比例 */
    progress: computed(() => {
      const range = MAX_HTML_SOURCE_PANEL_WIDTH - MIN_HTML_SOURCE_PANEL_WIDTH
      if (range <= 0) return 0
      return (store.effectiveWidth - MIN_HTML_SOURCE_PANEL_WIDTH) / range
    }),
    /** 常量引用 */
    minWidth: MIN_HTML_SOURCE_PANEL_WIDTH,
    maxWidth: MAX_HTML_SOURCE_PANEL_WIDTH,
    snapPoints: HTML_SOURCE_PANEL_SNAP_POINTS,
  }
}

export default useHtmlSourcePanelResize