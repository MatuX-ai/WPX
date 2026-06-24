<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">应用版本</h1>
        <p class="text-sm text-gray-500 mt-1">
          管理 WPX 各平台版本号、更新日志、下载链接与强制更新
        </p>
      </div>
      <button
        type="button"
        class="wpx-btn-primary"
        @click="openCreate"
      >
        <span>+</span>
        <span>添加版本</span>
      </button>
    </div>

    <!-- 筛选 -->
    <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs text-gray-500 mb-1">关键字</label>
        <input
          v-model="filters.keyword"
          type="text"
          placeholder="按版本号搜索"
          class="wpx-input"
        >
      </div>
      <div class="w-32">
        <label class="block text-xs text-gray-500 mb-1">渠道</label>
        <select
          v-model="filters.channel"
          class="wpx-input"
        >
          <option value="">全部</option>
          <option value="stable">稳定版</option>
          <option value="beta">测试版</option>
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

    <!-- 列表 -->
    <div class="wpx-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th class="text-left px-4 py-3 font-medium">版本号</th>
            <th class="text-left px-4 py-3 font-medium">渠道</th>
            <th class="text-left px-4 py-3 font-medium">更新日志摘要</th>
            <th class="text-left px-4 py-3 font-medium">平台下载</th>
            <th class="text-left px-4 py-3 font-medium">发布日期</th>
            <th class="text-left px-4 py-3 font-medium">强制更新</th>
            <th class="text-right px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="v in filteredList"
            :key="v.id"
            class="hover:bg-gray-50/60 transition-colors"
          >
            <td class="px-4 py-3">
              <div class="font-mono text-gray-900 font-medium">
                v{{ v.version }}
              </div>
              <div
                v-if="v.id === latestStableId"
                class="text-[10px] text-emerald-600 mt-0.5"
              >
                ● 当前稳定版
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                :class="v.channel === 'beta' ? 'wpx-badge-warning' : 'wpx-badge-primary'"
              >
                {{ v.channel === 'beta' ? '测试' : '稳定' }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-600 max-w-[260px]">
              <div class="truncate">{{ summarize(v.changelog) }}</div>
            </td>
            <td class="px-4 py-3">
              <div class="inline-flex items-center gap-2">
                <a
                  v-if="v.downloads?.windows"
                  :href="v.downloads.windows"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  title="Windows"
                >
                  <span>🪟</span>
                  <span class="underline">Windows</span>
                </a>
                <a
                  v-if="v.downloads?.macos"
                  :href="v.downloads.macos"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900"
                  title="macOS"
                >
                  <span>🍎</span>
                  <span class="underline">macOS</span>
                </a>
                <a
                  v-if="v.downloads?.linux"
                  :href="v.downloads.linux"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                  title="Linux"
                >
                  <span>🐧</span>
                  <span class="underline">Linux</span>
                </a>
                <span
                  v-if="!v.downloads?.windows && !v.downloads?.macos && !v.downloads?.linux"
                  class="text-xs text-gray-300"
                >—</span>
              </div>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
              {{ formatDate(v.releasedAt) }}
            </td>
            <td class="px-4 py-3">
              <button
                type="button"
                role="switch"
                :aria-checked="!!v.forced"
                :class="[
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  v.forced ? 'bg-red-500' : 'bg-gray-200'
                ]"
                @click="onToggleForce(v)"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    v.forced ? 'translate-x-4' : 'translate-x-0.5'
                  ]"
                ></span>
              </button>
              <span
                v-if="v.forced"
                class="ml-2 text-xs text-red-600"
              >强制</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="inline-flex items-center gap-2">
                <button
                  type="button"
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="openEdit(v)"
                >编辑</button>
                <button
                  type="button"
                  class="text-xs text-red-600 hover:text-red-700"
                  @click="onDelete(v)"
                >删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && filteredList.length === 0">
            <td
              colspan="7"
              class="px-4 py-12 text-center text-gray-400"
            >
              暂无版本记录
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
              {{ form.id ? '编辑版本' : '添加版本' }}
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
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  版本号 <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.version"
                  type="text"
                  required
                  placeholder="例如：1.2.0"
                  class="wpx-input font-mono"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  渠道
                </label>
                <select
                  v-model="form.channel"
                  class="wpx-input"
                >
                  <option value="stable">稳定版</option>
                  <option value="beta">测试版</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                更新日志（Markdown） <span class="text-red-500">*</span>
              </label>
              <textarea
                v-model="form.changelog"
                rows="8"
                required
                placeholder="支持 Markdown：&#10;## 1.2.0 更新&#10;- 新增 xx 功能&#10;- 优化 xx 体验&#10;- 修复 xx 问题"
                class="wpx-input resize-none font-mono text-xs"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                平台下载链接
              </label>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="w-20 text-xs text-gray-500 shrink-0">🪟 Windows</span>
                  <input
                    v-model="form.downloads.windows"
                    type="url"
                    placeholder="https://example.com/wpx-1.2.0-win.exe"
                    class="wpx-input flex-1"
                  >
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-20 text-xs text-gray-500 shrink-0">🍎 macOS</span>
                  <input
                    v-model="form.downloads.macos"
                    type="url"
                    placeholder="https://example.com/wpx-1.2.0-mac.dmg"
                    class="wpx-input flex-1"
                  >
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-20 text-xs text-gray-500 shrink-0">🐧 Linux</span>
                  <input
                    v-model="form.downloads.linux"
                    type="url"
                    placeholder="https://example.com/wpx-1.2.0-linux.AppImage"
                    class="wpx-input flex-1"
                  >
                </div>
              </div>
              <p class="text-xs text-gray-400 mt-1">留空表示该平台暂不发布</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  发布时间
                </label>
                <input
                  v-model="form.releasedAt"
                  type="datetime-local"
                  class="wpx-input"
                >
              </div>
              <div class="flex items-end">
                <label class="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="form.forced"
                    type="checkbox"
                    class="rounded border-gray-300 text-red-500 focus:ring-red-500"
                  >
                  <span class="text-sm text-gray-700">
                    <span class="font-medium">开启强制更新</span>
                    <span class="block text-xs text-gray-400">
                      开启后旧版本用户启动时将强制升级
                    </span>
                  </span>
                </label>
              </div>
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
  fetchVersions,
  createVersion,
  updateVersion,
  toggleVersionForce,
  deleteVersion
} from '@/utils/announcements-api'

