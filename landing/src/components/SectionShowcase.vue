<!--
  SectionShowcase · 多窗口 + HTML 源码分屏
  - 已同步 v0.1.16：从单一"虚拟纸张"卡片升级为"双卡片 + 三栏位"
-->
<script setup>
const windowBlocks = [
  { title: '文档 A', tag: '毕业论文', color: 'bg-primary-from/15 text-primary-600' },
  { title: '文档 B', tag: '文献综述', color: 'bg-accent-mint/20 text-emerald-700' },
  { title: 'AI 助手', tag: '贴边 dock', color: 'bg-accent-yellow/25 text-amber-700' }
]

const commandList = [
  { cmd: '/focus', desc: '进入 Focus 模式' },
  { cmd: '/export', desc: '打开导出弹窗' },
  { cmd: '/paper-a4', desc: '切换 A4 纸张' },
  { cmd: '/img-bg', desc: '图片去背景' },
  { cmd: '/ocr', desc: 'PDF OCR 识别' }
]
</script>

<template>
  <section
    id="showcase"
    class="wpx-section bg-wpx-gradient-soft"
    aria-labelledby="showcase-title"
  >
    <div class="wpx-container">
      <!-- 顶部标题 -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">真实截图</span>
        <h2
          id="showcase-title"
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          在 WPX 里，<span class="wpx-gradient-text">一次看到三件事</span>
        </h2>
        <p class="mt-4 text-dark/70">
          左边大纲、右边 AI、底下指令面板。多窗口 + HTML 源码 + 本地指令，让桌面端编辑器像 IDE 一样专业。
        </p>
      </div>

      <!-- 双卡片：左 = 多窗口编辑器；右 = HTML 源码分屏 -->
      <div class="mt-14 grid items-stretch gap-8 lg:grid-cols-2">
        <!-- ============== 左：多窗口编辑器卡片 ============== -->
        <article class="flex flex-col rounded-3xl border border-dark/5 bg-white p-6 shadow-wpx">
          <header class="flex items-center justify-between">
            <h3 class="text-lg font-bold">
              <span class="wpx-gradient-text">多窗口独立编辑器</span>
            </h3>
            <span class="rounded-full bg-wpx-gradient px-2.5 py-0.5 text-[11px] font-bold text-white">v0.1.13</span>
          </header>
          <p class="mt-2 text-sm text-dark/60">
            同时打开多份文档，AI 助手可贴边 dock 成 IDE 风格右侧栏，跨窗口拖拽素材。
          </p>

          <!-- 模拟窗口栏 -->
          <div class="mt-5 flex-1 rounded-2xl border border-dark/5 bg-light p-2 shadow-sm">
            <div class="flex items-center gap-1.5 border-b border-dark/5 px-2 pb-2">
              <span class="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span class="h-2.5 w-2.5 rounded-full bg-accent-yellow/80" />
              <span class="h-2.5 w-2.5 rounded-full bg-accent-mint/80" />
              <span class="ml-2 text-[10px] text-dark/40">左：大纲 + 文档 A · 右：文档 B · 右 dock：AI</span>
            </div>

            <!-- 三栏窗口 -->
            <div class="grid grid-cols-12 gap-2 p-3">
              <!-- 左：大纲 -->
              <div class="col-span-3 space-y-1.5">
                <div class="h-2 w-3/4 rounded-full bg-primary-from/30" />
                <div class="h-2 w-2/3 rounded-full bg-primary-from/20" />
                <div class="h-2 w-1/2 rounded-full bg-primary-from/15" />
                <div class="h-2 w-4/5 rounded-full bg-primary-from/20" />
                <div class="h-2 w-3/5 rounded-full bg-primary-from/15" />
              </div>
              <!-- 中：文档 A 摘要 -->
              <div class="col-span-5 space-y-1.5">
                <div class="rounded-md bg-wpx-gradient-soft p-1 text-[9px] font-semibold text-primary-600">摘要</div>
                <div class="h-1.5 w-11/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-10/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-9/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-10/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-8/12 rounded-full bg-dark/10" />
              </div>
              <!-- 右：文档 B + AI dock -->
              <div class="col-span-4 space-y-1.5">
                <div class="rounded-md bg-accent-mint/20 p-1 text-[9px] font-semibold text-emerald-700">文档 B</div>
                <div class="h-1.5 w-10/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-9/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-11/12 rounded-full bg-dark/10" />
                <div class="mt-1 rounded-md bg-accent-yellow/20 p-1 text-[9px] font-semibold text-amber-700">AI: 已 dock</div>
              </div>
            </div>
          </div>

          <!-- 三个文档标签 -->
          <div class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="b in windowBlocks"
              :key="b.title"
              :class="['inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', b.color]"
            >
              {{ b.title }} <span class="opacity-70">· {{ b.tag }}</span>
            </span>
          </div>

          <footer class="mt-4 text-xs text-dark/40">📷 桌面端实际运行截图 · v0.1.13 实装</footer>
        </article>

        <!-- ============== 右：HTML 源码分屏卡片 ============== -->
        <article class="flex flex-col rounded-3xl border border-dark/5 bg-white p-6 shadow-wpx">
          <header class="flex items-center justify-between">
            <h3 class="text-lg font-bold">
              <span class="wpx-gradient-text">HTML 源码分屏编辑</span>
            </h3>
            <span class="rounded-full bg-accent-mint/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">v0.1.13</span>
          </header>
          <p class="mt-2 text-sm text-dark/60">
            导入 HTML 后分屏编辑源码（CodeMirror 6）与富文本（Tiptap），双向同步，宽度可拖拽。
          </p>

          <!-- 模拟分屏窗 -->
          <div class="mt-5 flex-1 rounded-2xl border border-dark/5 bg-light p-2 shadow-sm">
            <div class="flex items-center gap-1.5 border-b border-dark/5 px-2 pb-2">
              <span class="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span class="h-2.5 w-2.5 rounded-full bg-accent-yellow/80" />
              <span class="h-2.5 w-2.5 rounded-full bg-accent-mint/80" />
              <span class="ml-2 text-[10px] text-dark/40">左：源码 (CodeMirror) · 右：富文本 (Tiptap)</span>
            </div>

            <!-- 分屏栏 -->
            <div class="grid grid-cols-2 gap-2 p-3">
              <!-- 左：HTML 源码 -->
              <div class="space-y-1 rounded-md bg-slate-900 p-2 font-mono text-[9px] text-green-300/90">
                <div><span class="text-rose-400">&lt;h1&gt;</span>基于深度学习的图像去背景<span class="text-rose-400">&lt;/h1&gt;</span></div>
                <div><span class="text-rose-400">&lt;p&gt;</span>本文提出一种基于 U-Net 的 …<span class="text-rose-400">&lt;/p&gt;</span></div>
                <div><span class="text-rose-400">&lt;img</span> <span class="text-sky-300">src</span>=<span class="text-amber-300">"paper.png"</span> <span class="text-rose-400">/&gt;</span></div>
                <div class="text-slate-500">// ↕ 双向同步</div>
                <div><span class="text-rose-400">&lt;h2&gt;</span>实验结果<span class="text-rose-400">&lt;/h2&gt;</span></div>
                <div><span class="text-rose-400">&lt;ul&gt;&lt;li&gt;</span>准确率 96.4%<span class="text-rose-400">&lt;/li&gt;&lt;/ul&gt;</span></div>
              </div>
              <!-- 右：富文本 -->
              <div class="space-y-1.5">
                <div class="text-[11px] font-extrabold text-dark">基于深度学习的图像去背景</div>
                <div class="text-[9px] text-dark/50">摘要 · 关键词 · 引言</div>
                <div class="h-1.5 w-11/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-10/12 rounded-full bg-dark/10" />
                <div class="h-1.5 w-9/12 rounded-full bg-dark/10" />
                <div class="rounded-md bg-wpx-gradient-soft p-1.5 text-[9px] text-primary-600">🖼 paper.png（已插入）</div>
                <div class="text-[11px] font-extrabold text-dark">实验结果</div>
                <div class="rounded-md bg-accent-mint/20 p-1 text-[9px] text-emerald-700">✓ 准确率 96.4%</div>
              </div>
            </div>
          </div>

          <!-- 关键能力 chip -->
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1 rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
              ⚡ 防抖 300ms
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
              ↔ 双向同步
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
              ≷ 拖拽宽度
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
              Ctrl+Shift+H
            </span>
          </div>

          <footer class="mt-4 text-xs text-dark/40">📷 桌面端实际运行截图 · v0.1.13 实装</footer>
        </article>
      </div>

      <!-- 底部：64 条本地指令速览 -->
      <div class="mt-12 rounded-3xl border border-dark/5 bg-white p-6 shadow-sm sm:p-8">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold">
            <span class="wpx-gradient-text">64 条本地指令（部分示例）</span>
          </h3>
          <router-link
            to="/docs#local-commands"
            class="text-xs font-semibold text-primary-600 hover:underline"
          >
            全部指令 →
          </router-link>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <div
            v-for="c in commandList"
            :key="c.cmd"
            class="rounded-lg bg-light px-3 py-1.5 text-xs"
          >
            <code class="font-mono font-bold text-primary-600">{{ c.cmd }}</code>
            <span class="ml-1.5 text-dark/60">{{ c.desc }}</span>
          </div>
          <div class="rounded-lg bg-wpx-gradient-soft px-3 py-1.5 text-xs font-semibold text-primary-600">
            ...还有 59 条 →
          </div>
        </div>
      </div>
    </div>
  </section>
</template>