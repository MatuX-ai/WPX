<script setup>
import { computed, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { useZipStore } from '@/stores/zip'
import {
  buildDefaultOutputPath,
  pickSaveArchivePath,
  zipFeatureAvailable,
} from '@/utils/zipApi'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  targetPaths: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'success'])

const toast = useToast()
const appStore = useAppStore()
const zipStore = useZipStore()

const format = ref('7z')
const level = ref(5)
const password = ref('')
const showPassword = ref(false)
const outputPath = ref('')
const outputPathTouched = ref(false)
const error = ref('')
const pickingPath = ref(false)
const compressing = ref(false)

const levelOptions = [
  { value: 1, label: '快速' },
  { value: 5, label: '标准' },
  { value: 9, label: '极限' },
]

const isBusy = computed(() => compressing.value)

function resetForm() {
  format.value = '7z'
  level.value = 5
  password.value = ''
  showPassword.value = false
  outputPathTouched.value = false
  error.value = ''
  compressing.value = false
  refreshDefaultOutputPath()
}

function refreshDefaultOutputPath() {
  outputPath.value = buildDefaultOutputPath(props.targetPaths, format.value)
}

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    resetForm()
  },
)

watch(format, () => {
  if (outputPathTouched.value) {
    outputPath.value = outputPath.value.replace(/\.(7z|zip|tar)$/i, `.${format.value}`)
    return
  }
  refreshDefaultOutputPath()
})

async function handleBrowse() {
  pickingPath.value = true
  error.value = ''

  try {
    const result = await pickSaveArchivePath(outputPath.value)
    if (result.ok && result.filePath) {
      outputPath.value = result.filePath
      outputPathTouched.value = true
    }
  } catch (err) {
    error.value = err.message || '无法选择保存路径'
  } finally {
    pickingPath.value = false
  }
}

function handleClose() {
  emit('close')
}

async function handleCompress() {
  if (isBusy.value) return

  if (!zipFeatureAvailable()) {
    error.value = '压缩功能仅在 WPX 桌面端可用'
    return
  }

  if (!props.targetPaths.length) {
    error.value = '没有可压缩的内容'
    return
  }

  const resolvedOutputPath = outputPath.value.trim() || buildDefaultOutputPath(props.targetPaths, format.value)

  if (!resolvedOutputPath) {
    error.value = '请选择输出路径'
    return
  }

  if (password.value && format.value === 'tar') {
    error.value = 'TAR 格式不支持加密，请改用 7z 或 zip'
    return
  }

  error.value = ''
  compressing.value = true

  try {
    const result = await zipStore.runCompress(
      {
        sources: props.targetPaths,
        outputPath: resolvedOutputPath,
        format: format.value,
        level: level.value,
        password: password.value || undefined,
      },
      '正在压缩…',
    )

    if (result?.cancelled) {
      return
    }

    toast.success(`压缩完成：${result.outputPath || resolvedOutputPath}`)
    appStore.bumpLibraryRefresh()
    emit('success', { outputPath: result.outputPath || resolvedOutputPath })
    emit('close')
  } catch (err) {
    error.value = err.message || '压缩失败'
    toast.error(error.value)
  } finally {
    compressing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="save-dialog">
      <div v-if="visible" class="compress-dialog-backdrop" @click.self="handleClose">
        <div class="compress-dialog" role="dialog" aria-modal="true" @click.stop>
          <header class="compress-dialog__header">
            <h2 class="compress-dialog__title">压缩</h2>
            <p class="compress-dialog__desc">
              已选择 {{ targetPaths.length }} 项，将打包为压缩文件。
            </p>
          </header>

          <div v-if="isBusy" class="compress-dialog__body">
            <p class="compress-dialog__hint">压缩进行中，可在右下角查看进度。</p>
          </div>

          <div v-else class="compress-dialog__body">
            <label class="compress-dialog__field">
              <span class="compress-dialog__label">格式</span>
              <select v-model="format" class="compress-dialog__input">
                <option value="7z">7z（默认）</option>
                <option value="zip">zip</option>
                <option value="tar">tar</option>
              </select>
            </label>

            <label class="compress-dialog__field">
              <span class="compress-dialog__label">压缩级别</span>
              <select v-model.number="level" class="compress-dialog__input">
                <option v-for="option in levelOptions" :key="option.value" :value="option.value">
                  {{ option.label }} (-mx={{ option.value }})
                </option>
              </select>
            </label>

            <label class="compress-dialog__field">
              <span class="compress-dialog__label">密码（可选）</span>
              <div class="compress-dialog__password-row">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="compress-dialog__input"
                  placeholder="留空则不加密"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="compress-dialog__btn"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? '隐藏' : '显示' }}
                </button>
              </div>
            </label>

            <label class="compress-dialog__field">
              <span class="compress-dialog__label">输出路径</span>
              <div class="compress-dialog__path-row">
                <input
                  v-model="outputPath"
                  type="text"
                  class="compress-dialog__input"
                  @input="outputPathTouched = true"
                />
                <button
                  type="button"
                  class="compress-dialog__btn"
                  :disabled="pickingPath"
                  @click="handleBrowse"
                >
                  浏览
                </button>
              </div>
            </label>

            <p v-if="error" class="compress-dialog__error">{{ error }}</p>
          </div>

          <footer class="compress-dialog__footer">
            <button type="button" class="compress-dialog__btn" @click="handleClose">
              {{ isBusy ? '关闭' : '取消' }}
            </button>
            <button
              type="button"
              class="compress-dialog__btn compress-dialog__btn--primary"
              :disabled="isBusy"
              @click="handleCompress"
            >
              {{ isBusy ? '压缩中…' : '压缩' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.compress-dialog-backdrop {
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

.compress-dialog {
  width: min(540px, 100%);
  border-radius: 12px;
  background: #fff;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
}

.compress-dialog__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.compress-dialog__desc {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.compress-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 20px 0;
}

.compress-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compress-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.compress-dialog__input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: #0f172a;
}

.compress-dialog__path-row,
.compress-dialog__password-row {
  display: flex;
  gap: 8px;
}

.compress-dialog__path-row .compress-dialog__input,
.compress-dialog__password-row .compress-dialog__input {
  flex: 1;
}

.compress-dialog__error {
  margin: 0;
  font-size: 12px;
  color: #dc2626;
}

.compress-dialog__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
}

.compress-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.compress-dialog__btn {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  color: #475569;
}

.compress-dialog__btn--primary {
  border-color: #7c3aed;
  background: #7c3aed;
  color: #fff;
}
</style>