defineOptions({ name: 'VersionView' })

// ============ State ============
const list = ref([])
const loading = ref(false)
const filters = reactive({ keyword: '', channel: '' })

const filteredList = computed(() => {
  const kw = filters.keyword.trim().toLowerCase()
  return list.value
    .filter((v) => {
      if (kw && !(v.version || '').toLowerCase().includes(kw)) return false
      if (filters.channel && v.channel !== filters.channel) return false
      return true
    })
    .sort((a, b) => sortByVersionDesc(a.version, b.version))
})

/**
 * 计算当前最新稳定版
 */
const latestStableId = computed(() => {
  const stables = list.value.filter((v) => v.channel !== 'beta')
  if (!stables.length) return null
  stables.sort((a, b) => sortByVersionDesc(a.version, b.version))
  return stables[0].id
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchVersions()
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
      id: 'v3',
      version: '1.2.0',
      channel: 'stable',
      changelog:
        '## 1.2.0 更新\n\n- ✨ 全新 Skills 商店，支持在线检索与一键启用\n- ⚡ 文档编辑器性能优化 30%\n- 🎨 字体预览改版\n- 🐛 修复若干已知问题',
      downloads: {
        windows: 'https://example.com/wpx-1.2.0-win.exe',
        macos: 'https://example.com/wpx-1.2.0-mac.dmg',
        linux: ''
      },
      forced: false,
      releasedAt: now - oneDay,
      createdAt: now - 2 * oneDay
    },
    {
      id: 'v2',
      version: '1.1.5',
      channel: 'stable',
      changelog:
        '## 1.1.5 修复\n\n- 修复 AI 对话偶发无响应\n- 修复字体库加载缓慢\n- 优化 Windows 启动速度',
      downloads: {
        windows: 'https://example.com/wpx-1.1.5-win.exe',
        macos: 'https://example.com/wpx-1.1.5-mac.dmg',
        linux: 'https://example.com/wpx-1.1.5-linux.AppImage'
      },
      forced: true,
      releasedAt: now - 14 * oneDay,
      createdAt: now - 16 * oneDay
    },
    {
      id: 'v1',
      version: '1.2.0-beta.3',
      channel: 'beta',
      changelog:
        '## 1.2.0-beta.3\n\n- 内测新功能 A\n- 内测新功能 B\n- 已知问题：xx 偶发卡顿',
      downloads: {
        windows: 'https://example.com/wpx-1.2.0-beta.3-win.exe',
        macos: '',
        linux: ''
      },
      forced: false,
      releasedAt: now - 5 * oneDay,
      createdAt: now - 7 * oneDay
    }
  ]
}

