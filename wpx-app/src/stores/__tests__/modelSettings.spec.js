import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { maskApiKey } from '@/utils/apiKeyMask'
import { testModelConnection } from '@/utils/modelApi'

vi.mock('@/utils/electron', () => ({
  isElectron: vi.fn(() => false),
  getElectronAPI: vi.fn(() => null),
}))

describe('modelSettings — 自定义 API Key 与回退', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('自定义模型失败时激活平台回退', () => {
    const store = useModelSettingsStore()
    store.data.text.source = 'custom'
    expect(store.textPlatformFallback).toBe(false)

    const activated = store.activateTextPlatformFallback()
    expect(activated).toBe(true)
    expect(store.textPlatformFallback).toBe(true)
    expect(store.effectiveTextConfig.source).toBe('platform')
  })

  it('已回退后不会重复激活', () => {
    const store = useModelSettingsStore()
    store.activateTextPlatformFallback()
    expect(store.activateTextPlatformFallback()).toBe(false)
  })

  it('API Key 掩码后不暴露完整密钥', () => {
    const key = 'sk-abcdefghijklmnopqrstuvwxyz123456'
    const masked = maskApiKey(key)

    expect(masked).not.toBe(key)
    expect(masked.startsWith('sk-a')).toBe(true)
    expect(masked.endsWith('3456')).toBe(true)
    expect(masked).toContain('•')
  })

  it('重新加载后 store 不含 apiKeyEnc 明文', async () => {
    const store = useModelSettingsStore()
    await store.saveSettings({
      text: {
        source: 'custom',
        custom: {
          endpoint: 'https://api.deepseek.com/v1',
          modelName: 'deepseek-chat',
        },
      },
      textApiKey: 'sk-test-key-12345678',
    })

    const raw = JSON.parse(localStorage.getItem('wpx-model-settings') || '{}')
    expect(raw.text?.custom?.apiKeyEnc).toBeUndefined()
  })
})

describe('testModelConnection — Web 环境', () => {
  it('有效 Key 时连接成功', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const result = await testModelConnection({
      endpoint: 'https://api.deepseek.com/v1',
      apiKey: 'sk-valid-key',
    })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('连接成功')
  })

  it('错误 Key 时连接失败', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    })

    await expect(
      testModelConnection({
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'sk-invalid',
      }),
    ).rejects.toThrow(/Invalid API Key|连接失败/)
  })
})
