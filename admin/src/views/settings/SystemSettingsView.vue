<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">系统设置</h1>
        <p class="text-sm text-gray-500 mt-1">
          系统配置、CDN 地址、管理员账号
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

    <!-- ============ Tab 1: 系统配置 ============ -->
    <div
      v-if="activeTab === 'system'"
      class="space-y-4"
    >
      <div class="wpx-card p-6 max-w-2xl space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            应用名称
          </label>
          <input
            v-model="systemForm.appName"
            type="text"
            maxlength="40"
            placeholder="例如：WPX 智能文档编辑器"
            class="wpx-input"
          >
          <p class="text-xs text-gray-400 mt-1">
            显示在登录页、浏览器标签、桌面应用标题栏
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            免费 AI 次数上限（每日）
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="systemForm.freeAiLimit"
              type="number"
              min="0"
              max="10000"
              step="1"
              class="wpx-input w-32"
            >
            <span class="text-sm text-gray-500">次 / 用户 / 日</span>
          </div>
          <p class="text-xs text-gray-400 mt-1">
            新用户注册后每日可免费调用 AI 的次数
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            最大窗口数
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="systemForm.maxWindows"
              type="number"
              min="1"
              max="20"
              step="1"
              class="wpx-input w-32"
            >
            <span class="text-sm text-gray-500">个</span>
          </div>
          <p class="text-xs text-gray-400 mt-1">
            单个用户最多同时打开的文档窗口数量
          </p>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <div class="text-sm font-medium text-gray-900">开放用户注册</div>
            <div class="text-xs text-gray-500 mt-0.5">
              关闭后仅允许通过管理员邀请添加账号
            </div>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="systemForm.registrationOpen"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              systemForm.registrationOpen ? 'bg-emerald-500' : 'bg-gray-300'
            ]"
            @click="systemForm.registrationOpen = !systemForm.registrationOpen"
          >
            <span
              :class="[
                'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                systemForm.registrationOpen ? 'translate-x-5' : 'translate-x-0.5'
              ]"
            ></span>
          </button>
        </div>

        <div
          v-if="systemMessage"
          :class="[
            'text-sm rounded-lg px-3 py-2',
            systemMessage.type === 'success'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
              : 'text-red-600 bg-red-50 border border-red-100'
          ]"
        >
          {{ systemMessage.text }}
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 max-w-2xl">
        <button
          type="button"
          class="wpx-btn-secondary"
          :disabled="systemSaving"
          @click="loadSystem"
        >
          重置
        </button>
        <button
          type="button"
          class="wpx-btn-primary"
          :disabled="systemSaving"
          @click="saveSystem"
        >
          {{ systemSaving ? '保存中…' : '保存设置' }}
        </button>
      </div>
    </div>

    <!-- ============ Tab 2: CDN 配置 ============ -->
    <div
      v-else-if="activeTab === 'cdn'"
      class="space-y-4"
    >
      <div class="wpx-card p-6 max-w-2xl space-y-4">
        <div class="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 class="text-sm font-semibold text-gray-900">CDN 资源地址</h2>
            <p class="text-xs text-gray-500 mt-1">
              配置字体、Skills 数据、安装包的 CDN 加速地址
            </p>
          </div>
          <button
            type="button"
            class="text-xs text-primary-600 hover:text-primary-700"
            @click="resetCdnToDefault"
          >恢复默认</button>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <span class="inline-flex items-center gap-1.5">
              <span>🅰</span>
              字体 CDN
            </span>
          </label>
          <input
            v-model="cdnForm.fonts"
            type="url"
            placeholder="https://cdn.example.com/fonts"
            class="wpx-input"
          >
          <p class="text-xs text-gray-400 mt-1">
            字体库列表与字体文件的 CDN 地址（基础 URL）
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <span class="inline-flex items-center gap-1.5">
              <span>⚡</span>
              Skills CDN
            </span>
          </label>
          <input
            v-model="cdnForm.skills"
            type="url"
            placeholder="https://cdn.example.com/skills"
            class="wpx-input"
          >
          <p class="text-xs text-gray-400 mt-1">
            在线 Skills 数据源与图标资源 CDN 地址
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <span class="inline-flex items-center gap-1.5">
              <span>📦</span>
              安装包 CDN
            </span>
          </label>
          <input
            v-model="cdnForm.install"
            type="url"
            placeholder="https://cdn.example.com/wpx"
            class="wpx-input"
          >
          <p class="text-xs text-gray-400 mt-1">
            Windows / macOS / Linux 安装包 CDN 基础地址
          </p>
        </div>

        <!-- 实时连通性检查 -->
        <div class="bg-gray-50 rounded-xl p-4 space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-900">连通性检测</h3>
            <button
              type="button"
              class="text-xs text-primary-600 hover:text-primary-700"
              :disabled="cdnChecking"
              @click="checkCdnHealth"
            >
              {{ cdnChecking ? '检测中…' : '重新检测' }}
            </button>
          </div>
          <ul class="space-y-1.5 text-xs">
            <li
              v-for="item in cdnHealth"
              :key="item.key"
              class="flex items-center justify-between"
            >
              <span class="text-gray-600">{{ item.label }}</span>
              <span :class="item.status === 'ok' ? 'text-emerald-600' : item.status === 'fail' ? 'text-red-600' : 'text-gray-400'">
                {{ item.status === 'ok' ? '✓ 正常' : item.status === 'fail' ? '✕ 异常' : '— 等待检测' }}
              </span>
            </li>
          </ul>
        </div>

        <div
          v-if="cdnMessage"
          :class="[
            'text-sm rounded-lg px-3 py-2',
            cdnMessage.type === 'success'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
              : 'text-red-600 bg-red-50 border border-red-100'
          ]"
        >
          {{ cdnMessage.text }}
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 max-w-2xl">
        <button
          type="button"
          class="wpx-btn-primary"
          :disabled="cdnSaving"
          @click="saveCdn"
        >
          {{ cdnSaving ? '保存中…' : '保存设置' }}
        </button>
      </div>
    </div>

    <!-- ============ Tab 3: 管理员账号 ============ -->
    <div
      v-else
      class="space-y-4"
    >
      <!-- 筛选 + 添加 -->
      <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">关键字</label>
          <input
            v-model="adminFilters.keyword"
            type="text"
            placeholder="按邮箱 / 姓名搜索"
            class="wpx-input"
          >
        </div>
        <div class="w-36">
          <label class="block text-xs text-gray-500 mb-1">角色</label>
          <select
            v-model="adminFilters.role"
            class="wpx-input"
          >
            <option value="">全部角色</option>
            <option value="super_admin">超级管理员</option>
            <option value="operation_admin">运营管理员</option>
            <option value="content_editor">内容编辑</option>
          </select>
        </div>
        <div class="w-28">
          <label class="block text-xs text-gray-500 mb-1">状态</label>
          <select
            v-model="adminFilters.status"
            class="wpx-input"
          >
            <option value="">全部</option>
            <option value="active">正常</option>
            <option value="disabled">已停用</option>
          </select>
        </div>
        <button
          type="button"
          class="wpx-btn-secondary"
          @click="resetAdminFilters"
        >重置</button>
        <button
          type="button"
          class="wpx-btn-primary ml-auto"
          @click="openCreateAdmin"
        >
          + 添加管理员
        </button>
      </div>

      <!-- 列表 -->
      <div class="wpx-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-4 py-3 font-medium">账号</th>
              <th class="text-left px-4 py-3 font-medium">角色</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">最近登录</th>
              <th class="text-left px-4 py-3 font-medium">创建时间</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="a in filteredAdmins"
              :key="a.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ a.name || a.email }}</div>
                <div class="text-xs text-gray-400">{{ a.email }}</div>
              </td>
              <td class="px-4 py-3">
                <select
                  :value="a.role"
                  class="wpx-input w-36 text-xs py-1"
                  :disabled="a.id === currentAdminId"
                  @change="onChangeRole(a, $event.target.value)"
                >
                  <option value="super_admin">超级管理员</option>
                  <option value="operation_admin">运营管理员</option>
                  <option value="content_editor">内容编辑</option>
                </select>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  :class="[
                    'wpx-badge cursor-pointer',
                    a.status === 'active' ? 'wpx-badge-success' : 'wpx-badge-gray'
                  ]"
                  :disabled="a.id === currentAdminId"
                  @click="onToggleAdminStatus(a)"
                >
                  {{ a.status === 'active' ? '● 正常' : '○ 停用' }}
                </button>
              </td>
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                {{ formatDateTime(a.lastLoginAt) }}
              </td>
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                {{ formatDate(a.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-primary-600 hover:text-primary-700"
                    @click="openEditAdmin(a)"
                  >编辑</button>
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700"
                    :disabled="a.id === currentAdminId"
                    @click="onDeleteAdmin(a)"
                  >删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="!adminLoading && filteredAdmins.length === 0">
              <td
                colspan="6"
                class="px-4 py-12 text-center text-gray-400"
              >
                暂无管理员
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ 管理员表单弹窗 ============ -->
    <transition name="page">
      <div
        v-if="adminFormOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeAdminForm"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900">
              {{ adminForm.id ? '编辑管理员' : '添加管理员' }}
            </h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="closeAdminForm"
            >✕</button>
          </div>

          <form
            class="px-5 py-4 space-y-4"
            @submit.prevent="onSubmitAdmin"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                邮箱 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="adminForm.email"
                type="email"
                required
                :disabled="!!adminForm.id"
                placeholder="admin@example.com"
                class="wpx-input"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                姓名
              </label>
              <input
                v-model="adminForm.name"
                type="text"
                maxlength="40"
                placeholder="管理员姓名"
                class="wpx-input"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                角色 <span class="text-red-500">*</span>
              </label>
              <select
                v-model="adminForm.role"
                class="wpx-input"
                required
              >
                <option value="super_admin">超级管理员</option>
                <option value="operation_admin">运营管理员</option>
                <option value="content_editor">内容编辑</option>
              </select>
            </div>

            <div v-if="!adminForm.id">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                初始密码 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="adminForm.password"
                type="text"
                required
                minlength="6"
                placeholder="至少 6 位"
                class="wpx-input"
              >
              <p class="text-xs text-gray-400 mt-1">
                添加后请通知管理员尽快修改密码
              </p>
            </div>

            <div
              v-if="adminFormError"
              class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {{ adminFormError }}
            </div>
          </form>

          <div class="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              class="wpx-btn-secondary"
              @click="closeAdminForm"
            >取消</button>
            <button
              type="button"
              class="wpx-btn-primary"
              :disabled="adminFormSubmitting"
              @click="onSubmitAdmin"
            >
              {{ adminFormSubmitting ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import {
  fetchSystemConfig,
  updateSystemConfig,
  fetchCdnConfig,
  updateCdnConfig,
  fetchAdmins,
  createAdmin,
  updateAdmin,
  setAdminRole,
  setAdminStatus,
  deleteAdmin
} from '@/utils/settings-api'

defineOptions({ name: 'SystemSettingsView' })

// 注入当前登录管理员 ID（用于禁止自己改自己）
const currentAdminId = inject('currentAdminId', ref(''))

// ============ Tabs ============
const tabs = [
  { key: 'system', title: '系统配置' },
  { key: 'cdn', title: 'CDN 地址' },
  { key: 'admins', title: '管理员账号' }
]
const activeTab = ref('system')

// ============ 系统配置 ============
const systemForm = reactive({
  appName: 'WPX 智能文档编辑器',
  freeAiLimit: 20,
  maxWindows: 5,
  registrationOpen: true
})
const systemMessage = ref(null)
const systemSaving = ref(false)

async function loadSystem() {
  const data = await fetchSystemConfig()
  if (data && typeof data === 'object') {
    Object.assign(systemForm, data)
  } else {
    Object.assign(systemForm, {
      appName: 'WPX 智能文档编辑器',
      freeAiLimit: 20,
      maxWindows: 5,
      registrationOpen: true
    })
  }
}

async function saveSystem() {
  systemMessage.value = null
  if (!systemForm.appName.trim()) {
    systemMessage.value = { type: 'error', text: '应用名称不能为空' }
    return
  }
  systemSaving.value = true
  try {
    const updated = await updateSystemConfig({ ...systemForm })
    if (updated && typeof updated === 'object') {
      Object.assign(systemForm, updated)
    }
    systemMessage.value = { type: 'success', text: '已保存系统配置' }
  } catch (err) {
    systemMessage.value = { type: 'error', text: err?.message || '保存失败' }
  } finally {
    systemSaving.value = false
  }
}

// ============ CDN 配置 ============
const DEFAULT_CDN = {
  fonts: 'https://cdn.proclaw.cc/fonts',
  skills: 'https://cdn.proclaw.cc/skills',
  install: 'https://cdn.proclaw.cc/wpx'
}

const cdnForm = reactive({ ...DEFAULT_CDN })
const cdnMessage = ref(null)
const cdnSaving = ref(false)
const cdnChecking = ref(false)
const cdnHealth = ref([
  { key: 'fonts', label: '字体 CDN', status: 'idle' },
  { key: 'skills', label: 'Skills CDN', status: 'idle' },
  { key: 'install', label: '安装包 CDN', status: 'idle' }
])

async function loadCdn() {
  const data = await fetchCdnConfig()
  if (data && typeof data === 'object') {
    cdnForm.fonts = data.fonts || DEFAULT_CDN.fonts
    cdnForm.skills = data.skills || DEFAULT_CDN.skills
    cdnForm.install = data.install || DEFAULT_CDN.install
  }
}

function resetCdnToDefault() {
  Object.assign(cdnForm, DEFAULT_CDN)
}

async function checkCdnHealth() {
  cdnChecking.value = true
  // 模拟检测：依次 ping 各 URL
  for (const item of cdnHealth.value) {
    item.status = 'idle'
  }
  await new Promise((r) => setTimeout(r, 400))
  for (const item of cdnHealth.value) {
    const url = cdnForm[item.key]
    if (!url || !/^https?:\/\//i.test(url)) {
      item.status = 'fail'
      continue
    }
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 3000)
      // 仅 HEAD 请求避免下载大文件
      const res = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: ctrl.signal
      }).catch(() => null)
      clearTimeout(t)
      item.status = res && res.ok ? 'ok' : 'fail'
    } catch (_e) {
      item.status = 'fail'
    }
  }
  cdnChecking.value = false
}

async function saveCdn() {
  cdnMessage.value = null
  for (const k of ['fonts', 'skills', 'install']) {
    const v = cdnForm[k]?.trim()
    if (v && !/^https?:\/\//i.test(v)) {
      cdnMessage.value = { type: 'error', text: `${k} CDN 地址必须以 http(s):// 开头` }
      return
    }
  }
  cdnSaving.value = true
  try {
    const updated = await updateCdnConfig({
      fonts: cdnForm.fonts.trim() || null,
      skills: cdnForm.skills.trim() || null,
      install: cdnForm.install.trim() || null
    })
    if (updated && typeof updated === 'object') Object.assign(cdnForm, updated)
    cdnMessage.value = { type: 'success', text: '已保存 CDN 配置' }
  } catch (err) {
    cdnMessage.value = { type: 'error', text: err?.message || '保存失败' }
  } finally {
    cdnSaving.value = false
  }
}

// ============ 管理员账号 ============
const admins = ref([])
const adminLoading = ref(false)
const adminFilters = reactive({ keyword: '', role: '', status: '' })

const filteredAdmins = computed(() => {
  const kw = adminFilters.keyword.trim().toLowerCase()
  return admins.value.filter((a) => {
    if (kw) {
      const text = ((a.email || '') + ' ' + (a.name || '')).toLowerCase()
      if (!text.includes(kw)) return false
    }
    if (adminFilters.role && a.role !== adminFilters.role) return false
    if (adminFilters.status && a.status !== adminFilters.status) return false
    return true
  })
})

async function loadAdmins() {
  adminLoading.value = true
  try {
    const data = await fetchAdmins()
    if (Array.isArray(data)) {
      admins.value = data
    } else if (data && Array.isArray(data.list)) {
      admins.value = data.list
    } else {
      admins.value = demoAdmins()
    }
  } finally {
    adminLoading.value = false
  }
}

function demoAdmins() {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  return [
    {
      id: 'a1',
      email: 'super@proclaw.cc',
      name: '超级管理员',
      role: 'super_admin',
      status: 'active',
      lastLoginAt: now - 2 * 60 * 60 * 1000,
      createdAt: now - 365 * oneDay
    },
    {
      id: 'a2',
      email: 'op@proclaw.cc',
      name: '运营小王',
      role: 'operation_admin',
      status: 'active',
      lastLoginAt: now - 30 * 60 * 1000,
      createdAt: now - 90 * oneDay
    },
    {
      id: 'a3',
      email: 'editor@proclaw.cc',
      name: '内容编辑小李',
      role: 'content_editor',
      status: 'active',
      lastLoginAt: now - 5 * oneDay,
      createdAt: now - 60 * oneDay
    },
    {
      id: 'a4',
      email: 'old@proclaw.cc',
      name: '前运营',
      role: 'operation_admin',
      status: 'disabled',
      lastLoginAt: now - 90 * oneDay,
      createdAt: now - 200 * oneDay
    }
  ]
}

function resetAdminFilters() {
  adminFilters.keyword = ''
  adminFilters.role = ''
  adminFilters.status = ''
}

const adminFormOpen = ref(false)
const adminFormSubmitting = ref(false)
const adminFormError = ref('')
const adminForm = reactive({
  id: '',
  email: '',
  name: '',
  role: 'operation_admin',
  password: ''
})

function resetAdminForm() {
  adminForm.id = ''
  adminForm.email = ''
  adminForm.name = ''
  adminForm.role = 'operation_admin'
  adminForm.password = ''
  adminFormError.value = ''
}

function openCreateAdmin() {
  resetAdminForm()
  adminFormOpen.value = true
}

function openEditAdmin(a) {
  resetAdminForm()
  adminForm.id = a.id
  adminForm.email = a.email
  adminForm.name = a.name || ''
  adminForm.role = a.role
  adminFormOpen.value = true
}

function closeAdminForm() {
  adminFormOpen.value = false
  adminFormError.value = ''
}

async function onSubmitAdmin() {
  adminFormError.value = ''
  if (!adminForm.email.trim()) {
    adminFormError.value = '请填写邮箱'
    return
  }
  if (!adminForm.id && (!adminForm.password || adminForm.password.length < 6)) {
    adminFormError.value = '初始密码至少 6 位'
    return
  }

  adminFormSubmitting.value = true
  try {
    if (adminForm.id) {
      const payload = {
        name: adminForm.name.trim(),
        role: adminForm.role
      }
      const updated = await updateAdmin(adminForm.id, payload)
      if (updated && updated.id) mergeAdmin(updated)
    } else {
      const payload = {
        email: adminForm.email.trim(),
        name: adminForm.name.trim(),
        role: adminForm.role,
        password: adminForm.password
      }
      const created = await createAdmin(payload)
      if (created && created.id) {
        admins.value.unshift(created)
      } else {
        await loadAdmins()
      }
    }
    closeAdminForm()
  } catch (err) {
    adminFormError.value = err?.message || '保存失败'
  } finally {
    adminFormSubmitting.value = false
  }
}

function mergeAdmin(item) {
  const idx = admins.value.findIndex((x) => x.id === item.id)
  if (idx >= 0) admins.value[idx] = { ...admins.value[idx], ...item }
  else admins.value.unshift(item)
}

async function onChangeRole(a, role) {
  if (a.id === currentAdminId.value) return
  const original = a.role
  a.role = role
  try {
    const updated = await setAdminRole(a.id, role)
    if (updated && updated.id) mergeAdmin(updated)
  } catch (err) {
    a.role = original
    // eslint-disable-next-line no-console
    console.error('[Admin] change role failed:', err)
  }
}

async function onToggleAdminStatus(a) {
  if (a.id === currentAdminId.value) return
  const next = a.status === 'active' ? 'disabled' : 'active'
  const original = a.status
  a.status = next
  try {
    const updated = await setAdminStatus(a.id, next)
    if (updated && updated.id) mergeAdmin(updated)
  } catch (err) {
    a.status = original
    // eslint-disable-next-line no-console
    console.error('[Admin] toggle status failed:', err)
  }
}

async function onDeleteAdmin(a) {
  if (a.id === currentAdminId.value) return
  const ok = window.confirm(`确定删除管理员「${a.email}」？此操作不可恢复。`)
  if (!ok) return
  const original = admins.value.slice()
  admins.value = admins.value.filter((x) => x.id !== a.id)
  try {
    await deleteAdmin(a.id)
  } catch (err) {
    admins.value = original
    // eslint-disable-next-line no-console
    console.error('[Admin] delete failed:', err)
  }
}

// ============ Helpers ============
function formatDateTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}
function formatDate(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('zh-CN')
}

// ============ Lifecycle ============
onMounted(async () => {
  await loadSystem()
  await loadCdn()
})
watch(activeTab, async (tab) => {
  if (tab === 'admins' && admins.value.length === 0) {
    await loadAdmins()
  }
})
</script>