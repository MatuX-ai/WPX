export const AI_ASSISTANT_ONBOARDING_KEY = 'wpx-ai-assistant-onboarding-v1'

export const AI_ONBOARDING_SETUP_MESSAGE =
  '老板您好～我是您的写作小秘书。\n\n为了让我更好帮您干活，劳您花几分钟把**本地大模型 API** 配置好；接好后我就能随时听候差遣啦。'

export const AI_ONBOARDING_ACCOUNT_MESSAGE =
  '当然，若您手头还没有现成的模型接口，也可以先注册登录 **WPX**——现在每天送 **100 万 Token**，轻度使用完全够用，省心又实惠～'

export const AI_ASSISTANT_DEFAULT_WELCOME =
  '你好，我是 AI 写作助手。选中编辑器中的文字后，在这里输入修改指令即可自动替换选区。输入 @ 可引用资料库中的文档。'

/**
 * @returns {boolean}
 */
export function isAiAssistantOnboardingPending() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(AI_ASSISTANT_ONBOARDING_KEY) !== 'done'
}

export function markAiAssistantOnboardingDone() {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AI_ASSISTANT_ONBOARDING_KEY, 'done')
}

/**
 * @param {{ hasCustomTextApiKey?: boolean }} [options]
 * @returns {boolean}
 */
export function shouldShowAiAssistantOnboarding(options = {}) {
  if (!isAiAssistantOnboardingPending()) return false
  if (options.hasCustomTextApiKey) {
    markAiAssistantOnboardingDone()
    return false
  }
  return true
}

/**
 * @param {{ isGuest?: boolean, createMessageId: () => string }} options
 */
export function createAiOnboardingMessages({ isGuest = true, createMessageId }) {
  /** @type {Array<Record<string, unknown>>} */
  const messages = [
    {
      id: createMessageId(),
      role: 'assistant',
      content: AI_ONBOARDING_SETUP_MESSAGE,
      onboardingKind: 'setup',
    },
  ]

  if (isGuest) {
    messages.push({
      id: createMessageId(),
      role: 'assistant',
      content: AI_ONBOARDING_ACCOUNT_MESSAGE,
      onboardingKind: 'account',
    })
  }

  return messages
}
