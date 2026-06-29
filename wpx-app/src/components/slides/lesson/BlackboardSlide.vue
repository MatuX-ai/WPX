<script setup>
/**
 * <BlackboardSlide> - 板书设计页
 *
 * Props:
 *   - title
 *   - layout: 'linear' | 'tree' | 'table'
 *   - sections: Array<{ label, content }>
 *   - theme
 *
 * 设计：黑板底色 + 白色粉笔字 + 红色重点标记
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '板书设计' },
  layout: {
    type: String,
    default: 'linear',
    validator: (v) => ['linear', 'tree', 'table'].includes(v),
  },
  sections: {
    type: Array,
    default: () => [],
    validator: (v) =>
      Array.isArray(v) &&
      v.every((s) => s && typeof s.label === 'string'),
  },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--blackboard wpx-slide--blackboard-bg"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-blackboard__header">
      <span class="wpx-blackboard__chip">板书</span>
      <h2 class="wpx-blackboard__title">{{ title }}</h2>
    </header>

    <div
      class="wpx-blackboard__board"
      :class="`wpx-blackboard__board--${layout}`"
    >
      <div v-if="layout === 'linear'" class="wpx-blackboard__linear">
        <div v-for="(s, i) in sections" :key="i" class="wpx-blackboard__section">
          <span class="wpx-blackboard__label">{{ s.label }}</span>
          <span v-if="s.content" class="wpx-blackboard__content">{{ s.content }}</span>
        </div>
        <p v-if="!sections.length" class="wpx-blackboard__placeholder">（暂无板书内容）</p>
      </div>

      <div v-else-if="layout === 'tree'" class="wpx-blackboard__tree">
        <div v-for="(s, i) in sections" :key="i" class="wpx-blackboard__node">
          <div class="wpx-blackboard__node-label">{{ s.label }}</div>
          <div v-if="s.content" class="wpx-blackboard__node-content">{{ s.content }}</div>
        </div>
        <p v-if="!sections.length" class="wpx-blackboard__placeholder">（暂无板书内容）</p>
      </div>

      <div v-else class="wpx-blackboard__table">
        <div class="wpx-blackboard__table-head">板书</div>
        <div v-for="(s, i) in sections" :key="i" class="wpx-blackboard__row">
          <div class="wpx-blackboard__row-label">{{ s.label }}</div>
          <div v-if="s.content" class="wpx-blackboard__row-content">{{ s.content }}</div>
        </div>
        <p v-if="!sections.length" class="wpx-blackboard__placeholder">（暂无板书内容）</p>
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

.wpx-slide--blackboard-bg {
  /* 黑板底色：深绿 + 木纹边框 */
  background: linear-gradient(135deg, #1e3a2e 0%, #2d5043 100%);
  color: #fff8e1;
  border: 8px solid #5d4037;
}

/* 即便 theme=dark 也保持黑板底色（不覆盖） */

.wpx-blackboard__header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.wpx-blackboard__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #fff8e1; color: #1e3a2e; font-size: 0.85rem; font-weight: 700;
}
.wpx-blackboard__title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800; margin: 0;
  color: #fff8e1;
  font-family: 'KaiTi', 'STKaiti', 'Source Han Serif CN', serif;
  letter-spacing: 0.05em;
}

.wpx-blackboard__board {
  flex: 1;
  background: linear-gradient(135deg, #1e3a2e 0%, #2d5043 100%);
  border: 2px solid rgba(255, 248, 225, 0.2);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  font-family: 'KaiTi', 'STKaiti', 'Source Han Serif CN', serif;
  overflow: hidden;
}

.wpx-blackboard__linear { display: flex; flex-direction: column; gap: 0.6rem; }
.wpx-blackboard__linear .wpx-blackboard__section {
  display: flex; gap: 0.6rem; align-items: baseline;
  font-size: clamp(1.05rem, 1.8vw, 1.3rem);
  line-height: 1.7;
}
.wpx-blackboard__label {
  flex-shrink: 0; font-weight: 700; color: #ffeb3b;
  border-bottom: 2px solid #ffeb3b;
  padding-right: 0.5rem;
}
.wpx-blackboard__content { color: #fff8e1; }

.wpx-blackboard__tree { display: flex; flex-direction: column; gap: 0.75rem; padding-left: 0.5rem; }
.wpx-blackboard__node {
  border-left: 3px solid #ffeb3b;
  padding-left: 0.75rem;
  font-size: clamp(1rem, 1.7vw, 1.2rem);
  line-height: 1.6;
}
.wpx-blackboard__node-label {
  font-weight: 700; color: #ffeb3b;
  margin-bottom: 0.25rem;
}
.wpx-blackboard__node-content { color: #fff8e1; }

.wpx-blackboard__table-head {
  font-size: 1rem; font-weight: 700; color: #ffeb3b;
  margin-bottom: 0.5rem; text-align: center;
  border-bottom: 2px solid rgba(255, 248, 225, 0.3);
  padding-bottom: 0.5rem;
}
.wpx-blackboard__row {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px dashed rgba(255, 248, 225, 0.15);
  font-size: clamp(0.95rem, 1.6vw, 1.1rem);
  line-height: 1.5;
}
.wpx-blackboard__row-label { font-weight: 700; color: #ffeb3b; }
.wpx-blackboard__row-content { color: #fff8e1; }

.wpx-blackboard__placeholder {
  font-style: italic; opacity: 0.5; font-size: 0.9rem; color: #fff8e1;
}
</style>