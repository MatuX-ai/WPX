<template>
  <div class="flex h-screen overflow-hidden bg-[#F5F6FA]">
    <!-- 侧边栏 -->
    <SidebarNav
      :collapsed="sidebarCollapsed"
      @toggle="toggleSidebar"
    />

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <TopBar />

      <!-- 内容区 -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <router-view v-slot="{ Component, route: r }">
          <transition
            name="page"
            mode="out-in"
          >
            <component
              :is="Component"
              :key="r.fullPath"
            />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SidebarNav from '@/components/SidebarNav.vue'
import TopBar from '@/components/TopBar.vue'

// 侧边栏折叠状态（持久化到 localStorage）
const STORAGE_KEY = 'wpx_admin_sidebar_collapsed'
const sidebarCollapsed = ref(
  (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch (_e) {
      return false
    }
  })()
)

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(STORAGE_KEY, sidebarCollapsed.value ? '1' : '0')
  } catch (_e) {
    /* noop */
  }
}
</script>