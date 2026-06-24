<script setup>
/**
 * HeroSection.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 首屏 Hero 区域
 *
 *  1. 大标题：GSAP / 自研字符级打字机（带 WPX 高亮 + 光标）
 *  2. 副标题：5 条文案 3s 间隔 fade 切换
 *  3. 背景：Canvas 字符粒子流（Matrix 风格 + 品牌色淡化）
 *  4. 主按钮：渐变背景 + hover 弹性放大 + 动态文案
 *  5. 次按钮：outline + hover 填充
 *  6. 下载提示：仅 15MB，不占 C 盘
 * ------------------------------------------------------------
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { gsap } from 'gsap'

// ---------------- 数据 ----------------
const subtitleList = [
  'Markdown 写文？',
  'AI 对话改稿？',
  'PDF 转 Word？',
  '表格？图片处理？',
  '还有免费字体和智能模板…'
]
const ctaHoverTexts = [
  '别犹豫，又不要钱',
  '给 WPS 最后一次机会？',
  'Windows 用户请猛击',
  'Mac 用户也有的'
]

// ---------------- 状态 ----------------
const mainBtnRef = ref(null)
const ctaMainText = ref('立即下载')

// 打字机：将标题按片段拆分，支持「高亮」段
const titleSegments = [
  { type: 'text', text: '别再为 WPS 交税了。' },
  { type: 'hl', text: 'WPX' },
  { type: 'text', text: '，新一代 AI 文档编辑器。' }
]
const totalChars = titleSegments.reduce((s, seg) => s + seg.text.length, 0)
const shown = ref(0) // 已显示的字符数
const isTypingDone = computed(() => shown.value >= totalChars)

const titleHtml = computed(() => {
  let remaining = shown.value
  let html = ''
  for (const seg of titleSegments) {
    if (remaining <= 0) break
    const len = seg.text.length
    const visible = Math.min(remaining, len)
    const safe = escapeHtml(seg.text.slice(0, visible))
    html +=
      seg.type === 'hl'
        ? `<span class="wpx-gradient-text">${safe}</span>`
        : safe
    remaining -= visible
  }
  return html
})

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]))
}

// 副标题轮播
const subIdx = ref(0)

// ---------------- 计时器清理集合 ----------------
let typeTimer = null
let subTimer = null
let hoverTimer = null
let canvasRaf = null
let canvasCleanupResize = null

// ---------------- 打字机 ----------------
function startTypewriter() {
  // 让光标先出现 0.3s 再开始打字
  let i = 0
  typeTimer = setInterval(() => {
    i++
    if (i >= totalChars) {
      shown.value = totalChars
      clearInterval(typeTimer)
      typeTimer = null
      return
    }
    shown.value = i
  }, 60)
}

// ---------------- 副标题 ----------------
function startSubtitle() {
  subTimer = setInterval(() => {
    subIdx.value = (subIdx.value + 1) % subtitleList.length
  }, 3000)
}

// ---------------- Canvas 粒子 ----------------
function startCanvas() {
  const canvas = document.getElementById('wpx-hero-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fontSize = 16
  // 字符池：英文 + 中文 + 符号，让"代码/文字"混合
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'abcdefghijklmnopqrstuvwxyz' +
    '0123456789' +
    '{}[]()<>/\\=+-*;:,.' +
    '你文档编辑器WPXAI写作排版'

  let w = 0
  let h = 0
  let columns = 0
  let drops = []
  let dpr = 1

  function resize() {
    dpr = window.devicePixelRatio || 1
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    columns = Math.max(1, Math.floor(w / fontSize))
    drops = new Array(columns).fill(0).map(() => Math.random() * (h / fontSize))
  }

  resize()
  const onResize = () => resize()
  window.addEventListener('resize', onResize)
  canvasCleanupResize = () => window.removeEventListener('resize', onResize)

  function draw() {
    // 半透明覆盖形成"拖尾"
    ctx.fillStyle = 'rgba(250, 250, 250, 0.06)'
    ctx.fillRect(0, 0, w, h)

    ctx.font = `${fontSize}px "Inter", "Noto Sans SC", "Microsoft YaHei", monospace`
    ctx.textBaseline = 'top'

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)]
      const yPx = drops[i] * fontSize
      // 顶部更亮，底部更暗
      const t = Math.min(1, yPx / h)
      const alpha = (1 - t) * 0.45 + 0.05
      // 渐变色：from blue → to purple
      const r = Math.round(37 + (124 - 37) * t)
      const g = Math.round(99 + (58 - 99) * t)
      const b = Math.round(235 + (237 - 235) * t)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
      ctx.fillText(text, i * fontSize, yPx)

      if (yPx > h && Math.random() > 0.975) {
        drops[i] = 0
      }
      drops[i] += 0.55 + Math.random() * 0.4
    }
    canvasRaf = requestAnimationFrame(draw)
  }
  draw()
}

function stopCanvas() {
  if (canvasRaf) {
    cancelAnimationFrame(canvasRaf)
    canvasRaf = null
  }
  if (canvasCleanupResize) {
    canvasCleanupResize()
    canvasCleanupResize = null
  }
}

// ---------------- 主按钮 hover 弹性 + 文案 ----------------
function onMainEnter() {
  if (mainBtnRef.value) {
    gsap.fromTo(
      mainBtnRef.value,
      { scale: 1 },
      { scale: 1.06, duration: 0.4, ease: 'back.out(2)' }
    )
  }
  // 每 1.1s 切换一句 hover 文案
  let n = 0
  ctaMainText.value = ctaHoverTexts[0]
  hoverTimer = setInterval(() => {
    n = (n + 1) % ctaHoverTexts.length
    ctaMainText.value = ctaHoverTexts[n]
  }, 1100)
}
function onMainLeave() {
  if (mainBtnRef.value) {
    gsap.to(mainBtnRef.value, {
      scale: 1,
      duration: 0.3,
      ease: 'power2.out'
    })
  }
  if (hoverTimer) {
    clearInterval(hoverTimer)
    hoverTimer = null
  }
  ctaMainText.value = '立即下载'
}

// ---------------- 滚动到下载区 ----------------
function gotoDownload(e) {
  e?.preventDefault?.()
  const el = document.getElementById('download')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---------------- 生命周期 ----------------
onMounted(() => {
  // 延迟一帧启动 canvas，确保 clientWidth/Height 已确定
  nextTick(() => {
    startCanvas()
    startTypewriter()
    startSubtitle()
  })
})

onBeforeUnmount(() => {
  if (typeTimer) clearInterval(typeTimer)
  if (subTimer) clearInterval(subTimer)
  if (hoverTimer) clearInterval(hoverTimer)
  stopCanvas()
  if (mainBtnRef.value) {
    gsap.killTweensOf(mainBtnRef.value)
  }
})
</script>

<template>
  <section
    class="relative isolate overflow-hidden pt-28 pb-24 md:pt-36 md:pb-32"
  >
    <!-- ============== Canvas 字符粒子背景 ============== -->
    <canvas
      id="wpx-hero-canvas"
      class="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      aria-hidden="true"
    />
    <!-- 顶部 / 底部柔光渐变，柔化粒子边缘 -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-light/60 via-transparent to-light"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[480px] w-[860px] -translate-x-1/2 rounded-full bg-wpx-gradient opacity-15 blur-3xl"
    />

    <div class="wpx-container relative">
      <!-- 版本胶囊 -->
      <div class="flex justify-center">
        <span class="wpx-chip animate-fade-in">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-from" />
          v1.0 · 全新发布 · 完全免费
        </span>
      </div>

      <!-- ============== 大标题（打字机） ============== -->
      <h1
        class="mx-auto mt-6 max-w-4xl px-2 text-center text-[1.75rem] font-extrabold leading-[1.15] tracking-tight sm:mt-8 sm:text-4xl sm:leading-[1.1] md:text-6xl lg:text-7xl"
      >
        <span v-html="titleHtml" />
        <span
          v-if="!isTypingDone"
          class="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-1 bg-dark align-middle animate-caret sm:w-[3px] md:w-[5px]"
          aria-hidden="true"
        />
      </h1>

      <!-- ============== 副标题（轮播） ============== -->
      <div class="mt-6 flex h-8 items-center justify-center text-center md:mt-8 md:h-10">
        <span class="text-dark/50">它能帮你</span>
        <span class="ml-2 inline-block min-w-[8ch] text-left font-semibold text-primary-600">
          <transition name="sub-fade" mode="out-in">
            <span :key="subIdx" class="inline-block">
              {{ subtitleList[subIdx] }}
            </span>
          </transition>
        </span>
      </div>

      <!-- ============== 描述文案 ============== -->
      <p
        class="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-dark/70 md:text-lg"
      >
        WPX 把多窗口编辑、AI 改写、虚拟纸张与文件管理融于一体。
        <br class="hidden md:block" />
        论文、报告、随笔，从构思到定稿，一处完成。
      </p>

      <!-- ============== 按钮组 ============== -->
      <div
        class="mt-8 flex w-full flex-col items-stretch justify-center gap-3 px-2 sm:mt-10 sm:w-auto sm:flex-row sm:items-center sm:gap-5 sm:px-0"
      >
        <!-- 主按钮：渐变 + 弹性放大 + hover 文案 -->
        <a
          ref="mainBtnRef"
          href="#download"
          class="group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-wpx-gradient px-6 text-sm font-bold text-white shadow-wpx-glow transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(124,58,237,0.4),0_18px_50px_-8px_rgba(37,99,235,0.55)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 sm:h-14 sm:w-auto sm:min-w-[220px] sm:px-8 sm:text-base"
          style="transform-origin: center"
          @click="gotoDownload"
          @mouseenter="onMainEnter"
          @mouseleave="onMainLeave"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 transition-transform duration-300 group-hover:translate-y-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span class="whitespace-nowrap">{{ ctaMainText }}</span>
        </a>

        <!-- 次按钮：outline -->
        <a
          href="#showcase"
          class="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dark/10 bg-white/70 px-6 text-sm font-bold text-dark backdrop-blur transition-all duration-300 hover:border-primary-500/50 hover:bg-white hover:text-primary-600 hover:shadow-wpx sm:h-14 sm:w-auto sm:px-8 sm:text-base"
          @click.prevent="document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>在线体验</span>
        </a>
      </div>

      <!-- ============== 下载提示 ============== -->
      <p class="mt-4 text-center text-sm text-dark/50">
        <span class="inline-flex items-center gap-1.5">
          <span class="inline-block h-1.5 w-1.5 rounded-full bg-accent-mint" />
          仅 <strong class="font-semibold text-dark/70">15 MB</strong>，不占 C 盘
        </span>
      </p>

      <!-- ============== 信任标记 ============== -->
      <ul
        class="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-sm text-dark/55 md:grid-cols-4"
      >
        <li class="flex items-center justify-center gap-2">
          <span class="h-1.5 w-1.5 rounded-full bg-accent-mint" />
          完全本地化
        </li>
        <li class="flex items-center justify-center gap-2">
          <span class="h-1.5 w-1.5 rounded-full bg-accent-yellow" />
          多模型切换
        </li>
        <li class="flex items-center justify-center gap-2">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-from" />
          多窗口独立
        </li>
        <li class="flex items-center justify-center gap-2">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-to" />
          学生 / 教师技能
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* ============== 光标闪烁 ============== */
@keyframes wpxCaretBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.animate-caret {
  animation: wpxCaretBlink 0.9s steps(1) infinite;
}

/* ============== 副标题 fade 切换 ============== */
.sub-fade-enter-active,
.sub-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.sub-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.sub-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ============== fade-in 胶囊 ============== */
@keyframes wpxFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: wpxFadeIn 0.6s ease-out both;
}

/* ============== 减少动效：关闭光标闪烁 / 轮播 ============== */
@media (prefers-reduced-motion: reduce) {
  .animate-caret {
    animation: none;
    opacity: 1;
  }
}
</style>
