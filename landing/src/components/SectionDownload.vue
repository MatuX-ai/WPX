<!--
  SectionDownload · 下载 CTA 区
  - v0.1.26：产品版本徽章；下载指向 GitHub Releases latest（安装包发布可能略滞后）
-->
<script setup>
// 产品版本（与桌面 package.json 对齐）；安装包以 Releases latest 为准
const PRODUCT_VERSION = 'v0.1.26'
const GITHUB_LATEST_URL = 'https://github.com/MatuX-ai/WPX/releases/latest'
const GITHUB_RELEASES_URL = 'https://github.com/MatuX-ai/WPX/releases'
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
          当前桌面端：{{ PRODUCT_VERSION }}
        </div>

        <h2
          id="download-title"
          class="relative mt-5 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          开始你的下一篇佳作
        </h2>
        <p class="relative mx-auto mt-4 max-w-xl px-2 text-sm text-white/85 sm:text-base">
          免费下载 WPX 桌面端（{{ PRODUCT_VERSION }} · Windows），立即拥有 AI 加持的写作工作台。
          安装包以 GitHub Releases 最新页为准，发布通道可能略滞后于产品版本。
        </p>

        <div class="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <a
            :href="GITHUB_LATEST_URL"
            class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 font-semibold text-primary-600 transition-transform hover:-translate-y-0.5 sm:w-auto"
            rel="noopener noreferrer"
            target="_blank"
          >
            <span aria-hidden="true">⬇</span> Windows 10/11 · 下载最新版
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

        <!-- 安装包信息（校验值以 Releases 页面为准） -->
        <div class="relative mt-6 flex flex-col items-center justify-center gap-3 text-xs text-white/75 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
          <div class="flex items-center gap-1.5">
            <span aria-hidden="true">📦</span>
            <span>安装包体积 / SHA256 以 Releases 页面为准</span>
          </div>

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
            {{ PRODUCT_VERSION }} 更新日志 →
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
