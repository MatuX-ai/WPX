<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Token 与订单</h1>
        <p class="text-sm text-gray-500 mt-1">
          充值订单、消费记录、收入统计
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

    <!-- ============ Tab 1: 充值订单 ============ -->
    <div
      v-if="activeTab === 'recharge'"
      class="space-y-4"
    >
      <!-- 筛选栏 -->
      <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">订单号 / 用户邮箱</label>
          <input
            v-model="rechargeFilters.keyword"
            type="text"
            placeholder="按订单号或邮箱搜索"
            class="wpx-input"
          >
        </div>
        <div class="w-32">
          <label class="block text-xs text-gray-500 mb-1">状态</label>
          <select
            v-model="rechargeFilters.status"
            class="wpx-input"
          >
            <option value="">全部状态</option>
            <option value="pending">待支付</option>
            <option value="paid">已支付</option>
            <option value="refunded">已退款</option>
            <option value="failed">已失败</option>
          </select>
        </div>
        <div class="w-32">
          <label class="block text-xs text-gray-500 mb-1">支付方式</label>
          <select
            v-model="rechargeFilters.payMethod"
            class="wpx-input"
          >
            <option value="">全部</option>
            <option value="alipay">支付宝</option>
            <option value="wechat">微信支付</option>
            <option value="apple">Apple Pay</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>
        <div class="w-36">
          <label class="block text-xs text-gray-500 mb-1">开始日期</label>
          <input
            v-model="rechargeFilters.startDate"
            type="date"
            class="wpx-input"
          >
        </div>
        <div class="w-36">
          <label class="block text-xs text-gray-500 mb-1">结束日期</label>
          <input
            v-model="rechargeFilters.endDate"
            type="date"
            class="wpx-input"
          >
        </div>
        <button
          type="button"
          class="wpx-btn-secondary"
          @click="resetRechargeFilters"
        >
          重置
        </button>
        <button
          type="button"
          class="wpx-btn-secondary ml-auto"
          :disabled="rechargeLoading"
          @click="loadRecharge(true)"
        >
          🔄 刷新
        </button>
      </div>

      <!-- 订单列表 -->
      <div class="wpx-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-4 py-3 font-medium">订单号</th>
              <th class="text-left px-4 py-3 font-medium">用户</th>
              <th class="text-left px-4 py-3 font-medium">充值包</th>
              <th class="text-right px-4 py-3 font-medium">金额</th>
              <th class="text-right px-4 py-3 font-medium">Token</th>
              <th class="text-left px-4 py-3 font-medium">支付方式</th>
              <th class="text-left px-4 py-3 font-medium">时间</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="o in filteredOrders"
              :key="o.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3 font-mono text-xs text-gray-700">
                {{ o.orderNo }}
              </td>
              <td class="px-4 py-3">
                <div class="text-gray-900 truncate max-w-[180px]">
                  {{ o.userName || o.userEmail }}
                </div>
                <div class="text-xs text-gray-400 truncate max-w-[180px]">
                  {{ o.userEmail }}
                </div>
              </td>
              <td class="px-4 py-3 text-gray-700">
                {{ o.packageName || '—' }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                <span class="text-gray-900">¥ {{ formatMoney(o.amount) }}</span>
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                <span class="text-gray-900">{{ formatNumber(o.tokens) }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="wpx-badge-gray">{{ payMethodLabel(o.payMethod) }}</span>
              </td>
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                <div>{{ formatDateTime(o.createdAt) }}</div>
                <div
                  v-if="o.paidAt"
                  class="text-emerald-600"
                >
                  支付：{{ formatDateTime(o.paidAt) }}
                </div>
              </td>
              <td class="px-4 py-3">
                <span :class="statusClass(o.status)">{{ statusLabel(o.status) }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  v-if="o.status === 'paid'"
                  type="button"
                  class="text-xs text-red-600 hover:text-red-700"
                  @click="openRefund(o)"
                >
                  退款
                </button>
                <span
                  v-else
                  class="text-xs text-gray-300"
                >—</span>
              </td>
            </tr>
            <tr v-if="!rechargeLoading && filteredOrders.length === 0">
              <td
                colspan="9"
                class="px-4 py-12 text-center text-gray-400"
              >
                暂无订单数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 汇总 -->
      <div
        v-if="filteredOrders.length"
        class="text-xs text-gray-400 text-right"
      >
        共 {{ filteredOrders.length }} 笔 · 已支付金额 ¥{{ formatMoney(totalPaid) }} · 已退款金额 ¥{{ formatMoney(totalRefunded) }}
      </div>
    </div>

    <!-- ============ Tab 2: 消费记录 ============ -->
    <div
      v-else-if="activeTab === 'consumption'"
      class="space-y-4"
    >
      <!-- 筛选栏 -->
      <div class="wpx-card p-4 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">用户邮箱 / 字体</label>
          <input
            v-model="consumptionFilters.keyword"
            type="text"
            placeholder="按用户或字体名称搜索"
            class="wpx-input"
          >
        </div>
        <div class="w-36">
          <label class="block text-xs text-gray-500 mb-1">开始日期</label>
          <input
            v-model="consumptionFilters.startDate"
            type="date"
            class="wpx-input"
          >
        </div>
        <div class="w-36">
          <label class="block text-xs text-gray-500 mb-1">结束日期</label>
          <input
            v-model="consumptionFilters.endDate"
            type="date"
            class="wpx-input"
          >
        </div>
        <button
          type="button"
          class="wpx-btn-secondary"
          @click="resetConsumptionFilters"
        >
          重置
        </button>
        <button
          type="button"
          class="wpx-btn-secondary ml-auto"
          :disabled="consumptionLoading"
          @click="loadConsumption(true)"
        >
          🔄 刷新
        </button>
      </div>

      <!-- 消费列表 -->
      <div class="wpx-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-4 py-3 font-medium">用户</th>
              <th class="text-left px-4 py-3 font-medium">字体</th>
              <th class="text-right px-4 py-3 font-medium">字数</th>
              <th class="text-right px-4 py-3 font-medium">Token 消耗</th>
              <th class="text-left px-4 py-3 font-medium">文档哈希</th>
              <th class="text-left px-4 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="c in filteredConsumption"
              :key="c.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="text-gray-900 truncate max-w-[180px]">
                  {{ c.userName || c.userEmail }}
                </div>
                <div class="text-xs text-gray-400 truncate max-w-[180px]">
                  {{ c.userEmail }}
                </div>
              </td>
              <td class="px-4 py-3 text-gray-700 truncate max-w-[200px]">
                {{ c.fontName || '—' }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-gray-700">
                {{ formatNumber(c.chars) }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                <span class="text-primary-700 font-medium">
                  {{ formatNumber(c.tokens) }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-[200px]">
                {{ c.docHash || '—' }}
              </td>
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                {{ formatDateTime(c.createdAt) }}
              </td>
            </tr>
            <tr v-if="!consumptionLoading && filteredConsumption.length === 0">
              <td
                colspan="6"
                class="px-4 py-12 text-center text-gray-400"
              >
                暂无消费记录
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="filteredConsumption.length"
        class="text-xs text-gray-400 text-right"
      >
        共 {{ filteredConsumption.length }} 条 · 累计消耗
        <span class="text-primary-700 font-medium">{{ formatNumber(totalConsumed) }}</span>
        Token
      </div>
    </div>

    <!-- ============ Tab 3: 收入统计 ============ -->
    <div
      v-else
      class="space-y-4"
    >
      <!-- 4 个指标 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">今日收入</div>
          <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
            ¥ {{ revenueLoading ? '—' : formatMoney(revenue.today) }}
          </div>
          <div class="text-xs text-gray-400 mt-1">当日累计</div>
        </div>
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">本周收入</div>
          <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
            ¥ {{ revenueLoading ? '—' : formatMoney(revenue.week) }}
          </div>
          <div class="text-xs text-gray-400 mt-1">最近 7 天</div>
        </div>
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">本月收入</div>
          <div class="text-2xl font-bold text-gray-900 tabular-nums mt-1">
            ¥ {{ revenueLoading ? '—' : formatMoney(revenue.month) }}
          </div>
          <div class="text-xs text-gray-400 mt-1">自然月</div>
        </div>
        <div class="wpx-card p-4">
          <div class="text-sm text-gray-500">累计收入</div>
          <div
            class="text-2xl font-bold wpx-gradient-text tabular-nums mt-1"
          >
            ¥ {{ revenueLoading ? '—' : formatMoney(revenue.total) }}
          </div>
          <div class="text-xs text-gray-400 mt-1">全部时间</div>
        </div>
      </div>

      <!-- 趋势图 + 充值包分布 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="wpx-card p-4 lg:col-span-2">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-900">收入趋势</h2>
            <span class="text-xs text-gray-400">最近 30 天</span>
          </div>
          <div
            ref="trendChartEl"
            class="echarts-container"
            style="height: 320px;"
          ></div>
        </div>
        <div class="wpx-card p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-900">按充值包</h2>
            <span class="text-xs text-gray-400">累计</span>
          </div>
          <ul
            v-if="revenue.byPackage?.length"
            class="space-y-3"
          >
            <li
              v-for="(p, idx) in revenue.byPackage"
              :key="p.packageName"
              class="space-y-1"
            >
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-700 truncate">{{ p.packageName }}</span>
                <span class="tabular-nums">
                  <span class="text-gray-900">¥{{ formatMoney(p.amount) }}</span>
                  <span class="text-xs text-gray-400 ml-1">×{{ p.count }}</span>
                </span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{
                    width: ((p.amount / maxPackageAmount) * 100).toFixed(1) + '%',
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
            class="text-sm text-gray-400 py-12 text-center"
          >
            暂无数据
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 退款弹窗 ============ -->
    <transition name="page">
      <div
        v-if="refundModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeRefund"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div class="px-5 py-4 border-b border-gray-100">
            <h3 class="text-base font-semibold text-gray-900">确认退款</h3>
          </div>
          <div class="px-5 py-4 space-y-3">
            <div class="text-sm text-gray-600">
              订单：<span class="font-mono">{{ refundModal.orderNo }}</span>
            </div>
            <div class="text-sm text-gray-600">
              用户：{{ refundModal.userName || refundModal.userEmail }}
            </div>
            <div class="text-sm text-gray-600">
              原金额：<span class="font-semibold text-gray-900">¥{{ formatMoney(refundModal.amount) }}</span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                退款金额
              </label>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">¥</span>
                <input
                  v-model.number="refundModal.amount"
                  type="number"
                  min="0"
                  :max="refundModal.maxAmount"
                  step="0.01"
                  class="wpx-input"
                >
                <button
                  type="button"
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="refundModal.amount = refundModal.maxAmount"
                >
                  全额
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                退款原因
              </label>
              <textarea
                v-model="refundModal.reason"
                rows="2"
                placeholder="例如：用户误操作、客服协商等"
                class="wpx-input resize-none"
              ></textarea>
            </div>

            <div
              v-if="refundError"
              class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {{ refundError }}
            </div>
          </div>
          <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              class="wpx-btn-secondary"
              @click="closeRefund"
            >
              取消
            </button>
            <button
              type="button"
              class="wpx-btn-danger"
              :disabled="refundSubmitting"
              @click="confirmRefund"
            >
              {{ refundSubmitting ? '处理中…' : '确认退款' }}
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
import { LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  fetchRechargeOrders,
  refundOrder,
  fetchConsumption,
  fetchRevenueOverview
} from '@/utils/orders-api'

echarts.use([
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer
])

defineOptions({ name: 'TokenOrdersView' })

// ============ Tabs ============
const tabs = [
  { key: 'recharge', title: '充值订单' },
  { key: 'consumption', title: '消费记录' },
  { key: 'revenue', title: '收入统计' }
]
const activeTab = ref('recharge')

// ============ 充值订单 ============
const orders = ref([])
const rechargeLoading = ref(false)
const rechargeFilters = reactive({
  keyword: '',
  status: '',
  payMethod: '',
  startDate: '',
  endDate: ''
})

const filteredOrders = computed(() => {
  const kw = rechargeFilters.keyword.trim().toLowerCase()
  return orders.value.filter((o) => {
    if (kw) {
      const text = ((o.orderNo || '') + ' ' + (o.userEmail || '') + ' ' + (o.userName || '')).toLowerCase()
      if (!text.includes(kw)) return false
    }
    if (rechargeFilters.status && o.status !== rechargeFilters.status) return false
    if (rechargeFilters.payMethod && o.payMethod !== rechargeFilters.payMethod) return false
    if (rechargeFilters.startDate) {
      const t = new Date(rechargeFilters.startDate).getTime()
      if ((o.createdAt || 0) < t) return false
    }
    if (rechargeFilters.endDate) {
      const t = new Date(rechargeFilters.endDate).getTime() + 24 * 60 * 60 * 1000
      if ((o.createdAt || 0) >= t) return false
    }
    return true
  })
})

const totalPaid = computed(() =>
  filteredOrders.value
    .filter((o) => o.status === 'paid')
    .reduce((s, o) => s + Number(o.amount || 0), 0)
)
const totalRefunded = computed(() =>
  filteredOrders.value
    .filter((o) => o.status === 'refunded')
    .reduce((s, o) => s + Number(o.amount || 0), 0)
)

async function loadRecharge() {
  rechargeLoading.value = true
  try {
    const data = await fetchRechargeOrders(rechargeFilters)
    if (Array.isArray(data)) {
      orders.value = data
    } else if (data && Array.isArray(data.list)) {
      orders.value = data.list
    } else {
      orders.value = demoOrders()
    }
  } finally {
    rechargeLoading.value = false
  }
}

function demoOrders() {
  const methods = ['alipay', 'wechat', 'apple', 'stripe']
  const pkgs = ['10 元包', '50 元包', '100 元包', '200 元包', '500 元包', '自定义充值']
  const statuses = ['paid', 'paid', 'paid', 'pending', 'refunded', 'failed']
  const list = []
  for (let i = 0; i < 24; i++) {
    const day = new Date()
    day.setDate(day.getDate() - Math.floor(i / 2))
    day.setHours(9 + (i % 10), (i * 7) % 60)
    const amount = [10, 50, 100, 200, 500, 30, 88, 188][i % 8]
    const tokens = amount * 100
    const status = statuses[i % statuses.length]
    list.push({
      id: 'o' + i,
      orderNo: 'WPX' + String(Date.now() + i).slice(-10),
      userId: 'u' + i,
      userEmail: `user${1000 + i}@example.com`,
      userName: '客户' + (1000 + i),
      amount,
      currency: 'CNY',
      tokens,
      payMethod: methods[i % methods.length],
      status,
      packageName: pkgs[i % pkgs.length],
      createdAt: day.getTime(),
      paidAt: status === 'paid' || status === 'refunded' ? day.getTime() + 30 * 1000 : undefined,
      refundedAt: status === 'refunded' ? day.getTime() + 60 * 60 * 1000 : undefined
    })
  }
  return list
}

function resetRechargeFilters() {
  rechargeFilters.keyword = ''
  rechargeFilters.status = ''
  rechargeFilters.payMethod = ''
  rechargeFilters.startDate = ''
  rechargeFilters.endDate = ''
}

// 退款
const refundModal = reactive({
  open: false,
  id: '',
  orderNo: '',
  userName: '',
  userEmail: '',
  amount: 0,
  maxAmount: 0,
  reason: ''
})
const refundSubmitting = ref(false)
const refundError = ref('')

function openRefund(o) {
  refundModal.id = o.id
  refundModal.orderNo = o.orderNo
  refundModal.userName = o.userName || ''
  refundModal.userEmail = o.userEmail || ''
  refundModal.amount = Number(o.amount) || 0
  refundModal.maxAmount = Number(o.amount) || 0
  refundModal.reason = ''
  refundError.value = ''
  refundModal.open = true
}

function closeRefund() {
  refundModal.open = false
  refundError.value = ''
}

async function confirmRefund() {
  refundError.value = ''
  if (!refundModal.id) return
  const amt = Number(refundModal.amount)
  if (!Number.isFinite(amt) || amt <= 0) {
    refundError.value = '退款金额必须大于 0'
    return
  }
  if (amt > refundModal.maxAmount) {
    refundError.value = '退款金额不能超过原订单金额'
    return
  }

  refundSubmitting.value = true
  try {
    const updated = await refundOrder(refundModal.id, {
      amount: amt,
      reason: refundModal.reason.trim()
    })
    // 乐观更新本地状态
    const idx = orders.value.findIndex((o) => o.id === refundModal.id)
    if (idx >= 0) {
      orders.value[idx] = {
        ...orders.value[idx],
        ...(updated || {}),
        status: 'refunded',
        refundedAt: Date.now()
      }
    }
    closeRefund()
  } catch (err) {
    refundError.value = err?.message || '退款失败'
  } finally {
    refundSubmitting.value = false
  }
}

// ============ 消费记录 ============
const consumption = ref([])
const consumptionLoading = ref(false)
const consumptionFilters = reactive({
  keyword: '',
  startDate: '',
  endDate: ''
})

const filteredConsumption = computed(() => {
  const kw = consumptionFilters.keyword.trim().toLowerCase()
  return consumption.value.filter((c) => {
    if (kw) {
      const text = ((c.userEmail || '') + ' ' + (c.userName || '') + ' ' + (c.fontName || '')).toLowerCase()
      if (!text.includes(kw)) return false
    }
    if (consumptionFilters.startDate) {
      const t = new Date(consumptionFilters.startDate).getTime()
      if ((c.createdAt || 0) < t) return false
    }
    if (consumptionFilters.endDate) {
      const t = new Date(consumptionFilters.endDate).getTime() + 24 * 60 * 60 * 1000
      if ((c.createdAt || 0) >= t) return false
    }
    return true
  })
})

const totalConsumed = computed(() =>
  filteredConsumption.value.reduce((s, c) => s + Number(c.tokens || 0), 0)
)

async function loadConsumption() {
  consumptionLoading.value = true
  try {
    const data = await fetchConsumption(consumptionFilters)
    if (Array.isArray(data)) {
      consumption.value = data
    } else if (data && Array.isArray(data.list)) {
      consumption.value = data.list
    } else {
      consumption.value = demoConsumption()
    }
  } finally {
    consumptionLoading.value = false
  }
}

function demoConsumption() {
  const fonts = ['思源黑体 CN', '霞鹜文楷', '得意黑', '阿里巴巴普惠体', '方正悠黑']
  const list = []
  for (let i = 0; i < 32; i++) {
    const day = new Date()
    day.setHours(9 + (i % 10), (i * 11) % 60)
    day.setDate(day.getDate() - Math.floor(i / 4))
    const chars = 100 + Math.floor(Math.random() * 3000)
    list.push({
      id: 'c' + i,
      userId: 'u' + (i % 12),
      userEmail: `user${1000 + (i % 12)}@example.com`,
      userName: '客户' + (1000 + (i % 12)),
      fontId: 'f' + (i % fonts.length),
      fontName: fonts[i % fonts.length],
      chars,
      tokens: chars,
      docHash: 'sha256:' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12),
      createdAt: day.getTime()
    })
  }
  return list
}

function resetConsumptionFilters() {
  consumptionFilters.keyword = ''
  consumptionFilters.startDate = ''
  consumptionFilters.endDate = ''
}

// ============ 收入统计 ============
const revenueLoading = ref(false)
const revenue = reactive({
  today: 0,
  week: 0,
  month: 0,
  total: 0,
  trend: [],
  byPackage: []
})

const trendChartEl = ref(null)
let trendChart = null

const maxPackageAmount = computed(() => {
  if (!revenue.byPackage?.length) return 1
  return Math.max(...revenue.byPackage.map((p) => Number(p.amount) || 0), 1)
})

async function loadRevenue() {
  revenueLoading.value = true
  try {
    const data = await fetchRevenueOverview()
    if (data && typeof data === 'object') {
      revenue.today = Number(data.today) || 0
      revenue.week = Number(data.week) || 0
      revenue.month = Number(data.month) || 0
      revenue.total = Number(data.total) || 0
      revenue.trend = Array.isArray(data.trend) ? data.trend : []
      revenue.byPackage = Array.isArray(data.byPackage) ? data.byPackage : []
    } else {
      Object.assign(revenue, demoRevenue())
    }
    await nextTick()
    renderRevenueChart()
  } finally {
    revenueLoading.value = false
  }
}

function demoRevenue() {
  const today = new Date()
  const trend = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const orders = 5 + Math.round(Math.random() * 30)
    const amount = orders * (30 + Math.round(Math.random() * 80))
    trend.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      amount,
      orders
    })
  }
  return {
    today: trend[trend.length - 1].amount,
    week: trend.slice(-7).reduce((s, x) => s + x.amount, 0),
    month: trend.reduce((s, x) => s + x.amount, 0),
    total: 188420,
    trend,
    byPackage: [
      { packageName: '10 元包', count: 128, amount: 1280 },
      { packageName: '50 元包', count: 96, amount: 4800 },
      { packageName: '100 元包', count: 72, amount: 7200 },
      { packageName: '200 元包', count: 38, amount: 7600 },
      { packageName: '500 元包', count: 14, amount: 7000 },
      { packageName: '自定义充值', count: 22, amount: 4520 }
    ]
  }
}

function renderRevenueChart() {
  if (!trendChartEl.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartEl.value)
    window.addEventListener('resize', resizeRevenue)
  }
  const data = revenue.trend || []
  trendChart.setOption({
    grid: { left: 60, right: 50, top: 36, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#E5E7EB',
      textStyle: { color: '#1F2937' }
    },
    legend: {
      data: ['收入 (元)', '订单数'],
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
        name: '金额',
        position: 'left',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#9CA3AF' }
      },
      {
        type: 'value',
        name: '订单',
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#9CA3AF' }
      }
    ],
    series: [
      {
        name: '收入 (元)',
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
              { offset: 0, color: 'rgba(79, 70, 229, 0.30)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.02)' }
            ]
          }
        },
        data: data.map((d) => d.amount)
      },
      {
        name: '订单数',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 14,
        itemStyle: { color: '#34D399', borderRadius: [4, 4, 0, 0] },
        data: data.map((d) => d.orders)
      }
    ]
  })
}

function resizeRevenue() {
  trendChart?.resize()
}

// ============ Helpers ============
function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN')
}

function formatMoney(n) {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function payMethodLabel(m) {
  return (
    {
      alipay: '支付宝',
      wechat: '微信',
      apple: 'Apple Pay',
      stripe: 'Stripe'
    }[m] || m || '—'
  )
}

function statusLabel(s) {
  return (
    {
      pending: '○ 待支付',
      paid: '● 已支付',
      refunded: '↩ 已退款',
      failed: '✕ 已失败'
    }[s] || s || '—'
  )
}

function statusClass(s) {
  if (s === 'paid') return 'wpx-badge-success'
  if (s === 'pending') return 'wpx-badge-warning'
  if (s === 'refunded') return 'wpx-badge-gray'
  if (s === 'failed') return 'wpx-badge-danger'
  return 'wpx-badge-gray'
}

// ============ Lifecycle ============
onMounted(async () => {
  await loadRecharge()
})

watch(activeTab, async (tab) => {
  if (tab === 'consumption' && consumption.value.length === 0) {
    await loadConsumption()
  } else if (tab === 'revenue') {
    await loadRevenue()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeRevenue)
  trendChart?.dispose()
  trendChart = null
})
</script>