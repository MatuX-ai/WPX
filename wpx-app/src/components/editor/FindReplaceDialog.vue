<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'find-next', 'replace', 'replace-all'])

const findText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)

function handleClose() {
  emit('close')
}

function handleFindNext() {
  const query = findText.value
  if (!query) return
  emit('find-next', { query, caseSensitive: caseSensitive.value })
}

function handleReplace() {
  const query = findText.value
  if (!query) return
  emit('replace', {
    query,
    replacement: replaceText.value,
    caseSensitive: caseSensitive.value,
  })
}

function handleReplaceAll() {
  const query = findText.value
  if (!query) return
  emit('replace-all', {
    query,
    replacement: replaceText.value,
    caseSensitive: caseSensitive.value,
  })
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleFindNext()
  }
}

watch(
  () => props.visible,
  (open) => {
    if (!open) {
      findText.value = ''
      replaceText.value = ''
      caseSensitive.value = false
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="find-replace-backdrop"
      @mousedown.self="handleClose"
    >
      <div
        class="find-replace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-replace-title"
        @keydown="handleKeydown"
      >
        <header class="find-replace-dialog__header">
          <h3 id="find-replace-title" class="find-replace-dialog__title">查找与替换</h3>
          <button
            type="button"
            class="find-replace-dialog__close"
            aria-label="关闭"
            @click="handleClose"
          >
            ✕
          </button>
        </header>

        <div class="find-replace-dialog__body">
          <label class="find-replace-dialog__field">
            <span>查找</span>
            <input
              v-model="findText"
              type="text"
              class="wpx-input find-replace-dialog__input"
              placeholder="输入要查找的文本"
              autofocus
            />
          </label>

          <label class="find-replace-dialog__field">
            <span>替换为</span>
            <input
              v-model="replaceText"
              type="text"
              class="wpx-input find-replace-dialog__input"
              placeholder="留空则删除匹配内容"
            />
          </label>

          <label class="find-replace-dialog__checkbox">
            <input v-model="caseSensitive" type="checkbox" />
            区分大小写
          </label>
        </div>

        <footer class="find-replace-dialog__footer">
          <button type="button" class="wpx-btn find-replace-dialog__btn" @click="handleFindNext">
            查找下一个
          </button>
          <button type="button" class="wpx-btn find-replace-dialog__btn" @click="handleReplace">
            替换
          </button>
          <button
            type="button"
            class="wpx-btn find-replace-dialog__btn find-replace-dialog__btn--primary"
            @click="handleReplaceAll"
          >
            全部替换
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.find-replace-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 16px 16px;
  background: rgba(15, 23, 42, 0.35);
}

.find-replace-dialog {
  width: min(100%, 420px);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg);
  color: var(--theme-fg);
  box-shadow: var(--theme-shadow-lg);
}

.find-replace-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--theme-border);
}

.find-replace-dialog__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.find-replace-dialog__close {
  border: none;
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.find-replace-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.find-replace-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--theme-fg-muted);
}

.find-replace-dialog__input {
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.find-replace-dialog__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--theme-fg-muted);
}

.find-replace-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--theme-border);
}

.find-replace-dialog__btn {
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--theme-bg);
  color: var(--theme-fg);
  cursor: pointer;
}

.find-replace-dialog__btn--primary {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
  color: #fff;
}
</style>
