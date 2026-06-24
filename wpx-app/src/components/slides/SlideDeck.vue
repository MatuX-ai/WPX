<script setup>
/**
 * <SlideDeck> - 演示文稿播放器
 *
 * 用法：
 *   <SlideDeck
 *     :slides="[
 *       { component: 'CoverSlide', props: { title: 'WPX', subtitle: 'AI 文档', theme: 'light' } },
 *       { component: 'TocSlide',   props: { title: '目录', items: ['A', 'B'] } },
 *       ...
 *     ]"
 *     transition="fade"
 *     :show-thumbnails="true"
 *     thumbnail-position="bottom"
 *     theme="light"
 *   />
 *
 * 功能要点：
 * - 动态组件渲染：使用 <component :is>，组件名 → 实际组件的映射在 COMPONENT_MAP
 * - 翻页：键盘 ←/→、Home/End、舞台两侧悬浮箭头按钮
 * - 全屏：Fullscreen API，Esc 退出
 * - 缩略图导航：底部或侧边，点击跳转
 * - 动画：fade / slide 两种，使用 Vue 内置 <Transition>
 * - 响应式：基准 1920×1080，外层 ResizeObserver 监听后 transform: scale 等比缩放
 * - 主题：light / dark（仅作用于播放器 UI，不强制覆盖子幻灯片）
 */
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import CoverSlide from './CoverSlide.vue'
import TocSlide from './TocSlide.vue'
import TextSlide from './TextSlide.vue'
import ImageTextSlide from './ImageTextSlide.vue'
import ChartSlide from './ChartSlide.vue'
import TableSlide from './TableSlide.vue'
import EndSlide from './EndSlide.vue'

/* ───────── 组件名 → 实际组件映射（markRaw 避免被响应化） ───────── */
const COMPONENT_MAP = {
  CoverSlide: markRaw(CoverSlide),
  TocSlide: markRaw(TocSlide),
  TextSlide: markRaw(TextSlide),
  ImageTextSlide: markRaw(ImageTextSlide),
  ChartSlide: markRaw(ChartSlide),
  TableSlide: markRaw(TableSlide),
  EndSlide: markRaw(EndSlide),
}

const props = defineProps({
  /**
   * 幻灯片数据：
   *   [
   *     { component: 'CoverSlide', props: { title: '...', theme: 'light' } },
   *     ...
   *   ]
   */
  slides: {
    type: Array,
    required: true,
    validator: (v) =>
      Array.isArray(v) &&
      v.every(
        (s) =>
          s &&
          typeof s === 'object' &&
          typeof s.component === 'string' &&
          (s.props === undefined || typeof s.props === 'object'),
      ),
  },
  /** 初始页码（从 0 开始）。
   *  - 当未提供 currentIndex 时使用本值作为初始值
   *  - 当外部传入了 currentIndex（v-model 场景）时本值仅作为兜底
   */
  initialIndex: { type: Number, default: 0 },
  /**
   * 受控当前页码（从 0 开始）。传入后会覆盖内部状态，实现 v-model:currentIndex。
   * - 为 null/undefined 时使用内部状态（默认非受控模式）
   * - 为有效数字时进入受控模式，内部状态会被同步
   */
  currentIndex: { type: Number, default: null },
  /** 自动播放 */
  autoPlay: { type: Boolean, default: false },
  /** 自动播放间隔（毫秒） */
  interval: { type: Number, default: 5000 },
  /** 翻页动画：fade | slide */
  transition: {
    type: String,
    default: 'fade',
    validator: (v) => ['fade', 'slide'].includes(v),
  },
  /** 是否显示缩略图导航 */
  showThumbnails: { type: Boolean, default: true },
  /** 缩略图位置：bottom | side */
  thumbnailPosition: {
    type: String,
    default: 'bottom',
    validator: (v) => ['bottom', 'side'].includes(v),
  },
  /** 主题：light | dark（仅作用于播放器 UI） */
  theme: {
    type: String,
    default: 'light',
    validator: (v) => ['light', 'dark'].includes(v),
  },
})

/* ───────── 状态 ───────── */
const deckContainer = ref(null)
const stageContainer = ref(null)

