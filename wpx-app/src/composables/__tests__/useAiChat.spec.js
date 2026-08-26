/**
 * useAiChat.spec.js —— AI 助理发送链路辅助函数测试
 *
 * 重点覆盖 normalizeModelErrorForDisplay：
 * 未配置/配置错误类错误必须映射为「去配置大模型」的友好提醒（带 needsModelConfig），
 * 避免发送后无声失败；未知错误保留原文。
 */
import { describe, it, expect } from 'vitest'
import { normalizeModelErrorForDisplay } from '@/composables/useAiChat'

describe('normalizeModelErrorForDisplay', () => {
  it('API Key 无效/认证失败 → 提示配置 API Key 并标记 needsModelConfig', () => {
    for (const msg of [
      'Authentication Fails, Your api key: sk-xxx is invalid. Please check your api key.',
      'Invalid API key',
      '401 Unauthorized',
      'invalid_api_key',
      '认证失败：密钥无效',
    ]) {
      const result = normalizeModelErrorForDisplay({ message: msg })
      expect(result.needsModelConfig).toBe(true)
      expect(result.suggestConfigure).toBe(true)
      expect(result.content).toContain('API Key')
    }
  })

  it('模型名错误 → 提示核对模型名并标记 needsModelConfig', () => {
    for (const msg of [
      'Model Not Exist',
      'Model not found',
      'invalid model: deepseek',
      '模型不存在',
      'The supported API model names are deepseek-v4-pro, deepseek-v4-flash, and deepseek-v4-flash-vision-exp, but you passed deepseek.',
    ]) {
      const result = normalizeModelErrorForDisplay({ message: msg })
      expect(result.needsModelConfig).toBe(true)
      expect(result.content).toContain('模型名称')
    }
  })

  it('SDK 脱敏文案不再误判为网络失败', () => {
    const result = normalizeModelErrorForDisplay({ message: 'An error occurred.' })
    expect(result.needsModelConfig).toBe(true)
    expect(result.content).not.toContain('无法连接到模型服务')
    expect(result.content).toMatch(/模型名称|接口地址/)
  })

  it('嵌套 cause 中的模型名错误可被识别', () => {
    const result = normalizeModelErrorForDisplay({
      message: 'An error occurred.',
      cause: {
        message:
          'The supported API model names are deepseek-v4-pro, deepseek-v4-flash, and deepseek-v4-flash-vision-exp, but you passed deepseek.',
      },
    })
    expect(result.needsModelConfig).toBe(true)
    expect(result.content).toContain('模型名称')
    expect(result.content).toMatch(/deepseek-v4/)
  })

  it('网络/连接类错误 → 提示检查网络与接口地址', () => {
    for (const msg of [
      'fetch failed',
      'Failed to fetch',
      'ECONNREFUSED 127.0.0.1:8642',
      'getaddrinfo ENOTFOUND api.deepseek.com',
      'network timeout',
    ]) {
      const result = normalizeModelErrorForDisplay({ message: msg })
      expect(result.needsModelConfig).toBe(true)
      expect(result.content).toContain('无法连接到模型服务')
    }
  })

  it('未知错误保留原始信息且不标记配置按钮', () => {
    const result = normalizeModelErrorForDisplay({ message: 'rate limit exceeded' })
    expect(result.needsModelConfig).toBeUndefined()
    expect(result.suggestConfigure).toBeUndefined()
    expect(result.content).toContain('rate limit exceeded')
  })

  it('空/无 message 时兜底为未知错误', () => {
    const result = normalizeModelErrorForDisplay(undefined)
    expect(result.content).toContain('未知错误')
  })
})
