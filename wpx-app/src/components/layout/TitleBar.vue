<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { FolderOpen, Infinity as InfinityIcon, Square, User } from '@lucide/vue'
import { useAuth } from '@/composables/useAuth'
import { useOpenSettings } from '@/composables/useOpenSettings'
import { useAuthStore } from '@/stores/auth'
import { useTrayStore } from '@/stores/tray'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { useSettingsStore } from '@/stores/settings'
import { useAppStore } from '@/stores/app'
import { useFocusModeFormatPrompt } from '@/composables/useFocusModeFormatPrompt'
import { getElectronAPI, isElectron } from '@/utils/electron'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'
import { getAvatarUrlById, DEFAULT_AVATAR_ID } from '@/constants/aiAvatars'
import {
  detectPlatform,
  hasNativeWindowControls,
  queryIsMaximized,
  toggleMaximizeWindow,
} from '@/utils/windowControls'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import UserAccountMenu from '@/components/layout/UserAccountMenu.vue'
import WindowListMenu from '@/components/layout/WindowListMenu.vue'
import { getWindowId } from '@/utils/windowContext'
import { useRouter } from 'vue-router'

const props = defineProps({
  documentName: {
    type: String,
    default: '未命名文档',
  },
  isSaved: {
    type: Boolean,
    default: undefined,
  },
  saveStatus: {
    type: String,
    default: 'saved',
  },
  saveStatusRefreshTick: {
    type: Number,
    default: 0,
  },
  platform: {
    type: String,
    default: '',
  },
  showWindowControls: {
    type: Boolean,
    default: true,
  },
  overlay: {
    type: Boolean,
    default: false,
  },
})

const trayStore = useTrayStore()
const authStore = useAuthStore()
const userPreferencesStore = useUserPreferencesStore()
const settingsStore = useSettingsStore()
const floatingWindows = useFloatingWindows()
const aiChat = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)
const { triggerFocusFormatPrompt } = useFocusModeFormatPrompt()
const { isAuthenticated, currentUser } = storeToRefs(authStore)
const { login, logout, isLoggingIn } = useAuth()
const { openSettings } = useOpenSettings()

const focusModeEnabled = computed(() => userPreferencesStore.paper?.focusMode === true)
const focusModePaperSize = computed(() => userPreferencesStore.paper?.paperSize || 'none')
const focusModeAvailable = computed(() => focusModePaperSize.value !== 'none')
const focusModeButtonTitle = computed(() =>
  focusModeAvailable.value
    ? focusModeEnabled.value
      ? '退出焦点模式'
      : '焦点写作模式'
    : '请先在通用设置中选择纸张尺寸',
)
const focusModeButtonLabel = computed(() =>
  focusModeEnabled.value ? '退出焦点模式' : '进入焦点模式',
)

async function handleToggleFocusMode() {
  if (!focusModeAvailable.value) return
  try {
    await userPreferencesStore.toggleFocusMode()
    // 进入 A4 阅读模式（焦点模式开启）→ 根据文档内容类型主动提示 AI 助理排版
    if (userPreferencesStore.paper?.focusMode === true) {
      triggerFocusFormatPrompt()
    }
  } catch (error) {
    console.warn('[TitleBar] Failed to toggle focus mode:', error)
  }
}

async function handleOpenFile() {
  const api = getElectronAPI()
  if (!api?.openFileDialog) return

  const filePath = await api.openFileDialog()
  if (!filePath) return

  // 如果已有打开的文档，在新窗口中打开文件
  const appStore = useAppStore()
  if (appStore.hasOpenDocument && api.createWindow) {
    api.createWindow(filePath)
    return
  }

  // 否则读取文件内容并加载到当前编辑器
  const payload = await api.files.readDocument(filePath)
  if (!payload) return

  appStore.openDocument()
  appStore.queueExternalFile(payload)

  if (router.currentRoute.value.name !== 'editor') {
    router.push({ name: 'editor' })
  }
}

