import { defineStore } from 'pinia'
import { ref } from 'vue'

export const STORAGE_KEY = 'wpx-library-preferences'
const MAX_PATH_CORRECTIONS = 200

function createDefaultState() {
  return {
    version: 1,
    pathCorrections: [],
  }
}

function loadFromStorage() {
  if (typeof localStorage === 'undefined') {
    return createDefaultState()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()

    const parsed = JSON.parse(raw)
    return {
      version: parsed.version ?? 1,
      pathCorrections: Array.isArray(parsed.pathCorrections) ? parsed.pathCorrections : [],
    }
  } catch {
    return createDefaultState()
  }
}

function persistToStorage(state) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[library] Failed to persist preferences:', error)
  }
}

export const useLibraryStore = defineStore('library', () => {
  const data = ref(loadFromStorage())

  function persist() {
    persistToStorage(data.value)
  }

  function recordPathCorrection({ suggestedPath, chosenPath, title, tags = [] }) {
    const suggested = String(suggestedPath || '').trim()
    const chosen = String(chosenPath || '').trim()
    if (!suggested || !chosen || suggested === chosen) return

    data.value.pathCorrections.unshift({
      suggestedPath: suggested,
      chosenPath: chosen,
      title: String(title || '').trim(),
      tags: Array.isArray(tags) ? tags : [],
      recordedAt: new Date().toISOString(),
    })

    if (data.value.pathCorrections.length > MAX_PATH_CORRECTIONS) {
      data.value.pathCorrections.length = MAX_PATH_CORRECTIONS
    }

    persist()
  }

  function getPathCorrections() {
    return data.value.pathCorrections
  }

  function resetPathCorrections() {
    data.value.pathCorrections = []
    persist()
  }

  return {
    data,
    recordPathCorrection,
    getPathCorrections,
    resetPathCorrections,
  }
})
