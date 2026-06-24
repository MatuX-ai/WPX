<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">AI 模型配置</h1>
        <p class="text-sm text-gray-500 mt-1">
          管理 WPX 提供的公共大模型，实时监控调用情况
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-6">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="[
            'pb-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === t.key
              ? 'border-primary-500 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          ]"
          @click="activeTab = t.key"
        >
          {{ t.title }}
        </button>
      </nav>
    </div>

    <!-- ============ Tab 1: 公共模型 ============ -->
    <div
      v-if="activeTab === 'models'"
      class="space-y-4"
    >
      <!-- 操作栏 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <input
            v-model="modelKeyword"
            type="text"
            placeholder="搜索模型名称或 Endpoint"
            class="wpx-input w-72"
          >
          <span class="text-xs text-gray-400">
            共 {{ filteredModels.length }} 条
          </span>
        </div>
        <button
          type="button"
          class="wpx-btn-primary"
          @click="openCreate"
        >
          <span>+</span>
          <span>添加模型</span>
        </button>
      </div>

      <!-- 模型列表 -->
      <div class="wpx-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-4 py-3 font-medium">名称</th>
              <th class="text-left px-4 py-3 font-medium">Endpoint</th>
              <th class="text-left px-4 py-3 font-medium">日免费上限</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">最近更新</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="m in filteredModels"
              :key="m.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ m.name }}</div>
                <div
                  v-if="m.remark"
                  class="text-xs text-gray-400 truncate max-w-[200px]"
                >
                  {{ m.remark }}
                </div>
              </td>
              <td class="px-4 py-3 text-gray-600 font-mono text-xs truncate max-w-[280px]">
                {{ m.endpoint }}
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-700">
                {{ formatNumber(m.dailyFreeLimit) }} <span class="text-xs text-gray-400">次/天</span>
              </td>
              <td class="px-4 py-3">
                <span :class="m.enabled ? 'wpx-badge-success' : 'wpx-badge-gray'">
                  {{ m.enabled ? '● 启用中' : '○ 已停用' }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-gray-500">
                {{ formatTime(m.updatedAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-primary-600 hover:text-primary-700"
                    @click="openEdit(m)"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    class="text-xs text-gray-600 hover:text-gray-700"
                    @click="onToggle(m)"
                  >
                    {{ m.enabled ? '停用' : '启用' }}
                  </button>
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700"
                    @click="onDelete(m)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!modelsLoading && filteredModels.length === 0">
              <td
                colspan="6"
                class="px-4 py-12 text-center text-gray-400"
              >
                暂无模型，点击右上角"添加模型"开始
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ Tab 2: 调用监控 ============ -->
    <div
      v-else
      class="space-y-4"
    >
      <!-- 监控顶部：4 个指标 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">实时 QPS</div>
          <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
            {{ monitorLoading ? '—' : monitor.qps.toFixed(2) }}
          </div>
          <div class="text-xs text-gray-400 mt-1">每秒请求数（最近 60s）</div>
        </div>
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">今日调用量</div>
          <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
            {{ monitorLoading ? '—' : formatNumber(monitor.todayTotal) }}
          </div>
          <div class="text-xs text-gray-400 mt-1">免费 + 付费合计</div>
        </div>
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">成功率</div>
          <div
            class="text-2xl font-bold tabular-nums mt-1"
            :class="successRateColor"
          >
            {{ monitorLoading ? '—' : (monitor.successRate * 100).toFixed(1) + '%' }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            失败 {{ formatNumber(monitor.todayTotal - Math.round(monitor.todayTotal * monitor.successRate)) }} 次
          </div>
        </div>
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">在线模型</div>
          <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
            {{ enabledModels.length }} <span class="text-base text-gray-400">/ {{ models.length }}</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">启用的模型数量</div>
        </div>
      </div>

      <!-- 按模型分布 + 错误日志 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- 按模型分布 -->
        <div class="wpx-card p-4 lg:col-span-1">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-900">按模型分布</h2>
            <span class="text-xs text-gray-400">今日</span>
          </div>
          <ul
            v-if="monitor.perModel.length"
            class="space-y-2"
          >
            <li
              v-for="(m, idx) in monitor.perModel"
              :key="m.id || m.name"
              class="space-y-1"
            >
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-700 truncate">{{ m.name }}</span>
                <span class="tabular-nums text-gray-900">{{ formatNumber(m.count) }}</span>
              </div>
              <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{
                    width: ((m.count / maxPerModel) * 100).toFixed(1) + '%',
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg,#2563EB,#7C3AED)'
                        : '#A5B4FC'
                  }"
                ></div>
              </div>
            </li>
          </ul>
          <div
            v-else
            class="text-sm text-gray-400 py-8 text-center"
          >
            暂无数据
          </div>
        </div>

        <!-- 错误日志 -->
        <div class="wpx-card p-4 lg:col-span-2">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-900">错误日志（最近 100 条）</h2>
            <button
              type="button"
              class="text-xs text-primary-600 hover:text-primary-700"
              :disabled="monitorLoading"
              @click="loadMonitor(true)"
            >
              {{ monitorLoading ? '刷新中…' : '🔄 刷新' }}
            </button>
          </div>
          <div
            v-if="errorLogs.length"
            class="overflow-auto"
            style="max-height: 380px;"
          >
            <table class="w-full text-sm">
              <thead class="text-xs text-gray-500 uppercase tracking-wide sticky top-0 bg-white">
                <tr>
                  <th class="text-left py-2 font-medium">时间</th>
                  <th class="text-left py-2 font-medium">模型</th>
                  <th class="text-left py-2 font-medium">用户</th>
                  <th class="text-left py-2 font-medium">错误信息</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(e, idx) in errorLogs"
                  :key="idx"
                  class="hover:bg-gray-50/60"
                >
                  <td class="py-2 text-xs text-gray-500 whitespace-nowrap">
                    {{ formatTime(e.time || e.createdAt) }}
                  </td>
                  <td class="py-2 text-gray-700 truncate max-w-[140px]">
                    {{ e.model || e.modelName || '—' }}
                  </td>
                  <td class="py-2 text-gray-600 truncate max-w-[140px]">
                    {{ e.user || e.userEmail || '—' }}
                  </td>
                  <td class="py-2 text-red-600 truncate max-w-[280px]" :title="e.message || e.error">
                    {{ e.message || e.error }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-else
            class="text-sm text-gray-400 py-12 text-center"
          >
            🎉 暂无错误日志
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 添加/编辑模型弹窗 ============ -->
    <transition name="page">
      <div
        v-if="formOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeForm"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900">
              {{ form.id ? '编辑模型' : '添加模型' }}
            </h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="closeForm"
            >
              ✕
            </button>
          </div>

          <form
            class="px-5 py-4 space-y-4"
            @submit.prevent="onSubmitForm"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                模型名称 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                required
                placeholder="例如：DeepSeek-V3"
                class="wpx-input"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                API Endpoint <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.endpoint"
                type="url"
                required
                placeholder="https://api.deepseek.com/v1/chat/completions"
                class="wpx-input font-mono text-xs"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div class="relative">
                <input
                  v-model="form.apiKey"
                  :type="showKey ? 'text' : 'password'"
                  :placeholder="form.id ? '留空表示不修改' : 'sk-...'"
                  class="wpx-input font-mono text-xs pr-20"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  @click="showKey = !showKey"
                >
                  {{ showKey ? '隐藏' : '显示' }}
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                密钥仅加密存储在服务端，不会明文返回
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                每日免费调用上限
              </label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="form.dailyFreeLimit"
                  type="number"
                  min="0"
                  step="1"
                  class="wpx-input"
                >
                <span class="text-sm text-gray-500 whitespace-nowrap">次 / 设备 / 天</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">默认 50；设为 0 表示不限制</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                备注
              </label>
              <textarea
                v-model="form.remark"
                rows="2"
                placeholder="可选：用途说明、价格、上下文长度等"
                class="wpx-input resize-none"
              ></textarea>
            </div>

            <div class="flex items-center gap-2">
              <input
                id="model-enabled"
                v-model="form.enabled"
                type="checkbox"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              >
              <label
                for="model-enabled"
                class="text-sm text-gray-700 select-none cursor-pointer"
              >
                立即启用
              </label>
            </div>

            <div
              v-if="formError"
              class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {{ formError }}
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                class="wpx-btn-secondary"
                @click="closeForm"
              >
                取消
              </button>
              <button
                type="submit"
                class="wpx-btn-primary"
                :disabled="formSubmitting"
              >
                {{ formSubmitting ? '保存中…' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  fetchModels,
  createModel,
  updateModel,
  toggleModelStatus,
  deleteModel,
  fetchMonitorOverview,
  fetchErrorLogs
} from '@/utils/models-api'

defineOptions({ name: 'ModelConfigView' })

// ============ Tabs ============
const tabs = [
  { key: 'models', title: '公共模型' },
  { key: 'monitor', title: '调用监控' }
]
const activeTab = ref('models')

// ============ 公共模型 ============
const models = ref([])
const modelsLoading = ref(false)
const modelKeyword = ref('')

const filteredModels = computed(() => {
  const kw = modelKeyword.value.trim().toLowerCase()
  if (!kw) return models.value
  return models.value.filter(
    (m) =>
      (m.name || '').toLowerCase().includes(kw) ||
      (m.endpoint || '').toLowerCase().includes(kw)
  )
})

const enabledModels = computed(() => models.value.filter((m) => m.enabled))

async function loadModels() {
  modelsLoading.value = true
  try {
    const data = await fetchModels()
    if (Array.isArray(data)) {
      models.value = data
    } else if (data && Array.isArray(data.list)) {
      models.value = data.list
    } else {
      // 后端不可用：使用 demo 数据
      models.value = demoModels()
    }
  } finally {
    modelsLoading.value = false
  }
}

function demoModels() {
  return [
    {
      id: 'm1',
      name: 'DeepSeek-V3',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      dailyFreeLimit: 50,
      enabled: true,
      remark: '通用对话主力模型，性价比高',
      updatedAt: Date.now() - 1000 * 60 * 60 * 2
    },
    {
      id: 'm2',
      name: 'GPT-4o-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      dailyFreeLimit: 30,
      enabled: true,
      remark: '多模态小模型',
      updatedAt: Date.now() - 1000 * 60 * 60 * 24
    },
    {
      id: 'm3',
      name: 'Qwen2.5-72B',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      dailyFreeLimit: 0,
      enabled: false,
      remark: '中文场景备用，已停用',
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7
    }
  ]
}

// ============ 表单弹窗 ============
const formOpen = ref(false)
const formSubmitting = ref(false)
const formError = ref('')
const showKey = ref(false)
const form = reactive({
  id: '',
  name: '',
  endpoint: '',
  apiKey: '',
  dailyFreeLimit: 50,
  enabled: true,
  remark: ''
})

function resetForm() {
  form.id = ''
  form.name = ''
  form.endpoint = ''
  form.apiKey = ''
  form.dailyFreeLimit = 50
  form.enabled = true
  form.remark = ''
  formError.value = ''
  showKey.value = false
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function openEdit(m) {
  resetForm()
  form.id = m.id
  form.name = m.name
  form.endpoint = m.endpoint
  form.dailyFreeLimit = m.dailyFreeLimit ?? 50
  form.enabled = !!m.enabled
  form.remark = m.remark || ''
  // 编辑时不回填 key
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  formError.value = ''
}

async function onSubmitForm() {
  formError.value = ''
  if (!form.name.trim()) {
    formError.value = '请填写模型名称'
    return
  }
  if (!form.endpoint.trim()) {
    formError.value = '请填写 API Endpoint'
    return
  }
  if (!/^https?:\/\//i.test(form.endpoint.trim())) {
    formError.value = 'Endpoint 必须以 http:// 或 https:// 开头'
    return
  }
  if (Number(form.dailyFreeLimit) < 0) {
    formError.value = '日免费上限不能为负数'
    return
  }

  formSubmitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      endpoint: form.endpoint.trim(),
      dailyFreeLimit: Number(form.dailyFreeLimit),
      enabled: !!form.enabled,
      remark: form.remark.trim()
    }
    // 仅在填写了 key 时才提交
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim()

    if (form.id) {
      const updated = await updateModel(form.id, payload)
      mergeModel(updated)
    } else {
      const created = await createModel(payload)
      // 服务端通常返回完整对象；若仅返回 id 也兼容
      if (created && created.id) {
        models.value.unshift(created)
      } else {
        await loadModels()
      }
    }
    closeForm()
  } catch (err) {
    formError.value = err?.message || '保存失败'
    // 离线开发环境：本地模拟保存以便预览 UI
    if (import.meta.env.DEV) {
      const fakeId = form.id || 'local-' + Date.now()
      const item = {
        id: fakeId,
        name: payload.name,
        endpoint: payload.endpoint,
        dailyFreeLimit: payload.dailyFreeLimit,
        enabled: payload.enabled,
        remark: payload.remark,
        updatedAt: Date.now()
      }
      if (form.id) {
        mergeModel(item)
      } else {
        models.value.unshift(item)
      }
      closeForm()
    }
  } finally {
    formSubmitting.value = false
  }
}

function mergeModel(item) {
  if (!item || !item.id) return
  const idx = models.value.findIndex((m) => m.id === item.id)
  if (idx >= 0) models.value[idx] = { ...models.value[idx], ...item }
  else models.value.unshift(item)
}

async function onToggle(m) {
  const next = !m.enabled
  // 乐观更新
  m.enabled = next
  try {
    const updated = await toggleModelStatus(m.id, next)
    mergeModel(updated)
  } catch (err) {
    // 回滚
    m.enabled = !next
    // eslint-disable-next-line no-console
    console.error('[ModelConfig] toggle failed:', err)
  }
}

async function onDelete(m) {
  const ok = window.confirm(`确定删除模型「${m.name}」？该操作不可恢复。`)
  if (!ok) return
  const originalList = models.value.slice()
  models.value = models.value.filter((x) => x.id !== m.id)
  try {
    await deleteModel(m.id)
  } catch (err) {
    // 回滚
    models.value = originalList
    // eslint-disable-next-line no-console
    console.error('[ModelConfig] delete failed:', err)
  }
}

// ============ 调用监控 ============
const monitorLoading = ref(false)
const monitor = reactive({
  qps: 0,
  todayTotal: 0,
  successRate: 1,
  perModel: []
})
const errorLogs = ref([])
const maxPerModel = computed(() => {
  if (!monitor.perModel.length) return 1
  return Math.max(...monitor.perModel.map((m) => Number(m.count) || 0), 1)
})

const successRateColor = computed(() => {
  const r = monitor.successRate
  if (r >= 0.99) return 'text-emerald-600'
  if (r >= 0.95) return 'text-amber-600'
  return 'text-red-600'
})

async function loadMonitor(manual = false) {
  monitorLoading.value = true
  try {
    const [ov, errs] = await Promise.all([
      fetchMonitorOverview(),
      fetchErrorLogs(100)
    ])

    if (ov && typeof ov === 'object') {
      monitor.qps = Number(ov.qps) || 0
      monitor.todayTotal = Number(ov.todayTotal) || 0
      monitor.successRate = Number(ov.successRate ?? 1)
      monitor.perModel = Array.isArray(ov.perModel) ? ov.perModel : []
    } else if (manual || !bootstrappedMonitor.value) {
      // 后端不可用 + 首次加载 / 手动刷新：注入 demo 数据
      Object.assign(monitor, demoMonitor())
    }

    if (Array.isArray(errs)) {
      errorLogs.value = errs
    } else if (errs && Array.isArray(errs.list)) {
      errorLogs.value = errs.list
    } else if (manual || !bootstrappedMonitor.value) {
      errorLogs.value = demoErrors()
    }
  } finally {
    monitorLoading.value = false
    bootstrappedMonitor.value = true
  }
}

const bootstrappedMonitor = ref(false)

function demoMonitor() {
  return {
    qps: 12.34,
    todayTotal: 8421,
    successRate: 0.987,
    perModel: [
      { id: 'm1', name: 'DeepSeek-V3', count: 5120 },
      { id: 'm2', name: 'GPT-4o-mini', count: 2480 },
      { id: 'm3', name: 'Qwen2.5-72B', count: 821 }
    ]
  }
}

function demoErrors() {
  const models = ['DeepSeek-V3', 'GPT-4o-mini', 'Qwen2.5-72B']
  const samples = [
    '429 Too Many Requests',
    '503 Service Unavailable',
    'context length exceeded',
    'invalid api key',
    'upstream timeout (30s)',
    'rate limit reached for tier'
  ]
  const out = []
  for (let i = 0; i < 12; i++) {
    out.push({
      time: Date.now() - i * 1000 * 60 * (3 + Math.random() * 8),
      model: models[i % models.length],
      user: `user${1000 + i}@example.com`,
      message: samples[i % samples.length]
    })
  }
  return out
}

// ============ Helpers ============
function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN')
}

function formatTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  const now = Date.now()
  const diff = now - d.getTime()
  // 1 天内：相对时间；更早：完整时间
  if (diff < 1000 * 60 * 60 * 24) {
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return `${m} 分钟前`
    const h = Math.floor(m / 60)
    return `${h} 小时前`
  }
  return d.toLocaleString('zh-CN', { hour12: false })
}

// ============ Lifecycle ============
let monitorTimer = null

onMounted(async () => {
  await loadModels()
  // 默认切换到监控 Tab 时再加载；若默认就在监控 Tab 也加载一次
  if (activeTab.value === 'monitor') {
    await loadMonitor()
  }
  // 监控数据 15 秒刷新（仪表盘是 30s，这里更密集一些）
  monitorTimer = setInterval(() => {
    if (activeTab.value === 'monitor') loadMonitor(false)
  }, 15 * 1000)
})

onBeforeUnmount(() => {
  if (monitorTimer) clearInterval(monitorTimer)
})
</script>