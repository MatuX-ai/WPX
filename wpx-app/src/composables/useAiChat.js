import { Chat } from '@ai-sdk/vue'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import { computed, ref, toValue, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useModelSettingsStore } from '@/stores/modelSettings'
import {
  consumeFreeQuota,
  FREE_QUOTA_EXHAUSTED,
  FREE_QUOTA_MESSAGE,
  FreeQuotaExhaustedError,
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

  if (!apiKey) {
    console.warn('[useAiChat] API Key 未配置，请在设置页填写或配置 VITE_DEEPSEEK_API_KEY。')
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
 */
export function useAiChat(systemPrompt = '') {
  const modelSettingsStore = useModelSettingsStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const syncTick = ref(0)
  const input = ref('')
  const resolvedApiKey = ref('')
  const lastQuotaError = ref(null)

  async function resolveAiConfig() {
    const textConfig = modelSettingsStore.effectiveTextConfig
    let apiKey = textConfig.apiKey

    if (textConfig.source === 'custom') {
      apiKey = await modelSettingsStore.resolveTextApiKey()
      resolvedApiKey.value = apiKey || ''
    } else {
      resolvedApiKey.value = apiKey || ''
    }

    return {
      source: textConfig.source,
      apiKey: apiKey || resolvedApiKey.value,
      baseUrl: textConfig.baseUrl,
      model: textConfig.model,
      temperature: textConfig.temperature,
      topP: textConfig.topP,
      maxOutputTokens: textConfig.maxOutputTokens,
    }
  }

  async function handleCustomModelError(error) {
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

  let chat = createDeepSeekChat(toValue(systemPrompt), syncTick, {}, { onError: handleCustomModelError })

  async function recreateChat() {
    const previousMessages = chat.messages
    const aiConfig = await resolveAiConfig()
    chat = createDeepSeekChat(toValue(systemPrompt), syncTick, aiConfig, {
      onError: handleCustomModelError,
    })
    chat.messages = previousMessages
    syncTick.value += 1
  }

  void resolveAiConfig().then((aiConfig) => {
    chat = createDeepSeekChat(toValue(systemPrompt), syncTick, aiConfig, {
      onError: handleCustomModelError,
    })
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
      const result = await consumeFreeQuota({
        isGuest: authStore.isGuest,
        userId: authStore.currentUser?.id || null,
      })
      lastQuotaError.value = null
      return { ok: true, quota: result }
    } catch (error) {
      if (error instanceof FreeQuotaExhaustedError) {
        lastQuotaError.value = {
          code: FREE_QUOTA_EXHAUSTED,
          message: FREE_QUOTA_MESSAGE,
          isGuest: authStore.isGuest,
          details: error.details,
        }
        return {
          ok: false,
          code: FREE_QUOTA_EXHAUSTED,
          message: FREE_QUOTA_MESSAGE,
          isGuest: authStore.isGuest,
          details: error.details,
        }
      }

      throw error
    }
  }

  async function sendMessage({ text, context }) {
    const aiConfig = await resolveAiConfig()
    if (aiConfig.source === 'custom' && !aiConfig.apiKey) {
      toast.error('自定义模型未配置 API Key，请在模型设置中保存')
      return { ok: false, code: 'MISSING_API_KEY' }
    }

    const quotaResult = await ensurePlatformFreeQuota()
    if (!quotaResult.ok) {
      return quotaResult
    }

    const payload = buildContextPrompt(text, context)
    chat.sendMessage({ text: payload })
    syncTick.value += 1
    return { ok: true }
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
    buildContextPrompt,
    lastQuotaError,
    ensurePlatformFreeQuota,
    FREE_QUOTA_EXHAUSTED,
    FREE_QUOTA_MESSAGE,
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
