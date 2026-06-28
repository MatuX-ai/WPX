<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import SettingsGuestLock from '@/views/settings/SettingsGuestLock.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isGuest, currentUser } = storeToRefs(authStore)
const { login, isLoggingIn } = useAuth()

const avatarLoadFailed = ref(false)

const navItems = [
  { name: 'settings-agent', label: 'Agent 设置', icon: '🤖' },
  { name: 'settings-skills', label: 'Skills 管理', icon: '⚡' },
  { name: 'settings-jcode', label: 'AI 引擎', icon: '🚀' },
  { name: 'settings-models', label: '我的模型', icon: '🔌' },
  { name: 'settings-fonts', label: '字体与 Token', icon: '🔤', requiresLogin: true },
  { name: 'settings-general', label: '通用设置', icon: '⚙️' },
  { name: 'settings-privacy', label: '数据与隐私', icon: '🔒' },
  { name: 'settings-about', label: '关于', icon: 'ℹ️' },
]

const LOGIN_REQUIRED_ROUTES = new Set(['settings-fonts'])

const editorRoute = computed(() => ({
  name: 'editor',
  query: { ...route.query },
}))

const displayNickname = computed(() => currentUser.value?.nickname?.trim() || '用户')
const userAvatarUrl = computed(() => currentUser.value?.avatar?.trim() || '')
const showUserAvatarImage = computed(
  () => Boolean(userAvatarUrl.value) && !avatarLoadFailed.value,
)
const avatarFallbackText = computed(() => displayNickname.value.slice(0, 1).toUpperCase() || '用')

const showGuestLock = computed(
  () => isGuest.value && LOGIN_REQUIRED_ROUTES.has(String(route.name || '')),
)

function isNavActive(name) {
  return route.name === name
}

function goBackToEditor() {
  router.push(editorRoute.value)
}

async function handleGuestLogin() {
  await login()
}

function handleAvatarError() {
  avatarLoadFailed.value = true
}

watch(userAvatarUrl, () => {
  avatarLoadFailed.value = false
})
</script>

<template>
  <div class="settings-shell">
    <header class="settings-topbar">
      <button
        type="button"
        class="settings-back-btn"
        aria-label="返回编辑器"
        @click="goBackToEditor"
      >
        ← 返回编辑器
      </button>
      <h1 class="settings-topbar__title">用户中心</h1>
    </header>

    <div class="settings-body">
      <aside class="settings-sidebar" aria-label="设置导航">
        <nav class="settings-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name, query: route.query }"
            class="settings-nav__item"
            :class="{ 'settings-nav__item--active': isNavActive(item.name) }"
            :aria-current="isNavActive(item.name) ? 'page' : undefined"
          >
            <span class="settings-nav__icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="settings-nav__label">{{ item.label }}</span>
          </RouterLink>
        </nav>

        <div class="settings-sidebar__account">
          <div v-if="isGuest" class="settings-account settings-account--guest">
            <span class="settings-account__avatar settings-account__avatar--guest" aria-hidden="true">
              访
            </span>
            <div class="settings-account__meta">
              <span class="settings-account__name">未登录</span>
              <button
                type="button"
                class="settings-account__login"
                :disabled="isLoggingIn"
                @click="handleGuestLogin"
              >
                {{ isLoggingIn ? '登录中…' : '登录' }}
              </button>
            </div>
          </div>

          <div v-else class="settings-account">
            <span class="settings-account__avatar" aria-hidden="true">
              <img
                v-if="showUserAvatarImage"
                :src="userAvatarUrl"
                alt=""
                class="settings-account__avatar-image"
                @error="handleAvatarError"
              />
              <span v-else class="settings-account__avatar-fallback">{{ avatarFallbackText }}</span>
            </span>
            <div class="settings-account__meta">
              <span class="settings-account__name">{{ displayNickname }}</span>
              <span class="settings-account__status">已登录</span>
            </div>
          </div>
        </div>
      </aside>

      <main class="settings-content">
        <div class="settings-content__viewport">
          <RouterView />
          <SettingsGuestLock
            v-if="showGuestLock"
            :loading="isLoggingIn"
            @login="handleGuestLogin"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  background: var(--theme-bg);
  color: var(--theme-fg);
}

.settings-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--theme-border);
  background: var(--theme-bg-subtle);
  padding: 12px 20px;
}

.settings-back-btn {
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg);
  padding: 6px 12px;
  font-size: 13px;
  color: var(--theme-fg-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.settings-back-btn:hover {
  border-color: var(--theme-accent);
  background: var(--theme-bg-subtle);
  color: var(--theme-fg);
}

.settings-topbar__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--theme-fg);
}

.settings-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 220px;
  border-right: 1px solid var(--theme-border);
  background: var(--theme-bg-subtle);
  padding: 16px 12px;
  overflow-y: auto;
}

.settings-nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: var(--theme-radius-sm, 6px);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  color: var(--theme-fg-muted);
  transition: background 0.15s, color 0.15s;
}

.settings-nav__item:hover {
  background: var(--theme-bg-muted);
  color: var(--theme-fg);
}

.settings-nav__item--active {
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
}

.settings-nav__icon {
  flex-shrink: 0;
  width: 20px;
  font-size: 16px;
  line-height: 1;
  text-align: center;
}

.settings-nav__label {
  min-width: 0;
}

.settings-sidebar__account {
  flex-shrink: 0;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--theme-border);
}

.settings-account {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.settings-account__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
  font-size: 14px;
  font-weight: 600;
}

.settings-account__avatar--guest {
  background: var(--theme-bg-muted);
  color: var(--theme-fg-muted);
}

.settings-account__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.settings-account__avatar-fallback {
  line-height: 1;
}

.settings-account__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.settings-account__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-fg);
}

.settings-account__status {
  font-size: 11px;
  color: var(--theme-fg-subtle);
}

.settings-account__login {
  align-self: flex-start;
  margin-top: 2px;
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-accent);
  cursor: pointer;
}

.settings-account__login:hover:not(:disabled) {
  text-decoration: underline;
}

.settings-account__login:disabled {
  opacity: 0.7;
  cursor: wait;
}

.settings-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 24px 28px;
  background: var(--theme-bg);
}

.settings-content__viewport {
  position: relative;
  min-height: 100%;
}

@media (max-width: 768px) {
  .settings-body {
    flex-direction: column;
  }

  .settings-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--theme-border);
    padding: 12px;
  }

  .settings-nav {
    flex: none;
  }

  .settings-nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }

  .settings-nav__item {
    flex: 1 1 auto;
    min-width: calc(50% - 6px);
    padding: 8px 10px;
  }

  .settings-sidebar__account {
    margin-top: 12px;
    padding-top: 12px;
  }

  .settings-content {
    padding: 16px;
  }
}
</style>
