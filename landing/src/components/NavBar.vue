<script setup>
/**
 * NavBar.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 固定顶部导航
 *
 * 特性：
 *  - 滚动后背景从透明 → 白色 + backdrop-blur（500ms 缓动）
 *  - 左侧：Logo（图标 + WPX 文字）
 *  - 中间：功能 / 下载（锚点）、关于（路由）、GitHub（外链）
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

// 中间导航
const navLinks = [
  { id: 'features', label: '功能' },
  { id: 'download', label: '下载' }
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

const gotoAbout = () => {
  mobileOpen.value = false
  router.push('/about')
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
        <span
          class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-wpx-gradient text-white shadow-wpx transition-transform group-hover:rotate-3"
        >
          <!-- 文档 + 闪光 图标 -->
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13 3v5a1 1 0 001 1h5"
            />
          </svg>
          <span
            class="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-yellow ring-2 ring-white"
          />
        </span>
        <span class="text-lg font-extrabold tracking-tight">
          <span class="wpx-gradient-text">WPX</span>
        </span>
      </router-link>

      <!-- ========== 中间：导航链接（桌面） ========== -->
      <nav class="hidden items-center gap-1 md:flex">
        <a
          v-for="link in navLinks"
          :key="link.id"
          :href="`#${link.id}`"
          class="rounded-full px-4 py-2 text-sm font-medium text-dark/70 transition-colors hover:bg-primary-500/5 hover:text-primary-600"
          @click="(e) => handleAnchor(e, link.id)"
        >
          {{ link.label }}
        </a>
        <a
          href="/about"
          class="rounded-full px-4 py-2 text-sm font-medium text-dark/70 transition-colors hover:bg-primary-500/5 hover:text-primary-600"
          @click.prevent="gotoAbout"
        >
          关于
        </a>
        <a
          href="https://github.com/wpx-team/wpx"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WPX on GitHub"
          class="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-dark/70 transition-colors hover:bg-primary-500/5 hover:text-primary-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49l-.01-1.72c-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49C19.14 20.54 22 16.72 22 12.22 22 6.58 17.52 2 12 2z"
            />
          </svg>
        </a>
      </nav>

      <!-- ========== 右侧：脉冲 CTA ========== -->
      <div class="hidden items-center md:flex">
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

      <!-- ========== 移动端：汉堡按钮 ========== -->
      <button
        class="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-dark/10 bg-white/60 text-dark backdrop-blur"
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
      class="md:hidden fixed inset-0 z-[60] flex flex-col bg-white/95 backdrop-blur-lg"
      role="dialog"
      aria-modal="true"
      aria-label="主导航"
    >
      <!-- 顶部：Logo + 关闭 -->
      <div class="wpx-container flex h-16 items-center justify-between">
        <router-link
          id="wpx-nav-logo-mobile"
          to="/"
          class="flex items-center gap-2"
          @click="closeMobile"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-wpx-gradient text-white shadow-wpx"
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 3v5a1 1 0 001 1h5" />
            </svg>
          </span>
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

      <!-- 链接列表 -->
      <nav class="wpx-container flex-1 overflow-y-auto py-6">
        <ul class="space-y-3">
          <li
            v-for="(link, idx) in navLinks"
            :key="link.id"
            :style="{
              transitionDelay: mobileOpen ? `${idx * 50}ms` : '0ms'
            }"
            class="fullscreen-item"
          >
            <a
              :href="`#${link.id}`"
              class="flex items-center justify-between rounded-2xl border border-dark/5 bg-white px-5 py-4 text-lg font-semibold text-dark shadow-sm transition-all hover:border-primary-500/30 hover:text-primary-600"
              @click="(e) => handleAnchor(e, link.id)"
            >
              <span>{{ link.label }}</span>
              <span class="text-dark/30">↓</span>
            </a>
          </li>
          <li
            :style="{ transitionDelay: mobileOpen ? `${navLinks.length * 50}ms` : '0ms' }"
            class="fullscreen-item"
          >
            <a
              href="/about"
              class="flex items-center justify-between rounded-2xl border border-dark/5 bg-white px-5 py-4 text-lg font-semibold text-dark shadow-sm transition-all hover:border-primary-500/30 hover:text-primary-600"
              @click.prevent="gotoAbout"
            >
              <span>关于</span>
              <span class="text-dark/30">→</span>
            </a>
          </li>
          <li
            :style="{
              transitionDelay: mobileOpen ? `${(navLinks.length + 1) * 50}ms` : '0ms'
            }"
            class="fullscreen-item"
          >
            <a
              href="https://github.com/wpx-team/wpx"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-between rounded-2xl border border-dark/5 bg-white px-5 py-4 text-lg font-semibold text-dark shadow-sm transition-all hover:border-primary-500/30 hover:text-primary-600"
              @click="closeMobile"
            >
              <span class="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49l-.01-1.72c-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49C19.14 20.54 22 16.72 22 12.22 22 6.58 17.52 2 12 2z"
                  />
                </svg>
                GitHub
              </span>
              <span class="text-dark/30">↗</span>
            </a>
          </li>
        </ul>
      </nav>

      <!-- 底部：免费下载 CTA（脉冲） -->
      <div class="wpx-container pb-8 pt-2">
        <a
          href="#download"
          class="wpx-btn-cta-pulse w-full !py-4 text-base"
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
        <p class="mt-3 text-center text-xs text-dark/50">
          Windows 10/11 · 完全免费 · 永久使用
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

/* ============== 菜单项逐项上浮 ============== */
.fullscreen-item {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.35s ease, transform 0.35s ease;
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
</style>
