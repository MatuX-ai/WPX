<script setup>
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterView } from 'vue-router'
import LoginGuide from '@/components/auth/LoginGuide.vue'
import AuthModal from '@/components/auth/AuthModal.vue'
import FontRecommendationDialog from '@/components/font/FontRecommendationDialog.vue'
import { useAuth } from '@/composables/useAuth'
import { provideLoginGuide } from '@/composables/useLoginGuide'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useSkillsStore } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useFontRecommendationCheck } from '@/composables/useFontRecommendationCheck'
import {
  dismissFontRecommendationDialog,
  maybePromptFontRecommendation,
  useFontRecommendationDialog,
} from '@/composables/useFontRecommendationLauncher'

const authStore = useAuthStore()
const { sessionRestored } = storeToRefs(authStore)

// 初始化认证 composable（开启应用内嵌认证 + 恢复会话）
useAuth()
provideLoginGuide()
const preferencesStore = usePreferencesStore()
const userPreferencesStore = useUserPreferencesStore()
const skillsStore = useSkillsStore()
const generalSettingsStore = useGeneralSettingsStore()
const modelSettingsStore = useModelSettingsStore()

// 字体推荐弹窗状态与数据
const fontRecommendationDialog = useFontRecommendationDialog()
const fontRecommendation = useFontRecommendationCheck()

let unsubscribePreferencesChanged = null
let unsubscribeSkillsStorage = null
let fontRecommendationTimer = null

function applyRemotePreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return

  preferencesStore.applyPreferences(preferences)
  userPreferencesStore.hydrateFromPreferences(preferences.agent)
  if (preferences.paper && typeof preferences.paper === 'object') {
    userPreferencesStore.hydrateFromPreferences(preferences.paper)
  }
  modelSettingsStore.hydrateFromPreferences(preferences.models)
  generalSettingsStore.hydrateFromPreferences(preferences)

  if (preferences.skills && typeof preferences.skills === 'object') {
    skillsStore.applyEnabledMap(preferences.skills, { persist: false })
  }
}

function handleFontRecommendationDownloadAll() {
  dismissFontRecommendationDialog({ markedDownloaded: true })
}

function handleFontRecommendationSkip() {
  dismissFontRecommendationDialog()
}

function handleFontRecommendationNeverAsk() {
  dismissFontRecommendationDialog({ dismissPermanently: true })
}

function handleFontRecommendationInstallManually() {
  // 用户表示自己已安装全部推荐字体 → 不再提醒，但仍然记录检查时间
  dismissFontRecommendationDialog({ dismissPermanently: true })
}

function handleFontRecommendationClose() {
  dismissFontRecommendationDialog()
}

function scheduleFontRecommendationPrompt() {
  if (!isElectron()) return
  // 延迟 2.5s 执行：避开启动期 IO 集中、字体下载目录初始化等
  if (fontRecommendationTimer) {
    clearTimeout(fontRecommendationTimer)
  }
  fontRecommendationTimer = setTimeout(() => {
    fontRecommendationTimer = null
    void maybePromptFontRecommendation({ force: false })
  }, 2500)
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
  if (!api?.preferences?.get) {
    scheduleFontRecommendationPrompt()
    return
  }

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

  scheduleFontRecommendationPrompt()
})

onUnmounted(() => {
  unsubscribePreferencesChanged?.()
  unsubscribePreferencesChanged = null
  unsubscribeSkillsStorage?.()
  unsubscribeSkillsStorage = null
  if (fontRecommendationTimer) {
    clearTimeout(fontRecommendationTimer)
    fontRecommendationTimer = null
  }
})
</script>

<template>
  <div class="app-root">
    <RouterView v-if="sessionRestored" />
    <LoginGuide v-if="sessionRestored" />
    <!-- 应用内嵌认证模态框：全局唯一，任何需要登录的位置都可调出 -->
    <AuthModal v-if="sessionRestored" />

    <FontRecommendationDialog
      :visible="fontRecommendationDialog.visible.value"
      :missing="fontRecommendation.missing.value"
      :available="fontRecommendation.available.value"
      :system-font-count="fontRecommendation.systemFontCount.value"
      :loading="fontRecommendation.loading.value"
      @close="handleFontRecommendationClose"
      @download-all="handleFontRecommendationDownloadAll"
      @skip="handleFontRecommendationSkip"
      @never-ask="handleFontRecommendationNeverAsk"
      @install-manually="handleFontRecommendationInstallManually"
    />

    <div
      v-if="!sessionRestored"
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
  height: 100%;
  min-height: 0;
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
