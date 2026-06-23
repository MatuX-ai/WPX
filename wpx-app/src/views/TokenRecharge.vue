<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQRCode } from '@vueuse/integrations/useQRCode'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import {
  PRESET_RECHARGE_AMOUNT,
  TOKENS_PER_YUAN,
  calcTokenCount,
  createTokenRechargeOrder,
  fetchRechargeOrderStatus,
  fetchRechargeRecords,
  fetchTokenBalance,
  formatRecordTime,
  formatRechargeStatus,
  simulateRechargePayment,
} from '@/utils/tokenApi'

const toast = useToast()
const authStore = useAuthStore()
const { isGuest } = storeToRefs(authStore)
const { login, isLoggingIn } = useAuth()
const isDev = import.meta.env.DEV

const balance = ref(0)
const records = ref([])
const recordsLoading = ref(false)
const submitting = ref(false)

const planMode = ref('preset')
const customAmount = ref(PRESET_RECHARGE_AMOUNT)

const paymentVisible = ref(false)
const paymentChannel = ref('wechat')
const activeOrder = ref(null)
const paymentPolling = ref(false)

let pollTimer = null

const selectedAmount = computed(() =>
  planMode.value === 'preset' ? PRESET_RECHARGE_AMOUNT : normalizeAmount(customAmount.value),
)

const selectedTokenCount = computed(() => calcTokenCount(selectedAmount.value))

const isAmountValid = computed(() => {
  const amount = selectedAmount.value
  return Number.isFinite(amount) && amount >= 10 && amount % 10 === 0
})

const wechatQrSource = computed(() => activeOrder.value?.qr_data?.wechat || '')
const alipayQrSource = computed(() => activeOrder.value?.qr_data?.alipay || '')
const activeQrSource = computed(() =>
  paymentChannel.value === 'alipay' ? alipayQrSource.value : wechatQrSource.value,
)

const wechatQrCode = useQRCode(wechatQrSource)
const alipayQrCode = useQRCode(alipayQrSource)
const activeQrCode = computed(() =>
  paymentChannel.value === 'alipay' ? alipayQrCode.value : wechatQrCode.value,
)

function normalizeAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return PRESET_RECHARGE_AMOUNT
  const clamped = Math.max(10, amount)
  return Math.round(clamped / 10) * 10
}

function handleCustomAmountBlur() {
  customAmount.value = normalizeAmount(customAmount.value)
}

async function refreshBalance() {
  balance.value = await fetchTokenBalance()
}

async function loadRecords() {
  recordsLoading.value = true
  try {
    records.value = await fetchRechargeRecords()
  } catch {
    records.value = []
  } finally {
    recordsLoading.value = false
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  paymentPolling.value = false
}

function closePaymentModal() {
  stopPolling()
  paymentVisible.value = false
  activeOrder.value = null
}

async function handlePaymentSuccess(tokenCount) {
  stopPolling()
  paymentVisible.value = false
  activeOrder.value = null
  await Promise.all([refreshBalance(), loadRecords()])
  toast.success(`充值成功，+${tokenCount} Token`)
}

async function pollOrderStatus(orderId, expectedTokenCount) {
  stopPolling()
  paymentPolling.value = true

  const checkStatus = async () => {
    try {
      const status = await fetchRechargeOrderStatus(orderId)
      if (status.status === 'paid') {
        await handlePaymentSuccess(status.token_count || expectedTokenCount)
      }
    } catch {
      // ignore transient polling errors
    }
  }

  await checkStatus()
  pollTimer = setInterval(checkStatus, 2000)
}

async function handleRecharge() {
  if (submitting.value || !isAmountValid.value) return

  submitting.value = true
  try {
    const order = await createTokenRechargeOrder(selectedAmount.value)
    activeOrder.value = order
    paymentChannel.value = 'wechat'
    paymentVisible.value = true
    await pollOrderStatus(order.order_id, order.token_count)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '创建充值订单失败')
  } finally {
    submitting.value = false
  }
}

async function handleSimulatePay() {
  if (!activeOrder.value?.order_id) return

  try {
    const result = await simulateRechargePayment(activeOrder.value.order_id)
    if (result.status === 'paid') {
      await handlePaymentSuccess(result.token_count || activeOrder.value.token_count)
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '模拟支付失败')
  }
}

