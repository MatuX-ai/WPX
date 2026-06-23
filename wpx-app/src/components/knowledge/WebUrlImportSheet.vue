<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  preview: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'confirm', 'importToEditor'])

const textMode = ref('all')
const imageMode = ref('all')
const selectedParagraphIds = ref(new Set())
const selectedImageIds = ref(new Set())
const minImageWidth = ref(0)
const minImageHeight = ref(0)

const paragraphList = computed(() => props.preview?.paragraphs ?? [])
const imageList = computed(() => props.preview?.images ?? [])

const kindLabels = {
  h1: '标题',
  h2: '小标题',
  h3: '小标题',
  h4: '小标题',
  h5: '小标题',
  h6: '小标题',
  li: '列表',
  blockquote: '引用',
  pre: '代码',
  paragraph: '段落',
}

function kindLabel(kind) {
  return kindLabels[kind] || '段落'
}

function truncate(text, max = 120) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function formatImageSize(image) {
  if (image.width && image.height) return `${image.width}×${image.height}`
  if (image.width) return `宽 ${image.width}`
  if (image.height) return `高 ${image.height}`
  return '尺寸未知'
}

function imageMatchesMinSize(image) {
  const minW = Number(minImageWidth.value) || 0
  const minH = Number(minImageHeight.value) || 0
  if (minW <= 0 && minH <= 0) return true
  if (!image.width && !image.height) return true
  if (minW > 0 && image.width > 0 && image.width < minW) return false
  if (minH > 0 && image.height > 0 && image.height < minH) return false
  return true
}

function resetSelectionState() {
  textMode.value = 'all'
  imageMode.value = imageList.value.length ? 'all' : 'none'
  selectedParagraphIds.value = new Set(paragraphList.value.map((item) => item.id))
  selectedImageIds.value = new Set(imageList.value.map((item) => item.id))
  minImageWidth.value = 0
  minImageHeight.value = 0
}

watch(
  () => props.preview,
  (preview) => {
    if (!preview) return
    resetSelectionState()
  },
  { immediate: true },
)

watch(textMode, (mode) => {
  if (mode === 'all') {
    selectedParagraphIds.value = new Set(paragraphList.value.map((item) => item.id))
  }
})

watch(imageMode, (mode) => {
  if (mode === 'all') {
    selectedImageIds.value = new Set(imageList.value.map((item) => item.id))
  } else if (mode === 'none') {
    selectedImageIds.value = new Set()
  }
})

