<script setup>
/**
 * DocsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 文档中心
 *
 *  - 三块快速入门卡片
 *  - 文档章节索引（6 大类 28 主题，按 v0.1.16 重构）
 *  - 主题卡片含"为什么推荐"钩子文案
 *  - 顶部关键词过滤（自动滚动到对应 anchor）
 *  - 底部 CTA：跳转 GitHub Wiki
 * ------------------------------------------------------------
 */
import { ref, computed } from 'vue'

const sections = [
  {
    title: '入门指南',
    icon: '📘',
    color: 'from-primary-from/15 to-primary-to/10',
    items: [
      { id: 'install', name: '安装与系统要求', desc: 'Windows 10/11 · Electron 28+ · 推荐 8GB 内存', anchor: '#install' },
      { id: 'first-run', name: '首次启动配置', desc: '3 分钟跑通：从安装到第一篇文档', anchor: '#first-run' },
      { id: 'documents', name: '创建与管理文档', desc: '本地文件树、命名规范、自动保存策略', anchor: '#documents' },
      { id: 'shortcuts', name: '界面与快捷键', desc: 'Ctrl+S 保存、Ctrl+Shift+H 源码、Ctrl+K AI 唤起', anchor: '#shortcuts' }
    ]
  },
  {
    title: '编辑器核心',
    icon: '✍️',
    color: 'from-accent-mint/15 to-primary-from/10',
    items: [
      { id: 'markdown', name: 'Markdown 语法与富文本', desc: 'Tiptap 为核心，MathJax / Mermaid / 代码块均有专门扩展', anchor: '#markdown' },
      { id: 'paper', name: '虚拟纸张与排版', desc: 'A4 / Letter / 自定义尺寸，母版 + 分页 + 页码', anchor: '#paper' },
      { id: 'multi-window', name: '多窗口工作流', desc: '同时打开多份文档，跨窗口拖拽素材，AI 助手可贴边', anchor: '#multi-window' },
      { id: 'media', name: '图片与媒体', desc: '去背景、滤镜、对齐、批量插入', anchor: '#media' },
      { id: 'html-source', name: 'HTML 源码分屏编辑（v0.1.13 新增）', desc: 'CodeMirror 6 + Tiptap 双向同步，拖拽宽度，Ctrl+Shift+H 唤起', anchor: '#html-source' },
      { id: 'focus', name: 'Focus 模式 MD 排版模板（v0.1.13 新增）', desc: '进入 Focus 自动应用 5 套 MD 排版模板', anchor: '#focus' }
    ]
  },
  {
    title: 'AI 与 Skills',
    icon: '🤖',
    color: 'from-accent-yellow/20 to-accent-mint/10',
    items: [
      { id: 'ai-panel', name: 'AI 助手面板', desc: '浮窗 ↔ 贴边（IDE 风格右侧栏）双模切换', anchor: '#ai-panel' },
      { id: 'skills-overview', name: 'Skills 体系总览', desc: '32+ Skills 全景，按用户群分类', anchor: '#skills-overview' },
      { id: 'built-in-skills', name: '内置 Skills 清单', desc: '学生 16 + 教师 16 + 通用 8 + 自定义', anchor: '#built-in-skills' },
      { id: 'custom-skill', name: '自定义 Skill', desc: '写自己的 Prompt 模板，让 AI 按你的流程改稿', anchor: '#custom-skill' },
      { id: 'ai-models', name: '大模型接入教程（DeepSeek / 智谱 / 通义 等，v0.1.10+ 新增）', desc: '兼容 OpenAI Chat Completions，覆盖 8+ 国产大模型预设', anchor: '#ai-models' },
      { id: 'local-commands', name: '本地指令系统 64 条（v0.1.13 新增）', desc: '输入 `/focus` `/export` `/paper-a4` 等立即生效', anchor: '#local-commands' }
    ]
  },
  {
    title: '导出与压缩',
    icon: '📤',
    color: 'from-primary-to/15 to-accent-yellow/15',
    items: [
      { id: 'pdf', name: 'PDF / DOCX / Markdown 互转', desc: '中文字体子集化，PDF 体积下降 60%', anchor: '#pdf' },
      { id: 'lesson-ppt', name: '演示文稿 PPT 导出（v0.1.15 新增）', desc: '从教案大纲一键生成 PPT，自动配色与配图', anchor: '#lesson-ppt' },
      { id: 'html-export', name: 'HTML 导出弹窗（v0.1.10 新增）', desc: '可打包 ZIP / 嵌入资源 / 一键部署到静态托管', anchor: '#html-export' },
      { id: 'compress', name: '7z 压缩 / 解压', desc: 'AES-256 加密，分卷打包，双击 .7z 直接预览', anchor: '#compress' }
    ]
  },
  {
    title: '导入与转换',
    icon: '📥',
    color: 'from-accent-mint/20 to-primary-from/15',
    items: [
      { id: 'web-import', name: '网页导入与智能排版（v0.1.10 新增）', desc: '粘贴 URL 自动抓取正文 + 去广告 + 智能排版', anchor: '#web-import' },
      { id: 'pdf-ocr', name: 'PDF OCR 离线处理（v0.1.10 新增）', desc: 'pdfjs + tesseract.js，本地推理 0 上传', anchor: '#pdf-ocr' },
      { id: 'excel', name: 'Excel / WPS 表格导入（v0.1.16 新增）', desc: '支持 .xls / .xlsx，解析为表格块', anchor: '#excel' },
      { id: 'md-sync', name: 'Markdown 双向同步', desc: '编辑器和源码同步，写一次两边都对', anchor: '#md-sync' },
      { id: 'jcode', name: 'jcode 高性能 AI 引擎（v0.1.10 新增）', desc: 'Rust 内核加速，本地推理比纯 JS 快 5-10x', anchor: '#jcode' }
    ]
  },
  {
    title: '开发者参考',
    icon: '🧪',
    color: 'from-primary-from/15 to-accent-mint/15',
    items: [
      { id: 'ipc', name: '本地 API 与 IPC', desc: '主进程 / 渲染进程通信协议一览', anchor: '#ipc' },
      { id: 'plugins', name: '扩展插件开发', desc: '自定义 Skill · 自定义指令 · 自定义导出格式', anchor: '#plugins' },
      { id: 'cli', name: '命令行工具', desc: '脚本化批量导出 / 测试 / 部署', anchor: '#cli' }
    ]
  }
]

