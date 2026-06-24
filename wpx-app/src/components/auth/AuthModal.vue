<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { X, Mail, Lock, User as UserIcon, Eye, EyeOff } from '@lucide/vue'
import { useAuthModalStore } from '@/stores/authModal'
import {
  loginWithCredentials,
  registerWithCredentials
} from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

const authModalStore = useAuthModalStore()
const authStore = useAuthStore()
const { visible, mode, busy, initialError } = storeToRefs(authModalStore)

const email = ref('')
const password = ref('')
const nickname = ref('')
const showPassword = ref(false)
const errorMsg = ref('')
const justRegistered = ref(false)

const isRegisterMode = computed(() => mode.value === 'register')

const dialogTitle = computed(() => {
  if (justRegistered.value) return '注册成功，请验证邮箱'
  return isRegisterMode.value ? '创建 WPX 账号' : '登录 WPX'
})
const dialogSubtitle = computed(() => {
  if (justRegistered.value) {
    return '请前往邮箱完成验证，验证后可立即登录'
  }
  return isRegisterMode.value
    ? '使用邮箱注册账号，WPX 承诺仅用于登录与同步'
    : '使用注册时的邮箱与密码登录（prowpx.com 自托管认证）'
})

watch(visible, (next) => {
  if (next) {
    errorMsg.value = initialError.value || ''
    justRegistered.value = false
    if (!email.value) email.value = ''
    if (!password.value) password.value = ''
    if (!nickname.value) nickname.value = ''
  } else {
    // 关闭时清理，避免下次打开残留
    setTimeout(() => {
      password.value = ''
      nickname.value = ''
      errorMsg.value = ''
      justRegistered.value = false
    }, 200)
  }
})

watch(isRegisterMode, () => {
  errorMsg.value = ''
})

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

async function handleSubmit() {
  if (busy.value) return
  errorMsg.value = ''
  authModalStore.setBusy(true)

  try {
    const normalizedEmail = email.value.trim().toLowerCase()

    if (!validateEmail(normalizedEmail)) {
      throw new Error('请输入正确的邮箱地址')
    }

    if (isRegisterMode.value) {
      if (String(password.value).length < 8) {
        throw new Error('密码至少 8 位，建议同时包含字母与数字')
      }
      const result = await registerWithCredentials({
        email: normalizedEmail,
        password: password.value,
        nickname: nickname.value.trim() || undefined
      })
      await authStore.login(result.token, result.refreshToken, result.user)
      justRegistered.value = true
      authModalStore.setBusy(false)
      // 给用户几秒时间看到「注册成功」提示，然后自动关闭
      window.setTimeout(() => {
        if (justRegistered.value) {
          authModalStore.resolveWith({
            success: true,
            reason: 'completed',
            user: result.user,
            token: result.token,
            refreshToken: result.refreshToken
          })
        }
      }, 1800)
      return
    }

    const result = await loginWithCredentials(normalizedEmail, password.value)
    await authStore.login(result.token, result.refreshToken, result.user)
    authModalStore.resolveWith({
      success: true,
      reason: 'completed',
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    })
  } catch (error) {
    errorMsg.value = error?.message || '登录失败，请稍后重试'
    authModalStore.setBusy(false)
  }
}

