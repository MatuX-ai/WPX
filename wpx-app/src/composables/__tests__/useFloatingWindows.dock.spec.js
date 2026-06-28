/**
 * useFloatingWindows — dock / undock 行为单元测试
 *
 * 覆盖场景：
 * - 默认 mode 为 floating
 * - dockWindow 切换 mode=docked，且强制 autoCloseOnEditorClick=false
 * - 未打开时 dockWindow 会自动打开窗口
 * - undockWindow 还原 mode=floating 且 autoCloseOnEditorClick=true
 * - isDocked / getMode 状态一致
 * - useFloatingWindowState 提供 isDocked computed
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mockAppStore = {
  aiPanelOpen: false,
}

const mockEditorStore = {
  closeImageEdit: vi.fn(),
}

vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

vi.mock('@/stores/editor', () => ({
  useEditorStore: () => mockEditorStore,
}))

const mockWindowSize = {
  width: ref(1440),
  height: ref(900),
  avatarSize: ref(56),
  chatWindowLayout: ref({
    defaultW: 400,
    defaultH: 500,
    minW: 300,
    minH: 300,
  }),
  chatWindowMinTop: ref(0),
}

vi.mock('@/composables/useWindowSize', () => ({
  useWindowSize: () => mockWindowSize,
}))

vi.mock('@/composables/useFloatingWindow', () => ({
  calcAiChatInitialPosition: vi.fn(() => ({ x: 100, y: 120 })),
}))

describe('useFloatingWindows — dock / undock 行为', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAppStore.aiPanelOpen = false
    mockEditorStore.closeImageEdit.mockClear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('AI_CHAT 窗口默认 mode 为 floating', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    expect(fw.getMode(FLOATING_WINDOW_ID.AI_CHAT)).toBe('floating')
    expect(fw.isDocked(FLOATING_WINDOW_ID.AI_CHAT)).toBe(false)
  })

  it('dockWindow 后 mode 切换为 docked', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    await nextTick()

    expect(fw.getMode(FLOATING_WINDOW_ID.AI_CHAT)).toBe('docked')
    expect(fw.isDocked(FLOATING_WINDOW_ID.AI_CHAT)).toBe(true)
  })

  it('dockWindow 强制 autoCloseOnEditorClick=false（避免误关右栏）', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()
    const win = fw.getWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(win.autoCloseOnEditorClick).toBe(true)

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)

    expect(fw.getWindow(FLOATING_WINDOW_ID.AI_CHAT).autoCloseOnEditorClick).toBe(false)
  })

  it('dockWindow 时若窗口未打开，会自动打开窗口', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()
    expect(fw.isOpen(FLOATING_WINDOW_ID.AI_CHAT)).toBe(false)

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)

    expect(fw.isOpen(FLOATING_WINDOW_ID.AI_CHAT)).toBe(true)
    // 同步外部状态：app.aiPanelOpen
    expect(mockAppStore.aiPanelOpen).toBe(true)
  })

  it('对未打开的窗口 dock 后再次 dock 不会重复触发副作用', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    const win = fw.getWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(win.mode).toBe('docked')

    // 二次 dock 不应报错或改变 mode
    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(win.mode).toBe('docked')
  })

  it('undockWindow 还原 mode 为 floating', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(fw.isDocked(FLOATING_WINDOW_ID.AI_CHAT)).toBe(true)

    fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    await nextTick()

    expect(fw.isDocked(FLOATING_WINDOW_ID.AI_CHAT)).toBe(false)
    expect(fw.getMode(FLOATING_WINDOW_ID.AI_CHAT)).toBe('floating')
  })

  it('undockWindow 还原 autoCloseOnEditorClick=true', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(fw.getWindow(FLOATING_WINDOW_ID.AI_CHAT).autoCloseOnEditorClick).toBe(false)

    fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(fw.getWindow(FLOATING_WINDOW_ID.AI_CHAT).autoCloseOnEditorClick).toBe(true)
  })

  it('undockWindow 不会自动关闭窗口（保持 visible 由调用方决定）', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    expect(fw.isOpen(FLOATING_WINDOW_ID.AI_CHAT)).toBe(true)

    fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)

    // undock 不关窗
    expect(fw.isOpen(FLOATING_WINDOW_ID.AI_CHAT)).toBe(true)
  })

  it('对未 docked 的窗口调用 undockWindow 不会报错（幂等）', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()
    expect(fw.getMode(FLOATING_WINDOW_ID.AI_CHAT)).toBe('floating')

    expect(() => fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)).not.toThrow()
    expect(fw.getMode(FLOATING_WINDOW_ID.AI_CHAT)).toBe('floating')
  })

  it('isDocked / getMode 对未知 id 安全降级', async () => {
    const { useFloatingWindows, resetFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    resetFloatingWindows()
    const fw = useFloatingWindows()

    expect(fw.isDocked('non-existent')).toBe(false)
    expect(fw.getMode('non-existent')).toBe('floating')
  })

  it('useFloatingWindowState 暴露 isDocked / mode computed', async () => {
    const { useFloatingWindows, useFloatingWindowState, FLOATING_WINDOW_ID, resetFloatingWindows } =
      await import('@/composables/useFloatingWindows')
    resetFloatingWindows()
    const fw = useFloatingWindows()
    const state = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)

    expect(state.isDocked.value).toBe(false)
    expect(state.mode.value).toBe('floating')
    expect(typeof state.dock).toBe('function')
    expect(typeof state.undock).toBe('function')

    fw.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
    await nextTick()
    expect(state.isDocked.value).toBe(true)
    expect(state.mode.value).toBe('docked')

    // 通过 state.dock / state.undock 也能切换
    state.undock()
    await nextTick()
    expect(state.isDocked.value).toBe(false)
    expect(state.mode.value).toBe('floating')
  })
})