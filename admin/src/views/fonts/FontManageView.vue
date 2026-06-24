<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">字体商店管理</h1>
        <p class="text-sm text-gray-500 mt-1">
          管理 WPX 字体库，追踪使用与 Token 消耗
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

    <!-- ============ Tab 1: 字体库 ============ -->
    <div
      v-if="activeTab === 'library'"
      class="space-y-4"
    >
      <!-- 筛选栏 -->
      <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">关键字</label>
          <input
            v-model="filters.keyword"
            type="text"
            placeholder="按字体名称搜索"
            class="wpx-input"
          >
        </div>
        <div class="w-36">
          <label class="block text-xs text-gray-500 mb-1">类型</label>
          <select
            v-model="filters.type"
            class="wpx-input"
          >
            <option value="">全部类型</option>
            <option
              v-for="t in FONT_TYPES"
              :key="t.value"
              :value="t.value"
            >
              {{ t.label }}
            </option>
          </select>
        </div>
        <div class="w-40">
          <label class="block text-xs text-gray-500 mb-1">厂商</label>
          <select
            v-model="filters.vendor"
            class="wpx-input"
          >
            <option value="">全部厂商</option>
            <option
              v-for="v in vendorOptions"
              :key="v"
              :value="v"
            >
              {{ v }}
            </option>
          </select>
        </div>
        <div class="w-32">
          <label class="block text-xs text-gray-500 mb-1">状态</label>
          <select
            v-model="filters.status"
            class="wpx-input"
          >
            <option value="">全部状态</option>
            <option value="on">已上架</option>
            <option value="off">已下架</option>
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
          class="wpx-btn-primary ml-auto"
          @click="openCreate"
        >
          <span>+</span>
          <span>添加字体</span>
        </button>
      </div>

      <!-- 字体列表 -->
      <div class="wpx-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-4 py-3 font-medium">字体</th>
              <th class="text-left px-4 py-3 font-medium">厂商</th>
              <th class="text-left px-4 py-3 font-medium">类型</th>
              <th class="text-left px-4 py-3 font-medium">标签</th>
              <th class="text-left px-4 py-3 font-medium">价格</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">最近更新</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="f in filteredFonts"
              :key="f.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"
                  >
                    <img
                      v-if="f.coverUrl"
                      :src="f.coverUrl"
                      :alt="f.name"
                      class="w-full h-full object-cover"
                    >
                    <span v-else class="text-lg">🔤</span>
                  </div>
                  <div class="min-w-0">
                    <div class="font-medium text-gray-900 truncate">{{ f.name }}</div>
                    <div class="text-xs text-gray-400 truncate">
                      {{ f.fileName || '—' }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-700">{{ f.vendor || '—' }}</td>
              <td class="px-4 py-3">
                <span class="wpx-badge-primary">{{ typeLabel(f.type) }}</span>
              </td>
              <td class="px-4 py-3">
                <div
                  v-if="(f.tags || []).length"
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="tag in f.tags.slice(0, 3)"
                    :key="tag"
                    class="wpx-badge-gray"
                  >{{ tag }}</span>
                  <span
                    v-if="f.tags.length > 3"
                    class="text-xs text-gray-400"
                  >+{{ f.tags.length - 3 }}</span>
                </div>
                <span
                  v-else
                  class="text-xs text-gray-400"
                >—</span>
              </td>
              <td class="px-4 py-3 tabular-nums">
                <span class="text-gray-900">{{ f.pricePerChar }}</span>
                <span class="text-xs text-gray-400 ml-1">Token/字</span>
              </td>
              <td class="px-4 py-3">
                <span :class="f.status === 'on' ? 'wpx-badge-success' : 'wpx-badge-gray'">
                  {{ f.status === 'on' ? '● 已上架' : '○ 已下架' }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-gray-500">
                {{ formatTime(f.updatedAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-primary-600 hover:text-primary-700"
                    @click="openEdit(f)"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    class="text-xs text-gray-600 hover:text-gray-700"
                    @click="onToggleStatus(f)"
                  >
                    {{ f.status === 'on' ? '下架' : '上架' }}
                  </button>
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700"
                    @click="onDelete(f)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!fontsLoading && filteredFonts.length === 0">
              <td
                colspan="8"
                class="px-4 py-12 text-center text-gray-400"
              >
                暂无字体数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ Tab 2: 使用统计 ============ -->
    <div
      v-else
      class="space-y-4"
    >
      <!-- 选择字体 + 时间范围 -->
      <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">选择字体</label>
          <select
            v-model="stats.fontId"
            class="wpx-input"
          >
            <option value="">请选择要查看的字体</option>
            <option
              v-for="f in fonts"
              :key="f.id"
              :value="f.id"
            >
              {{ f.name }}（{{ f.vendor || '未指定厂商' }}）
            </option>
          </select>
        </div>
        <div class="w-40">
          <label class="block text-xs text-gray-500 mb-1">时间范围</label>
          <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              v-for="opt in dayOptions"
              :key="opt.value"
              type="button"
              :class="[
                'px-3 py-2 text-xs transition-colors',
                stats.days === opt.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              ]"
              @click="stats.days = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="!stats.fontId"
        class="wpx-card p-12 text-center text-gray-400"
      >
        请选择一款字体查看统计数据
      </div>

      <template v-else>
        <!-- 累计指标 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="wpx-card p-4">
            <div class="text-sm text-gray-500">累计导出次数</div>
            <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
              {{ statsLoading ? '—' : formatNumber(statsData.totalExports) }}
            </div>
            <div class="text-xs text-gray-400 mt-1">该字体全部时间累计</div>
          </div>
          <div class="wpx-card p-4">
            <div class="text-sm text-gray-500">累计 Token 消耗</div>
            <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
              {{ statsLoading ? '—' : formatNumber(statsData.totalTokens) }}
            </div>
            <div class="text-xs text-gray-400 mt-1">全部时间累计</div>
          </div>
          <div class="wpx-card p-4">
            <div class="text-sm text-gray-500">{{ stats.days }} 日导出</div>
            <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
              {{ statsLoading ? '—' : formatNumber(periodExports) }}
            </div>
            <div class="text-xs text-gray-400 mt-1">最近 {{ stats.days }} 天</div>
          </div>
          <div class="wpx-card p-4">
            <div class="text-sm text-gray-500">{{ stats.days }} 日 Token</div>
            <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
              {{ statsLoading ? '—' : formatNumber(periodTokens) }}
            </div>
            <div class="text-xs text-gray-400 mt-1">最近 {{ stats.days }} 天</div>
          </div>
        </div>

        <!-- 趋势图 + 用户 Top 10 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="wpx-card p-4 lg:col-span-2">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-900">{{ stats.days }} 日使用趋势</h2>
              <span class="text-xs text-gray-400">导出次数 / Token 消耗</span>
            </div>
            <div
              ref="trendChartEl"
              class="echarts-container"
              style="height: 320px;"
            ></div>
          </div>
          <div class="wpx-card p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-900">用户 Top 10</h2>
              <span class="text-xs text-gray-400">累计导出次数</span>
            </div>
            <ul
              v-if="statsData.userTop10?.length"
              class="space-y-2"
            >
              <li
                v-for="(u, idx) in statsData.userTop10"
                :key="u.userId || u.name + idx"
                class="flex items-center gap-3"
              >
                <span
                  class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shrink-0"
                  :class="rankClass(idx)"
                >{{ idx + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-gray-700 truncate">{{ u.name || u.email || u.userId }}</div>
                </div>
                <span class="text-sm tabular-nums text-gray-900">{{ formatNumber(u.exports) }}</span>
              </li>
            </ul>
            <div
              v-else
              class="text-sm text-gray-400 py-12 text-center"
            >
              暂无用户数据
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ============ 添加/编辑字体弹窗 ============ -->
    <transition name="page">
      <div
        v-if="formOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeForm"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 class="text-base font-semibold text-gray-900">
              {{ form.id ? '编辑字体' : '添加字体' }}
            </h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="closeForm"
            >✕</button>
          </div>

          <form
            class="px-5 py-4 space-y-4 overflow-y-auto"
            @submit.prevent="onSubmitForm"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  字体名称 <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  placeholder="例如：思源黑体 CN"
                  class="wpx-input"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  厂商
                </label>
                <input
                  v-model="form.vendor"
                  type="text"
                  placeholder="例如：Adobe / Google / 字体工作室"
                  class="wpx-input"
                >
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  类型 <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="form.type"
                  required
                  class="wpx-input"
                >
                  <option
                    v-for="t in FONT_TYPES"
                    :key="t.value"
                    :value="t.value"
                  >
                    {{ t.label }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  定价 <span class="text-red-500">*</span>
                </label>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="form.pricePerChar"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="wpx-input"
                  >
                  <span class="text-sm text-gray-500 whitespace-nowrap">Token / 字</span>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">标签</label>
              <div class="wpx-input flex flex-wrap items-center gap-1 min-h-[40px] py-1.5">
                <span
                  v-for="(tag, idx) in form.tags"
                  :key="idx"
                  class="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs rounded-full px-2 py-0.5"
                >
                  {{ tag }}
                  <button
                    type="button"
                    class="text-primary-500 hover:text-primary-700"
                    @click="form.tags.splice(idx, 1)"
                  >✕</button>
                </span>
                <input
                  v-model="tagInput"
                  type="text"
                  placeholder="回车添加"
                  class="flex-1 min-w-[80px] outline-none bg-transparent text-sm py-0.5"
                  @keydown.enter.prevent="addTag"
                  @keydown.,.prevent="addTag"
                >
              </div>
              <p class="text-xs text-gray-400 mt-1">如：免费、热门、设计师推荐</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                字体文件 <span v-if="!form.id" class="text-red-500">*</span>
              </label>
              <div class="flex items-center gap-3">
                <label class="flex-1 cursor-pointer">
                  <input
                    ref="fontFileInput"
                    type="file"
                    accept=".ttf,.otf,font/ttf,font/otf,application/x-font-ttf,application/x-font-otf"
                    class="hidden"
                    @change="onFontFileChange"
                  >
                  <div
                    class="border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
                  >
                    <span v-if="!form.fontFile">点击选择 .ttf / .otf 文件</span>
                    <span v-else class="text-primary-700">
                      ✓ {{ form.fontFile.name }}（{{ formatSize(form.fontFile.size) }}）
                    </span>
                  </div>
                </label>
                <button
                  v-if="form.fontFile"
                  type="button"
                  class="text-xs text-gray-500 hover:text-gray-700"
                  @click="clearFontFile"
                >
                  清除
                </button>
              </div>
              <p v-if="form.id" class="text-xs text-gray-400 mt-1">
                留空表示不修改字体文件
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                预览图
              </label>
              <div class="flex items-start gap-3">
                <div
                  class="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border border-gray-200"
                >
                  <img
                    v-if="coverPreview"
                    :src="coverPreview"
                    alt="预览图"
                    class="w-full h-full object-cover"
                  >
                  <span v-else>🖼️</span>
                </div>
                <label class="flex-1 cursor-pointer">
                  <input
                    ref="coverFileInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onCoverChange"
                  >
                  <div
                    class="border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
                  >
                    <span v-if="!form.coverFile">点击选择图片（png/jpg/webp）</span>
                    <span v-else class="text-primary-700">
                      ✓ {{ form.coverFile.name }}（{{ formatSize(form.coverFile.size) }}）
                    </span>
                  </div>
                </label>
                <button
                  v-if="form.coverFile"
                  type="button"
                  class="text-xs text-gray-500 hover:text-gray-700"
                  @click="clearCover"
                >
                  清除
                </button>
              </div>
              <p v-if="form.id" class="text-xs text-gray-400 mt-1">
                留空表示不修改预览图
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea
                v-model="form.description"
                rows="3"
                placeholder="字体风格、适用场景、授权信息等"
                class="wpx-input resize-none"
              ></textarea>
            </div>

            <div class="flex items-center gap-2">
              <input
                id="font-status"
                v-model="form.statusOn"
                type="checkbox"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              >
              <label
                for="font-status"
                class="text-sm text-gray-700 select-none cursor-pointer"
              >
                立即上架
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
              @click="onSubmitForm"
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
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  fetchFonts,
  createFont,
  updateFont,
  toggleFontStatus,
  deleteFont,
  fetchFontStats
} from '@/utils/fonts-api'

echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer
])

defineOptions({ name: 'FontManageView' })

// ============ Constants ============
const FONT_TYPES = [
  { value: 'sans', label: '黑体' },
  { value: 'serif', label: '宋体' },
  { value: 'handwriting', label: '手写' },
  { value: 'decorative', label: '装饰' },
  { value: 'mono', label: '等宽' }
]

const FONT_TYPE_MAP = Object.fromEntries(FONT_TYPES.map((t) => [t.value, t.label]))

const FONT_ACCEPT = ['.ttf', '.otf']
const FONT_MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const COVER_MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// ============ Tabs ============
const tabs = [
  { key: 'library', title: '字体库' },
  { key: 'stats', title: '使用统计' }
]
const activeTab = ref('library')

// ============ 列表 ============
const fonts = ref([])
const fontsLoading = ref(false)
const filters = reactive({
  keyword: '',
  type: '',
  vendor: '',
  status: ''
})

const vendorOptions = computed(() => {
  const set = new Set()
  for (const f of fonts.value) {
    if (f.vendor) set.add(f.vendor)
  }
  return Array.from(set).sort()
})

const filteredFonts = computed(() => {
  const kw = filters.keyword.trim().toLowerCase()
  return fonts.value.filter((f) => {
    if (kw && !(f.name || '').toLowerCase().includes(kw)) return false
    if (filters.type && f.type !== filters.type) return false
    if (filters.vendor && f.vendor !== filters.vendor) return false
    if (filters.status && f.status !== filters.status) return false
    return true
  })
})

async function loadFonts() {
  fontsLoading.value = true
  try {
    const data = await fetchFonts()
    if (Array.isArray(data)) {
      fonts.value = data
    } else if (data && Array.isArray(data.list)) {
      fonts.value = data.list
    } else {
      fonts.value = demoFonts()
    }
  } finally {
    fontsLoading.value = false
  }
}

function demoFonts() {
  return [
    {
      id: 'f1',
      name: '思源黑体 CN',
      vendor: 'Adobe',
      type: 'sans',
      tags: ['免费', '开源', '经典'],
      pricePerChar: 1,
      status: 'on',
      description: '思源黑体简体中文版，开源免费',
      coverUrl: '',
      fileName: 'SourceHanSansCN-Regular.otf',
      updatedAt: Date.now() - 1000 * 60 * 60 * 24
    },
    {
      id: 'f2',
      name: '霞鹜文楷',
      vendor: 'Lxgw',
      type: 'handwriting',
      tags: ['免费', '开源', '可商用'],
      pricePerChar: 2,
      status: 'on',
      description: '基于 Klee One 的衍生中文字体',
      coverUrl: '',
      fileName: 'LXGWWenKai-Regular.ttf',
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3
    },
    {
      id: 'f3',
      name: '得意黑',
      vendor: 'Smiley Sans',
      type: 'decorative',
      tags: ['标题', '设计师推荐'],
      pricePerChar: 3,
      status: 'on',
      description: '一款用于居中横向排版的免费商用中文字体',
      coverUrl: '',
      fileName: 'SmileySans-Oblique.ttf',
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7
    },
    {
      id: 'f4',
      name: '方正悠黑 506',
      vendor: '方正字库',
      type: 'sans',
      tags: ['商用', '标题'],
      pricePerChar: 5,
      status: 'off',
      description: '方正悠黑系列，优雅现代',
      coverUrl: '',
      fileName: 'FZYouH_506.ttf',
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30
    }
  ]
}

function resetFilters() {
  filters.keyword = ''
  filters.type = ''
  filters.vendor = ''
  filters.status = ''
}

function typeLabel(t) {
  return FONT_TYPE_MAP[t] || t || '—'
}

// ============ 表单弹窗 ============
const formOpen = ref(false)
const formSubmitting = ref(false)
const formError = ref('')
const tagInput = ref('')
const coverPreview = ref('')
let coverObjectUrl = ''
const fontFileInput = ref(null)
const coverFileInput = ref(null)

const form = reactive({
  id: '',
  name: '',
  vendor: '',
  type: 'sans',
  pricePerChar: 1,
  tags: [],
  description: '',
  statusOn: false,
  fontFile: null,
  coverFile: null
})

function resetForm() {
  form.id = ''
  form.name = ''
  form.vendor = ''
  form.type = 'sans'
  form.pricePerChar = 1
  form.tags = []
  form.description = ''
  form.statusOn = false
  form.fontFile = null
  form.coverFile = null
  formError.value = ''
  tagInput.value = ''
  clearCoverPreview()
  if (fontFileInput.value) fontFileInput.value.value = ''
  if (coverFileInput.value) coverFileInput.value.value = ''
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function openEdit(f) {
  resetForm()
  form.id = f.id
  form.name = f.name
  form.vendor = f.vendor || ''
  form.type = f.type || 'sans'
  form.pricePerChar = f.pricePerChar ?? 1
  form.tags = Array.isArray(f.tags) ? [...f.tags] : []
  form.description = f.description || ''
  form.statusOn = f.status === 'on'
  // 编辑时展示已有封面作为预览
  if (f.coverUrl) coverPreview.value = f.coverUrl
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  formError.value = ''
}

function addTag() {
  const v = tagInput.value.trim()
  if (!v) return
  if (!form.tags.includes(v)) form.tags.push(v)
  tagInput.value = ''
}

function onFontFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const lower = file.name.toLowerCase()
  const ok = FONT_ACCEPT.some((ext) => lower.endsWith(ext))
  if (!ok) {
    formError.value = '字体文件必须是 .ttf 或 .otf 格式'
    e.target.value = ''
    return
  }
  if (file.size > FONT_MAX_SIZE) {
    formError.value = `字体文件不能超过 ${formatSize(FONT_MAX_SIZE)}`
    e.target.value = ''
    return
  }
  formError.value = ''
  form.fontFile = file
}

function clearFontFile() {
  form.fontFile = null
  if (fontFileInput.value) fontFileInput.value.value = ''
}

function onCoverChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    formError.value = '预览图必须是图片文件'
    e.target.value = ''
    return
  }
  if (file.size > COVER_MAX_SIZE) {
    formError.value = `预览图不能超过 ${formatSize(COVER_MAX_SIZE)}`
    e.target.value = ''
    return
  }
  formError.value = ''
  form.coverFile = file
  clearCoverPreview()
  coverObjectUrl = URL.createObjectURL(file)
  coverPreview.value = coverObjectUrl
}

function clearCover() {
  form.coverFile = null
  if (coverFileInput.value) coverFileInput.value.value = ''
  clearCoverPreview()
}

function clearCoverPreview() {
  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl)
    coverObjectUrl = ''
  }
  // 编辑时不能清空 coverPreview，因为可能正在展示已有图
  if (!form.id) coverPreview.value = ''
}

