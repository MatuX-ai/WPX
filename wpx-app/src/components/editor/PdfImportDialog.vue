<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { importPdfToMarkdown } from '@/utils/pdfOcrClient'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

/**
 * 状态机：
 *  - idle：等待用户选择 PDF
 *  - loading：解析 PDF
 *  - ocr：扫描页正在 OCR
 *  - done：完成，等待用户确认插入
 *  - error：失败
 *  - cancelled：用户已取消
 */
const phase = ref('idle')
const progressCurrent = ref(0)
const progressTotal = ref(0)
const progressMessage = ref('')
const errorMessage = ref('')

const fileInputRef = ref(null)
const pickedFile = ref(null)
const resultMarkdown = ref('')
const resultTitle = ref('')
const resultMode = ref('')
const resultPageCount = ref(0)

let abortController = null
let previewLines = []

const isBusy = computed(() => phase.value === 'loading' || phase.value === 'ocr')
const canConfirm = computed(() => phase.value === 'done' && Boolean(resultMarkdown.value))

const progressPercent = computed(() => {
  if (!progressTotal.value) return 0
  return Math.min(100, Math.round((progressCurrent.value / progressTotal.value) * 100))
})

function reset() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  phase.value = 'idle'
  progressCurrent.value = 0
  progressTotal.value = 0
  progressMessage.value = ''
  errorMessage.value = ''
  pickedFile.value = null
  resultMarkdown.value = ''
  resultTitle.value = ''
  resultMode.value = ''
  resultPageCount.value = 0
  previewLines = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function handleClose() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  reset()
  emit('close')
}

function openFilePicker() {
  if (isBusy.value) return
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!/\.pdf$/i.test(file.name)) {
    errorMessage.value = '请选择 PDF 文件'
    return
  }
  pickedFile.value = file
  errorMessage.value = ''
  startImport(file)
}

function onDrop(event) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  if (!/\.pdf$/i.test(file.name)) {
    errorMessage.value = '请拖入 PDF 文件'
    return
  }
  pickedFile.value = file
  errorMessage.value = ''
  startImport(file)
}

function onDragOver(event) {
  event.preventDefault()
}

async function startImport(file) {
  phase.value = 'loading'
  errorMessage.value = ''
  progressCurrent.value = 0
  progressTotal.value = 0
  progressMessage.value = '读取文件中…'
  resultMarkdown.value = ''

  abortController = new AbortController()

  try {
    const buffer = await file.arrayBuffer()
    const result = await importPdfToMarkdown(
      buffer,
      file.name,
      (info) => {
        progressCurrent.value = info.current ?? progressCurrent.value
        progressTotal.value = info.total ?? progressTotal.value
        progressMessage.value = info.message ?? ''
        if (info.phase === 'ocr') phase.value = 'ocr'
      },
      { signal: abortController.signal },
    )

    resultMarkdown.value = result.markdown
    resultTitle.value = result.title
    resultMode.value = result.mode
    resultPageCount.value = result.pageCount
    previewLines = result.markdown.split('\n').filter(Boolean).slice(0, 12)
    phase.value = 'done'
  } catch (error) {
    if (error?.name === 'AbortError') {
      phase.value = 'cancelled'
      progressMessage.value = '已取消'
      return
    }
    phase.value = 'error'
    errorMessage.value = error?.message || '解析失败'
  } finally {
    abortController = null
  }
}

function handleCancel() {
  if (!isBusy.value) {
    handleClose()
    return
  }
  abortController?.abort()
}

function handleConfirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    markdown: resultMarkdown.value,
    title: resultTitle.value,
    mode: resultMode.value,
    pageCount: resultPageCount.value,
    sourceFileName: pickedFile.value?.name || '',
  })
  reset()
}

function handleRetry() {
  if (pickedFile.value) {
    startImport(pickedFile.value)
  }
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
    if (!open) reset()
  },
)

