<script setup>
/**
 * <OutlineSlide> - 教学目标页（三维目标）
 *
 * Props:
 *   - title: string
 *   - objectives: Array<{ dimension, items: string[] }>
 *   - theme: 'light' | 'dark'
 *
 * 设计：左侧维度标签 + 右侧要点列表
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '教学目标' },
  objectives: {
    type: Array,
    default: () => [],
    validator: (v) =>
      Array.isArray(v) &&
      v.every((o) => o && typeof o.dimension === 'string' && Array.isArray(o.items)),
  },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

// 三维目标配色（依次：蓝/绿/橙）
const DIMENSION_COLORS = ['#1976d2', '#43a047', '#fb8c00']
function colorFor(idx) {
  return DIMENSION_COLORS[idx % DIMENSION_COLORS.length]
}
</script>

<template>
  <div
    class="wpx-slide wpx-slide--outline"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-outline__header">
      <h2 class="wpx-outline__title">{{ title }}</h2>
      <div class="wpx-outline__accent-bar" aria-hidden="true" />
    </header>

    <div class="wpx-outline__body">
      <div
        v-for="(obj, idx) in objectives"
        :key="idx"
        class="wpx-outline__row"
        :style="{ '--dim-color': colorFor(idx) }"
      >
        <div class="wpx-outline__dimension">
          <span class="wpx-outline__chip">{{ obj.dimension }}</span>
        </div>
        <ul class="wpx-outline__items">
          <li v-for="(item, i) in obj.items" :key="i" class="wpx-outline__item">
            <span class="wpx-outline__bullet" aria-hidden="true" />
            <span>{{ item }}</span>
          </li>
          <li v-if="!obj.items?.length" class="wpx-outline__placeholder">（暂无要点）</li>
        </ul>
      </div>

      <p v-if="!objectives.length" class="wpx-outline__empty">（未填写教学目标）</p>
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
  padding: 5% 6%;
  border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, 'Source Han Sans CN', Inter, system-ui, sans-serif);
}
.wpx-slide--light { background-color: #ffffff; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1e1e1e; color: #e0e0e0; }

.wpx-outline__header { margin-bottom: 1.5rem; flex-shrink: 0; }
.wpx-outline__title {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 800;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}
.wpx-outline__accent-bar {
  width: 3.5rem; height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, #1976d2, #43a047);
}

.wpx-outline__body {
  flex: 1; display: flex; flex-direction: column; gap: 1rem; overflow: hidden;
}
.wpx-outline__row {
  display: flex; gap: 1rem; align-items: flex-start;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(25, 118, 210, 0.04);
  border-left: 4px solid var(--dim-color, #1976d2);
}
.wpx-slide--dark .wpx-outline__row {
  background: rgba(255, 255, 255, 0.04);
}
.wpx-outline__dimension {
  flex-shrink: 0; min-width: 9rem; padding-top: 0.15rem;
}
.wpx-outline__chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--dim-color, #1976d2);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
}
.wpx-outline__items {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.5rem;
  flex: 1;
}
.wpx-outline__item {
  display: flex; align-items: flex-start; gap: 0.5rem;
  font-size: clamp(0.95rem, 1.6vw, 1.15rem);
  line-height: 1.55;
}
.wpx-outline__bullet {
  flex-shrink: 0; width: 0.5em; height: 0.5em;
  margin-top: 0.55em; border-radius: 50%;
  background: var(--dim-color, #1976d2);
}
.wpx-outline__placeholder {
  font-style: italic; opacity: 0.5; font-size: 0.9rem;
}
.wpx-outline__empty {
  font-style: italic; opacity: 0.5; text-align: center; margin: auto;
}
</style>