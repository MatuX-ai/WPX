import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { BUILT_IN_SKILLS } from '@/data/skills'
import { usePreferencesStore } from '@/stores/preferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

const STORAGE_KEY = 'wpx-skills-enabled'

export { STORAGE_KEY as SKILLS_STORAGE_KEY }

/** @returns {Record<string, boolean>} */
export function createDefaultSkillsEnabledMap() {
  return Object.fromEntries(BUILT_IN_SKILLS.map((skill) => [skill.id, true]))
}

/** @returns {Record<string, boolean> | null} */
function loadSkillsEnabledFromStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    return parsed
  } catch {
    return null
  }
}

/** @param {Record<string, boolean>} enabledById */
function persistSkillsEnabledToStorage(enabledById) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledById))
  } catch (error) {
    console.warn('[skills] Failed to persist enabled state:', error)
  }
}

export const useSkillsStore = defineStore('skills', () => {
  const enabledById = ref(createDefaultSkillsEnabledMap())
  const hydrated = ref(false)

  function initFromLocalStorage() {
    const stored = loadSkillsEnabledFromStorage()
    if (stored) {
      enabledById.value = {
        ...createDefaultSkillsEnabledMap(),
        ...stored,
      }
    }
    hydrated.value = true
  }

  function isSkillEnabled(skillId) {
    if (!(skillId in enabledById.value)) return true
    return enabledById.value[skillId] !== false
  }

  function setSkillEnabled(skillId, enabled) {
    if (!BUILT_IN_SKILLS.some((skill) => skill.id === skillId)) return

    enabledById.value = {
      ...enabledById.value,
      [skillId]: Boolean(enabled),
    }
    void persistSkillsState()
  }

  const enabledSkills = computed(() =>
    BUILT_IN_SKILLS.filter((skill) => isSkillEnabled(skill.id)),
  )

  const skillsWithState = computed(() =>
    BUILT_IN_SKILLS.map((skill) => ({
      ...skill,
      enabled: isSkillEnabled(skill.id),
    })),
  )

  async function persistSkillsState() {
    persistSkillsEnabledToStorage(enabledById.value)

    const payload = { ...enabledById.value }
    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({ skills: payload }, { syncLegacy: false })

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        await api.preferences.set({ skills: payload })
      }
    }
  }

  function applyEnabledMap(map, options = {}) {
    const { persist = true } = options
    if (!map || typeof map !== 'object' || Array.isArray(map)) return

    enabledById.value = {
      ...createDefaultSkillsEnabledMap(),
      ...map,
    }
    hydrated.value = true

    if (persist) {
      void persistSkillsState()
    } else {
      persistSkillsEnabledToStorage(enabledById.value)
    }
  }

  return {
    enabledById,
    hydrated,
    initFromLocalStorage,
    isSkillEnabled,
    setSkillEnabled,
    applyEnabledMap,
    persistSkillsState,
    enabledSkills,
    skillsWithState,
  }
})
