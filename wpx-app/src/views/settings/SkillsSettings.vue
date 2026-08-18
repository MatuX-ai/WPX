<script setup>
import { computed, onMounted, ref } from 'vue'
import { SKILL_CATEGORY_LABELS } from '@/data/skills'
import { resolveSkillIcon } from '@/constants/skillIcons'
import { useSkillsStore } from '@/stores/skills'
import { useSkillHub } from '@/composables/useSkillHub'
import { isElectron } from '@/utils/electron'

const skillsStore = useSkillsStore()
const hub = useSkillHub()

// ── 筛选标签 ──────────────────────────────────

const filters = [
  { key: 'all', label: '全部' },
  { key: 'writing', label: SKILL_CATEGORY_LABELS.writing },
  { key: 'editing', label: SKILL_CATEGORY_LABELS.editing },
  { key: 'knowledge', label: SKILL_CATEGORY_LABELS.knowledge },
  { key: 'education', label: '🎓 教师专用' },
  { key: 'college', label: '🎒 大学生专用' },
  { key: 'market', label: '🛒 技能市场' },
]

const activeCategory = ref('all')

// ── 技能市场（SKILL.md 兼容层 · Phase 1 / M1） ──
const importText = ref('')
const importMessage = ref('')
const importFileInput = ref(null)
const exportMessage = ref('')

async function handleSync (sourceId) {
  const result = await hub.sync(sourceId)
  if (!result.ok) {
    importMessage.value = `同步失败：${result.errors?.map((e) => e.reason).join('；') || '未知错误'}`
    return
  }
  importMessage.value = result.fromCache
    ? `离线模式：已使用上次缓存（${result.skills.length} 个技能）`
    : `同步完成：新增 ${result.added}，更新 ${result.updated}，失败 ${result.failed}`
}

function handleExport () {
  if (isElectron()) {
    void hub.exportToDisk().then((result) => {
      if (!result) {
        exportMessage.value = '导出不可用（缺少 skillhub IPC）'
        return
      }
      if (result.ok) {
        exportMessage.value = result.path
          ? `已导出到 ${result.path}`
          : `已导出 ${result.written} 份 SKILL.md 到 ${result.dir}`
      } else if (!result.canceled) {
        exportMessage.value = `导出失败：${result.error || '未知错误'}`
      }
    })
    return
  }
  const files = hub.exportSkills({ download: true })
  exportMessage.value = `已导出 ${files.length} 份 SKILL.md 文件`
}

function handleImportFileClick () {
  if (isElectron()) {
    void hub.importSkillFile().then((result) => {
      if (!result) {
        importMessage.value = '导入不可用（缺少 skillhub IPC）'
        return
      }
      if (result.ok) {
        importMessage.value = `导入成功：${result.skill.name}（${result.path}）`
      } else if (result.canceled) {
        importMessage.value = '已取消导入'
      } else {
        importMessage.value = `导入失败：${(result.errors || []).join('；') || '未知错误'}`
      }
    })
    return
  }
  if (importFileInput.value) {
    importFileInput.value.click()
  }
}

function handleImport () {
  const text = importText.value.trim()
  if (!text) return
  const result = hub.importSkillMdText(text)
  importMessage.value = result.ok
    ? `导入成功：${result.skill.name}（${result.skill.id}）`
    : `导入失败：${result.errors.join('；')}`
  if (result.ok) importText.value = ''
}