async function onSubmitForm() {
  formError.value = ''

  if (!form.name.trim()) {
    formError.value = '请填写字体名称'
    return
  }
  if (!form.type) {
    formError.value = '请选择类型'
    return
  }
  if (Number(form.pricePerChar) < 0) {
    formError.value = '价格不能为负数'
    return
  }
  // 创建时必传字体文件
  if (!form.id && !form.fontFile) {
    formError.value = '请上传字体文件（.ttf / .otf）'
    return
  }

  formSubmitting.value = true
  try {
    const basePayload = {
      name: form.name.trim(),
      vendor: form.vendor.trim(),
      type: form.type,
      tags: form.tags.slice(),
      pricePerChar: Number(form.pricePerChar),
      description: form.description.trim(),
      status: form.statusOn ? 'on' : 'off'
    }

    if (form.id) {
      await updateFont(form.id, basePayload)
      // 替换文件（若有）
      if (form.fontFile) await replaceFontFileOnly(form.id, form.fontFile)
      // 替换预览图（若有）
      if (form.coverFile) await replaceFontCoverOnly(form.id, form.coverFile)
      await loadFonts()
    } else {
      const payload = {
        ...basePayload,
        fontFile: form.fontFile,
        coverFile: form.coverFile
      }
      await createFont(payload)
      await loadFonts()
    }
    closeForm()
  } catch (err) {
    formError.value = err?.message || '保存失败'
  } finally {
    formSubmitting.value = false
  }
}

