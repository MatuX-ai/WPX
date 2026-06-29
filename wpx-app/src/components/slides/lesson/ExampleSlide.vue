<script setup>
/**
 * <ExampleSlide> - 例题讲解页
 *
 * Props:
 *   - title
 *   - problem: string          - 题干
 *   - solution: string[]       - 解答步骤
 *   - analysis?: string        - 思路分析
 *   - tips?: string            - 解题提示
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '例题讲解' },
  problem: { type: String, default: '' },
  solution: { type: Array, default: () => [] },
  analysis: { type: String, default: '' },
  tips: { type: String, default: '' },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--example"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-example__header">
      <span class="wpx-example__chip">例题</span>
      <h2 class="wpx-example__title">{{ title }}</h2>
    </header>

    <div class="wpx-example__body">
      <div class="wpx-example__col wpx-example__col--problem">
        <div class="wpx-example__col-header">题目</div>
        <p v-if="problem" class="wpx-example__problem">{{ problem }}</p>
        <p v-else class="wpx-example__placeholder">（未填写题目）</p>

        <div v-if="analysis" class="wpx-example__analysis">
          <div class="wpx-example__sub-label">思路分析</div>
          <p>{{ analysis }}</p>
        </div>
        <div v-if="tips" class="wpx-example__tips">
          <div class="wpx-example__sub-label">解题提示</div>
          <p>{{ tips }}</p>
        </div>
      </div>

      <div class="wpx-example__col wpx-example__col--solution">
        <div class="wpx-example__col-header">解答</div>
        <ol class="wpx-example__solution">
          <li v-for="(s, i) in solution" :key="i" class="wpx-example__step">
            <span class="wpx-example__step-num">{{ i + 1 }}.</span>
            <span>{{ s }}</span>
          </li>
          <li v-if="!solution.length" class="wpx-example__placeholder">（未填写解答步骤）</li>
        </ol>
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
.wpx-slide--light { background-color: #ffffff; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1e1e1e; color: #e0e0e0; }

.wpx-example__header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
.wpx-example__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #43a047; color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-example__title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800; margin: 0;
}

.wpx-example__body {
  flex: 1; display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  overflow: hidden;
}

.wpx-example__col {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  overflow: hidden;
}
.wpx-example__col--problem { background: rgba(67, 160, 71, 0.05); border-left: 4px solid #43a047; }
.wpx-example__col--solution { background: rgba(25, 118, 210, 0.05); border-left: 4px solid #1976d2; }
.wpx-slide--dark .wpx-example__col--problem { background: rgba(67, 160, 71, 0.15); }
.wpx-slide--dark .wpx-example__col--solution { background: rgba(25, 118, 210, 0.15); }

.wpx-example__col-header {
  font-size: 0.95rem; font-weight: 700;
  color: #43a047;
}
.wpx-example__col--solution .wpx-example__col-header { color: #1976d2; }

.wpx-example__problem {
  margin: 0;
  font-size: clamp(0.95rem, 1.6vw, 1.15rem);
  line-height: 1.6;
  font-weight: 500;
}
.wpx-example__placeholder { font-style: italic; opacity: 0.55; font-size: 0.9rem; margin: 0; }

.wpx-example__analysis, .wpx-example__tips {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem; line-height: 1.5;
}
.wpx-slide--dark .wpx-example__analysis,
.wpx-slide--dark .wpx-example__tips { background: rgba(255, 255, 255, 0.06); }
.wpx-example__analysis p, .wpx-example__tips p { margin: 0.25rem 0 0 0; }
.wpx-example__sub-label {
  font-size: 0.78rem; font-weight: 600;
  color: #fb8c00; letter-spacing: 0.02em;
}

.wpx-example__solution {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.6rem;
  flex: 1; overflow: hidden;
}
.wpx-example__step {
  display: flex; gap: 0.5rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.6vw, 1.15rem); line-height: 1.55;
}
.wpx-example__step-num {
  flex-shrink: 0; font-weight: 700; color: #1976d2;
  min-width: 1.5em;
}
</style>