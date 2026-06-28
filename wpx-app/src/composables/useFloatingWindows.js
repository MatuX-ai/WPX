import { computed, reactive, readonly, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useEditorStore } from '@/stores/editor'
import {
  AI_AVATAR,
  AI_CHAT_WINDOW,
  IMAGE_EDITOR_WINDOW,
} from '@/constants/floatingWindow'
import {
  calcAiChatInitialPosition,
} from '@/composables/useFloatingWindow'
import { useWindowSize } from '@/composables/useWindowSize'
import {
  constrainFloatingWindow,
  FLOATING_WINDOW_EDGE_SNAP,
  getFloatingParentBounds,
  snapFloatingWindowPosition,
} from '@/composables/floatingWindowBounds'

export {
  constrainFloatingWindow,
  FLOATING_WINDOW_EDGE_SNAP,
  getFloatingParentBounds,
  snapFloatingWindowPosition,
}

export const FLOATING_WINDOW_ID = {
  AI_AVATAR: 'aiAvatar',
  AI_CHAT: 'aiChat',
  IMAGE_EDITOR: 'imageEditor',
}

const Z_INDEX_FLOOR = {
  [FLOATING_WINDOW_ID.AI_AVATAR]: AI_AVATAR.zIndex,
  [FLOATING_WINDOW_ID.AI_CHAT]: AI_CHAT_WINDOW.zIndex,
  [FLOATING_WINDOW_ID.IMAGE_EDITOR]: IMAGE_EDITOR_WINDOW.zIndex,
}

function calcImageEditorInitialPosition(bounds) {
  const w = IMAGE_EDITOR_WINDOW.defaultW
  const h = IMAGE_EDITOR_WINDOW.defaultH
  const margin = 24
  return {
    x: Math.max(margin, (bounds.width - w) / 2),
    y: Math.max(margin, (bounds.height - h) / 2),
  }
}

function createWindowRecord(id, defaults) {
  return {
    id,
    visible: defaults.visible ?? false,
    pinned: false,
    /**
     * 展示模式：
     *   - 'floating'：以浮窗形式悬浮在视口上（默认）
     *   - 'docked'：贴边到编辑器右侧栏，类似 IDE 侧边栏体验
     */
    mode: defaults.mode ?? 'floating',
    x: defaults.x ?? 0,
    y: defaults.y ?? 0,
    w: defaults.w,
    h: defaults.h,
    minW: defaults.minW ?? 0,
    minH: defaults.minH ?? 0,
    baseZIndex: defaults.baseZIndex,
    zIndex: defaults.baseZIndex,
    autoCloseOnEditorClick: defaults.autoCloseOnEditorClick ?? true,
    closable: defaults.closable ?? true,
    fixed: defaults.fixed ?? false,
    positionInitialized: defaults.positionInitialized ?? false,
  }
}

function getAiChatConstraintOptions() {
  const windowSize = useWindowSize()
  const layout = windowSize.chatWindowLayout.value

  return {
    minW: layout.minW,
    minH: layout.minH,
    minTop: windowSize.chatWindowMinTop.value,
    avatarSize: windowSize.avatarSize.value,
    layout,
  }
}

