<script setup>
/**
 * SmartTemplate.vue
 *
 * 模板画廊（取代旧"我的智能模板"单一视图）：
 *   - 始终渲染【冷启动模板】（来自 @/data/cold-start-templates，按分类展示）
 *   - 当用户已保存过 3 次以上同类文档时，再追加【我的常用】分类
 *
 * 事件：
 *   use-template  → 携带完整模板对象 { id, documentType, format, content, ... }
 *   EditorLayout.createNewDocument 会调用：
 *     - setSessionDocumentType(template.documentType)
 *     - editorRef.loadMarkdown(template.content)
 *     - applyFormat(template.format)
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  fetchSmartTemplates,
  onTemplatesUpdated,
} from '@/utils/memoryApi'
import { useUserHabitsStore } from '@/stores/userHabits'
import { isElectron } from '@/utils/electron'
import {
  getColdStartTemplatesByCategory,
  CATEGORY_LABELS,
} from '@/data/cold-start-templates'

const emit = defineEmits(['use-template'])

const habitsStore = useUserHabitsStore()
const smartTemplates = ref([])
const loading = ref(false)

const coldStartGroups = computed(() => getColdStartTemplatesByCategory())

async function loadTemplates() {
  loading.value = true
  try {
    if (isElectron()) {
      smartTemplates.value = await fetchSmartTemplates()
      return
    }
    smartTemplates.value = habitsStore.getSmartTemplates()
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

function handlePick(template) {
  emit('use-template', template)
}
</script>

<template>
  <div class="smart-template" aria-label="模板画廊">
    <p class="smart-template__title">从模板创建</p>
    <p class="smart-template__subtitle">
      套用模板会在新窗口中预填结构与格式，保留你后续修改的自由度。
    </p>

    <p v-if="loading" class="smart-template__empty">加载模板中…</p>

    <!-- 我的常用（智能模板，仅在有保存历史时显示） -->
    <section
      v-if="!loading && smartTemplates.length"
      class="smart-template__section"
      data-testid="smart-template-frequent"
    >
      <h3 class="smart-template__section-title">
        我的常用
        <span class="smart-template__section-hint">基于保存习惯自动推荐</span>
      </h3>
      <div class="smart-template__list">
        <button
          v-for="template in smartTemplates"
          :key="`smart-${template.documentType}`"
          type="button"
          class="smart-template__chip smart-template__chip--frequent wpx-btn"
          @click="handlePick(template)"
        >
          <span class="smart-template__chip-name">{{ template.documentType }}</span>
          <span class="smart-template__count">{{ template.count }} 次</span>
        </button>
      </div>
    </section>

    <!-- 冷启动模板（始终显示，按分类） -->
    <section
      v-for="group in coldStartGroups"
      :key="group.category"
      class="smart-template__section"
      :data-testid="`cold-start-group-${group.category}`"
    >
      <h3 class="smart-template__section-title">
        {{ group.label }}
        <span class="smart-template__section-hint">
          {{ CATEGORY_LABELS[group.category] ? '内置' : '' }}
        </span>
      </h3>
      <div class="smart-template__list">
        <button
          v-for="template in group.templates"
          :key="template.id"
          type="button"
          class="smart-template__chip wpx-btn"
          :title="template.description"
          @click="handlePick(template)"
        >
          <span class="smart-template__chip-name">{{ template.name }}</span>
          <span v-if="template.description" class="smart-template__chip-desc">
            {{ template.description }}
          </span>
        </button>
      </div>
    </section>
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
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg);
}

.smart-template__subtitle {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg-subtle);
}

.smart-template__section + .smart-template__section {
  margin-top: 18px;
}

.smart-template__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--theme-fg-muted);
  text-transform: uppercase;
}

.smart-template__section-hint {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--theme-fg-subtle);
}

.smart-template__empty {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--theme-fg-subtle);
}

.smart-template__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
}

.smart-template__chip {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-bg-subtle);
  color: var(--theme-fg);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background-color 160ms ease,
    transform 120ms ease;
}

.smart-template__chip:hover {
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  background: var(--theme-accent-muted);
  transform: translateY(-1px);
}

.smart-template__chip:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

.smart-template__chip--frequent {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
}

.smart-template__chip-name {
  font-weight: 500;
  white-space: nowrap;
}

.smart-template__chip-desc {
  font-size: 11px;
  color: var(--theme-fg-subtle);
  line-height: 1.4;
}

.smart-template__count {
  font-size: 11px;
  color: var(--theme-fg-subtle);
}

@media (max-width: 480px) {
  .smart-template__chip-desc {
    display: none;
  }
}
</style>