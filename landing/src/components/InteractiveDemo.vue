<!--
  InteractiveDemo.vue · 现场体验区（去 AI 化重写）
  ------------------------------------------------------------
  原版：选中文字 → 假 AI 对话浮窗（含打字机 / 消息流 / 用户输入）
  新版：选中文字 → 浮出「斜杠指令菜单」，4 个一键操作按钮
       + 底部「Skills 面板」次级入口（可选）
  目的：让访客看到的不是「又一个 AI 聊天工具」，
       而是「一个像 IDE 一样能用键盘指令驱动的编辑器」。
  ------------------------------------------------------------
-->
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

// ---------------- 假编辑器预设文本 ----------------
const editorText = `在二十一世纪的第三个十年里，写作工具已经变得过分聪明。

它们会主动建议、自动续写、随时弹窗提醒你"也许你想用 AI？"。

而 WPX 想做的，是把选择权交还给你——
没有续费弹窗，没有"猜你喜欢"，没有随时上线的云端依赖。
只有 64 条斜杠指令、32 项 Skills 和一个不会绑架你的编辑器。`

// ---------------- 指令菜单 ----------------
const COMMAND_LIST = [
  { cmd: '/polish',   label: '润色',   desc: '改写语气 / 缩短长度',     icon: '✍' },
  { cmd: '/translate',label: '翻译',   desc: '中英 / 中日 / 中韩',     icon: '🌐' },
  { cmd: '/summary',  label: '总结',   desc: '段落 / 全文摘要',         icon: '📋' },
  { cmd: '/cite',     label: '引用',   desc: 'GB/T 7714 学术格式',     icon: '🔗' }
]

// ---------------- 状态 ----------------
const editorRef = ref(null)
const popupVisible = ref(false)
const selectedText = ref('')
const selectedRect = ref(null) // 选区位置（用于浮窗定位）

// ---------------- 监听选区变化 ----------------
function onSelectionChange() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    selectedText.value = ''
    selectedRect.value = null
    popupVisible.value = false
    return
  }
  const text = sel.toString().trim()
  if (!text) {
    selectedText.value = ''
    selectedRect.value = null
    popupVisible.value = false
    return
  }
  const editorEl = editorRef.value
  if (!editorEl) return
  const range = sel.getRangeAt(0)
  if (!editorEl.contains(range.commonAncestorContainer)) {
    popupVisible.value = false
    return
  }
  // 记录选区位置（用于浮窗绝对定位）
  const rect = range.getBoundingClientRect()
  selectedRect.value = {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width
  }
  selectedText.value = text
  popupVisible.value = true
}

function onDocumentMouseDown(e) {
  if (!popupVisible.value) return
  const popup = document.getElementById('wpx-demo-popup')
  const editor = editorRef.value
  if (popup && popup.contains(e.target)) return
  if (editor && editor.contains(e.target)) {
    return // 等 selectionchange 触发
  }
  popupVisible.value = false
  window.getSelection()?.removeAllRanges()
}

// ---------------- 右侧高亮（去 AI 化）----------------
const highlights = [
  { icon: '🪟', text: '多窗口独立编辑器' },
  { icon: '🛠', text: '64 条斜杠指令，一键触发' },
  { icon: '🎓', text: '32+ Skills 模板与脚本' },
  { icon: '🔍', text: 'PDF 离线 OCR · 扫描件可读' },
  { icon: '🔤', text: '100+ 开源字体免费用' }
]
const hlIdx = ref(0)
let hlTimer = null
function startHighlights() {
  hlTimer = setInterval(() => {
    hlIdx.value = (hlIdx.value + 1) % highlights.length
  }, 2800)
}

// ---------------- 生命周期 ----------------
onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', onDocumentMouseDown)
  startHighlights()
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocumentMouseDown)
  if (hlTimer) clearInterval(hlTimer)
})
</script>

