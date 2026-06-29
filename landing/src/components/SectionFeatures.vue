<!--
  SectionFeatures · 核心特性区
  - 已同步 v0.1.16：9 张卡片，删除原"账户与模型配额"（V1.1 不再有平台账户）
  - 每张卡片支持"相关文档"链接，指向 /docs#anchor
-->
<script setup>
const features = [
  {
    icon: '✨',
    title: 'AI 一键改写',
    desc: '选中段落，让 AI 帮你润色、续写、翻译、总结；语气与长度都可调，支持 DeepSeek 等国产大模型。',
    color: 'from-primary-from/15 to-primary-to/15',
    newFlag: false,
    docAnchor: '#ai-panel'
  },
  {
    icon: '🪟',
    title: '多窗口独立编辑器',
    desc: '同时打开多个文档并排对照，AI 助手可贴边 dock 或浮窗来回切，跨窗口拖拽素材，研究写作两不误。',
    color: 'from-accent-mint/15 to-primary-from/15',
    newFlag: false,
    docAnchor: '#multi-window'
  },
  {
    icon: '🧑‍🏫',
    title: '演示文稿生成（PPT）',
    desc: '从教案 / 大纲自动生成课件 PPT，章节、配图、要点一句话搞定。教师备课提速 10 倍。',
    color: 'from-accent-yellow/30 to-accent-mint/15',
    newFlag: true,
    docAnchor: '#lesson-ppt'
  },
  {
    icon: '🛠️',
    title: '本地指令系统 · 64 条',
    desc: '在编辑器内输入 `/focus`、`/export`、`/paper-a4` 等斜杠指令立即执行，无需打开菜单，键盘派写作者的福音。',
    color: 'from-primary-from/15 to-accent-mint/20',
    newFlag: true,
    docAnchor: '#local-commands'
  },
  {
    icon: '📄',
    title: 'HTML 源码分屏编辑',
    desc: 'CodeMirror 6 与 Tiptap 富文本双向同步，拖拽宽度调整，导入 HTML 后支持源码可视化对照。',
    color: 'from-primary-to/15 to-accent-yellow/15',
    newFlag: true,
    docAnchor: '#html-source'
  },
  {
    icon: '🔍',
    title: 'PDF 离线 OCR',
    desc: '扫描版 PDF 一键转可编辑文本，集成 pdfjs + tesseract.js，全程本地推理，0 上传 0 隐私泄露。',
    color: 'from-accent-yellow/15 to-primary-from/15',
    newFlag: true,
    docAnchor: '#pdf-ocr'
  },
  {
    icon: '🗜️',
    title: '7z 压缩 / 解压',
    desc: '编辑器内直接打包与解压 7z / zip，资料整理再也不用切窗口，AES-256 加密保护敏感文档。',
    color: 'from-primary-from/15 to-accent-yellow/20',
    newFlag: false,
    docAnchor: '#compress'
  },
  {
    icon: '🔤',
    title: '免费开源字体 100+',
    desc: '思源、霞鹜、阿里巴巴普惠、HarmonyOS Sans 等 100+ 开源字体直接用，本地导入 .ttf/.otf 也支持。',
    color: 'from-accent-mint/15 to-primary-to/15',
    newFlag: false,
    docAnchor: '#fonts'
  },
  {
    icon: '🎓',
    title: '学生 / 教师 Skills 32+',
    desc: '论文排版、引用生成、备课模板、家长会发言稿……学生 16 + 教师 16，开箱即用并支持自定义。',
    color: 'from-accent-yellow/20 to-accent-mint/20',
    newFlag: false,
    docAnchor: '#built-in-skills'
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
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          <span class="wpx-gradient-text">为写作者而生的工具集</span>
        </h2>
        <p class="mt-4 text-dark/60">
          不止是编辑器，更是你的写作工作台。9 大核心能力，把构思到定稿的所有环节一次打包。
        </p>
      </div>

      <div class="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="f in features"
          :id="f.docAnchor.replace('#', '')"
          :key="f.title"
          class="group relative overflow-hidden rounded-2xl border border-dark/5 bg-white p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-wpx"
        >
          <div
            aria-hidden="true"
            :class="[
              'absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-100',
              f.color
            ]"
          />

          <!-- 新功能红角标 -->
          <span
            v-if="f.newFlag"
            class="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm animate-[fadeIn_0.6s_ease-out]"
            aria-label="新功能"
          >
            <span aria-hidden="true">✨</span>
            NEW
          </span>

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
          <router-link
            v-if="f.docAnchor"
            :to="`/docs${f.docAnchor}`"
            class="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition-all group-hover:gap-2"
            :aria-label="`查看 ${f.title} 相关文档`"
          >
            查看文档
            <span aria-hidden="true">→</span>
          </router-link>
        </article>
      </div>
    </div>
  </section>
</template>