import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mockSendMessage = vi.fn()
const mockChatInstance = {
  messages: [],
  status: 'ready',
  sendMessage: mockSendMessage,
}

vi.mock('@ai-sdk/vue', () => ({
  Chat: vi.fn(function Chat() {
    return mockChatInstance
  }),
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => (model) => model),
}))

vi.mock('ai', () => ({
  DirectChatTransport: vi.fn(function DirectChatTransport() {}),
  ToolLoopAgent: vi.fn(function ToolLoopAgent(config) {
    return { config }
  }),
}))

const mockToast = {
  warning: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast,
}))

const mockCheckFreeQuota = vi.fn()
const mockConsumeFreeQuotaTokens = vi.fn()

vi.mock('@/utils/freeQuota', () => ({
  checkFreeQuota: (...args) => mockCheckFreeQuota(...args),
  consumeFreeQuotaTokens: (...args) => mockConsumeFreeQuotaTokens(...args),
  resolveUsageTokens: (usage) => Number(usage?.totalTokens) || 1,
  FREE_QUOTA_EXHAUSTED: 'FREE_QUOTA_EXHAUSTED',
  FreeQuotaExhaustedError: class FreeQuotaExhaustedError extends Error {
    constructor(details = {}) {
      super('免费 Token 额度已用完')
      this.name = 'FreeQuotaExhaustedError'
      this.code = 'FREE_QUOTA_EXHAUSTED'
      this.details = details
    }
  },
}))

describe('useAiChat — 自定义模型回退', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    mockCheckFreeQuota.mockResolvedValue({ ok: true, remaining: 99_999_980, unit: 'token' })
    mockConsumeFreeQuotaTokens.mockResolvedValue({ ok: true, consumed: 20 })

    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const store = useModelSettingsStore()
    store.data.text.source = 'custom'
    store.data.text.custom.endpoint = 'https://api.deepseek.com/v1'
    store.data.text.custom.modelName = 'deepseek-chat'
  })

  it('自定义模型配置变更后 effectiveTextConfig 可回退到平台', async () => {
    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const store = useModelSettingsStore()

    expect(store.effectiveTextConfig.source).toBe('custom')

    store.activateTextPlatformFallback()

    expect(store.effectiveTextConfig.source).toBe('platform')
  })

  it('自定义模型缺少 API Key 时 sendMessage 被拦截', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const { MISSING_CUSTOM_API } = await import('@/constants/aiModelMessages')

    const { sendMessage } = useAiChat(ref('system prompt'))

    const result = await sendMessage({ text: '你好' })

    expect(result).toMatchObject({
      ok: false,
      code: MISSING_CUSTOM_API,
      suggestConfigure: true,
    })
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockCheckFreeQuota).not.toHaveBeenCalled()
  })

  it('平台模型 Token 额度用尽时 sendMessage 被拦截', async () => {
    const { FreeQuotaExhaustedError } = await import('@/utils/freeQuota')
    const { LOGGED_IN_QUOTA_EXHAUSTED_CONFIGURE_MESSAGE } = await import('@/constants/aiModelMessages')
    mockCheckFreeQuota.mockRejectedValue(
      new FreeQuotaExhaustedError({ remaining: 0, used: 100_000_000, limit: 100_000_000 }),
    )

    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.isGuest = false
    authStore.currentUser = { id: 'user-1' }

    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const store = useModelSettingsStore()
    store.data.text.source = 'platform'

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    const result = await sendMessage({ text: '你好' })

    expect(result).toMatchObject({
      ok: false,
      code: 'FREE_QUOTA_EXHAUSTED',
      message: LOGGED_IN_QUOTA_EXHAUSTED_CONFIGURE_MESSAGE,
      suggestConfigure: true,
    })
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockConsumeFreeQuotaTokens).not.toHaveBeenCalled()
  })
})
