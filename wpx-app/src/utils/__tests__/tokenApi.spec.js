import { describe, it, expect } from 'vitest'
import { TOKENS_PER_YUAN, calcTokenCount, PRESET_RECHARGE_AMOUNT } from '@/utils/tokenApi'

describe('Token 充值换算', () => {
  it('8. 充值 10 元包对应 200 Token', () => {
    expect(PRESET_RECHARGE_AMOUNT).toBe(10)
    expect(TOKENS_PER_YUAN).toBe(20)
    expect(calcTokenCount(10)).toBe(200)
  })

  it('9. 自定义充值 30 元对应 600 Token', () => {
    expect(calcTokenCount(30)).toBe(600)
  })
})
