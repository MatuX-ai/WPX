export const AI_ASSISTANT_ONBOARDING_KEY = 'wpx-ai-assistant-onboarding-v1'

export const AI_ONBOARDING_SETUP_MESSAGE =
  '老板您好～我是您的写作小秘书。\n\n为了让我更好帮您干活，劳您花几分钟把**本地大模型 API** 配置好；接好后我就能随时听候差遣啦。'

// V1 完全免费模式：不再提供「注册领 100M Token」入口，
// 也不推荐用户去注册账户。V1 默认访客身份即可使用全部本地能力。
// 保留常量仅为兼容历史 import；createAiOnboardingMessages 不再推送此消息。
export const AI_ONBOARDING_ACCOUNT_MESSAGE =
  'V1 完全免费模式：无需注册账户，请在「我的模型」中接入大模型 API 后即可使用。'

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
 * V1 完全免费模式：V1 无需注册，不推送「注册/领 Token」类型的引导消息。
 * 仅返回「接入大模型 API」一条 setup 消息。
 *
 * @param {{ isGuest?: boolean, createMessageId: () => string }} options
 */
export function createAiOnboardingMessages({ createMessageId }) {
  /** @type {Array<Record<string, unknown>>} */
  return [
    {
      id: createMessageId(),
      role: 'assistant',
      content: AI_ONBOARDING_SETUP_MESSAGE,
      onboardingKind: 'setup',
    },
  ]
}
