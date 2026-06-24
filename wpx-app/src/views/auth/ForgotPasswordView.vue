<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, ArrowLeft, CircleCheck } from '@lucide/vue'
import { requestPasswordReset } from '@/composables/useAuth'

defineOptions({ name: 'ForgotPasswordView' })

const router = useRouter()

const form = reactive({
  email: ''
})

const submitting = ref(false)
const errorMsg = ref('')
const success = ref(false)

async function handleSubmit() {
  if (submitting.value) return
  errorMsg.value = ''
  submitting.value = true

  try {
    await requestPasswordReset(form.email)
    success.value = true
  } catch (error) {
    errorMsg.value = error?.message || '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function handleBack() {
  router.replace('/')
}
</script>

<template>
  <div class="forgot-pwd">
    <div class="forgot-pwd__card">
      <button type="button" class="forgot-pwd__back" :disabled="submitting" @click="handleBack">
        <ArrowLeft :size="16" :stroke-width="1.8" />
        <span>返回</span>
      </button>

      <template v-if="!success">
        <h1 class="forgot-pwd__title">找回密码</h1>
        <p class="forgot-pwd__desc">
          请输入注册时的邮箱，我们会发送一封重置密码的链接给你。
        </p>

        <form class="forgot-pwd__form" @submit.prevent="handleSubmit">
          <label class="forgot-pwd__field">
            <span class="forgot-pwd__label">邮箱</span>
            <span class="forgot-pwd__input-wrap">
              <Mail :size="16" :stroke-width="1.8" class="forgot-pwd__input-icon" />
              <input
                v-model="form.email"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@prowpx.com"
                required
                :disabled="submitting"
                class="forgot-pwd__input"
              >
            </span>
          </label>

          <div v-if="errorMsg" class="forgot-pwd__error" role="alert">
            {{ errorMsg }}
          </div>

          <button
            type="submit"
            class="forgot-pwd__submit"
            :disabled="submitting || !form.email"
          >
            {{ submitting ? '发送中…' : '发送重置链接' }}
          </button>
        </form>
      </template>

      <template v-else>
        <CircleCheck :size="40" :stroke-width="1.6" class="forgot-pwd__icon-success" />
        <h1 class="forgot-pwd__title">邮件已发送</h1>
        <p class="forgot-pwd__desc">
          请前往 <strong>{{ form.email }}</strong> 查收邮件。链接将在 30 分钟内有效。
        </p>
        <button type="button" class="forgot-pwd__submit" @click="handleBack">
          返回首页
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.forgot-pwd {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--theme-bg-subtle, #f8fafc);
  color: var(--theme-fg, #0f172a);
}

.forgot-pwd__card {
  position: relative;
  width: min(440px, 100%);
  padding: 36px 28px 28px;
  background: var(--theme-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgb(15 23 42 / 12%);
}

.forgot-pwd__back {
  position: absolute;
  top: 16px;
  left: 16px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
}

.forgot-pwd__back:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f1f5f9);
  color: var(--theme-fg, #0f172a);
}

.forgot-pwd__back:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.forgot-pwd__title {
  margin: 8px 0 8px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}

.forgot-pwd__desc {
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg-muted, #64748b);
  text-align: center;
}

.forgot-pwd__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.forgot-pwd__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.forgot-pwd__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-fg-muted, #475569);
}

.forgot-pwd__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.forgot-pwd__input-icon {
  position: absolute;
  left: 12px;
  color: var(--theme-fg-muted, #94a3b8);
  pointer-events: none;
}

.forgot-pwd__input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #0f172a);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.forgot-pwd__input:focus {
  border-color: var(--theme-accent, #2563eb);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #2563eb) 18%, transparent);
}

.forgot-pwd__input:disabled {
  background: var(--theme-bg-subtle, #f8fafc);
  cursor: not-allowed;
}

.forgot-pwd__error {
  font-size: 13px;
  line-height: 1.5;
  color: #b91c1c;
  background: rgb(254 226 226 / 65%);
  border: 1px solid rgb(252 165 165 / 60%);
  border-radius: 8px;
  padding: 8px 12px;
}

.forgot-pwd__submit {
  margin-top: 8px;
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

.forgot-pwd__submit:hover:not(:disabled) {
  background: var(--theme-accent-hover, #1d4ed8);
}

.forgot-pwd__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.forgot-pwd__icon-success {
  display: block;
  margin: 8px auto 16px;
  color: #16a34a;
}

.forgot-pwd__desc strong {
  color: var(--theme-fg, #0f172a);
  font-weight: 600;
}
</style>
