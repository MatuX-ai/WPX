<script setup>
import { ref, watch } from 'vue'
import { createTokenRechargeOrder } from '@/utils/fontMarketApi'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'success'])

const toast = useToast()
const amount = ref(10)
const submitting = ref(false)

const presetAmounts = [10, 20, 50, 100]

function handleClose() {
  emit('close')
}

async function handleRecharge() {
  if (submitting.value) return

  submitting.value = true
  try {
    const order = await createTokenRechargeOrder(amount.value)
    if (order.payment_url && typeof window !== 'undefined') {
      window.open(order.payment_url, '_blank', 'noopener,noreferrer')
    }
    emit('success', order)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '创建充值订单失败')
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      amount.value = 10
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="token-recharge-backdrop"
      @mousedown.self="handleClose"
    >
      <div class="token-recharge-dialog" role="dialog" aria-modal="true" aria-labelledby="token-recharge-title">
        <header class="token-recharge-dialog__header">
          <h2 id="token-recharge-title">Token 充值</h2>
          <button type="button" class="token-recharge-dialog__close" aria-label="关闭" @click="handleClose">
            ×
          </button>
        </header>

        <div class="token-recharge-dialog__body">
          <p class="token-recharge-dialog__hint">1 元 = 20 Token，金额需为 10 的倍数</p>

          <div class="token-recharge-dialog__presets">
            <button
              v-for="value in presetAmounts"
              :key="value"
              type="button"
              class="token-recharge-dialog__preset"
              :class="{ 'token-recharge-dialog__preset--active': amount === value }"
              @click="amount = value"
            >
              {{ value }} 元
            </button>
          </div>

          <label class="token-recharge-dialog__label" for="token-recharge-amount">充值金额（元）</label>
          <input
            id="token-recharge-amount"
            v-model.number="amount"
            type="number"
            min="10"
            step="10"
            class="token-recharge-dialog__input"
          />
        </div>

        <footer class="token-recharge-dialog__footer">
          <button type="button" class="token-recharge-dialog__btn token-recharge-dialog__btn--ghost" @click="handleClose">
            取消
          </button>
          <button
            type="button"
            class="token-recharge-dialog__btn token-recharge-dialog__btn--primary"
            :disabled="submitting || amount < 10 || amount % 10 !== 0"
            @click="handleRecharge"
          >
            {{ submitting ? '处理中…' : '确认充值' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.token-recharge-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.token-recharge-dialog {
  width: min(420px, 100%);
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
}

.token-recharge-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.token-recharge-dialog__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.token-recharge-dialog__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
}

.token-recharge-dialog__body {
  padding: 16px 20px;
}

.token-recharge-dialog__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge-dialog__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.token-recharge-dialog__preset {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: var(--theme-bg, #fff);
  font-size: 13px;
  cursor: pointer;
}

.token-recharge-dialog__preset--active {
  border-color: var(--theme-accent, #2563eb);
  color: var(--theme-accent, #2563eb);
  background: rgba(37, 99, 235, 0.08);
}

.token-recharge-dialog__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.token-recharge-dialog__input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
}

.token-recharge-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
}

.token-recharge-dialog__btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.token-recharge-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-recharge-dialog__btn--ghost {
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
}

.token-recharge-dialog__btn--primary {
  border: none;
  background: var(--theme-accent, #2563eb);
  color: #fff;
}
</style>
