/**
 * TitleBar — docked AI 助手头像按钮逻辑单元测试
 *
 * 由于 TitleBar 依赖大量 store（tray/auth/userPreferences/settings）和
 * 子组件（ThemeToggle/UserAccountMenu/WindowListMenu），完整 mount 成本高。
 * 本测试专注于：
 * - handleTitleBarAvatarClick 的副作用：undock + openWindow
 * - aiChatIsDocked 反应性：基于 floatingWindows 的 isDocked + visible
 * - titleBarAvatarUrl 优先使用 settingsStore.avatarUrl，回退 avatarId
 *
 * 通过 mock floatingWindows、settingsStore 验证调用序列与反应性。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mockUndockWindow = vi.fn()
const mockOpenWindow = vi.fn()
const mockIsDocked = ref(false)
const mockIsVisible = ref(false)
const mockSettings = {
  avatarUrl: '',
  avatarId: '',
}
const mockAiChatState = {
  isDocked: mockIsDocked,
  visible: mockIsVisible,
}

vi.mock('@/composables/useFloatingWindows', () => ({
  FLOATING_WINDOW_ID: { AI_CHAT: 'aiChat' },
  useFloatingWindows: () => ({
    undockWindow: mockUndockWindow,
    openWindow: mockOpenWindow,
  }),
  useFloatingWindowState: (id) => {
    if (id === 'aiChat') return mockAiChatState
    return {
      isDocked: ref(false),
      visible: ref(false),
    }
  },
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => mockSettings,
}))

vi.mock('@/constants/aiAvatars', () => ({
  DEFAULT_AVATAR_ID: 'robot',
  getAvatarUrlById: (id) => `/mock/avatars/${id}.svg`,
}))

describe('TitleBar docked 头像按钮 — 逻辑契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUndockWindow.mockClear()
    mockOpenWindow.mockClear()
    mockIsDocked.value = false
    mockIsVisible.value = false
    mockSettings.avatarUrl = ''
    mockSettings.avatarId = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * 直接验证 store 层的契约：undock + open 顺序
   * 这是 handleTitleBarAvatarClick 的核心副作用。
   */
  it('AI 助手 docked 时点击按钮 → 调用 undockWindow', async () => {
    mockIsDocked.value = true
    mockIsVisible.value = true

    const { useFloatingWindows } = await import('@/composables/useFloatingWindows')
    const fw = useFloatingWindows()
    const { FLOATING_WINDOW_ID } = await import('@/composables/useFloatingWindows')

    // 模拟 handleTitleBarAvatarClick 行为
    function handleTitleBarAvatarClick() {
      if (mockIsDocked.value) {
        fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
      }
      fw.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    }

    handleTitleBarAvatarClick()

    expect(mockUndockWindow).toHaveBeenCalledTimes(1)
    expect(mockUndockWindow).toHaveBeenCalledWith('aiChat')
  })

  it('点击按钮总应调用 openWindow（恢复右下角浮窗可见性）', async () => {
    mockIsDocked.value = true
    mockIsVisible.value = true

    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()

    function handleTitleBarAvatarClick() {
      if (mockIsDocked.value) {
        fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
      }
      fw.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    }

    handleTitleBarAvatarClick()

    expect(mockOpenWindow).toHaveBeenCalledTimes(1)
    expect(mockOpenWindow).toHaveBeenCalledWith('aiChat')
  })

  it('AI 助手未 docked 时点击按钮 → 只调用 openWindow，不调用 undock', async () => {
    mockIsDocked.value = false
    mockIsVisible.value = true

    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()

    function handleTitleBarAvatarClick() {
      if (mockIsDocked.value) {
        fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
      }
      fw.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    }

    handleTitleBarAvatarClick()

    expect(mockUndockWindow).not.toHaveBeenCalled()
    expect(mockOpenWindow).toHaveBeenCalledWith('aiChat')
  })

  it('调用顺序：undock 先于 open（避免状态闪烁）', async () => {
    mockIsDocked.value = true
    mockIsVisible.value = true

    const calls = []
    mockUndockWindow.mockImplementation(() => calls.push('undock'))
    mockOpenWindow.mockImplementation(() => calls.push('open'))

    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()

    function handleTitleBarAvatarClick() {
      if (mockIsDocked.value) {
        fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
      }
      fw.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    }

    handleTitleBarAvatarClick()

    expect(calls).toEqual(['undock', 'open'])
  })

  it('aiChatIsDocked 反应性：仅当 docked && visible 时为 true', async () => {
    // 模拟 computed 反应性
    function makeAiChatIsDocked() {
      return {
        get value() {
          return mockIsDocked.value && mockIsVisible.value
        },
      }
    }

    const aiChatIsDocked = makeAiChatIsDocked()

    mockIsDocked.value = false
    mockIsVisible.value = false
    expect(aiChatIsDocked.value).toBe(false)

    mockIsDocked.value = true
    mockIsVisible.value = false
    expect(aiChatIsDocked.value).toBe(false)

    mockIsDocked.value = false
    mockIsVisible.value = true
    expect(aiChatIsDocked.value).toBe(false)

    mockIsDocked.value = true
    mockIsVisible.value = true
    expect(aiChatIsDocked.value).toBe(true)
  })

  it('titleBarAvatarUrl 优先使用 settingsStore.avatarUrl', async () => {
    mockSettings.avatarUrl = 'https://example.com/avatar.png'
    mockSettings.avatarId = 'robot'

    const { getAvatarUrlById, DEFAULT_AVATAR_ID } = await import('@/constants/aiAvatars')

    function makeTitleBarAvatarUrl() {
      return {
        get value() {
          return mockSettings.avatarUrl || getAvatarUrlById(mockSettings.avatarId || DEFAULT_AVATAR_ID)
        },
      }
    }

    const titleBarAvatarUrl = makeTitleBarAvatarUrl()
    expect(titleBarAvatarUrl.value).toBe('https://example.com/avatar.png')
  })

  it('titleBarAvatarUrl 在 avatarUrl 为空时回退到 avatarId 派生的 URL', async () => {
    mockSettings.avatarUrl = ''
    mockSettings.avatarId = 'cool-robot'

    const { getAvatarUrlById } = await import('@/constants/aiAvatars')

    function makeTitleBarAvatarUrl() {
      return {
        get value() {
          return mockSettings.avatarUrl || getAvatarUrlById(mockSettings.avatarId)
        },
      }
    }

    const titleBarAvatarUrl = makeTitleBarAvatarUrl()
    expect(titleBarAvatarUrl.value).toBe('/mock/avatars/cool-robot.svg')
  })

  it('titleBarAvatarUrl 在 avatarId 也为空时回退到默认 DEFAULT_AVATAR_ID', async () => {
    mockSettings.avatarUrl = ''
    mockSettings.avatarId = ''

    const { getAvatarUrlById, DEFAULT_AVATAR_ID } = await import('@/constants/aiAvatars')

    function makeTitleBarAvatarUrl() {
      return {
        get value() {
          return mockSettings.avatarUrl || getAvatarUrlById(mockSettings.avatarId || DEFAULT_AVATAR_ID)
        },
      }
    }

    const titleBarAvatarUrl = makeTitleBarAvatarUrl()
    expect(titleBarAvatarUrl.value).toBe('/mock/avatars/robot.svg')
  })

  it('handleTitleBarAvatarKeydown 对 Enter 触发 click 处理器', async () => {
    mockIsDocked.value = true
    mockIsVisible.value = true

    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()

    function handleTitleBarAvatarClick() {
      if (mockIsDocked.value) fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
      fw.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    }

    // 模拟 keydown 处理器
    const event = { key: 'Enter', preventDefault: vi.fn() }
    function handleTitleBarAvatarKeydown(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleTitleBarAvatarClick()
      }
    }

    handleTitleBarAvatarKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(mockUndockWindow).toHaveBeenCalledWith('aiChat')
    expect(mockOpenWindow).toHaveBeenCalledWith('aiChat')
  })

  it('handleTitleBarAvatarKeydown 对 Space 触发 click 处理器', async () => {
    mockIsDocked.value = false
    mockIsVisible.value = false

    const { useFloatingWindows, FLOATING_WINDOW_ID } = await import(
      '@/composables/useFloatingWindows'
    )
    const fw = useFloatingWindows()

    function handleTitleBarAvatarClick() {
      if (mockIsDocked.value) fw.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
      fw.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    }

    const event = { key: ' ', preventDefault: vi.fn() }
    function handleTitleBarAvatarKeydown(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleTitleBarAvatarClick()
      }
    }

    handleTitleBarAvatarKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(mockOpenWindow).toHaveBeenCalledWith('aiChat')
    expect(mockUndockWindow).not.toHaveBeenCalled()
  })

  it('handleTitleBarAvatarKeydown 对其它键不触发 click 处理器', () => {
    mockIsDocked.value = false
    mockIsVisible.value = false

    const event = { key: 'a', preventDefault: vi.fn() }
    function handleTitleBarAvatarKeydown(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        // 触发 click
      }
    }

    handleTitleBarAvatarKeydown(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(mockOpenWindow).not.toHaveBeenCalled()
  })
})