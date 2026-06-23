<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  fetchSmartTemplates,
  onTemplatesUpdated,
} from '@/utils/memoryApi'
import { useUserHabitsStore } from '@/stores/userHabits'
import { isElectron } from '@/utils/electron'

const emit = defineEmits(['use-template'])

const habitsStore = useUserHabitsStore()
const templates = ref([])
const loading = ref(false)

async function loadTemplates() {
  loading.value = true
  try {
    if (isElectron()) {
      templates.value = await fetchSmartTemplates()
      return
    }

    templates.value = habitsStore.getSmartTemplates()
  } finally {
    loading.value = false
  }
}

let unsubscribeTemplatesUpdated = null

onMounted(() => {
  loadTemplates()

  if (isElectron()) {
    unsubscribeTemplatesUpdated = onTemplatesUpdated(() => {
      loadTemplates()
    })
  }
})

onUnmounted(() => {
  unsubscribeTemplatesUpdated?.()
  unsubscribeTemplatesUpdated = null
})
</script>

<template>
  <div v-if="loading || templates.length" class="smart-template">
    <p class="smart-template__title">我的智能模板</p>

    <p v-if="loading" class="smart-template__empty">加载模板中…</p>

    <div v-else-if="templates.length" class="smart-template__list">
      <button
        v-for="template in templates"
        :key="template.documentType"
        type="button"
        class="smart-template__chip wpx-btn"
        @click="emit('use-template', template)"
      >
        {{ template.documentType }}
        <span class="smart-template__count">{{ template.count }} 次</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.smart-template {
  width: 100%;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--theme-border);
}

.smart-template__title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-fg-muted);
}

.smart-template__empty {
  margin: 0;
  font-size: 13px;
  color: var(--theme-fg-subtle);
}

.smart-template__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.smart-template__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-bg-subtle);
  color: var(--theme-fg);
  font-size: 13px;
  cursor: pointer;
}

.smart-template__chip:hover {
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  background: var(--theme-accent-muted);
}

.smart-template__count {
  font-size: 11px;
  color: var(--theme-fg-subtle);
}
</style>
