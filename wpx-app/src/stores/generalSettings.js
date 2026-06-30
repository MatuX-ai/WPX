import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  EDITOR_FONT_SIZE_PX,
  createDefaultGeneralSettings,
  mergeGeneralSettings,
  normalizeGeneralPreferences,
} from '@/constants/generalPreferences'
import { usePreferencesStore } from '@/stores/preferences'
import { useThemeStore } from '@/stores/theme'
import { getElectronAPI, isElectron } from '@/utils/electron'

const STORAGE_KEY = 'wpx-general-settings'

/** @returns {ReturnType<typeof normalizeGeneralPreferences> | null} */
function loadFromLocalStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    return normalizeGeneralPreferences(parsed)
  } catch {
    return null
  }
}

/** @param {ReturnType<typeof normalizeGeneralPreferences>} settings */
function persistToLocalStorage(settings) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: settings.theme,
        language: settings.language,
        general: mergeGeneralSettings({}, settings),
      }),
    )
  } catch (error) {
    console.warn('[generalSettings] Failed to persist settings:', error)
  }
}

function applySideEffectsToDocument(settings) {
  if (typeof document === 'undefined') return

  const themeStore = useThemeStore()
  themeStore.setTheme(settings.theme)

  document.documentElement.lang = settings.language === 'en-US' ? 'en' : 'zh-CN'
  document.documentElement.style.setProperty(
    '--wpx-editor-base-font-size',
    EDITOR_FONT_SIZE_PX[settings.editorFontSize] || EDITOR_FONT_SIZE_PX.medium,
  )
}

export const useGeneralSettingsStore = defineStore('generalSettings', () => {
  const data = ref(normalizeGeneralPreferences({ general: createDefaultGeneralSettings() }))
  const hydrated = ref(false)

  const theme = computed(() => data.value.theme)
  const language = computed(() => data.value.language)
  const defaultSavePath = computed(() => data.value.defaultSavePath)
  const knowledgeBasePath = computed(() => data.value.knowledgeBasePath || '')
  const autoSaveEnabled = computed(() => data.value.autoSave.enabled)
  const autoSaveIntervalMs = computed(() => data.value.autoSave.intervalMs)
  const editorFontSize = computed(() => data.value.editorFontSize)
  const startupBehavior = computed(() => data.value.startupBehavior)
  const editorFontSizePx = computed(
    () => EDITOR_FONT_SIZE_PX[data.value.editorFontSize] || EDITOR_FONT_SIZE_PX.medium,
  )

  async function updateKnowledgeBasePath(path) {
    return updateSettings({ knowledgeBasePath: String(path || '') })
  }

  function applySideEffects() {
    applySideEffectsToDocument(data.value)
  }

  /**
   * @param {Parameters<typeof normalizeGeneralPreferences>[0]} prefs
   * @param {{ applyEffects?: boolean }} [options]
   */
  function hydrateFromPreferences(prefs, options = {}) {
    const { applyEffects = true } = options
    if (!prefs || typeof prefs !== 'object') return

    data.value = normalizeGeneralPreferences(prefs)
    hydrated.value = true

    if (applyEffects) {
      applySideEffects()
    }
  }

  function initFromLocalStorage() {
    const stored = loadFromLocalStorage()
    if (stored) {
      data.value = stored
      hydrated.value = true
      applySideEffects()
    }
  }

  async function persistSettings() {
    const snapshot = normalizeGeneralPreferences({
      theme: data.value.theme,
      language: data.value.language,
      general: mergeGeneralSettings({}, data.value),
    })
    data.value = snapshot

    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences(
      {
        theme: snapshot.theme,
        language: snapshot.language,
        general: mergeGeneralSettings({}, snapshot),
      },
      { syncLegacy: false },
    )

    applySideEffects()

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        const generalSnapshot = mergeGeneralSettings({}, snapshot)
        // 同时镜像写入顶层 libraryRootPath，以兼容 Electron 端
        // knowledge-service.js 的读取路径（双重读取已实现，这里只保证一致性）。
        await api.preferences.set({
          theme: snapshot.theme,
          language: snapshot.language,
          general: generalSnapshot,
          libraryRootPath: generalSnapshot.knowledgeBasePath || '',
        })
      }
    } else {
      persistToLocalStorage(snapshot)
    }

    return snapshot
  }

  /**
   * @param {Partial<ReturnType<typeof normalizeGeneralPreferences>>} partial
   */
  async function updateSettings(partial) {
    if (!partial || typeof partial !== 'object') return data.value

    const nextGeneral = mergeGeneralSettings(data.value, partial)
    data.value = normalizeGeneralPreferences({
      theme: partial.theme ?? data.value.theme,
      language: partial.language ?? data.value.language,
      general: nextGeneral,
    })

    return persistSettings()
  }

  return {
    data,
    hydrated,
    theme,
    language,
    defaultSavePath,
    knowledgeBasePath,
    autoSaveEnabled,
    autoSaveIntervalMs,
    editorFontSize,
    editorFontSizePx,
    startupBehavior,
    updateKnowledgeBasePath,
    applySideEffects,
    hydrateFromPreferences,
    initFromLocalStorage,
    updateSettings,
    persistSettings,
  }
})
