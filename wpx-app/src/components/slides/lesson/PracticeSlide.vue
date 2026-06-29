<script setup>
/**
 * <PracticeSlide> - 课堂练习页
 *
 * Props:
 *   - title
 *   - questions: Array<{ stem, type, options?, difficulty }>
 *   - answerVisible?: boolean   - 是否显示答案（默认 false）
 *   - theme
 */
import { computed, ref } from 'vue'

const props = defineProps({
  title: { type: String, default: '课堂练习' },
  questions: {
    type: Array,
    default: () => [],
    validator: (v) =>
      Array.isArray(v) &&
      v.every((q) => q && typeof q.stem === 'string'),
  },
  answerVisible: { type: Boolean, default: false },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

const showAnswer = ref(props.answerVisible)

function difficultyStars(level) {
  const n = Math.max(0, Math.min(3, Number(level) || 1))
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}
</script>

<template>
  <div
    class="wpx-slide wpx-slide--practice"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-practice__header">
      <span class="wpx-practice__chip">练习</span>
      <h2 class="wpx-practice__title">{{ title }}</h2>
      <button
        type="button"
        class="wpx-practice__toggle"
        :aria-pressed="showAnswer"
        @click="showAnswer = !showAnswer"
      >
        {{ showAnswer ? '隐藏答案' : '显示答案' }}
      </button>
    </header>

    <div class="wpx-practice__body">
      <ol class="wpx-practice__list">
        <li v-for="(q, i) in questions" :key="i" class="wpx-practice__item">
          <div class="wpx-practice__item-head">
            <span class="wpx-practice__num">{{ i + 1 }}.</span>
            <span class="wpx-practice__type">{{ q.type || '解答题' }}</span>
            <span class="wpx-practice__diff" :title="`难度 ${q.difficulty || 1}/3`">
              {{ difficultyStars(q.difficulty) }}
            </span>
          </div>
          <p class="wpx-practice__stem">{{ q.stem }}</p>
          <ul v-if="q.options?.length" class="wpx-practice__options">
            <li v-for="(opt, oi) in q.options" :key="oi" class="wpx-practice__option">
              <span class="wpx-practice__opt-label">{{ String.fromCharCode(65 + oi) }}.</span>
              <span>{{ opt }}</span>
            </li>
          </ul>
          <p v-if="showAnswer && q.answer" class="wpx-practice__answer">
            <strong>答案：</strong>{{ q.answer }}
          </p>
        </li>
        <li v-if="!questions.length" class="wpx-practice__placeholder">（暂无练习题）</li>
      </ol>
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

.wpx-practice__header {
  display: flex; align-items: center; gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.wpx-practice__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #fb8c00; color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-practice__title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800; margin: 0; flex: 1;
}
.wpx-practice__toggle {
  padding: 4px 10px; border-radius: 6px;
  background: transparent; border: 1px solid #fb8c00;
  color: #fb8c00; cursor: pointer; font-size: 0.85rem;
}
.wpx-practice__toggle:hover { background: #fb8c00; color: #fff; }
.wpx-practice__toggle[aria-pressed='true'] { background: #fb8c00; color: #fff; }

.wpx-practice__body { flex: 1; overflow: hidden; }
.wpx-practice__list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.75rem;
  height: 100%; overflow: hidden;
}
.wpx-practice__item {
  padding: 0.6rem 0.85rem;
  background: rgba(251, 140, 0, 0.05);
  border-radius: 8px;
  border-left: 3px solid #fb8c00;
}
.wpx-slide--dark .wpx-practice__item { background: rgba(251, 140, 0, 0.12); }

.wpx-practice__item-head {
  display: flex; align-items: center; gap: 0.6rem;
  margin-bottom: 0.3rem;
}
.wpx-practice__num { font-weight: 700; color: #fb8c00; }
.wpx-practice__type {
  font-size: 0.78rem; padding: 2px 8px;
  border-radius: 4px; background: rgba(251, 140, 0, 0.18);
  color: #fb8c00; font-weight: 600;
}
.wpx-practice__diff { font-size: 0.85rem; color: #fb8c00; letter-spacing: 0.1em; }

.wpx-practice__stem {
  margin: 0; font-size: clamp(0.95rem, 1.5vw, 1.1rem); line-height: 1.5;
}
.wpx-practice__options {
  list-style: none; margin: 0.4rem 0 0 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: 0.3rem 1rem;
  font-size: 0.95rem;
}
.wpx-practice__option {
  display: inline-flex; gap: 0.3rem;
}
.wpx-practice__opt-label { font-weight: 600; color: #fb8c00; }
.wpx-practice__answer {
  margin: 0.4rem 0 0 0; padding: 0.3rem 0.5rem;
  background: rgba(67, 160, 71, 0.12);
  border-radius: 4px; font-size: 0.95rem;
  color: #2e7d32;
}
.wpx-slide--dark .wpx-practice__answer { color: #66bb6a; }
.wpx-practice__placeholder { font-style: italic; opacity: 0.55; padding: 0.5rem 0; }
</style>