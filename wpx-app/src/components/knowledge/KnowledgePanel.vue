<script setup>
import { computed, onMounted, onUnmounted, ref, watch, Teleport } from 'vue'
import { useRouter } from 'vue-router'
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_MIME_HINT,
  buildWebImportEditorContent,
  buildWebImportPayload,
  buildWebImportSelection,
  fetchKnowledgeList,
  fetchKnowledgePreview,
  fetchKnowledgeUrlPreview,
  onKnowledgeUpdated,
  shouldPromptWebUrlImport,
  uploadKnowledgeFile,
  uploadKnowledgeUrl,
} from '@/utils/knowledgeApi'
import WebUrlImportSheet from '@/components/knowledge/WebUrlImportSheet.vue'
import { useEditorOverlayOptional } from '@/composables/useEditorOverlay'
import { useEscapeKey } from '@/composables/useEscapeKey'
import { useToast } from '@/composables/useToast'
import { useEditorStore } from '@/stores/editor'
import { isElectron } from '@/utils/electron'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  embedded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const router = useRouter()
const editorStore = useEditorStore()
const overlay = useEditorOverlayOptional()
const toast = useToast()

const items = ref([])
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const dragOver = ref(false)
const urlInput = ref('')
const preview = ref(null)
const previewLoading = ref(false)
const fileInputRef = ref(null)
const urlPreview = ref(null)
const urlImportOpen = ref(false)
const urlImportSubmitting = ref(false)
const urlImportError = ref('')
const isAntiBotError = ref(false)

const typeLabels = {
  pdf: 'PDF',
  word: 'Word',
  markdown: 'Markdown',
  text: 'TXT',
  web: '网页',
}

const parseStatusLabels = {
  pending: '解析中',
  parsed: '',
  failed: '解析失败',
}

function formatTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function typeLabel(type) {
  return typeLabels[type] || type || '未知'
}

function parseStatusLabel(status) {
  return parseStatusLabels[status] || ''
}

const hasPreview = computed(() => Boolean(preview.value))
const hasUrlImport = computed(() => urlImportOpen.value)
const canImportToEditor = computed(
  () => Boolean(preview.value?.content?.trim()) && !previewLoading.value,
)

function buildImportPayload(mode) {
  return {
    mode,
    content: preview.value.content,
    title: preview.value.filename,
    type: preview.value.type,
  }
}

function insertToEditor() {
  if (!canImportToEditor.value) return
  editorStore.requestKnowledgeImport(buildImportPayload('insert'))
  if (!overlay) {
    router.push({ name: 'editor' })
  }
  closePreview()
}

function openAsNewDocument() {
  if (!canImportToEditor.value) return
  editorStore.requestKnowledgeImport(buildImportPayload('open'))
  if (!overlay) {
    router.push({ name: 'editor' })
  } else {
    overlay.closeKnowledgePanel()
  }
  closePreview()
}

async function importWebContent(webImport) {
  const result = await uploadKnowledgeUrl(webImport.sourceUrl, webImport)
  const item = result?.item
  if (item?.parseStatus === 'failed') {
    isAntiBotError.value = item.errorMessage?.includes('请用其他方法') || item.errorMessage?.includes('动态加载') || false
    error.value = item.errorMessage || 'URL 抓取失败'
    return false
  }

  isAntiBotError.value = false

  urlInput.value = ''
  closeUrlImport()
  await loadList()
  return true
}

function setFetchError(err, fallback = 'URL 抓取失败') {
  isAntiBotError.value = err?.code === 'ANTI_BOT' || err?.code === 'DYNAMIC_PAGE'
  error.value = err?.message || fallback
}

async function submitUrl() {
  const url = urlInput.value.trim()
  if (!url) return

  uploading.value = true
  error.value = ''
  isAntiBotError.value = false
  try {
    const previewData = await fetchKnowledgeUrlPreview(url)

    if (shouldPromptWebUrlImport(previewData)) {
      closePreview()
      urlPreview.value = previewData
      urlImportOpen.value = true
      urlImportError.value = ''
      return
    }

    const webImport = buildWebImportPayload(previewData, {
      title: previewData.title,
      sourceUrl: previewData.url,
      paragraphs: previewData.paragraphs,
      images: previewData.images,
    })
    await importWebContent(webImport)
  } catch (err) {
    setFetchError(err)
  } finally {
    uploading.value = false
  }
}

function closeUrlImport() {
  urlImportOpen.value = false
  urlPreview.value = null
  urlImportError.value = ''
  urlImportSubmitting.value = false
}

