<script setup>
import { computed, ref, watch } from 'vue'
import { analyzeDocument, saveDocument } from '@/utils/libraryApi'
import { useLibraryStore } from '@/stores/library'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  content: {
    type: String,
    default: '',
  },
  defaultTitle: {
    type: String,
    default: '未命名文档',
  },
})

const emit = defineEmits(['close', 'saved'])

const libraryStore = useLibraryStore()

const title = ref('')
const suggestedPath = ref('')
const path = ref('')
const tags = ref([])
const tagInput = ref('')
const summary = ref('')
const analyzing = ref(false)
const saving = ref(false)
const error = ref('')

const pathModified = computed(
  () => path.value.trim() !== suggestedPath.value.trim(),
)

function resetForm() {
  title.value = props.defaultTitle
  suggestedPath.value = ''
  path.value = ''
  tags.value = []
  tagInput.value = ''
  summary.value = ''
  error.value = ''
}

async function runAnalyze() {
  if (!props.content.trim()) {
    error.value = '文档内容为空，无法分析'
    return
  }

  analyzing.value = true
  error.value = ''

  try {
    const result = await analyzeDocument({
      content: props.content,
      title: title.value || props.defaultTitle,
      pathCorrections: libraryStore.getPathCorrections(),
    })

    title.value = result.title || props.defaultTitle
    suggestedPath.value = result.path || '未分类'
    path.value = result.path || '未分类'
    tags.value = Array.isArray(result.tags) ? [...result.tags] : []
    summary.value = result.summary || ''
  } catch (err) {
    error.value = err.message || '分析失败，请确认 library-service 已启动'
  } finally {
    analyzing.value = false
  }
}

function applySuggestedPath() {
  path.value = suggestedPath.value
}

function addTag() {
  const value = tagInput.value.trim()
  if (!value || tags.value.includes(value)) {
    tagInput.value = ''
    return
  }
  tags.value.push(value)
  tagInput.value = ''
}

function removeTag(tag) {
  tags.value = tags.value.filter((item) => item !== tag)
}

function handleTagKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addTag()
  }
}

function handleClose() {
  if (saving.value) return
  emit('close')
}

async function handleSave() {
  if (!props.content.trim()) {
    error.value = '文档内容为空，无法保存'
    return
  }

  if (!path.value.trim()) {
    error.value = '请填写分类路径'
    return
  }

  saving.value = true
  error.value = ''

  try {
    const finalPath = path.value.trim()
    const result = await saveDocument({
      title: title.value.trim() || props.defaultTitle,
      content: props.content,
      path: finalPath,
      tags: tags.value,
      summary: summary.value.trim(),
      suggestedPath: suggestedPath.value.trim(),
    })

    if (pathModified.value) {
      libraryStore.recordPathCorrection({
        suggestedPath: suggestedPath.value.trim(),
        chosenPath: finalPath,
        title: title.value.trim(),
        tags: tags.value,
      })
    }

    emit('saved', result.item)
    emit('close')
  } catch (err) {
    error.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    resetForm()
    title.value = props.defaultTitle
    runAnalyze()
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="save-dialog">
      <div
        v-if="visible"
        class="save-dialog-backdrop"
        @click.self="handleClose"
      >
        <div
          class="save-dialog"
          role="dialog"
          aria-labelledby="save-dialog-title"
          aria-modal="true"
          @click.stop
        >
        <header class="save-dialog__header">
          <div>
            <h2 id="save-dialog-title" class="save-dialog__title">保存到文库</h2>
            <p class="save-dialog__subtitle">AI 将建议分类路径、标签与摘要，你可确认或手动修改</p>
          </div>
          <button
            type="button"
            class="save-dialog__close"
            aria-label="关闭"
            :disabled="saving"
            @click="handleClose"
          >
            ×
          </button>
        </header>

        <div class="save-dialog__body">
          <p v-if="error" class="save-dialog__error">{{ error }}</p>

          <div v-if="analyzing" class="save-dialog__loading">
            <span class="save-dialog__spinner" aria-hidden="true" />
            正在分析文档…
          </div>

          <template v-else>
            <label class="save-dialog__field">
              <span class="save-dialog__label">文档标题</span>
              <input
                v-model="title"
                type="text"
                class="save-dialog__input wpx-input"
                placeholder="输入文档标题"
                :disabled="saving"
              />
            </label>

            <div class="save-dialog__field">
              <div class="save-dialog__label-row">
                <span class="save-dialog__label">分类路径</span>
                <button
                  type="button"
                  class="save-dialog__link-btn"
                  :disabled="!suggestedPath || saving"
                  @click="applySuggestedPath"
                >
                  采用 AI 建议
                </button>
              </div>
              <input
                v-model="path"
                type="text"
                class="save-dialog__input wpx-input"
                placeholder="如：工作/周报"
                :disabled="saving"
              />
              <p v-if="suggestedPath" class="save-dialog__hint">
                AI 建议：<code>{{ suggestedPath }}</code>
                <span v-if="pathModified" class="save-dialog__modified">（已手动修改）</span>
              </p>
            </div>

            <div class="save-dialog__field">
              <span class="save-dialog__label">标签</span>
              <div class="save-dialog__tags">
                <span
                  v-for="tag in tags"
                  :key="tag"
                  class="save-dialog__tag"
                >
                  {{ tag }}
                  <button
                    type="button"
                    class="save-dialog__tag-remove"
                    aria-label="移除标签"
                    :disabled="saving"
                    @click="removeTag(tag)"
                  >
                    ×
                  </button>
                </span>
              </div>
              <div class="save-dialog__tag-input-row">
                <input
                  v-model="tagInput"
                  type="text"
                  class="save-dialog__input wpx-input"
                  placeholder="添加标签，Enter 确认"
                  :disabled="saving"
                  @keydown="handleTagKeydown"
                />
                <button
                  type="button"
                  class="save-dialog__secondary-btn wpx-btn"
                  :disabled="saving || !tagInput.trim()"
                  @click="addTag"
                >
                  添加
                </button>
              </div>
            </div>

            <label class="save-dialog__field">
              <span class="save-dialog__label">摘要</span>
              <textarea
                v-model="summary"
                class="save-dialog__textarea wpx-input"
                rows="4"
                placeholder="AI 生成的文档摘要"
                :disabled="saving"
              />
            </label>
          </template>
        </div>

        <footer class="save-dialog__footer">
          <button
            type="button"
            class="save-dialog__cancel-btn wpx-btn"
            :disabled="saving"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="save-dialog__primary-btn wpx-btn"
            :disabled="analyzing || saving || !content.trim()"
            @click="handleSave"
          >
            {{ saving ? '保存中…' : '确认保存' }}
          </button>
        </footer>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.save-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.save-dialog {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(90vh, 720px);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.save-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.save-dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.save-dialog__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
}

.save-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.save-dialog__close:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.save-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-dialog__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.save-dialog__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0;
  font-size: 14px;
  color: #64748b;
}

.save-dialog__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #e2e8f0;
  border-top-color: #7c3aed;
  border-radius: 999px;
  animation: save-dialog-spin 0.8s linear infinite;
}

