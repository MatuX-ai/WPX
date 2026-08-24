<!--
  SectionFeatures · 核心特性区（去 AI 化重写）
  - 重组为 3×4 分组：编辑器 / 文件处理 / AI & Skills
  - AI 相关卡片从原来的 5+ 张压缩到 2 张（仅作为能力之一）
  - 强调差异化的「多窗口 / 本地指令 / 离线 / Skills」能力
-->
<script setup>
// ---------- 编辑器 ----------
const editorGroup = [
  {
    icon: '🪟',
    title: '多窗口独立编辑器',
    desc: '同时打开多份文档并排对照，Skills 面板可贴边 dock 或浮窗，跨窗口拖拽素材。',
    color: 'from-accent-mint/15 to-primary-from/15',
    docAnchor: '#multi-window'
  },
  {
    icon: '🛠',
    title: '64 条本地斜杠指令',
    desc: '在编辑器内输入 `/focus`、`/export`、`/paper-a4` 立即生效，无需打开菜单。',
    color: 'from-primary-from/15 to-accent-mint/20',
    newFlag: true,
    docAnchor: '#local-commands'
  },
  {
    icon: '📄',
    title: '虚拟纸张与 A4 排版',
    desc: '所见即所得 A4 纸张、页边距、页眉页脚，打印 / 导出与 Word 兼容。',
    color: 'from-primary-to/15 to-accent-yellow/15',
    docAnchor: '#virtual-paper'
  },
  {
    icon: '⌘',
    title: 'HTML 源码分屏编辑',
    desc: 'CodeMirror 6 与 Tiptap 富文本双向同步，拖拽宽度调整，导入 HTML 后可可视化对照。',
    color: 'from-accent-yellow/20 to-accent-mint/15',
    newFlag: true,
    docAnchor: '#html-source'
  }
]

// ---------- 文件处理 ----------
const fileGroup = [
  {
    icon: '🔄',
    title: 'Markdown / PDF / Word 互转',
    desc: '本地集成 Pandoc 流式转换，PDF · DOCX · Markdown · HTML 全场景互换。',
    color: 'from-primary-from/15 to-primary-to/15',
    docAnchor: '#convert'
  },
  {
    icon: '🔍',
    title: 'PDF 离线 OCR',
    desc: '扫描版 PDF 一键转可编辑文本，集成 pdfjs + tesseract.js，全程本地推理。',
    color: 'from-accent-yellow/15 to-primary-from/15',
    newFlag: true,
    docAnchor: '#pdf-ocr'
  },
  {
    icon: '🗜',
    title: '7z 压缩 / 解压',
    desc: '编辑器内直接打包与解压 7z / zip，资料整理不用切窗口，AES-256 加密。',
    color: 'from-primary-from/15 to-accent-yellow/20',
    docAnchor: '#compress'
  },
  {
    icon: '📊',
    title: 'Excel / WPS 表格导入',
    desc: '支持 .xls / .xlsx / Numbers 文档一键解析为可编辑表格块，保留格式与数据。',
    color: 'from-sky-400/20 to-primary-from/20',
    newFlag: true,
    docAnchor: '#excel'
  }
]

// ---------- AI 与 Skills ----------
const aiGroup = [
  {
    icon: '🎓',
    title: '32+ Skills 模板',
    desc: '论文排版 · 教案 · 备课 · 翻译 · 错题复盘 · 答辩 PPT ……开箱即用。',
    color: 'from-accent-yellow/20 to-accent-mint/20',
    docAnchor: '#built-in-skills'
  },
  {
    icon: '🤖',
    title: 'Hermes Agent',
    desc: '可选本地智能体：复杂任务自动路由，未安装时透明降级，不挡你写字。',
    color: 'from-primary-from/15 to-primary-to/15',
    newFlag: true,
    docAnchor: '#hermes-agent'
  },
  {
    icon: '🧠',
    title: '自备大模型接入',
    desc: 'DeepSeek / 智谱 / 通义 / 文心 / Ollama 任选，API Key 本地 AES 加密。',
    color: 'from-accent-mint/15 to-primary-to/15',
    docAnchor: '#ai-models'
  },
  {
    icon: '🔤',
    title: '100+ 开源字体',
    desc: '思源 / 霞鹜 / 阿里巴巴普惠 / HarmonyOS Sans 直接用，支持本地导入 .ttf/.otf。',
    color: 'from-accent-mint/15 to-accent-yellow/15',
    docAnchor: '#fonts'
  }
]

const groups = [
  { key: 'editor', title: '编辑器', icon: '⌨', items: editorGroup },
  { key: 'file',   title: '文件处理', icon: '📂', items: fileGroup },
  { key: 'ai',     title: 'AI 与 Skills', icon: '✨', items: aiGroup }
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
          <span class="wpx-gradient-text">桌面写作所需，一次配齐</span>
        </h2>
        <p class="mt-4 text-dark/60">
          12 项核心能力，三个维度的设计：编辑器本体、文件处理、以及作为加持的 AI 与 Skills。
        </p>
      </div>

      <!-- 三组分组 -->
      <div class="mt-14 space-y-14">
        <div
          v-for="g in groups"
          :key="g.key"
        >
          <!-- 组标题 -->
          <div class="mb-6 flex items-center gap-3">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-wpx-gradient text-white shadow-wpx"
              aria-hidden="true"
            >{{ g.icon }}</span>
            <h3 class="text-xl font-extrabold text-dark md:text-2xl">
              {{ g.title }}
            </h3>
            <span class="ml-2 text-xs text-dark/40">{{ g.items.length }} 项</span>
          </div>

          <!-- 该组的 4 张卡片 -->
          <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <article
              v-for="f in g.items"
              :id="f.docAnchor.replace('#', '')"
              :key="f.title"
              class="group relative overflow-hidden rounded-2xl border border-dark/5 bg-white p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-wpx"
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
                <span aria-hidden="true">★</span>
                NEW
              </span>

              <div
                class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-wpx-gradient-soft text-xl"
                role="img"
                :aria-label="f.title + ' 图标'"
              >
                {{ f.icon }}
              </div>
              <h4 class="relative mt-3 text-base font-bold">
                {{ f.title }}
              </h4>
              <p class="relative mt-1.5 text-sm leading-relaxed text-dark/60">
                {{ f.desc }}
              </p>
              <router-link
                v-if="f.docAnchor"
                :to="`/docs${f.docAnchor}`"
                class="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition-all group-hover:gap-2"
                :aria-label="`查看 ${f.title} 相关文档`"
              >
                查看文档
                <span aria-hidden="true">→</span>
              </router-link>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>