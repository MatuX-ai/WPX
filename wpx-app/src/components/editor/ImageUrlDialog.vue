<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const url = ref('')
const error = ref('')

function reset() {
  url.value = ''
  error.value = ''
}

function handleClose() {
  reset()
  emit('close')
}

function handleConfirm() {
  const value = url.value.trim()
  if (!value) {
    error.value = '请输入图片 URL'
    return
  }

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol')
    }
  } catch {
    error.value = '请输入有效的图片链接（http/https 或 data URL）'
    return
  }

  emit('confirm', value)
  reset()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    handleConfirm()
  }
}

watch(
  () => props.visible,
  (open) => {
    if (!open) reset()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="image-url-backdrop"
      @mousedown.self="handleClose"
    >
      <div
        class="image-url-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-url-title"
        @keydown="handleKeydown"
      >
        <header class="image-url-dialog__header">
          <h3 id="image-url-title" class="image-url-dialog__title">插入图片链接</h3>
          <button
            type="button"
            class="image-url-dialog__close"
            aria-label="关闭"
            @click="handleClose"
          >
            ✕
          </button>
        </header>

        <div class="image-url-dialog__body">
          <label class="image-url-dialog__field" for="image-url-input">图片 URL</label>
          <input
            id="image-url-input"
            v-model="url"
            type="url"
            class="wpx-input image-url-dialog__input"
            placeholder="https://example.com/image.png"
            autofocus
            @input="error = ''"
          />
          <p v-if="error" class="image-url-dialog__error">{{ error }}</p>
        </div>

        <footer class="image-url-dialog__footer">
          <button type="button" class="wpx-btn image-url-dialog__btn" @click="handleClose">
            取消
          </button>
          <button
            type="button"
            class="wpx-btn image-url-dialog__btn image-url-dialog__btn--primary"
            @click="handleConfirm"
          >
            插入
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.image-url-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 16px 16px;
  background: rgba(15, 23, 42, 0.35);
}

.image-url-dialog {
  width: min(100%, 440px);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg);
  color: var(--theme-fg);
  box-shadow: var(--theme-shadow-lg);
}

.image-url-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--theme-border);
}

.image-url-dialog__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.image-url-dialog__close {
  border: none;
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: pointer;
  font-size: 16px;
}

.image-url-dialog__body {
  padding: 14px;
}

.image-url-dialog__field {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--theme-fg-muted);
}

.image-url-dialog__input {
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.image-url-dialog__error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #dc2626;
}

.image-url-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--theme-border);
}

.image-url-dialog__btn {
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--theme-bg);
  cursor: pointer;
}

.image-url-dialog__btn--primary {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
  color: #fff;
}
</style>
