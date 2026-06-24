<!--
  通用占位页面：用于尚未实现具体业务的后台页面。
  Props:
    - title    : 页面标题（必填）
    - subtitle : 副标题
    - module   : 权限码（仅展示）
-->
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">{{ title }}</h1>
        <p
          v-if="subtitle"
          class="text-sm text-gray-500 mt-1"
        >
          {{ subtitle }}
        </p>
      </div>
      <span
        v-if="module"
        class="wpx-badge-gray"
      >权限：{{ module }}</span>
    </div>

    <div class="wpx-card p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
      <div class="text-5xl mb-3">🚧</div>
      <h2 class="text-base font-semibold text-gray-900 mb-1">
        {{ title }} 页面开发中
      </h2>
      <p class="text-sm text-gray-500 max-w-md">
        该模块的占位页面已创建，后续将按需求文档接入后端接口与交互。
      </p>
      <p
        v-if="module"
        class="text-xs text-gray-400 mt-3"
      >
        当前访问所需的权限：<code class="px-1.5 py-0.5 rounded bg-gray-100">{{ module }}</code>
      </p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  module: { type: String, default: '' }
})
</script>