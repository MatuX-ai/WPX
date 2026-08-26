import { Chat } from '@ai-sdk/vue'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import { computed, ref, shallowRef, toValue, watch } from 'vue'
import {
  MISSING_CUSTOM_API,
  MISSING_CUSTOM_API_MESSAGE,
} from '@/constants/aiModelMessages'
import { ensureOpenAICompatibleBase } from '@/constants/modelPreferences'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { isElectron, getElectronAPI } from '@/utils/electron'
import {
  canUseElectronModelFetch,
  createElectronModelFetch,
} from '@/utils/electronModelFetch'
import { getLocalApiBase } from '@/utils/localApi'
import { buildChatEpisode, isEpisodeRecordingEnabled } from '@/utils/memoryEpisode'
import { shouldAutoRouteHermes, buildHermesAssistantMessage } from '@/utils/hermesRouter'
import { runHermesTask } from '@/composables/useHermesTask'
import { routeTask, shouldUseJcode } from '@/server/ai-router'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-chat'

/**
 * Build user message with attached reference material context.
 * @param {string} text
 * @param {Array<{ filename: string, content: string }>} context
 */
export function buildContextPrompt(text, context = []) {
  if (!context?.length) return text

  const blocks = context
    .map((item, index) => {
      const title = item.filename || `资料${index + 1}`
      return `【参考资料 ${index + 1}：${title}】\n${item.content}`
    })
    .join('\n\n')

  return `${blocks}\n\n【用户问题】\n${text}`
}

/**
 * 从 SDK / 代理层层包装的错误对象中尽量还原真实报错文案。
 * AI SDK 的 UI 流默认会把细节压成 "An error occurred."，需从 cause / data / body 回捞。
 *
 * @param {unknown} error
 * @returns {string}
 */
export function extractModelErrorText(error) {
  if (error == null) return '未知错误'

  /** @type {string[]} */
  const parts = []
  const seen = new Set()

  const push = (value) => {
    if (value == null) return
    const text = typeof value === 'string' ? value : String(value)
    const trimmed = text.trim()
    if (!trimmed || seen.has(trimmed)) return
    // 跳过 SDK 默认脱敏文案，优先保留更有信息量的片段
    if (/^an error occurred\.?$/i.test(trimmed)) return
    seen.add(trimmed)
    parts.push(trimmed)
  }

  const visit = (value, depth = 0) => {
    if (value == null || depth > 4) return
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      push(value)
      return
    }
    if (typeof value !== 'object') return

    push(value.message)
    push(value.error?.message)
    push(value.error)
    push(value.statusText)
    push(value.responseBody)
    push(value.body)
    push(value.data?.error?.message)
    push(value.data?.message)
    push(typeof value.data === 'string' ? value.data : null)
    push(value.cause?.message)
    if (value.cause) visit(value.cause, depth + 1)
  }

  visit(error)
  if (parts.length === 0) {
    const fallback = String(error?.message || error || '未知错误').trim()
    return fallback || '未知错误'
  }
  return parts.join(' | ')
}

/**
 * 把底层模型错误映射为面向用户的友好提示。
 *
 * 命中「未配置 / 配置错误」类错误（API Key 无效、模型名错误、接口地址不通）时，
 * 返回带 needsModelConfig 标记的文案，面板会渲染「设置 / 自己写」按钮引导用户。
 * 其余错误保留原始信息，避免误导用户。
 *
 * @param {unknown} error
 * @param {{ apiKey?: string }} [options]
 * @returns {{ content: string, needsModelConfig?: boolean, suggestConfigure?: boolean, suggestWriteSelf?: boolean }}
 */
