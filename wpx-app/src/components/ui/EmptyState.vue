<script setup>
import { computed } from 'vue'
import SmartTemplate from '@/components/templates/SmartTemplate.vue'
import {
  getColdStartTemplate,
} from '@/data/cold-start-templates'

const emit = defineEmits(['create', 'import', 'use-template'])

/**
 * 高频格式快捷入口：用户从 EmptyState 一眼就能选 Markdown / 表格 / PPT / 教案
 * - 通过 use-template 事件复用 SmartTemplate 的传递链路
 * - 选中的模板仍是 cold-start-templates 中的完整对象（含 content / format / documentType）
 */
const quickFormats = computed(() => [
  { id: 'blank', label: 'Markdown', desc: '纯 Markdown', icon: 'M' },
  { id: 'weekly-plan', label: '表格', desc: '周计划 / 数据表', icon: 'T' },
  { id: 'ppt-outline', label: 'PPT', desc: '课件大纲', icon: 'P' },
  { id: 'lesson-plan', label: '教案', desc: '教师专用', icon: 'L' },
])

function handleQuickFormat(format) {
  const template = getColdStartTemplate(format.id)
  if (!template) {
    console.warn('[EmptyState] quick-format template missing:', format.id)
    return
  }
  emit('use-template', template)
}
</script>

<template>
  <section class="empty-state" aria-label="无文档打开">
    <div class="empty-state__content">
      <div class="empty-state__illustration" aria-hidden="true">
        <svg
          class="empty-state__svg"
          viewBox="0 0 160 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="28"
            y="18"
            width="88"
            height="108"
            rx="8"
            fill="var(--theme-bg-muted)"
            stroke="var(--theme-border)"
            stroke-width="1.5"
          />
          <path
            d="M44 42h56M44 58h56M44 74h36"
            stroke="var(--theme-fg-subtle)"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M44 90h24"
            stroke="var(--theme-accent-muted)"
            stroke-width="2"
            stroke-linecap="round"
          />
          <g class="empty-state__pen">
            <path
              d="M108 28l24 24-36 36-24-24 36-36z"
              fill="var(--theme-accent-muted)"
              stroke="var(--theme-accent)"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <path
              d="M108 28l8 8M124 44l8 8"
              stroke="var(--theme-accent)"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path
              d="M96 64l-8 20 20-8"
              fill="var(--theme-accent)"
              stroke="var(--theme-accent-hover)"
              stroke-width="1"
              stroke-linejoin="round"
            />
          </g>
          <circle
            cx="132"
            cy="108"
            r="6"
            fill="var(--theme-accent)"
            opacity="0.15"
          />
          <circle
            cx="24"
            cy="36"
            r="4"
            fill="var(--theme-accent)"
            opacity="0.1"
          />
        </svg>
      </div>

      <h2 class="empty-state__title">开始你的创作</h2>
      <p class="empty-state__description">
        新建 Markdown 文档即刻动笔，或从资料库导入已有内容，让 AI 助手陪你完成写作。
      </p>

      <div class="empty-state__actions">
        <button
          type="button"
          class="empty-state__btn empty-state__btn--primary wpx-btn"
          @click="$emit('create')"
        >
          <svg
            class="empty-state__btn-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          新建 Markdown 文档
        </button>

        <button
          type="button"
          class="empty-state__btn empty-state__btn--secondary wpx-btn"
          @click="$emit('import')"
        >
          <svg
            class="empty-state__btn-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
              clip-rule="evenodd"
            />
            <path
              fill-rule="evenodd"
              d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
              clip-rule="evenodd"
            />
          </svg>
          从资料库导入
        </button>
      </div>

      <!--
        高频格式快捷入口：解决冷启动用户不知道可以按"格式"新建文档的问题。
        点击 -> 复用 use-template 事件链路 -> EditorLayout.createNewDocument
        -> 应用模板 content / format / documentType 到新窗口。
      -->
      <div
        class="empty-state__quick-formats"
        role="group"
        aria-label="按格式快速创建"
      >
        <span class="empty-state__quick-formats-label">按格式快速创建：</span>
        <button
          v-for="format in quickFormats"
          :key="format.id"
          type="button"
          class="empty-state__quick-format wpx-btn"
          :data-testid="`quick-format-${format.id}`"
          @click="handleQuickFormat(format)"
        >
          <span class="empty-state__quick-format-icon" aria-hidden="true">
            {{ format.icon }}
          </span>
          <span class="empty-state__quick-format-label">{{ format.label }}</span>
          <span class="empty-state__quick-format-desc">{{ format.desc }}</span>
        </button>
      </div>

      <SmartTemplate @use-template="$emit('use-template', $event)" />
    </div>
  </section>
