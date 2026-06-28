<template>
  <div class="space-y-6">
    <!-- 标题区 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">仪表盘</h1>
        <p class="text-sm text-gray-500 mt-1">
          一眼看清 WPX 整体运营状况
          <span class="ml-2 text-xs text-gray-400">
            · 最后更新：{{ lastUpdatedText }} · 自动刷新 {{ refreshSeconds }}s
          </span>
        </p>
      </div>
      <button
        type="button"
        class="wpx-btn-secondary"
        :disabled="loading"
        @click="load(true)"
      >
        <span :class="loading ? 'animate-spin inline-block' : ''">🔄</span>
        <span>立即刷新</span>
      </button>
    </div>

    <!-- 统计卡片（6 个） -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div
        v-for="card in cards"
        :key="card.key"
        class="wpx-card p-4 flex flex-col gap-2"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">{{ card.title }}</span>
          <span class="text-lg">{{ card.icon }}</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold text-gray-900 tabular-nums">
            {{ card.value }}
          </span>
          <span
            v-if="card.unit"
            class="text-xs text-gray-500"
          >{{ card.unit }}</span>
        </div>
        <div
          v-if="card.desc"
          class="text-xs text-gray-400"
        >
          {{ card.desc }}
        </div>
      </div>
    </div>

    <!-- Top 列表（5 + 10） -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 字体使用 Top 5（免费字体统计） -->
      <div class="wpx-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-900">字体使用 Top 5</h2>
          <span class="text-xs text-gray-300">今日（免费字体）</span>
        </div>
        <ul
          v-if="fontTop5.length"
          class="space-y-2"
        >
          <li
            v-for="(item, idx) in fontTop5"
            :key="item.name + idx"
            class="flex items-center gap-3"
          >
            <span
              class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold"
              :class="rankClass(idx)"
            >{{ idx + 1 }}</span>
            <span class="flex-1 text-sm text-gray-700 truncate">{{ item.name }}</span>
            <span class="text-sm tabular-nums text-gray-900">{{ item.count }}</span>
          </li>
        </ul>
        <div
          v-else
          class="text-sm text-gray-400 py-8 text-center"
        >
          暂无数据
        </div>
      </div>

      <!-- 活跃 Skills Top 10 -->
      <div class="wpx-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-900">活跃 Skills Top 10</h2>
          <span class="text-xs text-gray-400">今日</span>
        </div>
        <ul
          v-if="skillTop10.length"
          class="space-y-2"
        >
          <li
            v-for="(item, idx) in skillTop10"
            :key="item.id || item.name + idx"
            class="flex items-center gap-3"
          >
            <span
              class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold"
              :class="rankClass(idx)"
            >{{ idx + 1 }}</span>
            <span class="flex-1 text-sm text-gray-700 truncate">{{ item.name }}</span>
            <span class="text-sm tabular-nums text-gray-900">{{ item.calls }}</span>
          </li>
        </ul>
        <div
          v-else
          class="text-sm text-gray-400 py-8 text-center"
        >
          暂无数据
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 7 日用户增长趋势（折线图） -->
      <div class="wpx-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-900">7 日用户增长趋势</h2>
          <span class="text-xs text-gray-400">最近 7 天</span>
        </div>
        <div
          ref="userChartEl"
          class="echarts-container"
          style="height: 280px;"
        ></div>
      </div>

      <!-- 7 日 AI 调用趋势（堆叠柱状图） -->
      <div class="wpx-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-900">7 日 AI 调用趋势</h2>
          <span class="text-xs text-gray-400">用户自配 API 调用</span>
        </div>
        <div
          ref="aiChartEl"
          class="echarts-container"
          style="height: 280px;"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { fetchOverview, fetchTrends } from '@/utils/dashboard-api'

// 按需注册 ECharts 组件，减小打包体积
echarts.use([
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer
])

defineOptions({ name: 'DashboardView' })

// ============ State ============
const REFRESH_INTERVAL = 30 // 秒
const refreshSeconds = REFRESH_INTERVAL

const loading = ref(false)
const lastUpdated = ref(null)

const overview = ref({
  dau: 0,
  newUsers: 0,
  aiCalls: 0,
  totalUsers: 0,
  fontExportTop5: [],
  activeSkillsTop10: []
})
const trends = ref({ userGrowth: [], aiCalls: [] })

const userChartEl = ref(null)
const aiChartEl = ref(null)
let userChart = null
let aiChart = null
let timer = null

// ============ Computed ============
const cards = computed(() => [
  {
    key: 'dau',
    title: '今日活跃用户',
    value: formatNumber(overview.value.dau),
    unit: 'DAU',
    icon: '👥',
    desc: '今日独立活跃用户数'
  },
  {
    key: 'newUsers',
    title: '今日新增注册',
    value: formatNumber(overview.value.newUsers),
    unit: '人',
    icon: '✨',
    desc: '今日新注册用户'
  },
  {
    key: 'aiCalls',
    title: '今日 AI 调用',
    value: formatNumber(overview.value.aiCalls),
    unit: '次',
    icon: '🤖',
    desc: '用户通过自配 API 调用'
  },
  {
    key: 'totalUsers',
    title: '累计注册用户',
    value: formatNumber(overview.value.totalUsers),
    unit: '人',
    icon: '📊',
    desc: '平台累计注册用户数'
  },
  {
    key: 'skill',
    title: '活跃 Skills Top 10',
    value: formatNumber(totalSkillCalls.value),
    unit: '次',
    icon: '⚡',
    desc: 'Top 10 Skills 合计调用'
  }
])