export function normalizeModelErrorForDisplay(error, options = {}) {
  const raw = extractModelErrorText(error)
  const lower = raw.toLowerCase()

  // 开发环境提醒：调用方未传 apiKey 时给出警告，
  // 避免新增调用点忘记传参导致兜底逻辑失效。
  // 仅在真实浏览器开发环境输出，避免污染单元测试输出。
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !import.meta.env.VITEST &&
    !Object.prototype.hasOwnProperty.call(options, 'apiKey')
  ) {
    console.warn(
      '[normalizeModelErrorForDisplay] 调用方未传入 apiKey，' +
        '兜底分类可能不准确。请传入 { apiKey: resolvedApiKey.value } 以启用完整错误分类。',
    )
  }

  // 兜底：若调用方已知 apiKey 为空，直接返回未配置大模型的友好引导，
  // 避免底层 SDK 抛出 "An error occurred" 这类无意义错误被原样展示。
  // 注意：只有 options.apiKey 被显式传入（包括空字符串）时才启用此兜底，
  // 不传 options 或不传 apiKey 时保持原有错误匹配逻辑，避免影响单元测试。
  if (Object.prototype.hasOwnProperty.call(options, 'apiKey') && !options.apiKey) {
    console.info(
      '[normalizeModelErrorForDisplay] 命中「未配置大模型」兜底分支：' +
        'apiKey 为空，原始错误 =',
      raw,
    )
    return {
      content: MISSING_CUSTOM_API_MESSAGE,
      needsModelConfig: true,
      suggestConfigure: true,
      suggestWriteSelf: true,
    }
  }

  if (
    /(api.?key|authentication|unauthorized|invalid_api_key|401|403|auth.?fail|密钥|认证失败)/i.test(
      lower,
    )
  ) {
    console.info(
      '[normalizeModelErrorForDisplay] 命中「API Key 无效」分支：原始错误 =',
      raw,
    )
    return {
      content:
        'AI 调用失败：API Key 无效或未正确配置。请前往「我的模型」检查并重新保存 API Key。',
      needsModelConfig: true,
      suggestConfigure: true,
    }
  }

  // 覆盖官方 DeepSeek 与第三方兼容网关（如仅支持 deepseek-v4-*）的模型名报错
  if (
    /(model not exist|model not found|invalid model|unknown model|model.?not.?support|supported api model|supported.?model.?names|but you passed|404|模型不存在|模型名)/i.test(
      lower,
    )
  ) {
    console.info(
      '[normalizeModelErrorForDisplay] 命中「模型名称不正确」分支：原始错误 =',
      raw,
    )
    const suggested = raw.match(
      /(?:are|：|:)\s*([a-z0-9._-]+(?:\s*,\s*[a-z0-9._-]+){0,5})(?:\s*,?\s*and\s+([a-z0-9._-]+))?/i,
    )
    let hint = '请前往「我的模型」核对模型名称（需与服务商文档一致，如 deepseek-chat、deepseek-v4-flash）。'
    if (suggested) {
      const list = [suggested[1], suggested[2]]
        .filter(Boolean)
        .join(', ')
        .replace(/\s+/g, ' ')
      if (list) {
        hint = `当前接口支持的模型名：${list}。请在「我的模型」中改成其中之一后重试。`
      }
    }
    return {
      content: `AI 调用失败：模型名称不正确。${hint}`,
      needsModelConfig: true,
      suggestConfigure: true,
    }
  }

  if (
    /(fetch failed|failed to fetch|network|econnrefused|enotfound|getaddrinfo|econnreset|timeout|econntimeout|certificate|网络|连接)/i.test(
      lower,
    )
  ) {
    console.info(
      '[normalizeModelErrorForDisplay] 命中「网络/连接失败」分支：原始错误 =',
      raw,
    )
    return {
      content:
        'AI 调用失败：无法连接到模型服务。请检查网络连接，或核对「我的模型」中的接口地址。',
      needsModelConfig: true,
      suggestConfigure: true,
    }
  }

  // SDK 默认脱敏文案：不再武断归为「网络失败」（模型名错误也会被压成这句）
  if (/^an error occurred\.?$/i.test(lower)) {
    console.info(
      '[normalizeModelErrorForDisplay] 命中「SDK 脱敏通用错误」分支：原始错误 =',
      raw,
    )
    return {
      content:
        'AI 调用失败：请核对「我的模型」中的接口地址与模型名称是否与服务商一致（测试连接通过仅说明地址可达，模型名仍可能不对）。',
      needsModelConfig: true,
      suggestConfigure: true,
    }
  }

  console.info(
    '[normalizeModelErrorForDisplay] 未命中任何已知分类，走兜底透传：原始错误 =',
    raw,
  )
  return { content: `AI 调用失败：${raw}` }
}