// 关键词过滤
const keyword = ref('')
const filtered = computed(() => {
  if (!keyword.value.trim()) return sections
  const k = keyword.value.toLowerCase()
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.name.toLowerCase().includes(k) || i.desc.toLowerCase().includes(k)) }))
    .filter((s) => s.items.length > 0)
})

const totalTopics = computed(() => sections.reduce((a, s) => a + s.items.length, 0))

const quickStarts = [
  {
    title: '快速上手',
    icon: '🚀',
    desc: '10 分钟内创建你的第一个 WPX 文档',
    points: ['安装与首次启动', '创建/打开/保存文档', '基础快捷键速查', '切换界面语言'],
    accent: 'from-primary-from/15 to-primary-to/10'
  },
  {
    title: '核心功能',
    icon: '🧩',
    desc: '把多窗口、虚拟纸张、Skills 用到极致',
    points: ['多窗口独立编辑', '虚拟纸张与分页', 'Skills 启用与提示词', '图片编辑器（去背景）'],
    accent: 'from-accent-mint/20 to-primary-from/10'
  },
  {
    title: '进阶技巧',
    icon: '🛠️',
    desc: '把 WPX 改造成最懂你的工作台',
    points: ['自定义 Skill 提示词', '字体管理（导入 / 商用）', '本地指令 64 条', '命令行与脚本化导出'],
    accent: 'from-accent-yellow/20 to-accent-mint/15'
  }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">文档</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">从这里开始你的 WPX 之旅</span>
        </h1>
        <p class="mt-4 text-dark/60">
          6 大类共 {{ totalTopics }} 主题 · 全随 v0.1.16 同步
        </p>

        <!-- 关键词过滤 -->
        <div class="mx-auto mt-6 max-w-md">
          <label class="relative block">
            <span class="sr-only">关键词搜索</span>
            <input
              v-model="keyword"
              type="search"
              placeholder="🔍 检索：HTML 源码 · OCR · 大模型 · 本地指令 …"
              class="w-full rounded-full border border-dark/10 bg-white px-5 py-2.5 text-sm shadow-sm transition-all focus:border-primary-from/50 focus:outline-none focus:ring-4 focus:ring-wpx-gradient-soft"
            />
          </label>
        </div>
      </div>

      <!-- Quick Start Cards -->
      <div class="mt-16 grid gap-6 md:grid-cols-3">
        <article
          v-for="card in quickStarts"
          :key="card.title"
          class="group relative overflow-hidden rounded-2xl border border-dark/5 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div
            class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r"
            :class="card.accent"
          />
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient-soft text-2xl"
          >
            {{ card.icon }}
          </div>
          <h2 class="mt-4 text-xl font-extrabold">
            <span class="wpx-gradient-text">{{ card.title }}</span>
          </h2>
          <p class="mt-2 text-sm text-dark/60">
            {{ card.desc }}
          </p>
          <ul class="mt-4 space-y-2">
            <li
              v-for="p in card.points"
              :key="p"
              class="flex items-center gap-2 text-sm text-dark/75"
            >
              <span
                class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-wpx-gradient"
              />
              {{ p }}
            </li>
          </ul>
        </article>
      </div>

      <!-- TOC Sections -->
      <div class="mt-20">
        <h2 class="text-2xl font-extrabold md:text-3xl">文档章节索引</h2>
        <p class="mt-2 text-dark/60">
          已覆盖 markdown / 多窗口 / Skills / 本地指令 / OCR / 大模型接入 等全部桌面端能力。
        </p>

        <div v-if="filtered.length === 0" class="mt-10 rounded-2xl border border-dashed border-dark/10 bg-white p-10 text-center text-dark/40">
          没找到匹配「{{ keyword }}」的文档。可以试试：HTML、OCR、64、演示文稿。
        </div>

        <div v-else class="mt-10 grid gap-6 md:grid-cols-2">
          <div
            v-for="s in filtered"
            :key="s.title"
            class="rounded-2xl border border-dark/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-wpx"
          >
            <h3 class="flex items-center gap-2 text-lg font-bold">
              <span class="text-2xl">{{ s.icon }}</span>
              {{ s.title }}
              <span
                :class="['ml-auto inline-flex items-center rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[10px] font-semibold text-white', s.color]"
              >
                {{ s.items.length }} 项
              </span>
            </h3>
            <ul class="mt-4 grid gap-2 sm:grid-cols-2">
              <li
                v-for="item in s.items"
                :key="item.id"
              >
                <a
                  :href="item.anchor"
                  class="block rounded-lg px-3 py-2 transition-colors hover:bg-wpx-gradient-soft hover:text-primary-600"
                >
                  <div class="text-sm font-medium text-dark/85">
                    {{ item.name }}
                  </div>
                  <div class="mt-0.5 text-[11px] leading-snug text-dark/50">
                    {{ item.desc }}
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div
        class="mt-20 rounded-3xl bg-wpx-gradient-soft p-10 text-center"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">文档与社区一起生长</span>
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-dark/70">
          如果你发现文档有遗漏或错误，欢迎提交 PR；
          如果你有使用上的疑问，可以先到 GitHub Discussions 搜搜看。
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/MatuX-ai/WPX/wiki"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            前往 GitHub Wiki
          </a>
          <a
            href="https://github.com/MatuX-ai/WPX/discussions"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-ghost"
          >
            加入社区讨论
          </a>
        </div>
      </div>
    </div>
  </section>
</template>