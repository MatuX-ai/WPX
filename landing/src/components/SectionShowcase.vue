<!--
  SectionShowcase · 沉浸式纸面体验区
-->
<script setup></script>

<template>
  <section
    id="showcase"
    class="wpx-section bg-wpx-gradient-soft"
    aria-labelledby="showcase-title"
  >
    <div class="wpx-container grid items-center gap-12 md:grid-cols-2">
      <div>
        <span class="wpx-chip">真实截图</span>
        <h2
          id="showcase-title"
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          沉浸式<span class="wpx-gradient-text">纸面体验</span>
        </h2>
        <p class="mt-4 text-dark/70">
          虚拟纸张、母版与排版规则，让排版像在纸上一样直观。
          导出 PDF / DOCX，版式与编辑器内所见完全一致。
        </p>
        <ul class="mt-6 space-y-3 text-dark/70">
          <li class="flex items-start gap-2">
            <span
              aria-hidden="true"
              class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-from"
            />
            A4 / Letter / 自定义尺寸
          </li>
          <li class="flex items-start gap-2">
            <span
              aria-hidden="true"
              class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-via"
            />
            字体合法嵌入导出
          </li>
          <li class="flex items-start gap-2">
            <span
              aria-hidden="true"
              class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-to"
            />
            一键应用学术模板
          </li>
        </ul>
      </div>
      <div class="relative">
        <div class="rounded-3xl border border-dark/5 bg-white p-6 shadow-wpx">
          <div class="text-xs text-dark/40">
            Page 1 / 12
          </div>
          <div class="mt-3 space-y-2">
            <div class="h-2 w-10/12 rounded-full bg-dark/10" />
            <div class="h-2 w-11/12 rounded-full bg-dark/10" />
            <div class="h-2 w-9/12 rounded-full bg-dark/10" />
            <div class="h-2 w-10/12 rounded-full bg-dark/10" />
            <div class="h-2 w-8/12 rounded-full bg-dark/10" />
          </div>
          <div class="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
            <div class="rounded-lg bg-wpx-gradient-soft p-2 font-semibold text-primary-600">
              标题
            </div>
            <div class="rounded-lg bg-accent-mint/15 p-2 font-semibold text-emerald-700">
              引用
            </div>
            <div class="rounded-lg bg-accent-yellow/20 p-2 font-semibold text-amber-700">
              图表
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
