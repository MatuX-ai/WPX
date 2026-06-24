<template>
  <header
    class="flex items-center justify-between h-[var(--wpx-topbar-h)] px-4 bg-white border-b border-gray-100"
  >
    <!-- 左侧：面包屑 / 当前页 -->
    <div class="flex items-center gap-3 min-w-0">
      <span class="text-base font-semibold text-gray-900 truncate">{{ pageTitle }}</span>
      <span
        v-if="auth.roleLabel"
        class="wpx-badge-primary"
      >{{ auth.roleLabel }}</span>
    </div>

    <!-- 右侧：操作 -->
    <div class="flex items-center gap-2">
      <!-- 环境标识 -->
      <span class="hidden sm:inline-flex wpx-badge-gray">
        {{ envLabel }}
      </span>

      <!-- 主题/刷新 -->
      <button
        type="button"
        class="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        title="刷新当前页"
        @click="reload"
      >
        🔄
      </button>

      <!-- 用户菜单 -->
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          @click="userMenuOpen = !userMenuOpen"
        >
          <div
            class="w-8 h-8 rounded-full bg-wpx-gradient text-white flex items-center justify-center text-sm font-semibold"
          >
            {{ avatarLetter }}
          </div>
          <span class="hidden md:inline text-sm text-gray-700 max-w-[120px] truncate">
            {{ auth.displayName }}
          </span>
          <span class="text-gray-400 text-xs">▾</span>
        </button>

        <transition name="page">
          <div
            v-if="userMenuOpen"
            v-click-outside="() => (userMenuOpen = false)"
            class="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50"
          >
            <div class="px-4 py-2 border-b border-gray-100">
              <div class="text-sm font-medium text-gray-900 truncate">
                {{ auth.displayName }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ auth.user?.email || '—' }}
              </div>
            </div>
            <button
              type="button"
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="onLogout"
            >
              退出登录
            </button>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { vClickOutside } from '@/composables/clickOutside'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const userMenuOpen = ref(false)

const pageTitle = computed(() => route.meta?.title || '管理后台')

const envLabel = computed(() => {
  // 简单环境指示（prod/dev）
  const u = typeof __APP_INFO__ !== 'undefined' ? __APP_INFO__.apiBaseUrl : ''
  return u && u.includes('localhost') ? 'DEV' : 'PROD'
})

const avatarLetter = computed(() => {
  const name = auth.displayName || 'A'
  return name.trim().charAt(0).toUpperCase()
})

function reload() {
  // 简单的页面刷新：重走当前路由
  router.replace({ path: '/redirect' + route.fullPath }).catch(() => {})
}

async function onLogout() {
  userMenuOpen.value = false
  await auth.logout()
  router.replace('/login')
}
</script>