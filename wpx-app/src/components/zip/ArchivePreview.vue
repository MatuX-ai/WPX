<script setup>
import { computed, ref, watch } from 'vue'
import Vue3DraggableResizable from 'vue3-draggable-resizable'
import { DraggableContainer } from 'vue3-draggable-resizable'
import PasswordDialog from '@/components/zip/PasswordDialog.vue'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { useZipStore } from '@/stores/zip'
import { Z_INDEX } from '@/constants/zIndex'
import {
  isPasswordRelatedError,
  pickExtractDirectory,
  zipFeatureAvailable,
} from '@/utils/zipApi'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  archivePath: {
    type: String,
    default: '',
  },
  stackIndex: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['close'])

const toast = useToast()
const appStore = useAppStore()
const zipStore = useZipStore()

const windowW = ref(760)
const windowH = ref(560)
const posX = ref(80)
const posY = ref(64)

const entries = ref([])
const loading = ref(false)
const error = ref('')
const selected = ref(new Set())
const sortKey = ref('name')
const sortAsc = ref(true)

const archivePassword = ref('')
const passwordVisible = ref(false)
const passwordError = ref('')
const pendingExtract = ref(null)

const extracting = ref(false)
const isExtracting = extracting

const RESIZE_HANDLES = ['mr', 'br', 'bm']

const previewZIndex = computed(() => Z_INDEX.archivePreview + props.stackIndex)

const fileEntries = computed(() => entries.value.filter((entry) => !entry.isDirectory))

const sortedEntries = computed(() => {
  const list = [...entries.value]

  list.sort((a, b) => {
    let compare = 0

    if (sortKey.value === 'name') {
      compare = a.name.localeCompare(b.name, 'zh-CN')
    } else if (sortKey.value === 'size') {
      compare = (a.size || 0) - (b.size || 0)
    } else {
      compare = getEntryTypeLabel(a).localeCompare(getEntryTypeLabel(b), 'zh-CN')
    }

    if (compare === 0) {
      compare = a.name.localeCompare(b.name, 'zh-CN')
    }

    return sortAsc.value ? compare : -compare
  })

  return list
})

const allFilesSelected = computed(
  () => fileEntries.value.length > 0 && selected.value.size === fileEntries.value.length,
)

const stats = computed(() => {
  const files = fileEntries.value
  const totalSize = files.reduce((sum, entry) => sum + (entry.size || 0), 0)
  const totalCompressed = files.reduce((sum, entry) => sum + (entry.compressedSize || 0), 0)
  const ratio =
    totalSize > 0 ? Math.max(0, (1 - totalCompressed / totalSize) * 100) : 0

  return {
    count: files.length,
    ratio: ratio.toFixed(1),
  }
})

function resetWindowPosition() {
  posX.value = Math.max(24, (window.innerWidth - windowW.value) / 2)
  posY.value = Math.max(24, (window.innerHeight - windowH.value) / 2)
}

function resetState() {
  entries.value = []
  loading.value = false
  error.value = ''
  selected.value = new Set()
  sortKey.value = 'name'
  sortAsc.value = true
  archivePassword.value = ''
  passwordVisible.value = false
  passwordError.value = ''
  pendingExtract.value = null
  extracting.value = false
  resetWindowPosition()
}

function getEntryExtension(name) {
  const base = String(name || '').split(/[\\/]/).pop() || ''
  const index = base.lastIndexOf('.')
  if (index <= 0) return ''
  return base.slice(index + 1).toLowerCase()
}

function getEntryTypeLabel(entry) {
  if (entry.isDirectory) return 'folder'
  return getEntryExtension(entry.name) || 'file'
}

function getEntryIcon(entry) {
  if (entry.isDirectory) return '📁'

  const ext = getEntryExtension(entry.name)
  const iconMap = {
    '7z': '📦',
    zip: '📦',
    tar: '📦',
    gz: '📦',
    pdf: '📕',
    doc: '📝',
    docx: '📝',
    md: '📝',
    txt: '📝',
    jpg: '🖼',
    jpeg: '🖼',
    png: '🖼',
    gif: '🖼',
    webp: '🖼',
    mp4: '🎬',
    mp3: '🎵',
  }

  return iconMap[ext] || '📄'
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function resetSelection() {
  selected.value = new Set(fileEntries.value.map((entry) => entry.name))
}

function toggleEntry(name) {
  const next = new Set(selected.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  selected.value = next
}

function toggleAllFiles() {
  if (allFilesSelected.value) {
    selected.value = new Set()
    return
  }
  resetSelection()
}

function setSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
    return
  }
  sortKey.value = key
  sortAsc.value = true
}

