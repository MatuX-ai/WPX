<script setup>
const posts = [
  {
    title: 'v1.0 发布：把 AI 装进每一处写作',
    excerpt: '从单点工具到写作工作台：多窗口、内置 Skills、虚拟纸张，WPX 的第一个完整版本。',
    date: '2026-06-18',
    tag: '产品发布',
    accent: 'from-primary-from/20 to-primary-to/20'
  },
  {
    title: '论文排版 Skill 怎么用？一份小白也能看懂的指南',
    excerpt: '从 GB/T 7714 引用、章节编号到图目录，全流程图解。',
    date: '2026-06-10',
    tag: '教程',
    accent: 'from-accent-mint/20 to-primary-from/20'
  },
  {
    title: '为什么我们坚持本地优先',
    excerpt: '关于隐私、模型配额与离线可用的设计哲学。',
    date: '2026-05-28',
    tag: '设计哲学',
    accent: 'from-accent-yellow/25 to-accent-mint/20'
  },
  {
    title: '商业字体嵌入：从授权到导出 PDF',
    excerpt: '在合法的前提下，让你的排版在任何设备上都保持一致。',
    date: '2026-05-14',
    tag: '技术',
    accent: 'from-primary-to/20 to-accent-yellow/20'
  },
  {
    title: '图片去背景的本地实现',
    excerpt: '用 rembg 把 AI 推理留在本机，兼顾速度与隐私。',
    date: '2026-04-30',
    tag: '工程',
    accent: 'from-accent-mint/20 to-primary-to/20'
  },
  {
    title: '7z 集成：为什么选择它而不是 zip / tar',
    excerpt: '压缩率、加密、分卷、与 7-Zip 多年沉淀的兼容性。',
    date: '2026-04-12',
    tag: '工程',
    accent: 'from-primary-from/20 to-accent-yellow/20'
  }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <div class="mx-auto max-w-2xl text-center">
        <span class="wpx-chip">博客</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">来自 WPX 团队的小记</span>
        </h1>
        <p class="mt-4 text-dark/60">
          产品故事、技术细节、设计哲学 —— 慢一点，更深一点。
        </p>
      </div>

      <div class="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(p, idx) in posts"
          :key="idx"
          class="group flex flex-col overflow-hidden rounded-2xl border border-dark/5 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div
            :class="[
              'h-36 w-full bg-gradient-to-br',
              p.accent
            ]"
          />
          <div class="flex flex-1 flex-col p-6">
            <div class="flex items-center gap-2 text-xs text-dark/50">
              <span class="rounded-full bg-wpx-gradient-soft px-2 py-0.5 font-semibold text-primary-600">
                {{ p.tag }}
              </span>
              <span>·</span>
              <span>{{ p.date }}</span>
            </div>
            <h2 class="mt-3 text-lg font-bold leading-snug group-hover:text-primary-600">
              {{ p.title }}
            </h2>
            <p class="mt-2 text-sm leading-relaxed text-dark/60">
              {{ p.excerpt }}
            </p>
            <div class="mt-auto pt-4">
              <a
                href="#"
                class="text-sm font-semibold text-primary-600 hover:underline"
              >
                阅读全文 →
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