async function confirmUrlImport(selection) {
  if (!urlPreview.value || urlImportSubmitting.value) return

  urlImportSubmitting.value = true
  urlImportError.value = ''
  try {
    buildWebImportSelection(urlPreview.value, selection)
    const webImport = buildWebImportPayload(urlPreview.value, selection)
    const ok = await importWebContent(webImport)
    if (ok) {
      toast.success('已保存到资料库')
    } else {
      urlImportError.value = error.value || '保存失败'
    }
  } catch (err) {
    urlImportError.value = err.message || '保存失败'
  } finally {
    urlImportSubmitting.value = false
  }
}

function importUrlSelectionToEditor(selection) {
  if (!urlPreview.value || urlImportSubmitting.value) return

  urlImportError.value = ''
  try {
    buildWebImportSelection(urlPreview.value, selection)
    const content = buildWebImportEditorContent(urlPreview.value, selection)
    const title = selection.title || urlPreview.value.title

    editorStore.requestKnowledgeImport({
      mode: 'insert',
      content,
      title,
      type: 'markdown',
    })

    urlInput.value = ''
    closeUrlImport()
    toast.success('已导入编辑区，可继续抓取其他网页')
  } catch (err) {
    urlImportError.value = err.message || '导入失败'
  }
}

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchKnowledgeList()
  } catch (err) {
    error.value = err.message || '加载资料列表失败'
  } finally {
    loading.value = false
  }
}

async function handleFiles(files) {
  const list = Array.from(files || [])
  if (!list.length) return

  uploading.value = true
  error.value = ''

  try {
    for (const file of list) {
      await uploadKnowledgeFile(file)
    }
    await loadList()
  } catch (err) {
    error.value = err.message || '上传失败'
  } finally {
    uploading.value = false
    dragOver.value = false
  }
}

function onFileChange(event) {
  handleFiles(event.target.files)
  event.target.value = ''
}

function onDrop(event) {
  event.preventDefault()
  dragOver.value = false
  handleFiles(event.dataTransfer?.files)
}

function onDragOver(event) {
  event.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function onUrlPaste(event) {
  const text = event.clipboardData?.getData('text')?.trim()
  if (!text) return
  const looksLikeUrl = /^https?:\/\//i.test(text)
  if (!looksLikeUrl) return
  event.preventDefault()
  urlInput.value = text
  submitUrl()
}

async function openPreview(item) {
  previewLoading.value = true
  error.value = ''
  try {
    preview.value = await fetchKnowledgePreview(item.id)
  } catch (err) {
    error.value = err.message || '预览加载失败'
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  preview.value = null
}

function handleClose() {
  closePreview()
  closeUrlImport()
  emit('close')
}

function handlePanelEscape() {
  if (hasUrlImport.value) {
    closeUrlImport()
    return
  }
  if (hasPreview.value || previewLoading.value) {
    closePreview()
    return
  }
  handleClose()
}

useEscapeKey(() => props.open, handlePanelEscape)

let unsubscribeKnowledgeUpdated = null

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) loadList()
  },
)

onMounted(() => {
  if (props.open) loadList()

  if (isElectron()) {
    unsubscribeKnowledgeUpdated = onKnowledgeUpdated(() => {
      loadList()
    })
  }
})

onUnmounted(() => {
  unsubscribeKnowledgeUpdated?.()
  unsubscribeKnowledgeUpdated = null
})
</script>

