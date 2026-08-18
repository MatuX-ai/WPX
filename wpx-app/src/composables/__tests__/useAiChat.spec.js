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

// ── jcode 路由检查相关 mock（默认桌面端 + 复杂任务） ──
const mockRouteTask = vi.fn()
const mockShouldUseJcode = vi.fn()
const mockShouldUseHermes = vi.fn(() => false)

vi.mock('@/server/ai-router', () => ({
  routeTask: (...args) => mockRouteTask(...args),
  shouldUseJcode: (...args) => mockShouldUseJcode(...args),
  shouldUseHermes: (...args) => mockShouldUseHermes(...args),
}))

const mockIsElectron = vi.fn(() => true)
const mockGetElectronAPI = vi.fn(() => null)

vi.mock('@/utils/electron', () => ({
  isElectron: () => mockIsElectron(),
  getElectronAPI: () => mockGetElectronAPI(),
  hasTraySupport: () => false,
}))

/**
 * Wait for the fire-and-forget tryJcodeRoute microtask to settle.
 * tryJcodeRoute 内部使用 `void (async () => { ... })()` 触发,没有返回 Promise,
 * 需要 flush 微任务队列才能等到内部 routeTask 调用与 toast 写入。
 */
async function flushJcodeRoute() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

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

// ═══════════════════════════════════════════════════════════════════════
// useAiChat — jcode 路由检查（需求文档验收点 #7）
// 调用 routeTask 后,若返回 ok:false 且 fallbackReason 存在,
// 需以 toast.warning 透传后端 message 给用户。
// ═══════════════════════════════════════════════════════════════════════
describe('useAiChat — jcode 路由降级提示（验收 #7）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    mockCheckFreeQuota.mockResolvedValue({ ok: true, remaining: 99_999_980, unit: 'token' })
    mockConsumeFreeQuotaTokens.mockResolvedValue({ ok: true, consumed: 20 })

    // 默认 mock：桌面端 + 复杂任务（确保路由检查会进入 tryJcodeRoute 主体）
    mockIsElectron.mockReturnValue(true)
    mockShouldUseJcode.mockReturnValue(true)
    mockRouteTask.mockResolvedValue({
      ok: true,
      engine: 'jcode',
      data: { result: 'swarm-success' },
    })

    // 配置平台模式（已登录、有额度）→ 走到 tryJcodeRoute 这一步
    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const ms = useModelSettingsStore()
    ms.data.text.source = 'platform'

    const { useAuthStore } = await import('@/stores/auth')
    const auth = useAuthStore()
    auth.isGuest = false
    auth.currentUser = { id: 'user-1' }
  })

  // ── #1 核心场景：routeTask 降级 → toast.warning(message) ──
  it('routeTask 返回 ok:false + fallbackReason 时弹 warning,message 透传', async () => {
    mockRouteTask.mockResolvedValue({
      ok: false,
      fallbackReason: 'jcode_unavailable',
      message: 'jcode 暂不可用,已切换至云端 AI',
    })

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    // 主聊天不依赖路由检查 → 正常返回 ok
    const result = await sendMessage({ text: '生成一份 PPT 大纲' })
    expect(result).toEqual({ ok: true })
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    // 等待 fire-and-forget 的 tryJcodeRoute 落幕
    await flushJcodeRoute()

    // 透传后端 message
    expect(mockRouteTask).toHaveBeenCalledTimes(1)
    expect(mockRouteTask.mock.calls[0][0]).toMatchObject({
      task: 'ai_chat',
      params: { userMessage: '生成一份 PPT 大纲' },
    })
    expect(mockRouteTask.mock.calls[0][1]).toMatchObject({
      timeoutMs: 3_000,
    })
    expect(mockToast.warning).toHaveBeenCalledTimes(1)
    expect(mockToast.warning).toHaveBeenCalledWith('jcode 暂不可用,已切换至云端 AI')
  })

  // ── #2:另一种 fallbackReason(local_server_unavailable) 也命中 toast ──
  it('local_server_unavailable 降级原因同样会弹 warning', async () => {
    mockRouteTask.mockResolvedValue({
      ok: false,
      fallbackReason: 'local_server_unavailable',
      message: 'jcode 适配层未启动(local-server 不可用),已切换至云端 AI',
    })

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '帮我写一份论文' })
    await flushJcodeRoute()

    expect(mockToast.warning).toHaveBeenCalledWith(
      'jcode 适配层未启动(local-server 不可用),已切换至云端 AI',
    )
  })

  // ── #3:ok:true（命中 jcode 或 skippedJcode）不弹 toast ──
  it('routeTask 返回 ok:true 时不弹 warning（不打扰用户）', async () => {
    mockRouteTask.mockResolvedValue({
      ok: true,
      engine: 'jcode',
      data: { result: 'ok' },
    })

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '生成一份教案' })
    await flushJcodeRoute()

    expect(mockRouteTask).toHaveBeenCalledTimes(1)
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  it('routeTask 返回 ok:true + skippedJcode 时不弹 warning', async () => {
    mockRouteTask.mockResolvedValue({
      ok: true,
      engine: 'cloud',
      skippedJcode: true,
    })

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '给我一份开题报告' })
    await flushJcodeRoute()

    expect(mockRouteTask).toHaveBeenCalledTimes(1)
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  // ── #4:简单任务不调 routeTask（不唤醒 jcode） ──
  it('简单任务（shouldUseJcode=false）不调 routeTask', async () => {
    mockShouldUseJcode.mockReturnValue(false)
    mockRouteTask.mockResolvedValue({
      ok: false,
      fallbackReason: 'jcode_unavailable',
      message: '不应该被透传',
    })

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '你今天怎么样' })
    await flushJcodeRoute()

    expect(mockShouldUseJcode).toHaveBeenCalledWith('你今天怎么样')
    expect(mockRouteTask).not.toHaveBeenCalled()
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  // ── #5:非桌面端（Web 浏览器）不调 routeTask ──
  it('非桌面端（isElectron=false）静默走云端,不调 routeTask', async () => {
    mockIsElectron.mockReturnValue(false)

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '生成一份 PPT' })
    await flushJcodeRoute()

    expect(mockRouteTask).not.toHaveBeenCalled()
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  // ── #6:routeTask 抛异常时主聊天不阻塞 ──
  it('routeTask 抛异常时 sendMessage 仍正常完成,不弹 toast', async () => {
    mockRouteTask.mockRejectedValue(new Error('routeTask 内部炸了'))

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    // 主聊天不应被路由检查异常阻断
    const result = await sendMessage({ text: '生成一份论文' })
    expect(result).toEqual({ ok: true })
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    await flushJcodeRoute()

    // 异常被吞掉,不弹 toast
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  // ── #7:fallbackReason 缺失时不弹 toast(防止空消息) ──
  it('ok:false 但 fallbackReason 缺失时不弹 toast', async () => {
    mockRouteTask.mockResolvedValue({
      ok: false,
      // 故意不给 fallbackReason
      message: '不完整的降级响应',
    })

    const { useAiChat } = await import('@/composables/useAiChat')
    const { sendMessage } = useAiChat(ref('system prompt'))

    await sendMessage({ text: '帮我写一份开题报告' })
    await flushJcodeRoute()

    expect(mockRouteTask).toHaveBeenCalledTimes(1)
    expect(mockToast.warning).not.toHaveBeenCalled()
  })
})

