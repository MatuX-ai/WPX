<script setup>
/**
 * JcodeStatusIndicator - jcode 引擎状态指示器
 *
 * 用法：
 *   <JcodeStatusIndicator v-if="jcode.installed" :status="jcode" />
 *
 * 状态映射（参照需求文档 §4.2）：
 *   not_installed → 灰色（不显示）
 *   stopped       → 灰色圆点
 *   starting      → 蓝色脉动
 *   running       → 绿色实心
 *   sleeping      → 黄色实心
 *   failed        → 红色
 */
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: Object,
    default: () => ({}),
  },
})

const state = computed(() => String(props.status?.state || 'stopped').toLowerCase())
const installed = computed(() => props.status?.installed === true)
const version = computed(() => String(props.status?.version || ''))
const lastError = computed(() => String(props.status?.lastError || ''))

const visualState = computed(() => {
  if (!installed.value) return 'not_installed'
  return state.value
})

const dotClass = computed(() => `jcode-status-dot jcode-status-dot--${visualState.value}`)
const tooltip = computed(() => {
  if (!installed.value) return 'jcode 未安装'
  switch (visualState.value) {
    case 'running':
      return `jcode 运行中${version.value ? ` · v${version.value}` : ''}`
    case 'starting':
      return 'jcode 启动中…'
    case 'sleeping':
      return 'jcode 空闲休眠中（5 分钟后自动停止）'
    case 'failed':
      return `jcode 启动失败：${lastError.value || '未知错误'}`
    case 'stopped':
      return 'jcode 未运行'
    default:
      return 'jcode 不可用'
  }
})
</script>

<template>
  <span
    v-if="installed"
    :class="dotClass"
    :title="tooltip"
    :aria-label="tooltip"
    role="status"
  />
</template>

<style scoped>
.jcode-status-dot {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  display: block;
  width: 10px;
  height: 10px;
  border: 2px solid var(--theme-bg, #fff);
  border-radius: 9999px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.18);
  pointer-events: auto;
}

.jcode-status-dot--not_installed {
  display: none;
}

.jcode-status-dot--stopped {
  background: #94a3b8;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.35);
}

.jcode-status-dot--starting {
  background: #3b82f6;
  animation: jcode-pulse 1.2s ease-in-out infinite;
}

.jcode-status-dot--running {
  background: #16a34a;
  box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.35);
}

.jcode-status-dot--sleeping {
  background: #f59e0b;
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.35);
}

.jcode-status-dot--failed {
  background: #ef4444;
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.35);
}

.jcode-status-dot--unavailable {
  background: #cbd5e1;
  box-shadow: 0 0 0 1px rgba(203, 213, 225, 0.35);
}

@keyframes jcode-pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .jcode-status-dot--starting {
    animation: none;
  }
}
</style>
