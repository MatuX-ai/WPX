<script setup>
import { storeToRefs } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { useLoginGuideStore } from '@/stores/loginGuide'

const loginGuideStore = useLoginGuideStore()
const { visible, loggingIn } = storeToRefs(loginGuideStore)
const { login } = useAuth()

function handleDismiss() {
  if (loggingIn.value) return
  loginGuideStore.dismiss()
}

async function handleLogin() {
  if (loggingIn.value) return

  loginGuideStore.setLoggingIn(true)

  try {
    await login()
    loginGuideStore.complete(true)
  } catch {
    loginGuideStore.complete(false)
  }
}

function handleBackdropClick() {
  handleDismiss()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleDismiss()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="login-guide">
      <div
        v-if="visible"
        class="login-guide-backdrop"
        role="presentation"
        @mousedown.self="handleBackdropClick"
      >
        <div
          class="login-guide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-guide-title"
          @keydown="handleKeydown"
        >
          <p id="login-guide-title" class="login-guide__message">此功能需要登录后使用</p>

          <footer class="login-guide__footer">
            <button
              type="button"
              class="login-guide__btn login-guide__btn--ghost"
              :disabled="loggingIn"
              @click="handleDismiss"
            >
              暂不
            </button>
            <button
              type="button"
              class="login-guide__btn login-guide__btn--primary"
              :disabled="loggingIn"
              @click="handleLogin"
            >
              {{ loggingIn ? '登录中…' : '登录/注册' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.login-guide-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(15 23 42 / 45%);
}

.login-guide {
  width: min(400px, 100%);
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgb(15 23 42 / 18%);
  padding: 24px 24px 20px;
}

.login-guide__message {
  margin: 0 0 24px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
  color: var(--theme-fg, #0f172a);
}

.login-guide__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.login-guide__btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.login-guide__btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.login-guide__btn--ghost {
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
}

.login-guide__btn--ghost:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f8fafc);
}

.login-guide__btn--primary {
  border: none;
  background: var(--theme-accent, #2563eb);
  color: #fff;
}

.login-guide__btn--primary:hover:not(:disabled) {
  background: var(--theme-accent-hover, #1d4ed8);
}

.login-guide-enter-active,
.login-guide-leave-active {
  transition: opacity 0.15s ease;
}

.login-guide-enter-from,
.login-guide-leave-to {
  opacity: 0;
}
</style>
