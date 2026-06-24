<script setup>
/**
 * <TextSlide> - 演示文稿纯文字页
 *
 * 用法：
 *   <!-- 列表布局 -->
 *   <TextSlide
 *     title="核心要点"
 *     :bullet-points="['要点 1', '要点 2', '要点 3']"
 *     layout="list"
 *     theme="light"
 *   />
 *
 *   <!-- 段落布局 -->
 *   <TextSlide title="概述" text="..." layout="paragraph" theme="light" />
 *
 * 说明：
 * - 列表布局（layout='list'）使用 bulletPoints 渲染有序/无序要点
 * - 段落布局（layout='paragraph'）使用 bulletPoints 数组的每个元素作为一段；
 *   兼容老 API：若未传 bulletPoints，可传 text 字符串
 * - 16:9 固定宽高比，浅色 / 深色双主题
 */
import { computed } from 'vue'

const props = defineProps({
  /** 页面标题 */
  title: { type: String, required: true },
  /**
   * 要点列表。
   * - layout='list' 时：渲染为项目符号列表
   * - layout='paragraph' 时：每个元素作为一段（每段独立显示）
   */
  bulletPoints: {
    type: Array,
    default: () => [],
    validator: (v) => Array.isArray(v) && v.every((s) => typeof s === 'string'),
  },
  /**
   * 兼容旧用法的单段文本。
   * - 当 bulletPoints 为空且传了 text 时，layout='paragraph' 会渲染该文本
   */
  text: { type: String, default: '' },
  /** 布局：list | paragraph */
  layout: {
    type: String,
    default: 'list',
    validator: (v) => ['list', 'paragraph'].includes(v),
  },
  /** 主题：light | dark */
  theme: {
    type: String,
    default: 'light',
    validator: (v) => ['light', 'dark'].includes(v),
  },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

// 段落模式下，bulletPoints 优先；为空时回退到 text
const paragraphs = computed(() => {
  if (props.bulletPoints && props.bulletPoints.length > 0) {
    return props.bulletPoints
  }
  return props.text ? [props.text] : []
})
</script>

<template>
  <div
    class="wpx-slide wpx-slide--text"
    :class="[themeClass, `wpx-slide--layout-${layout}`]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-text__header">
      <h2 class="wpx-text__title">{{ title }}</h2>
      <div class="wpx-text__accent-bar" aria-hidden="true" />
    </header>

    <div class="wpx-text__body">
      <!-- 列表布局 -->
      <ul v-if="layout === 'list'" class="wpx-text__list">
        <li
          v-for="(point, idx) in bulletPoints"
          :key="idx"
          class="wpx-text__list-item"
        >
          <span class="wpx-text__bullet" aria-hidden="true" />
          <span class="wpx-text__list-text">{{ point }}</span>
        </li>
      </ul>

      <!-- 段落布局 -->
      <div v-else class="wpx-text__paragraphs">
        <p
          v-for="(p, idx) in paragraphs"
          :key="idx"
          class="wpx-text__paragraph"
        >
          {{ p }}
        </p>
        <p v-if="paragraphs.length === 0" class="wpx-text__placeholder">
          （暂无内容）
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 6% 8%;
  border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, Inter, system-ui, sans-serif);
}

.wpx-slide--light {
  background-color: #ffffff;
  color: #1a1a1a;
}

.wpx-slide--dark {
  background-color: #1e1e1e;
  color: #e0e0e0;
}

.wpx-text__header {
  margin-bottom: 2.5rem;
  flex-shrink: 0;
}

.wpx-text__title {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.75rem 0;
  line-height: 1.15;
}

.wpx-text__accent-bar {
  width: 3.5rem;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
}

.wpx-slide--dark .wpx-text__accent-bar {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.wpx-text__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}

/* 列表样式 */
.wpx-text__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem 1.25rem;
  max-height: 100%;
  overflow: hidden;
}

.wpx-text__list-item {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  font-size: clamp(1rem, 1.8vw, 1.375rem);
  line-height: 1.55;
}

.wpx-text__bullet {
  flex-shrink: 0;
  width: 0.5em;
  height: 0.5em;
  margin-top: 0.55em;
  border-radius: 50%;
  background: var(--theme-accent, #7c3aed);
}

.wpx-slide--dark .wpx-text__bullet {
  background: #60a5fa;
}

.wpx-text__list-text {
  flex: 1;
  word-break: break-word;
}

/* 段落样式 */
.wpx-text__paragraphs {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: 100%;
  overflow: hidden;
}

.wpx-text__paragraph {
  font-size: clamp(1rem, 1.8vw, 1.375rem);
  line-height: 1.7;
  margin: 0;
  text-align: justify;
  text-indent: 2em;
}

.wpx-text__placeholder {
  font-size: 0.95rem;
  opacity: 0.5;
  font-style: italic;
  margin: 0;
}
</style>