<template>
  <component :is="embedded ? 'div' : Teleport" :to="embedded ? undefined : 'body'">
    <Transition v-if="!embedded" name="knowledge-backdrop">
      <div
        v-if="open"
        class="knowledge-backdrop"
        aria-hidden="true"
        @click="handleClose"
      />
    </Transition>

    <aside
      class="knowledge-panel"
      :class="{
        'knowledge-panel--open': open || embedded,
        'knowledge-panel--embedded': embedded,
      }"
      aria-label="资料库"
    >
      <header class="knowledge-panel__header">
        <div>
          <h2 class="knowledge-panel__title">资料库</h2>
          <p class="knowledge-panel__subtitle">上传文档或粘贴 URL，自动解析并向量化</p>
        </div>
        <button type="button" class="knowledge-panel__close" aria-label="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <div class="knowledge-panel__body">
        <section
          class="knowledge-dropzone"
          :class="{ 'knowledge-dropzone--active': dragOver, 'knowledge-dropzone--busy': uploading }"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @click="openFilePicker"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="sr-only"
            :accept="ACCEPTED_FILE_TYPES"
            multiple
            @change="onFileChange"
          />
          <div class="knowledge-dropzone__icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 16V4m0 0L8 8m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round" />
            </svg>
          </div>
          <p class="knowledge-dropzone__title">
            {{ uploading ? '正在上传并解析…' : '拖拽文件到此处，或点击选择' }}
          </p>
          <p class="knowledge-dropzone__hint">支持 {{ ACCEPTED_MIME_HINT }}</p>
        </section>

        <section class="knowledge-url">
          <label class="knowledge-url__label" for="knowledge-url-input">网页 URL</label>
          <div class="knowledge-url__row">
            <input
              id="knowledge-url-input"
              v-model="urlInput"
              type="url"
              class="knowledge-url__input"
              placeholder="粘贴 URL，复杂页面可自选正文与图片"
              :disabled="uploading"
              @paste="onUrlPaste"
              @keydown.enter.prevent="submitUrl"
            />
            <button
              type="button"
              class="knowledge-url__btn"
              :disabled="uploading || !urlInput.trim()"
              @click="submitUrl"
            >
              抓取
            </button>
          </div>
        </section>

        <p v-if="error" class="knowledge-panel__error" :class="{ 'knowledge-panel__error--soft': isAntiBotError }">
          {{ error }}
        </p>

        <section class="knowledge-list">
          <div class="knowledge-list__head">
            <h3 class="knowledge-list__title">已上传资料</h3>
            <span v-if="items.length" class="knowledge-list__count">{{ items.length }} 项</span>
          </div>

          <div v-if="loading" class="knowledge-list__empty">加载中…</div>
          <div v-else-if="!items.length" class="knowledge-list__empty">暂无资料，请先上传</div>

          <ul v-else class="knowledge-list__items">
            <li v-for="item in items" :key="item.id">
              <button
                type="button"
                class="knowledge-item"
                :class="{ 'knowledge-item--active': preview?.id === item.id }"
                @click="openPreview(item)"
              >
                <span class="knowledge-item__icon" :data-type="item.type">
                  {{ typeLabel(item.type).charAt(0) }}
                </span>
                <span class="knowledge-item__main">
                  <span class="knowledge-item__name" :title="item.filename">{{ item.filename }}</span>
                  <span class="knowledge-item__meta">
                    <span class="knowledge-item__type">{{ typeLabel(item.type) }}</span>
                    <span v-if="parseStatusLabel(item.parseStatus)" class="knowledge-item__dot">·</span>
                    <span
                      v-if="parseStatusLabel(item.parseStatus)"
                      class="knowledge-item__status"
                      :class="{ 'knowledge-item__status--failed': item.parseStatus === 'failed' }"
                    >
                      {{ parseStatusLabel(item.parseStatus) }}
                    </span>
                    <span class="knowledge-item__dot">·</span>
                    <span class="knowledge-item__time">{{ formatTime(item.uploadedAt) }}</span>
                  </span>
                  <span
                    v-if="item.parseStatus === 'failed' && item.errorMessage"
                    class="knowledge-item__error"
                  >
                    {{ item.errorMessage }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>

      <WebUrlImportSheet
        :open="urlImportOpen"
        :loading="uploading && !urlPreview"
        :submitting="urlImportSubmitting"
        :error-message="urlImportError"
        :preview="urlPreview"
        @close="closeUrlImport"
        @confirm="confirmUrlImport"
        @import-to-editor="importUrlSelectionToEditor"
      />

      <Transition name="knowledge-preview">
        <section v-if="hasPreview || previewLoading" class="knowledge-preview">
          <header class="knowledge-preview__header">
            <div class="knowledge-preview__info">
              <h3 class="knowledge-preview__title">{{ preview?.filename || '加载预览…' }}</h3>
              <p v-if="preview" class="knowledge-preview__meta">
                {{ typeLabel(preview.type) }} · {{ formatTime(preview.uploadedAt) }}
              </p>
            </div>
            <div v-if="!previewLoading && preview" class="knowledge-preview__actions">
              <button
                type="button"
                class="knowledge-preview__action"
                :disabled="!canImportToEditor"
                @click="insertToEditor"
              >
                插入编辑器
              </button>
              <button
                type="button"
                class="knowledge-preview__action knowledge-preview__action--primary"
                :disabled="!canImportToEditor"
                @click="openAsNewDocument"
              >
                作为新文档打开
              </button>
            </div>
            <button type="button" class="knowledge-preview__close" aria-label="关闭预览" @click="closePreview">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </header>
          <div class="knowledge-preview__body">
            <p v-if="previewLoading" class="knowledge-preview__loading">加载中…</p>
            <pre v-else class="knowledge-preview__content">{{ preview.content }}</pre>
          </div>
        </section>
      </Transition>
    </aside>
  </component>
</template>

<style scoped>
.knowledge-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-knowledge-backdrop);
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}