watch(planMode, (mode) => {
  if (mode === 'custom') {
    customAmount.value = normalizeAmount(customAmount.value)
  }
})

async function handleGuestLogin() {
  await login()
}

async function initializeRechargePage() {
  if (isGuest.value) return
  await Promise.all([refreshBalance(), loadRecords()])
}

watch(isGuest, (guest) => {
  if (!guest) {
    void initializeRechargePage()
  }
})

onMounted(async () => {
  await initializeRechargePage()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <section class="token-recharge">
    <section v-if="isGuest" class="token-recharge__guest">
      <h1 class="token-recharge__guest-title">Token 充值</h1>
      <p class="token-recharge__guest-message">请先登录以充值和使用商业字体</p>
      <button
        type="button"
        class="token-recharge__guest-login"
        :disabled="isLoggingIn"
        @click="handleGuestLogin"
      >
        {{ isLoggingIn ? '登录中…' : '登录' }}
      </button>
    </section>

    <template v-else>
    <header class="token-recharge__header">
      <h1 class="token-recharge__title">Token 充值</h1>
      <p class="token-recharge__balance">
        我的 Token：<strong>{{ balance }}</strong>
      </p>
    </header>

    <div class="token-recharge__panel">
      <fieldset class="token-recharge__options">
        <legend class="token-recharge__legend">选择充值方式</legend>

        <label class="token-recharge__option">
          <input v-model="planMode" type="radio" name="recharge-plan" value="preset" />
          <span>{{ PRESET_RECHARGE_AMOUNT }} 元包 → {{ calcTokenCount(PRESET_RECHARGE_AMOUNT) }} Token</span>
        </label>

        <label class="token-recharge__option token-recharge__option--custom">
          <input v-model="planMode" type="radio" name="recharge-plan" value="custom" />
          <span>自定义金额：</span>
          <input
            v-model.number="customAmount"
            type="number"
            min="10"
            step="10"
            class="token-recharge__amount-input"
            :disabled="planMode !== 'custom'"
            @blur="handleCustomAmountBlur"
          />
          <span>元 → {{ selectedTokenCount }} Token</span>
        </label>
      </fieldset>

      <p class="token-recharge__summary">
        本次可获得 <strong>{{ selectedTokenCount }}</strong> Token（{{ TOKENS_PER_YUAN }} Token / 元）
      </p>

      <button
        type="button"
        class="token-recharge__submit"
        :disabled="submitting || !isAmountValid"
        @click="handleRecharge"
      >
        {{ submitting ? '创建订单中…' : '立即充值' }}
      </button>
    </div>

    <section class="token-recharge__records">
      <h2 class="token-recharge__records-title">充值记录</h2>

      <div v-if="recordsLoading" class="token-recharge__records-empty">加载中…</div>
      <div v-else-if="records.length === 0" class="token-recharge__records-empty">暂无充值记录</div>

      <div v-else class="token-recharge__table-wrap">
        <table class="token-recharge__table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">金额</th>
              <th scope="col">Token 数</th>
              <th scope="col">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td>{{ formatRecordTime(record.created_at) }}</td>
              <td>{{ record.amount }} 元</td>
              <td>{{ record.token_count }}</td>
              <td>
                <span
                  class="token-recharge__status"
                  :class="{
                    'token-recharge__status--paid': record.status === 'paid',
                    'token-recharge__status--pending': record.status === 'pending',
                    'token-recharge__status--failed': record.status === 'failed',
                  }"
                >
                  {{ formatRechargeStatus(record.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="paymentVisible"
        class="token-recharge-payment"
        @mousedown.self="closePaymentModal"
      >
        <div class="token-recharge-payment__dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title">
          <header class="token-recharge-payment__header">
            <h2 id="payment-title">扫码支付</h2>
            <button type="button" class="token-recharge-payment__close" aria-label="关闭" @click="closePaymentModal">
              ×
            </button>
          </header>

          <div class="token-recharge-payment__tabs">
            <button
              type="button"
              class="token-recharge-payment__tab"
              :class="{ 'token-recharge-payment__tab--active': paymentChannel === 'wechat' }"
              @click="paymentChannel = 'wechat'"
            >
              微信支付
            </button>
            <button
              type="button"
              class="token-recharge-payment__tab"
              :class="{ 'token-recharge-payment__tab--active': paymentChannel === 'alipay' }"
              @click="paymentChannel = 'alipay'"
            >
              支付宝
            </button>
          </div>

          <div class="token-recharge-payment__body">
            <p class="token-recharge-payment__amount">
              支付 {{ activeOrder?.amount }} 元，获得 {{ activeOrder?.token_count }} Token
            </p>

            <div class="token-recharge-payment__qr-wrap">
              <img
                v-if="activeQrCode"
                :src="activeQrCode"
                :alt="paymentChannel === 'alipay' ? '支付宝支付二维码' : '微信支付二维码'"
                class="token-recharge-payment__qr"
              />
              <p v-else class="token-recharge-payment__qr-loading">二维码生成中…</p>
            </div>

            <p v-if="paymentPolling" class="token-recharge-payment__polling">等待支付结果…</p>

            <button
              v-if="isDev"
              type="button"
              class="token-recharge-payment__simulate"
              @click="handleSimulatePay"
            >
              开发环境：模拟支付成功
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    </template>
  </section>
</template>

<style scoped>
.token-recharge {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: var(--theme-bg, #fff);
}

.token-recharge__guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  max-width: 480px;
  margin: 48px auto 0;
  padding: 32px 24px;
  text-align: center;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 12px;
  background: var(--theme-bg-subtle, #f8fafc);
}

.token-recharge__guest-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.token-recharge__guest-message {
  margin: 0 0 24px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge__guest-login {
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 8px;
  background: var(--theme-accent, #2563eb);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.token-recharge__guest-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.token-recharge__header {
  margin-bottom: 20px;
}

.token-recharge__title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.token-recharge__balance {
  margin: 0;
  font-size: 15px;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge__balance strong {
  color: var(--theme-accent, #2563eb);
  font-size: 18px;
}

.token-recharge__panel {
  max-width: 520px;
  padding: 20px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 12px;
  background: var(--theme-bg-subtle, #f8fafc);
}

.token-recharge__options {
  margin: 0;
  padding: 0;
  border: none;
}

.token-recharge__legend {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.token-recharge__option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--theme-fg, #334155);
  cursor: pointer;
}

.token-recharge__option--custom {
  flex-wrap: wrap;
}

.token-recharge__amount-input {
  width: 72px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 6px;
  font-size: 14px;
}

.token-recharge__summary {
  margin: 16px 0;
  font-size: 14px;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge__submit {
  height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  background: var(--theme-accent, #2563eb);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.token-recharge__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-recharge__records {
  margin-top: 32px;
}

.token-recharge__records-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.token-recharge__records-empty {
  padding: 24px;
  text-align: center;
  color: var(--theme-fg-muted, #64748b);
  font-size: 14px;
}

.token-recharge__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 12px;
}

.token-recharge__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.token-recharge__table th,
.token-recharge__table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.token-recharge__table th {
  background: var(--theme-bg-subtle, #f8fafc);
  color: var(--theme-fg-muted, #64748b);
  font-weight: 500;
}

.token-recharge__table tbody tr:last-child td {
  border-bottom: none;
}

.token-recharge__status--paid {
  color: #16a34a;
}

.token-recharge__status--pending {
  color: #d97706;
}

.token-recharge__status--failed {
  color: #dc2626;
}

.token-recharge-payment {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.token-recharge-payment__dialog {
  width: min(420px, 100%);
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
}

.token-recharge-payment__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.token-recharge-payment__header h2 {
  margin: 0;
  font-size: 18px;
}

.token-recharge-payment__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
}

.token-recharge-payment__tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
}

.token-recharge-payment__tab {
  flex: 1;
  height: 36px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  font-size: 13px;
  cursor: pointer;
}

.token-recharge-payment__tab--active {
  border-color: var(--theme-accent, #2563eb);
  color: var(--theme-accent, #2563eb);
  background: rgba(37, 99, 235, 0.08);
}

.token-recharge-payment__body {
  padding: 16px 20px 20px;
  text-align: center;
}

.token-recharge-payment__amount {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge-payment__qr-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
}

.token-recharge-payment__qr {
  width: 200px;
  height: 200px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: #fff;
}

.token-recharge-payment__qr-loading,
.token-recharge-payment__polling {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge-payment__simulate {
  margin-top: 12px;
  height: 34px;
  padding: 0 12px;
  border: 1px dashed var(--theme-border, #cbd5e1);
  border-radius: 8px;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  font-size: 12px;
  cursor: pointer;
}
</style>
