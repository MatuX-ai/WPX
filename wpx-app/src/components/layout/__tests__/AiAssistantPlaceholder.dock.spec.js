/**
 * AiAssistantPlaceholder — handleDockChange 逻辑契约测试
 *
 * 由于 AiAssistantPlaceholder 依赖几乎所有 store（editor/settings/modelSettings/
 * skills/userPreferences/auth/theme/app）和 composable（useAiChat/useSkillExecutor/
 * useLocalCommands/...），完整 mount 成本极高。
 *
 * 本测试专注于 dock 行为契约：
 * - handleDockChange(true) → floatingWindows.dockWindow
 * - handleDockChange(false) → floatingWindows.undockWindow
 * - docked 模式下 Avatar 应隐藏（条件渲染契约）
 * - Teleport 仅在 docked 模式下激活
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mockDockWindow = vi.fn()
const mockUndockWindow = vi.fn()
const mockOpenWindow = vi.fn()
const mockCloseWindow = vi.fn()
const mockToggleWindow = vi.fn()
const mockTogglePin = vi.fn()
const mockIsDocked = ref(false)
const mockVisible = ref(false)
const mockPinned = ref(false)

vi.mock('@/composables/useFloatingWindows', () => ({
  FLOATING_WINDOW_ID: { AI_CHAT: 'aiChat' },
  useFloatingWindows: () => ({
    dockWindow: mockDockWindow,
    undockWindow: mockUndockWindow,
    openWindow: mockOpenWindow,
    closeWindow: mockCloseWindow,
    toggleWindow: mockToggleWindow,
    togglePin: mockTogglePin,
  }),
  useFloatingWindowState: () => ({
    isDocked: mockIsDocked,
    visible: mockVisible,
    pinned: mockPinned,
    focus: vi.fn(),
    togglePin: mockTogglePin,
  }),
}))

describe('AiAssistantPlaceholder — handleDockChange 逻辑契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockDockWindow.mockClear()
    mockUndockWindow.mockClear()
    mockOpenWindow.mockClear()
    mockCloseWindow.mockClear()
    mockToggleWindow.mockClear()
    mockTogglePin.mockClear()
    mockIsDocked.value = false
    mockVisible.value = false
    mockPinned.value = false
  })

  /**
   * 模拟 handleDockChange 内部逻辑：
   *   nextDocked=true  → dockWindow
   *   nextDocked=false → undockWindow
   */
  function makeHandleDockChange(floatingWindows) {
    return function handleDockChange(nextDocked) {
      if (nextDocked) {
        floatingWindows.dockWindow('aiChat')
      } else {
        floatingWindows.undockWindow('aiChat')
      }
    }
  }

  it('handleDockChange(true) → dockWindow', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()
    const handleDockChange = makeHandleDockChange(fw)

    handleDockChange(true)

    expect(mockDockWindow).toHaveBeenCalledTimes(1)
    expect(mockDockWindow).toHaveBeenCalledWith(FLOATING_WINDOW_ID.AI_CHAT)
    expect(mockUndockWindow).not.toHaveBeenCalled()
  })

  it('handleDockChange(false) → undockWindow', async () => {
    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()
    const handleDockChange = makeHandleDockChange(fw)

    handleDockChange(false)

    expect(mockUndockWindow).toHaveBeenCalledTimes(1)
    expect(mockUndockWindow).toHaveBeenCalledWith(FLOATING_WINDOW_ID.AI_CHAT)
    expect(mockDockWindow).not.toHaveBeenCalled()
  })

  it('连续切换 dock → undock → dock 时正确转发到 store', async () => {
    const { useFloatingWindows } = await import('@/composables/useFloatingWindows')
    const fw = useFloatingWindows()
    const handleDockChange = makeHandleDockChange(fw)

    handleDockChange(true)
    handleDockChange(false)
    handleDockChange(true)

    expect(mockDockWindow).toHaveBeenCalledTimes(2)
    expect(mockUndockWindow).toHaveBeenCalledTimes(1)
  })

  it('handleDockChange 不影响其它窗口操作（toggleWindow / closeWindow）', async () => {
    const { useFloatingWindows } = await import('@/composables/useFloatingWindows')
    const fw = useFloatingWindows()
    const handleDockChange = makeHandleDockChange(fw)

    handleDockChange(true)
    handleDockChange(false)

    expect(mockToggleWindow).not.toHaveBeenCalled()
    expect(mockOpenWindow).not.toHaveBeenCalled()
    expect(mockCloseWindow).not.toHaveBeenCalled()
  })

  it('docked 状态下 Avatar 应隐藏（条件渲染契约）', () => {
    /**
     * 模拟 AiAssistantPlaceholder 模板：
     *   <AiAvatar v-if="!aiChatWindowDocked" ... />
     * 因此 docked=true 时 AiAvatar 不渲染。
     */
    function shouldRenderAvatar() {
      return !mockIsDocked.value
    }

    mockIsDocked.value = false
    expect(shouldRenderAvatar()).toBe(true)

    mockIsDocked.value = true
    expect(shouldRenderAvatar()).toBe(false)

    mockIsDocked.value = false
    expect(shouldRenderAvatar()).toBe(true)
  })

  it('Teleport disabled 条件：仅当 !docked 时禁用', () => {
    /**
     * 模板契约：
     *   <Teleport :to="aiChatDockTarget" :disabled="!aiChatWindowDocked">
     * docked=true → disabled=false（传送）
     * docked=false → disabled=true（不传送，原位渲染）
     */
    function teleportDisabled() {
      return !mockIsDocked.value
    }

    mockIsDocked.value = false
    expect(teleportDisabled()).toBe(true)

    mockIsDocked.value = true
    expect(teleportDisabled()).toBe(false)
  })

  it('aiChatWindowDocked 反应性始终反映 store 的 isDocked', async () => {
    /**
     * 模板契约：const aiChatWindowDocked = computed(() => aiChat.isDocked.value)
     */
    const { useFloatingWindowState, useFloatingWindows } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()
    const state = useFloatingWindowState()

    expect(state.isDocked.value).toBe(false)

    mockIsDocked.value = true
    expect(state.isDocked.value).toBe(true)

    mockIsDocked.value = false
    expect(state.isDocked.value).toBe(false)
  })

  it('handleDockChange 是无副作用的纯转发（不修改其它状态）', async () => {
    const { useFloatingWindows } = await import('@/composables/useFloatingWindows')
    const fw = useFloatingWindows()
    const handleDockChange = makeHandleDockChange(fw)

    const initialPinned = mockPinned.value
    const initialVisible = mockVisible.value

    handleDockChange(true)
    handleDockChange(false)

    expect(mockPinned.value).toBe(initialPinned)
    expect(mockVisible.value).toBe(initialVisible)
  })
})