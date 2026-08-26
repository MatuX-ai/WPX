<script setup>
import { computed, ref, watch } from 'vue'
import { analyzeDocument, saveDocument } from '@/utils/libraryApi'
import {
  isLocalSaveAvailable,
  pickLocalSavePath,
  replacePathExtension,
  saveTextToLocalPath,
  writeBinaryToLocalFile,
} from '@/utils/documentFile'
import { exportBlobViaApi } from '@/utils/documentExport'
import {
  hasMarkdownTable,
  markdownToSpreadsheetBytes,
  bytesToBase64,
  isSpreadsheetExtension,
  defaultFormatFromSourceExtension,
} from '@/utils/exportTableToXls'
import { useLibraryStore } from '@/stores/library'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { getElectronAPI, isElectron } from '@/utils/electron'

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
const appStore = useAppStore()
const toast = useToast()

/** 文档类格式 */
const DOC_FORMAT_OPTIONS = [
  { value: 'md', label: 'Markdown (.md)', needsExport: false, kind: 'doc' },
  { value: 'txt', label: '纯文本 (.txt)', needsExport: false, kind: 'doc' },
  { value: 'docx', label: 'Word (.docx)', needsExport: true, kind: 'doc' },
  { value: 'pdf', label: 'PDF (.pdf)', needsExport: true, kind: 'doc' },
  { value: 'html', label: 'HTML (.html)', needsExport: true, kind: 'doc' },
]

/** 表格类格式（Excel 打开或文档含表格时优先展示） */
const SHEET_FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel (.xlsx)', needsExport: false, kind: 'sheet' },
  { value: 'xls', label: 'Excel 97 (.xls)', needsExport: false, kind: 'sheet' },
  { value: 'csv', label: 'CSV (.csv)', needsExport: false, kind: 'sheet' },
]

const title = ref('')
const saveFormat = ref('md')
const suggestedPath = ref('')
const path = ref('')
const tags = ref([])
const tagInput = ref('')
const summary = ref('')
const analyzing = ref(false)
const saving = ref(false)
const error = ref('')
/** 用户通过「另存为本地文件」选定的磁盘路径；有值时主按钮走本地保存流程 */
const localFilePath = ref('')
const saveProgressVisible = ref(false)
const saveProgressMessage = ref('')
const saveProgressPercent = ref(0)
/** @type {ReturnType<typeof setInterval> | null} */
let saveProgressTimer = null

const isLocalSaveMode = computed(() => Boolean(localFilePath.value.trim()))

const pathModified = computed(
  () => !isLocalSaveMode.value && path.value.trim() !== suggestedPath.value.trim(),
)

/**
 * 仅在 Electron 桌面端可见的本地保存入口。
 * Web 环境返回 false → 按钮不渲染，零侵入。
 */
const localSaveSupported = computed(() => isLocalSaveAvailable())

const isSpreadsheetSource = computed(() =>
  isSpreadsheetExtension(appStore.documentSourceExtension),
)

const contentHasTable = computed(() => hasMarkdownTable(props.content))

/** 来自 Excel / 或正文含表格 → 表格格式排在前面 */
const showSheetFormatsFirst = computed(
  () => isSpreadsheetSource.value || contentHasTable.value,
)

const SAVE_FORMAT_OPTIONS = computed(() => {
  if (showSheetFormatsFirst.value) {
    return [...SHEET_FORMAT_OPTIONS, ...DOC_FORMAT_OPTIONS]
  }
  return [...DOC_FORMAT_OPTIONS, ...SHEET_FORMAT_OPTIONS]
})

const selectedFormatMeta = computed(
  () =>
    SAVE_FORMAT_OPTIONS.value.find((item) => item.value === saveFormat.value)
    || SAVE_FORMAT_OPTIONS.value[0],
)

const submitToKnowledge = ref(true)

function resolveDefaultFormat() {
  if (isSpreadsheetSource.value) {
    return defaultFormatFromSourceExtension(appStore.documentSourceExtension)
  }
  return 'md'
}

