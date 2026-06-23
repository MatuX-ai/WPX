<script setup>
import { computed, onMounted, ref } from 'vue'
import { SKILL_CATEGORY_LABELS } from '@/data/skills'
import { resolveSkillIcon } from '@/constants/skillIcons'
import { useSkillsStore } from '@/stores/skills'

const skillsStore = useSkillsStore()

const filters = [
  { key: 'all', label: '全部' },
  { key: 'writing', label: SKILL_CATEGORY_LABELS.writing },
  { key: 'editing', label: SKILL_CATEGORY_LABELS.editing },
  { key: 'knowledge', label: SKILL_CATEGORY_LABELS.knowledge },
]

const activeCategory = ref('all')

const filteredSkills = computed(() => {
  const skills = skillsStore.skillsWithState
  if (activeCategory.value === 'all') return skills
  return skills.filter((skill) => skill.category === activeCategory.value)
})

function getSkillIcon(iconName) {
  return resolveSkillIcon(iconName)
}

function handleToggle(skillId, event) {
  skillsStore.setSkillEnabled(skillId, event.target.checked)
}

onMounted(() => {
  if (!skillsStore.hydrated) {
    skillsStore.initFromLocalStorage()
  }
})
</script>

<template>
  <section class="settings-panel skills-settings">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">Skills 管理</h2>
      <p class="settings-panel__desc">启用或禁用 AI 助手的内置技能，禁用的 Skill 不会注入对话 System Prompt。</p>
    </header>

    <div class="skills-settings__tabs" role="tablist" aria-label="Skills 分类">
      <button
        v-for="filter in filters"
        :key="filter.key"
        type="button"
        class="skills-settings__tab"
        :class="{ 'skills-settings__tab--active': activeCategory === filter.key }"
        role="tab"
        :aria-selected="activeCategory === filter.key ? 'true' : 'false'"
        @click="activeCategory = filter.key"
      >
        {{ filter.label }}
      </button>
    </div>

    <div v-if="filteredSkills.length === 0" class="settings-placeholder">当前分类暂无 Skill</div>

    <div v-else class="skills-grid">
      <article v-for="skill in filteredSkills" :key="skill.id" class="skill-card">
        <div class="skill-card__header">
          <div class="skill-card__icon-wrap" aria-hidden="true">
            <component :is="getSkillIcon(skill.icon)" v-if="getSkillIcon(skill.icon)" :size="20" />
            <span v-else class="skill-card__icon-fallback">⚡</span>
          </div>
          <label class="skill-card__switch" :for="`skill-toggle-${skill.id}`">
            <input
              :id="`skill-toggle-${skill.id}`"
              type="checkbox"
              :checked="skill.enabled"
              @change="handleToggle(skill.id, $event)"
            />
            <span class="skill-card__switch-slider" aria-hidden="true" />
            <span class="skill-card__switch-text">{{ skill.enabled ? '已启用' : '已禁用' }}</span>
          </label>
        </div>

        <h3 class="skill-card__name">{{ skill.name }}</h3>
        <p class="skill-card__desc">{{ skill.description }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.skills-settings {
  max-width: 56rem;
}

.skills-settings__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.skills-settings__tab {
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-bg);
  padding: 6px 14px;
  font-size: 13px;
  color: var(--theme-fg-muted);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.skills-settings__tab:hover {
  border-color: var(--theme-accent);
  color: var(--theme-fg);
}

.skills-settings__tab--active {
  border-color: var(--theme-accent);
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 960px) {
  .skills-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .skills-grid {
    grid-template-columns: 1fr;
  }
}

.skill-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  padding: 16px;
  box-shadow: var(--theme-shadow-sm);
}

.skill-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.skill-card__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
}

.skill-card__icon-fallback {
  font-size: 18px;
  line-height: 1;
}

.skill-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--theme-fg);
}

.skill-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--theme-fg-muted);
}

.skill-card__switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.skill-card__switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.skill-card__switch-slider {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: var(--theme-border);
  transition: background 0.2s ease;
}

.skill-card__switch-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.skill-card__switch input:checked + .skill-card__switch-slider {
  background: var(--theme-accent);
}

.skill-card__switch input:checked + .skill-card__switch-slider::after {
  transform: translateX(16px);
}

.skill-card__switch-text {
  font-size: 12px;
  color: var(--theme-fg-subtle);
  white-space: nowrap;
}
</style>
