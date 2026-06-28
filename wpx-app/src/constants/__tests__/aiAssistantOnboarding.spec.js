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

  it('V1 完全免费模式：无论访客/登录，仅展示接入大模型 API 一条 setup 消息', () => {
    const guestMessages = createAiOnboardingMessages({
      createMessageId: () => 'msg-1',
    })
    expect(guestMessages).toHaveLength(1)
    expect(guestMessages[0].onboardingKind).toBe('setup')

    const userMessages = createAiOnboardingMessages({
      createMessageId: () => 'msg-1',
    })
    expect(userMessages).toHaveLength(1)
    expect(userMessages[0].onboardingKind).toBe('setup')
    // V1 不再提供 account 类型的引导消息
    expect(userMessages.find((m) => m.onboardingKind === 'account')).toBeUndefined()
  })

  it('markAiAssistantOnboardingDone 后不再展示', () => {
    markAiAssistantOnboardingDone()
    expect(isAiAssistantOnboardingPending()).toBe(false)
    expect(shouldShowAiAssistantOnboarding()).toBe(false)
  })
})