</template>

<style scoped>
.empty-state {
  display: flex;
  /* 内容过高时避免主 CTA 被顶出视口；safe center 不支持时回退 flex-start */
  align-items: flex-start;
  align-items: safe center;
  justify-content: center;
  min-height: 100%;
  width: 100%;
  padding: 32px 24px;
  box-sizing: border-box;
}

.empty-state__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 520px;
  width: 100%;
  text-align: center;
}

.empty-state__illustration {
  margin-bottom: 24px;
}

.empty-state__svg {
  width: min(160px, 40vw);
  height: auto;
  display: block;
}

.empty-state__pen {
  transform-origin: 120px 52px;
  animation: empty-state-pen-float 3s ease-in-out infinite;
}

@keyframes empty-state-pen-float {
  0%, 100% { transform: rotate(-2deg) translateY(0); }
  50% { transform: rotate(2deg) translateY(-3px); }
}

.empty-state__title {
  margin: 0 0 10px;
  font-size: clamp(1.25rem, 2.5vw, 1.5rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--theme-fg);
}

.empty-state__description {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--theme-fg-muted);
}

.empty-state__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  /* Playwright / 锚点滚动时避开固定 TitleBar（含 editor-layout padding-top 占位） */
  scroll-margin-top: calc(var(--title-bar-height, 36px) + 12px);
}

@media (min-width: 480px) {
  .empty-state__actions {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
  }
  .empty-state__btn { flex: 0 1 auto; min-width: 180px; }
}

.empty-state__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: var(--theme-radius-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.empty-state__btn-icon { width: 18px; height: 18px; flex-shrink: 0; }

.empty-state__btn--primary {
  background: var(--theme-accent);
  color: #fff;
  border-color: var(--theme-accent);
  box-shadow: var(--theme-shadow-sm);
}
.empty-state__btn--primary:hover {
  background: var(--theme-accent-hover);
  border-color: var(--theme-accent-hover);
  box-shadow: var(--theme-shadow-md);
  transform: translateY(-2px);
}
.empty-state__btn--primary:active {
  transform: translateY(0);
  box-shadow: var(--theme-shadow-sm);
}

.empty-state__btn--secondary {
  background: var(--theme-surface);
  color: var(--theme-fg);
  border-color: var(--theme-border);
  box-shadow: var(--theme-shadow-sm);
}
.empty-state__btn--secondary:hover {
  background: var(--theme-accent-muted);
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  box-shadow: var(--theme-shadow-md);
  transform: translateY(-2px);
}
.empty-state__btn--secondary:active {
  transform: translateY(0);
  box-shadow: var(--theme-shadow-sm);
}

.empty-state__btn:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

/* Quick format chips */
.empty-state__quick-formats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
  width: 100%;
}

.empty-state__quick-formats-label {
  font-size: 12px;
  color: var(--theme-fg-muted);
  margin-right: 4px;
}

.empty-state__quick-format {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-bg);
  color: var(--theme-fg);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background-color 160ms ease,
    transform 120ms ease;
}

.empty-state__quick-format:hover {
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  background: var(--theme-accent-muted);
  transform: translateY(-1px);
}

.empty-state__quick-format:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

.empty-state__quick-format-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.empty-state__quick-format-label {
  font-weight: 600;
}

.empty-state__quick-format-desc {
  color: var(--theme-fg-subtle);
  font-size: 11px;
}

@media (max-width: 480px) {
  .empty-state__quick-format-desc { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .empty-state__pen { animation: none; }
  .empty-state__btn:hover,
  .empty-state__btn:active,
  .empty-state__quick-format:hover {
    transform: none;
  }
}
</style>