function sortIndicator(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' ↑' : ' ↓'
}

async function loadEntries(password) {
  if (!props.archivePath) return

  loading.value = true
  error.value = ''

  try {
    const files = await zipStore.loadArchiveEntries(props.archivePath, password)
    entries.value = files
    if (password) {
      archivePassword.value = password
    }
    resetSelection()
  } catch (err) {
    const message = err.message || '无法读取压缩包'
    if (isPasswordRelatedError(message) && !password) {
      passwordError.value = ''
      passwordVisible.value = true
      error.value = ''
      return
    }
    error.value = message
  } finally {
    loading.value = false
  }
}

function handleClose() {
  if (isExtracting.value) return
  emit('close')
}

function queueExtract(files) {
  pendingExtract.value = { files }
  startExtractFlow()
}

async function startExtractFlow() {
  const action = pendingExtract.value
  if (!action || !props.archivePath) return

  const defaultDir = props.archivePath.replace(/[\\/][^\\/]+$/, '')
  const pickResult = await pickExtractDirectory(defaultDir)
  if (!pickResult.ok || pickResult.canceled || !pickResult.directoryPath) {
    pendingExtract.value = null
    return
  }

  await runExtract({
    outputDir: pickResult.directoryPath,
    files: action.files,
  })
}

async function runExtract({ outputDir, files, password = archivePassword.value }) {
  extracting.value = true
  error.value = ''

  try {
    const result = await zipStore.runExtract(
      {
        archivePath: props.archivePath,
        outputDir,
        files,
        password: password || undefined,
      },
      files?.length ? '正在解压所选文件…' : '正在解压…',
    )

    pendingExtract.value = null

    if (result?.cancelled) {
      return
    }

    toast.success(`解压完成：${outputDir}`)
    appStore.bumpLibraryRefresh()
    emit('close')
  } catch (err) {
    const message = err.message || '解压失败'
    if (isPasswordRelatedError(message)) {
      pendingExtract.value = { outputDir, files }
      passwordError.value = message
      passwordVisible.value = true
      return
    }
    error.value = message
    toast.error(message)
  } finally {
    extracting.value = false
  }
}

function handleExtractAll() {
  queueExtract(undefined)
}

function handleExtractSelected() {
  if (!selected.value.size) return
  queueExtract([...selected.value])
}

async function handlePasswordConfirm(password) {
  passwordVisible.value = false
  archivePassword.value = password

  if (pendingExtract.value?.outputDir) {
    await runExtract({
      outputDir: pendingExtract.value.outputDir,
      files: pendingExtract.value.files,
      password,
    })
    return
  }

  await loadEntries(password)
}

function handlePasswordClose() {
  passwordVisible.value = false
  if (!pendingExtract.value?.outputDir) {
    pendingExtract.value = null
  }
}

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    if (!zipFeatureAvailable()) {
      error.value = '压缩包预览仅在 WPX 桌面端可用'
      return
    }
    posX.value = 80 + props.stackIndex * 36
    posY.value = 64 + props.stackIndex * 36
    resetState()
    loadEntries()
  },
  { immediate: true },
)