// ── reasoning（思考过程）提取与识别函数 ──
describe('useAiChat — reasoning 提取', () => {
  it('getMessageText 只返回 type=text 的 part，不包含 reasoning', async () => {
    const { getMessageText } = await import('@/composables/useAiChat')
    const message = {
      parts: [
        { type: 'reasoning', text: '我需要先思考...' },
        { type: 'text', text: '这是最终答案' },
        { type: 'reasoning', text: '继续思考' },
      ],
    }
    expect(getMessageText(message)).toBe('这是最终答案')
  })

  it('getMessageText 对空 message 返回空字符串', async () => {
    const { getMessageText } = await import('@/composables/useAiChat')
    expect(getMessageText(null)).toBe('')
    expect(getMessageText({})).toBe('')
    expect(getMessageText({ parts: [] })).toBe('')
  })

  it('getMessageReasoning 拼接所有 type=reasoning 的 part', async () => {
    const { getMessageReasoning } = await import('@/composables/useAiChat')
    const message = {
      parts: [
        { type: 'reasoning', text: '第一步思考\n' },
        { type: 'text', text: '答案' },
        { type: 'reasoning', text: '第二步思考' },
      ],
    }
    expect(getMessageReasoning(message)).toBe('第一步思考\n第二步思考')
  })

  it('getMessageReasoning 在没有 reasoning 时返回空字符串', async () => {
    const { getMessageReasoning } = await import('@/composables/useAiChat')
    expect(getMessageReasoning(null)).toBe('')
    expect(getMessageReasoning({ parts: [{ type: 'text', text: 'hi' }] })).toBe('')
  })

  it('hasMessageReasoning 仅在有非空 reasoning 时为 true', async () => {
    const { hasMessageReasoning } = await import('@/composables/useAiChat')
    expect(hasMessageReasoning({ parts: [{ type: 'text', text: 'hi' }] })).toBe(false)
    expect(hasMessageReasoning({ parts: [{ type: 'reasoning', text: '' }] })).toBe(false)
    expect(hasMessageReasoning({ parts: [{ type: 'reasoning', text: '我先想' }] })).toBe(true)
  })
})

