<script setup>
/**
 * <TocSlide> - 演示文稿目录页
 *
 * 用法：
 *   <TocSlide title="目录" :items="['介绍', '方法', '结果']" theme="light" />
 *
 * 设计要点：
 * - 左侧大号数字序号 + 右侧标题列表
 * - 浅色 / 深色双主题
 * - 16:9 固定宽高比
 */
import { computed } from 'vue'

const props = defineProps({
  /** 目录项标题列表 */
  items: {
    type: Array,
    required: true,
    validator: (v) => Array.isArray(v) && v.every((s) => typeof s === 'string'),
  },
  /** 页面标题 */
  title: { type: String, default: '目录' },
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

// 序号补零：1 -> "01"
function pad(n) {
  return String(n).padStart(2, '0')
}
</script>

<template>
  <div
    class="wpx-slide wpx-slide--toc"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <!-- 标题区 -->
    <header class="wpx-toc__header">
      <h2 class="wpx-toc__title">{{ title }}</h2>
      <div class="wpx-toc__accent-bar" aria-hidden="true" />
    </header>

    <!-- 目录列表：左侧序号 + 右侧标题 -->
    <ol class="wpx-toc__list">
      <li
        v-for="(item, idx) in items"
        :key="idx"
        class="wpx-toc__item"
      >
        <span class="wpx-toc__index" aria-hidden="true">{{ pad(idx + 1) }}</span>
        <span class="wpx-toc__text">{{ item }}</span>
        <span class="wpx-toc__divider" aria-hidden="true" />
      </li>
    </ol>
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

.wpx-toc__header {
  margin-bottom: 3rem;
}

.wpx-toc__title {
  font-size: clamp(2rem, 4.5vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.75rem 0;
}

.wpx-toc__accent-bar {
  width: 4rem;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
}

.wpx-slide--dark .wpx-toc__accent-bar {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.wpx-toc__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  flex: 1;
  justify-content: center;
  max-height: 65%;
}

.wpx-toc__item {
  display: flex;
  align-items: baseline;
  gap: 1.5rem;
  font-size: clamp(1.125rem, 2.2vw, 1.75rem);
  font-weight: 500;
  line-height: 1.3;
}

.wpx-toc__index {
  flex-shrink: 0;
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--theme-accent, #7c3aed);
  min-width: 2.5em;
  letter-spacing: -0.02em;
}

.wpx-slide--dark .wpx-toc__index {
  color: #60a5fa;
}

.wpx-toc__text {
  flex: 1;
  opacity: 0.92;
}

.wpx-toc__divider {
  flex: 1;
  height: 1px;
  margin-left: 0.5rem;
  background: linear-gradient(
    90deg,
    currentColor 0%,
    currentColor 60%,
    transparent 100%
  );
  opacity: 0.18;
  align-self: center;
}
</style>
