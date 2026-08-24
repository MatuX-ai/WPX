import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { maskApiKey } from '@/utils/apiKeyMask'
import { testModelConnection } from '@/utils/modelApi'

vi.mock('@/utils/electron', () => ({
  isElectron: vi.fn(() => false),
  getElectronAPI: vi.fn(() => null),
}))

describe('modelSettings — 仅用户自定义模型（无平台模型/免费额度）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('默认配置即使用自定义模型，source 恒为 custom', () => {
    const store = useModelSettingsStore()
    expect(store.effectiveTextConfig.source).toBe('custom')
    expect(store.effectiveVisionConfig.source).toBe('custom')
  })

  it('历史持久化的 platform source 不再生效，始终使用自定义模型配置', () => {
    const store = useModelSettingsStore()
    store.data.text.source = 'platform'
    store.data.vision.source = 'platform'
    expect(store.effectiveTextConfig.source).toBe('custom')
    expect(store.effectiveVisionConfig.source).toBe('custom')
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
