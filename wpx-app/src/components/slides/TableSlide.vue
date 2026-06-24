<script setup>
/**
 * <TableSlide> - 演示文稿表格页
 *
 * 用法：
 *   <TableSlide
 *     title="数据对比"
 *     :headers="['指标', 'Q1', 'Q2', 'Q3', 'Q4']"
 *     :rows="[
 *       ['收入', '120', '150', '180', '200'],
 *       ['成本', '80',  '90',  '100', '110']
 *     ]"
 *     theme="light"
 *   />
 *
 * 设计要点：
 * - 渲染语义化 HTML 表格（<table><thead><tbody>）
 * - 表头强调色，斑马纹，hover 高亮
 * - 浅色 / 深色双主题
 * - 16:9 固定宽高比
 */
import { computed } from 'vue'

const props = defineProps({
  /** 页面标题 */
  title: { type: String, required: true },
  /** 表头单元格列表 */
  headers: {
    type: Array,
    required: true,
    validator: (v) => Array.isArray(v) && v.every((s) => typeof s === 'string'),
  },
  /**
   * 行数据：每行是一个字符串数组，顺序与 headers 对齐
   */
  rows: {
    type: Array,
    default: () => [],
    validator: (v) =>
      Array.isArray(v) &&
      v.every(
        (r) => Array.isArray(r) && r.every((c) => typeof c === 'string' || typeof c === 'number'),
      ),
  },
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

// 规范化单元格为字符串
function cell(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}
</script>

<template>
  <div
    class="wpx-slide wpx-slide--table"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-table__header">
      <h2 class="wpx-table__title">{{ title }}</h2>
      <div class="wpx-table__accent-bar" aria-hidden="true" />
    </header>

    <div class="wpx-table__body">
      <div class="wpx-table__scroll" :aria-label="title">
        <table class="wpx-table">
          <thead>
            <tr>
              <th
                v-for="(h, idx) in headers"
                :key="`h-${idx}`"
                scope="col"
                class="wpx-table__th"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="rows.length === 0">
              <td :colspan="headers.length" class="wpx-table__empty">
                （暂无数据）
              </td>
            </tr>
            <tr
              v-for="(row, rIdx) in rows"
              :key="`r-${rIdx}`"
              class="wpx-table__tr"
            >
              <td
                v-for="(_, cIdx) in headers"
                :key="`c-${rIdx}-${cIdx}`"
                class="wpx-table__td"
              >
                {{ cell(row[cIdx]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  padding: 5% 6% 6%;
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

.wpx-table__header {
  margin-bottom: 1.25rem;
  flex-shrink: 0;
}

.wpx-table__title {
  font-size: clamp(1.625rem, 3.25vw, 2.375rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.625rem 0;
  line-height: 1.15;
}

.wpx-table__accent-bar {
  width: 3rem;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
}

.wpx-slide--dark .wpx-table__accent-bar {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.wpx-table__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wpx-table__scroll {
  flex: 1;
  overflow: auto;
  border-radius: var(--theme-radius-md, 10px);
  border: 1px solid var(--theme-border, #e2e8f0);
}

.wpx-slide--dark .wpx-table__scroll {
  border-color: #404040;
}

/* 表格本体 */
.wpx-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: clamp(0.875rem, 1.35vw, 1.0625rem);
  line-height: 1.5;
}

.wpx-table__th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  font-weight: 700;
  padding: 0.75rem 1rem;
  background: var(--theme-accent-muted, #ede9fe);
  color: var(--theme-accent-hover, #6d28d9);
  border-bottom: 2px solid var(--theme-accent, #7c3aed);
  white-space: nowrap;
}

.wpx-slide--dark .wpx-table__th {
  background: #1e3a5f;
  color: #93c5fd;
  border-bottom-color: #3b82f6;
}

.wpx-table__td {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
  vertical-align: middle;
  word-break: break-word;
}

.wpx-slide--dark .wpx-table__td {
  border-bottom-color: #404040;
}

.wpx-table__tr:last-child .wpx-table__td {
  border-bottom: none;
}

/* 斑马纹 */
.wpx-table__tr:nth-child(even) .wpx-table__td {
  background: var(--theme-bg-subtle, #f8fafc);
}

.wpx-slide--dark .wpx-table__tr:nth-child(even) .wpx-table__td {
  background: #252525;
}

/* hover */
.wpx-table__tr:hover .wpx-table__td {
  background: var(--theme-accent-muted, #ede9fe);
}

.wpx-slide--dark .wpx-table__tr:hover .wpx-table__td {
  background: #1e3a5f;
}

.wpx-table__empty {
  padding: 2rem;
  text-align: center;
  font-style: italic;
  color: var(--theme-fg-muted, #475569);
  opacity: 0.7;
}
</style>