@keyframes save-dialog-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-dialog__spinner {
    animation: none;
    border-top-color: #7c3aed;
    opacity: 0.8;
  }
}

.save-dialog__error {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}

.save-dialog__field {
  display: block;
  margin-bottom: 16px;
}

.save-dialog__field:last-child {
  margin-bottom: 0;
}

.save-dialog__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.save-dialog__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.save-dialog__label-row .save-dialog__label {
  margin-bottom: 0;
}

.save-dialog__input,
.save-dialog__textarea {
  width: 100%;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}

.save-dialog__input:disabled,
.save-dialog__textarea:disabled {
  background: #f8fafc;
  color: #94a3b8;
}

.save-dialog__textarea {
  resize: vertical;
  min-height: 96px;
  line-height: 1.6;
}

.save-dialog__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #64748b;
}

.save-dialog__hint code {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #334155;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 11px;
}

.save-dialog__modified {
  color: #7c3aed;
}

.save-dialog__link-btn {
  border: none;
  background: transparent;
  color: #7c3aed;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.save-dialog__link-btn:hover:not(:disabled) {
  color: #6d28d9;
  text-decoration: underline;
}

.save-dialog__link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-dialog__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.save-dialog__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 12px;
}

.save-dialog__tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #7c3aed;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.save-dialog__tag-remove:hover:not(:disabled) {
  background: rgba(124, 58, 237, 0.15);
}

.save-dialog__tag-input-row {
  display: flex;
  gap: 8px;
}

.save-dialog__tag-input-row .save-dialog__input {
  flex: 1;
}

.save-dialog__secondary-btn {
  flex-shrink: 0;
  padding: 0 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #334155;
  font-size: 13px;
  cursor: pointer;
}

.save-dialog__secondary-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.save-dialog__secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid #f1f5f9;
}

.save-dialog__cancel-btn,
.save-dialog__primary-btn {
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.save-dialog__cancel-btn {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}

.save-dialog__cancel-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.save-dialog__primary-btn {
  border: none;
  background: #7c3aed;
  color: #fff;
}

.save-dialog__primary-btn:hover:not(:disabled) {
  background: #6d28d9;
}

.save-dialog__cancel-btn:disabled,
.save-dialog__primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
