<script setup>
import { computed, reactive, watch } from 'vue'
import {
  HTML_DEFAULT_PRINT_PAPER,
  HTML_PRINT_PAPER_OPTIONS,
  HTML_PRINT_PAPER_VALUES,
  normalizeHtmlPrintPaper,
} from '@/constants/htmlPrintPaper'

/**
 * HTML 导出确认对话框
 *
 * 与 ExportOptionsConfirm（A4 纸张弹窗）分离，专门为 HTML 提供有意义
 * 的导出选项：导出形式（完整文档 / 片段）、适配样式、打印分页、生成目录、
 * 打印纸张尺寸等。HTML 本身没有「页边距 / 页眉页脚」概念，因此不再复用。
 */

/**
 * HTML 打印纸张列表。
 *
 * 与 Word/PDF 母版不同，HTML 打印纸张受限于 CSS `@page { size }` 支持的关键字，
 * 因此仅保留浏览器原生识别的尺寸：A4 / Letter / B5 / 不设置（自适应窗口宽度）。
 * 16K / 手机长图等定制尺寸在此弹窗中不展示，避免误导用户选择后浏览器无效果。
 *
 * 列表与白名单均复用 `constants/htmlPrintPaper`，避免三处重复定义。
 */
const PRINT_PAPER_VALUES = HTML_PRINT_PAPER_VALUES
const PRINT_PAPER_OPTIONS = HTML_PRINT_PAPER_OPTIONS

const DEFAULT_OPTIONS = Object.freeze({
  documentMode: 'full', // 'full' 完整 HTML 文档 | 'fragment' 仅 HTML 片段
  fitImagesToWidth: true,
  autoPaginate: true,
  generateToc: false,
  printPaper: HTML_DEFAULT_PRINT_PAPER,
})

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  defaults: {
    type: Object,
    default: () => ({}),
  },
  headingCount: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['confirm', 'close'])

const localOptions = reactive(cloneOptions(DEFAULT_OPTIONS))

function cloneOptions(input) {
  const base = { ...DEFAULT_OPTIONS, ...(input || {}) }
  const documentMode = base.documentMode === 'fragment' ? 'fragment' : 'full'
  const printPaper = normalizeHtmlPrintPaper(base.printPaper)
  return {
    documentMode,
    fitImagesToWidth: base.fitImagesToWidth !== false,
    autoPaginate: base.autoPaginate !== false,
    generateToc: Boolean(base.generateToc),
    printPaper,
  }
}

watch(
  () => [props.visible, props.defaults],
  ([visible]) => {
    if (!visible) return
    Object.assign(localOptions, cloneOptions(props.defaults || {}))
  },
  { immediate: true, deep: true },
)

const canGenerateToc = computed(() => props.headingCount >= 3)
const tocDisabledHint = computed(() =>
  canGenerateToc.value
    ? '本文档包含 3 个及以上标题，可生成 HTML 锚点目录'
    : '需要文档中包含 3 个及以上标题才可生成目录',
)

const documentModeOptions = [
  {
    value: 'full',
    label: '完整 HTML 文档',
    description: '包含 <!DOCTYPE html>、<head> 与内嵌样式，可直接双击打开预览',
  },
  {
    value: 'fragment',
    label: 'HTML 片段',
    description: '仅导出正文片段，便于嵌入到其他网页或文章系统中',
  },
]

const currentPrintPaperLabel = computed(() => {
  const option = PRINT_PAPER_OPTIONS.find((item) => item.value === localOptions.printPaper)
  return option?.label || ''
})

function handleClose() {
  if (props.loading) return
  emit('close')
}

function handleConfirm() {
  if (props.loading) return
  const payload = cloneOptions(localOptions)
  if (!canGenerateToc.value) {
    payload.generateToc = false
  }
  emit('confirm', payload)
}

function handleBackdropMouseDown(event) {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
  }
}

