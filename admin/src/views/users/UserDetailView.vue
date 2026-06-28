<template>
  <div class="p-6">
    <!-- 返回按钮 -->
    <button
      class="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-4 transition"
      @click="$router.push('/users')"
    >
      <span class="text-lg">&larr;</span> 返回用户列表
    </button>

    <!-- 加载 -->
    <div v-if="loading" class="py-12 text-center text-gray-400">
      <div class="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2"></div>
    </div>

    <!-- 错误 -->
    <div v-else-if="error" class="py-8 text-center">
      <p class="text-red-500 mb-3">{{ error }}</p>
      <button
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg"
        @click="loadDetail"
      >
        重新加载
      </button>
    </div>

    <!-- 用户详情 -->
    <template v-else-if="user">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">用户详情</h1>

      <!-- 基本信息卡片 -->
      <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500">用户 ID</span>
            <p class="text-gray-900 font-mono">{{ user.id || user.accountId || '-' }}</p>
          </div>
          <div>
            <span class="text-gray-500">昵称</span>
            <p class="text-gray-900">{{ user.nickname || '-' }}</p>
          </div>
          <div>
            <span class="text-gray-500">邮箱</span>
            <p class="text-gray-900">{{ user.email || '-' }}</p>
          </div>
          <div>
            <span class="text-gray-500">注册时间</span>
            <p class="text-gray-900">{{ formatDate(user.createdAt) }}</p>
          </div>
          <div>
            <span class="text-gray-500">最后活跃</span>
            <p class="text-gray-900">{{ formatDate(user.lastActiveAt || user.lastLoginAt) }}</p>
          </div>
          <div>
            <span class="text-gray-500">状态</span>
            <span
              :class="user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
              class="px-2 py-0.5 rounded-full text-xs font-medium"
            >
              {{ user.status === 'active' ? '正常' : '已禁用' }}
            </span>
          </div>
        </div>
      </section>

      <!-- 使用统计 -->
      <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">使用统计</h2>
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div class="bg-gray-50 rounded-lg p-4">
            <span class="text-gray-500">总活跃天数</span>
            <p class="text-2xl font-bold text-gray-900 mt-1">{{ user.totalActiveDays || 0 }}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <span class="text-gray-500">总 AI 调用次数</span>
            <p class="text-2xl font-bold text-gray-900 mt-1">{{ user.totalAiCalls || 0 }}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <span class="text-gray-500">总文档数</span>
            <p class="text-2xl font-bold text-gray-900 mt-1">{{ user.totalDocs || 0 }}</p>
          </div>
        </div>
      </section>

      <!-- Skills 列表 -->
      <section v-if="user.skills && user.skills.length" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">已启用 Skills ({{ user.skills.length }})</h2>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="skill in user.skills"
            :key="skill.id || skill.name"
            class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
          >
            {{ skill.name }}
          </span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { fetchUserDetail } from '@/utils/users-api'

const route = useRoute()
const userId = route.params.id

const loading = ref(true)
const error = ref(null)
const user = ref(null)

async function loadDetail() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchUserDetail(userId)
    if (res && res.data) {
      user.value = res.data
    } else if (res && res.ok !== false) {
      user.value = res
    } else {
      error.value = '用户不存在或加载失败'
    }
  } catch (e) {
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(loadDetail)
</script>