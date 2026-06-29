<script setup>
/**
 * <KeyPointsSlide> - 教学重难点
 *
 * Props:
 *   - title
 *   - keyPoints: string[]        - 重点
 *   - difficulties: string[]     - 难点
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '教学重难点' },
  keyPoints: { type: Array, default: () => [] },
  difficulties: { type: Array, default: () => [] },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--keypoints"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-keypoints__header">
      <h2 class="wpx-keypoints__title">{{ title }}</h2>
    </header>

    <div class="wpx-keypoints__grid">
      <div class="wpx-keypoints__col wpx-keypoints__col--key">
        <div class="wpx-keypoints__chip wpx-keypoints__chip--key">教学重点</div>
        <ul class="wpx-keypoints__list">
          <li v-for="(p, i) in keyPoints" :key="i" class="wpx-keypoints__item">
            <span class="wpx-keypoints__bullet" aria-hidden="true">★</span>
            <span>{{ p }}</span>
          </li>
          <li v-if="!keyPoints.length" class="wpx-keypoints__placeholder">（未填写重点）</li>
        </ul>
      </div>
      <div class="wpx-keypoints__col wpx-keypoints__col--diff">
        <div class="wpx-keypoints__chip wpx-keypoints__chip--diff">教学难点</div>
        <ul class="wpx-keypoints__list">
          <li v-for="(p, i) in difficulties" :key="i" class="wpx-keypoints__item">
            <span class="wpx-keypoints__bullet" aria-hidden="true">⚡</span>
            <span>{{ p }}</span>
          </li>
          <li v-if="!difficulties.length" class="wpx-keypoints__placeholder">（未填写难点）</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative; width: 100%; aspect-ratio: 16 / 9;
  overflow: hidden; display: flex; flex-direction: column;
  padding: 5% 6%; border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, 'Source Han Sans CN', Inter, system-ui, sans-serif);
}
.wpx-slide--light { background-color: #ffffff; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1e1e1e; color: #e0e0e0; }

.wpx-keypoints__header { margin-bottom: 1.5rem; }
.wpx-keypoints__title {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 800; margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.wpx-keypoints__grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  overflow: hidden;
}
.wpx-keypoints__col {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  overflow: hidden;
}
.wpx-keypoints__col--key { background: rgba(25, 118, 210, 0.06); }
.wpx-keypoints__col--diff { background: rgba(251, 140, 0, 0.06); }
.wpx-slide--dark .wpx-keypoints__col--key { background: rgba(25, 118, 210, 0.18); }
.wpx-slide--dark .wpx-keypoints__col--diff { background: rgba(251, 140, 0, 0.18); }

.wpx-keypoints__chip {
  display: inline-block; align-self: flex-start;
  padding: 4px 12px; border-radius: 6px;
  font-size: 0.95rem; font-weight: 600; color: #fff;
}
.wpx-keypoints__chip--key { background: #1976d2; }
.wpx-keypoints__chip--diff { background: #fb8c00; }

.wpx-keypoints__list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.6rem;
  flex: 1; overflow: hidden;
}
.wpx-keypoints__item {
  display: flex; gap: 0.5rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.6vw, 1.15rem);
  line-height: 1.5;
}
.wpx-keypoints__bullet {
  flex-shrink: 0; width: 1.2em; color: inherit; opacity: 0.9;
}
.wpx-keypoints__col--key .wpx-keypoints__bullet { color: #1976d2; }
.wpx-keypoints__col--diff .wpx-keypoints__bullet { color: #fb8c00; }
.wpx-keypoints__placeholder { font-style: italic; opacity: 0.5; font-size: 0.9rem; }
</style>