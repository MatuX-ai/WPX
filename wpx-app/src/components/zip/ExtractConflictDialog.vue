<script setup>
import { ref, watch } from 'vue'

/** @typedef {'overwrite' | 'skip' | 'rename' | 'ask'} ExtractConflictAction */

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  fileName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['resolve'])

const options = [
  {
    value: 'overwrite',
    label: '覆盖',
    description: '用压缩包中的文件替换现有文件',
  },
  {
    value: 'skip',
    label: '跳过',
    description: '保留现有文件，不解压此项',
  },
  {
    value: 'rename',
    label: '重命名',
    description: '自动添加数字后缀保存（如 file (1).txt）',
  },
  {
    value: 'ask',
    label: '每次询问',
    description: '以后遇到冲突时继续弹出此对话框',
  },
]

const selected = ref('ask')

function resetSelection() {
  selected.value = 'ask'
}

function handleConfirm() {
  emit('resolve', selected.value)
}

watch(
  () => props.visible,
  (open) => {
    if (open) resetSelection()
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="save-dialog">
      <div v-if="visible" class="extract-conflict-backdrop">
        <div
          class="extract-conflict-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="extract-conflict-title"
          aria-describedby="extract-conflict-desc"
          @click.stop
        >
          <header class="extract-conflict-dialog__header">
            <h2 id="extract-conflict-title" class="extract-conflict-dialog__title">文件冲突</h2>
            <p id="extract-conflict-desc" class="extract-conflict-dialog__desc">
              解压目标路径已存在同名文件，请选择处理方式。
            </p>
          </header>

          <div class="extract-conflict-dialog__body">
            <p class="extract-conflict-dialog__file-label">冲突文件</p>
            <p class="extract-conflict-dialog__file-name" :title="fileName">
              {{ fileName || '—' }}
            </p>

            <fieldset class="extract-conflict-dialog__options">
              <legend class="extract-conflict-dialog__options-legend">处理方式</legend>
              <label
                v-for="option in options"
                :key="option.value"
                class="extract-conflict-dialog__option"
                :class="{ 'extract-conflict-dialog__option--active': selected === option.value }"
              >
                <input
                  v-model="selected"
                  class="extract-conflict-dialog__radio"
                  type="radio"
                  name="extract-conflict-action"
                  :value="option.value"
                />
                <span class="extract-conflict-dialog__option-content">
                  <span class="extract-conflict-dialog__option-label">{{ option.label }}</span>
                  <span class="extract-conflict-dialog__option-desc">{{ option.description }}</span>
                </span>
              </label>
            </fieldset>
          </div>

          <footer class="extract-conflict-dialog__footer">
            <button
              type="button"
              class="extract-conflict-dialog__btn extract-conflict-dialog__btn--primary"
              @click="handleConfirm"
            >
              确定
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.extract-conflict-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) + 1);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.extract-conflict-dialog {
  width: min(460px, 100%);
  border-radius: 12px;
  background: #fff;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
}

.extract-conflict-dialog__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.extract-conflict-dialog__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
}

.extract-conflict-dialog__body {
  margin: 20px 0;
}

.extract-conflict-dialog__file-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.extract-conflict-dialog__file-name {
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.4;
  color: #0f172a;
  word-break: break-all;
}

.extract-conflict-dialog__options {
  margin: 0;
  padding: 0;
  border: none;
}

.extract-conflict-dialog__options-legend {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.extract-conflict-dialog__option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.extract-conflict-dialog__option:last-child {
  margin-bottom: 0;
}

.extract-conflict-dialog__option:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.extract-conflict-dialog__option--active {
  border-color: #7c3aed;
  background: #f5f3ff;
}

.extract-conflict-dialog__radio {
  margin-top: 2px;
  flex-shrink: 0;
}

.extract-conflict-dialog__option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.extract-conflict-dialog__option-label {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
}

.extract-conflict-dialog__option-desc {
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
}

.extract-conflict-dialog__footer {
  display: flex;
  justify-content: flex-end;
}

.extract-conflict-dialog__btn {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.extract-conflict-dialog__btn--primary {
  border-color: #7c3aed;
  background: #7c3aed;
  color: #fff;
}
</style>
