<script setup>
/**
 * <HomeworkSlide> - 作业布置页
 *
 * Props:
 *   - title
 *   - tasks: Array<{ type: '必做'|'选做'|'实践', description, source? }>
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '作业布置' },
  tasks: {
    type: Array,
    default: () => [],
    validator: (v) =>
      Array.isArray(v) &&
      v.every((t) => t && typeof t.description === 'string'),
  },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

const groupedTasks = computed(() => {
  const groups = { 必做: [], 选做: [], 实践: [] }
  for (const t of props.tasks) {
    const k = t.type || '必做'
    if (!groups[k]) groups[k] = []
    groups[k].push(t)
  }
  return groups
})

const typeColors = {
  必做: { bg: '#1976d2', light: 'rgba(25, 118, 210, 0.08)' },
  选做: { bg: '#43a047', light: 'rgba(67, 160, 71, 0.08)' },
  实践: { bg: '#fb8c00', light: 'rgba(251, 140, 0, 0.08)' },
}
</script>

<template>
  <div
    class="wpx-slide wpx-slide--homework"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-homework__header">
      <span class="wpx-homework__chip">作业</span>
      <h2 class="wpx-homework__title">{{ title }}</h2>
    </header>

    <div class="wpx-homework__body">
      <div
        v-for="(group, key) in groupedTasks"
        :key="key"
        v-show="group.length"
        class="wpx-homework__group"
        :style="{ '--group-bg': typeColors[key]?.bg || '#666', '--group-light': typeColors[key]?.light || 'rgba(0,0,0,0.05)' }"
      >
        <div class="wpx-homework__group-head">
          <span class="wpx-homework__group-chip">{{ key }}</span>
          <span class="wpx-homework__group-count">共 {{ group.length }} 项</span>
        </div>
        <ul class="wpx-homework__list">
          <li v-for="(t, i) in group" :key="i" class="wpx-homework__item">
            <span class="wpx-homework__num">{{ i + 1 }}.</span>
            <div class="wpx-homework__item-body">
              <p class="wpx-homework__desc">{{ t.description }}</p>
              <span v-if="t.source" class="wpx-homework__source">来源：{{ t.source }}</span>
            </div>
          </li>
        </ul>
      </div>

      <p v-if="!tasks.length" class="wpx-homework__placeholder">（暂无作业）</p>
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative; width: 100%; aspect-ratio: 16 / 9;
  overflow: hidden; display: flex; flex-direction: column;
  padding: 4% 5%; border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, 'Source Han Sans CN', Inter, system-ui, sans-serif);
}
.wpx-slide--light { background-color: #fffaf0; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1e1e1e; color: #e0e0e0; }

.wpx-homework__header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
.wpx-homework__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #7b1fa2; color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-homework__title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800; margin: 0;
}

.wpx-homework__body {
  flex: 1; display: flex; flex-direction: column; gap: 0.85rem;
  overflow: hidden;
}

.wpx-homework__group {
  padding: 0.7rem 0.95rem;
  border-radius: 8px;
  background: var(--group-light, rgba(0,0,0,0.05));
  border-left: 4px solid var(--group-bg, #666);
  display: flex; flex-direction: column; gap: 0.4rem;
}

.wpx-homework__group-head {
  display: flex; align-items: center; gap: 0.5rem;
}
.wpx-homework__group-chip {
  padding: 3px 10px; border-radius: 4px;
  background: var(--group-bg, #666); color: #fff;
  font-size: 0.85rem; font-weight: 600;
}
.wpx-homework__group-count { font-size: 0.85rem; opacity: 0.65; }

.wpx-homework__list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.45rem;
}
.wpx-homework__item {
  display: flex; gap: 0.5rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.5vw, 1.1rem); line-height: 1.5;
}
.wpx-homework__num {
  flex-shrink: 0; font-weight: 700; color: var(--group-bg, #666);
  min-width: 1.5em;
}
.wpx-homework__desc { margin: 0; }
.wpx-homework__source {
  display: inline-block; margin-top: 0.25rem;
  font-size: 0.78rem; opacity: 0.6;
  font-style: italic;
}
.wpx-homework__placeholder { font-style: italic; opacity: 0.55; text-align: center; margin: auto; }
</style>