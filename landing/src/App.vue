<script setup>
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import { useEasterEggs } from './composables/useEasterEggs'

// 全局彩蛋初始化：仅在浏览器侧运行（SSR 跳过）
let eggs = null
if (typeof window !== 'undefined') {
  eggs = useEasterEggs({ autoSetup: true, mountUi: true })
  if (import.meta.env && import.meta.env.DEV) {
    window.__wpxEggs = eggs
  }
}
onMounted(() => {
  // 路由切换时同步 meta
  if (typeof window === 'undefined') return
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-light text-dark">
    <NavBar />
    <main class="flex-1">
      <router-view v-slot="{ Component, route }">
        <transition
          name="page"
          mode="out-in"
        >
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
    <Footer />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>