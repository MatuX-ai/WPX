<script setup>
/**
 * <ReflectionSlide> - 教学反思页
 *
 * Props:
 *   - title
 *   - highlights: string[]    - 亮点
 *   - improvements: string[]   - 待改进
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '教学反思' },
  highlights: { type: Array, default: () => [] },
  improvements: { type: Array, default: () => [] },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--reflection"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-reflection__header">
      <span class="wpx-reflection__chip">反思</span>
      <h2 class="wpx-reflection__title">{{ title }}</h2>
    </header>

    <div class="wpx-reflection__grid">
      <div class="wpx-reflection__col wpx-reflection__col--high">
        <div class="wpx-reflection__col-head">
          <span class="wpx-reflection__icon">✨</span>
          教学亮点
        </div>
        <ul class="wpx-reflection__list">
          <li v-for="(p, i) in highlights" :key="i" class="wpx-reflection__item">
            <span class="wpx-reflection__bullet" aria-hidden="true">+</span>
            <span>{{ p }}</span>
          </li>
          <li v-if="!highlights.length" class="wpx-reflection__placeholder">（待补充）</li>
        </ul>
      </div>
      <div class="wpx-reflection__col wpx-reflection__col--imp">
        <div class="wpx-reflection__col-head">
          <span class="wpx-reflection__icon">🔧</span>
          待改进
        </div>
        <ul class="wpx-reflection__list">
          <li v-for="(p, i) in improvements" :key="i" class="wpx-reflection__item">
            <span class="wpx-reflection__bullet" aria-hidden="true">→</span>
            <span>{{ p }}</span>
          </li>
          <li v-if="!improvements.length" class="wpx-reflection__placeholder">（待补充）</li>
        </ul>
      </div>
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
.wpx-slide--light { background-color: #fafbff; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1a2233; color: #e0e0e0; }

.wpx-reflection__header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.wpx-reflection__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #7b1fa2; color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-reflection__title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800; margin: 0;
}

.wpx-reflection__grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  overflow: hidden;
}

.wpx-reflection__col {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  overflow: hidden;
}
.wpx-reflection__col--high { background: rgba(67, 160, 71, 0.08); border-left: 4px solid #43a047; }
.wpx-reflection__col--imp { background: rgba(251, 140, 0, 0.08); border-left: 4px solid #fb8c00; }
.wpx-slide--dark .wpx-reflection__col--high { background: rgba(67, 160, 71, 0.15); }
.wpx-slide--dark .wpx-reflection__col--imp { background: rgba(251, 140, 0, 0.15); }

.wpx-reflection__col-head {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 1rem; font-weight: 700;
}
.wpx-reflection__col--high .wpx-reflection__col-head { color: #43a047; }
.wpx-reflection__col--imp .wpx-reflection__col-head { color: #fb8c00; }
.wpx-reflection__icon { font-size: 1.2rem; }

.wpx-reflection__list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.55rem;
  flex: 1; overflow: hidden;
}
.wpx-reflection__item {
  display: flex; gap: 0.5rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.6vw, 1.1rem); line-height: 1.5;
}
.wpx-reflection__bullet {
  flex-shrink: 0; font-weight: 800;
}
.wpx-reflection__col--high .wpx-reflection__bullet { color: #43a047; }
.wpx-reflection__col--imp .wpx-reflection__bullet { color: #fb8c00; }
.wpx-reflection__placeholder { font-style: italic; opacity: 0.5; font-size: 0.9rem; }
</style>