function resetForm() {
  title.value = props.defaultTitle
  saveFormat.value = resolveDefaultFormat()
  suggestedPath.value = ''
  path.value = ''
  localFilePath.value = ''
  tags.value = []
  tagInput.value = ''
  summary.value = ''
  error.value = ''
  saveProgressVisible.value = false
  saveProgressMessage.value = ''
  saveProgressPercent.value = 0
  clearSaveProgressTimer()
}

function clearSaveProgressTimer() {
  if (saveProgressTimer) {
    clearInterval(saveProgressTimer)
    saveProgressTimer = null
  }
}

function startSaveProgressTimer(maxPercent = 85) {
  clearSaveProgressTimer()
  saveProgressTimer = setInterval(() => {
    if (saveProgressPercent.value < maxPercent) {
      saveProgressPercent.value = Math.min(maxPercent, saveProgressPercent.value + 4)
    }
  }, 180)
}

function getLocalSaveProgressMessage(format) {
  const labels = {
    pdf: 'PDF',
    docx: 'Word',
    html: 'HTML',
    xlsx: 'Excel',
    xls: 'Excel 97',
    csv: 'CSV',
  }
  const label = labels[format] || format.toUpperCase()
  if (selectedFormatMeta.value.needsExport || selectedFormatMeta.value.kind === 'sheet') {
    return `将该文档转换为 ${label} 并保存`
  }
  return '正在保存到本地文件…'
}

