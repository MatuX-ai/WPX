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

const mockConsumeFreeQuota = vi.fn()

vi.mock('@/utils/freeQuota', () => ({
  consumeFreeQuota: (...args) => mockConsumeFreeQuota(...args),
  FREE_QUOTA_EXHAUSTED: 'FREE_QUOTA_EXHAUSTED',
  FREE_QUOTA_MESSAGE: '今日免费次数已用完，请明天再试或登录获取更多次数',
  FreeQuotaExhaustedError: class FreeQuotaExhaustedError extends Error {
    constructor(details = {}) {
      super('今日免费次数已用完，请明天再试或登录获取更多次数')
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
    mockConsumeFreeQuota.mockResolvedValue({ ok: true, remaining: 49 })

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

    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '你好' })

    expect(mockToast.error).toHaveBeenCalledWith('自定义模型未配置 API Key，请在模型设置中保存')
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockConsumeFreeQuota).not.toHaveBeenCalled()
  })

  it('平台模型免费次数用尽时 sendMessage 被拦截', async () => {
    const { FreeQuotaExhaustedError } = await import('@/utils/freeQuota')
    mockConsumeFreeQuota.mockRejectedValue(
      new FreeQuotaExhaustedError({ remaining: 0, used: 50, limit: 50 }),
    )

    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const store = useModelSettingsStore()
    store.data.text.source = 'platform'

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    const result = await sendMessage({ text: '你好' })

    expect(result).toMatchObject({
      ok: false,
      code: 'FREE_QUOTA_EXHAUSTED',
    })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})
