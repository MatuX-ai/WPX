import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAiModelDisplayName } from '@/constants/aiModel'
import {
  createDefaultModelSettings,
  mergeModelSettings,
  normalizeModelEndpoint,
  PLATFORM_TEXT_MODEL,
  PLATFORM_VISION_MODEL,
} from '@/constants/modelPreferences'
import { usePreferencesStore } from '@/stores/preferences'
import { useSettingsStore } from '@/stores/settings'
import { maskApiKey } from '@/utils/apiKeyMask'
import {
  decryptApiKey,
  encryptApiKey,
} from '@/utils/apiKeyCrypto'
import { getElectronAPI, isElectron } from '@/utils/electron'

const STORAGE_KEY = 'wpx-model-settings'
const WEB_SECRETS_KEY = 'wpx-model-secrets-web'

/** @type {{ text: string, vision: string }} */
const webApiKeys = {
  text: '',
  vision: '',
}

/** @returns {ReturnType<typeof createDefaultModelSettings>} */
export function stripApiKeysFromModelSettings(settings) {
  const next = mergeModelSettings({}, settings)
  delete next.text.custom.apiKeyEnc
  delete next.vision.custom.apiKeyEnc
  return next
}

/** @returns {ReturnType<typeof createDefaultModelSettings> | null} */
function loadModelSettingsFromStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    return stripApiKeysFromModelSettings(parsed)
  } catch {
    return null
  }
}

/** @param {ReturnType<typeof createDefaultModelSettings>} settings */
function persistModelSettingsToStorage(settings) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripApiKeysFromModelSettings(settings)))
  } catch (error) {
    console.warn('[modelSettings] Failed to persist model settings:', error)
  }
}

async function hydrateWebApiKeys() {
  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem(WEB_SECRETS_KEY)
    if (!raw) {
      webApiKeys.text = ''
      webApiKeys.vision = ''
      return
    }

    const parsed = JSON.parse(raw)
    webApiKeys.text = parsed?.text ? await decryptApiKey(parsed.text) : ''
    webApiKeys.vision = parsed?.vision ? await decryptApiKey(parsed.vision) : ''
  } catch {
    webApiKeys.text = ''
    webApiKeys.vision = ''
  }
}

async function persistWebApiKeys() {
  if (typeof localStorage === 'undefined') return

  const payload = {}
  if (webApiKeys.text) {
    payload.text = await encryptApiKey(webApiKeys.text)
  }
  if (webApiKeys.vision) {
    payload.vision = await encryptApiKey(webApiKeys.vision)
  }

  if (Object.keys(payload).length === 0) {
    localStorage.removeItem(WEB_SECRETS_KEY)
    return
  }

  localStorage.setItem(WEB_SECRETS_KEY, JSON.stringify(payload))
}

async function loadRawModelSettingsFromStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export const useModelSettingsStore = defineStore('modelSettings', () => {
  const data = ref(createDefaultModelSettings())
  const hydrated = ref(false)
  const configVersion = ref(0)
  const textPlatformFallback = ref(false)

  const maskedTextApiKey = ref('')
  const maskedVisionApiKey = ref('')
  const hasStoredTextApiKey = ref(false)
  const hasStoredVisionApiKey = ref(false)

  async function refreshMaskedApiKeys() {
    if (isElectron()) {
      const api = getElectronAPI()?.models
      if (!api?.getAllMasked) return

      const masked = await api.getAllMasked()
      maskedTextApiKey.value = masked?.text?.masked || ''
      maskedVisionApiKey.value = masked?.vision?.masked || ''
      hasStoredTextApiKey.value = Boolean(masked?.text?.hasKey)
      hasStoredVisionApiKey.value = Boolean(masked?.vision?.hasKey)
      return
    }

    hasStoredTextApiKey.value = Boolean(webApiKeys.text)
    hasStoredVisionApiKey.value = Boolean(webApiKeys.vision)
    maskedTextApiKey.value = maskApiKey(webApiKeys.text)
    maskedVisionApiKey.value = maskApiKey(webApiKeys.vision)
  }

  async function migrateLegacyWebApiKeys(rawStored) {
    if (!rawStored) return

    let migrated = false

    if (rawStored.text?.custom?.apiKeyEnc) {
      webApiKeys.text = await decryptApiKey(rawStored.text.custom.apiKeyEnc)
      migrated = true
    }

    if (rawStored.vision?.custom?.apiKeyEnc) {
      webApiKeys.vision = await decryptApiKey(rawStored.vision.custom.apiKeyEnc)
      migrated = true
    }

    if (migrated) {
      await persistWebApiKeys()
    }
  }

  async function migrateLegacyApiKeysToMain(rawStored) {
    if (!isElectron() || !rawStored) return

    const api = getElectronAPI()?.models
    if (!api?.setApiKey) return

    if (rawStored.text?.custom?.apiKeyEnc) {
      const plain = await decryptApiKey(rawStored.text.custom.apiKeyEnc)
      if (plain) {
        await api.setApiKey({ block: 'text', apiKey: plain })
      }
    }

    if (rawStored.vision?.custom?.apiKeyEnc) {
      const plain = await decryptApiKey(rawStored.vision.custom.apiKeyEnc)
      if (plain) {
        await api.setApiKey({ block: 'vision', apiKey: plain })
      }
    }
  }

  async function initFromLocalStorage() {
    const rawStored = await loadRawModelSettingsFromStorage()
    const stored = rawStored ? stripApiKeysFromModelSettings(rawStored) : null

    if (stored) {
      data.value = stored
    }

    if (isElectron()) {
      await migrateLegacyApiKeysToMain(rawStored)
    } else {
      await migrateLegacyWebApiKeys(rawStored)
      await hydrateWebApiKeys()
    }

    await refreshMaskedApiKeys()
    hydrated.value = true
  }

  function hydrateFromPreferences(partial) {
    if (!partial || typeof partial !== 'object') return

    data.value = stripApiKeysFromModelSettings(mergeModelSettings(data.value, partial))
    hydrated.value = true

    void refreshMaskedApiKeys().then(() => {
      configVersion.value += 1
    })
  }

  async function resolveTextApiKey() {
    if (data.value.text.source !== 'custom' || textPlatformFallback.value) {
      return ''
    }

    if (isElectron()) {
      const api = getElectronAPI()?.models
      if (!api?.getDecryptedApiKey) return ''
      const result = await api.getDecryptedApiKey({ block: 'text' })
      return result?.apiKey || ''
    }

    return webApiKeys.text
  }

  async function resolveVisionApiKey() {
    if (data.value.vision.source !== 'custom') {
      return ''
    }

    if (isElectron()) {
      const api = getElectronAPI()?.models
      if (!api?.getDecryptedApiKey) return ''
      const result = await api.getDecryptedApiKey({ block: 'vision' })
      return result?.apiKey || ''
    }

    return webApiKeys.vision
  }

  async function ensureTextCredentials() {
    if (data.value.text.source === 'custom' && !textPlatformFallback.value) {
      await resolveTextApiKey()
    }
  }

  const usesCustomModel = computed(
    () => data.value.text.source === 'custom' || data.value.vision.source === 'custom',
  )

  const parameters = computed(() => data.value.parameters)

  const effectiveTextConfig = computed(() => {
    const params = data.value.parameters

    if (data.value.text.source === 'custom' && !textPlatformFallback.value) {
      const custom = data.value.text.custom
      return {
        source: 'custom',
        apiKey: isElectron() ? undefined : webApiKeys.text,
        baseUrl: normalizeModelEndpoint(custom.endpoint),
        model: custom.modelName || PLATFORM_TEXT_MODEL,
        temperature: params.temperature,
        topP: params.topP,
        maxOutputTokens: params.maxOutputTokens,
        displayName: custom.modelName || '自定义文本模型',
      }
    }

    const settingsStore = useSettingsStore()
    return {
      source: 'platform',
      apiKey: settingsStore.effectiveApiKey,
      baseUrl: settingsStore.effectiveBaseUrl,
      model: settingsStore.model || PLATFORM_TEXT_MODEL,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      displayName: getAiModelDisplayName(settingsStore.model),
    }
  })

  const effectiveVisionConfig = computed(() => {
    const params = data.value.parameters

    if (data.value.vision.source === 'custom') {
      const custom = data.value.vision.custom
      return {
        source: 'custom',
        apiKey: isElectron() ? undefined : webApiKeys.vision,
        baseUrl: normalizeModelEndpoint(custom.endpoint),
        model: custom.modelName || PLATFORM_VISION_MODEL,
        temperature: params.temperature,
        topP: params.topP,
        maxOutputTokens: params.maxOutputTokens,
        displayName: custom.modelName || '自定义图片模型',
      }
    }

    const settingsStore = useSettingsStore()
    return {
      source: 'platform',
      apiKey: settingsStore.effectiveApiKey,
      baseUrl: settingsStore.effectiveBaseUrl,
      model: PLATFORM_VISION_MODEL,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      displayName: 'WPX 图片模型',
    }
  })

  /**
   * @param {{
   *   text?: Partial<typeof data.value.text>,
   *   vision?: Partial<typeof data.value.vision>,
   *   parameters?: Partial<typeof data.value.parameters>,
   *   textApiKey?: string,
   *   visionApiKey?: string,
   * }} payload
   */
  async function saveSettings(payload) {
    const next = stripApiKeysFromModelSettings(
      mergeModelSettings(data.value, {
        text: payload.text,
        vision: payload.vision,
        parameters: payload.parameters,
      }),
    )

    const textApiKeyInput = String(payload.textApiKey ?? '').trim()
    const visionApiKeyInput = String(payload.visionApiKey ?? '').trim()

    if (isElectron()) {
      const api = getElectronAPI()?.models
      if (textApiKeyInput && api?.setApiKey) {
        await api.setApiKey({ block: 'text', apiKey: textApiKeyInput })
      }
      if (visionApiKeyInput && api?.setApiKey) {
        await api.setApiKey({ block: 'vision', apiKey: visionApiKeyInput })
      }
    } else {
      if (textApiKeyInput) {
        webApiKeys.text = textApiKeyInput
      }
      if (visionApiKeyInput) {
        webApiKeys.vision = visionApiKeyInput
      }
      await persistWebApiKeys()
    }

    data.value = next
    textPlatformFallback.value = false
    persistModelSettingsToStorage(next)

    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({ models: next }, { syncLegacy: false })

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        await api.preferences.set({ models: next })
      }
    }

    await refreshMaskedApiKeys()
    configVersion.value += 1
    return next
  }

  function activateTextPlatformFallback() {
    if (textPlatformFallback.value) return false
    textPlatformFallback.value = true
    configVersion.value += 1
    return true
  }

  /**
   * @param {'text' | 'vision'} block
   */
  async function getApiKeyForUse(block) {
    if (block === 'text') {
      return resolveTextApiKey()
    }
    return resolveVisionApiKey()
  }

  return {
    data,
    hydrated,
    configVersion,
    textPlatformFallback,
    maskedTextApiKey,
    maskedVisionApiKey,
    hasStoredTextApiKey,
    hasStoredVisionApiKey,
    usesCustomModel,
    parameters,
    effectiveTextConfig,
    effectiveVisionConfig,
    initFromLocalStorage,
    hydrateFromPreferences,
    saveSettings,
    refreshMaskedApiKeys,
    ensureTextCredentials,
    resolveTextApiKey,
    getApiKeyForUse,
    activateTextPlatformFallback,
  }
})