function createFloatingWindowsManager(initialConfig = {}) {
  const config = reactive({
    autoCloseUnpinnedOnEditorClick: initialConfig.autoCloseUnpinnedOnEditorClick ?? true,
  })

  const zIndexCounter = ref(IMAGE_EDITOR_WINDOW.zIndex)
  let viewportListenerAttached = false

  function resolveConstraintOptions(id, options = {}) {
    if (id === FLOATING_WINDOW_ID.AI_CHAT) {
      const chatOptions = getAiChatConstraintOptions()
      return {
        minTop: options.minTop ?? chatOptions.minTop,
        snap: options.snap ?? true,
        minW: options.minW ?? chatOptions.minW,
        minH: options.minH ?? chatOptions.minH,
      }
    }

    return {
      minTop: options.minTop ?? 0,
      snap: options.snap ?? true,
      minW: options.minW,
      minH: options.minH,
    }
  }

  /**
   * parentLimitation：约束浮动窗口在视口内，移动时支持边缘吸附
   */
  function clampWindowToParent(id, options = {}) {
    const win = assertWindow(id)
    if (win.fixed) return win

    const constraintOptions = resolveConstraintOptions(id, options)
    const bounds = getFloatingParentBounds()
    const result = constrainFloatingWindow({
      x: win.x,
      y: win.y,
      w: win.w,
      h: win.h,
      minW: constraintOptions.minW ?? win.minW ?? 0,
      minH: constraintOptions.minH ?? win.minH ?? 0,
      minTop: constraintOptions.minTop,
      snap: constraintOptions.snap,
      bounds,
    })

    win.x = result.x
    win.y = result.y
    win.w = result.w
    win.h = result.h
    return result
  }

  function handleViewportResize() {
    for (const id of [FLOATING_WINDOW_ID.AI_CHAT, FLOATING_WINDOW_ID.IMAGE_EDITOR]) {
      const win = windows[id]
      if (!win?.visible || win.fixed) continue
      clampWindowToParent(id, { snap: false })
    }
  }

  function ensureViewportListener() {
    if (viewportListenerAttached || typeof window === 'undefined') return
    window.addEventListener('resize', handleViewportResize)
    viewportListenerAttached = true
  }

  const windows = reactive({
    [FLOATING_WINDOW_ID.AI_AVATAR]: createWindowRecord(FLOATING_WINDOW_ID.AI_AVATAR, {
      visible: true,
      fixed: true,
      baseZIndex: AI_AVATAR.zIndex,
      closable: false,
      autoCloseOnEditorClick: false,
      w: AI_AVATAR.size,
      h: AI_AVATAR.size,
    }),
    [FLOATING_WINDOW_ID.AI_CHAT]: createWindowRecord(FLOATING_WINDOW_ID.AI_CHAT, {
      visible: false,
      w: AI_CHAT_WINDOW.defaultW,
      h: AI_CHAT_WINDOW.defaultH,
      minW: AI_CHAT_WINDOW.minW,
      minH: AI_CHAT_WINDOW.minH,
      baseZIndex: AI_CHAT_WINDOW.zIndex,
      autoCloseOnEditorClick: true,
    }),
    [FLOATING_WINDOW_ID.IMAGE_EDITOR]: createWindowRecord(FLOATING_WINDOW_ID.IMAGE_EDITOR, {
      visible: false,
      w: IMAGE_EDITOR_WINDOW.defaultW,
      h: IMAGE_EDITOR_WINDOW.defaultH,
      minW: 520,
      minH: 420,
      baseZIndex: IMAGE_EDITOR_WINDOW.zIndex,
      autoCloseOnEditorClick: true,
    }),
  })

  const topmostWindowId = computed(() => {
    let topId = null
    let topZ = -1

    for (const id of [FLOATING_WINDOW_ID.AI_CHAT, FLOATING_WINDOW_ID.IMAGE_EDITOR]) {
      const win = windows[id]
      if (!win?.visible) continue
      if (win.zIndex > topZ) {
        topZ = win.zIndex
        topId = id
      }
    }

    return topId
  })

  function assertWindow(id) {
    const win = windows[id]
    if (!win) {
      throw new Error(`[useFloatingWindows] Unknown window id: ${id}`)
    }
    return win
  }

  function initWindowPosition(id) {
    const win = assertWindow(id)
    const bounds = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    if (id === FLOATING_WINDOW_ID.AI_CHAT) {
      const { layout, minTop, avatarSize } = getAiChatConstraintOptions()
      win.w = layout.defaultW
      win.h = layout.defaultH
      win.minW = layout.minW
      win.minH = layout.minH

      const position = calcAiChatInitialPosition(
        bounds,
        { ...AI_CHAT_WINDOW, ...layout },
        { ...AI_AVATAR, size: avatarSize },
        { minTop },
      )
      const constrained = constrainFloatingWindow({
        x: position.x,
        y: position.y,
        w: win.w,
        h: win.h,
        minW: win.minW,
        minH: win.minH,
        minTop,
        snap: false,
        bounds,
      })
      win.x = constrained.x
      win.y = constrained.y
      win.w = constrained.w
      win.h = constrained.h
      win.positionInitialized = true
      return
    }

    if (id === FLOATING_WINDOW_ID.IMAGE_EDITOR) {
      const position = calcImageEditorInitialPosition(bounds)
      const constrained = constrainFloatingWindow({
        x: position.x,
        y: position.y,
        w: win.w,
        h: win.h,
        minW: win.minW,
        minH: win.minH,
        bounds,
        snap: false,
      })
      win.x = constrained.x
      win.y = constrained.y
      win.w = constrained.w
      win.h = constrained.h
    }

    win.positionInitialized = true
  }

  function bringToFront(id) {
    const win = assertWindow(id)
    if (win.fixed) return win.zIndex

    zIndexCounter.value += 1
    win.zIndex = Math.max(zIndexCounter.value, win.baseZIndex)
    zIndexCounter.value = win.zIndex
    return win.zIndex
  }

  function setZIndex(id, zIndex) {
    const win = assertWindow(id)
    if (win.fixed) {
      win.zIndex = win.baseZIndex
      return win.zIndex
    }

    const next = Math.max(Number(zIndex) || win.baseZIndex, win.baseZIndex)
    win.zIndex = next
    if (next > zIndexCounter.value) {
      zIndexCounter.value = next
    }
    return win.zIndex
  }

  function syncExternalState(id, visible) {
    if (id === FLOATING_WINDOW_ID.AI_CHAT) {
      useAppStore().aiPanelOpen = visible
      return
    }

    if (id === FLOATING_WINDOW_ID.IMAGE_EDITOR && !visible) {
      useEditorStore().closeImageEdit()
    }
  }

  function openWindow(id) {
    const win = assertWindow(id)
    if (win.visible) {
      bringToFront(id)
      return
    }

    if (!win.positionInitialized && !win.fixed) {
      initWindowPosition(id)
    }

    win.visible = true
    bringToFront(id)
    syncExternalState(id, true)
  }

  function closeWindow(id) {
    const win = assertWindow(id)
    if (!win.closable || !win.visible) return

    win.visible = false
    win.zIndex = win.baseZIndex
    syncExternalState(id, false)
  }

  function toggleWindow(id) {
    const win = assertWindow(id)
    if (win.visible) {
      closeWindow(id)
    } else {
      openWindow(id)
    }
  }

  function togglePin(id) {
    const win = assertWindow(id)
    win.pinned = !win.pinned
    if (win.visible) {
      bringToFront(id)
    }
    return win.pinned
  }

  function isOpen(id) {
    return Boolean(windows[id]?.visible)
  }

  function isPinned(id) {
    return Boolean(windows[id]?.pinned)
  }

  function getWindow(id) {
    return windows[id] ?? null
  }

  function getZIndex(id) {
    return windows[id]?.zIndex ?? Z_INDEX_FLOOR[id] ?? 0
  }

  function setPosition(id, { x, y }, options = {}) {
    const win = assertWindow(id)
    if (win.fixed) return win

    const constraintOptions = resolveConstraintOptions(id, options)
    const bounds = getFloatingParentBounds()
    const result = constrainFloatingWindow({
      x: typeof x === 'number' ? x : win.x,
      y: typeof y === 'number' ? y : win.y,
      w: win.w,
      h: win.h,
      minW: constraintOptions.minW ?? win.minW ?? 0,
      minH: constraintOptions.minH ?? win.minH ?? 0,
      minTop: constraintOptions.minTop,
      snap: constraintOptions.snap,
      bounds,
    })

    win.x = result.x
    win.y = result.y
    win.w = result.w
    win.h = result.h
    return win
  }

  function setSize(id, { w, h }, options = {}) {
    const win = assertWindow(id)
    const constraintOptions = resolveConstraintOptions(id, options)
    const bounds = getFloatingParentBounds()
    const result = constrainFloatingWindow({
      x: win.x,
      y: win.y,
      w: typeof w === 'number' ? w : win.w,
      h: typeof h === 'number' ? h : win.h,
      minW: constraintOptions.minW ?? win.minW ?? 0,
      minH: constraintOptions.minH ?? win.minH ?? 0,
      minTop: constraintOptions.minTop,
      snap: constraintOptions.snap,
      bounds,
    })

    win.x = result.x
    win.y = result.y
    win.w = result.w
    win.h = result.h
    return win
  }

  function updateWindowConstraints(id, { minW, minH, w, h } = {}) {
    const win = assertWindow(id)
    if (typeof minW === 'number') win.minW = minW
    if (typeof minH === 'number') win.minH = minH
    if (typeof w === 'number') win.w = w
    if (typeof h === 'number') win.h = h
    return clampWindowToParent(id, { snap: false })
  }

  function updateWindow(id, patch) {
    const win = assertWindow(id)
    Object.assign(win, patch)
  }

  function setAutoCloseOnEditorClick(enabled) {
    config.autoCloseUnpinnedOnEditorClick = Boolean(enabled)
  }

  function setWindowAutoCloseOnEditorClick(id, enabled) {
    const win = assertWindow(id)
    win.autoCloseOnEditorClick = Boolean(enabled)
  }

  function handleEditorAreaClick() {
    if (!config.autoCloseUnpinnedOnEditorClick) return

    for (const id of [FLOATING_WINDOW_ID.AI_CHAT, FLOATING_WINDOW_ID.IMAGE_EDITOR]) {
      const win = windows[id]
      if (!win?.visible || win.pinned || !win.autoCloseOnEditorClick) continue
      closeWindow(id)
    }
  }

  function handleWindowFocus(id) {
    if (!isOpen(id)) return
    bringToFront(id)
  }

  /**
   * AI 对话窗支持贴边（dock）到右侧栏。
   * dock 时，浮窗不再作为 fixed 浮窗渲染，而是被 AiAssistantPlaceholder
   * 以 inline 形式嵌入到 EditorLayout 的右栏容器中。
   * dock 切换会同时打开窗口（若未打开），以确保用户总是能看到 AI 助手内容。
   *
   * 副作用：贴边后 autoCloseOnEditorClick 强制为 false，避免点击编辑器误关右栏。
   */
  function dockWindow(id) {
    const win = assertWindow(id)
    if (win.mode === 'docked') return
    win.mode = 'docked'
    win.autoCloseOnEditorClick = false
    if (!win.visible) {
      win.visible = true
      syncExternalState(id, true)
    }
  }

  /**
   * 解除贴边：恢复为右下角浮窗模式。
   * 不会自动关闭，调用方按需处理。
   */
  function undockWindow(id) {
    const win = assertWindow(id)
    if (win.mode !== 'docked') return
    win.mode = 'floating'
    win.autoCloseOnEditorClick = true
  }

  function isDocked(id) {
    return Boolean(windows[id]?.mode === 'docked')
  }

  function getMode(id) {
    return windows[id]?.mode ?? 'floating'
  }

  ensureViewportListener()

  return {
    windows: readonly(windows),
    config: readonly(config),
    topmostWindowId,
    openWindow,
    closeWindow,
    toggleWindow,
    togglePin,
    setZIndex,
    bringToFront,
    isOpen,
    isPinned,
    isDocked,
    getMode,
    getWindow,
    getZIndex,
    setPosition,
    setSize,
    clampWindowToParent,
    updateWindowConstraints,
    updateWindow,
    initWindowPosition,
    setAutoCloseOnEditorClick,
    setWindowAutoCloseOnEditorClick,
    handleEditorAreaClick,
    handleWindowFocus,
    dockWindow,
    undockWindow,
  }
}