function handleGenerateTocChange(event) {
  if (event.target.checked && !canGenerateToc.value) {
    event.target.checked = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="export-html-options-confirm-backdrop"
      @mousedown="handleBackdropMouseDown"
    >
      <div
        class="export-html-options-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-html-options-confirm-title"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <header class="export-html-options-confirm__header">
          <h2 id="export-html-options-confirm-title">HTML 导出选项</h2>
          <button
            type="button"
            class="export-html-options-confirm__close"
            aria-label="关闭"
            :disabled="loading"
            @click="handleClose"
          >
            ×
          </button>
        </header>

        <div class="export-html-options-confirm__body">
          <section class="export-html-options-confirm__section">
            <h3 class="export-html-options-confirm__section-title">导出形式</h3>
            <p class="export-html-options-confirm__hint">
              HTML 导出与 Word/PDF 不同，无需选择「A4 纸张 / 页边距 / 页眉页脚」。
              请选择适合你的导出形式。
            </p>
            <div class="export-html-options-confirm__radio-group" role="radiogroup" aria-label="导出形式">
              <label
                v-for="option in documentModeOptions"
                :key="option.value"
                class="export-html-options-confirm__radio"
                :class="{
                  'export-html-options-confirm__radio--active':
                    localOptions.documentMode === option.value,
                }"
              >
                <input
                  v-model="localOptions.documentMode"
                  type="radio"
                  name="export-html-document-mode"
                  :value="option.value"
                  :disabled="loading"
                />
                <span class="export-html-options-confirm__radio-label">{{ option.label }}</span>
                <span class="export-html-options-confirm__radio-desc">{{ option.description }}</span>
              </label>
            </div>
          </section>

          <section class="export-html-options-confirm__section">
            <h3 class="export-html-options-confirm__section-title">适配与排版</h3>

            <label class="export-html-options-confirm__checkbox">
              <input
                v-model="localOptions.fitImagesToWidth"
                type="checkbox"
                :disabled="loading"
              />
              <span class="export-html-options-confirm__checkbox-label">图片与表格自适应容器宽度</span>
              <span class="export-html-options-confirm__checkbox-hint">
                注入 <code>img { max-width: 100% }</code> 等 CSS，避免图片撑破布局
              </span>
            </label>

            <label class="export-html-options-confirm__checkbox">
              <input
                v-model="localOptions.autoPaginate"
                type="checkbox"
                :disabled="loading"
              />
              <span class="export-html-options-confirm__checkbox-label">启用打印分页</span>
              <span class="export-html-options-confirm__checkbox-hint">
                防止段落、表格被切断，并控制孤行寡行；仅在浏览器打印时生效
              </span>
            </label>

            <div class="export-html-options-confirm__field">
              <label for="export-html-print-paper">打印纸张（可选）</label>
              <select
                id="export-html-print-paper"
                v-model="localOptions.printPaper"
                class="export-html-options-confirm__select"
                :disabled="loading"
              >
                <option
                  v-for="option in PRINT_PAPER_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <span class="export-html-options-confirm__checkbox-hint">
                通过 <code>@page { size }</code> 控制浏览器打印时的纸张尺寸；
                选择「不设置」则按窗口宽度自适应。当前选择：{{ currentPrintPaperLabel }}
              </span>
            </div>
          </section>

          <section class="export-html-options-confirm__section">
            <h3 class="export-html-options-confirm__section-title">导航辅助</h3>

            <label
              class="export-html-options-confirm__checkbox"
              :class="{ 'export-html-options-confirm__checkbox--disabled': !canGenerateToc }"
              :title="tocDisabledHint"
            >
              <input
                :checked="localOptions.generateToc"
                type="checkbox"
                :disabled="loading || !canGenerateToc"
                @change="handleGenerateTocChange"
              />
              <span class="export-html-options-confirm__checkbox-label">生成目录</span>
              <span class="export-html-options-confirm__checkbox-hint">
                {{ canGenerateToc
                  ? `本文档含 ${props.headingCount} 个标题，将在文档顶部插入锚点目录`
                  : tocDisabledHint }}
              </span>
            </label>
          </section>
        </div>

        <footer class="export-html-options-confirm__footer">
          <button
            type="button"
            class="export-html-options-confirm__btn export-html-options-confirm__btn--ghost"
            :disabled="loading"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="export-html-options-confirm__btn export-html-options-confirm__btn--primary"
            :disabled="loading"
            @click="handleConfirm"
          >
            {{ loading ? '导出中…' : '确认导出' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.export-html-options-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 105;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.export-html-options-confirm {
  width: min(560px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.export-html-options-confirm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.export-html-options-confirm__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.export-html-options-confirm__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.export-html-options-confirm__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-html-options-confirm__body {
  flex: 1 1 auto;
  padding: 16px 20px;
  overflow-y: auto;
}

.export-html-options-confirm__section {
  padding: 12px 0;
  border-bottom: 1px dashed var(--theme-border, #e2e8f0);
}

.export-html-options-confirm__section:last-child {
  border-bottom: none;
}

.export-html-options-confirm__section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.export-html-options-confirm__hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
  line-height: 1.6;
}

.export-html-options-confirm__radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-html-options-confirm__radio {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  row-gap: 2px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.export-html-options-confirm__radio:hover {
  border-color: var(--theme-accent, #7c3aed);
}

.export-html-options-confirm__radio--active {
  border-color: var(--theme-accent, #7c3aed);
  background: color-mix(in srgb, var(--theme-accent, #7c3aed) 6%, transparent);
}

.export-html-options-confirm__radio input {
  grid-row: 1 / span 2;
  width: 16px;
  height: 16px;
  accent-color: var(--theme-accent, #7c3aed);
  cursor: pointer;
}

.export-html-options-confirm__radio-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-fg, #0f172a);
}

.export-html-options-confirm__radio-desc {
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.export-html-options-confirm__field {
  margin-top: 12px;
}

.export-html-options-confirm__field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--theme-fg-muted, #475569);
  font-weight: 500;
}

.export-html-options-confirm__select {
  width: 100%;
  height: 36px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  padding: 0 12px;
  font-size: 14px;
  color: var(--theme-fg, #0f172a);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.export-html-options-confirm__select:focus {
  border-color: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #7c3aed) 18%, transparent);
}

.export-html-options-confirm__checkbox {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  row-gap: 2px;
  align-items: center;
  margin-bottom: 10px;
  cursor: pointer;
}

.export-html-options-confirm__checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--theme-accent, #7c3aed);
  grid-row: 1 / span 2;
}

.export-html-options-confirm__checkbox-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-fg, #0f172a);
}

.export-html-options-confirm__checkbox-hint {
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
  line-height: 1.5;
}

.export-html-options-confirm__checkbox-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--theme-bg-subtle, #f1f5f9);
  color: var(--theme-fg, #334155);
}

.export-html-options-confirm__checkbox--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.export-html-options-confirm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
}

.export-html-options-confirm__btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.export-html-options-confirm__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.export-html-options-confirm__btn--primary {
  border: none;
  background: var(--theme-accent, #7c3aed);
  color: #fff;
}

.export-html-options-confirm__btn--ghost {
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
}

@media (max-width: 540px) {
  .export-html-options-confirm__radio {
    grid-template-columns: auto 1fr;
  }
}
</style>
