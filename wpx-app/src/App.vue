<script setup>
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterView } from 'vue-router'
import LoginGuide from '@/components/auth/LoginGuide.vue'
import { useAuth } from '@/composables/useAuth'
import { provideLoginGuide } from '@/composables/useLoginGuide'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useSkillsStore } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

const authStore = useAuthStore()
const { sessionRestored } = storeToRefs(authStore)

// 尽早订阅 wpx://auth 协议回调
useAuth()
provideLoginGuide()
const preferencesStore = usePreferencesStore()
const userPreferencesStore = useUserPreferencesStore()
const skillsStore = useSkillsStore()
const generalSettingsStore = useGeneralSettingsStore()
const modelSettingsStore = useModelSettingsStore()

let unsubscribePreferencesChanged = null
let unsubscribeSkillsStorage = null

function applyRemotePreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return

  preferencesStore.applyPreferences(preferences)
  userPreferencesStore.hydrateFromPreferences(preferences.agent)
  modelSettingsStore.hydrateFromPreferences(preferences.models)
  generalSettingsStore.hydrateFromPreferences(preferences)

  if (preferences.skills && typeof preferences.skills === 'object') {
    skillsStore.applyEnabledMap(preferences.skills, { persist: false })
  }
}

onMounted(async () => {
  await authStore.restoreSession()

  generalSettingsStore.initFromLocalStorage()
  await modelSettingsStore.initFromLocalStorage()
  skillsStore.initFromLocalStorage()

  if (typeof window !== 'undefined') {
    const onSkillsStorage = (event) => {
      if (event.key !== 'wpx-skills-enabled') return
      skillsStore.initFromLocalStorage()
    }
    window.addEventListener('storage', onSkillsStorage)
    unsubscribeSkillsStorage = () => window.removeEventListener('storage', onSkillsStorage)
  }

  if (!isElectron()) {
    userPreferencesStore.initFromLocalStorage()
    return
  }

  const api = getElectronAPI()
  if (!api?.preferences?.get) return

  try {
    const preferences = await api.preferences.get()
    applyRemotePreferences(preferences)
  } catch (error) {
    console.warn('[App] Failed to load preferences from main process:', error)
  }

  if (typeof api.preferences.onChanged === 'function') {
    unsubscribePreferencesChanged = api.preferences.onChanged((preferences) => {
      applyRemotePreferences(preferences)
    })
  }
})

onUnmounted(() => {
  unsubscribePreferencesChanged?.()
  unsubscribePreferencesChanged = null
  unsubscribeSkillsStorage?.()
  unsubscribeSkillsStorage = null
})
</script>

<template>
  <div class="app-root">
    <RouterView v-if="sessionRestored" />
    <LoginGuide v-if="sessionRestored" />

    <div
      v-else
      class="app-session-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span class="app-session-loader__spinner" aria-hidden="true" />
      <span class="app-session-loader__text">正在加载…</span>
    </div>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100%;
}

.app-session-loader {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--theme-bg);
  color: var(--theme-fg-muted);
}

.app-session-loader__spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid color-mix(in srgb, var(--theme-fg-muted) 25%, transparent);
  border-top-color: var(--theme-accent);
  border-radius: 9999px;
  animation: app-session-spin 0.75s linear infinite;
}

.app-session-loader__text {
  font-size: 0.875rem;
  letter-spacing: 0.02em;
}

@keyframes app-session-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