.knowledge-backdrop-enter-active,
.knowledge-backdrop-leave-active {
  transition: opacity 0.25s ease;
}

.knowledge-backdrop-enter-from,
.knowledge-backdrop-leave-to {
  opacity: 0;
}

.knowledge-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-knowledge-panel);
  display: flex;
  flex-direction: column;
  width: min(var(--knowledge-panel-width, 320px), 92vw);
  height: 100vh;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  box-shadow: 8px 0 32px rgba(15, 23, 42, 0.12);
  transform: translateX(-100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  pointer-events: auto;
}

.knowledge-panel--open {
  transform: translateX(0);
}

.knowledge-panel--embedded {
  position: relative;
  width: 100%;
  max-width: none;
  height: 100%;
  min-height: 0;
  transform: none;
  box-shadow: none;
  border-right: none;
}

.knowledge-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.knowledge-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.knowledge-panel__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
}

.knowledge-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.knowledge-panel__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.knowledge-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.knowledge-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  border: 1.5px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.knowledge-dropzone:hover,
.knowledge-dropzone--active {
  border-color: #8b5cf6;
  background: #f5f3ff;
}

.knowledge-dropzone--busy {
  pointer-events: none;
  opacity: 0.7;
}

.knowledge-dropzone__icon {
  color: #8b5cf6;
}

.knowledge-dropzone__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}

.knowledge-dropzone__hint {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.knowledge-url {
  margin-top: 16px;
}

.knowledge-url__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

.knowledge-url__row {
  display: flex;
  gap: 8px;
}

.knowledge-url__input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.knowledge-url__input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.knowledge-url__btn {
  flex-shrink: 0;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: #8b5cf6;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.knowledge-url__btn:hover:not(:disabled) {
  background: #7c3aed;
}

.knowledge-url__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.knowledge-panel__error {
  margin: 12px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}

.knowledge-panel__error--soft {
  background: #fff7ed;
  color: #c2410c;
}

.knowledge-list {
  margin-top: 20px;
}

.knowledge-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.knowledge-list__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.knowledge-list__count {
  font-size: 12px;
  color: #94a3b8;
}

.knowledge-list__empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

.knowledge-list__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.knowledge-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.knowledge-item:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.knowledge-item--active {
  background: #f5f3ff;
  border-color: #ddd6fe;
}

.knowledge-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 13px;
  font-weight: 600;
}

.knowledge-item__icon[data-type='pdf'] {
  background: #fee2e2;
  color: #dc2626;
}

.knowledge-item__icon[data-type='word'] {
  background: #dbeafe;
  color: #2563eb;
}

.knowledge-item__icon[data-type='web'] {
  background: #dcfce7;
  color: #16a34a;
}

.knowledge-item__main {
  min-width: 0;
  flex: 1;
}

.knowledge-item__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
}

.knowledge-item__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
}

.knowledge-item__status--failed {
  color: #dc2626;
}

.knowledge-item__error {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: #dc2626;
  white-space: normal;
  word-break: break-word;
}

.knowledge-preview {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.knowledge-preview-enter-active,
.knowledge-preview-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.knowledge-preview-enter-from,
.knowledge-preview-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.knowledge-preview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.knowledge-preview__info {
  min-width: 0;
  flex: 1;
}

.knowledge-preview__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.knowledge-preview__action {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.knowledge-preview__action:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a;
}

.knowledge-preview__action--primary {
  border-color: #ddd6fe;
  background: #f5f3ff;
  color: #7c3aed;
}

.knowledge-preview__action--primary:hover:not(:disabled) {
  background: #ede9fe;
  border-color: #c4b5fd;
  color: #6d28d9;
}

.knowledge-preview__action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.knowledge-preview__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-all;
}

.knowledge-preview__meta {
  margin: 4px 0 0;
  font-size: 11px;
  color: #94a3b8;
}

.knowledge-preview__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.knowledge-preview__close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.knowledge-preview__body {
  flex: 1;
  overflow: auto;
  padding: 16px 20px 24px;
}

.knowledge-preview__loading {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.knowledge-preview__content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
  color: #334155;
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
