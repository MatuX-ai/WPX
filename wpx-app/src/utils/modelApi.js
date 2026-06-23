import { buildModelsListUrl, normalizeModelEndpoint } from '@/constants/modelPreferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

/**
 * @param {{ block?: 'text' | 'vision', endpoint: string, apiKey?: string, modelName?: string }} config
 */
export async function testModelConnection(config) {
  const endpoint = normalizeModelEndpoint(config.endpoint)
  const apiKey = String(config.apiKey || '').trim()

  if (isElectron()) {
    const api = getElectronAPI()?.models
    if (!api?.testConnection) {
      throw new Error('当前环境不支持模型连接测试')
    }

    return api.testConnection({
      block: config.block || 'text',
      endpoint,
      apiKey: apiKey || undefined,
      modelName: config.modelName,
    })
  }

  const url = buildModelsListUrl(endpoint)
  if (!url) {
    throw new Error('请填写有效的 API 地址')
  }

  if (!apiKey) {
    throw new Error('请填写 API Key')
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (response.ok) {
    return { ok: true, message: '连接成功，模型服务可用' }
  }

  let errorMessage = `连接失败（HTTP ${response.status}）`

  try {
    const payload = await response.json()
    errorMessage = payload?.error?.message || payload?.message || payload?.error || errorMessage
  } catch {
    try {
      const text = await response.text()
      if (text) errorMessage = text.slice(0, 200)
    } catch {
      // ignore
    }
  }

  throw new Error(typeof errorMessage === 'string' ? errorMessage : '连接测试失败')
}
