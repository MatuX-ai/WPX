<script setup>
import { useRouter } from 'vue-router'
import KnowledgePanel from '@/components/knowledge/KnowledgePanel.vue'

const router = useRouter()

function handleClose() {
  router.push({ name: 'editor' })
}
</script>

<template>
  <div class="materials-view">
    <KnowledgePanel embedded :open="true" @close="handleClose" />
  </div>
</template>

<style scoped>
.materials-view {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
  background: var(--theme-bg);
}
</style>
