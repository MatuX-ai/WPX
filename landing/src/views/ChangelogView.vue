<script setup>
/**
 * ChangelogView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 更新日志
 *
 *  - 倒序时间线：版本号 → 日期 → 改动列表
 *  - 每条改动用 feature / fix / breaking 三色 chip 区分
 *  - 底部 CTA：订阅 + GitHub Releases
 * ------------------------------------------------------------
 */

const releases = [
  {
    version: 'v1.0.0',
    date: '2026-06-18',
    badge: '首发',
    badgeClass: 'bg-wpx-gradient text-white',
    summary: '从单点工具到完整写作工作台，WPX 的第一个里程碑版本。',
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
    changes: [
      { type: 'feature', text: 'PDF 导出支持自定义纸张大小与页边距' },
      { type: 'feature', text: '中文字体子集化导出，PDF 体积下降 60%' },
      { type: 'fix', text: '修复导出长文档时偶发的分页错位问题' },
      { type: 'fix', text: '修复部分 Linux 系统下字体回退失败的问题' }
    ]
  },
  {
    version: 'v0.9.0',
    date: '2026-05-20',
    badge: '重大',
    badgeClass: 'bg-accent-yellow/30 text-amber-800',
    summary: '内置 16 款学生 Skills + 16 款教师 Skills，覆盖全场景教学与学习。',
    changes: [
      { type: 'feature', text: '学生 Skills：论文大纲、文献综述、查重降重、排版助手、开题报告等' },
      { type: 'feature', text: '教师 Skills：教案生成、课件大纲、智能出题、作文批改、家长会发言稿等' },
      { type: 'feature', text: 'Skills 管理面板：启用 / 停用 / 自定义提示词' },
      { type: 'feature', text: 'Skills 执行历史与一键复用' }
    ]
  },
  {
    version: 'v0.8.0',
    date: '2026-05-06',
    badge: '特性',
    badgeClass: 'bg-primary-from/10 text-primary-600',
    summary: '内置 8 款免费开源字体，覆盖中英文书写全部场景。',
    changes: [
      { type: 'feature', text: '思源黑体 / 思源宋体 / 霞鹜文楷 / 霞鹜文楷等宽' },
      { type: 'feature', text: '阿里巴巴普惠体 / HarmonyOS Sans / JetBrains Mono / Noto Color Emoji' },
      { type: 'feature', text: '字体按字重筛选与一键预览' },
      { type: 'feature', text: '在线免费字体库（按需下载）' }
    ]
  },
  {
    version: 'v0.7.0',
    date: '2026-04-22',
    badge: '特性',
    badgeClass: 'bg-primary-from/10 text-primary-600',
    summary: '集成 7-Zip，支持文档打包 / 解压 / 分卷 / 加密。',
    changes: [
      { type: 'feature', text: '一键将当前文档目录打包为 7z / ZIP' },
      { type: 'feature', text: 'AES-256 加密保护敏感文档' },
      { type: 'feature', text: '文件关联：双击 .7z / .zip 直接在 WPX 中预览' }
    ]
  },
  {
    version: 'v0.6.0',
    date: '2026-04-08',
    badge: '特性',
    badgeClass: 'bg-primary-from/10 text-primary-600',
    summary: '内置图片编辑器：去背景、裁剪、滤镜、打码一句话搞定。',
    changes: [
      { type: 'feature', text: 'AI 一键去背景（本地 rembg 推理，零上传）' },
      { type: 'feature', text: '裁剪 / 旋转 / 缩放 / 滤镜 / 马赛克' },
      { type: 'feature', text: '拖拽插入到当前文档光标位置' }
    ]
  },
  {
    version: 'v0.5.0',
    date: '2026-03-25',
    badge: '起点',
    badgeClass: 'bg-dark/5 text-dark/70',
    summary: 'Markdown 编辑器与 TipTap 富文本核心首次发布。',
    changes: [
      { type: 'feature', text: '基于 TipTap 的所见即所得编辑器' },
      { type: 'feature', text: 'Markdown 双向同步' },
      { type: 'feature', text: '本地文件持久化（不依赖云端）' },
      { type: 'breaking', text: '编辑器内部 API 不稳定，不建议插件化对接' }
    ]
  }
]

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
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">更新日志</span>
        <h1 class="mt-4 text-4xl font-extrabold md:text-5xl">
          <span class="wpx-gradient-text">WPX 的每一次小步快跑</span>
        </h1>
        <p class="mt-4 text-dark/60">
          新功能、性能优化、Bug 修复 —— 我们在这里记录每一次有意义的改变。
        </p>
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
            v-for="r in releases"
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
                </div>
                <time class="text-sm text-dark/50">{{ r.date }}</time>
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
            href="https://github.com/wpx-team/wpx/releases"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.447a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.37-2.447a1 1 0 00-1.176 0l-3.37 2.447c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"
              />
            </svg>
            <span>前往 GitHub Releases</span>
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
