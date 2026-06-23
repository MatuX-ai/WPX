<script setup>
import { computed, ref, watch } from 'vue'
import { useSkillExecutor } from '@/composables/useSkillExecutor'

const props = defineProps({
  skillId: {
    type: String,
    required: true,
  },
  /** 是否以浮层遮罩形式展示 */
  overlay: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['submit', 'cancel'])

const { getSkillInputForm } = useSkillExecutor()

/** 当前 Skill 的 schema */
const schema = computed(() => getSkillInputForm(props.skillId))

/** 动态表单数据 */
const formData = ref({})

// 每当 skillId 变化时重置表单
watch(
  () => props.skillId,
  () => {
    formData.value = {}
  },
  { immediate: true },
)

// ── 表单操作 ──────────────────────────────────

function handleSubmit () {
  const data = {}
  for (const key of Object.keys(schema.value || {})) {
    const val = formData.value[key]
    if (val !== undefined && val !== null && val !== '') {
      data[key] = val
    }
  }
  emit('submit', data)
}

function handleCancel () {
  emit('cancel')
}

function handleKeydown (event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    // 如果焦点在 textarea 上，Enter 不触发生成
    if (event.target.tagName === 'TEXTAREA') return
    event.preventDefault()
    handleSubmit()
  }
}


</script>

<template>
  <div v-if="overlay" class="skill-form-backdrop" @mousedown.self="handleCancel">
    <div
      class="skill-form-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`skill-form-title-${skillId}`"
      @keydown="handleKeydown"
    >
      <header class="skill-form-dialog__header">
        <h3 :id="`skill-form-title-${skillId}`" class="skill-form-dialog__title">
          {{ schema?.title || 'Skill 参数' }}
        </h3>
        <button
          type="button"
          class="skill-form-dialog__close"
          aria-label="关闭"
          @click="handleCancel"
        >
          ✕
        </button>
      </header>

      <!-- 未找到 Skill -->
      <div v-if="!schema" class="skill-form-dialog__body">
        <p class="skill-form-dialog__empty">未找到 Skill "{{ skillId }}"</p>
      </div>

      <!-- 表单 -->
      <form v-else class="skill-form-dialog__body" @submit.prevent="handleSubmit">
        <div v-for="(field, key) in schema" :key="key" class="skill-form__field">
          <label class="skill-form__label" :for="`skill-input-${skillId}-${key}`">
            {{ field.label || key }}
          </label>

          <!-- text -->
          <input
            v-if="field.type === 'text'"
            :id="`skill-input-${skillId}-${key}`"
            v-model="formData[key]"
            type="text"
            class="wpx-input skill-form__input"
            :placeholder="field.placeholder"
          />

          <!-- number -->
          <input
            v-else-if="field.type === 'number'"
            :id="`skill-input-${skillId}-${key}`"
            v-model="formData[key]"
            type="number"
            class="wpx-input skill-form__input"
            :placeholder="field.placeholder"
          />

          <!-- textarea -->
          <textarea
            v-else-if="field.type === 'textarea'"
            :id="`skill-input-${skillId}-${key}`"
            v-model="formData[key]"
            class="wpx-input skill-form__input skill-form__textarea"
            :placeholder="field.placeholder"
            rows="4"
          />

          <!-- select -->
          <select
            v-else-if="field.type === 'select'"
            :id="`skill-input-${skillId}-${key}`"
            v-model="formData[key]"
            class="wpx-input skill-form__input"
          >
            <option v-if="field.placeholder" value="" disabled>
              {{ field.placeholder }}
            </option>
            <option
              v-for="opt in (field.options || [])"
              :key="opt.value || opt"
              :value="opt.value || opt"
            >
              {{ opt.label || opt }}
            </option>
          </select>

          <!-- fallback: text -->
          <input
            v-else
            :id="`skill-input-${skillId}-${key}`"
            v-model="formData[key]"
            type="text"
            class="wpx-input skill-form__input"
            :placeholder="field.placeholder"
          />
        </div>

        <footer class="skill-form-dialog__footer">
          <button type="button" class="wpx-btn skill-form__btn" @click="handleCancel">
            取消
          </button>
          <button
            type="submit"
            class="wpx-btn skill-form__btn skill-form__btn--primary"
          >
            开始生成
          </button>
        </footer>
      </form>
    </div>
  </div>

  <!-- ── 内嵌模式（无遮罩） ── -->
  <div v-else class="skill-form-inline" @keydown="handleKeydown">
    <div v-if="!schema" class="skill-form-inline__empty">
      未找到 Skill "{{ skillId }}"
    </div>

    <form v-else class="skill-form-inline__body" @submit.prevent="handleSubmit">
      <div v-for="(field, key) in schema" :key="key" class="skill-form__field">
        <label class="skill-form__label" :for="`skill-input-${skillId}-${key}`">
          {{ field.label || key }}
        </label>

        <input
          v-if="field.type === 'text'"
          :id="`skill-input-${skillId}-${key}`"
          v-model="formData[key]"
          type="text"
          class="wpx-input skill-form__input"
          :placeholder="field.placeholder"
        />

        <input
          v-else-if="field.type === 'number'"
          :id="`skill-input-${skillId}-${key}`"
          v-model="formData[key]"
          type="number"
          class="wpx-input skill-form__input"
          :placeholder="field.placeholder"
        />

        <textarea
          v-else-if="field.type === 'textarea'"
          :id="`skill-input-${skillId}-${key}`"
          v-model="formData[key]"
          class="wpx-input skill-form__input skill-form__textarea"
          :placeholder="field.placeholder"
          rows="4"
        />

        <select
          v-else-if="field.type === 'select'"
          :id="`skill-input-${skillId}-${key}`"
          v-model="formData[key]"
          class="wpx-input skill-form__input"
        >
          <option v-if="field.placeholder" value="" disabled>
            {{ field.placeholder }}
          </option>
          <option
            v-for="opt in (field.options || [])"
            :key="opt.value || opt"
            :value="opt.value || opt"
          >
            {{ opt.label || opt }}
          </option>
        </select>

        <input
          v-else
          :id="`skill-input-${skillId}-${key}`"
          v-model="formData[key]"
          type="text"
          class="wpx-input skill-form__input"
          :placeholder="field.placeholder"
        />
      </div>

      <footer class="skill-form-inline__footer">
        <button type="button" class="wpx-btn skill-form__btn" @click="handleCancel">
          取消
        </button>
        <button
          type="submit"
          class="wpx-btn skill-form__btn skill-form__btn--primary"
        >
          开始生成
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
/* ── 浮层模式 ── */
.skill-form-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 16px 16px;
  background: rgba(15, 23, 42, 0.35);
}

