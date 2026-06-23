<script setup>
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
</script>

<template>
  <button
    type="button"
    class="knowledge-trigger"
    :class="{ 'knowledge-trigger--open': appStore.knowledgePanelOpen }"
    :aria-expanded="appStore.knowledgePanelOpen"
    aria-label="打开资料库"
    @click="appStore.toggleKnowledgePanel()"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke-linejoin="round" />
      <path d="M8 7h8M8 11h8M8 15h5" stroke-linecap="round" />
    </svg>
    <span class="knowledge-trigger__label">资料库</span>
  </button>
</template>

<style scoped>
.knowledge-trigger {
  position: fixed;
  top: 50%;
  left: 0;
  z-index: var(--z-knowledge-trigger);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px 12px 6px;
  border: 1px solid #e2e8f0;
  border-left: none;
  border-radius: 0 10px 10px 0;
  background: #fff;
  color: #64748b;
  box-shadow: 2px 0 12px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  transform: translateY(-50%);
  transition: color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.knowledge-trigger:hover {
  color: #7c3aed;
  background: #faf5ff;
}

.knowledge-trigger--open {
  color: #7c3aed;
  background: #f5f3ff;
  transform: translateY(-50%) translateX(min(var(--knowledge-panel-width, 320px), 92vw));
  box-shadow: none;
  border-color: #e2e8f0;
}

.knowledge-trigger__label {
  writing-mode: vertical-rl;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
}
</style>
