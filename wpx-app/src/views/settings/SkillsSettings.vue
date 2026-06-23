<script setup>
import { computed, onMounted, ref } from 'vue'
import { SKILL_CATEGORY_LABELS } from '@/data/skills'
import { resolveSkillIcon } from '@/constants/skillIcons'
import { useSkillsStore } from '@/stores/skills'

const skillsStore = useSkillsStore()

// ── 筛选标签 ──────────────────────────────────

const filters = [
  { key: 'all', label: '全部' },
  { key: 'writing', label: SKILL_CATEGORY_LABELS.writing },
  { key: 'editing', label: SKILL_CATEGORY_LABELS.editing },
  { key: 'knowledge', label: SKILL_CATEGORY_LABELS.knowledge },
  { key: 'education', label: '🎓 教师专用' },
  { key: 'college', label: '🎒 大学生专用' },
]

const activeCategory = ref('all')

// ── 子分类分组定义 ────────────────────────────

const EDUCATION_SUBCATEGORIES = [
  { key: 'teaching-prep', icon: '📚', label: '教学准备', hint: '4个' },
  { key: 'assessment', icon: '📝', label: '出题与测评', hint: '4个' },
  { key: 'grading', icon: '✍️', label: '批改与反馈', hint: '3个' },
  { key: 'communication', icon: '💬', label: '沟通与管理', hint: '3个' },
  { key: 'professional-growth', icon: '🌱', label: '个人成长', hint: '2个' },
]

const COLLEGE_SUBCATEGORIES = [
  { key: 'academic-writing', icon: '📝', label: '学术写作', hint: '5个' },
  { key: 'study-aid', icon: '📚', label: '学习辅助', hint: '4个' },
  { key: 'knowledge-mgmt', icon: '🧠', label: '知识管理', hint: '3个' },
  { key: 'presentation', icon: '🎤', label: '展示汇报', hint: '2个' },
  { key: 'career-planning', icon: '🎯', label: '学业规划', hint: '2个' },
]

// ── 筛选与分组 ────────────────────────────────

/** 当前分类的所有 Skill（含 enabled 状态） */
const filteredSkills = computed(() => {
  const skills = skillsStore.skillsWithState
  if (activeCategory.value === 'all') return skills
  return skills.filter((skill) => skill.category === activeCategory.value)
})

/** 按子分类分组的 Skills（教师专用） */
const educationGroups = computed(() => {
  return EDUCATION_SUBCATEGORIES.map((group) => ({
    ...group,
    skills: skillsStore.skillsWithState.filter(
      (s) => s.category === 'education' && s.subcategory === group.key,
    ),
  }))
})

/** 按子分类分组的 Skills（大学生专用） */
const collegeGroups = computed(() => {
  return COLLEGE_SUBCATEGORIES.map((group) => ({
    ...group,
    skills: skillsStore.skillsWithState.filter(
      (s) => s.category === 'college' && s.subcategory === group.key,
    ),
  }))
})

// ── 操作 ─────────────────────────────────────

function getSkillIcon (iconName) {
  return resolveSkillIcon(iconName)
}

function handleToggle (skillId, event) {
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

    <!-- 筛选标签栏 -->
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

    <!-- ── 教师专用：按子分类分组 ── -->
    <template v-if="activeCategory === 'education'">
      <div v-for="group in educationGroups" :key="group.key" class="skills-section">
        <h3 class="skills-section__title">
          <span class="skills-section__icon">{{ group.icon }}</span>
          {{ group.label }}
          <span class="skills-section__count">{{ group.hint }}</span>
        </h3>

        <div v-if="group.skills.length === 0" class="skills-section__empty">
          暂无 Skill
        </div>

        <div v-else class="skills-grid">
          <article v-for="skill in group.skills" :key="skill.id" class="skill-card">
            <div class="skill-card__header">
              <div class="skill-card__icon-wrap" aria-hidden="true">
                <component
                  :is="getSkillIcon(skill.icon)"
                  v-if="getSkillIcon(skill.icon)"
                  :size="20"
                />
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

            <h4 class="skill-card__name">{{ skill.name }}</h4>
            <p class="skill-card__desc">{{ skill.description }}</p>

            <div class="skill-card__badges">
              <span class="skill-card__badge skill-card__badge--builtin">
                内置
              </span>
            </div>
          </article>
        </div>
      </div>
    </template>

    <!-- ── 大学生专用：按子分类分组 ── -->
    <template v-else-if="activeCategory === 'college'">
      <div v-for="group in collegeGroups" :key="group.key" class="skills-section">
        <h3 class="skills-section__title">
          <span class="skills-section__icon">{{ group.icon }}</span>
          {{ group.label }}
          <span class="skills-section__count">{{ group.hint }}</span>
        </h3>

        <div v-if="group.skills.length === 0" class="skills-section__empty">
          暂无 Skill
        </div>

        <div v-else class="skills-grid">
          <article v-for="skill in group.skills" :key="skill.id" class="skill-card">
            <div class="skill-card__header">
              <div class="skill-card__icon-wrap" aria-hidden="true">
                <component
                  :is="getSkillIcon(skill.icon)"
                  v-if="getSkillIcon(skill.icon)"
                  :size="20"
                />
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

            <h4 class="skill-card__name">{{ skill.name }}</h4>
            <p class="skill-card__desc">{{ skill.description }}</p>

            <div class="skill-card__badges">
              <span class="skill-card__badge skill-card__badge--builtin">
                内置
              </span>
            </div>
          </article>
        </div>
      </div>
    </template>

    <!-- ── 其他分类（全部 / 写作 / 编辑 / 知识）：列表展示 ── -->
    <template v-else>
      <div v-if="filteredSkills.length === 0" class="settings-placeholder">当前分类暂无 Skill</div>

      <div v-else class="skills-grid">
        <article v-for="skill in filteredSkills" :key="skill.id" class="skill-card">
          <div class="skill-card__header">
            <div class="skill-card__icon-wrap" aria-hidden="true">
              <component
                :is="getSkillIcon(skill.icon)"
                v-if="getSkillIcon(skill.icon)"
                :size="20"
              />
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

          <div class="skill-card__badges">
            <span class="skill-card__badge skill-card__badge--builtin">
              内置
            </span>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.skills-settings {
  max-width: 56rem;
}

/* ── 筛选标签 ── */
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

/* ── 子分类分组标题 ── */
.skills-section {
  margin-bottom: 28px;
}

.skills-section__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--theme-fg);
}

.skills-section__icon {
  font-size: 18px;
  line-height: 1;
}

.skills-section__count {
  font-size: 12px;
  font-weight: 400;
  color: var(--theme-fg-muted);
  margin-left: 4px;
}

.skills-section__empty {
  font-size: 13px;
  color: var(--theme-fg-muted);
  padding: 8px 0;
}

/* ── Skill 卡片网格 ── */
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

/* ── Skill 卡片 ── */
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
  flex-shrink: 0;
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── 来源徽章 ── */
.skill-card__badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
}

.skill-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

.skill-card__badge--builtin {
  background: #e0f2fe;
  color: #0369a1;
}

.skill-card__badge--skillhub {
  background: #dcfce7;
  color: #15803d;
}

/* ── 开关 ── */
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