const isMaximized = ref(false)
const windowMenuOpen = ref(false)
const userMenuOpen = ref(false)
const windowMenuAnchor = ref(null)
const userMenuAnchor = ref(null)
const avatarLoadFailed = ref(false)
const windowList = ref([])
const currentWindowId = ref(getWindowId())
const router = useRouter()
const resolvedPlatform = computed(() => props.platform || detectPlatform())
const isMac = computed(() => resolvedPlatform.value === 'macos')
const isElectronShell = computed(() => isElectron())

const displayName = computed(() => props.documentName?.trim() || '未命名文档')

const resolvedSaveStatus = computed(() => {
  if (props.isSaved !== undefined) {
    return props.isSaved ? 'saved' : 'unsaved'
  }
  return props.saveStatus || 'saved'
})

const saveStatusLabel = computed(() => {
  if (resolvedSaveStatus.value === 'saving') return '保存中…'
  if (resolvedSaveStatus.value === 'saved') return '已保存'
  return '未保存'
})

const saveDotClass = computed(() => {
  if (resolvedSaveStatus.value === 'saving') {
    return 'bg-yellow-500 shadow-[0_0_0_1px_rgba(234,179,8,0.25)] animate-save-blink motion-reduce:animate-none'
  }
  if (resolvedSaveStatus.value === 'saved') {
    return 'bg-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]'
  }
  return 'bg-yellow-500 shadow-[0_0_0_1px_rgba(234,179,8,0.25)]'
})

const isDesktopShell = computed(() => isElectronShell.value || hasNativeWindowControls())
const showControls = computed(() => props.showWindowControls)
const showWindowMenu = computed(() => isElectronShell.value)
const displayNickname = computed(() => currentUser.value?.nickname?.trim() || '用户')
const userAvatarUrl = computed(() => currentUser.value?.avatar?.trim() || '')
const showUserAvatarImage = computed(() => Boolean(userAvatarUrl.value) && !avatarLoadFailed.value)

let maximizePollTimer = null

function getWindowApi() {
  return getElectronAPI()
}

async function refreshMaximizedState() {
  isMaximized.value = await queryIsMaximized()
}

function handleMinimize() {
  const api = getWindowApi()
  if (api?.minimize) {
    api.minimize()
    return
  }

  trayStore.hideMainWindowToTray()
}

async function handleToggleMaximize() {
  const api = getWindowApi()
  if (api?.maximizeRestore) {
    api.maximizeRestore()
    window.setTimeout(() => {
      refreshMaximizedState()
    }, 50)
    return
  }

  isMaximized.value = await toggleMaximizeWindow()
}

function handleClose() {
  const api = getWindowApi()
  if (api?.requestClose) {
    api.requestClose()
    return
  }

  trayStore.hideMainWindowToTray()
}

async function handleWindowMenu() {
  if (windowMenuOpen.value) {
    windowMenuOpen.value = false
    return
  }

  const api = getWindowApi()
  if (!api?.requestWindowList) return

  try {
    const result = await api.requestWindowList()
    windowList.value = result?.windows ?? []
    currentWindowId.value = result?.currentWindowId ?? getWindowId()
    windowMenuOpen.value = true
  } catch (error) {
    console.error('[TitleBar] Failed to load window list:', error)
  }
}

function closeWindowMenu() {
  windowMenuOpen.value = false
}

function handleSelectWindow(windowId) {
  getWindowApi()?.focusWindow?.(windowId)
  closeWindowMenu()
}

function handleOpenSettings() {
  openSettings()
}

function handleLogin() {
  void login().catch((error) => {
    console.warn('[TitleBar] login failed:', error)
  })
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function closeUserMenu() {
  userMenuOpen.value = false
}

function handleUserSettings() {
  closeUserMenu()
  openSettings()
}

async function handleUserLogout() {
  closeUserMenu()
  await logout()
}

function handleAvatarError() {
  avatarLoadFailed.value = true
}

/**
 * AI 助手是否贴边（docked）？
 * 仅当 docked=true 且面板可见时，TitleBar 右侧出现一个头像按钮。
 * 点击后调用 undock + open，恢复为右下角浮窗 + avatar入口。
 */
const aiChatIsDocked = computed(() => aiChat.isDocked.value && aiChat.visible.value)
const titleBarAvatarUrl = computed(() => {
  return settingsStore.avatarUrl || getAvatarUrlById(settingsStore.avatarId || DEFAULT_AVATAR_ID)
})

function handleTitleBarAvatarClick() {
  if (aiChat.isDocked.value) {
    floatingWindows.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
  }
  floatingWindows.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
}

function handleTitleBarAvatarKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleTitleBarAvatarClick()
  }
}

