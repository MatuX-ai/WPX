import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_AVATAR_ID } from '@/constants/aiAvatars'
import { createDefaultModelSettings } from '@/constants/modelPreferences'
import { createDefaultAgentSettings } from '@/constants/agentPreferences'
import { createDefaultPaperSettings } from '@/constants/paperPreferences'
import { createDefaultGeneralSettings } from '@/constants/generalPreferences'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'

/**
 * @typedef {ReturnType<typeof createDefaultPreferences>} WpxPreferences
 */

export function createDefaultPreferences() {
  return {
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
      baseUrl: DEFAULT_BASE_URL,
      useProxy: false,
      avatarId: DEFAULT_AVATAR_ID,
    },
    agent: createDefaultAgentSettings(),
    paper: createDefaultPaperSettings(),
    models: createDefaultModelSettings(),
    general: createDefaultGeneralSettings(),
    libraryRootPath: '',
    fileAssociationsEnabled: true,
  }
}

function mergePreferences(current, partial) {
  const base = createDefaultPreferences()
  const merged = deepMerge(deepMerge(base, current), partial)
  return merged
}

function deepMerge(target, source) {
  const output = { ...target }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return output
  }

  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof output[key] === 'object' &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value)
    } else if (value !== undefined) {
      output[key] = value
    }
  }

  return output
}

export const usePreferencesStore = defineStore('preferences', () => {
  const data = ref(createDefaultPreferences())
  const hydratedFromElectron = ref(false)

  function syncToLegacyStores(preferences) {
    const themeStore = useThemeStore()
    const settingsStore = useSettingsStore()

    if (preferences.theme) {
      themeStore.setTheme(preferences.theme)
    }

    settingsStore.update({
      apiKey: preferences.ai?.apiKey ?? '',
      model: preferences.ai?.model ?? 'deepseek-chat',
      baseUrl: preferences.ai?.baseUrl ?? DEFAULT_BASE_URL,
      useAiProxy: Boolean(preferences.ai?.useProxy),
      avatarId: preferences.ai?.avatarId ?? DEFAULT_AVATAR_ID,
      libraryRootPath: preferences.libraryRootPath ?? '',
      fileAssociationsEnabled: preferences.fileAssociationsEnabled !== false,
    })
  }

  /**
   * @param {ReturnType<typeof createDefaultPreferences>} partial
   * @param {{ syncLegacy?: boolean }} [options]
   */
  function applyPreferences(partial, options = {}) {
    const { syncLegacy = true } = options
    if (!partial || typeof partial !== 'object') return

    data.value = mergePreferences(data.value, partial)

    if (syncLegacy) {
      syncToLegacyStores(data.value)
    }

    hydratedFromElectron.value = true
  }

  return {
    data,
    hydratedFromElectron,
    applyPreferences,
    syncToLegacyStores,
  }
})
