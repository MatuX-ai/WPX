<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">用户管理</h1>
      <span class="text-sm text-gray-500">
        共 {{ total }} 个用户
      </span>
    </div>

    <!-- 搜索和筛选栏 -->
    <div class="flex flex-wrap gap-3 mb-5">
      <input
        v-model="search"
        type="text"
        placeholder="搜索邮箱或昵称…"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
        @keyup.enter="doSearch"
      />
      <select
        v-model="statusFilter"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        @change="doSearch"
      >
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="disabled">已禁用</option>
      </select>
      <input
        v-model="startDate"
        type="date"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        @change="doSearch"
      />
      <span class="self-center text-gray-400 text-sm">至</span>
      <input
        v-model="endDate"
        type="date"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        @change="doSearch"
      />
      <button
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        @click="doSearch"
      >
        搜索
      </button>
      <button
        class="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition"
        @click="resetFilters"
      >
        重置
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="py-12 text-center text-gray-400">
      <div class="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2"></div>
      <p>加载中…</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="py-8 text-center">
      <p class="text-red-500 mb-3">{{ error }}</p>
      <button
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        @click="loadUsers"
      >
        重新加载
      </button>
    </div>

    <!-- 用户表格 -->
    <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">用户 ID</th>
            <th class="px-4 py-3 font-medium">昵称</th>
            <th class="px-4 py-3 font-medium">邮箱</th>
            <th class="px-4 py-3 font-medium">注册时间</th>
            <th class="px-4 py-3 font-medium">最后活跃</th>
            <th class="px-4 py-3 font-medium">状态</th>
            <th class="px-4 py-3 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            class="border-t border-gray-100 hover:bg-gray-50 transition"
          >
            <td class="px-4 py-3 text-gray-500 font-mono text-xs">{{ user.id?.slice(0, 8) }}…</td>
            <td class="px-4 py-3 font-medium text-gray-900">{{ user.nickname || '-' }}</td>
            <td class="px-4 py-3 text-gray-600">{{ user.email }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatDate(user.createdAt) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatDate(user.lastActiveAt) }}</td>
            <td class="px-4 py-3">
              <span
                :class="user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                class="px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ user.status === 'active' ? '正常' : '已禁用' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                class="text-blue-600 hover:text-blue-800 text-sm mr-3"
                @click="viewDetail(user.id)"
              >
                详情
              </button>
              <button
                v-if="user.status === 'active'"
                class="text-orange-600 hover:text-orange-800 text-sm mr-3"
                @click="toggleStatus(user)"
              >
                禁用
              </button>
              <button
                v-else
                class="text-green-600 hover:text-green-800 text-sm mr-3"
                @click="toggleStatus(user)"
              >
                启用
              </button>
              <button
                class="text-red-600 hover:text-red-800 text-sm"
                @click="confirmDelete(user)"
              >
                删除
              </button>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400">暂无用户</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-5">
      <span class="text-sm text-gray-500">
        第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条
      </span>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
          @click="goPage(page - 1)"
        >
          上一页
        </button>
        <button
          :disabled="page >= totalPages"
          class="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
          @click="goPage(page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      @click.self="deleteTarget = null"
    >
      <div class="bg-white rounded-xl shadow-xl p-6 w-96">
        <h3 class="text-lg font-semibold mb-2">确认删除</h3>
        <p class="text-sm text-gray-600 mb-4">
          确定要删除用户 <strong>{{ deleteTarget.email }}</strong> 吗？此操作不可撤销。
        </p>
        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            @click="deleteTarget = null"
          >
            取消
          </button>
          <button
            class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            @click="doDelete"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchUsers, updateUserStatus, deleteUser } from '@/utils/users-api'

const router = useRouter()

const loading = ref(true)
const error = ref(null)
const users = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const search = ref('')
const statusFilter = ref('')
const startDate = ref('')
const endDate = ref('')
const deleteTarget = ref(null)

async function loadUsers() {
  loading.value = true
  error.value = null
  try {
    const params = { page: page.value, pageSize }
    if (search.value.trim()) params.search = search.value.trim()
    if (statusFilter.value) params.status = statusFilter.value
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value

    const res = await fetchUsers(params)
    if (res && res.data) {
      users.value = res.data.items || res.data.users || []
      total.value = res.data.total || res.data.count || users.value.length
    } else {
      users.value = []
      total.value = 0
      error.value = '加载用户列表失败'
    }
  } catch (e) {
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function doSearch() {
  page.value = 1
  loadUsers()
}

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  startDate.value = ''
  endDate.value = ''
  page.value = 1
  loadUsers()
}

function goPage(p) {
  page.value = p
  loadUsers()
}

function viewDetail(id) {
  router.push(`/users/${id}`)
}

async function toggleStatus(user) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active'
  const res = await updateUserStatus(user.id, newStatus)
  if (res && res.ok !== false) {
    user.status = newStatus
  } else {
    alert('操作失败')
  }
}

function confirmDelete(user) {
  deleteTarget.value = user
}

async function doDelete() {
  const target = deleteTarget.value
  if (!target) return
  const res = await deleteUser(target.id)
  if (res && res.ok !== false) {
    users.value = users.value.filter(u => u.id !== target.id)
    total.value--
  } else {
    alert('删除失败')
  }
  deleteTarget.value = null
}

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(loadUsers)
</script>