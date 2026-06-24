<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">应用公告</h1>
        <p class="text-sm text-gray-500 mt-1">
          管理 WPX 启动弹窗与设置页面顶部横幅公告
        </p>
      </div>
      <button
        type="button"
        class="wpx-btn-primary"
        @click="openCreate"
      >
        <span>+</span>
        <span>添加公告</span>
      </button>
    </div>

    <!-- 筛选 -->
    <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs text-gray-500 mb-1">关键字</label>
        <input
          v-model="filters.keyword"
          type="text"
          placeholder="按标题搜索"
          class="wpx-input"
        >
      </div>
      <div class="w-32">
        <label class="block text-xs text-gray-500 mb-1">状态</label>
        <select
          v-model="filters.status"
          class="wpx-input"
        >
          <option value="">全部状态</option>
          <option value="published">生效中</option>
          <option value="pending">待生效</option>
          <option value="expired">已过期</option>
          <option value="offline">已下线</option>
          <option value="draft">草稿</option>
        </select>
      </div>
      <button
        type="button"
        class="wpx-btn-secondary"
        @click="resetFilters"
      >
        重置
      </button>
      <button
        type="button"
        class="wpx-btn-secondary ml-auto"
        :disabled="loading"
        @click="loadList(true)"
      >
        🔄 刷新
      </button>
    </div>

    <!-- 公告列表 -->
    <div class="wpx-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th class="text-left px-4 py-3 font-medium">标题</th>
            <th class="text-left px-4 py-3 font-medium">内容摘要</th>
            <th class="text-left px-4 py-3 font-medium">生效时间</th>
            <th class="text-left px-4 py-3 font-medium">过期时间</th>
            <th class="text-left px-4 py-3 font-medium">创建时间</th>
            <th class="text-left px-4 py-3 font-medium">状态</th>
            <th class="text-right px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="a in filteredList"
            :key="a.id"
            class="hover:bg-gray-50/60 transition-colors"
          >
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900 truncate max-w-[280px]">
                {{ a.title }}
              </div>
            </td>
            <td class="px-4 py-3 text-gray-600 text-xs max-w-[260px]">
              <div class="truncate">{{ summarize(a.content) }}</div>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
              {{ formatDateTime(a.effectiveAt) }}
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
              {{ formatDateTime(a.expireAt) }}
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
              {{ formatDateTime(a.createdAt) }}
            </td>
            <td class="px-4 py-3">
              <span :class="statusClass(computeStatus(a))">
                {{ statusLabel(computeStatus(a)) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="inline-flex items-center gap-2">
                <button
                  type="button"
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="openEdit(a)"
                >编辑</button>
                <button
                  v-if="a.status !== 'offline' && computeStatus(a) !== 'expired'"
                  type="button"
                  class="text-xs text-gray-600 hover:text-gray-700"
                  @click="onToggle(a)"
                >
                  {{ a.status === 'offline' ? '上线' : '下线' }}
                </button>
                <button
                  type="button"
                  class="text-xs text-red-600 hover:text-red-700"
                  @click="onDelete(a)"
                >删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && filteredList.length === 0">
            <td
              colspan="7"
              class="px-4 py-12 text-center text-gray-400"
            >
              暂无公告
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ============ 添加/编辑弹窗 ============ -->
    <transition name="page">
      <div
        v-if="formOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeForm"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 class="text-base font-semibold text-gray-900">
              {{ form.id ? '编辑公告' : '添加公告' }}
            </h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="closeForm"
            >✕</button>
          </div>

          <form
            class="px-5 py-4 space-y-4 overflow-y-auto"
            @submit.prevent="onSubmit"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                标题 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.title"
                type="text"
                required
                maxlength="80"
                placeholder="例如：1.2.0 版本更新公告"
                class="wpx-input"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Markdown 正文 <span class="text-red-500">*</span>
              </label>
              <textarea
                v-model="form.content"
                rows="8"
                required
                placeholder="支持 Markdown：## 标题、**加粗**、`代码`、- 列表..."
                class="wpx-input resize-none font-mono text-xs"
              ></textarea>
              <p class="text-xs text-gray-400 mt-1">
                将在 WPX 启动弹窗与设置页顶部横幅展示
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  生效时间
                </label>
                <input
                  v-model="form.effectiveAt"
                  type="datetime-local"
                  class="wpx-input"
                >
                <p class="text-xs text-gray-400 mt-1">留空表示立即生效</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  过期时间
                </label>
                <input
                  v-model="form.expireAt"
                  type="datetime-local"
                  class="wpx-input"
                >
                <p class="text-xs text-gray-400 mt-1">留空表示永久有效</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input
                id="ann-publish"
                v-model="form.publishNow"
                type="checkbox"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              >
              <label
                for="ann-publish"
                class="text-sm text-gray-700 select-none cursor-pointer"
              >
                立即发布（未勾选则为草稿，需手动上线）
              </label>
            </div>

            <div
              v-if="formError"
              class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {{ formError }}
            </div>
          </form>

          <div class="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              class="wpx-btn-secondary"
              @click="closeForm"
            >
              取消
            </button>
            <button
              type="button"
              class="wpx-btn-primary"
              :disabled="formSubmitting"
              @click="onSubmit"
            >
              {{ formSubmitting ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncementStatus,
  deleteAnnouncement
} from '@/utils/announcements-api'

defineOptions({ name: 'AnnouncementView' })

// ============ State ============
const list = ref([])
const loading = ref(false)
const filters = reactive({ keyword: '', status: '' })

const filteredList = computed(() => {
  const kw = filters.keyword.trim().toLowerCase()
  return list.value.filter((a) => {
    if (kw && !(a.title || '').toLowerCase().includes(kw)) return false
    if (filters.status) {
      const cur = computeStatus(a)
      if (cur !== filters.status) return false
    }
    return true
  })
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchAnnouncements()
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
  const oneDay = 24 * 60 * 60 * 1000
  return [
    {
      id: 'an1',
      title: '🎉 WPX 1.2.0 正式发布：全新 Skills 商店',
      content:
        '## 更新亮点\n\n- 全新 **Skills 商店**，支持在线检索与一键启用\n- 文档编辑器性能优化 30%\n- 修复若干已知问题\n\n感谢大家的支持！',
      summary: '全新 Skills 商店上线',
      effectiveAt: now - oneDay,
      expireAt: now + 7 * oneDay,
      status: 'published',
      createdAt: now - oneDay
    },
    {
      id: 'an2',
      title: '服务器维护通知（5 月 30 日 02:00-04:00）',
      content:
        '## 维护内容\n\n- 数据库升级\n- 优化访问速度\n\n维护期间 WPX 部分功能可能短暂不可用，请提前保存文档。',
      summary: '凌晨维护，部分功能可能短暂不可用',
      effectiveAt: now + 2 * oneDay,
      expireAt: now + 3 * oneDay,
      status: 'pending',
      createdAt: now
    },
    {
      id: 'an3',
      title: '春节活动：充值返 Token',
      content: '## 活动内容\n\n活动期间充值满 100 元返 20 Token...',
      summary: '春节充值返 Token',
      effectiveAt: now - 30 * oneDay,
      expireAt: now - 20 * oneDay,
      status: 'published',
      createdAt: now - 35 * oneDay
    },
    {
      id: 'an4',
      title: '【草稿】新功能预告',
      content: '## 敬请期待\n\n我们即将上线...',
      status: 'draft',
      createdAt: now
    }
  ]
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
}

// ============ Form ============
const formOpen = ref(false)
const formSubmitting = ref(false)
const formError = ref('')
const form = reactive({
  id: '',
  title: '',
  content: '',
  effectiveAt: '',
  expireAt: '',
  publishNow: true
})

function resetForm() {
  form.id = ''
  form.title = ''
  form.content = ''
  form.effectiveAt = ''
  form.expireAt = ''
  form.publishNow = true
  formError.value = ''
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function openEdit(a) {
  resetForm()
  form.id = a.id
  form.title = a.title
  form.content = a.content
  form.effectiveAt = toDateTimeLocal(a.effectiveAt)
  form.expireAt = toDateTimeLocal(a.expireAt)
  form.publishNow = a.status === 'published'
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  formError.value = ''
}

async function onSubmit() {
  formError.value = ''
  if (!form.title.trim()) {
    formError.value = '请填写标题'
    return
  }
  if (!form.content.trim()) {
    formError.value = '请填写 Markdown 正文'
    return
  }
  const eff = parseDateTimeLocal(form.effectiveAt)
  const exp = parseDateTimeLocal(form.expireAt)
  if (eff && exp && eff >= exp) {
    formError.value = '过期时间必须晚于生效时间'
    return
  }

  formSubmitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      content: form.content,
      summary: summarize(form.content, 100),
      effectiveAt: eff || null,
      expireAt: exp || null,
      status: form.publishNow ? 'published' : 'draft'
    }
    if (form.id) {
      const updated = await updateAnnouncement(form.id, payload)
      mergeItem(updated)
    } else {
      const created = await createAnnouncement(payload)
      if (created && created.id) {
        list.value.unshift(created)
      } else {
        await loadList()
      }
    }
    closeForm()
  } catch (err) {
    formError.value = err?.message || '保存失败'
  } finally {
    formSubmitting.value = false
  }
}

function mergeItem(item) {
  if (!item || !item.id) return
  const idx = list.value.findIndex((x) => x.id === item.id)
  if (idx >= 0) list.value[idx] = { ...list.value[idx], ...item }
  else list.value.unshift(item)
}

async function onToggle(a) {
  const next = a.status === 'offline' ? 'published' : 'offline'
  const original = a.status
  a.status = next
  try {
    const updated = await toggleAnnouncementStatus(a.id, next)
    if (updated && updated.id) mergeItem(updated)
  } catch (err) {
    a.status = original
    // eslint-disable-next-line no-console
    console.error('[Announcement] toggle failed:', err)
  }
}

async function onDelete(a) {
  const ok = window.confirm(`确定删除公告「${a.title}」？`)
  if (!ok) return
  const original = list.value.slice()
  list.value = list.value.filter((x) => x.id !== a.id)
  try {
    await deleteAnnouncement(a.id)
  } catch (err) {
    list.value = original
    // eslint-disable-next-line no-console
    console.error('[Announcement] delete failed:', err)
  }
}

// ============ Helpers ============
/**
 * 计算公告真实状态（综合 status 与 effective/expire 时间）
 */
function computeStatus(a) {
  if (a.status === 'offline') return 'offline'
  if (a.status === 'draft') return 'draft'
  const now = Date.now()
  if (a.effectiveAt && now < a.effectiveAt) return 'pending'
  if (a.expireAt && now >= a.expireAt) return 'expired'
  return 'published'
}

function statusLabel(s) {
  return (
    {
      published: '● 生效中',
      pending: '⏳ 待生效',
      expired: '⌛ 已过期',
      offline: '○ 已下线',
      draft: '📝 草稿'
    }[s] || s
  )
}

function statusClass(s) {
  if (s === 'published') return 'wpx-badge-success'
  if (s === 'pending') return 'wpx-badge-warning'
  if (s === 'expired') return 'wpx-badge-gray'
  if (s === 'offline') return 'wpx-badge-gray'
  if (s === 'draft') return 'wpx-badge-primary'
  return 'wpx-badge-gray'
}

function summarize(content, limit = 80) {
  if (!content) return ''
  // 简单去除 Markdown 标记
  const plain = content
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > limit ? plain.slice(0, limit) + '…' : plain
}

function formatDateTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function toDateTimeLocal(t) {
  if (!t) return ''
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  // YYYY-MM-DDTHH:mm 格式（datetime-local 需要）
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseDateTimeLocal(s) {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

// ============ Lifecycle ============
onMounted(() => {
  loadList()
})
</script>