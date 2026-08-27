<script setup>
/**
 * NavBar.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 固定顶部导航
 *
 * 特性：
 *  - 滚动后背景从透明 → 白色 + backdrop-blur（500ms 缓动）
 *  - 左侧：Logo（图标 + WPX 文字）
 *  - 中间：5 项混合导航：功能 / 下载（锚点）、技能 / 更新日志 / 关于（路由）
 *  - 右侧：【免费下载】CTA，自带 2s 脉冲动画
 *  - 移动端：汉堡按钮 → 全屏覆盖菜单，自动锁 body 滚动
 *  - 点击下载/锚点：跨页先回首页再平滑滚动
 * ------------------------------------------------------------
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 状态
const scrolled = ref(false)
const mobileOpen = ref(false)

// 中间导航：5 项 = 锚点 + 路由混合
// type: 'anchor' → 站内锚点滚动
// type: 'route'  → 跨页路由跳转
const navLinks = [
  { id: 'features', label: '功能', type: 'anchor' },
  { id: 'skills', label: '技能', type: 'route', to: '/skills' },
  { id: 'changelog', label: '更新日志', type: 'route', to: '/changelog' },
  { id: 'download', label: '下载', type: 'anchor' },
  { id: 'about', label: '关于', type: 'route', to: '/about' }
]

// 滚动监听
const onScroll = () => {
  scrolled.value = window.scrollY > 12
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  document.body.style.overflow = ''
})

// 全屏菜单打开时锁滚动
watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

// 路由变化自动关闭菜单
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  }
)

// 锚点跳转：跨页先回首页再滚
const handleAnchor = async (e, id) => {
  e.preventDefault()
  mobileOpen.value = false
  if (route.path !== '/') {
    await router.push({ path: '/', hash: `#${id}` })
  } else {
    await nextTick()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    history.replaceState(null, '', `#${id}`)
  }
}

// 关闭菜单（供覆盖层 / ESC 使用）
const closeMobile = () => {
  mobileOpen.value = false
}

// 全局 ESC 关闭
const onKey = (e) => {
  if (e.key === 'Escape' && mobileOpen.value) closeMobile()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <!-- ============== 固定顶部导航 ============== -->
  <header
    :class="[
      'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out',
      scrolled || mobileOpen
        ? 'bg-white/80 backdrop-blur-md border-b border-dark/5 shadow-sm'
        : 'bg-transparent border-b border-transparent'
    ]"
  >
    <div class="wpx-container flex h-16 items-center justify-between">
      <!-- ========== 左侧：Logo ========== -->
      <router-link
        id="wpx-nav-logo"
        to="/"
        class="group flex items-center gap-2"
        @click="mobileOpen = false"
      >
        <img
          src="/wpx-icon.png"
          alt=""
          class="h-9 w-9 rounded-xl object-cover shadow-wpx transition-transform group-hover:rotate-3"
          width="36"
          height="36"
        />
        <span class="text-lg font-extrabold tracking-tight">
          <span class="wpx-gradient-text">WPX</span>
        </span>
      </router-link>

      <!-- ========== 中间：导航链接（桌面，仅 ≥ lg 1024px 才显示） ==========
           768~1023px 区间 nav 项太多容易拥接，直接交给汉堡菜单 -->
      <nav class="hidden items-center gap-1 lg:flex">
        <template v-for="link in navLinks" :key="link.id">
          <router-link
            v-if="link.type === 'route'"
            :to="link.to"
            class="rounded-full px-4 py-2 text-sm font-medium text-dark/70 transition-colors hover:bg-primary-500/5 hover:text-primary-600"
          >
            {{ link.label }}
          </router-link>
          <a
            v-else
            :href="`#${link.id}`"
            class="rounded-full px-4 py-2 text-sm font-medium text-dark/70 transition-colors hover:bg-primary-500/5 hover:text-primary-600"
            @click="(e) => handleAnchor(e, link.id)"
          >
            {{ link.label }}
          </a>
        </template>
      </nav>

      <!-- ========== 右侧：脉冲 CTA（仅 ≥ lg 1024px） ========== -->
      <div class="hidden items-center lg:flex">
        <a
          href="#download"
          class="wpx-btn-cta-pulse group !px-5 !py-2.5 text-sm"
          aria-label="免费下载 WPX"
          @click="(e) => handleAnchor(e, 'download')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 transition-transform group-hover:translate-y-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>免费下载</span>
        </a>
      </div>

      <!-- ========== 移动端：汉堡按钮（< lg 1024px） ========== -->
      <button
        class="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-dark/10 bg-white/60 text-dark backdrop-blur"
        :aria-label="mobileOpen ? '关闭菜单' : '打开菜单'"
        :aria-expanded="mobileOpen"
        @click="mobileOpen = !mobileOpen"
      >
        <svg
          v-if="!mobileOpen"
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  </header>

  <!-- ============== 移动端：全屏覆盖菜单 ============== -->
  <transition name="fullscreen">
    <div
      v-if="mobileOpen"
      class="lg:hidden fixed inset-0 z-[60] flex flex-col bg-white/95 backdrop-blur-lg"
      style="padding-bottom: env(safe-area-inset-bottom, 0px)"
      role="dialog"
      aria-modal="true"
      aria-label="主导航"
    >
      <!-- 顶部：Logo + 关闭 -->
      <div
        class="wpx-container flex h-16 shrink-0 items-center justify-between"
        style="padding-top: env(safe-area-inset-top, 0px)"
      >
        <router-link
          id="wpx-nav-logo-mobile"
          to="/"
          class="flex items-center gap-2"
          @click="closeMobile"
        >
          <img
            src="/wpx-icon.png"
            alt=""
            class="h-9 w-9 rounded-xl object-cover shadow-wpx"
            width="36"
            height="36"
          />
          <span class="text-lg font-extrabold tracking-tight">
            <span class="wpx-gradient-text">WPX</span>
          </span>
        </router-link>
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg border border-dark/10 bg-white text-dark shadow-sm"
          aria-label="关闭菜单"
          @click="closeMobile"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <!-- 链接列表：靠上紧凑排布，避免中间大片空白 -->
      <nav class="wpx-container min-h-0 flex-1 overflow-y-auto py-4">
        <ul class="space-y-2.5">
          <template v-for="(link, idx) in navLinks" :key="link.id">
            <li
              :style="{
                transitionDelay: mobileOpen ? `${idx * 50}ms` : '0ms'
              }"
              class="fullscreen-item"
            >
              <router-link
                v-if="link.type === 'route'"
                :to="link.to"
                class="flex min-h-12 items-center justify-between rounded-2xl border border-dark/5 bg-white px-4 py-3.5 text-base font-semibold text-dark shadow-sm transition-all hover:border-primary-500/30 hover:text-primary-600 sm:px-5 sm:text-lg"
              >
                <span>{{ link.label }}</span>
                <span class="text-dark/30">→</span>
              </router-link>
              <a
                v-else
                :href="`#${link.id}`"
                class="flex min-h-12 items-center justify-between rounded-2xl border border-dark/5 bg-white px-4 py-3.5 text-base font-semibold text-dark shadow-sm transition-all hover:border-primary-500/30 hover:text-primary-600 sm:px-5 sm:text-lg"
                @click="(e) => handleAnchor(e, link.id)"
              >
                <span>{{ link.label }}</span>
                <span class="text-dark/30">↓</span>
              </a>
            </li>
          </template>
        </ul>
      </nav>

      <!-- 底部：免费下载 CTA -->
      <div class="wpx-container shrink-0 border-t border-dark/5 bg-white/80 pb-6 pt-4 backdrop-blur">
        <a
          href="#download"
          class="wpx-btn-cta-pulse w-full !py-3.5 text-base"
          aria-label="免费下载 WPX"
          @click="(e) => handleAnchor(e, 'download')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>免费下载 WPX</span>
        </a>
        <p class="mt-2.5 text-center text-xs text-dark/50">
          Windows · macOS · Linux · 完全免费
        </p>
      </div>
    </div>
  </transition>

  <!-- 顶部占位，避免被 fixed header 遮挡 -->
  <div class="h-16" />
</template>

<style scoped>
/* ============== 全屏覆盖菜单过渡 ============== */
.fullscreen-enter-active,
.fullscreen-leave-active {
  transition: opacity 0.25s ease;
}
.fullscreen-enter-from,
.fullscreen-leave-to {
  opacity: 0;
}

/* ============== 菜单项逐项上浮 ==============
 * 默认 opacity: 1（确保 SSR / 静态预渲染时菜单项可见，
 * 同时作为客户端 v-if=true 后 transition enter 的“终态”）。
 * 入场时短暂 hide 在 overlay 出现后立即 transition 回 opacity:1。
 */
.fullscreen-item {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.35s ease, transform 0.35s ease;
}
/* enter 起点：从隐藏 + 8px 上浮过渡到可见 */
.fullscreen-enter-from .fullscreen-item {
  opacity: 0;
  transform: translateY(8px);
}
.fullscreen-enter-active .fullscreen-item {
  opacity: 1;
  transform: translateY(0);
}
.fullscreen-leave-active .fullscreen-item {
  /* 离开时不收回，保持简洁 */
  opacity: 1;
  transform: translateY(0);
}

/* ============== 减少动效偏好：禁用菜单过渡动画 ============== */
@media (prefers-reduced-motion: reduce) {
  .fullscreen-enter-active,
  .fullscreen-leave-active,
  .fullscreen-item {
    transition: none !important;
    transform: none !important;
  }
}
</style>
