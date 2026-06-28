<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-2">访客统计</h1>
    <p class="text-sm text-gray-500 mb-6">
      以设备 ID 维度统计未登录访客的使用情况
    </p>

    <div v-if="loading" class="py-12 text-center text-gray-400">
      <div class="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2"></div>
    </div>

    <div v-else-if="error" class="py-8 text-center text-red-500">{{ error }}</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <span class="text-sm text-gray-500">活跃访客设备数</span>
        <p class="text-3xl font-bold text-gray-900 mt-2">{{ stats.deviceCount || 0 }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <span class="text-sm text-gray-500">访客 AI 调用次数</span>
        <p class="text-3xl font-bold text-gray-900 mt-2">{{ stats.aiCalls || 0 }}</p>
        <span class="text-xs text-gray-400">（需配置自备 API Key）</span>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <span class="text-sm text-gray-500">访客活跃趋势</span>
        <p class="text-sm text-gray-400 mt-2">趋势图表开发中</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchVisitorStats } from '@/utils/users-api'

const loading = ref(true)
const error = ref(null)
const stats = ref({ deviceCount: 0, aiCalls: 0 })

onMounted(async () => {
  try {
    const res = await fetchVisitorStats()
    if (res && res.data) {
      stats.value = res.data
    }
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
})
</script>