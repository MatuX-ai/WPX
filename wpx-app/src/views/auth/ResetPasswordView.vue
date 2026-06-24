<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, Eye, EyeOff, ArrowLeft, CircleCheck, CircleX } from '@lucide/vue'
import { confirmPasswordReset } from '@/composables/useAuth'

defineOptions({ name: 'ResetPasswordView' })

const route = useRoute()
const router = useRouter()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : ''
)

const form = reactive({
  password: '',
  confirm: ''
})

const submitting = ref(false)
const errorMsg = ref('')
const status = ref('idle') // idle | success | error
const resultMsg = ref('')

const showPassword = ref(false)

async function handleSubmit() {
  if (submitting.value) return
  errorMsg.value = ''

  if (!token.value) {
    errorMsg.value = '缺少重置令牌，请检查邮件中的链接是否完整'
    status.value = 'error'
    resultMsg.value = errorMsg.value
    return
  }

  if (form.password.length < 8) {
    errorMsg.value = '新密码至少 8 位，建议字母+数字'
    return
  }
  if (form.password !== form.confirm) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }

  submitting.value = true

  try {
    await confirmPasswordReset(token.value, form.password)
    status.value = 'success'
    resultMsg.value = '密码已重置，现在可以使用新密码登录'
  } catch (error) {
    status.value = 'error'
    resultMsg.value = error?.message || '重置失败，链接可能已过期'
  } finally {
    submitting.value = false
  }
}

function handleGoLogin() {
  router.replace('/')
}
</script>

<template>
  <div class="reset-pwd">
    <div class="reset-pwd__card">
      <template v-if="status === 'success'">
        <CircleCheck :size="40" :stroke-width="1.6" class="reset-pwd__icon-success" />
        <h1 class="reset-pwd__title">重置成功</h1>
        <p class="reset-pwd__desc">{{ resultMsg }}</p>
        <button type="button" class="reset-pwd__submit" @click="handleGoLogin">
          返回首页登录
        </button>
      </template>

      <template v-else-if="status === 'error'">
        <CircleX :size="40" :stroke-width="1.6" class="reset-pwd__icon-error" />
        <h1 class="reset-pwd__title">无法重置</h1>
        <p class="reset-pwd__desc">{{ resultMsg }}</p>
        <button type="button" class="reset-pwd__submit" @click="handleGoLogin">
          返回首页
        </button>
      </template>

      <template v-else>
        <h1 class="reset-pwd__title">设置新密码</h1>
        <p class="reset-pwd__desc">请输入新的登录密码，至少 8 位。</p>

        <form class="reset-pwd__form" @submit.prevent="handleSubmit">
          <label class="reset-pwd__field">
            <span class="reset-pwd__label">新密码</span>
            <span class="reset-pwd__input-wrap">
              <Lock :size="16" :stroke-width="1.8" class="reset-pwd__input-icon" />
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="至少 8 位"
                required
                minlength="8"
                :disabled="submitting"
                class="reset-pwd__input"
              >
              <button
                type="button"
                class="reset-pwd__toggle-pwd"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :disabled="submitting"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="!showPassword" :size="16" :stroke-width="1.8" />
                <EyeOff v-else :size="16" :stroke-width="1.8" />
              </button>
            </span>
          </label>

          <label class="reset-pwd__field">
            <span class="reset-pwd__label">确认新密码</span>
            <span class="reset-pwd__input-wrap">
              <Lock :size="16" :stroke-width="1.8" class="reset-pwd__input-icon" />
              <input
                v-model="form.confirm"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="再次输入新密码"
                required
                minlength="8"
                :disabled="submitting"
                class="reset-pwd__input"
              >
            </span>
          </label>

          <div v-if="errorMsg" class="reset-pwd__error" role="alert">
            {{ errorMsg }}
          </div>

          <button
            type="submit"
            class="reset-pwd__submit"
            :disabled="submitting || !form.password || !form.confirm"
          >
            {{ submitting ? '提交中…' : '重置密码' }}
          </button>
        </form>

        <button type="button" class="reset-pwd__back" :disabled="submitting" @click="handleGoLogin">
          <ArrowLeft :size="14" :stroke-width="1.8" />
          <span>返回首页</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.reset-pwd {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--theme-bg-subtle, #f8fafc);
  color: var(--theme-fg, #0f172a);
}

.reset-pwd__card {
  position: relative;
  width: min(440px, 100%);
  padding: 36px 28px 28px;
  background: var(--theme-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgb(15 23 42 / 12%);
}

.reset-pwd__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}

.reset-pwd__desc {
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg-muted, #64748b);
  text-align: center;
}

.reset-pwd__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.reset-pwd__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reset-pwd__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-fg-muted, #475569);
}

.reset-pwd__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.reset-pwd__input-icon {
  position: absolute;
  left: 12px;
  color: var(--theme-fg-muted, #94a3b8);
  pointer-events: none;
}

.reset-pwd__input {
  width: 100%;
  height: 40px;
  padding: 0 36px 0 36px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #0f172a);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.reset-pwd__input:focus {
  border-color: var(--theme-accent, #2563eb);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #2563eb) 18%, transparent);
}

.reset-pwd__input:disabled {
  background: var(--theme-bg-subtle, #f8fafc);
  cursor: not-allowed;
}

.reset-pwd__toggle-pwd {
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
}

.reset-pwd__toggle-pwd:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f1f5f9);
  color: var(--theme-fg, #0f172a);
}

.reset-pwd__error {
  font-size: 13px;
  line-height: 1.5;
  color: #b91c1c;
  background: rgb(254 226 226 / 65%);
  border: 1px solid rgb(252 165 165 / 60%);
  border-radius: 8px;
  padding: 8px 12px;
}

.reset-pwd__submit {
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

.reset-pwd__submit:hover:not(:disabled) {
  background: var(--theme-accent-hover, #1d4ed8);
}

.reset-pwd__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-pwd__icon-success {
  display: block;
  margin: 0 auto 16px;
  color: #16a34a;
}

.reset-pwd__icon-error {
  display: block;
  margin: 0 auto 16px;
  color: #dc2626;
}

.reset-pwd__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 12px auto 0;
  border: none;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
}

.reset-pwd__back:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f1f5f9);
  color: var(--theme-fg, #0f172a);
}
</style>