function createDeepSeekChat(systemPrompt, syncTick, aiConfig = {}, callbacks = {}) {
  // V1.1 起仅使用用户在「我的模型」中自行配置的 API Key，平台不提供任何密钥。
  const apiKey = aiConfig.apiKey || ''
  const upstreamBase = ensureOpenAICompatibleBase(aiConfig.baseUrl, DEFAULT_BASE_URL)
  const model = aiConfig.model || DEFAULT_MODEL

  if (aiConfig.source === 'custom' && !apiKey && import.meta.env.DEV) {
    console.debug('[useAiChat] 自定义模型 API Key 未配置，发送消息前请在设置页填写。')
  }

  // Electron：优先主进程 fetch（与「测试连接」同路，无 CORS）。
  // 回退：经 local-server /api/model-proxy 转发（旧路径）。
  const useMainFetch = Boolean(aiConfig.useMainFetch)
  const proxyBaseUrl = String(aiConfig.proxyBaseUrl || '').replace(/\/$/, '')
  const baseURL = useMainFetch
    ? upstreamBase
    : proxyBaseUrl
      ? `${proxyBaseUrl}/api/model-proxy`
      : upstreamBase

  let fetchImpl = fetch
  if (useMainFetch) {
    fetchImpl = createElectronModelFetch()
  } else if (proxyBaseUrl) {
    fetchImpl = (input, init = {}) => {
      const headers = new Headers(init.headers || {})
      headers.set('X-WPX-Upstream-Base', upstreamBase)
      return fetch(input, { ...init, headers })
    }
  }

  const provider = createOpenAICompatible({
    name: 'deepseek',
    apiKey,
    baseURL,
    fetch: fetchImpl,
  })

  const agent = new ToolLoopAgent({
    model: provider(model),
    instructions: systemPrompt || undefined,
    temperature: aiConfig.temperature,
    topP: aiConfig.topP,
    maxOutputTokens: aiConfig.maxOutputTokens,
    onFinish: (event) => {
      // M2.1：对话成功 → 记录情景记忆（桌面端，受 recordEpisodes 开关控制）
      callbacks.onFinish?.(event)
    },
  })

  return new Chat({
    transport: new DirectChatTransport({
      agent,
      // AI SDK 默认 onError 会把真实报错脱敏成 "An error occurred."，
      // 导致模型名错误被误判成「无法连接」。这里保留上游原文。
      onError: (error) => {
        if (error == null) return '未知错误'
        if (typeof error === 'string') return error
        return error.message || String(error)
      },
    }),
    onData: () => {
      syncTick.value += 1
    },
    onFinish: () => {
      syncTick.value += 1
      callbacks.onChatFinish?.()
    },
    onError: (error) => {
      syncTick.value += 1
      callbacks.onChatError?.(error)
      // 重要：让用户立刻看到错误原因，而不是仅仅在 chat 面板中静默失败。
      // syncLatestAssistantMessage 依赖 isLoading 触发，但 toast 能让用户第一时间感知到问题。
      // eslint-disable-next-line no-console
      console.error('[useAiChat] chat error:', error)
      // 避免重复提示：syncLatestAssistantMessage 也已经会推入错误消息
      if (!callbacks.onError) {
        try {
          const t = useToast()
          const normalized = normalizeModelErrorForDisplay(error, { apiKey })
          t?.error?.(normalized.content)
        } catch {
          /* toast 不可用时静默 */
        }
      } else {
        callbacks.onError(error)
      }
    },
  })
}

