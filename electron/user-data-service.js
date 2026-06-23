const { BrowserWindow, ipcMain } = require('electron')

const DEFAULT_PREFERENCES = {
  version: 1,
  theme: 'system',
  language: 'zh-CN',
  defaultFont: {
    family: 'system-ui',
    size: 16,
    lineHeight: 1.6,
  },
  ai: {
    apiKey: '',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    useProxy: false,
    avatarId: 'robot',
  },
  agent: {
    assistantName: 'WPX 助手',
    identityDescription: '全能的写作伙伴',
    toneStyle: 'formal',
    customTone: '',
    domains: ['all'],
    replyLength: 'standard',
    languagePreference: 'zh',
  },
  models: {
    text: {
      source: 'platform',
      custom: {
        endpoint: 'https://api.deepseek.com/v1',
        modelName: 'deepseek-chat',
      },
    },
    vision: {
      source: 'platform',
      custom: {
        endpoint: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
      },
    },
    parameters: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 4096,
    },
  },
  general: {
    defaultSavePath: '',
    autoSave: {
      enabled: true,
      intervalMs: 30000,
    },
    editorFontSize: 'medium',
    startupBehavior: 'restore-last',
  },
  libraryRootPath: '',
  fileAssociationsEnabled: true,
}

/** @type {import('electron-store').default | null} */
let preferencesStore = null

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(target, source) {
  const output = { ...target }

  if (!isPlainObject(source)) {
    return output
  }

  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value)
    } else if (value !== undefined) {
      output[key] = value
    }
  }

  return output
}

function sanitizeModelSettings(models) {
  if (!isPlainObject(models)) return models

  const output = { ...models }

  if (isPlainObject(output.text?.custom)) {
    output.text = {
      ...output.text,
      custom: { ...output.text.custom },
    }
    delete output.text.custom.apiKeyEnc
  }

  if (isPlainObject(output.vision?.custom)) {
    output.vision = {
      ...output.vision,
      custom: { ...output.vision.custom },
    }
    delete output.vision.custom.apiKeyEnc
  }

  return output
}

function sanitizePreferences(preferences) {
  if (!isPlainObject(preferences)) return preferences

  const output = { ...preferences }
  if (output.models) {
    output.models = sanitizeModelSettings(output.models)
  }
  return output
}

function getPreferences() {
  if (!preferencesStore) {
    return sanitizePreferences(deepMerge({}, DEFAULT_PREFERENCES))
  }

  return sanitizePreferences(deepMerge(DEFAULT_PREFERENCES, preferencesStore.store))
}

function setPreferences(partial) {
  if (!preferencesStore) {
    throw new Error('[user-data-service] Service not initialized')
  }

  if (!partial || typeof partial !== 'object') {
    return getPreferences()
  }

  const next = deepMerge(getPreferences(), partial)
  if (next.models) {
    next.models = sanitizeModelSettings(next.models)
  }

  for (const [key, value] of Object.entries(next)) {
    preferencesStore.set(key, value)
  }

  return next
}

function broadcastPreferencesChanged(preferences) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send('data:preferences:changed', preferences)
  }
}

function registerPreferenceIpcHandlers() {
  ipcMain.handle('data:preferences:get', () => getPreferences())

  ipcMain.handle('data:preferences:set', (_event, partial) => {
    const next = setPreferences(partial)
    broadcastPreferencesChanged(next)
    return next
  })
}

async function initUserDataService() {
  if (preferencesStore) return

  const { default: Store } = await import('electron-store')
  preferencesStore = new Store({
    name: 'preferences',
    defaults: DEFAULT_PREFERENCES,
  })

  registerPreferenceIpcHandlers()
}

module.exports = {
  DEFAULT_PREFERENCES,
  initUserDataService,
  getPreferences,
  setPreferences,
  broadcastPreferencesChanged,
}