const emit = defineEmits(['update:currentIndex'])

/** 是否处于受控模式（外部传入了 currentIndex） */
const isControlled = computed(
  () => props.currentIndex !== null && props.currentIndex !== undefined,
)
/** 内部当前页码（非受控模式下自管理） */
const internalIndex = ref(
  Math.min(Math.max(0, props.initialIndex), Math.max(0, props.slides.length - 1)),
)
/** 当前页码：受控模式读 props，非受控模式读内部状态 */
const currentIndex = computed(() => {
  const raw = isControlled.value ? props.currentIndex : internalIndex.value
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0
  return Math.min(Math.max(0, raw), Math.max(0, props.slides.length - 1))
})
// 翻页方向：用于 slide 动画判断从左/右滑入
const direction = ref('forward')

/* ───────── 计算属性 ───────── */
const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-deck--dark' : 'wpx-deck--light',
)

const totalPages = computed(() => props.slides.length)

const currentSlide = computed(() => {
  const slide = props.slides[currentIndex.value]
  if (!slide) return null
  const component = COMPONENT_MAP[slide.component]
  if (!component) {
    // eslint-disable-next-line no-console
    console.warn(`[SlideDeck] 未注册的组件: ${slide.component}`)
  }
  return {
    component: component || null,
    props: { ...(slide.props || {}) },
    // 渲染缩略图时使用 key
    key: currentIndex.value,
  }
})

const canPrev = computed(() => currentIndex.value > 0)
const canNext = computed(() => currentIndex.value < totalPages.value - 1)

/**
 * 动画 transition 名。
 * - fade 始终使用同一个 name
 * - slide 根据 direction 动态切换 name 以实现前进/后退方向反转
 */
const transitionName = computed(() => {
  if (props.transition === 'fade') return 'wpx-deck-anim-fade'
  return direction.value === 'forward'
    ? 'wpx-deck-anim-slide'
    : 'wpx-deck-anim-slide-backward'
})

/* ───────── 翻页控制 ───────── */
function goTo(idx) {
  if (idx < 0 || idx >= totalPages.value) return
  if (idx === currentIndex.value) return
  direction.value = idx > currentIndex.value ? 'forward' : 'backward'
  if (isControlled.value) {
    // 受控模式：只 emit，由父组件更新 props
    emit('update:currentIndex', idx)
  } else {
    // 非受控模式：更新内部状态
    internalIndex.value = idx
  }
}

function prev() {
  if (canPrev.value) goTo(currentIndex.value - 1)
}

function next() {
  if (canNext.value) goTo(currentIndex.value + 1)
}

function handleKey(e) {
  // 忽略在输入控件中的按键
  const tag = (e.target?.tagName || '').toLowerCase()
  const isEditable =
    tag === 'input' ||
    tag === 'textarea' ||
    e.target?.isContentEditable ||
    tag === 'select'
  if (isEditable) return

  if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    prev()
  } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault()
    next()
  } else if (e.key === 'Home') {
    e.preventDefault()
    goTo(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    goTo(totalPages.value - 1)
  } else if (e.key === 'Escape' && isFullscreen.value) {
    // Fullscreen 模式下 Esc 由浏览器处理
  }
}

/* ───────── 全屏 ───────── */
const isFullscreen = ref(false)

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await deckContainer.value?.requestFullscreen?.()
    } else {
      await document.exitFullscreen?.()
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SlideDeck] 全屏切换失败：', err)
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  // 全屏切换后需要重新计算缩放
  requestAnimationFrame(updateScale)
}

/* ───────── 响应式缩放（基准 1920×1080） ───────── */
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080
const scale = ref(1)
const stageSize = ref({ w: 0, h: 0 })

function updateScale() {
  if (!stageContainer.value) return
  const w = stageContainer.value.clientWidth
  const h = stageContainer.value.clientHeight
  stageSize.value = { w, h }
  if (w <= 0 || h <= 0) {
    scale.value = 1
    return
  }
  // 留 1% 间隙避免溢出
  const s = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT) * 0.98
  scale.value = s > 0 ? s : 1
}

