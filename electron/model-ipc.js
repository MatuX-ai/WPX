const { ipcMain } = require('electron')
const {
  initModelSecretsStore,
  setApiKey,
  clearApiKey,
  getMaskedApiKey,
  getDecryptedApiKey,
  getAllMaskedApiKeys,
} = require('./services/model-secrets-store')

/**
 * @param {string} endpoint
 */
function buildModelsListUrl(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/$/, '')
  if (!trimmed) return ''

  if (trimmed.endsWith('/v1/models')) {
    return trimmed
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/models`
  }

  return `${trimmed}/v1/models`
}

/**
 * @param {{ endpoint: string, apiKey: string }} config
 */
async function requestModelsList(config) {
  const url = buildModelsListUrl(config.endpoint)
  const apiKey = String(config.apiKey || '').trim()

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

function registerModelIpcHandlers() {
  ipcMain.handle('models:api-key:set', (_event, payload = {}) => {
    const block = payload.block
    const apiKey = payload.apiKey
    return setApiKey(block, apiKey)
  })

  ipcMain.handle('models:api-key:clear', (_event, payload = {}) => {
    return clearApiKey(payload.block)
  })

  ipcMain.handle('models:api-key:get-masked', (_event, payload = {}) => {
    return getMaskedApiKey(payload.block)
  })

  ipcMain.handle('models:api-key:get-all-masked', () => {
    return getAllMaskedApiKeys()
  })

  ipcMain.handle('models:api-key:get-decrypted', (_event, payload = {}) => {
    return {
      apiKey: getDecryptedApiKey(payload.block),
    }
  })

  ipcMain.handle('models:test-connection', async (_event, payload = {}) => {
    const block = payload.block
    const endpoint = payload.endpoint
    const inputApiKey = String(payload.apiKey || '').trim()
    const apiKey = inputApiKey || getDecryptedApiKey(block)

    return requestModelsList({ endpoint, apiKey })
  })
}

async function initModelIpc() {
  await initModelSecretsStore()
  registerModelIpcHandlers()
}

module.exports = {
  initModelIpc,
  buildModelsListUrl,
  requestModelsList,
}
