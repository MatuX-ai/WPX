<!--
  SectionFAQ · 常见问题区
-->
<script setup>
const faqs = [
  {
    q: 'WPX 是免费的吗？',
    a: '工具本体永久免费，编辑器、PDF 互转、Skills 市场、多窗口……全都不要钱。唯一收费项是 AI 算力 Token（调云端大模型时按量扣费，每日有免费额度）和商业字体 Token（嵌入商业字体导出时按字数扣费）。不收月费、不收年费、不订阅。'
  },
  {
    q: 'AI Token 是怎么计费的？会不会哪天改成订阅？',
    a: '不会。WPX 从第一天起就是按需计费：用多少 Token 扣多少，Token 永久有效。注册用户每日赠送免费额度（默认 100M Token/天），用完后可按需充值。'
  },
  {
    q: '商业字体 Token 怎么扣？免费字体也要收钱吗？',
    a: '不收。系统自带字体和开源字体完全免费，只有在导出嵌入商业授权字体时才按字数扣 Token（1 汉字 = 1 Token）。预览和排版过程不扣费。'
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
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          <span class="wpx-gradient-text">可能你也在问</span>
        </h2>
      </div>

      <div class="mt-12 divide-y divide-dark/5 rounded-2xl border border-dark/5 bg-white">
        <details
          v-for="(f, idx) in faqs"
          :key="idx"
          class="group px-4 py-5 sm:p-6"
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
