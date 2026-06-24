<template>
  <div class="min-h-screen flex items-stretch bg-[#F5F6FA]">
    <!-- 左侧品牌区 -->
    <div class="hidden lg:flex flex-1 bg-wpx-gradient text-white p-12 flex-col justify-between relative overflow-hidden">
      <!-- 装饰 -->
      <div class="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div class="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] bg-white/10 rounded-full blur-3xl" />

      <div class="relative z-10">
        <div class="flex items-center gap-3">
          <img
            src="@/assets/logo.svg"
            alt="WPX"
            class="w-10 h-10"
          >
          <span class="text-xl font-bold">WPX Admin</span>
        </div>
        <h1 class="text-3xl font-bold mt-10 leading-tight">
          AI 智能文档编辑器<br>运营管理中枢
        </h1>
        <p class="text-white/80 mt-4 max-w-md leading-relaxed">
          监控用户增长、管理字体商店、配置 AI 模型、追踪 Token 消费，所有操作一目了然。
        </p>
      </div>

      <ul class="relative z-10 space-y-3 text-white/85">
        <li class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-white/80" /> 用户、字体、订单全维度数据可视化
        </li>
        <li class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-white/80" /> Skills 与模型灵活配置
        </li>
        <li class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-white/80" /> 角色权限精细化管控
        </li>
      </ul>
    </div>

    <!-- 右侧表单区 -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-sm">
        <!-- 移动端 Logo -->
        <div class="lg:hidden flex items-center gap-2 mb-8">
          <img
            src="@/assets/logo.svg"
            alt="WPX"
            class="w-9 h-9"
          >
          <span class="text-lg font-bold wpx-gradient-text">WPX Admin</span>
        </div>

        <h2 class="text-2xl font-bold text-gray-900">登录管理后台</h2>
        <p class="text-sm text-gray-500 mt-1 mb-6">
          使用 WPX 邮箱账号登录（自托管认证）
        </p>

        <form
          class="space-y-4"
          @submit.prevent="onSubmit"
        >
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              邮箱
            </label>
            <input
              v-model="form.email"
              type="email"
              autocomplete="username"
              required
              placeholder="admin@prowpx.com"
              class="wpx-input"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
              minlength="6"
              placeholder="••••••••"
              class="wpx-input"
            >
          </div>

          <div
            v-if="errorMsg"
            class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
          >
            {{ errorMsg }}
          </div>

          <button
            type="submit"
            class="wpx-btn-primary w-full justify-center"
            :disabled="auth.loading"
          >
            <span v-if="auth.loading">登录中…</span>
            <span v-else>登录</span>
          </button>

          <p class="text-xs text-gray-400 text-center pt-2">
            登录即代表同意
            <a
              href="https://prowpx.com/terms"
              target="_blank"
              class="text-primary-600 hover:underline"
            >服务条款</a>
            与
            <a
              href="https://prowpx.com/privacy"
              target="_blank"
              class="text-primary-600 hover:underline"
            >隐私政策</a>
          </p>
        </form>

        <div class="mt-8 text-xs text-gray-400 text-center">
          仅限管理员账号访问。如需开通，请联系超级管理员。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineOptions({ name: 'LoginView' })

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  email: '',
  password: ''
})

const errorMsg = ref('')

async function onSubmit() {
  errorMsg.value = ''
  try {
    await auth.login({
      email: form.email.trim(),
      password: form.password
    })
    // 登录成功后跳转：优先使用 query.redirect，否则按角色去默认首页
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const target = redirect && redirect.startsWith('/') ? redirect : auth.homePath
    router.replace(target)
  } catch (err) {
    errorMsg.value =
      err?.response?.data?.message ||
      err?.message ||
      '登录失败，请检查邮箱与密码'
  }
}
</script>