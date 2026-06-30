<script setup>
/**
 * ChangelogView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 更新日志
 *
 *  - 倒序时间线：版本号 → 日期 → 改动列表
 *  - 每条改动用 feature / fix / breaking 三色 chip 区分
 *  - 顶部 CTA：订阅 GitHub Releases
 *  - 移动端默认收起旧版本（节省首屏空间）
 * ------------------------------------------------------------
 */
import { ref } from 'vue'

const chipStyles = {
  feature: 'bg-primary-from/10 text-primary-600',
  fix: 'bg-accent-mint/20 text-emerald-700',
  breaking: 'bg-rose-100 text-rose-700'
}

const chipLabels = {
  feature: '新功能',
  fix: '修复',
  breaking: '不兼容'
}

// 倒序：v0.1.17 → v0.1.16 → v0.1.15 → v1.0.0 → v0.9.x ……
const releases = [
  {
    version: 'v0.1.17',
    date: '2026-06-30',
    badge: '最新',
    badgeClass: 'bg-wpx-gradient text-white',
    summary: '资料库路径用户可配置 + PDF 转换崩溃修复 + 提交资料库选项上线。',
    docLink: null,
    changes: [
      { type: 'feature', text: '通用设置新增「资料库保存路径」卡片，支持桌面端文件夹选择器配置自定义根目录' },
      { type: 'feature', text: '导出对话框新增「同步到资料库」复选框，默认勾选，导出后自动归档' },
      { type: 'feature', text: '保存到文库对话框新增「同时提交到资料库」复选框，默认勾选' },
      { type: 'fix', text: '修复 PDF 转换报错 `Package keyval Error: 20mm undefined`（移除冗余 hmargin 参数）' },
      { type: 'fix', text: '修复用户配置的「资料库保存路径」不生效的严重缺陷（双字段读取 + 镜像写入双向兼容）' },
      { type: 'fix', text: '资料库上传失败时改为静默降级（不阻断主流程），容错率提升' }
    ]
  },
  {
    version: 'v0.1.16',
    date: '2026-06-29',
    badge: '特性',
    badgeClass: 'bg-primary-from/10 text-primary-600',
    summary: 'Excel 导入支持 (.xls / .xlsx) + 标题字号 / 段距 / 列表样式优化。',
    docLink: null,
    changes: [
      { type: 'feature', text: 'Excel / WPS 表格 / Numbers 文档一键导入并解析为表格块' },
      { type: 'feature', text: '编辑器标题字号档位扩展（5 档）+ 段距微调' },
      { type: 'fix', text: '修复图片批量插入时的顺序错乱' }
    ]
  },
  {
    version: 'v0.1.15',
    date: '2026-06-29',
    badge: '重大',
    badgeClass: 'bg-accent-yellow/30 text-amber-800',
    summary: '教师教案 → 课件 PPT 全流程上线，备课效率提升 10 倍。',
    docLink: { label: '需求文档', href: '/docs#lesson-ppt' },
    changes: [
      { type: 'feature', text: '教案大纲 → 演示文稿大纲 → PPT 一键生成' },
      { type: 'feature', text: 'PPT 母版与配色方案自动推荐' },
      { type: 'feature', text: '配套讲义同步生成（Markdown 格式）' },
      { type: 'feature', text: 'AI 助手贴边模式一键切换' }
    ]
  },
  {
    version: 'v0.1.14',
    date: '2026-06-29',
    badge: '特性',
    badgeClass: 'bg-primary-from/10 text-primary-600',
    summary: 'AI Chat 显示 DeepSeek 思考过程 + 图片对齐修复。',
    docLink: { label: '需求文档', href: '/docs#ai-panel' },
    changes: [
      { type: 'feature', text: 'AI Chat 支持显示 DeepSeek 等模型的 `reasoning_content` 思考链' },
      { type: 'feature', text: 'AI 错误提示增加「重试 / 切换模型 / 检查 Key」三选项' },
      { type: 'fix', text: '修复图片删除后的占位空白' },
      { type: 'fix', text: '修复多张图片对齐时的链式缩进异常' }
    ]
  },
  {
    version: 'v0.1.13',
    date: '2026-06-29',
    badge: '重大',
    badgeClass: 'bg-accent-yellow/30 text-amber-800',
    summary: 'Focus 模式 MD 排版提示 + 本地指令 64 条 + HTML 源码编辑 + IDE 风格 dock。',
    docLink: { label: '需求文档', href: '/docs#local-commands' },
    changes: [
      { type: 'feature', text: 'Focus 模式进入时自动应用 MD 排版模板提示' },
      { type: 'feature', text: '本地指令系统从 56 条扩展至 64 条（含 /focus /export /paper-a4 等）' },
      { type: 'feature', text: 'HTML 源码分屏编辑（CodeMirror 6 + Tiptap 双向同步）' },
      { type: 'feature', text: 'AI 助手贴边 dock 模式（IDE 风格右侧栏 inline panel）' },
      { type: 'feature', text: '右栏拖拽调整宽度（resize handle）' }
    ]
  },
  {
    version: 'v0.1.12',
    date: '2026-06-29',
    badge: '工程',
    badgeClass: 'bg-dark/5 text-dark/70',
    summary: 'electron-builder 打包配置优化 + 图片删除链路修复。',
    docLink: null,
    changes: [
      { type: 'fix', text: '修复图片删除后编辑器残留空白节点的问题' },
      { type: 'fix', text: '对齐图片链路在多窗口下的一致性' },
      { type: 'fix', text: 'electron-builder 安装包体积与启动速度优化' }
    ]
  },
  {
    version: 'v0.1.11',
    date: '2026-06-28',
    badge: '安全',
    badgeClass: 'bg-rose-100 text-rose-700',
    summary: '7 项中风险安全加固 + 版本递增至 0.1.11。',
    docLink: null,
    changes: [
      { type: 'fix', text: '加固 IPC 通道签名校验，阻断伪造主进程消息' },
      { type: 'fix', text: '加固本地文件路径越权校验' },
      { type: 'fix', text: '修复 Webview 沙箱里潜在的 URL 跳转漏洞' },
      { type: 'fix', text: '其他 4 项中风险加固（详见 GitHub Security Advisory）' }
    ]
  },
  {
    version: 'v0.1.10',
    date: '2026-06-28',
    badge: '特性',
    badgeClass: 'bg-primary-from/10 text-primary-600',
    summary: '演示文稿生成器 / HTML 导出弹窗 / 本地指令 56 条 / MD-HTML 智能排版 / jcode 高性能 AI 引擎 / PDF 离线 OCR 全套上线。',
    docLink: { label: '需求文档', href: '/docs#lesson-ppt' },
    changes: [
      { type: 'feature', text: '演示文稿生成器（4 步工作流：意图 → 大纲 → 配图 → 导出）' },
      { type: 'feature', text: 'HTML 导出弹窗（带 ZIP 打包、源文件一并归档）' },
      { type: 'feature', text: '本地指令系统首版 56 条（基础操作 + 排版指令）' },
      { type: 'feature', text: 'MD / HTML 智能排版引擎（导入 HTML 后自动清理与排版）' },
      { type: 'feature', text: 'jcode 高性能 AI 引擎前端接入（带知识库）' },
      { type: 'feature', text: 'PDF 离线 OCR（pdfjs + tesseract.js，本地推理 0 上传）' },
      { type: 'feature', text: '编辑器核心：Tiptap + 自定义扩展 + 12 种语气与 6 种长度档位' }
    ]
  },
  // 历史旧版（移动端默认收起）
  {
    version: 'v1.0.0',
    date: '2026-06-18',
    badge: '首发',
    badgeClass: 'bg-dark/5 text-dark/70',
    summary: '从单点工具到完整写作工作台，WPX 的第一个里程碑版本。',
    docLink: null,
    changes: [
      { type: 'feature', text: '多窗口独立编辑器 —— 同时打开 N 个文档，互不干扰' },
      { type: 'feature', text: '虚拟纸张：所见即所得的版式编辑，支持母版与分页' },
      { type: 'feature', text: 'AI 助手面板：选中文字即可对话、续写、改写、翻译' },
      { type: 'feature', text: '内置 32 款 Skills（学生 16 + 教师 16），开箱即用' },
      { type: 'feature', text: '导出 PDF / DOCX / Markdown / 7z / ZIP' }
    ]
  },
  {
    version: 'v0.9.5',
    date: '2026-06-04',
    badge: '稳定',
    badgeClass: 'bg-accent-mint/20 text-emerald-700',
    summary: 'PDF 导出器升级，支持母版渲染与字体子集化嵌入。',
    docLink: null,
    changes: [
      { type: 'feature', text: 'PDF 导出支持自定义纸张大小与页边距' },
      { type: 'feature', text: '中文字体子集化导出，PDF 体积下降 60%' },
      { type: 'fix', text: '修复导出长文档时偶发的分页错位问题' },
      { type: 'fix', text: '修复部分 Linux 系统下字体回退失败的问题' }
    ]
  }
]

