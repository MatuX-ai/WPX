<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

onMounted(async () => {
  // 应用启动时尝试恢复会话（基于 localStorage 中的 JWT）
  await auth.bootstrap()
})
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <transition
      name="page"
      mode="out-in"
    >
      <component
        :is="Component"
        :key="route.fullPath"
      />
    </transition>
  </router-view>
</template>