watch(userAvatarUrl, () => {
  avatarLoadFailed.value = false
})

async function handleTitleBarDblClick(event) {
  if (event.target.closest('.title-bar__controls')) return
  if (event.target.closest('.title-bar__menu-btn')) return
  if (event.target.closest('.title-bar__settings-btn')) return
  if (event.target.closest('.title-bar__focus-btn')) return
  if (event.target.closest('.title-bar__user')) return
  await handleToggleMaximize()
}

onMounted(() => {
  refreshMaximizedState()
  document.addEventListener('fullscreenchange', refreshMaximizedState)
  if (isDesktopShell.value) {
    maximizePollTimer = window.setInterval(refreshMaximizedState, 1000)
  }
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', refreshMaximizedState)
  if (maximizePollTimer) {
    window.clearInterval(maximizePollTimer)
  }
})
</script>

<template>
  <header
    class="title-bar"
    :class="{
      'title-bar--mac': isMac,
      'title-bar--win': !isMac,
      'title-bar--overlay': overlay,
    }"
    @dblclick="handleTitleBarDblClick"
  >
    <div class="title-bar__leading">
      <img
        src="/favicon.svg"
        alt=""
        class="title-bar__icon"
        width="16"
        height="16"
        aria-hidden="true"
      />
      <span class="title-bar__doc-name" :title="displayName">{{ displayName }}</span>
      <span
        :key="saveStatusRefreshTick"
        class="title-bar__save-dot size-[7px] shrink-0 rounded-full transition-colors duration-200"
        :class="saveDotClass"
        :title="saveStatusLabel"
        :aria-label="saveStatusLabel"
        role="status"
      />
    </div>

    <div class="title-bar__spacer" aria-hidden="true" />

    <div class="title-bar__actions">
      <button
        type="button"
        class="title-bar__menu-btn title-bar__focus-btn"
        :class="{
          'title-bar__focus-btn--active': focusModeEnabled,
          'title-bar__focus-btn--disabled': !focusModeAvailable,
        }"
        :aria-label="focusModeButtonLabel"
        :aria-pressed="focusModeEnabled"
        :title="focusModeButtonTitle"
        :disabled="!focusModeAvailable"
        data-focus-mode-toggle
        @click="handleToggleFocusMode"
      >
        <Square
          v-if="focusModeEnabled"
          :size="16"
          :stroke-width="1.8"
          aria-hidden="true"
        />
        <InfinityIcon
          v-else
          :size="16"
          :stroke-width="1.8"
          aria-hidden="true"
        />
      </button>

      <!-- 打开文件按钮（仅桌面端可见） -->
      <button
        v-if="isElectronShell"
        type="button"
        class="title-bar__menu-btn title-bar__open-btn"
        aria-label="打开文件"
        title="打开文件"
        @click="handleOpenFile"
      >
        <FolderOpen :size="16" :stroke-width="1.8" aria-hidden="true" />
      </button>

      <!--
        贴边模式下的 AI 助手头像按钮。
        当 AI 助手 dock 到右侧栏后，右下角的 Avatar 会隐藏。
        这里提供入口，点击后调用 undock + open，让 Avatar / 浮窗重新出现。
      -->
      <button
        v-if="aiChatIsDocked"
        type="button"
        class="title-bar__menu-btn title-bar__ai-avatar-btn"
        aria-label="恢复 AI 助手为浮窗"
        title="恢复为右下角浮窗"
        @click="handleTitleBarAvatarClick"
        @keydown="handleTitleBarAvatarKeydown"
      >
        <img
          v-if="titleBarAvatarUrl"
          :src="titleBarAvatarUrl"
          alt=""
          class="title-bar__ai-avatar-img"
        />
        <span v-else class="title-bar__ai-avatar-fallback" aria-hidden="true">AI</span>
      </button>
      <button
        v-if="showWindowMenu"
        ref="windowMenuAnchor"
        type="button"
        class="title-bar__menu-btn"
        :class="{ 'title-bar__menu-btn--active': windowMenuOpen }"
        aria-label="窗口列表"
        title="窗口列表"
        :aria-expanded="windowMenuOpen"
        @click="handleWindowMenu"
      >
        ☰
      </button>
      <button
        type="button"
        class="title-bar__menu-btn title-bar__settings-btn"
        aria-label="设置"
        title="设置"
        @click="handleOpenSettings"
      >
        ⚙️
      </button>
      <WindowListMenu
        :open="windowMenuOpen"
        :windows="windowList"
        :current-window-id="currentWindowId"
        :anchor-el="windowMenuAnchor"
        @close="closeWindowMenu"
        @select="handleSelectWindow"
      />

      <div class="title-bar__user">
        <button
          v-if="!isAuthenticated"
          type="button"
          class="title-bar__menu-btn title-bar__login-btn"
          :class="{ 'title-bar__login-btn--loading': isLoggingIn }"
          aria-label="登录"
          title="登录"
          :disabled="isLoggingIn"
          @click="handleLogin"
        >
          <span v-if="isLoggingIn" class="title-bar__login-spinner" aria-hidden="true" />
          <User
            v-else
            :size="16"
            :stroke-width="1.8"
            aria-hidden="true"
          />
        </button>

        <template v-else>
          <button
            ref="userMenuAnchor"
            type="button"
            class="title-bar__user-btn"
            :class="{ 'title-bar__user-btn--active': userMenuOpen }"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            :aria-label="`${displayNickname} 账户菜单`"
            @click="toggleUserMenu"
          >
            <span class="title-bar__user-avatar" aria-hidden="true">
              <img
                v-if="showUserAvatarImage"
                :src="userAvatarUrl"
                alt=""
                class="title-bar__user-avatar-image"
                @error="handleAvatarError"
              />
              <span v-else class="title-bar__user-avatar-fallback">
                <User :size="14" :stroke-width="2" />
              </span>
            </span>
            <span class="title-bar__user-name">{{ displayNickname }}</span>
          </button>

          <UserAccountMenu
            :open="userMenuOpen"
            :anchor-el="userMenuAnchor"
            @close="closeUserMenu"
            @settings="handleUserSettings"
            @logout="handleUserLogout"
          />
        </template>
      </div>

      <ThemeToggle />
    </div>

    <div v-if="showControls" class="title-bar__controls">
      <template v-if="isMac">
        <button
          type="button"
          class="title-bar__control title-bar__control--mac title-bar__control--close"
          aria-label="关闭窗口"
          @click="handleClose"
        />
        <button
          type="button"
          class="title-bar__control title-bar__control--mac title-bar__control--minimize"
          aria-label="最小化窗口"
          @click="handleMinimize"
        />
        <button
          type="button"
          class="title-bar__control title-bar__control--mac title-bar__control--maximize"
          :aria-label="isMaximized ? '还原窗口' : '最大化窗口'"
          @click="handleToggleMaximize"
        />
      </template>

      <template v-else>
        <button
          type="button"
          class="title-bar__control title-bar__control--win"
          aria-label="最小化窗口"
          @click="handleMinimize"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          class="title-bar__control title-bar__control--win"
          :aria-label="isMaximized ? '还原窗口' : '最大化窗口'"
          @click="handleToggleMaximize"
        >
          <svg v-if="!isMaximized" viewBox="0 0 12 12" aria-hidden="true">
            <rect
              x="2"
              y="2"
              width="8"
              height="8"
              rx="0.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
          <svg v-else viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M4 2h6v6H4V2zm1 1v4h4V3H5zM2 4h1v6h6v1H2V4z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          type="button"
          class="title-bar__control title-bar__control--win title-bar__control--close"
          aria-label="关闭窗口"
          @click="handleClose"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  height: var(--title-bar-height, 36px);
  flex-shrink: 0;
  padding: 0 0 0 12px;
  background: var(--theme-bg-subtle);
  border-bottom: 1px solid var(--theme-border);
  color: var(--theme-fg);
  user-select: none;
  -webkit-app-region: drag;
  app-region: drag;
}

