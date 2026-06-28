import { Chat } from '@ai-sdk/vue'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import { computed, ref, toValue, watch } from 'vue'
import {
  GUEST_MISSING_CUSTOM_API_MESSAGE,
  LOGGED_IN_MISSING_CUSTOM_API_MESSAGE,
  LOGGED_IN_QUOTA_EXHAUSTED_CONFIGURE_MESSAGE,
  LOGGED_IN_QUOTA_EXHAUSTED_RECHARGE_MESSAGE,
  MISSING_CUSTOM_API,
} from '@/constants/aiModelMessages'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { isElectron } from '@/utils/electron'
import { routeTask, shouldUseJcode } from '@/server/ai-router'
import {
  checkFreeQuota,
  consumeFreeQuotaTokens,
  FREE_QUOTA_EXHAUSTED,
  FreeQuotaExhaustedError,
  resolveUsageTokens,
} from '@/utils/freeQuota'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
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

function createDeepSeekChat(systemPrompt, syncTick, aiConfig = {}, callbacks = {}) {
  const apiKey = aiConfig.apiKey || import.meta.env.VITE_DEEPSEEK_API_KEY
  const baseURL = aiConfig.baseUrl || DEFAULT_BASE_URL
  const model = aiConfig.model || DEFAULT_MODEL
  const isPlatform = aiConfig.source === 'platform'

  if (aiConfig.source === 'custom' && !apiKey && import.meta.env.DEV) {
    console.debug('[useAiChat] 自定义模型 API Key 未配置，发送消息前请在设置页填写。')
  }

  const provider = createOpenAICompatible({
    name: 'deepseek',
    apiKey,
    baseURL,
  })

  const agent = new ToolLoopAgent({
    model: provider(model),
    instructions: systemPrompt || undefined,
    temperature: aiConfig.temperature,
    topP: aiConfig.topP,
    maxOutputTokens: aiConfig.maxOutputTokens,
    onFinish: (event) => {
      if (isPlatform && callbacks.onPlatformTokensUsed) {
        const tokens = resolveUsageTokens(event.totalUsage, {
          fallbackText: event.text || '',
        })
        void callbacks.onPlatformTokensUsed(tokens)
      }
    },
  })

  return new Chat({
    transport: new DirectChatTransport({ agent }),
    onData: () => {
      syncTick.value += 1
    },
    onFinish: () => {
      syncTick.value += 1
    },
    onError: (error) => {
      syncTick.value += 1
      callbacks.onError?.(error)
    },
  })
}

/**
 * Vue composable wrapping @ai-sdk/vue Chat (AI SDK v3 useChat equivalent).
 *
 * @param {string | import('vue').MaybeRef<string>} systemPrompt
 * @param {{ skillExecutor?: import('@/composables/useSkillExecutor').useSkillExecutor, skillsStore?: import('pinia').StoreGeneric, onSkillExecuting?: (info: { skillId: string, skillName: string, params: Record<string, any> }) => void }} [skillOptions]
 */