// 局部 helper：编辑模式下单独上传
async function replaceFontFileOnly(id, file) {
  const fd = new FormData()
  fd.append('fontFile', file, file.name)
  await import('@/utils/fonts-api').then((m) => m.replaceFontFile(id, file))
}

async function replaceFontCoverOnly(id, file) {
  await import('@/utils/fonts-api').then((m) => m.replaceFontCover(id, file))
}

async function onToggleStatus(f) {
  const next = f.status === 'on' ? 'off' : 'on'
  f.status = next // 乐观更新
  try {
    const updated = await toggleFontStatus(f.id, next)
    if (updated && updated.id) {
      const idx = fonts.value.findIndex((x) => x.id === f.id)
      if (idx >= 0) fonts.value[idx] = { ...fonts.value[idx], ...updated }
    }
  } catch (err) {
    f.status = next === 'on' ? 'off' : 'on' // 回滚
    // eslint-disable-next-line no-console
    console.error('[FontManage] toggle failed:', err)
  }
}

async function onDelete(f) {
  const ok = window.confirm(`确定删除字体「${f.name}」？该操作不可恢复。`)
  if (!ok) return
  const original = fonts.value.slice()
  fonts.value = fonts.value.filter((x) => x.id !== f.id)
  try {
    await deleteFont(f.id)
  } catch (err) {
    fonts.value = original
    // eslint-disable-next-line no-console
    console.error('[FontManage] delete failed:', err)
  }
}