// 移动端默认收起旧版本
const visibleCount = ref(7)
const showAll = () => {
  visibleCount.value = releases.length
}
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">更新日志</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">WPX 的每一次小步快跑</span>
        </h1>
        <p class="mt-4 text-dark/60">
          桌面端 v0.1.10 → v0.1.17 一口气迭代 7 个版本，所有 feature / fix / breaking 都有迹可循。
        </p>
        <!-- 订阅 CTA -->
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/MatuX-ai/WPX/releases.atom"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            <span aria-hidden="true">📡</span> 订阅 GitHub Releases
          </a>
          <a
            href="https://github.com/MatuX-ai/WPX/releases"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-ghost"
          >
            在 GitHub 查看 ↗
          </a>
        </div>
      </div>

      <!-- Timeline -->
      <div class="mx-auto mt-16 max-w-4xl">
        <div class="relative">
          <!-- 装饰竖线 -->
          <div
            class="absolute bottom-0 left-4 top-0 hidden w-px bg-gradient-to-b from-primary-from/40 via-primary-to/30 to-transparent md:block"
            aria-hidden="true"
          />

          <article
            v-for="r in releases.slice(0, visibleCount)"
            :key="r.version"
            class="relative mb-12 md:ml-12"
          >
            <!-- 左侧版本徽章 -->
            <div class="md:absolute md:-left-12 md:top-1">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white shadow-wpx"
                :class="r.badgeClass"
                :aria-label="`版本 ${r.version}`"
              >
                <span class="text-xs font-bold">★</span>
              </div>
            </div>

            <!-- 卡片主体 -->
            <div
              class="rounded-2xl border border-dark/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-wpx"
            >
              <header class="flex flex-wrap items-baseline justify-between gap-3">
                <div class="flex flex-wrap items-center gap-3">
                  <h2 class="text-2xl font-extrabold tracking-tight">
                    {{ r.version }}
                  </h2>
                  <span
                    class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    :class="r.badgeClass"
                  >
                    {{ r.badge }}
                  </span>
                  <router-link
                    v-if="r.docLink"
                    :to="r.docLink.href"
                    class="text-xs font-semibold text-primary-600 hover:underline"
                  >
                    {{ r.docLink.label }} →
                  </router-link>
                </div>
                <time class="flex items-center gap-1 text-sm text-dark/50">
                  <span aria-hidden="true">⏱</span>
                  {{ r.date }}
                </time>
              </header>
              <p class="mt-2 text-sm leading-relaxed text-dark/70">
                {{ r.summary }}
              </p>
              <ul class="mt-4 space-y-2">
                <li
                  v-for="(c, idx) in r.changes"
                  :key="idx"
                  class="flex items-start gap-3 text-sm text-dark/75"
                >
                  <span
                    class="mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    :class="chipStyles[c.type]"
                  >
                    {{ chipLabels[c.type] }}
                  </span>
                  <span class="leading-relaxed">{{ c.text }}</span>
                </li>
              </ul>
            </div>
          </article>

          <!-- 显示更多按钮（移动端隐藏 v0.9.5 之前的旧版本） -->
          <div v-if="visibleCount < releases.length" class="text-center">
            <button
              type="button"
              class="rounded-full border border-primary-from/30 bg-wpx-gradient-soft px-6 py-2 text-sm font-semibold text-primary-600 transition-all hover:-translate-y-0.5 hover:shadow-wpx"
              @click="showAll"
            >
              显示全部 {{ releases.length - visibleCount }} 个旧版本 ↓
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div
        class="mx-auto mt-20 max-w-3xl rounded-3xl bg-wpx-gradient-soft p-10 text-center"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">想要第一时间收到更新？</span>
        </h2>
        <p class="mt-3 text-dark/70">
          关注 GitHub Releases，开启 Watch 即可在每次发布时收到邮件提醒。
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/MatuX-ai/WPX/releases"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            <span aria-hidden="true">⭐</span>
            前往 GitHub Releases
          </a>
          <router-link
            to="/blog"
            class="wpx-btn-ghost"
          >
            看看博客里的故事
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>