onUnmounted(() => {
  abortController?.abort()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="pdf-import-backdrop"
      role="presentation"
      @mousedown.self="handleClose"
    >
      <div
        class="pdf-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-import-title"
        @keydown="handleKeydown"
      >
        <header class="pdf-import-dialog__header">
          <div>
            <h3 id="pdf-import-title" class="pdf-import-dialog__title">导入 PDF</h3>
            <p class="pdf-import-dialog__subtitle">
              嵌入文本可自动提取；扫描版 PDF 将启动本地 OCR（首次使用需联网下载约 10MB 训练数据）
            </p>
          </div>
          <button
            type="button"
            class="pdf-import-dialog__close"
            aria-label="关闭"
            @click="handleClose"
          >
            ✕
          </button>
        </header>

        <div class="pdf-import-dialog__body">
          <div
            class="pdf-import-dropzone"
            :class="{
              'pdf-import-dropzone--busy': isBusy,
              'pdf-import-dropzone--done': phase === 'done',
              'pdf-import-dropzone--error': phase === 'error',
            }"
            @click="openFilePicker"
            @drop="onDrop"
            @dragover="onDragOver"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="application/pdf,.pdf"
              class="sr-only"
              @change="onFileChange"
            />

            <template v-if="phase === 'idle' || phase === 'cancelled'">
              <div class="pdf-import-dropzone__icon">📄</div>
              <p class="pdf-import-dropzone__title">点击或拖入 PDF 文件</p>
              <p class="pdf-import-dropzone__hint">支持含文字与扫描版 PDF</p>
            </template>

            <template v-else-if="isBusy">
              <div class="pdf-import-progress">
                <p class="pdf-import-progress__phase">
                  {{ phase === 'loading' ? '正在解析…' : 'OCR 识别中…' }}
                </p>
                <div class="pdf-import-progress__bar">
                  <div
                    class="pdf-import-progress__fill"
                    :style="{ width: progressPercent + '%' }"
                  />
                </div>
                <p class="pdf-import-progress__message">{{ progressMessage }}</p>
                <p v-if="progressTotal" class="pdf-import-progress__counter">
                  {{ progressCurrent }} / {{ progressTotal }}
                </p>
              </div>
            </template>

            <template v-else-if="phase === 'done'">
              <p class="pdf-import-done__title">
                ✓ {{ resultMode === 'ocr' ? 'OCR 识别完成' : '文本提取完成' }}
                <span class="pdf-import-done__count">共 {{ resultPageCount }} 页</span>
              </p>
              <p class="pdf-import-done__filename">{{ pickedFile?.name }}</p>
              <pre class="pdf-import-done__preview">{{ previewLines.join('\n') }}…</pre>
            </template>

            <template v-else-if="phase === 'error'">
              <p class="pdf-import-error__title">✕ 解析失败</p>
              <p class="pdf-import-error__message">{{ errorMessage }}</p>
            </template>
          </div>
        </div>

        <footer class="pdf-import-dialog__footer">
          <button
            v-if="phase === 'error'"
            type="button"
            class="wpx-btn wpx-btn--ghost"
            @click="handleRetry"
          >
            重试
          </button>

          <button
            v-if="isBusy"
            type="button"
            class="wpx-btn wpx-btn--ghost"
            @click="handleCancel"
          >
            取消导入
          </button>

          <button
            v-else-if="phase !== 'idle'"
            type="button"
            class="wpx-btn wpx-btn--ghost"
            @click="handleClose"
          >
            关闭
          </button>

          <div class="pdf-import-dialog__spacer" />

          <button
            type="button"
            class="wpx-btn wpx-btn--primary"
            :disabled="!canConfirm"
            @click="handleConfirm"
          >
            插入编辑器
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pdf-import-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 200);
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.pdf-import-dialog {
  width: min(560px, 100%);
  max-height: calc(100vh - 48px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pdf-import-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.pdf-import-dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.pdf-import-dialog__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.pdf-import-dialog__close {
  border: none;
  background: transparent;
  font-size: 16px;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.pdf-import-dialog__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.pdf-import-dialog__body {
  flex: 1;
  padding: 16px 20px;
  overflow: auto;
}

.pdf-import-dropzone {
  border: 1.5px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.pdf-import-dropzone:hover {
  border-color: #8b5cf6;
  background: #f5f3ff;
}

.pdf-import-dropzone--busy {
  cursor: default;
  pointer-events: none;
  opacity: 0.95;
}

.pdf-import-dropzone--done {
  border-color: #34d399;
  background: #f0fdf4;
}

.pdf-import-dropzone--error {
  border-color: #fca5a5;
  background: #fef2f2;
}

.pdf-import-dropzone__icon {
  font-size: 32px;
}

.pdf-import-dropzone__title {
  margin: 8px 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}

.pdf-import-dropzone__hint {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.pdf-import-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.pdf-import-progress__phase {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}

.pdf-import-progress__bar {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.pdf-import-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #6366f1);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.pdf-import-progress__message {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.pdf-import-progress__counter {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}

.pdf-import-done__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #047857;
}

.pdf-import-done__count {
  margin-left: 8px;
  font-size: 12px;
  color: #64748b;
}

.pdf-import-done__filename {
  margin: 4px 0 12px;
  font-size: 12px;
  color: #94a3b8;
  word-break: break-all;
}

.pdf-import-done__preview {
  margin: 0;
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
  text-align: left;
  white-space: pre-wrap;
  max-height: 160px;
  overflow: auto;
}

.pdf-import-error__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #b91c1c;
}

.pdf-import-error__message {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7f1d1d;
  word-break: break-word;
}

.pdf-import-dialog__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #f1f5f9;
}

.pdf-import-dialog__spacer {
  flex: 1;
}

.wpx-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.wpx-btn--ghost {
  background: #fff;
  border-color: #e2e8f0;
  color: #475569;
}

.wpx-btn--ghost:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a;
}

.wpx-btn--primary {
  background: #8b5cf6;
  color: #fff;
  border-color: #8b5cf6;
}

.wpx-btn--primary:hover:not(:disabled) {
  background: #7c3aed;
  border-color: #7c3aed;
}

.wpx-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>