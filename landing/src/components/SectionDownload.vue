<!--
  SectionDownload · 下载 CTA 区
-->
<script setup>
function goDownload() {
  // 占位：真实环境下跳转到 GitHub Releases
  if (typeof window === 'undefined') return
  window.open('https://github.com/wpx-team/wpx/releases', '_blank', 'noopener')
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
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-accent-mint/30 blur-3xl"
        />
        <h2
          id="download-title"
          class="relative text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          开始你的下一篇佳作
        </h2>
        <p class="relative mx-auto mt-4 max-w-xl px-2 text-sm text-white/85 sm:text-base">
          免费下载 WPX 桌面端，立即拥有 AI 加持的写作工作台。
        </p>
        <div class="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 font-semibold text-primary-600 transition-transform hover:-translate-y-0.5 sm:w-auto"
            @click="goDownload"
          >
            <span aria-hidden="true">⬇</span> Windows 10/11 · 下载 .exe
          </button>
          <a
            href="#"
            class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3 font-semibold text-white/90 transition-colors hover:bg-white/10 sm:w-auto"
          >
            查看更新日志
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
