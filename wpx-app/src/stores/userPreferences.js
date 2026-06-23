import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createDefaultAgentSettings,
  mergeAgentSettings,
} from '@/constants/agentPreferences'
import { usePreferencesStore } from '@/stores/preferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

const STORAGE_KEY = 'wpx-user-preferences'

function loadAgentFromLocalStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.agent || typeof parsed.agent !== 'object') return null

    return mergeAgentSettings({}, parsed.agent)
  } catch {
    return null
  }
}

function persistAgentToLocalStorage(agent) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ agent }))
  } catch (error) {
    console.warn('[userPreferences] Failed to persist agent settings:', error)
  }
}

export const useUserPreferencesStore = defineStore('userPreferences', () => {
  const agent = ref(createDefaultAgentSettings())
  const hydrated = ref(false)

  function hydrateFromPreferences(partial) {
    if (!partial || typeof partial !== 'object') return

    agent.value = mergeAgentSettings({}, partial)
    hydrated.value = true
  }

  function initFromLocalStorage() {
    const stored = loadAgentFromLocalStorage()
    if (stored) {
      agent.value = stored
      hydrated.value = true
    }
  }

  async function persistAgent() {
    const payload = mergeAgentSettings({}, agent.value)
    agent.value = payload

    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({ agent: payload }, { syncLegacy: false })

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        await api.preferences.set({ agent: payload })
      }
    } else {
      persistAgentToLocalStorage(payload)
    }

    return payload
  }

  async function saveAgent(partial) {
    agent.value = mergeAgentSettings(agent.value, partial)
    return persistAgent()
  }

  async function resetAgentToDefaults() {
    agent.value = createDefaultAgentSettings()
    return persistAgent()
  }

  return {
    agent,
    hydrated,
    hydrateFromPreferences,
    initFromLocalStorage,
    saveAgent,
    resetAgentToDefaults,
    persistAgent,
  }
})