let resizeObserver = null
let autoTimer = null

onMounted(() => {
  window.addEventListener('keydown', handleKey)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  if (stageContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateScale())
    resizeObserver.observe(stageContainer.value)
  }
  // 首次同步
  requestAnimationFrame(updateScale)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
})

/* ───────── 自动播放 ───────── */
watch(
  () => [props.autoPlay, props.interval, currentIndex.value, totalPages.value],
  () => {
    if (autoTimer) {
      clearInterval(autoTimer)
      autoTimer = null
    }
    if (!props.autoPlay || totalPages.value <= 1) return
    autoTimer = setInterval(() => {
      if (canNext.value) next()
      else goTo(0) // 回到首页循环
    }, Math.max(500, props.interval))
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (autoTimer) clearInterval(autoTimer)
})

/* ───────── 缩略图 ───────── */
const thumbnailList = computed(() =>
  props.slides.map((s, idx) => ({
    idx,
    title: s?.props?.title || `第 ${idx + 1} 页`,
    component: COMPONENT_MAP[s?.component] || null,
  })),
)

function isValidSlide(slide) {
  return Boolean(slide?.component)
}
</script>

<template>
  <div
    ref="deckContainer"
    class="wpx-deck"
    :class="[themeClass, `wpx-deck--thumb-${thumbnailPosition}`]"
    :data-theme="theme"
    role="application"
    aria-label="演示文稿播放器"
    tabindex="0"
  >
    <!-- 顶部工具栏 -->
    <div class="wpx-deck__toolbar" v-if="false">
      <!-- 占位：当前设计为浮动工具栏，避免占用舞台空间 -->
    </div>

    <!-- 主体：舞台 + 翻页按钮 -->
    <div class="wpx-deck__main">
      <!-- 左翻页按钮 -->
      <button
        type="button"
        class="wpx-deck__nav wpx-deck__nav--prev"
        :disabled="!canPrev"
        :aria-label="`上一页（${currentIndex} / ${totalPages}）`"
        @click="prev"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M15 18l-6-6 6-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <!-- 舞台（响应式缩放） -->
      <div ref="stageContainer" class="wpx-deck__stage">
        <div
          class="wpx-deck__scale"
          :style="{
            width: `${BASE_WIDTH}px`,
            height: `${BASE_HEIGHT}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }"
        >
          <Transition
            :name="transitionName"
            mode="out-in"
            :duration="{ enter: 360, leave: 280 }"
          >
            <div
              v-if="currentSlide && isValidSlide(currentSlide)"
              :key="currentSlide.key"
              class="wpx-deck__slide"
            >
              <component
                :is="currentSlide.component"
                v-bind="currentSlide.props"
              />
            </div>
            <div v-else :key="`invalid-${currentIndex}`" class="wpx-deck__invalid">
              <p>无法渲染第 {{ currentIndex + 1 }} 页：组件未注册或数据缺失</p>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 右翻页按钮 -->
      <button
        type="button"
        class="wpx-deck__nav wpx-deck__nav--next"
        :disabled="!canNext"
        :aria-label="`下一页（${currentIndex + 2} / ${totalPages}）`"
        @click="next"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M9 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <!-- 浮动控制条：页码 + 全屏 -->
    <div class="wpx-deck__controls">
      <div class="wpx-deck__page-indicator" aria-live="polite">
        <span class="wpx-deck__page-current">{{ currentIndex + 1 }}</span>
        <span class="wpx-deck__page-sep">/</span>
        <span class="wpx-deck__page-total">{{ totalPages }}</span>
      </div>

      <button
        type="button"
        class="wpx-deck__fullscreen-btn"
        :aria-label="isFullscreen ? '退出全屏' : '进入全屏'"
        @click="toggleFullscreen"
      >
        <svg
          v-if="!isFullscreen"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="wpx-deck__fullscreen-label">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </span>
      </button>
    </div>

    <!-- 缩略图导航 -->
    <nav
      v-if="showThumbnails && totalPages > 0"
      class="wpx-deck__thumbs"
      :class="`wpx-deck__thumbs--${thumbnailPosition}`"
      :aria-label="`缩略图导航，共 ${totalPages} 页`"
    >
      <button
        v-for="thumb in thumbnailList"
        :key="thumb.idx"
        type="button"
        class="wpx-deck__thumb"
        :class="{ 'wpx-deck__thumb--active': thumb.idx === currentIndex }"
        :aria-label="`跳转到第 ${thumb.idx + 1} 页：${thumb.title}`"
        :aria-current="thumb.idx === currentIndex ? 'true' : undefined"
        @click="goTo(thumb.idx)"
      >
        <div class="wpx-deck__thumb-num">{{ thumb.idx + 1 }}</div>
        <div class="wpx-deck__thumb-title">{{ thumb.title }}</div>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* ───────── 容器 ───────── */
.wpx-deck {
  --deck-bg: #0f172a;
  --deck-fg: #e2e8f0;
  --deck-fg-muted: #94a3b8;
  --deck-border: #1e293b;
  --deck-surface: #1e293b;
  --deck-accent: #7c3aed;
  --deck-accent-hover: #6d28d9;

  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--deck-bg);
  color: var(--deck-fg);
  font-family: var(--theme-font-sans, Inter, system-ui, sans-serif);
  overflow: hidden;
  user-select: none;
}

.wpx-deck--light {
  --deck-bg: #f8fafc;
  --deck-fg: #1a1a1a;
  --deck-fg-muted: #64748b;
  --deck-border: #e2e8f0;
  --deck-surface: #ffffff;
  --deck-accent: #7c3aed;
  --deck-accent-hover: #6d28d9;
}

.wpx-deck--dark {
  --deck-bg: #0f172a;
  --deck-fg: #e2e8f0;
  --deck-fg-muted: #94a3b8;
  --deck-border: #1e293b;
  --deck-surface: #1e293b;
  --deck-accent: #60a5fa;
  --deck-accent-hover: #3b82f6;
}

.wpx-deck:focus {
  outline: none;
}

/* ───────── 主体 ───────── */
.wpx-deck__main {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

/* ───────── 舞台 ───────── */
.wpx-deck__stage {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--deck-bg);
  /* 视觉装饰：背景点阵 */
  background-image:
    radial-gradient(circle at 1px 1px, var(--deck-border) 1px, transparent 0);
  background-size: 32px 32px;
}

.wpx-deck__scale {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  will-change: transform;
  /* 提示：内部的子组件都是 16:9 1920×1080 设计 */
}

.wpx-deck__slide {
  position: relative;
  width: 100%;
  height: 100%;
}

.wpx-deck__invalid {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--deck-fg-muted);
  font-size: 1.125rem;
  padding: 2rem;
  text-align: center;
}

/* ───────── 翻页按钮 ───────── */
.wpx-deck__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--deck-border);
  background: var(--deck-surface);
  color: var(--deck-fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  opacity: 0.85;
}

.wpx-deck__nav:hover:not(:disabled) {
  background: var(--deck-accent);
  color: #fff;
  border-color: var(--deck-accent);
  transform: translateY(-50%) scale(1.06);
  opacity: 1;
}

.wpx-deck__nav:active:not(:disabled) {
  transform: translateY(-50%) scale(0.96);
}

.wpx-deck__nav:focus-visible {
  outline: 2px solid var(--deck-accent);
  outline-offset: 3px;
}

.wpx-deck__nav:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.wpx-deck__nav--prev {
  left: 16px;
}

.wpx-deck__nav--next {
  right: 16px;
}

/* ───────── 浮动控制条（页码 + 全屏） ───────── */
.wpx-deck__controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem 0.5rem 0.375rem 0.875rem;
  border-radius: 999px;
  background: var(--deck-surface);
  border: 1px solid var(--deck-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.wpx-deck__page-indicator {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--deck-fg);
  line-height: 1;
}

.wpx-deck__page-current {
  font-weight: 700;
  color: var(--deck-accent);
  font-size: 0.9375rem;
}

.wpx-deck__page-sep {
  color: var(--deck-fg-muted);
  margin: 0 0.125rem;
}

.wpx-deck__page-total {
  color: var(--deck-fg-muted);
}

.wpx-deck__fullscreen-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 999px;
  background: transparent;
  border: none;
  color: var(--deck-fg);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.wpx-deck__fullscreen-btn:hover {
  background: var(--deck-accent);
  color: #fff;
}

.wpx-deck__fullscreen-btn:focus-visible {
  outline: 2px solid var(--deck-accent);
  outline-offset: 2px;
}

.wpx-deck__fullscreen-label {
  line-height: 1;
}

/* ───────── 缩略图导航 ───────── */
.wpx-deck__thumbs {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--deck-surface);
  border-top: 1px solid var(--deck-border);
  overflow-x: auto;
  scrollbar-width: thin;
}

.wpx-deck__thumbs--bottom {
  flex-direction: row;
}

.wpx-deck__thumbs--side {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 140px;
  flex-direction: column;
  border-top: none;
  border-left: 1px solid var(--deck-border);
  padding: 4.5rem 0.5rem 0.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 4;
}

.wpx-deck__thumb {
  flex-shrink: 0;
  width: 96px;
  padding: 0.375rem 0.5rem;
  background: var(--deck-bg);
  border: 1px solid var(--deck-border);
  border-radius: var(--theme-radius-sm, 6px);
  color: var(--deck-fg);
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.wpx-deck--light .wpx-deck__thumb {
  background: #ffffff;
}

.wpx-deck__thumbs--side .wpx-deck__thumb {
  width: 100%;
}

.wpx-deck__thumb:hover {
  transform: translateY(-1px);
  border-color: var(--deck-accent);
}

.wpx-deck__thumb--active {
  border-color: var(--deck-accent);
  background: var(--deck-accent);
  color: #fff;
}

.wpx-deck__thumb--active .wpx-deck__thumb-num {
  color: #fff;
}

.wpx-deck__thumb:focus-visible {
  outline: 2px solid var(--deck-accent);
  outline-offset: 2px;
}

.wpx-deck__thumb-num {
  font-size: 0.6875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--deck-accent);
  line-height: 1;
}

.wpx-deck__thumb-title {
  font-size: 0.75rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}

/* ───────── 翻页动画：fade ───────── */
.wpx-deck-anim-fade-enter-active,
.wpx-deck-anim-fade-leave-active {
  transition: opacity 0.32s ease;
}

.wpx-deck-anim-fade-enter-from,
.wpx-deck-anim-fade-leave-to {
  opacity: 0;
}

/* ───────── 翻页动画：slide ───────── */
.wpx-deck-anim-slide-enter-active,
.wpx-deck-anim-slide-leave-active {
  transition:
    transform 0.36s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.32s ease;
  will-change: transform, opacity;
}

.wpx-deck-anim-slide-enter-from {
  transform: translateX(60px);
  opacity: 0;
}

.wpx-deck-anim-slide-leave-to {
  transform: translateX(-60px);
  opacity: 0;
}

/* 反向（后退）时方向反转 */
.wpx-deck-anim-slide-leave-active {
  /* 由 v-leave 阶段的组件触发：前进时正向，后退时通过 .wpx-deck-anim-slide-backward 反转 */
}

.wpx-deck-anim-slide-backward-enter-from {
  transform: translateX(-60px);
}

.wpx-deck-anim-slide-backward-leave-to {
  transform: translateX(60px);
}

/* ───────── 响应式：缩略图在小屏自动隐藏 ───────── */
@media (max-width: 720px) {
  .wpx-deck__nav--prev { left: 6px; }
  .wpx-deck__nav--next { right: 6px; }
  .wpx-deck__nav { width: 36px; height: 36px; }
  .wpx-deck__controls { top: 8px; right: 8px; padding: 0.25rem 0.375rem 0.25rem 0.625rem; }
  .wpx-deck__fullscreen-label { display: none; }
  .wpx-deck__thumbs--side { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .wpx-deck-anim-fade-enter-active,
  .wpx-deck-anim-fade-leave-active,
  .wpx-deck-anim-slide-enter-active,
  .wpx-deck-anim-slide-leave-active {
    transition: opacity 0.16s ease;
    transform: none !important;
  }
}
</style>
