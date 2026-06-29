<!--
  SectionDownload · 下载 CTA 区
  - 已同步 v0.1.16：补充安装包实际大小、签名、GitHub Releases 链接与版本说明
-->
<script setup>
function goDownload(platform) {
  // 真实环境下跳转到 GitHub Releases 对应平台的 latest asset
  if (typeof window === 'undefined') return
  const releases = {
    windows: 'https://github.com/wpx-team/wpx/releases/latest',
    macos: 'https://github.com/wpx-team/wpx/releases/latest',
    linux: 'https://github.com/wpx-team/wpx/releases/latest'
  }
  window.open(releases[platform] || releases.windows, '_blank', 'noopener')
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
          当前桌面端：v0.1.16
        </div>

        <h2
          id="download-title"
          class="relative mt-5 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          开始你的下一篇佳作
        </h2>
        <p class="relative mx-auto mt-4 max-w-xl px-2 text-sm text-white/85 sm:text-base">
          免费下载 WPX 桌面端（v0.1.16 · Windows · 仅 80MB），立即拥有 AI 加持的写作工作台。
        </p>

        <div class="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 font-semibold text-primary-600 transition-transform hover:-translate-y-0.5 sm:w-auto"
            @click="goDownload('windows')"
          >
            <span aria-hidden="true">⬇</span> Windows 10/11 · 下载 .exe
          </button>
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

        <!-- 安装包信息 -->
        <div class="relative mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/75">
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">📦</span>
            <span>约 80 MB（v0.1.16，相比 WPS 轻量 10 倍）</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">🔐</span>
            <span>已签名 · SHA256 校验可见</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">🆓</span>
            <span>无需注册 · 解压即用</span>
          </div>
        </div>

        <!-- 补充链接：更新日志 -->
        <div class="relative mt-6 flex items-center justify-center gap-4 text-xs">
          <router-link
            to="/changelog"
            class="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            v0.1.16 更新日志 →
          </router-link>
          <span class="text-white/40">·</span>
          <a
            href="https://github.com/wpx-team/wpx/releases"
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