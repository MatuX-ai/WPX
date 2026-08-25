<!--
  SectionDownload · 下载 CTA 区
  - 三平台直链：Windows (.exe) / macOS (.dmg) / Linux (.AppImage)
  - 优先从 GitHub Releases latest 解析资源 URL，失败回退到静态兜底
-->
<script setup>
import { computed, onMounted, ref } from 'vue'

const GITHUB_RELEASES_URL = 'https://github.com/MatuX-ai/WPX/releases'
const GH_API = 'https://api.github.com/repos/MatuX-ai/WPX/releases/latest'

/** 与 package.json / 最近一次成功 CI 产物对齐的静态兜底 */
const FALLBACK = {
  version: 'v0.1.44',
  tag: 'v0.1.44',
  date: '2026-08-25',
  assets: {
    windows:
      'https://github.com/MatuX-ai/WPX/releases/download/v0.1.44/WPX-Setup-0.1.27.exe',
    macos:
      'https://github.com/MatuX-ai/WPX/releases/download/v0.1.44/WPX-0.1.27-arm64.dmg',
    linux:
      'https://github.com/MatuX-ai/WPX/releases/download/v0.1.44/WPX-0.1.27.AppImage',
  },
}

const release = ref({
  version: FALLBACK.version,
  date: FALLBACK.date,
  assets: { ...FALLBACK.assets },
  source: 'static',
  loading: true,
})

const platforms = [
  {
    key: 'windows',
    label: 'Windows 10/11',
    hint: '.exe · 64-bit',
    icon: '⬇',
  },
  {
    key: 'macos',
    label: 'macOS',
    hint: '.dmg · Apple Silicon',
    icon: '🍎',
  },
  {
    key: 'linux',
    label: 'Linux',
    hint: '.AppImage',
    icon: '🐧',
  },
]

function pickAssetUrl(assets, platform) {
  if (!Array.isArray(assets)) return null
  const matchers = {
    windows: (n) => /\.exe$/i.test(n) && !/\.blockmap$/i.test(n) && /Setup/i.test(n),
    macos: (n) => /\.dmg$/i.test(n) && !/\.blockmap$/i.test(n),
    linux: (n) => /\.AppImage$/i.test(n),
  }
  const match = matchers[platform]
  if (!match) return null
  const hit = assets.find((a) => a?.name && match(a.name) && a.browser_download_url)
  return hit?.browser_download_url || null
}

async function fetchLatestRelease() {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(GH_API, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const tag = data.tag_name || FALLBACK.tag
    const assets = {
      windows: pickAssetUrl(data.assets, 'windows') || FALLBACK.assets.windows,
      macos: pickAssetUrl(data.assets, 'macos') || FALLBACK.assets.macos,
      linux: pickAssetUrl(data.assets, 'linux') || FALLBACK.assets.linux,
    }
    release.value = {
      version: tag.startsWith('v') ? tag : `v${tag}`,
      date: data.published_at ? data.published_at.slice(0, 10) : FALLBACK.date,
      assets,
      source: 'github',
      loading: false,
    }
  } catch {
    release.value = {
      version: FALLBACK.version,
      date: FALLBACK.date,
      assets: { ...FALLBACK.assets },
      source: 'static',
      loading: false,
    }
  }
}

const formattedDate = computed(() => {
  const d = release.value.date
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return `${dt.getFullYear()} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`
})

onMounted(() => {
  fetchLatestRelease()
})
</script>

<template>
  <section
    id="download"
    class="wpx-section"
    aria-labelledby="download-title"
  >
    <div class="wpx-container">
      <div class="relative overflow-hidden rounded-3xl bg-wpx-gradient px-6 py-10 text-center text-white shadow-wpx-glow sm:p-12">
        <!-- 装饰光斑 -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-accent-mint/30 blur-3xl"
        />

        <!-- 版本徽章 -->
        <div class="relative inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
          <span
            aria-hidden="true"
            class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
          />
          当前桌面端：{{ release.version }}
          <span v-if="release.source === 'github'" class="text-white/70">· Live</span>
        </div>

        <h2
          id="download-title"
          class="relative mt-5 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          开始你的下一篇佳作
        </h2>
        <p class="relative mx-auto mt-4 max-w-xl px-2 text-sm text-white/85 sm:text-base">
          免费下载 WPX 桌面端（{{ release.version }} · Windows / macOS / Linux），立即拥有 AI 加持的写作工作台。
        </p>

        <div class="relative mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
          <a
            v-for="p in platforms"
            :key="p.key"
            :href="release.assets[p.key]"
            class="inline-flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-4 py-3 font-semibold text-primary-600 transition-transform hover:-translate-y-0.5 sm:rounded-full sm:px-5"
            rel="noopener noreferrer"
            target="_blank"
            :aria-label="`下载 WPX ${p.label}`"
          >
            <span class="inline-flex items-center gap-1.5 text-sm sm:text-base">
              <span aria-hidden="true">{{ p.icon }}</span>
              <span>{{ p.label }}</span>
            </span>
            <span class="text-xs font-medium text-primary-600/70">{{ p.hint }}</span>
          </a>
        </div>

        <div class="relative mt-6 flex flex-col items-center justify-center gap-3 text-xs text-white/75 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">📅</span>
            <span>发布于 {{ formattedDate || (release.loading ? '获取中…' : '—') }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">📦</span>
            <span>安装包体积 / 校验以 Releases 页面为准</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">🆓</span>
            <span>无需注册 · 解压即用</span>
          </div>
        </div>

        <div class="relative mt-6 flex flex-col items-center justify-center gap-2 text-xs sm:flex-row sm:gap-4">
          <router-link
            to="/changelog"
            class="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            {{ release.version }} 更新日志 →
          </router-link>
          <span class="hidden text-white/40 sm:inline">·</span>
          <a
            :href="GITHUB_RELEASES_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            历史版本 ↗
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
