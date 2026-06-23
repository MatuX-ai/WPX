<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { MAX_ZIP_PROGRESS_ITEMS, useZipStore } from '@/stores/zip'
import { Z_INDEX } from '@/constants/zIndex'

const zipStore = useZipStore()
const { operations } = storeToRefs(zipStore)

const dismissTimers = new Map()

const visibleOperations = computed(() => {
  const active = operations.value.filter((item) =>
    ['running', 'success', 'error', 'cancelled'].includes(item.status),
  )
  return active.slice(-MAX_ZIP_PROGRESS_ITEMS)
})

function getOperationTitle(operation) {
  if (operation.status === 'success') {
    return operation.type === 'compress' ? '压缩完成' : '解压完成'
  }
  if (operation.status === 'error') {
    return operation.type === 'compress' ? '压缩失败' : '解压失败'
  }
  if (operation.status === 'cancelled') {
    return operation.type === 'compress' ? '压缩已取消' : '解压已取消'
  }

  if (operation.label) return operation.label
  return operation.type === 'compress' ? '正在压缩…' : '正在解压…'
}

function getFileName(filePath = '') {
  if (!filePath) return ''
  const normalized = String(filePath)
  const lastSep = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  return lastSep >= 0 ? normalized.slice(lastSep + 1) : normalized
}

function scheduleDismiss(operation) {
  if (dismissTimers.has(operation.operationId)) return

  let delay = 0
  if (operation.status === 'success') delay = 2000
  else if (operation.status === 'error') delay = 5000
  else if (operation.status === 'cancelled') delay = 1500
  else return

  const timer = window.setTimeout(() => {
    zipStore.removeOperation(operation.operationId)
    dismissTimers.delete(operation.operationId)
  }, delay)

  dismissTimers.set(operation.operationId, timer)
}

async function handleCancel(operationId) {
  await zipStore.cancelOperation(operationId)
}

watch(
  operations,
  (items) => {
    items.forEach((item) => {
      if (['success', 'error', 'cancelled'].includes(item.status)) {
        scheduleDismiss(item)
      }
    })
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  dismissTimers.forEach((timer) => window.clearTimeout(timer))
  dismissTimers.clear()
})
</script>

<template>
  <div
    class="zip-progress-stack"
    :style="{ zIndex: Z_INDEX.toast }"
    aria-label="压缩解压进度"
  >
    <TransitionGroup name="zip-progress" tag="div" class="zip-progress-stack__list">
      <article
        v-for="operation in visibleOperations"
        :key="operation.operationId"
        class="zip-progress"
        :class="`zip-progress--${operation.status}`"
        role="status"
        aria-live="polite"
      >
        <div class="zip-progress__header">
          <div class="zip-progress__meta">
            <span class="zip-progress__title">{{ getOperationTitle(operation) }}</span>
            <span class="zip-progress__percent">{{ operation.percent }}%</span>
          </div>
          <button
            v-if="operation.status === 'running'"
            type="button"
            class="zip-progress__cancel"
            aria-label="取消操作"
            @click="handleCancel(operation.operationId)"
          >
            ✕
          </button>
        </div>

        <div class="zip-progress__track" aria-hidden="true">
          <div
            class="zip-progress__fill"
            :style="{ width: `${Math.max(0, Math.min(100, operation.percent))}%` }"
          />
        </div>

        <p v-if="operation.status === 'running' && operation.currentFile" class="zip-progress__file">
          {{ getFileName(operation.currentFile) }}
        </p>
        <p v-else-if="operation.status === 'error' && operation.error" class="zip-progress__message">
          {{ operation.error }}
        </p>
        <p v-else-if="operation.status === 'success'" class="zip-progress__message zip-progress__message--success">
          操作已完成
        </p>
        <p
          v-else-if="operation.status === 'cancelled'"
          class="zip-progress__message zip-progress__message--muted"
        >
          操作已取消
        </p>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.zip-progress-stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: min(100% - 32px, 22rem);
  pointer-events: none;
}

.zip-progress-stack__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zip-progress {
  pointer-events: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  padding: 12px 14px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(8px);
}

.zip-progress--success {
  border-color: #86efac;
  background: rgba(240, 253, 244, 0.98);
}

.zip-progress--error {
  border-color: #fca5a5;
  background: rgba(254, 242, 242, 0.98);
}

.zip-progress--cancelled {
  border-color: #cbd5e1;
  background: rgba(248, 250, 252, 0.98);
}

.zip-progress__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.zip-progress__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.zip-progress__title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zip-progress__percent {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.zip-progress--success .zip-progress__percent {
  color: #15803d;
}

.zip-progress--error .zip-progress__percent {
  color: #dc2626;
}

.zip-progress__cancel {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.zip-progress__cancel:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.zip-progress__track {
  height: 6px;
  border-radius: 999px;
  background: #eef2ff;
  overflow: hidden;
}

.zip-progress--success .zip-progress__track {
  background: #dcfce7;
}

.zip-progress--error .zip-progress__track {
  background: #fee2e2;
}

.zip-progress--cancelled .zip-progress__track {
  background: #e2e8f0;
}

.zip-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7c3aed, #8b5cf6);
  transition: width 0.25s ease;
}

.zip-progress--success .zip-progress__fill {
  background: linear-gradient(90deg, #16a34a, #22c55e);
}

.zip-progress--error .zip-progress__fill {
  background: linear-gradient(90deg, #dc2626, #ef4444);
}

.zip-progress--cancelled .zip-progress__fill {
  background: #94a3b8;
}

.zip-progress__file,
.zip-progress__message {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zip-progress__message--success {
  color: #15803d;
}

.zip-progress__message--muted {
  color: #94a3b8;
}

.zip-progress-enter-active,
.zip-progress-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.zip-progress-enter-from,
.zip-progress-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.zip-progress-move {
  transition: transform 0.2s ease;
}
</style>
