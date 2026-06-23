<script setup>
import { computed, ref, watch } from 'vue'
import { useEditorFonts } from '@/composables/useEditorFonts'
import { toFontSelectItem } from '@/composables/useFontMarket'
import { getElectronAPI } from '@/utils/electron'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  font: {
    type: Object,
    default: null,
  },
  defaultPreviewText: {
    type: String,
    default: '字体预览 ABC 123',
  },
})

const emit = defineEmits(['close', 'use-in-editor'])

const toast = useToast()
const {
  previewStatus,
  ensureFontPreview,
  getPreviewFontFamily,
} = useEditorFonts()

const previewText = ref('')
const previewLoading = ref(false)
const previewError = ref('')
/** @type {import('vue').Ref<ReturnType<typeof toFontSelectItem> | null>} */
const activeFontItem = ref(null)

const previewFontFamily = computed(() => {
  previewStatus.value
  if (!activeFontItem.value) return 'inherit'
  return getPreviewFontFamily(activeFontItem.value)
})

const canUseInEditor = computed(() => {
  return Boolean(activeFontItem.value) && previewStatus.value[activeFontItem.value?.id] === 'ready'
})

async function resolveFontItem(marketFont) {
  let item = toFontSelectItem(marketFont)

  if (!item.needsDownload) {
    return item
  }

  const api = getElectronAPI()
  if (!api?.fonts?.download || !item.downloadUrl) {
    throw new Error('当前环境无法下载字体')
  }

  const result = await api.fonts.download({
    url: item.downloadUrl,
    type: 'free',
    fileName: item.fileName || `${item.fontId || item.id}.ttf`,
    downloadId: item.id,
  })

  if (!result?.ok || !result.path) {
    throw new Error(result?.error || '字体下载失败')
  }

  return {
    ...item,
    needsDownload: false,
    path: result.path,
    group: 'installed',
  }
}

async function loadPreviewFont() {
  if (!props.font) return

  previewLoading.value = true
  previewError.value = ''
  activeFontItem.value = null

  try {
    const item = await resolveFontItem(props.font)
    activeFontItem.value = item
    await ensureFontPreview(item)
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : '字体预览加载失败'
    toast.error(previewError.value)
  } finally {
    previewLoading.value = false
  }
}

function handleClose() {
  emit('close')
}

function handleUseInEditor() {
  if (!props.font || !activeFontItem.value) return
  emit('use-in-editor', {
    marketFont: props.font,
    fontItem: activeFontItem.value,
  })
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
  }
}

watch(
  () => props.visible,
  (open) => {
    if (!open) {
      previewText.value = ''
      previewError.value = ''
      activeFontItem.value = null
      return
    }

    previewText.value = props.font?.sampleText || props.defaultPreviewText
    void loadPreviewFont()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="font-preview-backdrop"
      @mousedown.self="handleClose"
    >
      <div
        class="font-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="font-preview-title"
        @keydown="handleKeydown"
      >
        <header class="font-preview-dialog__header">
          <div>
            <h2 id="font-preview-title" class="font-preview-dialog__title">
              {{ font?.name || '字体预览' }}
            </h2>
            <p v-if="font?.vendor" class="font-preview-dialog__meta">{{ font.vendor }}</p>
          </div>
          <button
            type="button"
            class="font-preview-dialog__close"
            aria-label="关闭"
            @click="handleClose"
          >
            ×
          </button>
        </header>

        <div class="font-preview-dialog__body">
          <label class="font-preview-dialog__label" for="font-preview-input">预览文字</label>
          <input
            id="font-preview-input"
            v-model="previewText"
            type="text"
            class="font-preview-dialog__input"
            placeholder="输入文字实时预览"
          />

          <div class="font-preview-dialog__preview" aria-live="polite">
            <p v-if="previewLoading" class="font-preview-dialog__hint">字体加载中，暂时使用默认字体…</p>
            <p v-else-if="previewError" class="font-preview-dialog__error">{{ previewError }}</p>
            <p
              class="font-preview-dialog__sample"
              :style="{ fontFamily: previewFontFamily }"
            >
              {{ previewText || defaultPreviewText }}
            </p>
          </div>
        </div>

        <footer class="font-preview-dialog__footer">
          <button type="button" class="font-preview-dialog__btn font-preview-dialog__btn--ghost" @click="handleClose">
            关闭
          </button>
          <button
            type="button"
            class="font-preview-dialog__btn font-preview-dialog__btn--primary"
            :disabled="previewLoading || !canUseInEditor"
            @click="handleUseInEditor"
          >
            在编辑器中使用
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.font-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.font-preview-dialog {
  width: min(560px, 100%);
  border-radius: 12px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.font-preview-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.font-preview-dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.font-preview-dialog__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.font-preview-dialog__close {
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

.font-preview-dialog__close:hover {
  background: var(--theme-bg-subtle, #f8fafc);
}

.font-preview-dialog__body {
  padding: 16px 20px;
}

.font-preview-dialog__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.font-preview-dialog__input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  font-size: 14px;
  color: var(--theme-fg, #0f172a);
  background: var(--theme-bg, #fff);
}

.font-preview-dialog__preview {
  min-height: 120px;
  margin-top: 16px;
  padding: 20px;
  border: 1px dashed var(--theme-border, #e2e8f0);
  border-radius: 10px;
  background: var(--theme-bg-subtle, #f8fafc);
}

.font-preview-dialog__hint,
.font-preview-dialog__error {
  margin: 0 0 8px;
  font-size: 12px;
}

.font-preview-dialog__hint {
  color: var(--theme-fg-muted, #64748b);
}

.font-preview-dialog__error {
  color: #dc2626;
}

.font-preview-dialog__sample {
  margin: 0;
  font-size: 28px;
  line-height: 1.5;
  color: var(--theme-fg, #0f172a);
  word-break: break-word;
}

.font-preview-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
}

.font-preview-dialog__btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.font-preview-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.font-preview-dialog__btn--ghost {
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
}

.font-preview-dialog__btn--primary {
  border: none;
  background: var(--theme-accent, #2563eb);
  color: #fff;
}
</style>
