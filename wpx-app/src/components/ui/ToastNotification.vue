<script setup>
import { useToastStore } from '@/stores/toast'
import { Z_INDEX } from '@/constants/zIndex'

const toastStore = useToastStore()

const typeConfig = {
  success: {
    label: '成功',
    iconClass: 'toast-item__icon--success',
    iconPath:
      'M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z',
  },
  error: {
    label: '错误',
    iconClass: 'toast-item__icon--error',
    iconPath:
      'M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z',
  },
  warning: {
    label: '警告',
    iconClass: 'toast-item__icon--warning',
    iconPath:
      'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
  },
  info: {
    label: '提示',
    iconClass: 'toast-item__icon--info',
    iconPath:
      'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z',
  },
}

function ariaRole(type) {
  return type === 'error' ? 'alert' : 'status'
}
</script>

<template>
  <div
    class="toast-stack"
    :style="{ zIndex: Z_INDEX.toast }"
    aria-label="通知"
  >
    <TransitionGroup name="toast" tag="div" class="toast-stack__list">
      <article
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast-item"
        :class="`toast-item--${toast.type}`"
        :role="ariaRole(toast.type)"
        :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
        :aria-atomic="true"
      >
        <span
          class="toast-item__icon"
          :class="typeConfig[toast.type]?.iconClass"
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              :d="typeConfig[toast.type]?.iconPath"
              clip-rule="evenodd"
            />
          </svg>
        </span>

        <div class="toast-item__body">
          <p class="toast-item__label">
            {{ typeConfig[toast.type]?.label }}
          </p>
          <p class="toast-item__message">
            {{ toast.message }}
          </p>
        </div>

        <button
          v-if="toast.closable"
          type="button"
          class="toast-item__close"
          :aria-label="`关闭${typeConfig[toast.type]?.label}通知`"
          @click="toastStore.remove(toast.id)"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
            />
          </svg>
        </button>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: calc(36px + 3.5rem + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: min(100% - 32px, 24rem);
  pointer-events: none;
}

.toast-stack__list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (min-width: 768px) {
  .toast-stack {
    top: calc(36px + 3.5rem + 16px);
    left: auto;
    right: 16px;
    transform: none;
    width: min(100% - 32px, 22rem);
  }
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--theme-radius-md);
  border: 1px solid transparent;
  box-shadow: var(--theme-shadow-md);
  backdrop-filter: blur(8px);
}

.toast-item__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
}

.toast-item__icon svg {
  width: 20px;
  height: 20px;
}

.toast-item__body {
  flex: 1;
  min-width: 0;
}

.toast-item__label {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.toast-item__message {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.toast-item__close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -2px -4px 0 0;
  padding: 0;
  border: none;
  border-radius: var(--theme-radius-sm);
  background: transparent;
  color: inherit;
  opacity: 0.65;
  cursor: pointer;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.toast-item__close svg {
  width: 16px;
  height: 16px;
}

.toast-item__close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.toast-item__close:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  opacity: 1;
}

.toast-item--success {
  background: color-mix(in srgb, #22c55e 12%, var(--theme-surface));
  border-color: color-mix(in srgb, #22c55e 35%, var(--theme-border));
  color: #14532d;
}

.toast-item__icon--success {
  color: #16a34a;
}

.toast-item--error {
  background: color-mix(in srgb, #ef4444 12%, var(--theme-surface));
  border-color: color-mix(in srgb, #ef4444 35%, var(--theme-border));
  color: #7f1d1d;
}

.toast-item__icon--error {
  color: #dc2626;
}

.toast-item--warning {
  background: color-mix(in srgb, #eab308 14%, var(--theme-surface));
  border-color: color-mix(in srgb, #eab308 40%, var(--theme-border));
  color: #713f12;
}

.toast-item__icon--warning {
  color: #ca8a04;
}

.toast-item--info {
  background: color-mix(in srgb, #3b82f6 12%, var(--theme-surface));
  border-color: color-mix(in srgb, #3b82f6 35%, var(--theme-border));
  color: #1e3a8a;
}

.toast-item__icon--info {
  color: #2563eb;
}

:root[data-theme='dark'] .toast-item--success {
  color: #bbf7d0;
}

:root[data-theme='dark'] .toast-item--error {
  color: #fecaca;
}

:root[data-theme='dark'] .toast-item--warning {
  color: #fef08a;
}

:root[data-theme='dark'] .toast-item--info {
  color: #bfdbfe;
}

:root[data-theme='dark'] .toast-item__close:hover {
  background: rgba(255, 255, 255, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .toast-item--success {
    color: #bbf7d0;
  }

  :root:not([data-theme='light']) .toast-item--error {
    color: #fecaca;
  }

  :root:not([data-theme='light']) .toast-item--warning {
    color: #fef08a;
  }

  :root:not([data-theme='light']) .toast-item--info {
    color: #bfdbfe;
  }

  :root:not([data-theme='light']) .toast-item__close:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>
