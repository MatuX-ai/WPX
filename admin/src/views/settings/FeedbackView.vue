<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">用户反馈</h1>
        <p class="text-sm text-gray-500 mt-1">
          查看和处理用户提交的反馈 · 待处理 <span class="font-semibold text-amber-600">{{ stats.pending }}</span> 条
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="wpx-btn-secondary"
          :disabled="loading"
          @click="loadList(true)"
        >🔄 刷新</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="wpx-card p-3 text-center">
        <div class="text-2xl font-bold text-gray-900">{{ stats.total }}</div>
        <div class="text-xs text-gray-500 mt-1">全部反馈</div>
      </div>
      <div class="wpx-card p-3 text-center">
        <div class="text-2xl font-bold text-amber-600">{{ stats.pending }}</div>
        <div class="text-xs text-gray-500 mt-1">待处理</div>
      </div>
      <div class="wpx-card p-3 text-center">
        <div class="text-2xl font-bold text-green-600">{{ stats.resolved }}</div>
        <div class="text-xs text-gray-500 mt-1">已处理</div>
      </div>
      <div class="wpx-card p-3 text-center">
        <div class="text-2xl font-bold text-blue-600">{{ stats.last7d }}</div>
        <div class="text-xs text-gray-500 mt-1">近 7 天</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="wpx-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <label class="block text-xs text-gray-500 mb-1">状态</label>
        <select v-model="filters.status" class="wpx-input" @change="loadList(true)">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">处理中</option>
          <option value="resolved">已解决</option>
          <option value="closed">已关闭</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">分类</label>
        <select v-model="filters.category" class="wpx-input" @change="loadList(true)">
          <option value="">全部分类</option>
          <option value="bug">Bug 反馈</option>
          <option value="feature">功能建议</option>
          <option value="general">一般反馈</option>
          <option value="praise">好评</option>
        </select>
      </div>
    </div>

    <!-- 列表 -->
    <div class="wpx-card overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-sm text-gray-400">加载中…</div>

      <div v-else-if="!items.length" class="p-8 text-center text-sm text-gray-400">
        暂无反馈数据
      </div>

      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/50">
            <th class="text-left p-3 text-xs font-semibold text-gray-500">分类</th>
            <th class="text-left p-3 text-xs font-semibold text-gray-500">标题</th>
            <th class="text-left p-3 text-xs font-semibold text-gray-500">用户</th>
            <th class="text-left p-3 text-xs font-semibold text-gray-500">状态</th>
            <th class="text-left p-3 text-xs font-semibold text-gray-500">时间</th>
            <th class="text-left p-3 text-xs font-semibold text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
          >
            <td class="p-3">
              <span
                class="inline-block px-2 py-0.5 rounded text-xs font-medium"
                :class="categoryClass(item.category)"
              >{{ categoryLabel(item.category) }}</span>
            </td>
            <td class="p-3">
              <div class="text-sm font-medium text-gray-900">{{ item.title || '无标题' }}</div>
              <div class="text-xs text-gray-400 mt-0.5 line-clamp-2">{{ item.content }}</div>
            </td>
            <td class="p-3 text-xs text-gray-500">
              {{ item.userId === 'anonymous' ? '匿名用户' : item.userId }}
              <span v-if="item.contact" class="block text-gray-400">{{ item.contact }}</span>
            </td>
            <td class="p-3">
              <span
                class="inline-block px-2 py-0.5 rounded text-xs font-medium"
                :class="statusClass(item.status)"
              >{{ statusLabel(item.status) }}</span>
            </td>
            <td class="p-3 text-xs text-gray-400 whitespace-nowrap">
              {{ formatDate(item.createdAt) }}
            </td>
            <td class="p-3">
              <div class="flex items-center gap-2">
                <select
                  class="text-xs border rounded px-2 py-1"
                  :value="item.status"
                  @change="onStatusChange(item, ($event.target).value)"
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="closed">已关闭</option>
                </select>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 -->
      <div
        v-if="pagination.totalPages > 1"
        class="flex items-center justify-between p-3 border-t border-gray-100"
      >
        <span class="text-xs text-gray-400">
          共 {{ pagination.total }} 条，第 {{ pagination.page }} / {{ pagination.totalPages }} 页
        </span>
        <div class="flex items-center gap-1">
          <button
            class="wpx-btn-secondary text-xs"
            :disabled="pagination.page <= 1"
            @click="goPage(pagination.page - 1)"
          >上一页</button>
          <button
            class="wpx-btn-secondary text-xs"
            :disabled="pagination.page >= pagination.totalPages"
            @click="goPage(pagination.page + 1)"
          >下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  fetchFeedbacks,
  fetchFeedbackStats,
  updateFeedbackStatus
} from '@/utils/feedback-api'

const loading = ref(false)
const items = ref([])
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const stats = reactive({ total: 0, pending: 0, resolved: 0, closed: 0, last7d: 0 })

const filters = reactive({
  status: '',
  category: '',
  page: 1
})

async function loadList(reset = false) {
  if (reset) filters.page = 1
  loading.value = true
  try {
    const data = await fetchFeedbacks({
      status: filters.status || undefined,
      category: filters.category || undefined,
      page: filters.page,
      pageSize: 20
    })
    items.value = data?.items || []
    pagination.value = data?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 }
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  const data = await fetchFeedbackStats()
  if (data) {
    stats.total = data.total || 0
    stats.pending = data.pending || 0
    stats.resolved = data.resolved || 0
    stats.closed = data.closed || 0
    stats.last7d = data.last7d || 0
  }
}

function goPage(page) {
  filters.page = page
  loadList()
}

async function onStatusChange(item, newStatus) {
  if (!newStatus || newStatus === item.status) return
  await updateFeedbackStatus(item.id, { status: newStatus })
  await loadList()
  await loadStats()
}

function categoryLabel(cat) {
  const map = { bug: 'Bug', feature: '建议', general: '一般', praise: '好评' }
  return map[cat] || cat || '一般'
}

function categoryClass(cat) {
  const map = {
    bug: 'bg-red-100 text-red-700',
    feature: 'bg-blue-100 text-blue-700',
    general: 'bg-gray-100 text-gray-600',
    praise: 'bg-green-100 text-green-700'
  }
  return map[cat] || 'bg-gray-100 text-gray-600'
}

function statusLabel(s) {
  const map = { pending: '待处理', in_progress: '处理中', resolved: '已解决', closed: '已关闭' }
  return map[s] || s
}

function statusClass(s) {
  const map = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500'
  }
  return map[s] || 'bg-gray-100 text-gray-500'
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

onMounted(() => {
  loadList()
  loadStats()
})
</script>
