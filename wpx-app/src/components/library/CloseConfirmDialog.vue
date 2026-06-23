<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['save', 'discard', 'cancel'])

function handleSave() {
  emit('save')
}

function handleDiscard() {
  emit('discard')
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="save-dialog">
      <div
        v-if="visible"
        class="close-confirm-backdrop"
        @click.self="handleCancel"
      >
        <div
          class="close-confirm"
          role="alertdialog"
          aria-labelledby="close-confirm-title"
          aria-describedby="close-confirm-desc"
          aria-modal="true"
          @click.stop
        >
          <header class="close-confirm__header">
            <h2 id="close-confirm-title" class="close-confirm__title">保存更改？</h2>
            <p id="close-confirm-desc" class="close-confirm__subtitle">
              当前文档有未保存的修改，关闭窗口前请选择如何处理。
            </p>
          </header>

          <footer class="close-confirm__footer">
            <button
              type="button"
              class="close-confirm__btn close-confirm__btn--ghost wpx-btn"
              :disabled="saving"
              @click="handleCancel"
            >
              取消
            </button>
            <button
              type="button"
              class="close-confirm__btn close-confirm__btn--secondary wpx-btn"
              :disabled="saving"
              @click="handleDiscard"
            >
              不保存
            </button>
            <button
              type="button"
              class="close-confirm__btn close-confirm__btn--primary wpx-btn"
              :disabled="saving"
              @click="handleSave"
            >
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.close-confirm-backdrop {
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

.close-confirm {
  width: min(420px, 100%);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.close-confirm__header {
  padding: 20px 20px 12px;
}

.close-confirm__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.close-confirm__subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
}

.close-confirm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid #f1f5f9;
}

.close-confirm__btn {
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.close-confirm__btn--ghost {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}

.close-confirm__btn--secondary {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #334155;
}

.close-confirm__btn--primary {
  border: none;
  background: #7c3aed;
  color: #fff;
}

.close-confirm__btn:hover:not(:disabled) {
  filter: brightness(0.98);
}

.close-confirm__btn--primary:hover:not(:disabled) {
  background: #6d28d9;
}

.close-confirm__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
