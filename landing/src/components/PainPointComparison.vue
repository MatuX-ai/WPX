<script setup>
/**
 * PainPointComparison.vue
 * ------------------------------------------------------------
 * WPX 营销站 · WPS vs WPX 对比组件
 *
 *  - 左右两栏对比：WPS（灰红痛苦） / WPX（蓝紫解放）
 *  - 中间可拖动滑块（鼠标 + 触摸）
 *  - 撕纸锯齿过渡：左右 clip-path 互锁
 *  - 初始滑块 50%
 *  - 触摸/键盘也可操作
 * ------------------------------------------------------------
 */
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'

// ---------------- 状态 ----------------
const containerRef = ref(null)
const splitPos = ref(50) // 0-100，初始居中
const dragging = ref(false)
const isMobile = ref(false) // 移动端：上下堆叠，不用滑块

let mqMobile = null
function syncIsMobile(e) {
  isMobile.value = !!e?.matches
}

onMounted(() => {
  if (typeof window === 'undefined') return
  mqMobile = window.matchMedia('(max-width: 767px)')
  syncIsMobile(mqMobile)
  // 兼容旧 API
  if (mqMobile.addEventListener) {
    mqMobile.addEventListener('change', syncIsMobile)
  } else if (mqMobile.addListener) {
    mqMobile.addListener(syncIsMobile)
  }
})
onBeforeUnmount(() => {
  if (!mqMobile) return
  if (mqMobile.removeEventListener) {
    mqMobile.removeEventListener('change', syncIsMobile)
  } else if (mqMobile.removeListener) {
    mqMobile.removeListener(syncIsMobile)
  }
})

// 撕纸锯齿参数
const TEETH = 18       // 锯齿数量
const AMP = 1.4        // 锯齿幅度（百分比）

// ---------------- 撕纸 clip-path 生成 ----------------
function buildLeftClip(percent) {
  // 左层（WPS）显示 [0, percent] 区域，右边界是锯齿
  const pts = ['0% 0%', `${percent}% 0%`]
  for (let i = 0; i <= TEETH; i++) {
    const y = (i / TEETH) * 100
    const x = i % 2 === 0 ? percent : percent + AMP
    pts.push(`${x}% ${y}%`)
  }
  pts.push('0% 100%')
  return `polygon(${pts.join(', ')})`
}

function buildRightClip(percent) {
  // 右层（WPX）显示 [percent, 100] 区域，左边界是锯齿（与左层互锁）
  const pts = ['100% 0%', `${percent}% 0%`]
  for (let i = 0; i <= TEETH; i++) {
    const y = (i / TEETH) * 100
    const x = i % 2 === 0 ? percent : percent - AMP
    pts.push(`${x}% ${y}%`)
  }
  pts.push('100% 100%')
  return `polygon(${pts.join(', ')})`
}

const leftClipPath = computed(() => buildLeftClip(splitPos.value))
const rightClipPath = computed(() => buildRightClip(splitPos.value))

// ---------------- 拖动逻辑 ----------------
function getPercentFromEvent(clientX) {
  const el = containerRef.value
  if (!el) return splitPos.value
  const rect = el.getBoundingClientRect()
  const ratio = ((clientX - rect.left) / rect.width) * 100
  return Math.max(2, Math.min(98, ratio))
}

function onPointerDown(e) {
  dragging.value = true
  e.preventDefault()
  // 鼠标按下时立即更新
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  splitPos.value = getPercentFromEvent(clientX)
  // 锁定 body 选中
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ew-resize'
}

function onPointerMove(e) {
  if (!dragging.value) return
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  splitPos.value = getPercentFromEvent(clientX)
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

function onKeydown(e) {
  // 滑块获得焦点时按左右键调整
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    splitPos.value = Math.max(2, splitPos.value - 2)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    splitPos.value = Math.min(98, splitPos.value + 2)
  }
}