/**
 * Vue composable wrapping @ai-sdk/vue Chat (AI SDK v3 useChat equivalent).
 *
 * @param {string | import('vue').MaybeRef<string>} systemPrompt
 * @param {{ skillExecutor?: import('@/composables/useSkillExecutor').useSkillExecutor, skillsStore?: import('pinia').StoreGeneric, getDocumentContext?: () => { recommendedSkillIds?: string[] }, onSkillExecuting?: (info: { skillId: string, skillName: string, params: Record<string, any> }) => void, onChatFinish?: () => void, onChatError?: (error: unknown) => void }} [skillOptions]
 */
export function useAiChat(systemPrompt = '', skillOptions = {}) {
  const modelSettingsStore = useModelSettingsStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const syncTick = ref(0)
  const input = ref('')
  const resolvedApiKey = ref('')

  // ── Skill 集成 ──
  const { skillExecutor, skillsStore, getDocumentContext, onSkillExecuting, onChatFinish, onChatError } = skillOptions
  const pendingSkill = ref(null)
  const lastSkillInvocation = ref(null)

  // V1.1 起仅使用用户自定义模型：始终返回 custom 配置，
  // apiKey 为空时由 sendMessage 的 MISSING_CUSTOM_API 分支引导去「我的模型」配置。
  async function resolveAiConfig() {
    const textConfig = modelSettingsStore.effectiveTextConfig

    let apiKey = ''
    try {
      apiKey = (await modelSettingsStore.resolveTextApiKey()) || ''
    } catch (error) {
      // 读取自定义 Key 失败（如主进程解密异常）不应中断发送流程，
      // 交给下方 MISSING_CUSTOM_API 分支给出「设置 / 自己写」对话引导。
      console.warn('[useAiChat] 读取自定义 API Key 失败:', error?.message || error)
      apiKey = ''
    }
    resolvedApiKey.value = apiKey

    let proxyBaseUrl = ''
    let useMainFetch = false
    if (isElectron() && apiKey) {
      // 优先主进程 fetch：与设置页测试连接同一网络路径，彻底避开 CORS
      if (canUseElectronModelFetch()) {
        useMainFetch = true
      } else {
        try {
          proxyBaseUrl = (await getLocalApiBase()) || ''
        } catch (error) {
          console.warn('[useAiChat] 本地模型代理不可用:', error?.message || error)
          proxyBaseUrl = ''
        }
      }
    }

    return {
      source: 'custom',
      apiKey: apiKey || '',
      baseUrl: textConfig.baseUrl,
      proxyBaseUrl,
      useMainFetch,
      model: textConfig.model,
      temperature: textConfig.temperature,
      topP: textConfig.topP,
      maxOutputTokens: textConfig.maxOutputTokens,
    }
  }

  function handleCustomModelError(error) {
    // V1.1 起仅使用用户自定义模型：调用失败统一给出可见提示，
    // 避免「发消息后无任何反馈」的静默失败。错误详情同时由
    // AiAssistantPlaceholder 的错误气泡展示。
    const normalized = normalizeModelErrorForDisplay(error, { apiKey: resolvedApiKey.value })
    try {
      toast.error(normalized.content)
    } catch {
      // toast 不可用时静默（面板错误气泡仍会兜底展示）
    }
  }

  // ── M2.1：对话成功 → 情景记忆（桌面端） ──
  const lastUserText = ref('')

  /** 学习设置缓存（30s），避免每条消息都拉一次 IPC */
  let memorySettingsCache = null
  let memorySettingsFetchedAt = 0

  async function shouldRecordChatEpisode() {
    if (!isElectron()) return false
    const api = getElectronAPI()
    if (!api?.memory?.getLearnSettings) return false

    const now = Date.now()
    if (memorySettingsCache && now - memorySettingsFetchedAt < 30_000) {
      return isEpisodeRecordingEnabled(memorySettingsCache)
    }
    try {
      const settings = await api.memory.getLearnSettings()
      memorySettingsCache = settings || {}
      memorySettingsFetchedAt = now
      return isEpisodeRecordingEnabled(memorySettingsCache)
    } catch (error) {
      // 读取失败时默认记录，不让隐私配置影响主流程
      console.warn('[useAiChat] 读取记忆设置失败:', error?.message || error)
      return true
    }
  }

  async function recordChatEpisode(event) {
    const payload = buildChatEpisode(event, lastUserText.value)
    if (!payload) return
    if (!(await shouldRecordChatEpisode())) return
    try {
      await getElectronAPI()?.memory?.recordEpisode(payload)
    } catch (error) {
      // 记忆记录失败不影响对话
      console.warn('[useAiChat] 记录情景记忆失败:', error?.message || error)
    }
  }

  function buildChatCallbacks() {
    return {
      onError: handleCustomModelError,
      onFinish: (event) => {
        void recordChatEpisode(event)
      },
      onChatFinish,
      onChatError,
    }
  }

  const chatRef = shallowRef(createDeepSeekChat(toValue(systemPrompt), syncTick, {}, buildChatCallbacks()))

  /**
   * 防止「初始 resolve / watch recreate / send 前 recreate」互相覆盖：
   * 较晚完成的旧 resolve 若带着空 apiKey 写回 chatRef，会出现设置页已保存 Key、
   * 发送校验也通过，但实际请求仍用空 Key → 被归一成「未配置大模型」。
   */
  let chatGeneration = 0

  /**
   * 已持有完整 aiConfig 时同步落到 chatRef（发送路径专用，不可被并发 recreate 取消）。
   * @param {Awaited<ReturnType<typeof resolveAiConfig>>} aiConfig
   */
  function applyChatConfig(aiConfig) {
    chatGeneration += 1
    const previousMessages = chatRef.value.messages
    chatRef.value = createDeepSeekChat(toValue(systemPrompt), syncTick, aiConfig, buildChatCallbacks())
    chatRef.value.messages = previousMessages
    syncTick.value += 1
  }

  /**
   * @param {Awaited<ReturnType<typeof resolveAiConfig>>} [aiConfig]
   */
  async function recreateChat(aiConfig) {
    const generation = ++chatGeneration
    const previousMessages = chatRef.value.messages
    const nextConfig = aiConfig || (await resolveAiConfig())
    if (generation !== chatGeneration) return
    chatRef.value = createDeepSeekChat(toValue(systemPrompt), syncTick, nextConfig, buildChatCallbacks())
    chatRef.value.messages = previousMessages
    syncTick.value += 1
  }

  void recreateChat()

  watch(
    () => toValue(systemPrompt),
    () => {
      void recreateChat()
    },
  )

  watch(
    () => [
      modelSettingsStore.configVersion,
      modelSettingsStore.effectiveTextConfig.baseUrl,
      modelSettingsStore.effectiveTextConfig.model,
      modelSettingsStore.effectiveTextConfig.temperature,
      modelSettingsStore.effectiveTextConfig.topP,
      modelSettingsStore.effectiveTextConfig.maxOutputTokens,
      authStore.isGuest,
    ],
    () => {
      void recreateChat()
    },
  )

  const messages = computed(() => {
    syncTick.value
    return chatRef.value.messages
  })

  const isLoading = computed(() => {
    syncTick.value
    return chatRef.value.status === 'submitted' || chatRef.value.status === 'streaming'
  })

  /**
   * jcode 路由检查（透明降级提示）
   *
   * - 简单任务不唤醒 jcode
   * - 仅桌面端尝试；Web 环境下静默走云端
   * - 调用 ai-router.routeTask：
   *     · ok:true 命中 jcode 或 skippedJcode → 不打扰
   *     · ok:false + fallbackReason → toast.warning 把后端 message 透传出去
   * - fire-and-forget：不等结果，不影响 sendMessage 主流程
   * - 任何异常都被吞掉,绝不能阻塞主聊天
   *
   * @param {string} text
   */
  function tryJcodeRoute(text) {
    if (!shouldUseJcode(text)) return
    if (!isElectron()) return

    void (async () => {
      try {
        const result = await routeTask(
          {
            task: 'ai_chat',
            params: { userMessage: text },
          },
          {
            // 路由检查只是“要不要走 jcode”的探针,不应阻塞用户感知;
            // 实际执行交给 CopilotKit runtime 的 /api/ck/route 端点
            timeoutMs: 3_000,
          },
        )
        if (!result.ok && result.fallbackReason && result.message) {
          toast.warning(result.message)
        }
      } catch (err) {
        // 路由检查异常不影响主聊天流程
        console.warn('[useAiChat] jcode 路由检查失败:', err?.message || err)
      }
    })()
  }

  // ── M3-C+：Hermes 自动路由 ──
  /** Hermes 路由上下文缓存（30s） */
  let hermesRoutingCache = null
  let hermesRoutingFetchedAt = 0

  async function loadHermesRoutingContext() {
    if (!isElectron()) return null
    const api = getElectronAPI()
    if (!api?.hermes?.getSettings || !api.hermes?.getStatus) return null

    const now = Date.now()
    if (hermesRoutingCache && now - hermesRoutingFetchedAt < 30_000) {
      return hermesRoutingCache
    }
    try {
      const [settingsRes, status] = await Promise.all([
        api.hermes.getSettings(),
        api.hermes.getStatus(),
      ])
      hermesRoutingCache = {
        enabled: settingsRes?.settings?.enabled === true,
        autoRoute: settingsRes?.settings?.autoRoute === true,
        gatewayReady: status?.state === 'RUNNING',
      }
    } catch {
      hermesRoutingCache = { enabled: false, autoRoute: false, gatewayReady: false }
    }
    hermesRoutingFetchedAt = now
    return hermesRoutingCache
  }

  /**
   * Hermes 自动路由：命中则执行并把结果作为助手消息追加进对话。
   * 任何失败都返回 null（调用方继续走云端，透明降级）。
   * @param {string} text 用户原始消息
   * @returns {Promise<object | null>} 追加的消息；未命中/失败返回 null
   */
  async function tryHermesAutoRoute(text) {
    const ctx = await loadHermesRoutingContext()
    if (!ctx || !shouldAutoRouteHermes(text, ctx)) return null

    const result = await runHermesTask(text)
    if (!result.ok || !result.result) {
      console.warn('[useAiChat] Hermes 自动路由未产生结果，回退云端:', result.error)
      return null
    }
    const message = buildHermesAssistantMessage(text, result.result)
    chatRef.value.messages = [...chatRef.value.messages, message]
    syncTick.value += 1
    return message
  }

  async function sendMessage({ text, context }) {
    // M2.1：记录本次用户输入，供对话成功后的情景记忆使用（原始文本，不含上下文注入）
    lastUserText.value = text || ''
    const aiConfig = await resolveAiConfig()

    // V1.1 起仅使用用户自定义模型：未配置 API Key 时拦截并引导配置。
    if (!aiConfig.apiKey) {
      return {
        ok: false,
        code: MISSING_CUSTOM_API,
        message: MISSING_CUSTOM_API_MESSAGE,
        isGuest: authStore.isGuest,
        suggestConfigure: true,
      }
    }

    // 桌面端必须经主进程 fetch 或本地代理；生产 file:// 直连会被 CORS 拦截。
    if (isElectron() && !aiConfig.useMainFetch && !aiConfig.proxyBaseUrl) {
      return {
        ok: false,
        code: 'LOCAL_PROXY_UNAVAILABLE',
        message: '本地模型通道未就绪，无法调用大模型。请重启 WPX 后重试。',
        suggestConfigure: false,
      }
    }

    // 每次发送前同步注入刚解析到的配置（含本地代理），避免竞态留下空 Key 实例。
    applyChatConfig(aiConfig)

    // ── jcode 路由检查（仅复杂任务 · 仅桌面端 · 不阻塞主流程） ──
    tryJcodeRoute(text)

    // ── Step 0: 手动指定 Skill（parseSkillCommand）──
    if (skillExecutor && skillsStore) {
      const parseResult = skillExecutor.parseSkillCommand(text)
      if (parseResult.matched) {
        const enabledCandidates = parseResult.candidates.filter((c) =>
          skillsStore.isSkillEnabled(c.skillId),
        )

        if (enabledCandidates.length === 1) {
          // 唯一已启用的匹配 —— 提取参数直接执行
          const candidate = enabledCandidates[0]
          const schema = skillExecutor.getSkillInputForm(candidate.skillId)
          const params = skillExecutor.extractParamsFromText(parseResult.paramText, schema)
          lastSkillInvocation.value = { skillId: candidate.skillId, skillName: candidate.name, params, ts: Date.now() }
          onSkillExecuting?.(lastSkillInvocation.value)
          const result = skillExecutor.executeSkillLenient(candidate.skillId, params)
          const payload = buildContextPrompt(result.prompt, context)
          chatRef.value.sendMessage({ text: payload })
          syncTick.value += 1
          return { ok: true }
        }

        if (enabledCandidates.length > 1) {
          // 多候选 —— 让用户选择
          pendingSkill.value = {
            mode: 'candidates',
            candidates: enabledCandidates,
            paramText: parseResult.paramText,
            originalText: text,
            context,
          }
          return { ok: true, pending: true }
        }

        // 没有已启用的匹配 —— 静默回退为普通对话
      }
    }

    // ── Step 1: 隐式 Skill 意图匹配（matchSkillByIntent）──
    if (skillExecutor && skillsStore) {
      const docContext = typeof getDocumentContext === 'function' ? getDocumentContext() : null
      const matchedId = skillExecutor.matchSkillByIntent(text, {
        recommendedSkillIds: docContext?.recommendedSkillIds || [],
      })
      if (matchedId) {
        if (skillsStore.isSkillEnabled(matchedId)) {
          const schema = skillExecutor.getSkillInputForm(matchedId)
          if (schema && Object.keys(schema).length > 0) {
            // Skill 需要参数 —— 弹出表单收集
            pendingSkill.value = { mode: 'form', skillId: matchedId, inputSchema: schema, originalText: text, context }
            return { ok: true, pending: true }
          } else {
            // 无参数依赖 —— 直接组装发送
            const result = skillExecutor.executeSkill(matchedId, {})
            if (result.prompt) {
              const skillName = skillExecutor.findSkill(matchedId)?.name || matchedId
              lastSkillInvocation.value = { skillId: matchedId, skillName, params: {}, ts: Date.now() }
              onSkillExecuting?.(lastSkillInvocation.value)
              const payload = buildContextPrompt(result.prompt, context)
              chatRef.value.sendMessage({ text: payload })
              syncTick.value += 1
              return { ok: true }
            }
          }
        }
        // Skill 被禁用 —— 静默回退为普通对话
      }
    }

    // ── Step 2: Hermes 自动路由（M3-C+；命中即执行并追加结果，失败静默回退云端） ──
    const hermesMessage = await tryHermesAutoRoute(text)
    if (hermesMessage) {
      return { ok: true, engine: 'hermes' }
    }

    const payload = buildContextPrompt(text, context)
    chatRef.value.sendMessage({ text: payload })
    syncTick.value += 1
    return { ok: true }
  }

  /**
   * 提交 Skill 参数表单 —— 组装 Prompt 并发送
   * @param {Record<string, any>} formData
   */
  function submitSkillForm(formData) {
    if (!pendingSkill.value) return
    const { skillId, originalText, context: savedContext } = pendingSkill.value
    const result = skillExecutor.executeSkill(skillId, formData || {})
    if (result.prompt) {
      const skillName = skillExecutor.findSkill(skillId)?.name || skillId
      lastSkillInvocation.value = { skillId, skillName, params: formData || {}, ts: Date.now() }
      onSkillExecuting?.(lastSkillInvocation.value)
      const payload = buildContextPrompt(result.prompt, savedContext)
      chatRef.value.sendMessage({ text: payload })
      syncTick.value += 1
    } else {
      // 执行失败（极少情况），回退为原始消息
      const payload = buildContextPrompt(originalText, savedContext)
      chatRef.value.sendMessage({ text: payload })
      syncTick.value += 1
    }
    pendingSkill.value = null
  }

  /**
   * 取消 Skill 参数表单 —— 以原始消息发送
   */
  function cancelSkillForm() {
    if (!pendingSkill.value) return
    const { originalText, context: savedContext } = pendingSkill.value
    const payload = buildContextPrompt(originalText, savedContext)
    chatRef.value.sendMessage({ text: payload })
    syncTick.value += 1
    pendingSkill.value = null
  }

  /**
   * 用户从候选列表中选中一个 Skill 后执行
   * @param {string} skillId
   */
  function selectSkillCandidate(skillId) {
    if (!pendingSkill.value || pendingSkill.value.mode !== 'candidates') return
    const { context, paramText } = pendingSkill.value

    if (skillExecutor) {
      const schema = skillExecutor.getSkillInputForm(skillId)
      const params = skillExecutor.extractParamsFromText(paramText, schema)
      const skillName = skillExecutor.findSkill(skillId)?.name || skillId
      lastSkillInvocation.value = { skillId, skillName, params, ts: Date.now() }
      onSkillExecuting?.(lastSkillInvocation.value)
      const result = skillExecutor.executeSkillLenient(skillId, params)
      const payload = buildContextPrompt(result.prompt, context)
      chatRef.value.sendMessage({ text: payload })
      syncTick.value += 1
    }
    pendingSkill.value = null
  }

  /**
   * 用相同参数重新执行 Skill
   * @param {string} skillId
   * @param {Record<string, any>} params
   */
  function retrySkill(skillId, params) {
    if (!skillExecutor) return
    const skill = skillExecutor.findSkill(skillId)
    const result = skillExecutor.executeSkillLenient(skillId, params || {})
    const payload = buildContextPrompt(result.prompt, [])
    chatRef.value.sendMessage({ text: payload })
    syncTick.value += 1
    lastSkillInvocation.value = {
      skillId,
      skillName: skill?.name || skillId,
      params: params || {},
      ts: Date.now(),
    }
    onSkillExecuting?.(lastSkillInvocation.value)
  }

  function handleSubmit(event) {
    event?.preventDefault?.()

    const text = input.value.trim()
    if (!text || isLoading.value) return

    void sendMessage({ text })
    input.value = ''
  }

  /** 中止当前生成（保留已流出的内容） */
  async function stopGeneration() {
    try {
      await chatRef.value?.stop?.()
    } catch (error) {
      console.warn('[useAiChat] stopGeneration 失败:', error?.message || error)
    } finally {
      syncTick.value += 1
    }
  }

  return {
    messages,
    input,
    handleSubmit,
    isLoading,
    chatRef,
    sendMessage,
    stopGeneration,
    submitSkillForm,
    cancelSkillForm,
    selectSkillCandidate,
    retrySkill,
    lastSkillInvocation,
    pendingSkill,
    buildContextPrompt,
    MISSING_CUSTOM_API,
    resolvedApiKey,
  }
}

/**
 * Extract plain text from AI SDK UIMessage parts.
 *
 * 仅返回 type === 'text' 的 part，**不包含 reasoning**。
 * 因为 reasoning 是模型的思考过程，复制到文档里会污染用户内容。
 * 若需要把 reasoning 展示给用户，请用 getMessageReasoning() 单独渲染折叠面板。
 */
export function getMessageText(message) {
  if (!message?.parts?.length) return ''

  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/**
 * Extract reasoning (thinking) content from AI SDK UIMessage parts.
 *
 * 适用于 DeepSeek R1（deepseek-reasoner）等会输出 reasoning_content 的推理模型。
 * 返回的字符串可能为空（普通模型不会产生 reasoning part）。
 *
 * @param {object} message
 * @returns {string}
 */
export function getMessageReasoning(message) {
  if (!message?.parts?.length) return ''

  return message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text || '')
    .join('')
}

/**
 * 是否该消息包含 reasoning 内容（用于决定是否渲染「思考过程」折叠面板）。
 * @param {object} message
 * @returns {boolean}
 */
export function hasMessageReasoning(message) {
  if (!message?.parts?.length) return false
  return message.parts.some((part) => part.type === 'reasoning' && part.text)
}