export function useAiChat(systemPrompt = '', skillOptions = {}) {
  const modelSettingsStore = useModelSettingsStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const syncTick = ref(0)
  const input = ref('')
  const resolvedApiKey = ref('')
  const lastQuotaError = ref(null)

  // ── Skill 集成 ──
  const { skillExecutor, skillsStore, onSkillExecuting } = skillOptions
  const pendingSkill = ref(null)
  const lastSkillInvocation = ref(null)

  async function resolveAiConfig() {
    const textConfig = modelSettingsStore.effectiveTextConfig

    if (textConfig.source === 'custom' && !modelSettingsStore.textPlatformFallback) {
      const apiKey = await modelSettingsStore.resolveTextApiKey()
      resolvedApiKey.value = apiKey || ''

      return {
        source: 'custom',
        apiKey: apiKey || '',
        baseUrl: textConfig.baseUrl,
        model: textConfig.model,
        temperature: textConfig.temperature,
        topP: textConfig.topP,
        maxOutputTokens: textConfig.maxOutputTokens,
      }
    }

    if (authStore.isGuest) {
      resolvedApiKey.value = ''
      return {
        source: 'unavailable',
        apiKey: '',
        baseUrl: textConfig.baseUrl,
        model: textConfig.model,
        temperature: textConfig.temperature,
        topP: textConfig.topP,
        maxOutputTokens: textConfig.maxOutputTokens,
      }
    }

    resolvedApiKey.value = textConfig.apiKey || ''
    return {
      source: 'platform',
      apiKey: textConfig.apiKey || resolvedApiKey.value,
      baseUrl: textConfig.baseUrl,
      model: textConfig.model,
      temperature: textConfig.temperature,
      topP: textConfig.topP,
      maxOutputTokens: textConfig.maxOutputTokens,
    }
  }

  async function handlePlatformTokensUsed(tokens) {
    try {
      await consumeFreeQuotaTokens({
        tokens,
        isGuest: false,
        userId: authStore.currentUser?.id || null,
      })
    } catch (error) {
      console.warn('[useAiChat] Failed to record platform token usage:', error)
    }
  }

  async function handleCustomModelError(error) {
    if (authStore.isGuest) {
      return
    }

    const config = modelSettingsStore.effectiveTextConfig
    if (config.source !== 'custom' || modelSettingsStore.textPlatformFallback) {
      return
    }

    const activated = modelSettingsStore.activateTextPlatformFallback()
    if (!activated) return

    toast.warning('自定义模型调用失败，已回退到 WPX 平台模型')
    console.warn('[useAiChat] Custom model failed, falling back to platform model:', error)
    await recreateChat()
  }

  function buildChatCallbacks(aiConfig) {
    return {
      onError: handleCustomModelError,
      onPlatformTokensUsed: aiConfig.source === 'platform' ? handlePlatformTokensUsed : undefined,
    }
  }

  let chat = createDeepSeekChat(toValue(systemPrompt), syncTick, {}, buildChatCallbacks({}))

  async function recreateChat() {
    const previousMessages = chat.messages
    const aiConfig = await resolveAiConfig()
    chat = createDeepSeekChat(toValue(systemPrompt), syncTick, aiConfig, buildChatCallbacks(aiConfig))
    chat.messages = previousMessages
    syncTick.value += 1
  }

  void resolveAiConfig().then((aiConfig) => {
    chat = createDeepSeekChat(toValue(systemPrompt), syncTick, aiConfig, buildChatCallbacks(aiConfig))
    syncTick.value += 1
  })

  watch(
    () => toValue(systemPrompt),
    () => {
      void recreateChat()
    },
  )

  watch(
    () => [
      modelSettingsStore.configVersion,
      modelSettingsStore.effectiveTextConfig.source,
      modelSettingsStore.effectiveTextConfig.baseUrl,
      modelSettingsStore.effectiveTextConfig.model,
      modelSettingsStore.effectiveTextConfig.temperature,
      modelSettingsStore.effectiveTextConfig.topP,
      modelSettingsStore.effectiveTextConfig.maxOutputTokens,
      modelSettingsStore.textPlatformFallback,
      authStore.isGuest,
    ],
    () => {
      void recreateChat()
    },
  )

  const messages = computed(() => {
    syncTick.value
    return chat.messages
  })

  const isLoading = computed(() => {
    syncTick.value
    return chat.status === 'submitted' || chat.status === 'streaming'
  })

  async function ensurePlatformFreeQuota() {
    const aiConfig = await resolveAiConfig()
    if (aiConfig.source !== 'platform') {
      lastQuotaError.value = null
      return { ok: true }
    }

    try {
      const result = await checkFreeQuota({
        isGuest: false,
        userId: authStore.currentUser?.id || null,
      })
      lastQuotaError.value = null
      return { ok: true, quota: result }
    } catch (error) {
      if (error instanceof FreeQuotaExhaustedError) {
        const suggestConfigure = !modelSettingsStore.hasStoredTextApiKey
        const message = suggestConfigure
          ? LOGGED_IN_QUOTA_EXHAUSTED_CONFIGURE_MESSAGE
          : LOGGED_IN_QUOTA_EXHAUSTED_RECHARGE_MESSAGE

        lastQuotaError.value = {
          code: FREE_QUOTA_EXHAUSTED,
          message,
          isGuest: false,
          suggestConfigure,
          details: error.details,
        }
        return {
          ok: false,
          code: FREE_QUOTA_EXHAUSTED,
          message,
          isGuest: false,
          suggestConfigure,
          details: error.details,
        }
      }

      throw error
    }
  }

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

  async function sendMessage({ text, context }) {
    const aiConfig = await resolveAiConfig()

    if (aiConfig.source === 'custom') {
      if (!aiConfig.apiKey) {
        const message = authStore.isGuest
          ? GUEST_MISSING_CUSTOM_API_MESSAGE
          : LOGGED_IN_MISSING_CUSTOM_API_MESSAGE

        return {
          ok: false,
          code: MISSING_CUSTOM_API,
          message,
          isGuest: authStore.isGuest,
          suggestConfigure: true,
        }
      }
    } else if (aiConfig.source === 'platform') {
      const quotaResult = await ensurePlatformFreeQuota()
      if (!quotaResult.ok) {
        return quotaResult
      }
    } else if (authStore.isGuest) {
      return {
        ok: false,
        code: MISSING_CUSTOM_API,
        message: GUEST_MISSING_CUSTOM_API_MESSAGE,
        isGuest: true,
        suggestConfigure: true,
      }
    }

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
          chat.sendMessage({ text: payload })
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
      const matchedId = skillExecutor.matchSkillByIntent(text)
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
              chat.sendMessage({ text: payload })
              syncTick.value += 1
              return { ok: true }
            }
          }
        }
        // Skill 被禁用 —— 静默回退为普通对话
      }
    }

    const payload = buildContextPrompt(text, context)
    chat.sendMessage({ text: payload })
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
      chat.sendMessage({ text: payload })
      syncTick.value += 1
    } else {
      // 执行失败（极少情况），回退为原始消息
      const payload = buildContextPrompt(originalText, savedContext)
      chat.sendMessage({ text: payload })
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
    chat.sendMessage({ text: payload })
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
      chat.sendMessage({ text: payload })
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
    chat.sendMessage({ text: payload })
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

  return {
    messages,
    input,
    handleSubmit,
    isLoading,
    chat,
    sendMessage,
    submitSkillForm,
    cancelSkillForm,
    selectSkillCandidate,
    retrySkill,
    lastSkillInvocation,
    pendingSkill,
    buildContextPrompt,
    lastQuotaError,
    ensurePlatformFreeQuota,
    FREE_QUOTA_EXHAUSTED,
    MISSING_CUSTOM_API,
    GUEST_MISSING_CUSTOM_API_MESSAGE,
    LOGGED_IN_QUOTA_EXHAUSTED_CONFIGURE_MESSAGE,
  }
}

/**
 * Extract plain text from AI SDK UIMessage parts.
 */
export function getMessageText(message) {
  if (!message?.parts?.length) return ''

  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}