// 全局监听：在拖动期间也响应 mousemove（即使鼠标移出 handle）
function attachGlobalListeners() {
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
  document.addEventListener('touchmove', onPointerMove, { passive: false })
  document.addEventListener('touchend', onPointerUp)
}
function detachGlobalListeners() {
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
  document.removeEventListener('touchmove', onPointerMove)
  document.removeEventListener('touchend', onPointerUp)
}

// ---------------- 数据 ----------------
const wpsPoints = [
  { icon: '💸', text: 'PDF 转 Word 要会员', sub: '￥199/年 · 解锁更多功能' },
  { icon: '🛒', text: '模板要钱', sub: '好看的都要付费' },
  { icon: '🐘', text: '安装包 800MB+', sub: 'C 盘越来越小' }
]
const wpxPoints = [
  { icon: '🆓', text: 'PDF 转 Word 免费', sub: '一键本地转换' },
  { icon: '✨', text: 'AI 一键生成模板', sub: '说出需求即可' },
  { icon: '🪶', text: '安装包 15MB', sub: '不占 C 盘' }
]
</script>

<template>
  <section class="wpx-section">
    <div class="wpx-container">
      <!-- 标题 -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">真实痛点</span>
        <h2 class="mt-4 text-[1.6rem] font-extrabold leading-tight sm:text-3xl md:text-5xl">
          <span class="wpx-gradient-text">如果你也经历过这些，WPX 是为你准备的。</span>
        </h2>
        <p class="mt-4 text-sm text-dark/60 md:text-base">
          {{ isMobile ? '下方是 WPS 和 WPX 的对比，惨烈 ↔ 开心。' : '拖动中间的滑块，看看 WPX 是怎么解决这些痛苦的。' }}
        </p>
      </div>

      <!-- =========== 移动端：上下堆叠布局 =========== -->
      <div v-if="isMobile" class="mt-8 space-y-4">
        <!-- WPS 卡片 -->
        <div class="rounded-2xl border border-rose-200/60 bg-stone-50 p-5 shadow-sm">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-300 text-sm text-stone-700">W</span>
            <span class="text-sm font-bold text-stone-700">WPS · 痛苦</span>
            <span class="ml-auto text-[10px] text-rose-500">年度会员 ¥199</span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="p in wpsPoints"
              :key="p.text"
              class="flex items-start gap-2 rounded-lg bg-white/70 p-2.5 text-sm"
            >
              <span class="text-lg leading-none">{{ p.icon }}</span>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-stone-700">{{ p.text }}</div>
                <div class="text-[11px] text-stone-500">{{ p.sub }}</div>
              </div>
            </li>
          </ul>
        </div>
        <!-- WPX 卡片 -->
        <div class="rounded-2xl border border-primary-500/20 bg-wpx-gradient-soft/50 p-5 shadow-wpx">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-wpx-gradient text-sm font-extrabold text-white shadow-wpx">W</span>
            <span class="text-sm font-bold text-primary-700">WPX · 解放</span>
            <span class="ml-auto text-[10px] text-emerald-600">免费</span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="p in wpxPoints"
              :key="p.text"
              class="flex items-start gap-2 rounded-lg bg-white p-2.5 text-sm"
            >
              <span class="text-lg leading-none">{{ p.icon }}</span>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-dark">{{ p.text }}</div>
                <div class="text-[11px] text-dark/55">{{ p.sub }}</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- =========== 桌面端：撕纸滑块对比 =========== -->
      <div
        v-else
        ref="containerRef"
        class="comparison-container relative mt-14 h-[480px] w-full select-none overflow-hidden rounded-3xl border border-dark/5 bg-white shadow-wpx md:h-[520px]"
        :class="{ 'is-dragging': dragging }"
        @mousedown="onPointerDown"
        @touchstart.passive="onPointerDown"
      >
        <!-- ============== 左层：WPS（灰红痛苦） ============== -->
        <div
          class="panel absolute inset-0 transition-[clip-path] duration-75 ease-out"
          :style="{ clipPath: leftClipPath }"
        >
          <div class="wps-bg h-full w-full p-8 md:p-12">
            <div class="flex items-center gap-3">
              <span
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-300 text-lg text-stone-700"
              >W</span>
              <div>
                <div class="text-xs uppercase tracking-wider text-stone-500">WPS 用户</div>
                <div class="text-lg font-bold text-stone-700">付费 · 弹窗 · 卡顿</div>
              </div>
            </div>

            <h3 class="mt-8 text-2xl font-extrabold text-stone-700 md:text-3xl">
              每打开一次，都在想：
              <br />
              <span class="text-rose-600">「又要付费？」</span>
            </h3>

            <ul class="mt-8 space-y-4">
              <li
                v-for="(p, idx) in wpsPoints"
                :key="idx"
                class="flex items-start gap-3 rounded-xl border border-rose-200/60 bg-white/60 p-4 backdrop-blur"
              >
                <span class="text-2xl">{{ p.icon }}</span>
                <div>
                  <div class="text-base font-semibold text-stone-800">{{ p.text }}</div>
                  <div class="text-sm text-stone-500">{{ p.sub }}</div>
                </div>
              </li>
            </ul>

            <!-- 广告弹窗模拟 -->
            <div
              class="ad-popup absolute right-6 top-6 w-56 rounded-xl border-2 border-rose-300 bg-white p-3 text-xs shadow-lg md:right-10 md:top-10 md:w-64"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">VIP 弹窗</span>
                <span class="text-stone-400">×</span>
              </div>
              <div class="space-y-1.5">
                <div class="h-2 w-full rounded bg-stone-200" />
                <div class="h-2 w-3/4 rounded bg-stone-200" />
                <div class="h-2 w-2/3 rounded bg-rose-200" />
              </div>
              <button
                class="mt-3 w-full rounded-md bg-rose-500 py-1.5 text-xs font-bold text-white"
              >
                立即开通会员
              </button>
            </div>

            <!-- 角落标签 -->
            <div class="absolute bottom-6 left-8 md:bottom-10 md:left-12">
              <div class="text-xs text-stone-500">对比组</div>
              <div class="text-sm font-semibold text-rose-600">痛苦 100%</div>
            </div>
          </div>
        </div>

        <!-- ============== 右层：WPX（蓝紫解放） ============== -->
        <div
          class="panel absolute inset-0 transition-[clip-path] duration-75 ease-out"
          :style="{ clipPath: rightClipPath }"
        >
          <div class="wpx-bg h-full w-full p-8 md:p-12">
            <div class="flex items-center gap-3">
              <span
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-wpx-gradient text-lg font-extrabold text-white shadow-wpx"
              >W</span>
              <div>
                <div class="text-xs uppercase tracking-wider text-primary-600">WPX 用户</div>
                <div class="text-lg font-bold text-dark">免费 · 纯净 · 流畅</div>
              </div>
            </div>

            <h3 class="mt-8 text-2xl font-extrabold text-dark md:text-3xl">
              打开就是：
              <br />
              <span class="wpx-gradient-text">「够用、真免费」</span>
            </h3>

            <ul class="mt-8 space-y-4">
              <li
                v-for="(p, idx) in wpxPoints"
                :key="idx"
                class="flex items-start gap-3 rounded-xl border border-primary-500/20 bg-white/80 p-4 shadow-sm backdrop-blur"
              >
                <span class="text-2xl">{{ p.icon }}</span>
                <div>
                  <div class="text-base font-semibold text-dark">{{ p.text }}</div>
                  <div class="text-sm text-primary-600/80">{{ p.sub }}</div>
                </div>
              </li>
            </ul>

            <!-- 编辑器界面模拟 -->
            <div
              class="editor-mock absolute bottom-6 right-6 hidden w-72 rounded-xl border border-primary-500/20 bg-white p-3 shadow-wpx md:block"
            >
              <div class="mb-2 flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span class="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span class="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span class="ml-2 text-[10px] text-dark/40">论文 · 第一章</span>
              </div>
              <div class="space-y-1.5">
                <div class="h-2 w-4/5 rounded bg-dark/10" />
                <div class="h-2 w-11/12 rounded bg-dark/10" />
                <div class="h-2 w-3/4 rounded bg-dark/10" />
                <div class="mt-2 rounded-md bg-wpx-gradient-soft p-2 text-[10px] font-semibold text-primary-600">
                  ✨ AI 帮你续写
                </div>
              </div>
            </div>

            <!-- 角落标签 -->
            <div class="absolute bottom-6 right-6 md:bottom-10 md:right-12 md:hidden">
              <div class="text-xs text-primary-600/80">对比组</div>
              <div class="text-sm font-semibold text-primary-600">解放 100%</div>
            </div>
            <div class="absolute bottom-6 right-6 hidden md:bottom-10 md:right-12 md:block">
              <!-- 移动端标签由 wpx-bg 自身处理 -->
            </div>
          </div>
        </div>

        <!-- ============== 滑块分隔线 + 把手 ============== -->
        <div
          class="slider pointer-events-none absolute inset-y-0 z-20"
          :style="{ left: splitPos + '%' }"
        >
          <!-- 垂直线 -->
          <div
            class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(124,58,237,0.25)]"
          />
          <!-- 把手（可点击） -->
          <button
            class="pointer-events-auto absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-wpx-gradient text-white shadow-wpx-glow transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            :class="dragging ? 'cursor-grabbing scale-110' : 'cursor-grab'"
            tabindex="0"
            aria-label="拖动对比滑块"
            role="slider"
            :aria-valuenow="Math.round(splitPos)"
            aria-valuemin="0"
            aria-valuemax="100"
            @keydown="onKeydown"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
            </svg>
          </button>
        </div>

        <!-- ============== 拖动提示（自动消失） ============== -->
        <div
          v-if="splitPos === 50"
          class="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-dark/80 px-3 py-1 text-xs text-white backdrop-blur"
        >
          ← 拖动滑块对比 →
        </div>
      </div>

      <!-- ============== 底部说明 ============== -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-dark/60">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-rose-500" />
          WPS：年付费 ¥199 起
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-primary-from" />
          WPX：永久免费
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-accent-mint" />
          无广告 · 无追踪
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ============== WPS 背景（灰红痛苦） ============== */
.wps-bg {
  background:
    radial-gradient(circle at 80% 20%, rgba(244, 63, 94, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 20% 80%, rgba(120, 113, 108, 0.10) 0%, transparent 50%),
    linear-gradient(135deg, #fafaf9 0%, #f5f5f4 50%, #e7e5e4 100%);
  position: relative;
}
.wps-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg, transparent 0, transparent 14px, rgba(120, 113, 108, 0.04) 14px, rgba(120, 113, 108, 0.04) 28px);
  pointer-events: none;
}

/* ============== WPX 背景（蓝紫解放） ============== */
.wpx-bg {
  background:
    radial-gradient(circle at 80% 20%, rgba(124, 58, 237, 0.10) 0%, transparent 50%),
    radial-gradient(circle at 20% 80%, rgba(37, 99, 235, 0.10) 0%, transparent 50%),
    linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%);
  position: relative;
}
.wpx-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(124, 58, 237, 0.08) 1px, transparent 0);
  background-size: 24px 24px;
  pointer-events: none;
}

/* ============== 容器交互态 ============== */
.comparison-container {
  cursor: ew-resize;
  touch-action: pan-y;
}
.comparison-container.is-dragging {
  cursor: grabbing;
}
.comparison-container.is-dragging .panel {
  transition: none;
}

/* ============== 广告弹窗入场（仅 WPS 层） ============== */
@keyframes wpxAdWiggle {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}
.ad-popup {
  animation: wpxAdWiggle 1.2s ease-in-out infinite;
  transform-origin: top right;
}

/* ============== 减少动效 ============== */
@media (prefers-reduced-motion: reduce) {
  .ad-popup {
    animation: none;
  }
  .panel {
    transition: none !important;
  }
}
</style>