.skill-form-dialog {
  width: min(100%, 480px);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg);
  color: var(--theme-fg);
  box-shadow: var(--theme-shadow-lg);
}

.skill-form-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--theme-border);
}

.skill-form-dialog__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.skill-form-dialog__close {
  border: none;
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: pointer;
  font-size: 16px;
}

.skill-form-dialog__body {
  padding: 14px;
}

.skill-form-dialog__empty {
  margin: 0;
  font-size: 13px;
  color: var(--theme-fg-muted);
  text-align: center;
  padding: 24px 0;
}

.skill-form-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--theme-border);
  margin-top: 14px;
}

/* ── 内嵌模式 ── */
.skill-form-inline {
  padding: 8px 0;
}

.skill-form-inline__empty {
  font-size: 13px;
  color: var(--theme-fg-muted);
  text-align: center;
  padding: 16px 0;
}

.skill-form-inline__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-form-inline__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}

/* ── 公共字段样式 ── */
.skill-form__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-form__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-fg);
}

.skill-form__input {
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  box-sizing: border-box;
}

.skill-form__textarea {
  resize: vertical;
  min-height: 72px;
}

.skill-form__btn {
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  background: var(--theme-bg);
  color: var(--theme-fg);
  cursor: pointer;
}

.skill-form__btn--primary {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
  color: #fff;
}
</style>
