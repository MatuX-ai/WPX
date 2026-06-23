import { computed, readonly, ref } from 'vue'

export const WINDOW_BREAKPOINTS = {
  sm: 900,
  md: 1200,
}

const DEBOUNCE_MS = 100

/** @typedef {'sm' | 'md' | 'lg'} WindowBreakpoint */

/**
 * @param {number} width
 * @returns {WindowBreakpoint}
 */
export function resolveWindowBreakpoint(width) {
  if (width < WINDOW_BREAKPOINTS.sm) return 'sm'
  if (width <= WINDOW_BREAKPOINTS.md) return 'md'
  return 'lg'
}

function readViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1200, height: 800 }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function createWindowSizeManager() {
  const initial = readViewportSize()
  const width = ref(initial.width)
  const height = ref(initial.height)
  let debounceTimer = null
  let listening = false

  function applySize(nextWidth, nextHeight) {
    width.value = nextWidth
    height.value = nextHeight
  }

  function syncViewportSize() {
    const { width: nextWidth, height: nextHeight } = readViewportSize()
    applySize(nextWidth, nextHeight)
  }

  function handleResize() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer)
    }

    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      syncViewportSize()
    }, DEBOUNCE_MS)
  }

  function ensureListening() {
    if (listening || typeof window === 'undefined') return

    window.addEventListener('resize', handleResize)
    listening = true
    syncViewportSize()
  }

  const breakpoint = computed(() => resolveWindowBreakpoint(width.value))

  const isSm = computed(() => breakpoint.value === 'sm')
  const isMd = computed(() => breakpoint.value === 'md')
  const isLg = computed(() => breakpoint.value === 'lg')

  /** 宽度 < 900px */
  const isCompactWidth = computed(() => width.value < WINDOW_BREAKPOINTS.sm)

  /** 高度 < 600px */
  const isShortHeight = computed(() => height.value < 600)

  const isToolbarIconOnly = computed(() => isCompactWidth.value)

  const avatarSize = computed(() => (isCompactWidth.value ? 42 : 56))

  const chatWindowLayout = computed(() => {
    if (isCompactWidth.value) {
      return {
        defaultW: 360,
        defaultH: 450,
        minW: 300,
        minH: 300,
      }
    }

    return {
      defaultW: 400,
      defaultH: 500,
      minW: 300,
      minH: 300,
    }
  })

  /** 对话窗顶部距窗口顶部的最小距离 */
  const chatWindowMinTop = computed(() => (isShortHeight.value ? 10 : 0))

  return {
    width: readonly(width),
    height: readonly(height),
    breakpoint,
    isSm,
    isMd,
    isLg,
    isCompactWidth,
    isShortHeight,
    isToolbarIconOnly,
    avatarSize,
    chatWindowLayout,
    chatWindowMinTop,
    ensureListening,
    syncViewportSize,
  }
}

/** @type {ReturnType<typeof createWindowSizeManager> | null} */
let manager = null

/**
 * 窗口尺寸与响应式断点（单例，debounce 100ms）
 */
export function useWindowSize() {
  if (!manager) {
    manager = createWindowSizeManager()
  }

  manager.ensureListening()
  return manager
}

/**
 * 重置单例（主要用于测试）
 */
export function resetWindowSize() {
  manager = null
}
