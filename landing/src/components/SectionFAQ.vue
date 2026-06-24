<!--
  SectionFAQ · 常见问题区
-->
<script setup>
const faqs = [
  {
    q: 'WPX 是免费的吗？',
    a: '有永久免费的版本，足够日常使用；专业版与团队版提供更强的 AI 配额和进阶功能。'
  },
  {
    q: '支持哪些平台？',
    a: '目前首发 Windows 桌面端（基于 Electron），macOS 与 Linux 在路线图中。'
  },
  {
    q: '我的文档会被上传吗？',
    a: '默认完全本地化；只有在你主动调用云端 AI 时，相关片段才会按服务商策略传输。'
  },
  {
    q: '支持自带的字体与模板吗？',
    a: '支持。可加载本地 .ttf / .otf 字体，并按授权情况选择是否嵌入导出。'
  }
]
</script>

<template>
  <section
    id="faq"
    class="wpx-section"
    aria-labelledby="faq-title"
  >
    <div class="wpx-container max-w-3xl">
      <div class="text-center">
        <span class="wpx-chip">常见问题</span>
        <h2
          id="faq-title"
          class="mt-4 text-3xl font-extrabold md:text-5xl"
        >
          <span class="wpx-gradient-text">可能你也在问</span>
        </h2>
      </div>

      <div class="mt-12 divide-y divide-dark/5 rounded-2xl border border-dark/5 bg-white">
        <details
          v-for="(f, idx) in faqs"
          :key="idx"
          class="group p-6"
        >
          <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
            <span>{{ f.q }}</span>
            <span
              aria-hidden="true"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wpx-gradient-soft text-primary-600 transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p class="mt-3 text-sm leading-relaxed text-dark/70">
            {{ f.a }}
          </p>
        </details>
      </div>
    </div>
  </section>
</template>
