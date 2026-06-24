<!--
  Root - 应用根容器
  职责：在 App.vue 外层包裹 CopilotKitProvider，使所有子组件（包括编辑器、AI 对话窗
  等）都能通过 useFrontendTool / useCopilotKit 等 composable 拿到 CopilotKit 上下文。

  runtimeUrl：默认指向 wpx-app/src/server/copilotkit-runtime.js（端口 3006），
  可通过环境变量 VITE_COPILOTKIT_URL 覆盖。

  headers：每次请求会读取 modelSettingsStore 的响应式状态，前端切换自定义模型时，
  后端 Runtime 即可动态切换 BuiltInAgent 的目标模型。
-->
<script setup>
import { computed } from 'vue'
import { CopilotKitProvider } from '@copilotkit/vue/v2'
import { useModelSettingsStore } from '@/stores/modelSettings'
import App from './App.vue'

const modelSettingsStore = useModelSettingsStore()

const runtimeUrl =
  (import.meta.env.VITE_COPILOTKIT_URL || 'http://localhost:3006/api/ck')

const llmHeaders = computed(() => {
  const cfg = modelSettingsStore.effectiveTextConfig
  return {
    'x-wpx-llm-source': String(cfg.source || ''),
    'x-wpx-llm-base-url': String(cfg.baseUrl || ''),
    'x-wpx-llm-model': String(cfg.model || ''),
  }
})

function resolveHeaders() {
  // CopilotKit 期望函数式或静态对象；用函数式以便读取最新响应式状态
  return llmHeaders.value
}
</script>

<template>
  <CopilotKitProvider
    :runtime-url="runtimeUrl"
    :use-single-endpoint="true"
    :headers="resolveHeaders"
  >
    <App />
  </CopilotKitProvider>
</template>