import { computed, getCurrentScope, onBeforeUnmount, onScopeDispose, ref } from 'vue'

/**
 * 面板尺寸拖拽调整 composable（用于 EditorLayout 右栏 docked 模式）。
 *
 * 设计要点：
 * - 用户可通过鼠标拖拽分隔条改变面板宽度，支持方向：左拖变宽、右拖变窄。
 * - 支持键盘操作（Arrow/Home/End），Shift 加速。
 * - 拖拽过程中禁用文本选择，避免拖到一半误选中文本。
 * - 默认值与用户值分离：`width`（用户值） vs `effectiveWidth`（实际生效）。
 *   未调整时 `effectiveWidth === defaultWidth`，UI 可通过 `isCustomized`
 *   判断是否显示"重置为默认"按钮。
 * - 释放鼠标后按 snapPoints 自动吸附（如果配置）。
 *
 * @example
 *   const { effectiveWidth, isResizing, startResize, handleKeydown, reset } = useDockPanelResize({
 *     defaultWidth: 400,
 *     minWidth: 280,
 *     maxWidth: 720,
 *     keyboardStep: 16,
 *     snapPoints: [320, 400, 480, 560],
 *     snapThreshold: 12,
 *   })
 */
export function useDockPanelResize(options = {}) {
  const {
    defaultWidth,
    minWidth,
    maxWidth,
    keyboardStep = 16,
    snapPoints = [],
    snapThreshold = 0,
  } = options

  if (typeof defaultWidth !== 'number' || !Number.isFinite(defaultWidth)) {
    throw new TypeError('useDockPanelResize: defaultWidth 必须是有限数字')
  }
  if (typeof minWidth !== 'number' || !Number.isFinite(minWidth)) {
    throw new TypeError('useDockPanelResize: minWidth 必须是有限数字')
  }
  if (typeof maxWidth !== 'number' || !Number.isFinite(maxWidth)) {
    throw new TypeError('useDockPanelResize: maxWidth 必须是有限数字')
  }
  if (minWidth > maxWidth) {
    throw new RangeError('useDockPanelResize: minWidth 不能大于 maxWidth')
  }
  if (defaultWidth < minWidth || defaultWidth > maxWidth) {
    // 默认值越界时夹到范围内，避免下游样式异常
    // eslint-disable-next-line no-console
    console.warn(
      `[useDockPanelResize] defaultWidth=${defaultWidth} 超出 [${minWidth}, ${maxWidth}]，将被夹紧。`,
    )
  }

  /** 用户调整后的宽度。null 表示未调整，使用 defaultWidth。 */
  const userWidth = ref(null)

  /** 拖拽过程中记录的起始鼠标 X 与起始宽度 */
  let dragStartX = 0
  let dragStartWidth = 0

  /** 是否正在拖拽中（用于 UI 高亮 / 禁用其他交互） */
  const isResizing = ref(false)

  /** 实际生效的宽度：未调整时用 defaultWidth，否则用 userWidth */
  const effectiveWidth = computed(() => {
    return userWidth.value == null ? defaultWidth : userWidth.value
  })

  /** 是否被用户自定义过 */
  const isCustomized = computed(() => userWidth.value != null)

  /** 把目标宽度夹紧到 [minWidth, maxWidth] */
  function clamp(value) {
    if (!Number.isFinite(value)) return effectiveWidth.value
    return Math.max(minWidth, Math.min(maxWidth, Math.round(value)))
  }

  /** 设置用户宽度（不会写回 null，只设置实际数值） */
  function setWidth(nextValue) {
    userWidth.value = clamp(nextValue)
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
   * 处理 mousedown 事件：开始一次拖拽会话。
   * 在 mousedown handler 中调用即可，无需关心后续 mousemove / mouseup。
   */
  function startResize(event) {
    if (!event || event.button !== 0) return
    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (typeof event.stopPropagation === 'function') event.stopPropagation()

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
    if (!isResizing.value) return
    if (!event || typeof event.clientX !== 'number') return
    // 鼠标向左拖 → deltaX 为负 → 右栏变宽（width 增大）
    const deltaX = event.clientX - dragStartX
    const nextWidth = dragStartWidth - deltaX
    setWidth(nextWidth)
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
    const snapped = applySnap(effectiveWidth.value)
    if (snapped !== effectiveWidth.value) {
      userWidth.value = clamp(snapped)
    }
  }

  /**
   * 处理 keydown 事件：键盘调整宽度。
   * - ArrowLeft  → 变宽（增加宽度）
   * - ArrowRight → 变窄（减少宽度）
   * - Home       → 设为 maxWidth
   * - End        → 设为 minWidth
   * - Enter / Space → 重置为默认宽度（便于触屏 / 键盘用户回退）
   * 按住 Shift 时步长 ×4。
   */
  function handleKeydown(event) {
    if (!event || typeof event.key !== 'string') return
    const step = (event.shiftKey ? keyboardStep * 4 : keyboardStep)
    let nextWidth = null
    let handled = true

    switch (event.key) {
      case 'ArrowLeft':
        nextWidth = effectiveWidth.value + step
        break
      case 'ArrowRight':
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

    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (nextWidth != null) {
      setWidth(nextWidth)
    }
  }

  /**
   * 重置为默认宽度（清除用户调整状态）。
   */
  function reset() {
    userWidth.value = null
  }

  // 组件卸载 / scope 停止时清理全局监听，避免内存泄漏。
  // 使用 VueUse 同款的 tryOnScopeDispose 模式：组件 setup 中走 onBeforeUnmount，
  // effectScope（单元测试场景）中走 onScopeDispose。
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
    effectiveWidth,
    /** 当前用户调整值（null 表示未调整） */
    userWidth,
    /** 是否正在拖拽中 */
    isResizing,
    /** 是否被用户自定义过（区别于默认） */
    isCustomized,
    /** mousedown 处理器：绑定到分隔条 */
    startResize,
    /** keydown 处理器：绑定到可聚焦的分隔条 */
    handleKeydown,
    /** 手动设置宽度（外部代码也可调用） */
    setWidth,
    /** 重置为默认宽度 */
    reset,
    /** 计算属性：当前宽度占 min-max 区间的 0~1 比例 */
    progress: computed(() => {
      const range = maxWidth - minWidth
      if (range <= 0) return 0
      return (effectiveWidth.value - minWidth) / range
    }),
  }
}