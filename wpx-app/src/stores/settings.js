import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_AVATAR_ID, getAvatarUrlById } from '@/constants/aiAvatars'
import { STORAGE_KEY as LIBRARY_STORAGE_KEY } from '@/stores/library'
import { STORAGE_KEY as HABITS_STORAGE_KEY } from '@/stores/userHabits'

export const STORAGE_KEY = 'wpx-settings'

export const AI_MODEL_OPTIONS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat（通用对话）' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner（深度推理）' },
]

const DEFAULT_BASE_URL = 'https://api.deepseek.com'

function createDefaultState() {
  return {
    version: 1,
    apiKey: '',
    model: 'deepseek-chat',
    baseUrl: DEFAULT_BASE_URL,
    libraryRootPath: '',
    avatarId: DEFAULT_AVATAR_ID,
    useAiProxy: false,
    fileAssociationsEnabled: true,
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
    if (!parsed || typeof parsed !== 'object') return createDefaultState()

    return {
      ...createDefaultState(),
      ...parsed,
      version: parsed.version ?? 1,
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
    console.warn('[settings] Failed to persist settings:', error)
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const data = ref(loadFromStorage())

  const apiKey = computed({
    get: () => data.value.apiKey,
    set: (value) => {
      data.value.apiKey = String(value || '')
      persist()
    },
  })

  const model = computed({
    get: () => data.value.model,
    set: (value) => {
      data.value.model = value || 'deepseek-chat'
      persist()
    },
  })

  const baseUrl = computed({
    get: () => data.value.baseUrl,
    set: (value) => {
      data.value.baseUrl = String(value || DEFAULT_BASE_URL).replace(/\/$/, '')
      persist()
    },
  })

  const libraryRootPath = computed({
    get: () => data.value.libraryRootPath,
    set: (value) => {
      data.value.libraryRootPath = String(value || '')
      persist()
    },
  })

  const avatarId = computed({
    get: () => data.value.avatarId,
    set: (value) => {
      data.value.avatarId = value || DEFAULT_AVATAR_ID
      persist()
    },
  })

  const avatarUrl = computed(() => getAvatarUrlById(data.value.avatarId))

  const effectiveApiKey = computed(() => {
    if (data.value.useAiProxy) return 'proxy'
    return data.value.apiKey || import.meta.env.VITE_DEEPSEEK_API_KEY || ''
  })

  const effectiveBaseUrl = computed(() => {
    if (data.value.useAiProxy) {
      const proxy = import.meta.env.VITE_AI_PROXY_URL || '/api/ai'
      const normalized = String(proxy).replace(/\/$/, '')
      // The AI SDK always calls `new URL(baseURL + '/chat/completions')`,
      // so a relative base like `/api/ai` throws "Invalid URL".  Resolve it
      // against the current origin in the browser; fall back to the raw
      // value in non-browser environments (tests, SSR).
      if (
        typeof window !== 'undefined' &&
        normalized.startsWith('/')
      ) {
        return `${window.location.origin}${normalized}`
      }
      return normalized
    }
    return data.value.baseUrl || DEFAULT_BASE_URL
  })

  const useAiProxy = computed({
    get: () => Boolean(data.value.useAiProxy),
    set: (value) => {
      data.value.useAiProxy = Boolean(value)
      persist()
    },
  })

  const fileAssociationsEnabled = computed({
    get: () => data.value.fileAssociationsEnabled !== false,
    set: (value) => {
      data.value.fileAssociationsEnabled = Boolean(value)
      persist()
    },
  })

  function persist() {
    persistToStorage(data.value)
  }

  function update(patch) {
    data.value = { ...data.value, ...patch }
    persist()
  }

  function exportAllData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      settings: data.value,
      userHabits: readStorageJson(HABITS_STORAGE_KEY),
      libraryPreferences: readStorageJson(LIBRARY_STORAGE_KEY),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `wpx-backup-${formatExportDate(new Date())}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return {
    data,
    apiKey,
    model,
    baseUrl,
    libraryRootPath,
    avatarId,
    avatarUrl,
    effectiveApiKey,
    effectiveBaseUrl,
    useAiProxy,
    fileAssociationsEnabled,
    update,
    exportAllData,
  }
})

function readStorageJson(key) {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function formatExportDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}
