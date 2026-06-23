import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const STORAGE_KEY = 'theme'
const LEGACY_STORAGE_KEY = 'wpx-theme'

/** @typedef {'light' | 'dark' | 'system'} ThemeMode */

const VALID_MODES = ['light', 'dark', 'system']
const THEME_CYCLE = ['light', 'dark', 'system']

function readStoredMode() {
  if (typeof localStorage === 'undefined') return 'system'

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && VALID_MODES.includes(raw)) return raw

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      const mode = parsed?.mode
      if (VALID_MODES.includes(mode)) {
        persistMode(mode)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        return mode
      }
    }

    return 'system'
  } catch {
    return 'system'
  }
}

function persistMode(mode) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (error) {
    console.warn('[theme] Failed to persist theme preference:', error)
  }
}

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeToDocument(resolved) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolved)
}

export const useThemeStore = defineStore('theme', () => {
  /** @type {import('vue').Ref<ThemeMode>} */
  const mode = ref('system')

  const resolvedTheme = computed(() =>
    mode.value === 'system' ? getSystemTheme() : mode.value,
  )

  const isDark = computed(() => resolvedTheme.value === 'dark')

  let mediaQuery = null
  let mediaListener = null

  function applyTheme() {
    applyThemeToDocument(resolvedTheme.value)
  }

  function setTheme(nextMode) {
    if (!VALID_MODES.includes(nextMode)) return
    mode.value = nextMode
    persistMode(nextMode)
    applyTheme()
  }

  function toggleLightDark() {
    setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark')
  }

  function cycleTheme() {
    const index = THEME_CYCLE.indexOf(mode.value)
    const next = THEME_CYCLE[(index + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

  function init() {
    mode.value = readStoredMode()
    applyTheme()

    if (typeof window === 'undefined') return

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaListener = () => {
      if (mode.value === 'system') applyTheme()
    }
    mediaQuery.addEventListener('change', mediaListener)
  }

  function destroy() {
    if (mediaQuery && mediaListener) {
      mediaQuery.removeEventListener('change', mediaListener)
    }
  }

  return {
    mode,
    resolvedTheme,
    isDark,
    setTheme,
    toggleLightDark,
    cycleTheme,
    init,
    destroy,
  }
})