// ============ 使用统计 ============
const stats = reactive({
  fontId: '',
  days: 30
})
const dayOptions = [
  { label: '7 日', value: 7 },
  { label: '30 日', value: 30 }
]
const statsLoading = ref(false)
const statsData = reactive({
  totalExports: 0,
  totalTokens: 0,
  trend: [],
  userTop10: []
})

const trendChartEl = ref(null)
let trendChart = null

const periodExports = computed(() =>
  (statsData.trend || []).reduce((s, d) => s + Number(d.exports || 0), 0)
)
const periodTokens = computed(() =>
  (statsData.trend || []).reduce((s, d) => s + Number(d.tokens || 0), 0)
)

watch(
  () => [stats.fontId, stats.days],
  async ([id, days]) => {
    if (!id) return
    await loadStats(id, days)
  }
)

async function loadStats(id, days) {
  statsLoading.value = true
  try {
    const data = await fetchFontStats(id, days)
    if (data && typeof data === 'object') {
      statsData.totalExports = Number(data.totalExports) || 0
      statsData.totalTokens = Number(data.totalTokens) || 0
      statsData.trend = Array.isArray(data.trend) ? data.trend : []
      statsData.userTop10 = Array.isArray(data.userTop10) ? data.userTop10 : []
    } else {
      Object.assign(statsData, demoStats(days))
    }
    await nextTick()
    renderTrendChart()
  } finally {
    statsLoading.value = false
  }
}

