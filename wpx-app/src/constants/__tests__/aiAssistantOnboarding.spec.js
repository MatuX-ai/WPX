import { describe, it, expect, beforeEach } from 'vitest'
import {
  AI_ASSISTANT_ONBOARDING_KEY,
  createAiOnboardingMessages,
  isAiAssistantOnboardingPending,
  markAiAssistantOnboardingDone,
  shouldShowAiAssistantOnboarding,
} from '@/constants/aiAssistantOnboarding'

describe('aiAssistantOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('首次安装默认需要 onboarding', () => {
    expect(isAiAssistantOnboardingPending()).toBe(true)
    expect(shouldShowAiAssistantOnboarding()).toBe(true)
  })

  it('已配置自定义 Key 时跳过 onboarding', () => {
    expect(shouldShowAiAssistantOnboarding({ hasCustomTextApiKey: true })).toBe(false)
    expect(localStorage.getItem(AI_ASSISTANT_ONBOARDING_KEY)).toBe('done')
  })

  it('访客 onboarding 含设置与账号两条消息', () => {
    const messages = createAiOnboardingMessages({
      isGuest: true,
      createMessageId: () => 'msg-1',
    })
    expect(messages).toHaveLength(2)
    expect(messages[0].onboardingKind).toBe('setup')
    expect(messages[1].onboardingKind).toBe('account')
  })

  it('已登录用户仅展示设置引导', () => {
    const messages = createAiOnboardingMessages({
      isGuest: false,
      createMessageId: () => 'msg-1',
    })
    expect(messages).toHaveLength(1)
    expect(messages[0].onboardingKind).toBe('setup')
  })

  it('markAiAssistantOnboardingDone 后不再展示', () => {
    markAiAssistantOnboardingDone()
    expect(isAiAssistantOnboardingPending()).toBe(false)
    expect(shouldShowAiAssistantOnboarding()).toBe(false)
  })
})
