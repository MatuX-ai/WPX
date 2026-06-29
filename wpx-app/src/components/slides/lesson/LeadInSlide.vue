<script setup>
/**
 * <LeadInSlide> - 课堂导入页
 *
 * Props:
 *   - title
 *   - scenario: string       - 情境描述
 *   - questions: string[]    - 引导问题
 *   - mediaUrl?: string      - 可选配图
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '课堂导入' },
  scenario: { type: String, default: '' },
  questions: { type: Array, default: () => [] },
  mediaUrl: { type: String, default: '' },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--leadin"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-leadin__header">
      <span class="wpx-leadin__chip">导入</span>
      <h2 class="wpx-leadin__title">{{ title }}</h2>
    </header>

    <div class="wpx-leadin__body">
      <div class="wpx-leadin__scenario">
        <img v-if="mediaUrl" :src="mediaUrl" class="wpx-leadin__media" alt="" />
        <div v-else class="wpx-leadin__media wpx-leadin__media--placeholder">📖 情境</div>
        <p v-if="scenario" class="wpx-leadin__scenario-text">{{ scenario }}</p>
        <p v-else class="wpx-leadin__placeholder">（未填写导入情境）</p>
      </div>

      <div class="wpx-leadin__questions">
        <div class="wpx-leadin__chip wpx-leadin__chip--q">引导问题</div>
        <ul class="wpx-leadin__qlist">
          <li v-for="(q, i) in questions" :key="i" class="wpx-leadin__qitem">
            <span class="wpx-leadin__qmark">?</span>
            <span>{{ q }}</span>
          </li>
          <li v-if="!questions.length" class="wpx-leadin__placeholder">（未填写引导问题）</li>
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
.wpx-slide--light { background-color: #f5f9ff; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1a2233; color: #e0e0e0; }

.wpx-leadin__header {
  display: flex; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem;
}
.wpx-leadin__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: #fb8c00; color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-leadin__title {
  font-size: clamp(1.625rem, 3.5vw, 2.5rem);
  font-weight: 800; margin: 0; letter-spacing: -0.02em;
}

.wpx-leadin__body {
  flex: 1; display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  overflow: hidden;
}

.wpx-leadin__scenario {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding: 1rem; border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed rgba(25, 118, 210, 0.3);
}
.wpx-slide--dark .wpx-leadin__scenario {
  background: rgba(255, 255, 255, 0.04);
}
.wpx-leadin__media {
  width: 100%; height: 4.5rem;
  border-radius: 8px;
  object-fit: cover;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  color: #fb8c00; font-weight: 600;
}
.wpx-leadin__media--placeholder { font-size: 1.25rem; }
.wpx-leadin__scenario-text {
  margin: 0; font-size: clamp(0.95rem, 1.5vw, 1.1rem); line-height: 1.6;
}
.wpx-leadin__placeholder { font-style: italic; opacity: 0.55; font-size: 0.9rem; margin: 0; }

.wpx-leadin__questions {
  display: flex; flex-direction: column; gap: 0.75rem;
}
.wpx-leadin__chip--q { background: #1976d2; align-self: flex-start; }

.wpx-leadin__qlist {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.wpx-leadin__qitem {
  display: flex; gap: 0.6rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.6vw, 1.2rem); line-height: 1.5;
  padding: 0.6rem 0.85rem;
  background: rgba(25, 118, 210, 0.06);
  border-radius: 8px;
}
.wpx-leadin__qmark {
  flex-shrink: 0; width: 1.6em; height: 1.6em;
  border-radius: 50%; background: #1976d2; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.95em;
}
</style>