function handleImportFile (event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    const result = hub.importSkillMdText(text, { path: file.name })
    importMessage.value = result.ok
      ? `导入成功：${result.skill.name}（${file.name}）`
      : `导入失败（${file.name}）：${result.errors.join('；')}`
    if (result.ok) importText.value = text
  }
  reader.readAsText(file)
  if (importFileInput.value) importFileInput.value.value = ''
}

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
              <span v-if="!skill.source" class="skill-card__badge skill-card__badge--builtin">
                内置
              </span>
              <span v-else class="skill-card__badge skill-card__badge--skillhub">
                市场{{ skill.license ? ` · ${skill.license}` : '' }}
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
              <span v-if="!skill.source" class="skill-card__badge skill-card__badge--builtin">
                内置
              </span>
              <span v-else class="skill-card__badge skill-card__badge--skillhub">
                市场{{ skill.license ? ` · ${skill.license}` : '' }}
              </span>
            </div>
          </article>
        </div>
      </div>
    </template>

    <!-- ── 技能市场（SKILL.md 兼容层 · Phase 1 / M1） ── -->
    <template v-else-if="activeCategory === 'market'">
      <div class="skills-section">
        <h3 class="skills-section__title">📦 技能源</h3>
        <p class="skills-section__empty">
          从 SKILL.md 标准技能库同步技能（如 Hermes Agent 官方库，Apache-2.0）。同步后技能出现在「全部」分类，可单独启用 / 禁用。
        </p>

        <div class="market-source-list">
          <article v-for="source in hub.sources" :key="source.id" class="market-source-card">
            <div class="market-source-card__body">
              <h4 class="market-source-card__name">{{ source.name }}</h4>
              <p class="market-source-card__desc">{{ source.description }}</p>
              <div class="skill-card__badges">
                <span class="skill-card__badge skill-card__badge--skillhub">{{ source.license }}</span>
                <a
                  v-if="source.homepage"
                  :href="source.homepage"
                  target="_blank"
                  rel="noopener"
                  class="market-source-card__link"
                >GitHub ↗</a>
              </div>
            </div>
            <div class="market-source-card__actions">
              <button
                type="button"
                class="market-source-card__sync"
                :disabled="hub.isSyncing"
                @click="handleSync(source.id)"
              >
                {{ hub.syncingId === source.id ? '同步中…' : '同步' }}
              </button>
            </div>
          </article>
        </div>

        <p
          v-if="importMessage"
          class="market-result"
          :class="{ 'market-result--error': importMessage.startsWith('同步失败') || importMessage.startsWith('导入失败') }"
        >{{ importMessage }}</p>
        <p class="skills-section__empty">
          已安装市场技能：{{ hub.marketSkillCount }} 个
          <span v-if="hub.lastSyncAt"> · 上次同步：{{ hub.lastSyncAt.slice(0, 19).replace('T', ' ') }}</span>
        </p>
      </div>

      <div class="skills-section">
        <h3 class="skills-section__title">🧾 导出 / 导入 SKILL.md</h3>
        <div class="market-export-row">
          <button type="button" class="market-source-card__sync" @click="handleExport">导出内置技能为 SKILL.md</button>
          <button
            type="button"
            class="market-source-card__sync market-source-card__sync--ghost"
            @click="handleImportFileClick"
          >导入 SKILL.md 文件</button>
          <input ref="importFileInput" type="file" accept=".md,.markdown,text/markdown" hidden @change="handleImportFile" />
          <span v-if="exportMessage" class="market-result">{{ exportMessage }}</span>
        </div>
        <textarea
          v-model="importText"
          class="market-import-textarea"
          rows="6"
          placeholder="粘贴 SKILL.md 文本（YAML frontmatter + 指令正文）…"
        />
        <button
          type="button"
          class="market-source-card__sync"
          :disabled="!importText.trim()"
          @click="handleImport"
        >导入文本</button>
      </div>

      <div v-if="skillsStore.marketSkills.length > 0" class="skills-section">
        <h3 class="skills-section__title">🛍️ 已安装的市场技能</h3>
        <div class="skills-grid">
          <article v-for="skill in skillsStore.marketSkills" :key="skill.id" class="skill-card">
            <div class="skill-card__header">
              <div class="skill-card__icon-wrap" aria-hidden="true">
                <component :is="getSkillIcon(skill.icon)" v-if="getSkillIcon(skill.icon)" :size="20" />
                <span v-else class="skill-card__icon-fallback">⚡</span>
              </div>
              <label class="skill-card__switch" :for="`skill-toggle-${skill.id}`">
                <input
                  :id="`skill-toggle-${skill.id}`"
                  type="checkbox"
                  :checked="skillsStore.isSkillEnabled(skill.id)"
                  @change="handleToggle(skill.id, $event)"
                />
                <span class="skill-card__switch-slider" aria-hidden="true" />
                <span class="skill-card__switch-text">{{ skillsStore.isSkillEnabled(skill.id) ? '已启用' : '已禁用' }}</span>
              </label>
            </div>

            <h4 class="skill-card__name">{{ skill.name }}</h4>
            <p class="skill-card__desc">{{ skill.description }}</p>

            <div class="skill-card__badges">
              <span class="skill-card__badge skill-card__badge--skillhub">
                市场{{ skill.license ? ` · ${skill.license}` : '' }}
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

/* ── 技能市场（SKILL.md 兼容层） ── */
.market-source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.market-source-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  padding: 14px 16px;
  box-shadow: var(--theme-shadow-sm);
}

.market-source-card__name {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg);
}

.market-source-card__desc {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg-muted);
}

.market-source-card__link {
  font-size: 12px;
  color: var(--theme-accent);
  text-decoration: none;
}

.market-source-card__link:hover {
  text-decoration: underline;
}

.market-source-card__actions {
  flex-shrink: 0;
}

.market-source-card__sync {
  border: 1px solid var(--theme-accent);
  border-radius: 999px;
  background: var(--theme-accent);
  color: #fff;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.market-source-card__sync:hover:not(:disabled) {
  opacity: 0.9;
}

.market-source-card__sync:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.market-source-card__sync--ghost {
  background: transparent;
  color: var(--theme-accent);
}

.market-result {
  margin: 4px 0 12px;
  font-size: 12px;
  color: #15803d;
}

.market-result--error {
  color: #b91c1c;
}

.market-export-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.market-import-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-bg);
  color: var(--theme-fg);
  padding: 10px 12px;
  font-size: 12px;
  font-family: var(--theme-font-mono, ui-monospace, monospace);
  line-height: 1.5;
  resize: vertical;
  margin-bottom: 10px;
}

.market-import-textarea:focus {
  outline: none;
  border-color: var(--theme-accent);
}
</style>
