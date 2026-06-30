<script setup>
import { computed, reactive, watch } from 'vue'
import {
  HEADER_FOOTER_OPTIONS,
  PAPER_MARGIN_OPTIONS,
  PAPER_SIZE_OPTIONS,
  createDefaultPaperSettings,
} from '@/constants/paperPreferences'

const DEFAULT_OPTIONS = Object.freeze({
  paperSize: 'A4',
  paperMargin: 'normal',
  customMargin: { top: 20, bottom: 20, left: 20, right: 20 },
  headerFooter: 'none',
  autoPaginate: true,
  fitImagesToWidth: true,
  generateToc: false,
  submitToKnowledge: true,
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
  format: {
    type: String,
    default: '',
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
  const fallback = createDefaultPaperSettings()
  return {
    paperSize: base.paperSize ?? fallback.paperSize,
    paperMargin: base.paperMargin ?? fallback.paperMargin,
    customMargin: {
      top: Number.isFinite(base.customMargin?.top) ? base.customMargin.top : fallback.customMargin.top,
      bottom: Number.isFinite(base.customMargin?.bottom) ? base.customMargin.bottom : fallback.customMargin.bottom,
      left: Number.isFinite(base.customMargin?.left) ? base.customMargin.left : fallback.customMargin.left,
      right: Number.isFinite(base.customMargin?.right) ? base.customMargin.right : fallback.customMargin.right,
    },
    headerFooter: base.headerFooter ?? fallback.headerFooter,
    autoPaginate: base.autoPaginate !== false,
    fitImagesToWidth: base.fitImagesToWidth !== false,
    generateToc: Boolean(base.generateToc),
    submitToKnowledge: base.submitToKnowledge !== false,
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
    ? '本文档包含 3 个及以上标题，可生成目录'
    : '需要文档中包含 3 个及以上标题才可生成目录',
)

const currentPaperLabel = computed(() => {
  const option = PAPER_SIZE_OPTIONS.find((item) => item.value === localOptions.paperSize)
  return option?.label || ''
})

const currentMarginLabel = computed(() => {
  const option = PAPER_MARGIN_OPTIONS.find((item) => item.value === localOptions.paperMargin)
  return option?.label || '自定义'
})

const currentHeaderFooterLabel = computed(() => {
  const option = HEADER_FOOTER_OPTIONS.find((item) => item.value === localOptions.headerFooter)
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
      class="export-options-confirm-backdrop"
      @mousedown="handleBackdropMouseDown"
    >
      <div
        class="export-options-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-options-confirm-title"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <header class="export-options-confirm__header">
          <h2 id="export-options-confirm-title">导出选项确认</h2>
          <button
            type="button"
            class="export-options-confirm__close"
            aria-label="关闭"
            :disabled="loading"
            @click="handleClose"
          >
            ×
          </button>
        </header>

        <div class="export-options-confirm__body">
          <section class="export-options-confirm__section">
            <h3 class="export-options-confirm__section-title">当前默认纸张设定</h3>
            <dl class="export-options-confirm__meta">
              <div class="export-options-confirm__meta-row">
                <dt>纸张</dt>
                <dd>{{ currentPaperLabel }}</dd>
              </div>
              <div class="export-options-confirm__meta-row">
                <dt>页边距</dt>
                <dd>{{ currentMarginLabel }}</dd>
              </div>
              <div class="export-options-confirm__meta-row">
                <dt>页眉页脚</dt>
                <dd>{{ currentHeaderFooterLabel }}</dd>
              </div>
            </dl>
            <p class="export-options-confirm__hint">
              以下设置仅本次导出生效，不影响全局默认。
            </p>
          </section>

          <section class="export-options-confirm__section">
            <h3 class="export-options-confirm__section-title">本次导出参数</h3>

            <div class="export-options-confirm__field">
              <label for="export-paper-size">纸张尺寸</label>
              <select
                id="export-paper-size"
                v-model="localOptions.paperSize"
                class="export-options-confirm__select"
                :disabled="loading"
              >
                <option
                  v-for="option in PAPER_SIZE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div class="export-options-confirm__field">
              <label for="export-paper-margin">页边距</label>
              <select
                id="export-paper-margin"
                v-model="localOptions.paperMargin"
                class="export-options-confirm__select"
                :disabled="loading"
              >
                <option
                  v-for="option in PAPER_MARGIN_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div v-if="localOptions.paperMargin === 'custom'" class="export-options-confirm__custom-margin">
              <span class="export-options-confirm__custom-margin-label">自定义边距（mm）</span>
              <div class="export-options-confirm__custom-margin-grid">
                <label v-for="key in ['top', 'bottom', 'left', 'right']" :key="key">
                  <span>{{ ({ top: '上', bottom: '下', left: '左', right: '右' })[key] }}</span>
                  <input
                    v-model.number="localOptions.customMargin[key]"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    :disabled="loading"
                    class="export-options-confirm__number-input"
                  />
                </label>
              </div>
            </div>

            <div class="export-options-confirm__field">
              <label for="export-header-footer">页眉页脚</label>
              <select
                id="export-header-footer"
                v-model="localOptions.headerFooter"
                class="export-options-confirm__select"
                :disabled="loading"
              >
                <option
                  v-for="option in HEADER_FOOTER_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </section>

          <section class="export-options-confirm__section">
            <h3 class="export-options-confirm__section-title">导出行为</h3>

            <label class="export-options-confirm__checkbox">
              <input
                v-model="localOptions.autoPaginate"
                type="checkbox"
                :disabled="loading"
              />
              <span class="export-options-confirm__checkbox-label">自动分页</span>
              <span class="export-options-confirm__checkbox-hint">按纸张高度自动插入分页符</span>
            </label>

            <label class="export-options-confirm__checkbox">
              <input
                v-model="localOptions.fitImagesToWidth"
                type="checkbox"
                :disabled="loading"
              />
              <span class="export-options-confirm__checkbox-label">图片适配页面宽度</span>
              <span class="export-options-confirm__checkbox-hint">超出页面宽度的图片自动缩放</span>
            </label>

            <label
              class="export-options-confirm__checkbox"
              :class="{ 'export-options-confirm__checkbox--disabled': !canGenerateToc }"
              :title="tocDisabledHint"
            >
              <input
                :checked="localOptions.generateToc"
                type="checkbox"
                :disabled="loading || !canGenerateToc"
                @change="handleGenerateTocChange"
              />
              <span class="export-options-confirm__checkbox-label">生成目录</span>
              <span class="export-options-confirm__checkbox-hint">
                {{ canGenerateToc
                  ? `本文档含 ${props.headingCount} 个标题，可生成目录`
                  : tocDisabledHint }}
              </span>
            </label>

            <label class="export-options-confirm__checkbox">
              <input
                v-model="localOptions.submitToKnowledge"
                type="checkbox"
                :disabled="loading"
              />
              <span class="export-options-confirm__checkbox-label">同步到资料库</span>
              <span class="export-options-confirm__checkbox-hint">导出完成后将文档提交到资料库</span>
            </label>
          </section>
        </div>

        <footer class="export-options-confirm__footer">
          <button
            type="button"
            class="export-options-confirm__btn export-options-confirm__btn--ghost"
            :disabled="loading"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="export-options-confirm__btn export-options-confirm__btn--primary"
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
.export-options-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 105;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.export-options-confirm {
  width: min(560px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.export-options-confirm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.export-options-confirm__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.export-options-confirm__close {
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

.export-options-confirm__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-options-confirm__body {
  flex: 1 1 auto;
  padding: 16px 20px;
  overflow-y: auto;
}

.export-options-confirm__section {
  padding: 12px 0;
  border-bottom: 1px dashed var(--theme-border, #e2e8f0);
}

.export-options-confirm__section:last-child {
  border-bottom: none;
}

.export-options-confirm__section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.export-options-confirm__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 6px 16px;
  margin: 0 0 8px;
}

.export-options-confirm__meta-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
}

.export-options-confirm__meta-row dt {
  color: var(--theme-fg-muted, #64748b);
}

.export-options-confirm__meta-row dd {
  margin: 0;
  color: var(--theme-fg, #0f172a);
  font-weight: 500;
}

.export-options-confirm__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.export-options-confirm__field {
  margin-bottom: 12px;
}

.export-options-confirm__field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--theme-fg-muted, #475569);
  font-weight: 500;
}

.export-options-confirm__select {
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

.export-options-confirm__select:focus {
  border-color: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #7c3aed) 18%, transparent);
}

.export-options-confirm__custom-margin {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px dashed var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg-subtle, #f8fafc);
}

.export-options-confirm__custom-margin-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.export-options-confirm__custom-margin-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.export-options-confirm__custom-margin-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.export-options-confirm__number-input {
  width: 100%;
  height: 30px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 6px;
  background: var(--theme-bg, #fff);
  padding: 0 8px;
  font-size: 13px;
  color: var(--theme-fg, #0f172a);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.export-options-confirm__number-input:focus {
  border-color: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #7c3aed) 18%, transparent);
}

.export-options-confirm__checkbox {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  row-gap: 2px;
  align-items: center;
  margin-bottom: 10px;
  cursor: pointer;
}

.export-options-confirm__checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--theme-accent, #7c3aed);
  grid-row: 1 / span 2;
}

.export-options-confirm__checkbox-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-fg, #0f172a);
}

.export-options-confirm__checkbox-hint {
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.export-options-confirm__checkbox--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.export-options-confirm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
}

.export-options-confirm__btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.export-options-confirm__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.export-options-confirm__btn--primary {
  border: none;
  background: var(--theme-accent, #7c3aed);
  color: #fff;
}

.export-options-confirm__btn--ghost {
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
}

@media (max-width: 540px) {
  .export-options-confirm__custom-margin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>