watch(fileEntries, () => {
  if (props.visible && fileEntries.value.length) {
    resetSelection()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="archive-preview-pop">
      <div
        v-if="visible"
        class="archive-preview-host floating-host"
        :style="{ zIndex: previewZIndex }"
      >
        <DraggableContainer :reference-line-visible="false" class="archive-preview-container">
          <Vue3DraggableResizable
            v-model:x="posX"
            v-model:y="posY"
            v-model:w="windowW"
            v-model:h="windowH"
            :init-w="windowW"
            :init-h="windowH"
            :min-w="520"
            :min-h="380"
            :draggable="!isExtracting"
            :resizable="!isExtracting"
            :parent="true"
            :handles="RESIZE_HANDLES"
          >
            <div class="archive-preview" role="dialog" aria-modal="true">
              <header class="archive-preview__header">
                <div class="archive-preview__title-wrap">
                  <h2 class="archive-preview__title">压缩包预览</h2>
                  <p class="archive-preview__path">{{ archivePath }}</p>
                </div>
                <div class="archive-preview__actions">
                  <button
                    type="button"
                    class="archive-preview__btn"
                    :disabled="loading || !!error || isExtracting"
                    @mousedown.stop
                    @click="handleExtractAll"
                  >
                    解压全部
                  </button>
                  <button
                    type="button"
                    class="archive-preview__btn archive-preview__btn--primary"
                    :disabled="loading || !!error || isExtracting || selected.size === 0"
                    @mousedown.stop
                    @click="handleExtractSelected"
                  >
                    解压所选
                  </button>
                  <button
                    type="button"
                    class="archive-preview__btn archive-preview__btn--ghost"
                    :disabled="isExtracting"
                    @mousedown.stop
                    @click="handleClose"
                  >
                    关闭
                  </button>
                </div>
              </header>

              <div class="archive-preview__toolbar">
                <button type="button" class="archive-preview__sort" @click="setSort('name')">
                  名称{{ sortIndicator('name') }}
                </button>
                <button type="button" class="archive-preview__sort" @click="setSort('size')">
                  大小{{ sortIndicator('size') }}
                </button>
                <button type="button" class="archive-preview__sort" @click="setSort('type')">
                  类型{{ sortIndicator('type') }}
                </button>
              </div>

              <div class="archive-preview__body">
                <p v-if="loading" class="archive-preview__hint">正在读取文件列表…</p>
                <p v-else-if="error" class="archive-preview__error">{{ error }}</p>
                <p v-else-if="!entries.length" class="archive-preview__hint">压缩包为空</p>

                <div v-else class="archive-preview__table-wrap">
                  <table class="archive-preview__table">
                    <thead>
                      <tr>
                        <th class="archive-preview__col-check">
                          <input
                            type="checkbox"
                            :checked="allFilesSelected"
                            @change="toggleAllFiles"
                          />
                        </th>
                        <th class="archive-preview__col-icon">类型</th>
                        <th>文件名</th>
                        <th>大小</th>
                        <th>压缩后</th>
                        <th>修改日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="entry in sortedEntries" :key="entry.name">
                        <td class="archive-preview__col-check">
                          <input
                            v-if="!entry.isDirectory"
                            type="checkbox"
                            :checked="selected.has(entry.name)"
                            @change="toggleEntry(entry.name)"
                          />
                        </td>
                        <td class="archive-preview__col-icon">
                          <span class="archive-preview__icon" :title="getEntryTypeLabel(entry)">
                            {{ getEntryIcon(entry) }}
                          </span>
                        </td>
                        <td class="archive-preview__name">
                          {{ entry.name }}<span v-if="entry.isDirectory">/</span>
                        </td>
                        <td>{{ entry.isDirectory ? '—' : formatSize(entry.size) }}</td>
                        <td>{{ entry.isDirectory ? '—' : formatSize(entry.compressedSize) }}</td>
                        <td>{{ entry.date || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <footer class="archive-preview__status">
                共 {{ stats.count }} 个文件，压缩率 {{ stats.ratio }}%
              </footer>
            </div>
          </Vue3DraggableResizable>
        </DraggableContainer>

        <PasswordDialog
          :visible="passwordVisible"
          @close="handlePasswordClose"
          @confirm="handlePasswordConfirm"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.archive-preview-host {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.archive-preview-container {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.archive-preview {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.archive-preview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.archive-preview__title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.archive-preview__path {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: #64748b;
  word-break: break-all;
}

.archive-preview__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.archive-preview__btn {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #475569;
}

.archive-preview__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.archive-preview__btn--primary {
  border-color: #7c3aed;
  background: #7c3aed;
  color: #fff;
}

.archive-preview__btn--ghost {
  background: #f8fafc;
}

.archive-preview__toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 18px;
  border-bottom: 1px solid #f8fafc;
}

.archive-preview__sort {
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #fff;
  padding: 4px 10px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
}

.archive-preview__body {
  flex: 1;
  min-height: 0;
  padding: 0 12px;
  overflow: auto;
}

.archive-preview__table-wrap {
  overflow: auto;
}

.archive-preview__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.archive-preview__table th,
.archive-preview__table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  vertical-align: middle;
}

.archive-preview__col-check {
  width: 36px;
}

.archive-preview__col-icon {
  width: 44px;
}

.archive-preview__icon {
  font-size: 16px;
}

.archive-preview__name {
  word-break: break-all;
}

.archive-preview__hint,
.archive-preview__error {
  margin: 16px 6px;
  font-size: 13px;
}

.archive-preview__error {
  color: #dc2626;
}

.archive-preview__status {
  padding: 8px 18px 12px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
  color: #64748b;
  background: #fcfcfd;
}

.archive-preview-pop-enter-active,
.archive-preview-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.archive-preview-pop-enter-from,
.archive-preview-pop-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
/* vdr-container 边框 / 手柄 opacity 公共基类见 src/styles/floating-window.css */
</style>
