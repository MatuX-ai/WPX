<!--
  SectionFeatures · 核心特性区
-->
<script setup>
const features = [
  {
    icon: '✨',
    title: 'AI 一键改写',
    desc: '选中段落，让 AI 帮你润色、续写、翻译、总结；语气与长度都可调。',
    color: 'from-primary-from/15 to-primary-to/15'
  },
  {
    icon: '📄',
    title: '多窗口独立编辑',
    desc: '同时打开多个文档并排对照，跨窗口拖拽素材，研究写作两不误。',
    color: 'from-accent-mint/15 to-primary-from/15'
  },
  {
    icon: '🧩',
    title: '内置学生 / 教师技能',
    desc: '论文排版、引用生成、备课模板，开箱即用；自定义 Skills 满足个性需求。',
    color: 'from-accent-yellow/20 to-accent-mint/15'
  },
  {
    icon: '🎨',
    title: '虚拟纸张与导出',
    desc: 'A4 / Letter / 自定义尺寸，一键导出 PDF / DOCX，版式所见即所得。',
    color: 'from-primary-to/15 to-accent-yellow/15'
  },
  {
    icon: '🗜️',
    title: '文件压缩 / 解压',
    desc: '编辑器内直接打包与解压 7z / zip，资料整理再也不用切窗口。',
    color: 'from-primary-from/15 to-accent-yellow/15'
  },
  {
    icon: '🔐',
    title: '账户与模型配额',
    desc: '统一管理多家 AI 服务商，登录即用，配额透明，本地密钥不泄露。',
    color: 'from-accent-mint/15 to-primary-to/15'
  }
]
</script>

<template>
  <section
    id="features"
    class="wpx-section"
    aria-labelledby="features-title"
  >
    <div class="wpx-container">
      <div class="mx-auto max-w-2xl text-center">
        <span class="wpx-chip">核心特性</span>
        <h2
          id="features-title"
          class="mt-4 text-3xl font-extrabold md:text-5xl"
        >
          <span class="wpx-gradient-text">为写作者而生的工具集</span>
        </h2>
        <p class="mt-4 text-dark/60">
          不止是编辑器，更是你的写作工作台。
        </p>
      </div>

      <div class="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="f in features"
          :key="f.title"
          class="group relative overflow-hidden rounded-2xl border border-dark/5 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div
            aria-hidden="true"
            :class="[
              'absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-100',
              f.color
            ]"
          />
          <div
            class="relative flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient-soft text-2xl"
            role="img"
            :aria-label="f.title + ' 图标'"
          >
            {{ f.icon }}
          </div>
          <h3 class="relative mt-4 text-lg font-bold">
            {{ f.title }}
          </h3>
          <p class="relative mt-2 text-sm leading-relaxed text-dark/60">
            {{ f.desc }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
