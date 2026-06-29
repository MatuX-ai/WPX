<script setup>
/**
 * <ConceptSlide> - 概念讲解页（新知讲授）
 *
 * Props:
 *   - title
 *   - definition: string
 *   - keyPoints: string[]
 *   - formula?: string         - LaTeX 公式（本期做占位渲染，V1.1 接入 KaTeX）
 *   - formulaLatex?: string    - 同上
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '新知讲授' },
  definition: { type: String, default: '' },
  keyPoints: { type: Array, default: () => [] },
  formula: { type: String, default: '' },
  formulaLatex: { type: String, default: '' },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

const hasFormula = computed(() => Boolean(props.formula || props.formulaLatex))
const displayFormula = computed(() => props.formulaLatex || props.formula)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--concept"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-concept__header">
      <span class="wpx-concept__chip">新知讲授</span>
      <h2 class="wpx-concept__title">{{ title }}</h2>
    </header>

    <div class="wpx-concept__body">
      <div v-if="definition" class="wpx-concept__definition">
        <span class="wpx-concept__label">定义</span>
        <p class="wpx-concept__text">{{ definition }}</p>
      </div>
      <p v-else class="wpx-concept__placeholder">（未填写定义）</p>

      <ul class="wpx-concept__points">
        <li v-for="(p, i) in keyPoints" :key="i" class="wpx-concept__point">
          <span class="wpx-concept__num">{{ i + 1 }}</span>
          <span>{{ p }}</span>
        </li>
        <li v-if="!keyPoints.length" class="wpx-concept__placeholder">（未填写要点）</li>
      </ul>

      <div v-if="hasFormula" class="wpx-concept__formula">
        <span class="wpx-concept__label">公式</span>
        <code class="wpx-concept__formula-text">{{ displayFormula }}</code>
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

.wpx-concept__header {
  display: flex; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem;
}
.wpx-concept__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #1976d2; color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-concept__title {
  font-size: clamp(1.625rem, 3.5vw, 2.5rem);
  font-weight: 800; margin: 0; letter-spacing: -0.02em;
}

.wpx-concept__body {
  flex: 1; display: flex; flex-direction: column; gap: 1rem;
  overflow: hidden;
}

.wpx-concept__definition {
  padding: 0.85rem 1rem;
  border-left: 4px solid #1976d2;
  background: rgba(25, 118, 210, 0.06);
  border-radius: 0 8px 8px 0;
}
.wpx-slide--dark .wpx-concept__definition { background: rgba(25, 118, 210, 0.15); }

.wpx-concept__label {
  display: inline-block;
  padding: 2px 8px; border-radius: 4px;
  background: #1976d2; color: #fff;
  font-size: 0.78rem; font-weight: 600;
  margin-right: 0.5rem;
  vertical-align: middle;
}
.wpx-concept__text { margin: 0; font-size: clamp(1rem, 1.7vw, 1.25rem); line-height: 1.6; display: inline; }

.wpx-concept__points {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.6rem;
  flex: 1; overflow: hidden;
}
.wpx-concept__point {
  display: flex; gap: 0.6rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.6vw, 1.15rem); line-height: 1.55;
}
.wpx-concept__num {
  flex-shrink: 0; width: 1.7em; height: 1.7em;
  border-radius: 50%; background: #1976d2; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.95em;
}
.wpx-concept__placeholder { font-style: italic; opacity: 0.55; font-size: 0.9rem; margin: 0; }

.wpx-concept__formula {
  padding: 0.75rem 1rem;
  background: #fff8e1;
  border-radius: 8px;
  border: 1px dashed #ffb300;
}
.wpx-slide--dark .wpx-concept__formula { background: rgba(255, 179, 0, 0.12); }
.wpx-concept__formula-text {
  font-family: 'Cambria Math', 'Times New Roman', serif;
  font-size: clamp(1rem, 1.8vw, 1.3rem);
  font-style: italic;
  color: #b26500;
}
.wpx-slide--dark .wpx-concept__formula-text { color: #ffb300; }
</style>