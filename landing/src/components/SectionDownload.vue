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
      <div class="relative overflow-hidden rounded-3xl bg-wpx-gradient p-12 text-center text-white shadow-wpx-glow">
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
          class="relative text-3xl font-extrabold md:text-5xl"
        >
          开始你的下一篇佳作
        </h2>
        <p class="relative mx-auto mt-4 max-w-xl text-white/80">
          免费下载 WPX 桌面端，立即拥有 AI 加持的写作工作台。
        </p>
        <div class="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-primary-600 transition-transform hover:-translate-y-0.5"
            @click="goDownload"
          >
            <span aria-hidden="true">⬇</span> Windows 10/11 · 下载 .exe
          </button>
          <a
            href="#"
            class="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 font-semibold text-white/90 transition-colors hover:bg-white/10"
          >
            查看更新日志
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