/** @type {ReturnType<typeof createFloatingWindowsManager> | null} */
let manager = null

/**
 * 集中管理所有浮动窗口的可见性、位置、尺寸、z-index
 * @param {object} [options]
 * @param {boolean} [options.autoCloseUnpinnedOnEditorClick=true]
 */
export function useFloatingWindows(options = {}) {
  if (!manager) {
    manager = createFloatingWindowsManager(options)
  }
  return manager
}

/**
 * 重置单例（主要用于测试）
 */
export function resetFloatingWindows() {
  manager = null
}

/**
 * 绑定单个浮动窗口的状态（供 AiChatWindow / ImageEditor 等组件使用）
 */
export function useFloatingWindowState(id) {
  const floatingWindows = useFloatingWindows()
  const win = computed(() => floatingWindows.getWindow(id))

  return {
    window: win,
    visible: computed(() => win.value?.visible ?? false),
    pinned: computed(() => win.value?.pinned ?? false),
    /** 当前展示模式：'floating' 浮窗 / 'docked' 贴边右栏 */
    mode: computed(() => win.value?.mode ?? 'floating'),
    isDocked: computed(() => win.value?.mode === 'docked'),
    zIndex: computed(() => floatingWindows.getZIndex(id)),
    minW: computed(() => win.value?.minW ?? 0),
    minH: computed(() => win.value?.minH ?? 0),
    posX: computed({
      get: () => win.value?.x ?? 0,
      set: (value) => floatingWindows.setPosition(id, { x: value }),
    }),
    posY: computed({
      get: () => win.value?.y ?? 0,
      set: (value) => floatingWindows.setPosition(id, { y: value }),
    }),
    windowW: computed({
      get: () => win.value?.w ?? 0,
      set: (value) => floatingWindows.setSize(id, { w: value }),
    }),
    windowH: computed({
      get: () => win.value?.h ?? 0,
      set: (value) => floatingWindows.setSize(id, { h: value }),
    }),
    width: computed({
      get: () => win.value?.w ?? 0,
      set: (value) => floatingWindows.setSize(id, { w: value }),
    }),
    height: computed({
      get: () => win.value?.h ?? 0,
      set: (value) => floatingWindows.setSize(id, { h: value }),
    }),
    open: () => floatingWindows.openWindow(id),
    close: () => floatingWindows.closeWindow(id),
    togglePin: () => floatingWindows.togglePin(id),
    focus: () => floatingWindows.handleWindowFocus(id),
    dock: () => floatingWindows.dockWindow(id),
    undock: () => floatingWindows.undockWindow(id),
    clampToParent: (options) => floatingWindows.clampWindowToParent(id, options),
    updateConstraints: (options) => floatingWindows.updateWindowConstraints(id, options),
  }
}
