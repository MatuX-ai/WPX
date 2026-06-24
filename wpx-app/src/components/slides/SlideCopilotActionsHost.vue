<!--
  SlideCopilotActionsHost - 无渲染组件，仅用于注册 CopilotKit Frontend Tools
  必须在 <CopilotKitProvider> 子树内挂载，否则 useFrontendTool 会抛错。
  当前实例放置在 EditorLayout 中，确保所有编辑器窗口都能拿到这些 actions。
  Action 声明集中在 src/copilot/actions/slide-actions.js，本组件只负责注册入口。
-->
<script setup>
import { useCopilotSlideActions } from '@/copilot/actions/slide-actions'

useCopilotSlideActions()
</script>

<template>
  <span hidden aria-hidden="true" />
</template>