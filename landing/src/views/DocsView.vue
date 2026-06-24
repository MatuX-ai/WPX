<script setup>
/**
 * DocsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 文档中心
 *
 *  - 三块快速入门卡片
 *  - 文档章节索引（4 大类，每类下列出锚点标题）
 *  - 底部 CTA：跳转 GitHub Wiki
 * ------------------------------------------------------------
 */

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
    points: ['自定义 Skill 提示词', '字体管理（导入 / 商用）', '插件开发与 IPC 协议', '命令行与脚本化导出'],
    accent: 'from-accent-yellow/20 to-accent-mint/15'
  }
]

const sections = [
  {
    title: '入门指南',
    icon: '📘',
    items: [
      { name: '安装与系统要求', href: '#install' },
      { name: '首次启动配置', href: '#first-run' },
      { name: '创建与管理文档', href: '#documents' },
      { name: '界面与快捷键', href: '#shortcuts' }
    ]
  },
  {
    title: '编辑器核心',
    icon: '✍️',
    items: [
      { name: 'Markdown 语法与富文本', href: '#markdown' },
      { name: '虚拟纸张与排版', href: '#paper' },
      { name: '多窗口工作流', href: '#multi-window' },
      { name: '图片与媒体', href: '#media' }
    ]
  },
  {
    title: 'AI 与 Skills',
    icon: '🤖',
    items: [
      { name: 'AI 助手面板', href: '#ai-panel' },
      { name: 'Skills 体系总览', href: '#skills-overview' },
      { name: '内置 Skills 清单', href: '#built-in-skills' },
      { name: '自定义 Skill', href: '#custom-skill' }
    ]
  },
  {
    title: '开发者参考',
    icon: '🧪',
    items: [
      { name: '本地 API 与 IPC', href: '#ipc' },
      { name: '扩展插件开发', href: '#plugins' },
      { name: '命令行工具', href: '#cli' },
      { name: '常见问题 FAQ', href: '#faq' }
    ]
  }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">文档</span>
        <h1 class="mt-4 text-4xl font-extrabold md:text-5xl">
          <span class="wpx-gradient-text">从这里开始你的 WPX 之旅</span>
        </h1>
        <p class="mt-4 text-dark/60">
          从安装到高级定制，每一步都有清晰的指引。文档由 WPX 团队与社区共同维护。
        </p>
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
          <a
            href="#"
            class="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 transition-all group-hover:gap-2"
          >
            开始阅读 →
          </a>
        </article>
      </div>

      <!-- TOC Sections -->
      <div class="mt-20">
        <h2 class="text-2xl font-extrabold md:text-3xl">文档章节索引</h2>
        <p class="mt-2 text-dark/60">
          4 大类共 16 个主题，按需取用。完整内容请前往 GitHub Wiki。
        </p>

        <div class="mt-10 grid gap-6 md:grid-cols-2">
          <div
            v-for="s in sections"
            :key="s.title"
            class="rounded-2xl border border-dark/5 bg-white p-6"
          >
            <h3 class="flex items-center gap-2 text-lg font-bold">
              <span class="text-2xl">{{ s.icon }}</span>
              {{ s.title }}
            </h3>
            <ul class="mt-4 grid gap-2 sm:grid-cols-2">
              <li
                v-for="item in s.items"
                :key="item.name"
              >
                <a
                  :href="item.href"
                  class="block rounded-lg px-3 py-2 text-sm text-dark/70 transition-colors hover:bg-wpx-gradient-soft hover:text-primary-600"
                >
                  {{ item.name }}
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
            href="https://github.com/wpx-team/wpx/wiki"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            前往 GitHub Wiki
          </a>
          <a
            href="https://github.com/wpx-team/wpx/discussions"
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
