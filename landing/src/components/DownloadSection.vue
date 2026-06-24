<script setup>
/**
 * DownloadSection.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 下载区
 *
 *  - 大【免费下载】按钮（带脉冲动画 + hover 弹性放大）
 *  - 三平台：Windows / macOS / Linux
 *  - 点击按钮：1.5s "正在召唤魔法阵..." → 触发下载
 *  - 版本号 + 发布日期：GitHub API 拉取，失败回退到静态
 * ------------------------------------------------------------
 */
import { ref, onMounted } from 'vue'
import { useEasterEggs } from '../composables/useEasterEggs'

// ---------------- 下载状态 ----------------
const downloading = ref(false)
const mainBtnRef = ref(null)
const ctaMainText = ref('免费下载')
const hoverText = ref('') // mouseenter 时随机注入的彩蛋文案
const activePlatform = ref('windows') // 默认 Windows

// 拉取彩蛋文案池（避免每次 mouseenter 都新建数组）
const eggs = useEasterEggs({ autoSetup: false })

// 召唤文案（按下时切换）
const summonText = '正在召唤魔法阵...'

// ---------------- 平台信息 ----------------
const platforms = [
  {
    key: 'windows',
    name: 'Windows',
    suffix: '.exe',
    icon: 'windows',
    note: '10 / 11 · 64-bit'
  },
  {
    key: 'macos',
    name: 'macOS',
    suffix: '.dmg',
    icon: 'mac',
    note: 'Apple Silicon · Intel'
  },
  {
    key: 'linux',
    name: 'Linux',
    suffix: '.AppImage',
    icon: 'linux',
    note: 'Ubuntu · Debian · Arch'
  }
]

// ---------------- GitHub Releases API ----------------
const GH_API = 'https://api.github.com/repos/wpx-team/wpx/releases/latest'

// 静态 fallback
const fallbackVersion = {
  version: 'v1.0.0',
  date: '2026-06-18',
  size: '15 MB',
  url: 'https://github.com/wpx-team/wpx/releases/latest'
}

const release = ref({ ...fallbackVersion, loading: true, source: 'static' })

async function fetchLatestRelease() {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000) // 4s 超时
    const res = await fetch(GH_API, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    release.value = {
      version: (data.tag_name || fallbackVersion.version).replace(/^v/, '').replace(/^/, 'v'),
      date: data.published_at
        ? data.published_at.slice(0, 10)
        : fallbackVersion.date,
      size: '15 MB',
      url: data.html_url || fallbackVersion.url,
      loading: false,
      source: 'github'
    }
  } catch (e) {
    // 静默回退到静态
    release.value = { ...fallbackVersion, loading: false, source: 'static' }
  }
}

onMounted(() => {
  fetchLatestRelease()
})

// ---------------- 格式化日期 ----------------
const formattedDate = ref('')
function formatDate(d) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return `${dt.getFullYear()} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`
  } catch {
    return d
  }
}
onMounted(async () => {
  // 延迟一帧等 release 数据就绪
  setTimeout(() => {
    formattedDate.value = formatDate(release.value.date)
  }, 100)
})

// ---------------- 下载动作 ----------------
function onPlatformSelect(p) {
  activePlatform.value = p.key
}

async function startDownload() {
  if (downloading.value) return
  downloading.value = true
  ctaMainText.value = summonText

  // 1.5s 召唤动画
  await new Promise((r) => setTimeout(r, 1500))

  // 触发下载：跳转 GitHub Releases
  // 在生产环境可以替换为 CDN 链接
  const url =
    release.value.url ||
    `https://github.com/wpx-team/wpx/releases/latest`

  // 打开新窗口触发下载
  window.open(url, '_blank', 'noopener,noreferrer')

  // 恢复按钮文字
  ctaMainText.value = '开始下载'
  downloading.value = false

  // 3s 后恢复原始文案
  setTimeout(() => {
    if (!downloading.value) ctaMainText.value = '免费下载'
  }, 3000)
}

// ---------------- hover 文案随机变化（彩蛋文案池） ----------------
function onBtnEnter() {
  // 仅未在下载时切换
  if (downloading.value) return
  hoverText.value = eggs.getDownloadHoverText()
}
function onBtnLeave() {
  hoverText.value = ''
}

// ---------------- 平台图标（inline SVG） ----------------
const platformIcons = {
  windows: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5l7.5-1.1V11H3V5.5zm0 7.5h7.5v6.6L3 18.5V13zm8.5-8.7L21 3v8h-9.5V4.3zm0 8.7H21V21l-9.5-1.4v-6.6z"/></svg>`,
  mac: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04c-.02-2.3 1.88-3.4 1.97-3.45-1.07-1.57-2.74-1.78-3.34-1.81-1.42-.14-2.78.84-3.5.84-.74 0-1.84-.82-3.03-.8-1.55.02-2.99.91-3.79 2.3-1.62 2.81-.41 6.97 1.16 9.25.78 1.13 1.7 2.38 2.9 2.34 1.16-.05 1.6-.75 3-.75s1.8.75 3.03.72c1.25-.02 2.04-1.13 2.81-2.27.89-1.31 1.25-2.58 1.27-2.65-.03-.01-2.43-.94-2.45-3.72zM14.6 5.34c.65-.79 1.09-1.88.97-2.97-.94.04-2.07.62-2.74 1.41-.6.7-1.13 1.82-.99 2.89 1.05.08 2.11-.54 2.76-1.33z"/></svg>`,
  linux: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.6.058.4.116.778.018 1.024-.31.69-.354 1.16-.199 1.503.156.342.497.495.9.572.319.063.681.073 1.058.135.401.063.82.176 1.103.4.284.227.427.554.467.928.038.371-.027.778-.113 1.176-.087.4-.205.795-.243 1.179-.038.384.045.747.305 1.024.262.279.708.467 1.351.467.31 0 .665-.063 1.075-.135.646-.117 1.442-.235 2.045-.135.388.063.708.179 1.054.336.346.156.708.337 1.193.337.485 0 .847-.181 1.193-.337.346-.157.666-.273 1.054-.336.602-.1 1.398.018 2.044.135.41.072.766.135 1.075.135.643 0 1.089-.188 1.351-.467.26-.277.343-.64.305-1.024-.038-.384-.156-.779-.243-1.179-.087-.398-.151-.805-.113-1.176.04-.374.183-.701.467-.928.283-.224.702-.337 1.103-.4.377-.062.739-.072 1.058-.135.403-.077.744-.23.9-.572.155-.343.111-.813-.199-1.503-.098-.246-.04-.624.018-1.024.028-.2.055-.401.055-.6a1.32 1.32 0 0 0-.132-.602c-.206-.411-.551-.544-.864-.68-.312-.133-.598-.201-.797-.4-.213-.239-.403-.571-.663-.839a.42.42 0 0 0-.11-.135c.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298a3.7 3.7 0 0 0-.48-.021z"/></svg>`
}
</script>