// ═════════════════════════════════════════════════
// Hermes 自动路由（M3-C+）
// ═════════════════════════════════════════════════
describe('useAiChat — Hermes 自动路由', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    mockCheckFreeQuota.mockResolvedValue({ ok: true, remaining: 99_999_980, unit: 'token' })
    mockConsumeFreeQuotaTokens.mockResolvedValue({ ok: true, consumed: 20 })
    mockShouldUseHermes.mockReturnValue(false)
    // mockChatInstance 是模块级共享实例 → 每测重置消息数组，避免跨测泄漏
    mockChatInstance.messages = []

    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const store = useModelSettingsStore()
    // 用 custom + 显式 apiKey，避开 fresh pinia 下 isGuest=true 的 guest 分支
    store.data.text.source = 'custom'
    store.data.text.custom.endpoint = 'http://127.0.0.1:3000/v1'
    store.data.text.custom.modelName = 'hermes-agent'
    store.data.text.custom.apiKey = 'sk-test-123'
    // resolveTextApiKey 在 Web 测试环境走 IPC 会返回空 → 覆写为返回明文 Key
    store.resolveTextApiKey = vi.fn(async () => 'sk-test-123')

    mockGetElectronAPI.mockReturnValue({
      hermes: {
        getSettings: async () => ({ settings: { enabled: true, autoRoute: true } }),
        getStatus: async () => ({ state: 'RUNNING' }),
      },
      localServer: { getBaseUrl: async () => 'http://127.0.0.1:3000' },
    })
  })

  it('命中自动路由：执行 Hermes 并把结果追加为助手消息，不走云端', async () => {
    mockShouldUseHermes.mockReturnValue(true)
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url) => {
      expect(url).toBe('http://127.0.0.1:3000/api/hermes/run')
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { choices: [{ message: { content: '调研结论文本' } }] } }),
      }
    })
    try {
      const { useAiChat } = await import('@/composables/useAiChat')
      const chat = useAiChat('系统提示')
      const result = await chat.sendMessage({ text: '用 Hermes 调研三款产品' })

      expect(result.ok).toBe(true)
      expect(result.engine).toBe('hermes')
      expect(mockSendMessage).not.toHaveBeenCalled()
      const appended = chat.messages.value.find((m) => m.hermesTask)
      expect(appended).toBeTruthy()
      expect(appended.task).toBe('用 Hermes 调研三款产品')
      expect(appended.parts[0].text).toBe('调研结论文本')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('Hermes 执行失败时透明回退云端', async () => {
    mockShouldUseHermes.mockReturnValue(true)
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, message: 'Hermes 网关暂不可用' }),
    }))
    try {
      const { useAiChat } = await import('@/composables/useAiChat')
      const chat = useAiChat('系统提示')
      const result = await chat.sendMessage({ text: '用 Hermes 调研三款产品' })

      expect(result.ok).toBe(true)
      expect(result.engine).not.toBe('hermes')
      expect(mockSendMessage).toHaveBeenCalledTimes(1)
      expect(chat.messages.value.some((m) => m.hermesTask)).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('Hermes 未启用时不路由（走云端）', async () => {
    mockGetElectronAPI.mockReturnValue({
      hermes: {
        getSettings: async () => ({ settings: { enabled: false, autoRoute: true } }),
        getStatus: async () => ({ state: 'STOPPED' }),
      },
      localServer: { getBaseUrl: async () => 'http://127.0.0.1:3000' },
    })
    mockShouldUseHermes.mockReturnValue(true)
    const { useAiChat } = await import('@/composables/useAiChat')
    const chat = useAiChat('系统提示')
    const result = await chat.sendMessage({ text: '用 Hermes 调研三款产品' })
    expect(result.engine).not.toBe('hermes')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('非 Hermes 任务（shouldUseHermes=false）不路由', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const chat = useAiChat('系统提示')
    const result = await chat.sendMessage({ text: '帮我翻译这段话' })
    expect(result.engine).not.toBe('hermes')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })
})
