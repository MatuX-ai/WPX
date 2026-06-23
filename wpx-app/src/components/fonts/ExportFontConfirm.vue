<script setup>
import { computed } from 'vue'

const GUEST_PROMPT_MESSAGE = '使用商业字体需要登录并拥有 Token，登录后即可使用'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  isGuest: {
    type: Boolean,
    default: false,
  },
  loginLoading: {
    type: Boolean,
    default: false,
  },
  fonts: {
    type: Array,
    default: () => [],
  },
  totalCost: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  sufficient: {
    type: Boolean,
    default: true,
  },
  shortfall: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['confirm', 'recharge', 'use-free-font', 'login', 'close'])

const confirmLabel = computed(() => {
  if (props.loading) return '处理中…'
  if (!props.sufficient) return '余额不足'
  return '确认导出'
})

function handleClose() {
  if (props.loading) return
  emit('close')
}

function handleConfirm() {
  if (props.loading || !props.sufficient) return
  emit('confirm')
}

function handleRecharge() {
  if (props.loading) return
  emit('recharge')
}

function handleUseFreeFont() {
  if (props.loading) return
  emit('use-free-font')
}

function handleLogin() {
  if (props.loading || props.loginLoading) return
  emit('login')
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="export-font-confirm-backdrop"
      @mousedown.self="handleClose"
    >
      <div
        class="export-font-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-font-confirm-title"
        @keydown="handleKeydown"
      >
        <header class="export-font-confirm__header">
          <h2 id="export-font-confirm-title">
            {{ isGuest ? '商业字体导出' : '本次导出包含商业字体' }}
          </h2>
          <button
            type="button"
            class="export-font-confirm__close"
            aria-label="关闭"
            :disabled="loading || loginLoading"
            @click="handleClose"
          >
            ×
          </button>
        </header>

        <div v-if="isGuest" class="export-font-confirm__body">
          <p class="export-font-confirm__guest-message">{{ GUEST_PROMPT_MESSAGE }}</p>
        </div>

        <div v-else class="export-font-confirm__body">
          <div class="export-font-confirm__table-wrap">
            <table class="export-font-confirm__table">
              <thead>
                <tr>
                  <th scope="col">字体名称</th>
                  <th scope="col">使用字数</th>
                  <th scope="col">Token 消耗</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="font in fonts" :key="font.fontId">
                  <td>
                    <span>{{ font.name }}</span>
                    <span class="export-font-confirm__paid">⚡</span>
                  </td>
                  <td>{{ font.charCount }}</td>
                  <td>
                    <span v-if="font.deduplicated" class="export-font-confirm__dedup">0（已扣费）</span>
                    <span v-else>{{ font.tokenCost }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="export-font-confirm__summary">
            总计消耗 <strong>{{ totalCost }}</strong> Token（当前余额 <strong>{{ balance }}</strong>）
          </p>

          <p v-if="!sufficient" class="export-font-confirm__shortfall">
            还差 {{ shortfall }} Token
          </p>

          <p class="export-font-confirm__hint">7天内重复导出本文档不扣费</p>
        </div>

        <footer class="export-font-confirm__footer">
          <template v-if="isGuest">
            <button
              type="button"
              class="export-font-confirm__btn export-font-confirm__btn--primary"
              :disabled="loading || loginLoading"
              @click="handleLogin"
            >
              {{ loginLoading ? '登录中…' : '登录' }}
            </button>
            <button
              type="button"
              class="export-font-confirm__btn export-font-confirm__btn--ghost"
              :disabled="loading || loginLoading"
              @click="handleUseFreeFont"
            >
              改用免费字体
            </button>
          </template>
          <template v-else>
          <button
            type="button"
            class="export-font-confirm__btn export-font-confirm__btn--primary"
            :disabled="loading || !sufficient"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </button>
          <button
            type="button"
            class="export-font-confirm__btn export-font-confirm__btn--ghost"
            :disabled="loading"
            @click="handleRecharge"
          >
            去充值
          </button>
          <button
            type="button"
            class="export-font-confirm__btn export-font-confirm__btn--ghost"
            :disabled="loading"
            @click="handleUseFreeFont"
          >
            改用免费字体
          </button>
          </template>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.export-font-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.export-font-confirm {
  width: min(520px, 100%);
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
}

.export-font-confirm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.export-font-confirm__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.export-font-confirm__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.export-font-confirm__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-font-confirm__body {
  padding: 16px 20px;
}

.export-font-confirm__guest-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--theme-fg, #334155);
}

.export-font-confirm__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 10px;
}

.export-font-confirm__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.export-font-confirm__table th,
.export-font-confirm__table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.export-font-confirm__table th {
  background: var(--theme-bg-subtle, #f8fafc);
  color: var(--theme-fg-muted, #64748b);
  font-weight: 500;
}

.export-font-confirm__table tbody tr:last-child td {
  border-bottom: none;
}

.export-font-confirm__paid {
  margin-left: 4px;
  color: #d97706;
  font-size: 12px;
}

.export-font-confirm__dedup {
  color: #16a34a;
}

.export-font-confirm__summary {
  margin: 16px 0 8px;
  font-size: 14px;
  color: var(--theme-fg, #334155);
}

.export-font-confirm__shortfall {
  margin: 0 0 8px;
  font-size: 13px;
  color: #dc2626;
}

.export-font-confirm__hint {
  margin: 0;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.export-font-confirm__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
}

.export-font-confirm__btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.export-font-confirm__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.export-font-confirm__btn--primary {
  border: none;
  background: var(--theme-accent, #2563eb);
  color: #fff;
}

.export-font-confirm__btn--ghost {
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
}
</style>
