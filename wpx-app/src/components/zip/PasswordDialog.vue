<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const password = ref('')
const showPassword = ref(false)
const error = ref('')

function clearPassword() {
  password.value = ''
  showPassword.value = false
  error.value = ''
}

function handleClose() {
  clearPassword()
  emit('close')
}

function handleConfirm() {
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  const value = password.value
  clearPassword()
  emit('confirm', value)
}

watch(
  () => props.visible,
  (open) => {
    if (open) clearPassword()
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="save-dialog">
      <div v-if="visible" class="password-dialog-backdrop" @click.self="handleClose">
        <div
          class="password-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="zip-password-title"
          @click.stop
        >
          <header class="password-dialog__header">
            <h2 id="zip-password-title" class="password-dialog__title">输入密码</h2>
            <p class="password-dialog__desc">此压缩包已加密，请输入密码</p>
          </header>

          <div class="password-dialog__body">
            <div class="password-dialog__input-row">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="password-dialog__input"
                placeholder="密码"
                autocomplete="off"
                @keydown.enter="handleConfirm"
              />
              <button
                type="button"
                class="password-dialog__toggle"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '隐藏' : '显示' }}
              </button>
            </div>
            <p v-if="error" class="password-dialog__error">{{ error }}</p>
          </div>

          <footer class="password-dialog__footer">
            <button type="button" class="password-dialog__btn" @click="handleClose">取消</button>
            <button
              type="button"
              class="password-dialog__btn password-dialog__btn--primary"
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
.password-dialog-backdrop {
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

.password-dialog {
  width: min(420px, 100%);
  border-radius: 12px;
  background: #fff;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
}

.password-dialog__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.password-dialog__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
}

.password-dialog__body {
  margin: 20px 0;
}

.password-dialog__input-row {
  display: flex;
  gap: 8px;
}

.password-dialog__input {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
}

.password-dialog__toggle {
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 12px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}

.password-dialog__error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #dc2626;
}

.password-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.password-dialog__btn {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.password-dialog__btn--primary {
  border-color: #7c3aed;
  background: #7c3aed;
  color: #fff;
}
</style>