.title-bar--overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-title-bar, 80);
  background: color-mix(in srgb, var(--theme-bg-subtle) 52%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: color-mix(in srgb, var(--theme-border) 38%, transparent);
}

.title-bar__leading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: min(420px, 50vw);
}

.title-bar__icon {
  flex-shrink: 0;
  display: block;
  border-radius: 4px;
}

.title-bar__doc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-fg);
  line-height: 1;
}

.title-bar__spacer {
  flex: 1;
  min-width: 12px;
  height: 100%;
}

.title-bar__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
  padding-right: 4px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.title-bar__menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-fg-muted);
  font-size: 14px;
  line-height: 1;
  cursor: default;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.title-bar__menu-btn:hover,
.title-bar__menu-btn--active {
  background: var(--theme-bg-muted);
  color: var(--theme-fg);
}

.title-bar__focus-btn--active {
  background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
  color: var(--theme-accent);
}

.title-bar__focus-btn--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.title-bar__focus-btn:disabled {
  pointer-events: auto;
}

.title-bar__focus-btn:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

/* ── AI 助手头像按钮（docked 模式专用）── */
.title-bar__ai-avatar-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme-accent, #7c3aed);
  transition:
    transform 0.15s ease,
    background-color 0.15s ease;
}

.title-bar__ai-avatar-btn:hover {
  background: color-mix(in srgb, var(--theme-accent, #7c3aed) 88%, #000 12%);
  transform: scale(1.05);
}

.title-bar__ai-avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.title-bar__ai-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.title-bar__user {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.title-bar__login-btn {
  border: 1px solid var(--theme-border);
  background: var(--theme-surface);
  color: var(--theme-fg);
}

.title-bar__login-btn:hover {
  background: var(--theme-bg-muted);
  border-color: color-mix(in srgb, var(--theme-accent) 35%, var(--theme-border));
  color: var(--theme-accent);
}

.title-bar__login-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.title-bar__login-btn--loading {
  cursor: progress;
}

.title-bar__login-spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 999px;
  animation: title-bar-login-spin 0.8s linear infinite;
}

@keyframes title-bar-login-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .title-bar__login-spinner {
    animation-duration: 1.6s;
  }
}

.title-bar__user-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 160px;
  height: 28px;
  padding: 0 8px 0 4px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--theme-fg);
  cursor: default;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease;
}