const fontTop5 = computed(() => overview.value.fontExportTop5 || [])
const skillTop10 = computed(() => overview.value.activeSkillsTop10 || [])
const totalFontExports = computed(() =>
  fontTop5.value.reduce((sum, x) => sum + Number(x.count || 0), 0)
)
const totalSkillCalls = computed(() =>
  skillTop10.value.reduce((sum, x) => sum + Number(x.calls || 0), 0)
)

const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return '—'
  const d = lastUpdated.value
  return d.toLocaleTimeString('zh-CN', { hour12: false })
})

// ============ Helpers ============
function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN')
}

function rankClass(idx) {
  if (idx === 0) return 'bg-amber-100 text-amber-700'
  if (idx === 1) return 'bg-gray-200 text-gray-700'
  if (idx === 2) return 'bg-orange-100 text-orange-700'
  return 'bg-gray-100 text-gray-500'
}

function demoOverview() {
  // 当后端不可用时使用的演示数据，避免空白页
  return {
    dau: 1284,
    newUsers: 56,
    aiCalls: 8421,
    totalUsers: 3280,
    fontExportTop5: [
      { name: '思源黑体 CN', count: 412 },
      { name: '阿里巴巴普惠体', count: 287 },
      { name: '霞鹜文楷', count: 196 },
      { name: '得意黑', count: 132 },
      { name: '站酷高端黑', count: 87 }
    ],
    activeSkillsTop10: [
      { id: 's1', name: '论文润色', calls: 920 },
      { id: 's2', name: '周报生成', calls: 740 },
      { id: 's3', name: '翻译助手', calls: 632 },
      { id: 's4', name: '简历优化', calls: 510 },
      { id: 's5', name: '总结要点', calls: 482 },
      { id: 's6', name: '代码解释', calls: 401 },
      { id: 's7', name: '会议纪要', calls: 388 },
      { id: 's8', name: '邮件回复', calls: 352 },
      { id: 's9', name: '标题优化', calls: 295 },
      { id: 's10', name: '错别字校对', calls: 261 }
    ]
  }
}

function demoTrends() {
  const today = new Date()
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      count: 30 + Math.round(Math.random() * 60),
      free: 600 + Math.round(Math.random() * 400),
      paid: 200 + Math.round(Math.random() * 300)
    })
  }
  return {
    userGrowth: days.map((x) => ({ date: x.date, count: x.count })),
    aiCalls: days.map((x) => ({ date: x.date, free: x.free, paid: x.paid }))
  }
}

// ============ Data loading ============
async function load(manual = false) {
  loading.value = true
  try {
    const [ov, tr] = await Promise.all([fetchOverview(), fetchTrends(7)])
    overview.value = ov && typeof ov === 'object' ? ov : demoOverview()
    if (!ov) {
      // 后端不可用时使用 demo 数据，但不抛错
      // eslint-disable-next-line no-console
      console.warn('[Dashboard] overview API unavailable, using demo data')
    }

    trends.value = tr && typeof tr === 'object' ? tr : demoTrends()
    if (!tr) {
      // eslint-disable-next-line no-console
      console.warn('[Dashboard] trends API unavailable, using demo data')
    }

    lastUpdated.value = new Date()
    await nextTick()
    renderCharts()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Dashboard] load error:', err)
  } finally {
    loading.value = false
    if (manual) {
      // 手动刷新时给个轻提示可在此扩展
    }
  }
}

// ============ Charts ============
function renderCharts() {
  renderUserChart()
  renderAiChart()
}

function renderUserChart() {
  if (!userChartEl.value) return
  if (!userChart) {
    userChart = echarts.init(userChartEl.value)
    window.addEventListener('resize', resizeCharts)
  }
  const data = trends.value.userGrowth || []
  userChart.setOption({
    grid: { left: 40, right: 16, top: 24, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#E5E7EB',
      textStyle: { color: '#1F2937' }
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: { color: '#9CA3AF' }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: data.map((d) => d.count),
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
              { offset: 0, color: 'rgba(79, 70, 229, 0.30)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.02)' }
            ]
          }
        }
      }
    ]
  })
}

function renderAiChart() {
  if (!aiChartEl.value) return
  if (!aiChart) {
    aiChart = echarts.init(aiChartEl.value)
  }
  const data = trends.value.aiCalls || []
  aiChart.setOption({
    grid: { left: 40, right: 16, top: 32, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#E5E7EB',
      textStyle: { color: '#1F2937' },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['免费', '付费'],
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
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: { color: '#9CA3AF' }
    },
    series: [
      {
        name: '免费',
        type: 'bar',
        stack: 'total',
        barMaxWidth: 24,
        itemStyle: { color: '#34D399', borderRadius: [0, 0, 0, 0] },
        data: data.map((d) => d.free)
      },
      {
        name: '付费',
        type: 'bar',
        stack: 'total',
        barMaxWidth: 24,
        itemStyle: { color: '#4F46E5', borderRadius: [6, 6, 0, 0] },
        data: data.map((d) => d.paid)
      }
    ]
  })
}

function resizeCharts() {
  userChart?.resize()
  aiChart?.resize()
}

// ============ Lifecycle ============
onMounted(async () => {
  await load()
  timer = setInterval(() => load(false), REFRESH_INTERVAL * 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('resize', resizeCharts)
  userChart?.dispose()
  aiChart?.dispose()
  userChart = null
  aiChart = null
})
</script>