<template>
  <section class="wpx-section bg-wpx-gradient-soft">
    <div class="wpx-container">
      <!-- 标题 -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">现场体验</span>
        <h2 class="mt-4 text-[1.6rem] font-extrabold leading-tight sm:text-3xl md:text-5xl">
          <span class="wpx-gradient-text">选中文字，弹出指令菜单</span>
        </h2>
        <p class="mt-4 text-dark/60">
          在下面的文档里选中一段文字 —— 试试看会发生什么。
        </p>
      </div>

      <!-- 主体：左编辑器 + 右功能轮播 -->
      <div class="mt-14 grid gap-6 md:grid-cols-3">
        <!-- ========== 假编辑器（占 2 列） ========== -->
        <div
          ref="editorRef"
          class="editor-mock relative md:col-span-2 rounded-3xl border border-dark/5 bg-white shadow-wpx-glow"
        >
          <!-- 窗口栏 -->
          <div class="flex items-center gap-2 border-b border-dark/5 px-4 py-3">
            <span class="h-3 w-3 rounded-full bg-red-400/80" />
            <span class="h-3 w-3 rounded-full bg-amber-300/90" />
            <span class="h-3 w-3 rounded-full bg-emerald-300/90" />
            <span class="ml-2 text-xs text-dark/40">毕业论文 · 第一章 · 引言</span>
            <span class="ml-auto text-[10px] text-dark/30">WPX · 本地保存</span>
          </div>

          <!-- 工具栏 -->
          <div class="flex flex-wrap items-center gap-1 border-b border-dark/5 px-4 py-2 text-xs text-dark/60">
            <span class="rounded px-2 py-1 hover:bg-dark/5">B</span>
            <span class="rounded px-2 py-1 italic hover:bg-dark/5">I</span>
            <span class="rounded px-2 py-1 line-through hover:bg-dark/5">S</span>
            <span class="mx-1 h-4 w-px bg-dark/10" />
            <span class="rounded px-2 py-1 hover:bg-dark/5">H1</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">H2</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">引用</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">图片</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">表格</span>
            <span class="ml-auto rounded bg-wpx-gradient-soft px-2 py-1 font-semibold text-primary-600">
              ⌘ / 唤起指令菜单
            </span>
          </div>

          <!-- 文本内容（可选中） -->
          <div
            class="prose-wpx select-text space-y-4 p-8 leading-relaxed text-dark/85 md:p-12"
            data-test="editor-body"
          >
            <div class="text-2xl font-extrabold text-dark">
              <span class="wpx-gradient-text">把选择权交还给写作者</span>
            </div>
            <p
              v-for="(para, i) in editorText.split('\n\n')"
              :key="i"
            >
              {{ para }}
            </p>
            <div class="mt-2 flex items-center gap-2 text-xs text-dark/40">
              <span>·</span>
              <span>{{ editorText.length }} 字</span>
              <span>·</span>
              <span>约 {{ Math.ceil(editorText.length / 300) }} 分钟阅读</span>
            </div>
          </div>

          <!-- 引导气泡（未选中时显示） -->
          <div
            v-if="!popupVisible"
            class="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full bg-dark/80 px-3 py-1.5 text-xs text-white shadow-sm"
          >
            👆 用鼠标选中上面任意一段文字
          </div>
        </div>

        <!-- ========== 右侧：核心能力轮播 ========== -->
        <div
          class="relative overflow-hidden rounded-3xl border border-primary-500/20 bg-white p-6 shadow-wpx md:p-8"
        >
          <div class="text-xs font-semibold uppercase tracking-wider text-primary-600">
            核心能力
          </div>
          <div class="relative mt-4 h-32">
            <transition
              name="hl"
              mode="out-in"
            >
              <div
                :key="hlIdx"
                class="absolute inset-0 flex flex-col gap-3"
              >
                <div class="text-5xl">
                  {{ highlights[hlIdx].icon }}
                </div>
                <div class="text-xl font-extrabold leading-tight text-dark md:text-2xl">
                  {{ highlights[hlIdx].text }}
                </div>
              </div>
            </transition>
          </div>

          <!-- 指示器 -->
          <div class="mt-6 flex gap-1.5">
            <span
              v-for="(_, i) in highlights"
              :key="i"
              :class="[
                'h-1.5 rounded-full transition-all duration-300',
                i === hlIdx
                  ? 'w-6 bg-wpx-gradient'
                  : 'w-1.5 bg-primary-500/20'
              ]"
            />
          </div>

          <!-- 底部补充 -->
          <div class="mt-8 rounded-2xl bg-wpx-gradient-soft p-4">
            <div class="text-sm font-semibold text-primary-600">
              下载桌面端即可用
            </div>
            <div class="mt-1 text-xs leading-relaxed text-dark/60">
              指令菜单、Skills 市场、PDF/OCR/压缩全部内置，开箱即用。
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============== 指令菜单浮层（fixed 浮层，定位在选区上方） ============== -->
    <transition name="popup">
      <div
        v-if="popupVisible"
        id="wpx-demo-popup"
        class="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-primary-500/20 bg-white shadow-wpx-glow"
        role="dialog"
        aria-label="斜杠指令菜单"
        :style="selectedRect ? {
          top: `${Math.max(12, selectedRect.top - 72)}px`,
          left: `${Math.max(12, selectedRect.left)}px`
        } : {}"
      >
        <!-- 顶部：标题 + 选区长度 -->
        <div class="flex items-center gap-2 border-b border-dark/5 bg-wpx-gradient-soft px-4 py-2">
          <span class="flex h-6 w-6 items-center justify-center rounded-md bg-wpx-gradient text-[12px] font-bold text-white">
            /
          </span>
          <span class="flex-1 text-xs font-semibold text-primary-600">
            斜杠指令菜单
          </span>
          <span class="text-[10px] text-dark/50">
            选中 {{ selectedText.length }} 字
          </span>
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded-md text-dark/50 transition-colors hover:bg-dark/5 hover:text-dark"
            aria-label="关闭"
            @click="popupVisible = false; window.getSelection()?.removeAllRanges()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <!-- 指令按钮列表 -->
        <div class="grid grid-cols-2 gap-1 p-2">
          <button
            v-for="c in COMMAND_LIST"
            :key="c.cmd"
            type="button"
            class="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-wpx-gradient-soft"
            :aria-label="`${c.label}：${c.desc}`"
            @click="popupVisible = false; window.getSelection()?.removeAllRanges()"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-dark/5 text-base group-hover:bg-white">
              {{ c.icon }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold text-dark">
                {{ c.label }}
              </span>
              <span class="block truncate font-mono text-[10px] text-primary-600">
                {{ c.cmd }}
              </span>
            </span>
          </button>
        </div>

        <!-- 底部提示 -->
        <div class="border-t border-dark/5 bg-white px-3 py-1.5 text-center text-[10px] text-dark/40">
          这是演示版 · 桌面端立即生效
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
/* ============== 浮窗进出动画 ============== */
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.popup-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
.popup-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

/* ============== 文字轮播 ============== */
.hl-enter-active,
.hl-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.hl-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.hl-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ============== 排版 ============== */
.prose-wpx p {
  margin: 0;
}
.prose-wpx ::selection {
  background: rgba(124, 58, 237, 0.25);
  color: inherit;
}

/* ============== 减少动效 ============== */
@media (prefers-reduced-motion: reduce) {
  .popup-enter-active,
  .popup-leave-active {
    transition: none;
  }
  .hl-enter-active,
  .hl-leave-active {
    transition: none;
  }
}
</style>