function demoStats(days) {
  const today = new Date()
  const trend = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    trend.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      exports: Math.round(20 + Math.random() * 80),
      tokens: Math.round(100 + Math.random() * 500)
    })
  }
  return {
    totalExports: 12480,
    totalTokens: 28960,
    trend,
    userTop10: [
      { userId: 'u1', name: '林墨', exports: 412 },
      { userId: 'u2', name: '苏雨', exports: 358 },
      { userId: 'u3', name: '陈晨', exports: 287 },
      { userId: 'u4', name: '王曦', exports: 245 },
      { userId: 'u5', name: '李寻', exports: 198 },
      { userId: 'u6', name: '张乐', exports: 176 },
      { userId: 'u7', name: '赵晗', exports: 152 },
      { userId: 'u8', name: '孙琪', exports: 134 },
      { userId: 'u9', name: '周野', exports: 118 },
      { userId: 'u10', name: '吴淼', exports: 96 }
    ]
  }
}

function renderTrendChart() {
  if (!trendChartEl.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartEl.value)
    window.addEventListener('resize', resizeTrend)
  }
  const data = statsData.trend || []
  trendChart.setOption({
    grid: { left: 50, right: 50, top: 36, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#E5E7EB',
      textStyle: { color: '#1F2937' }
    },
    legend: {
      data: ['导出次数', 'Token 消耗'],
      top: 0,
      right: 0,
      textStyle: { color: '#6B7280' }
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280' }
    },
    yAxis: [
      {
        type: 'value',
        name: '导出次数',
        position: 'left',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#9CA3AF' }
      },
      {
        type: 'value',
        name: 'Token',
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#9CA3AF' }
      }
    ],
    series: [
      {
        name: '导出次数',
        type: 'line',
        smooth: true,
        yAxisIndex: 0,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#4F46E5' },
        lineStyle: { width: 3, color: '#4F46E5' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79, 70, 229, 0.25)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.02)' }
            ]
          }
        },
        data: data.map((d) => d.exports)
      },
      {
        name: 'Token 消耗',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#34D399' },
        lineStyle: { width: 3, color: '#34D399' },
        data: data.map((d) => d.tokens)
      }
    ]
  })
}

function resizeTrend() {
  trendChart?.resize()
}

// ============ Helpers ============
function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN')
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

function formatTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 1000 * 60 * 60 * 24) {
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return `${m} 分钟前`
    return `${Math.floor(m / 60)} 小时前`
  }
  return d.toLocaleDateString('zh-CN')
}

function rankClass(idx) {
  if (idx === 0) return 'bg-amber-100 text-amber-700'
  if (idx === 1) return 'bg-gray-200 text-gray-700'
  if (idx === 2) return 'bg-orange-100 text-orange-700'
  return 'bg-gray-100 text-gray-500'
}

// ============ Lifecycle ============
onMounted(async () => {
  await loadFonts()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeTrend)
  trendChart?.dispose()
  trendChart = null
  clearCoverPreview()
})
</script>