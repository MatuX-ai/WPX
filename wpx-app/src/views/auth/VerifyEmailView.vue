<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleCheck, CircleX, Loader2 } from '@lucide/vue'
import { verifyEmailToken } from '@/composables/useAuth'

defineOptions({ name: 'VerifyEmailView' })

const route = useRoute()
const router = useRouter()

const status = ref('loading') // loading | success | error
const message = ref('')

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    status.value = 'error'
    message.value = '缺少验证令牌，请检查邮件中的链接是否完整'
    return
  }

  try {
    await verifyEmailToken(token)
    status.value = 'success'
    message.value = '邮箱已验证，现在可以使用该邮箱登录 WPX'
  } catch (error) {
    status.value = 'error'
    message.value = error?.message || '验证失败，链接可能已过期'
  }
})

function handleGoLogin() {
  router.replace({ name: 'landing' }).catch(() => {
    // landing 仅 web 端：失败时回退根路径
    router.replace('/')
  })
}

function handleBackHome() {
  router.replace('/')
}
</script>

<template>
  <div class="verify-email">
    <div class="verify-email__card" role="status" aria-live="polite">
      <template v-if="status === 'loading'">
        <Loader2 :size="40" :stroke-width="1.8" class="verify-email__icon verify-email__icon--loading" />
        <h1 class="verify-email__title">正在验证邮箱…</h1>
        <p class="verify-email__desc">请稍候，我们正在校验邮件中的验证令牌</p>
      </template>

      <template v-else-if="status === 'success'">
        <CircleCheck :size="40" :stroke-width="1.6" class="verify-email__icon verify-email__icon--success" />
        <h1 class="verify-email__title">验证成功</h1>
        <p class="verify-email__desc">{{ message }}</p>
        <div class="verify-email__actions">
          <button type="button" class="verify-email__btn verify-email__btn--primary" @click="handleGoLogin">
            前往登录
          </button>
        </div>
      </template>

      <template v-else>
        <CircleX :size="40" :stroke-width="1.6" class="verify-email__icon verify-email__icon--error" />
        <h1 class="verify-email__title">验证失败</h1>
        <p class="verify-email__desc">{{ message }}</p>
        <div class="verify-email__actions">
          <button type="button" class="verify-email__btn" @click="handleBackHome">
            返回首页
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.verify-email {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--theme-bg-subtle, #f8fafc);
  color: var(--theme-fg, #0f172a);
}

.verify-email__card {
  width: min(440px, 100%);
  padding: 36px 28px;
  background: var(--theme-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgb(15 23 42 / 12%);
  text-align: center;
}

.verify-email__icon {
  margin: 0 auto 16px;
}

.verify-email__icon--loading {
  color: var(--theme-accent, #2563eb);
  animation: verify-email-spin 1s linear infinite;
}

.verify-email__icon--success {
  color: #16a34a;
}

.verify-email__icon--error {
  color: #dc2626;
}

.verify-email__title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
}

.verify-email__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--theme-fg-muted, #64748b);
}

.verify-email__actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

.verify-email__btn {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #0f172a);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.verify-email__btn:hover {
  background: var(--theme-bg-subtle, #f1f5f9);
}

.verify-email__btn--primary {
  border-color: transparent;
  background: var(--theme-accent, #2563eb);
  color: #fff;
}

.verify-email__btn--primary:hover {
  background: var(--theme-accent-hover, #1d4ed8);
}

@keyframes verify-email-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