<template>
  <section
    id="download"
    class="wpx-section"
  >
    <div class="wpx-container">
      <div
        class="relative overflow-hidden rounded-3xl bg-wpx-gradient px-4 py-10 text-center text-white shadow-wpx-glow sm:px-6 sm:py-12 md:p-16"
      >
        <!-- 装饰光斑 -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent-mint/30 blur-3xl"
        />

        <div class="relative">
          <!-- 小徽标 -->
          <div class="flex justify-center">
            <span
              class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-accent-mint" />
              {{ release.version }} · {{ formattedDate || '正在获取…' }}
            </span>
          </div>

          <!-- 标题 -->
          <h2 class="mt-6 text-2xl font-extrabold leading-tight sm:text-3xl md:text-5xl">
            准备好开始你的下一篇佳作了吗？
          </h2>
          <p class="mx-auto mt-4 max-w-xl text-white/85 md:text-lg">
            免费下载 WPX 桌面端，立即拥有 AI 加持的写作工作台。
          </p>

          <!-- ============== 平台选择 ============== -->
          <div
            class="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              v-for="p in platforms"
              :key="p.key"
              :class="[
                'group inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all duration-200',
                activePlatform === p.key
                  ? 'border-white bg-white text-primary-600 shadow-wpx'
                  : 'border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/15'
              ]"
              @click="onPlatformSelect(p)"
            >
              <span
                :class="[
                  'inline-flex h-5 w-5 items-center justify-center',
                  activePlatform === p.key ? 'text-primary-600' : 'text-white'
                ]"
                v-html="platformIcons[p.icon]"
              />
              <span>{{ p.name }}</span>
              <span
                :class="[
                  'text-xs',
                  activePlatform === p.key ? 'text-primary-600/60' : 'text-white/60'
                ]"
              >
                {{ p.note }}
              </span>
            </button>
          </div>

          <!-- ============== 大下载按钮 ============== -->
          <div class="mt-8 flex flex-col items-center gap-3">
            <button
              ref="mainBtnRef"
              type="button"
              :disabled="downloading"
              class="group relative inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-extrabold text-primary-600 shadow-wpx-glow transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.5),0_18px_50px_-8px_rgba(255,255,255,0.4)] disabled:cursor-wait disabled:opacity-90 sm:h-16 sm:min-w-[280px] sm:px-10 sm:text-lg md:hover:scale-[1.04]"
              style="transform-origin: center"
              @click="startDownload"
              @mouseenter="onBtnEnter"
              @mouseleave="onBtnLeave"
            >
              <!-- 图标 -->
              <span v-if="!downloading" class="inline-flex items-center gap-2.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6 transition-transform group-hover:translate-y-0.5"
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
                <span>{{ ctaMainText }}</span>
                <span class="text-primary-600/50">·</span>
                <span class="text-base text-primary-600/80">
                  {{ platforms.find(p => p.key === activePlatform)?.suffix }}
                </span>
              </span>
              <!-- hover 彩蛋提示 -->
              <span
                v-if="hoverText && !downloading"
                class="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-dark/90 px-3 py-1 text-xs text-white shadow-wpx"
              >
                {{ hoverText }}
              </span>
              <!-- 召唤魔法阵 -->
              <span v-else class="inline-flex items-center gap-2.5">
                <span class="inline-block animate-spin text-2xl">✨</span>
                <span>{{ summonText }}</span>
              </span>
            </button>

            <!-- 小字提示 -->
            <p class="text-xs text-white/70">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full bg-accent-mint" />
                无需注册即可使用大部分功能，用你自己的 AI Key 也行
              </span>
            </p>
          </div>

          <!-- ============== 版本信息 ============== -->
          <div
            class="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/65"
          >
            <div class="flex items-center gap-1.5">
              <span class="font-mono font-semibold text-white/90">
                {{ release.version }}
              </span>
              <span v-if="release.source === 'github'">· Live</span>
              <span v-else-if="release.source === 'static'">· 默认</span>
            </div>
            <div>📅 发布于 {{ formattedDate || '…' }}</div>
            <div>📦 {{ release.size }}</div>
            <div>
              🔗
              <a
                :href="release.url"
                target="_blank"
                rel="noopener noreferrer"
                class="underline-offset-2 hover:text-white hover:underline"
              >查看更新日志</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 召唤动画：按钮 + 旋转的星 */
@keyframes wpxSummonSpin {
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: wpxSummonSpin 1.2s linear infinite;
  display: inline-block;
}
</style>