function resetFilters() {
  filters.keyword = ''
  filters.channel = ''
}

// ============ Form ============
const formOpen = ref(false)
const formSubmitting = ref(false)
const formError = ref('')
const form = reactive({
  id: '',
  version: '',
  channel: 'stable',
  changelog: '',
  downloads: { windows: '', macos: '', linux: '' },
  releasedAt: '',
  forced: false
})

function resetForm() {
  form.id = ''
  form.version = ''
  form.channel = 'stable'
  form.changelog = ''
  form.downloads = { windows: '', macos: '', linux: '' }
  form.releasedAt = toDateTimeLocal(Date.now())
  form.forced = false
  formError.value = ''
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function openEdit(v) {
  form.id = v.id
  form.version = v.version
  form.channel = v.channel || 'stable'
  form.changelog = v.changelog
  form.downloads = {
    windows: v.downloads?.windows || '',
    macos: v.downloads?.macos || '',
    linux: v.downloads?.linux || ''
  }
  form.releasedAt = toDateTimeLocal(v.releasedAt || Date.now())
  form.forced = !!v.forced
  formError.value = ''
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  formError.value = ''
}

async function onSubmit() {
  formError.value = ''
  if (!form.version.trim()) {
    formError.value = '请填写版本号'
    return
  }
  if (!/^\d+(\.\d+){0,3}([-+][\w.-]+)?$/.test(form.version.trim())) {
    formError.value = '版本号格式不正确，例如 1.2.0 或 1.2.0-beta.1'
    return
  }
  if (!form.changelog.trim()) {
    formError.value = '请填写更新日志'
    return
  }

  formSubmitting.value = true
  try {
    const payload = {
      version: form.version.trim(),
      channel: form.channel,
      changelog: form.changelog,
      downloads: {
        windows: form.downloads.windows.trim() || null,
        macos: form.downloads.macos.trim() || null,
        linux: form.downloads.linux.trim() || null
      },
      releasedAt: parseDateTimeLocal(form.releasedAt) || Date.now(),
      forced: !!form.forced
    }
    if (form.id) {
      const updated = await updateVersion(form.id, payload)
      mergeItem(updated)
    } else {
      const created = await createVersion(payload)
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

async function onToggleForce(v) {
  const next = !v.forced
  const original = v.forced
  v.forced = next
  try {
    const updated = await toggleVersionForce(v.id, next)
    if (updated && updated.id) mergeItem(updated)
  } catch (err) {
    v.forced = original
    // eslint-disable-next-line no-console
    console.error('[Version] toggle force failed:', err)
  }
}

async function onDelete(v) {
  const ok = window.confirm(`确定删除版本 v${v.version}？`)
  if (!ok) return
  const original = list.value.slice()
  list.value = list.value.filter((x) => x.id !== v.id)
  try {
    await deleteVersion(v.id)
  } catch (err) {
    list.value = original
    // eslint-disable-next-line no-console
    console.error('[Version] delete failed:', err)
  }
}

// ============ Helpers ============
function summarize(content, limit = 80) {
  if (!content) return ''
  const plain = content
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > limit ? plain.slice(0, limit) + '…' : plain
}

function formatDate(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('zh-CN')
}

function toDateTimeLocal(t) {
  if (!t) return ''
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseDateTimeLocal(s) {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * 版本号降序比较（支持 semver + 预发布后缀）
 *   1.2.0 > 1.1.5 > 1.2.0-beta.3
 */
function sortByVersionDesc(a, b) {
  const parse = (v) => {
    const [main, pre] = String(v).split('-')
    const parts = main.split('.').map((n) => parseInt(n, 10) || 0)
    while (parts.length < 3) parts.push(0)
    return { parts, pre: pre || '' }
  }
  const A = parse(a)
  const B = parse(b)
  for (let i = 0; i < 3; i++) {
    if (A.parts[i] !== B.parts[i]) return B.parts[i] - A.parts[i]
  }
  // 预发布版本号小（beta.1 < beta.2 < rc.1 < stable）
  if (A.pre && !B.pre) return 1
  if (!A.pre && B.pre) return -1
  if (A.pre && B.pre) return A.pre.localeCompare(B.pre)
  return 0
}

// ============ Lifecycle ============
onMounted(() => {
  loadList()
})
</script>