function toggleParagraph(id) {
  const next = new Set(selectedParagraphIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedParagraphIds.value = next
  textMode.value = 'custom'
}

function toggleImage(id) {
  const next = new Set(selectedImageIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedImageIds.value = next
  imageMode.value = 'custom'
}

function selectAllParagraphs() {
  textMode.value = 'all'
  selectedParagraphIds.value = new Set(paragraphList.value.map((item) => item.id))
}

function selectAllImages() {
  imageMode.value = 'all'
  selectedImageIds.value = new Set(imageList.value.map((item) => item.id))
}

function clearImages() {
  imageMode.value = 'none'
  selectedImageIds.value = new Set()
}

function selectImagesByMinSize() {
  imageMode.value = 'custom'
  selectedImageIds.value = new Set(
    imageList.value.filter((image) => imageMatchesMinSize(image)).map((image) => image.id),
  )
}

function buildSelection() {
  const paragraphs =
    textMode.value === 'all'
      ? paragraphList.value
      : paragraphList.value.filter((item) => selectedParagraphIds.value.has(item.id))

  let images = []
  if (imageMode.value === 'all') {
    images = imageList.value
  } else if (imageMode.value === 'custom') {
    images = imageList.value.filter((item) => selectedImageIds.value.has(item.id))
  }

  return {
    title: props.preview.title,
    sourceUrl: props.preview.url,
    paragraphs,
    images,
  }
}

function handleConfirm() {
  if (!props.preview || props.loading || props.submitting) return
  emit('confirm', buildSelection())
}

function handleImportToEditor() {
  if (!props.preview || props.loading || props.submitting) return
  emit('importToEditor', buildSelection())
}
</script>

<template>
  <section v-if="open" class="web-url-import" aria-label="选择导入内容">
    <header class="web-url-import__header">
      <div>
        <h3 class="web-url-import__title">{{ preview?.title || '选择导入内容' }}</h3>
        <p v-if="preview?.url" class="web-url-import__url">{{ preview.url }}</p>
      </div>
      <button type="button" class="web-url-import__close" aria-label="关闭" @click="emit('close')">
        ×
      </button>
    </header>

    <div v-if="loading" class="web-url-import__loading">正在分析网页…</div>

    <div v-else class="web-url-import__body">
      <section class="web-url-import__section">
        <div class="web-url-import__section-head">
          <h4 class="web-url-import__section-title">正文（{{ paragraphList.length }} 段）</h4>
          <div class="web-url-import__actions">
            <button type="button" class="web-url-import__link" @click="selectAllParagraphs">全部</button>
          </div>
        </div>

        <div class="web-url-import__mode">
          <label class="web-url-import__radio">
            <input v-model="textMode" type="radio" value="all" />
            导入全部正文
          </label>
          <label class="web-url-import__radio">
            <input v-model="textMode" type="radio" value="custom" />
            自选段落
          </label>
        </div>

        <ul v-if="textMode === 'custom'" class="web-url-import__paragraphs">
          <li v-for="item in paragraphList" :key="item.id">
            <label class="web-url-import__check">
              <input
                type="checkbox"
                :checked="selectedParagraphIds.has(item.id)"
                @change="toggleParagraph(item.id)"
              />
              <span class="web-url-import__check-main">
                <span class="web-url-import__badge">{{ kindLabel(item.kind) }}</span>
                <span class="web-url-import__text">{{ truncate(item.text) }}</span>
              </span>
            </label>
          </li>
        </ul>
      </section>

      <section v-if="imageList.length" class="web-url-import__section">
        <div class="web-url-import__section-head">
          <h4 class="web-url-import__section-title">图片（{{ imageList.length }} 张）</h4>
          <div class="web-url-import__actions">
            <button type="button" class="web-url-import__link" @click="selectAllImages">全部</button>
            <button type="button" class="web-url-import__link" @click="clearImages">不导入</button>
          </div>
        </div>

        <div class="web-url-import__mode">
          <label class="web-url-import__radio">
            <input v-model="imageMode" type="radio" value="all" />
            全部图片
          </label>
          <label class="web-url-import__radio">
            <input v-model="imageMode" type="radio" value="custom" />
            自选图片
          </label>
          <label class="web-url-import__radio">
            <input v-model="imageMode" type="radio" value="none" />
            不导入图片
          </label>
        </div>

        <div class="web-url-import__size-filter">
          <label class="web-url-import__size-field">
            最小宽度
            <input v-model.number="minImageWidth" type="number" min="0" step="1" />
          </label>
          <label class="web-url-import__size-field">
            最小高度
            <input v-model.number="minImageHeight" type="number" min="0" step="1" />
          </label>
          <button type="button" class="web-url-import__link" @click="selectImagesByMinSize">
            选中符合尺寸
          </button>
        </div>

        <div
          v-if="imageMode === 'custom' || imageMode === 'all'"
          class="web-url-import__images"
          :class="{ 'web-url-import__images--readonly': imageMode === 'all' }"
        >
          <label
            v-for="image in imageList"
            :key="image.id"
            class="web-url-import__image"
            :class="{ 'web-url-import__image--dim': !imageMatchesMinSize(image) }"
          >
            <input
              v-if="imageMode === 'custom'"
              type="checkbox"
              :checked="selectedImageIds.has(image.id)"
              @change="toggleImage(image.id)"
            />
            <img :src="image.url" :alt="image.alt || '网页图片'" loading="lazy" />
            <span class="web-url-import__image-meta">
              {{ formatImageSize(image) }}
            </span>
          </label>
        </div>
      </section>
    </div>

    <footer class="web-url-import__footer">
      <p v-if="errorMessage" class="web-url-import__error" role="alert">{{ errorMessage }}</p>
      <div class="web-url-import__footer-actions">
        <button
          type="button"
          class="web-url-import__btn web-url-import__btn--ghost"
          :disabled="submitting"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          class="web-url-import__btn web-url-import__btn--secondary"
          :disabled="loading || submitting || !preview"
          @click="handleImportToEditor"
        >
          {{ submitting ? '处理中…' : '导入到编辑区' }}
        </button>
        <button
          type="button"
          class="web-url-import__btn web-url-import__btn--primary"
          :disabled="loading || submitting || !preview"
          @click="handleConfirm"
        >
          {{ submitting ? '保存中…' : '保存到资料库' }}
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.web-url-import {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  flex-direction: column;
  background: #fff;
  pointer-events: auto;
}

.web-url-import__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.web-url-import__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.web-url-import__url {
  margin: 4px 0 0;
  font-size: 11px;
  color: #94a3b8;
  word-break: break-all;
}

.web-url-import__close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.web-url-import__close:hover {
  background: #f1f5f9;
}

.web-url-import__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #64748b;
}

.web-url-import__body {
  flex: 1;
  overflow: auto;
  padding: 12px 20px 16px;
}

.web-url-import__section + .web-url-import__section {
  margin-top: 18px;
}

.web-url-import__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.web-url-import__section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.web-url-import__actions {
  display: flex;
  gap: 8px;
}

.web-url-import__link {
  border: none;
  background: transparent;
  color: #7c3aed;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.web-url-import__mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.web-url-import__radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #475569;
}

.web-url-import__paragraphs {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.web-url-import__check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
}

.web-url-import__check-main {
  min-width: 0;
}

.web-url-import__badge {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 10px;
}

.web-url-import__text {
  line-height: 1.5;
  word-break: break-word;
}

.web-url-import__size-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
  margin-top: 10px;
}

.web-url-import__size-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #64748b;
}

.web-url-import__size-field input {
  width: 72px;
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
}

.web-url-import__images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.web-url-import__images--readonly .web-url-import__image {
  cursor: default;
}

.web-url-import__image {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
}

.web-url-import__image--dim {
  opacity: 0.55;
}

.web-url-import__image img {
  width: 100%;
  height: 72px;
  object-fit: cover;
  border-radius: 4px;
  background: #f8fafc;
}

.web-url-import__image-meta {
  font-size: 10px;
  color: #94a3b8;
}

.web-url-import__footer {
  flex-shrink: 0;
  padding: 12px 20px 16px;
  border-top: 1px solid #f1f5f9;
  background: #fff;
}

.web-url-import__error {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}

.web-url-import__footer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.web-url-import__btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.web-url-import__btn--ghost {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}

.web-url-import__btn--secondary {
  border: 1px solid #ddd6fe;
  background: #f5f3ff;
  color: #7c3aed;
}

.web-url-import__btn--primary {
  border: none;
  background: #8b5cf6;
  color: #fff;
}

.web-url-import__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
