import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateTokensFromText,
  formatTokenAmount,
  resolveUsageTokens,
} from '@/utils/freeQuota'

describe('freeQuota — Token 计量', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolveUsageTokens 优先使用 totalTokens', () => {
    expect(resolveUsageTokens({ totalTokens: 128 })).toBe(128)
    expect(resolveUsageTokens({ total_tokens: 64 })).toBe(64)
  })

  it('resolveUsageTokens 可回退到 input + output', () => {
    expect(resolveUsageTokens({ inputTokens: 30, outputTokens: 20 })).toBe(50)
  })

  it('无 usage 时按文本估算 Token', () => {
    expect(resolveUsageTokens(null, { fallbackText: 'abcd' })).toBe(2)
    expect(resolveUsageTokens(undefined, { fallbackText: '' })).toBe(1)
  })

  it('formatTokenAmount 格式化大数', () => {
    expect(formatTokenAmount(100_000_000)).toBe('100M')
    expect(formatTokenAmount(1_500)).toBe('1.5K')
    expect(formatTokenAmount(42)).toBe('42')
  })
})
