<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">操作日志</h1>
        <p class="text-sm text-gray-500 mt-1">
          记录管理员在后台的所有关键操作
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="wpx-btn-secondary"
          :disabled="exporting"
          @click="onExportCsv"
        >
          <span>📤</span>
          <span>{{ exporting ? '导出中…' : '导出 CSV' }}</span>
        </button>
        <button
          type="button"
          class="wpx-btn-secondary"
          :disabled="loading"
          @click="loadList(true)"
        >🔄 刷新</button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="wpx-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
      <div>
        <label class="block text-xs text-gray-500 mb-1">操作人</label>
        <input
          v-model="filters.actor"
          type="text"
          placeholder="邮箱 / 姓名"
          class="wpx-input"
        >
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">类型</label>
        <select
          v-model="filters.type"
          class="wpx-input"
        >
          <option value="">全部类型</option>
          <option
            v-for="t in typeOptions"
            :key="t.value"
            :value="t.value"
          >{{ t.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">开始日期</label>
        <input
          v-model="filters.startDate"
          type="date"
          class="wpx-input"
        >
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">结束日期</label>
        <input
          v-model="filters.endDate"
          type="date"
          class="wpx-input"
        >
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">关键字</label>
        <div class="flex items-center gap-2">
          <input
            v-model="filters.keyword"
            type="text"
            placeholder="详情 / IP"
            class="wpx-input"
          >
          <button
            type="button"
            class="wpx-btn-secondary shrink-0"
            @click="resetFilters"
          >重置</button>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="wpx-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th class="text-left px-4 py-3 font-medium w-44">时间</th>
            <th class="text-left px-4 py-3 font-medium w-56">操作人</th>
            <th class="text-left px-4 py-3 font-medium w-32">类型</th>
            <th class="text-left px-4 py-3 font-medium w-32">IP</th>
            <th class="text-left px-4 py-3 font-medium">详情摘要</th>
            <th class="text-right px-4 py-3 font-medium w-24">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="log in pageList"
            :key="log.id"
            class="hover:bg-gray-50/60 transition-colors"
          >
            <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">
              {{ formatDateTime(log.createdAt) }}
            </td>
            <td class="px-4 py-3">
              <div class="text-gray-900 truncate max-w-[200px]">
                {{ log.actorName || '—' }}
              </div>
              <div class="text-xs text-gray-400 truncate max-w-[200px]">
                {{ log.actorEmail || log.actorId || '—' }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span :class="['wpx-badge', typeClass(log.type)]">
                {{ typeLabel(log.type) }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs font-mono text-gray-500">
              {{ log.ip || '—' }}
            </td>
            <td class="px-4 py-3 text-xs text-gray-600 max-w-[420px]">
              <div class="truncate">{{ summarize(log.detail) }}</div>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="text-xs text-primary-600 hover:text-primary-700"
                @click="openDetail(log)"
              >查看</button>
            </td>
          </tr>
          <tr v-if="!loading && pageList.length === 0">
            <td
              colspan="6"
              class="px-4 py-12 text-center text-gray-400"
            >
              暂无日志
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between text-sm"
    >
      <div class="text-xs text-gray-500">
        共 <span class="font-medium text-gray-900">{{ filtered.length }}</span> 条 ·
        第 <span class="font-medium text-gray-900">{{ page }}</span> / {{ totalPages }} 页
      </div>
      <div class="inline-flex items-center gap-1">
        <button
          type="button"
          class="wpx-btn-secondary px-3 py-1 text-xs"
          :disabled="page <= 1"
          @click="page = Math.max(1, page - 1)"
        >上一页</button>
        <button
          v-for="p in visiblePages"
          :key="p"
          type="button"
          :class="[
            'px-3 py-1 text-xs rounded-lg border transition-colors',
            p === page
              ? 'bg-primary-50 border-primary-200 text-primary-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          ]"
          @click="page = p"
        >{{ p }}</button>
        <button
          type="button"
          class="wpx-btn-secondary px-3 py-1 text-xs"
          :disabled="page >= totalPages"
          @click="page = Math.min(totalPages, page + 1)"
        >下一页</button>
        <select
          v-model.number="pageSize"
          class="ml-2 wpx-input py-1 text-xs w-20"
        >
          <option :value="10">10 / 页</option>
          <option :value="20">20 / 页</option>
          <option :value="50">50 / 页</option>
          <option :value="100">100 / 页</option>
        </select>
      </div>
    </div>

    <!-- ============ 详情弹窗 ============ -->
    <transition name="page">
      <div
        v-if="detailOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeDetail"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-semibold text-gray-900">操作日志详情</h3>
              <p
                v-if="detailLog"
                class="text-xs text-gray-500 mt-0.5"
              >
                {{ formatDateTime(detailLog.createdAt) }} · {{ detailLog.actorName || detailLog.actorEmail }}
              </p>
            </div>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="closeDetail"
            >✕</button>
          </div>

          <div
            v-if="detailLog"
            class="px-5 py-4 space-y-3 overflow-y-auto"
          >
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div class="text-xs text-gray-500">类型</div>
                <div class="mt-1">
                  <span :class="['wpx-badge', typeClass(detailLog.type)]">
                    {{ typeLabel(detailLog.type) }}
                  </span>
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500">IP</div>
                <div class="mt-1 font-mono text-gray-900">{{ detailLog.ip || '—' }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">操作人</div>
                <div class="mt-1 text-gray-900">
                  {{ detailLog.actorName || '—' }}
                  <span
                    v-if="detailLog.actorEmail"
                    class="text-xs text-gray-400 ml-1"
                  >{{ detailLog.actorEmail }}</span>
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500">日志 ID</div>
                <div class="mt-1 font-mono text-xs text-gray-700">{{ detailLog.id }}</div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-gray-500">详情（JSON）</div>
                <button
                  type="button"
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="copyDetail"
                >{{ copied ? '已复制 ✓' : '复制' }}</button>
              </div>
              <pre class="bg-gray-900 text-emerald-200 text-xs font-mono p-4 rounded-xl overflow-x-auto whitespace-pre">{{ detailJson }}</pre>
            </div>
          </div>

          <div class="px-5 py-4 border-t border-gray-100 flex items-center justify-end shrink-0">
            <button
              type="button"
              class="wpx-btn-secondary"
              @click="closeDetail"
            >关闭</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { fetchOperationLogs } from '@/utils/settings-api'

defineOptions({ name: 'OperationLogView' })

// ============ 类型定义 ============
const typeOptions = [
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'create', label: '新建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'publish', label: '发布' },
  { value: 'unpublish', label: '下线' },
  { value: 'refund', label: '退款' },
  { value: 'config', label: '配置修改' },
  { value: 'force_update', label: '强制更新' }
]

const typeLabelMap = Object.fromEntries(typeOptions.map((t) => [t.value, t.label]))

// ============ State ============
const list = ref([])
const loading = ref(false)
const filters = reactive({
  actor: '',
  type: '',
  startDate: '',
  endDate: '',
  keyword: ''
})

const page = ref(1)
const pageSize = ref(20)
const exporting = ref(false)

const filtered = computed(() => {
  const kw = filters.keyword.trim().toLowerCase()
  const actorKw = filters.actor.trim().toLowerCase()
  return list.value.filter((log) => {
    if (filters.type && log.type !== filters.type) return false
    if (actorKw) {
      const text = ((log.actorName || '') + ' ' + (log.actorEmail || '') + ' ' + (log.actorId || '')).toLowerCase()
      if (!text.includes(actorKw)) return false
    }
    if (filters.startDate) {
      const t = new Date(filters.startDate).getTime()
      if ((log.createdAt || 0) < t) return false
    }
    if (filters.endDate) {
      const t = new Date(filters.endDate).getTime() + 24 * 60 * 60 * 1000
      if ((log.createdAt || 0) >= t) return false
    }
    if (kw) {
      const text = (
        JSON.stringify(log.detail || '') +
        ' ' +
        (log.ip || '')
      ).toLowerCase()
      if (!text.includes(kw)) return false
    }
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
const pageList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const visiblePages = computed(() => {
  const tp = totalPages.value
  const cur = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const list = [1]
  const start = Math.max(2, cur - 1)
  const end = Math.min(tp - 1, cur + 1)
  if (start > 2) list.push('…')
  for (let i = start; i <= end; i++) list.push(i)
  if (end < tp - 1) list.push('…')
  list.push(tp)
  return list
})

watch(() => [filters.type, filters.actor, filters.startDate, filters.endDate, filters.keyword], () => {
  page.value = 1
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchOperationLogs({
      ...filters,
      page: page.value,
      pageSize: pageSize.value
    })
    if (Array.isArray(data)) {
      list.value = data
    } else if (data && Array.isArray(data.list)) {
      list.value = data.list
    } else {
      list.value = demoList()
    }
  } finally {
    loading.value = false
  }
}

function demoList() {
  const now = Date.now()
  const types = typeOptions.map((t) => t.value)
  const names = ['超级管理员', '运营小王', '内容编辑小李', '运营小张']
  const emails = ['super@proclaw.cc', 'op@proclaw.cc', 'editor@proclaw.cc', 'zhang@proclaw.cc']
  const list = []
  for (let i = 0; i < 76; i++) {
    const t = now - i * 1800 * 1000 - Math.floor(Math.random() * 600000)
    const type = types[i % types.length]
    const idx = i % names.length
    const detail = makeDemoDetail(type, i)
    list.push({
      id: 'L' + (10000 + i),
      createdAt: t,
      actorId: 'a' + (idx + 1),
      actorName: names[idx],
      actorEmail: emails[idx],
      type,
      ip: '10.0.' + ((i * 7) % 250) + '.' + ((i * 11) % 250),
      detail
    })
  }
  return list
}

function makeDemoDetail(type, i) {
  switch (type) {
    case 'login':
      return { userAgent: 'Chrome 120 / macOS', success: true }
    case 'create':
      return { resource: 'font', name: '霞鹜文楷' }
    case 'update':
      return { resource: 'model', id: 'm1', field: 'freeLimit', from: 10, to: 20 }
    case 'delete':
      return { resource: 'skill', id: 's' + i, reason: '内容违规' }
    case 'publish':
      return { resource: 'announcement', title: 'v1.2.0 发布公告' }
    case 'refund':
      return { orderNo: 'WPX' + (100000 + i), amount: 50, reason: '用户申请' }
    case 'config':
      return { section: 'system', field: 'freeAiLimit', from: 20, to: 30 }
    case 'force_update':
      return { version: '1.2.0', channel: 'stable' }
    default:
      return { action: type, ref: '#' + i }
  }
}

function resetFilters() {
  filters.actor = ''
  filters.type = ''
  filters.startDate = ''
  filters.endDate = ''
  filters.keyword = ''
  page.value = 1
}

// ============ 详情弹窗 ============
const detailOpen = ref(false)
const detailLog = ref(null)
const detailJson = computed(() => {
  if (!detailLog.value) return ''
  return JSON.stringify(detailLog.value.detail, null, 2)
})
const copied = ref(false)

function openDetail(log) {
  detailLog.value = log
  detailOpen.value = true
  copied.value = false
}

function closeDetail() {
  detailOpen.value = false
  detailLog.value = null
}

async function copyDetail() {
  if (!detailJson.value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(detailJson.value)
    } else {
      const ta = document.createElement('textarea')
      ta.value = detailJson.value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Log] copy failed:', e)
  }
}

// ============ 导出 CSV ============
async function onExportCsv() {
  if (exporting.value) return
  exporting.value = true
  try {
    const header = ['日志ID', '时间', '操作人', '邮箱', '类型', 'IP', '详情']
    const rows = filtered.value.map((log) => [
      log.id,
      formatDateTime(log.createdAt),
      log.actorName || '',
      log.actorEmail || '',
      typeLabel(log.type),
      log.ip || '',
      typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail)
    ])
    const csv = [header, ...rows]
      .map((r) => r.map(escapeCsvCell).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `operation-logs-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } finally {
    exporting.value = false
  }
}

function escapeCsvCell(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

// ============ Helpers ============
function formatDateTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function typeLabel(t) {
  return typeLabelMap[t] || t || '—'
}

function typeClass(t) {
  if (['create', 'publish'].includes(t)) return 'wpx-badge-success'
  if (['update', 'config'].includes(t)) return 'wpx-badge-primary'
  if (['login', 'logout'].includes(t)) return 'wpx-badge-gray'
  if (['delete', 'unpublish', 'refund'].includes(t)) return 'wpx-badge-danger'
  if (t === 'force_update') return 'wpx-badge-warning'
  return 'wpx-badge-gray'
}

function summarize(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  try {
    return Object.entries(detail)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ')
  } catch (_e) {
    return JSON.stringify(detail)
  }
}

// ============ Lifecycle ============
onMounted(() => {
  loadList()
})
watch(pageSize, () => {
  page.value = 1
})
</script>