function handleDismiss() {
  if (busy.value) return
  authModalStore.dismiss()
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

function switchMode(target) {
  if (busy.value) return
  if (target === 'register') {
    authModalStore.switchToRegister()
  } else {
    authModalStore.switchToLogin()
  }
}

const submitLabel = computed(() => {
  if (justRegistered.value) return '已注册，正在关闭…'
  if (busy.value) return isRegisterMode.value ? '注册中…' : '登录中…'
  return isRegisterMode.value ? '注册账号' : '登录'
})

const submitDisabled = computed(() => {
  if (busy.value) return true
  if (justRegistered.value) return true
  if (!email.value || !password.value) return true
  if (isRegisterMode.value && password.value.length < 8) return true
  return false
})
</script>

<template>
  <Teleport to="body">
    <Transition name="auth-modal">
      <div
        v-if="visible"
        class="auth-modal-backdrop"
        role="presentation"
        @mousedown.self="handleBackdropClick"
      >
        <div
          class="auth-modal"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`auth-modal-title-${mode}`"
          @keydown="handleKeydown"
        >
          <button
            type="button"
            class="auth-modal__close"
            aria-label="关闭"
            :disabled="busy"
            @click="handleDismiss"
          >
            <X :size="18" :stroke-width="2" />
          </button>

          <header class="auth-modal__header">
            <h2 :id="`auth-modal-title-${mode}`" class="auth-modal__title">
              {{ dialogTitle }}
            </h2>
            <p class="auth-modal__subtitle">{{ dialogSubtitle }}</p>
          </header>

          <form class="auth-modal__form" @submit.prevent="handleSubmit">
            <label class="auth-modal__field">
              <span class="auth-modal__label">邮箱</span>
              <span class="auth-modal__input-wrap">
                <Mail
                  class="auth-modal__input-icon"
                  :size="16"
                  :stroke-width="1.8"
                  aria-hidden="true"
                />
                <input
                  v-model="email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  placeholder="you@prowpx.com"
                  required
                  :disabled="busy || justRegistered"
                  class="auth-modal__input"
                >
              </span>
            </label>

            <label v-if="isRegisterMode" class="auth-modal__field">
              <span class="auth-modal__label">昵称（可选）</span>
              <span class="auth-modal__input-wrap">
                <UserIcon
                  class="auth-modal__input-icon"
                  :size="16"
                  :stroke-width="1.8"
                  aria-hidden="true"
                />
                <input
                  v-model="nickname"
                  type="text"
                  autocomplete="nickname"
                  placeholder="给自己起个昵称"
                  maxlength="32"
                  :disabled="busy || justRegistered"
                  class="auth-modal__input"
                >
              </span>
            </label>

            <label class="auth-modal__field">
              <span class="auth-modal__label">密码</span>
              <span class="auth-modal__input-wrap">
                <Lock
                  class="auth-modal__input-icon"
                  :size="16"
                  :stroke-width="1.8"
                  aria-hidden="true"
                />
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  :autocomplete="isRegisterMode ? 'new-password' : 'current-password'"
                  :placeholder="isRegisterMode ? '至少 8 位，建议字母+数字' : '请输入密码'"
                  :minlength="isRegisterMode ? 8 : 1"
                  required
                  :disabled="busy || justRegistered"
                  class="auth-modal__input"
                >
                <button
                  type="button"
                  class="auth-modal__toggle-pwd"
                  :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  :disabled="busy || justRegistered"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" :size="16" :stroke-width="1.8" />
                  <EyeOff v-else :size="16" :stroke-width="1.8" />
                </button>
              </span>
            </label>

            <div
              v-if="errorMsg"
              class="auth-modal__error"
              role="alert"
            >
              {{ errorMsg }}
            </div>

            <button
              type="submit"
              class="auth-modal__submit"
              :disabled="submitDisabled"
            >
              {{ submitLabel }}
            </button>

            <div class="auth-modal__switch">
              <template v-if="isRegisterMode">
                <span>已有账号？</span>
                <button
                  type="button"
                  class="auth-modal__switch-btn"
                  :disabled="busy || justRegistered"
                  @click="switchMode('login')"
                >
                  直接登录
                </button>
              </template>
              <template v-else>
                <span>还没有账号？</span>
                <button
                  type="button"
                  class="auth-modal__switch-btn"
                  :disabled="busy"
                  @click="switchMode('register')"
                >
                  立即注册
                </button>
              </template>
            </div>
          </form>

          <footer class="auth-modal__footer">
            <span>登录即代表同意</span>
            <a href="https://prowpx.com/terms" target="_blank" rel="noopener noreferrer">
              服务条款
            </a>
            <span>与</span>
            <a href="https://prowpx.com/privacy" target="_blank" rel="noopener noreferrer">
              隐私政策
            </a>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(15 23 42 / 55%);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.auth-modal {
  position: relative;
  width: min(420px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border-radius: 16px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 28px 56px rgb(15 23 42 / 24%);
  padding: 28px 28px 22px;
  color: var(--theme-fg, #0f172a);
}

.auth-modal__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.auth-modal__close:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f1f5f9);
  color: var(--theme-fg, #0f172a);
}

.auth-modal__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-modal__header {
  margin-bottom: 20px;
}

.auth-modal__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--theme-fg, #0f172a);
}

.auth-modal__subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--theme-fg-muted, #64748b);
}

.auth-modal__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-modal__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-fg-muted, #475569);
}

.auth-modal__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-modal__input-icon {
  position: absolute;
  left: 12px;
  color: var(--theme-fg-muted, #94a3b8);
  pointer-events: none;
}

.auth-modal__input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #0f172a);
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.auth-modal__input:focus {
  border-color: var(--theme-accent, #2563eb);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #2563eb) 18%, transparent);
}

.auth-modal__input:disabled {
  background: var(--theme-bg-subtle, #f8fafc);
  cursor: not-allowed;
}

.auth-modal__toggle-pwd {
  position: absolute;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-fg-muted, #94a3b8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.auth-modal__toggle-pwd:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f1f5f9);
  color: var(--theme-fg, #0f172a);
}

.auth-modal__error {
  font-size: 13px;
  line-height: 1.5;
  color: #b91c1c;
  background: rgb(254 226 226 / 65%);
  border: 1px solid rgb(252 165 165 / 60%);
  border-radius: 8px;
  padding: 8px 12px;
}

.auth-modal__submit {
  margin-top: 4px;
  height: 42px;
  border: none;
  border-radius: 8px;
  background: var(--theme-accent, #2563eb);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.auth-modal__submit:hover:not(:disabled) {
  background: var(--theme-accent-hover, #1d4ed8);
}

.auth-modal__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-modal__switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
  margin-top: 6px;
}

.auth-modal__switch-btn {
  border: none;
  background: transparent;
  color: var(--theme-accent, #2563eb);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.auth-modal__switch-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--theme-accent, #2563eb) 12%, transparent);
}

.auth-modal__switch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-modal__footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
  font-size: 12px;
  color: var(--theme-fg-muted, #94a3b8);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.auth-modal__footer a {
  color: var(--theme-accent, #2563eb);
  text-decoration: none;
}

.auth-modal__footer a:hover {
  text-decoration: underline;
}

.auth-modal-enter-active,
.auth-modal-leave-active {
  transition: opacity 0.15s ease;
}

.auth-modal-enter-active .auth-modal,
.auth-modal-leave-active .auth-modal {
  transition: transform 0.18s ease;
}

.auth-modal-enter-from,
.auth-modal-leave-to {
  opacity: 0;
}

.auth-modal-enter-from .auth-modal,
.auth-modal-leave-to .auth-modal {
  transform: translateY(8px) scale(0.98);
}

@media (prefers-color-scheme: dark) {
  .auth-modal__error {
    color: #fecaca;
    background: rgb(127 29 29 / 40%);
    border-color: rgb(185 28 28 / 50%);
  }
}
</style>
