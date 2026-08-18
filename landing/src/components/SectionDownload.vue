<!--
  SectionDownload · 下载 CTA 区
  - v0.1.18：点击下载指向 GitHub Releases 具体版本资产 + SHA256 一键复制
-->
<script setup>
import { ref } from 'vue'

// v0.1.18 真实 GitHub Releases 资产链接
const WINDOWS_EXE_URL =
  'https://github.com/MatuX-ai/WPX/releases/download/v0.1.18/WPX-Setup-0.1.18.exe'
const WINDOWS_EXE_SHA256 =
  '6b42e7724b03fc1b52cf706d0e0d49fac168227372fd63c30d91e334c8e77d27'
const GITHUB_RELEASES_URL = 'https://github.com/MatuX-ai/WPX/releases'

const shaCopied = ref(false)

function goDownload(platform) {
  if (typeof window === 'undefined') return
  const releases = {
    windows: WINDOWS_EXE_URL,
    macos: GITHUB_RELEASES_URL,
    linux: GITHUB_RELEASES_URL,
  }
  window.open(releases[platform] || releases.windows, '_blank', 'noopener')
}

async function copySha256() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    try {
      const el = document.getElementById('wpx-sha256-text')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    } catch {}
    return
  }
  try {
    await navigator.clipboard.writeText(WINDOWS_EXE_SHA256)
    shaCopied.value = true
    setTimeout(() => {
      shaCopied.value = false
    }, 1800)
  } catch (error) {
    console.warn('[SectionDownload] copy sha256 failed:', error)
  }
}
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
          当前桌面端：v0.1.18
        </div>

        <h2
          id="download-title"
          class="relative mt-5 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          开始你的下一篇佳作
        </h2>
        <p class="relative mx-auto mt-4 max-w-xl px-2 text-sm text-white/85 sm:text-base">
          免费下载 WPX 桌面端（v0.1.18 · Windows · 156MB），立即拥有 AI 加持的写作工作台。
        </p>

        <div class="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <a
            :href="WINDOWS_EXE_URL"
            class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 font-semibold text-primary-600 transition-transform hover:-translate-y-0.5 sm:w-auto"
            rel="noopener noreferrer"
          >
            <span aria-hidden="true">⬇</span> Windows 10/11 · 下载 .exe
          </a>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/40 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            disabled
            title="路线图中"
          >
            <span aria-hidden="true">🍎</span> macOS · 路线图
          </button>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/40 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            disabled
            title="路线图中"
          >
            <span aria-hidden="true">🐧</span> Linux · 路线图
          </button>
        </div>

        <!-- 安装包信息 + SHA256 一键复制 -->
        <div class="relative mt-6 flex flex-col items-center justify-center gap-3 text-xs text-white/75 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">📦</span>
            <span>约 156 MB（v0.1.18，相比 WPS 轻量 10 倍）</span>
          </div>

          <!-- 可点击复制的 SHA256 chip -->
          <button
            type="button"
            class="group inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-mono text-[11px] text-white/85 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white"
            :title="WINDOWS_EXE_SHA256"
            aria-label="复制安装包 SHA256 校验值"
            @click="copySha256"
          >
            <span aria-hidden="true">🔐</span>
            <span class="opacity-80">SHA256 ·</span>
            <span
              id="wpx-sha256-text"
              class="font-semibold tracking-tight"
            >6b42e772…8e77d27</span>
            <span
              aria-hidden="true"
              class="ml-0.5 inline-flex h-4 min-w-[1.5rem] items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-semibold text-white transition-colors group-hover:bg-white/30"
              :class="shaCopied ? '!bg-emerald-400/80 !text-emerald-900 group-hover:!bg-emerald-400/80' : ''"
            >{{ shaCopied ? '✓' : '复制' }}</span>
          </button>

          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">🆓</span>
            <span>无需注册 · 解压即用</span>
          </div>
        </div>

        <!-- 补充链接：更新日志（移动端垂直堆叠，避免链接糊在一起） -->
        <div class="relative mt-6 flex flex-col items-center justify-center gap-2 text-xs sm:flex-row sm:gap-4">
          <router-link
            to="/changelog"
            class="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            v0.1.18 更新日志 →
          </router-link>
          <span class="hidden text-white/40 sm:inline">·</span>
          <a
            href="https://github.com/MatuX-ai/WPX/releases"
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
