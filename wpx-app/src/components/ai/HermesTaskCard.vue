<script setup>
/**
 * HermesTaskCard —— 任务型消息卡片（Phase 3 / M3-C）
 *
 * 展示 Hermes 本地任务执行状态（步骤 / 结果 / 错误），
 * 提供「复制结果」与「插入文档」操作（emit 给宿主）。
 */
import { computed } from 'vue'

const props = defineProps({
  task: { type: String, default: '' },
  status: { type: String, default: 'idle' }, // idle | running | done | error
  steps: { type: Array, default: () => [] },
  result: { type: String, default: '' },
  error: { type: String, default: '' },
})

const emit = defineEmits(['insert', 'dismiss'])

const statusLabel = computed(() => {
  switch (props.status) {
    case 'running': return 'Hermes 执行中…'
    case 'done': return 'Hermes 完成'
    case 'error': return 'Hermes 失败'
    default: return 'Hermes 任务'
  }
})

const statusTone = computed(() => {
  if (props.status === 'running') return 'info'
  if (props.status === 'done') return 'ok'
  if (props.status === 'error') return 'error'
  return 'muted'
})

function handleCopy() {
  const text = props.result || props.error || props.task
  if (!text) return
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text)
  }
}

function handleInsert() {
  if (props.result) emit('insert', props.result)
}
</script>

<template>
  <div class="hermes-task-card" :class="`hermes-task-card--${statusTone}`" role="status">
    <header class="hermes-task-card__header">
      <span class="hermes-task-card__dot" aria-hidden="true" />
      <span class="hermes-task-card__title">{{ statusLabel }}</span>
      <span v-if="status === 'running'" class="hermes-task-card__spinner" aria-hidden="true" />
      <button
        v-if="status !== 'running'"
        type="button"
        class="hermes-task-card__dismiss"
        aria-label="关闭"
        @click="emit('dismiss')"
      >✕</button>
    </header>

    <p v-if="task" class="hermes-task-card__task">「{{ task }}」</p>

    <ol v-if="steps.length" class="hermes-task-card__steps">
      <li v-for="(step, index) in steps" :key="index">{{ step }}</li>
    </ol>

    <p v-if="status === 'error' && error" class="hermes-task-card__error">{{ error }}</p>

    <pre v-if="status === 'done' && result" class="hermes-task-card__result">{{ result }}</pre>

    <footer v-if="status === 'done'" class="hermes-task-card__actions">
      <button type="button" class="hermes-task-card__btn" @click="handleCopy">复制结果</button>
      <button type="button" class="hermes-task-card__btn hermes-task-card__btn--primary" @click="handleInsert">
        插入文档
      </button>
    </footer>
  </div>
</template>

<style scoped>
.hermes-task-card {
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg);
  box-shadow: var(--theme-shadow-sm);
}

.hermes-task-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hermes-task-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--theme-border);
  flex-shrink: 0;
}

.hermes-task-card--ok .hermes-task-card__dot { background: #22c55e; }
.hermes-task-card--info .hermes-task-card__dot { background: #3b82f6; }
.hermes-task-card--error .hermes-task-card__dot { background: #ef4444; }

.hermes-task-card__title {
  font-weight: 600;
  font-size: 13px;
}

.hermes-task-card__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--theme-border);
  border-top-color: var(--theme-accent);
  border-radius: 50%;
  animation: hermes-task-spin 0.8s linear infinite;
}

@keyframes hermes-task-spin {
  to { transform: rotate(360deg); }
}

.hermes-task-card__dismiss {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--theme-fg-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}

.hermes-task-card__task {
  margin: 8px 0 0;
  color: var(--theme-fg-muted);
  font-size: 12px;
}

.hermes-task-card__steps {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--theme-fg-muted);
}

.hermes-task-card__error {
  margin: 8px 0 0;
  color: #b91c1c;
  font-size: 12px;
}

.hermes-task-card__result {
  margin: 10px 0 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg);
  padding: 10px 12px;
  font-size: 12px;
  font-family: var(--theme-font-mono, ui-monospace, monospace);
}

.hermes-task-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.hermes-task-card__btn {
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-bg);
  color: var(--theme-fg);
  padding: 4px 14px;
  font-size: 12px;
  cursor: pointer;
}

.hermes-task-card__btn--primary {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
  color: #fff;
}
</style>
