<!--
  顶栏"刷新当前页"中转路由：进入后立即 replace 跳回原路径。
  不渲染任何 UI。
-->
<template>
  <div class="p-6 text-sm text-gray-400">正在刷新…</div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  // /redirect/<原路径>  ->  <原路径>
  const target = '/' + (route.params.pathMatch || '')
  router.replace(target).catch(() => {
    router.replace('/dashboard')
  })
})
</script>