.title-bar__user-btn:hover,
.title-bar__user-btn--active {
  background: var(--theme-bg-muted);
  border-color: var(--theme-border);
}

.title-bar__user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
}

.title-bar__user-avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.title-bar__user-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.title-bar__user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--theme-fg);
}

.title-bar__controls {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  height: 100%;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* ── Windows 风格 ── */
.title-bar--win .title-bar__controls {
  gap: 0;
}

.title-bar__control--win {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  padding: 0;
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: default;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.title-bar__control--win svg {
  width: 12px;
  height: 12px;
}

.title-bar__control--win:hover {
  background: var(--theme-bg-muted);
  color: var(--theme-fg);
}

.title-bar__control--win.title-bar__control--close:hover {
  background: #e81123;
  color: #fff;
}

/* ── macOS 风格（右侧排列） ── */
.title-bar--mac .title-bar__controls {
  gap: 8px;
  padding: 0 12px;
  align-items: center;
}

.title-bar__control--mac {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 50%;
  padding: 0;
  cursor: default;
  opacity: 0.9;
  transition:
    opacity 0.12s ease,
    filter 0.12s ease;
}

.title-bar--mac:hover .title-bar__control--mac,
.title-bar--mac:focus-within .title-bar__control--mac {
  opacity: 1;
}

.title-bar__control--mac.title-bar__control--close {
  background: #ff5f57;
}

.title-bar__control--mac.title-bar__control--minimize {
  background: #febc2e;
}

.title-bar__control--mac.title-bar__control--maximize {
  background: #28c840;
}

.title-bar__control--mac:hover {
  filter: brightness(0.92);
}

.title-bar__control--mac:active {
  filter: brightness(0.85);
}

@media (prefers-color-scheme: dark) {
  .title-bar__control--win.title-bar__control--close:hover {
    background: #c42b1c;
  }
}
</style>