/**
 * ArrayBuffer → base64（分块避免大文件 call stack 溢出）
 * @param {ArrayBuffer} buffer
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
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
  localFilePath.value = ''
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

  if (isLocalSaveMode.value) {
    await handleLocalSave()
    return
  }

  if (!path.value.trim()) {
    error.value = '请填写分类路径'
    return
  }

  saving.value = true
  error.value = ''

  try {
    const finalTitle = title.value.trim() || props.defaultTitle
    const format = saveFormat.value
    let contentBase64 = ''
    let saveContent = props.content

    if (selectedFormatMeta.value.kind === 'sheet') {
      const bytes = markdownToSpreadsheetBytes(
        props.content,
        /** @type {'xlsx'|'xls'|'csv'} */ (format),
      )
      contentBase64 = bytesToBase64(bytes)
      saveContent = props.content
    } else if (selectedFormatMeta.value.needsExport) {
      const blob = await exportBlobViaApi(props.content, /** @type {'docx'|'pdf'|'html'} */ (format))
      contentBase64 = arrayBufferToBase64(await blob.arrayBuffer())
      // 二进制 / 导出产物由 contentBase64 承载
      saveContent = format === 'html' ? '' : props.content
    }

    const finalPath = path.value.trim()
    const result = await saveDocument({
      title: finalTitle,
      content: saveContent,
      path: finalPath,
      tags: tags.value,
      summary: summary.value.trim(),
      suggestedPath: suggestedPath.value.trim(),
      format,
      contentBase64,
    })

    if (pathModified.value) {
      libraryStore.recordPathCorrection({
        suggestedPath: suggestedPath.value.trim(),
        chosenPath: finalPath,
        title: finalTitle,
        tags: tags.value,
      })
    }

    // 保存成功后，若勾选了同时提交到资料库（始终以 Markdown 入库，便于检索）
    if (submitToKnowledge.value && isElectron()) {
      try {
        const api = getElectronAPI()
        await api.knowledge.upload({
          filename: `${finalTitle}.md`,
          data: new TextEncoder().encode(props.content),
        })
      } catch (err) {
        console.warn('[SaveDialog] 同步到资料库失败:', err)
        // 不阻断主流程
      }
    }

    emit('saved', result.item)
    emit('close')
  } catch (err) {
    error.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

/**
 * 「另存为本地文件…」：仅选择磁盘路径，回到对话框后更新下方路径；不触发转换/写入。
 */
async function handlePickLocalPath() {
  if (saving.value) return

  if (!props.content.trim()) {
    error.value = '文档内容为空，无法保存'
    return
  }

  const finalTitle = title.value.trim() || props.defaultTitle || '未命名文档'
  const format = saveFormat.value

  const result = await pickLocalSavePath({
    title: '另存为本地文件',
    fileTitle: finalTitle,
    format,
    defaultPath: localFilePath.value || undefined,
  })

  if (result.canceled) return
  if (result.error) {
    toast.error(`选择保存路径失败：${result.error}`)
    return
  }

  localFilePath.value = result.filePath || ''
  path.value = localFilePath.value
  error.value = ''
}

/**
 * 本地保存：在用户确认路径并点击「保存」后执行；需要转换的格式先转换再写入磁盘。
 */
async function handleLocalSave() {
  if (!localFilePath.value.trim()) {
    error.value = '请先选择本地保存路径'
    return
  }

  saving.value = true
  error.value = ''
  saveProgressVisible.value = true
  saveProgressMessage.value = getLocalSaveProgressMessage(saveFormat.value)
  saveProgressPercent.value = 8
  startSaveProgressTimer()

  const finalTitle = title.value.trim() || props.defaultTitle
  const format = saveFormat.value
  const targetPath = localFilePath.value.trim()

  try {
    if (selectedFormatMeta.value.kind === 'sheet') {
      saveProgressPercent.value = 35
      const bytes = markdownToSpreadsheetBytes(
        props.content,
        /** @type {'xlsx'|'xls'|'csv'} */ (format),
      )
      saveProgressPercent.value = 78
      const write = await writeBinaryToLocalFile(targetPath, bytes)
      if (!write.ok) throw new Error(write.error || '写入失败')
    } else if (selectedFormatMeta.value.needsExport) {
      saveProgressPercent.value = 28
      const blob = await exportBlobViaApi(
        props.content,
        /** @type {'docx'|'pdf'|'html'} */ (format),
      )
      saveProgressPercent.value = 72
      const write = await writeBinaryToLocalFile(targetPath, await blob.arrayBuffer())
      if (!write.ok) throw new Error(write.error || '写入失败')
    } else {
      saveProgressPercent.value = 55
      const write = await saveTextToLocalPath({
        filePath: targetPath,
        content: props.content,
      })
      if (!write.ok) throw new Error(write.error || '写入失败')
    }

    saveProgressPercent.value = 100
    toast.success(`已保存到本地：${targetPath}`, 2500)
    emit('close')
  } catch (err) {
    error.value = err?.message || '保存到本地失败'
    saveProgressVisible.value = false
  } finally {
    clearSaveProgressTimer()
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

watch(saveFormat, (format) => {
  if (!localFilePath.value) return
  const nextPath = replacePathExtension(localFilePath.value, format)
  localFilePath.value = nextPath
  path.value = nextPath
})
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
            <div class="save-dialog__field save-dialog__title-format-row">
              <label class="save-dialog__title-col">
                <span class="save-dialog__label">文档标题</span>
                <input
                  v-model="title"
                  type="text"
                  class="save-dialog__input wpx-input"
                  placeholder="输入文档标题"
                  :disabled="saving"
                />
              </label>
              <label class="save-dialog__format-col">
                <span class="save-dialog__label">保存格式</span>
                <select
                  v-model="saveFormat"
                  class="save-dialog__select wpx-input"
                  :disabled="saving"
                  aria-label="保存格式"
                >
                  <option
                    v-for="option in SAVE_FORMAT_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>
            <p
              v-if="selectedFormatMeta.kind === 'sheet' && saveFormat === 'csv'"
              class="save-dialog__hint save-dialog__format-hint"
            >
              CSV 会导出全部工作表：多表时以空行分隔，并在每段前标注工作表名。此类文件需用表格软件打开。
            </p>
            <p
              v-else-if="selectedFormatMeta.kind === 'sheet'"
              class="save-dialog__hint save-dialog__format-hint"
            >
              将把文档中的 Markdown 表格写为电子表格；多表对应多工作表。此类文件需用 Excel 等程序打开。
            </p>
            <p
              v-else-if="selectedFormatMeta.needsExport"
              class="save-dialog__hint save-dialog__format-hint"
            >
              Word / PDF / HTML 将先转换再写入文库；此类文件可在文库中浏览，需用系统默认程序打开编辑。
            </p>

            <div class="save-dialog__field">
              <div class="save-dialog__label-row">
                <span class="save-dialog__label">{{ isLocalSaveMode ? '保存路径' : '分类路径' }}</span>
                <button
                  v-if="!isLocalSaveMode"
                  type="button"
                  class="save-dialog__link-btn"
                  :disabled="!suggestedPath || saving"
                  @click="applySuggestedPath"
                >
                  采用 AI 建议
                </button>
                <button
                  v-else
                  type="button"
                  class="save-dialog__link-btn"
                  :disabled="saving"
                  @click="handlePickLocalPath"
                >
                  更改路径
                </button>
              </div>
              <input
                v-model="path"
                type="text"
                class="save-dialog__input wpx-input"
                :placeholder="isLocalSaveMode ? '选择本地保存路径' : '如：工作/周报'"
                :disabled="saving || isLocalSaveMode"
                :readonly="isLocalSaveMode"
              />
              <p v-if="isLocalSaveMode" class="save-dialog__hint">
                已选择本地路径，点击右下角「保存」开始{{ selectedFormatMeta.needsExport || selectedFormatMeta.kind === 'sheet' ? '转换并' : '' }}写入。
              </p>
              <p v-else-if="suggestedPath" class="save-dialog__hint">
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
          <label class="save-dialog__knowledge-checkbox">
            <input v-model="submitToKnowledge" type="checkbox" :disabled="saving || isLocalSaveMode" />
            <span>同时提交到资料库</span>
          </label>
          <div class="save-dialog__footer-actions">
          <button
            type="button"
            class="save-dialog__cancel-btn wpx-btn"
            :disabled="saving"
            @click="handleClose"
          >
            取消
          </button>
          <button
            v-if="localSaveSupported"
            type="button"
            class="save-dialog__secondary-btn wpx-btn"
            :disabled="!content.trim() || saving"
            @click="handlePickLocalPath"
          >
            {{ isLocalSaveMode ? '更改保存路径…' : '另存为本地文件…' }}
          </button>
          <button
            type="button"
            class="save-dialog__primary-btn wpx-btn"
            :disabled="analyzing || saving || !content.trim()"
            @click="handleSave"
          >
            {{ saving ? '保存中…' : (isLocalSaveMode ? '保存' : '确认保存') }}
          </button>
          </div>
        </footer>

        <div
          v-if="saveProgressVisible"
          class="save-dialog__progress-overlay"
          role="alertdialog"
          aria-labelledby="save-dialog-progress-title"
          aria-modal="true"
        >
          <div class="save-dialog__progress-card">
            <h3 id="save-dialog-progress-title" class="save-dialog__progress-title">保存中</h3>
            <p class="save-dialog__progress-message">{{ saveProgressMessage }}</p>
            <div
              class="save-dialog__progress-bar"
              role="progressbar"
              :aria-valuenow="saveProgressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="save-dialog__progress-fill"
                :style="{ width: `${saveProgressPercent}%` }"
              />
            </div>
          </div>
        </div>
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
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
}

.save-dialog {
  position: relative;
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

.save-dialog__title-format-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.save-dialog__title-col {
  flex: 1;
  min-width: 0;
}

.save-dialog__format-col {
  flex: 0 0 168px;
}

.save-dialog__format-hint {
  margin: -8px 0 16px;
}

.save-dialog__select {
  width: 100%;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
  background: #fff;
  cursor: pointer;
}

.save-dialog__select:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .save-dialog__title-format-row {
    flex-direction: column;
    align-items: stretch;
  }

  .save-dialog__format-col {
    flex: none;
    width: 100%;
  }
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid #f1f5f9;
}

.save-dialog__knowledge-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  user-select: none;
}

.save-dialog__knowledge-checkbox input {
  accent-color: #7c3aed;
}

.save-dialog__footer-actions {
  display: flex;
  gap: 8px;
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

.save-dialog__progress-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(2px);
}

.save-dialog__progress-card {
  width: min(100%, 320px);
  padding: 20px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  text-align: center;
}

.save-dialog__progress-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.save-dialog__progress-message {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
}

.save-dialog__progress-bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.save-dialog__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  transition: width 0.25s ease;
}
</style>
