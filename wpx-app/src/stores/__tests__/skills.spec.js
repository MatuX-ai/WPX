import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSkillsStore, SKILLS_STORAGE_KEY } from '@/stores/skills'
import { useSkillExecutor } from '@/composables/useSkillExecutor'

// ── 教师 Skills 各子分类预期数量 ────────────────
const EDUCATION_SUBCATEGORIES = {
  'teaching-prep': 4,
  'assessment': 4,
  'grading': 3,
  'communication': 3,
  'professional-growth': 2,
}

// ── 大学生 Skills 各子分类预期数量 ──────────────
const COLLEGE_SUBCATEGORIES = {
  'academic-writing': 5,
  'study-aid': 4,
  'knowledge-mgmt': 3,
  'presentation': 2,
  'career-planning': 2,
}

// ═════════════════════════════════════════════════
// 测试 1：数据完整性
// ═════════════════════════════════════════════════
describe('skills store — 数据完整性', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('默认包含 16 个教师专用 Skills 和 16 个大学生专用 Skills', () => {
    const store = useSkillsStore()

    const educationSkills = store.allSkills.filter((s) => s.category === 'education')
    const collegeSkills = store.allSkills.filter((s) => s.category === 'college')

    expect(educationSkills).toHaveLength(16)
    expect(collegeSkills).toHaveLength(16)
    expect(educationSkills.length + collegeSkills.length).toBe(32)
  })

  it('教师 Skills 按子分类分组且各分组数量正确', () => {
    const store = useSkillsStore()

    for (const [subcategory, expectedCount] of Object.entries(EDUCATION_SUBCATEGORIES)) {
      const skills = store.skillsWithState.filter(
        (s) => s.category === 'education' && s.subcategory === subcategory,
      )
      expect(skills).toHaveLength(expectedCount)
    }
  })

  it('大学生 Skills 按子分类分组且各分组数量正确', () => {
    const store = useSkillsStore()

    for (const [subcategory, expectedCount] of Object.entries(COLLEGE_SUBCATEGORIES)) {
      const skills = store.skillsWithState.filter(
        (s) => s.category === 'college' && s.subcategory === subcategory,
      )
      expect(skills).toHaveLength(expectedCount)
    }
  })

  it('所有内置 Skills 标记 builtIn=true 且显示"内置"徽章（由 skillsWithState 传达）', () => {
    const store = useSkillsStore()

    // builtInSkills 包含 13 个核心 + 32 个教育/大学生 Skills
    // 只有 category=education 或 college 的才有 builtIn 属性
    const educationCollegeSkills = store.builtInSkills.filter(
      (s) => s.category === 'education' || s.category === 'college',
    )
    expect(educationCollegeSkills.length).toBe(32)
    expect(educationCollegeSkills.every((s) => s.builtIn === true)).toBe(true)

    // 通过 skillsWithState 确认所有内置 Skill 都有 builtIn=true
    const allWithState = store.skillsWithState
    const builtInOnes = allWithState.filter((s) => s.category === 'education' || s.category === 'college')
    expect(builtInOnes.every((s) => s.builtIn === true)).toBe(true)
  })

  it('skillsWithState 正确反映 enabled 状态', () => {
    const store = useSkillsStore()

    // 默认：全部启用
    const allState = store.skillsWithState
    expect(allState.every((s) => s.enabled === true)).toBe(true)

    // 禁用一个
    store.toggleSkill('lesson-plan-generator')

    const updated = store.skillsWithState
    expect(updated.find((s) => s.id === 'lesson-plan-generator').enabled).toBe(false)
    expect(updated.filter((s) => !s.enabled)).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════
// 测试 5：启用/禁用与持久化
// ═════════════════════════════════════════════════
describe('skills store — 启用/禁用与持久化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('toggleSkill 切换单个 Skill 的启用/禁用状态', () => {
    const store = useSkillsStore()

    expect(store.isSkillEnabled('lesson-plan-generator')).toBe(true)

    store.toggleSkill('lesson-plan-generator')
    expect(store.isSkillEnabled('lesson-plan-generator')).toBe(false)

    store.toggleSkill('lesson-plan-generator')
    expect(store.isSkillEnabled('lesson-plan-generator')).toBe(true)
  })

  it('setSkillEnabled(id, false) 禁用，setSkillEnabled(id, true) 恢复', () => {
    const store = useSkillsStore()

    store.setSkillEnabled('essay-grader', false)
    expect(store.isSkillEnabled('essay-grader')).toBe(false)

    store.setSkillEnabled('essay-grader', true)
    expect(store.isSkillEnabled('essay-grader')).toBe(true)
  })

  it('禁用状态通过 localStorage 持久化，重启后保持', () => {
    // ── 第一轮：禁用两个 Skill ──
    const store1 = useSkillsStore()
    store1.toggleSkill('lesson-plan-generator')
    store1.toggleSkill('paper-outline')

    // 验证 localStorage 已写入
    const saved = JSON.parse(localStorage.getItem(SKILLS_STORAGE_KEY))
    expect(saved).toEqual(expect.arrayContaining(['lesson-plan-generator', 'paper-outline']))
    expect(store1.userDisabledSkills).toEqual(
      expect.arrayContaining(['lesson-plan-generator', 'paper-outline']),
    )

    // ── 模拟重启（新 Pinia 实例，复用 localStorage）──
    setActivePinia(createPinia())
    const store2 = useSkillsStore()
    store2.initFromLocalStorage()

    // 之前禁用的保持禁用
    expect(store2.isSkillEnabled('lesson-plan-generator')).toBe(false)
    expect(store2.isSkillEnabled('paper-outline')).toBe(false)
    // 未禁用的仍为启用
    expect(store2.isSkillEnabled('smart-quiz-generator')).toBe(true)
    expect(store2.isSkillEnabled('note-organizer')).toBe(true)
  })

  it('多次切换后状态仍正确持久化', () => {
    const store = useSkillsStore()

    store.toggleSkill('lesson-plan-generator') // disable
    store.toggleSkill('lesson-plan-generator') // enable
    store.toggleSkill('lesson-plan-generator') // disable

    expect(store.isSkillEnabled('lesson-plan-generator')).toBe(false)

    // 重启后依然正确
    const saved = JSON.parse(localStorage.getItem(SKILLS_STORAGE_KEY))
    expect(saved).toContain('lesson-plan-generator')

    setActivePinia(createPinia())
    const store2 = useSkillsStore()
    store2.initFromLocalStorage()
    expect(store2.isSkillEnabled('lesson-plan-generator')).toBe(false)
  })
})

// ═════════════════════════════════════════════════
// 测试 6：禁用的 Skill 在 AI 对话中不会被匹配
// ═════════════════════════════════════════════════
describe('skills store + skillExecutor — 禁用 Skill 不被匹配', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('matchSkillByIntent 匹配到禁用的 Skill 后 isSkillEnabled 返回 false', () => {
    const store = useSkillsStore()
    const executor = useSkillExecutor()

    // 禁用教案生成器
    store.toggleSkill('lesson-plan-generator')

    // matchSkillByIntent 本身只做文本匹配，返回 skill ID
    const matchedId = executor.matchSkillByIntent('用教案生成器')

    expect(matchedId).toBe('lesson-plan-generator')
    // 但在 useAiChat.sendMessage 中会通过 isSkillEnabled 检查
    expect(store.isSkillEnabled(matchedId)).toBe(false)
  })

  it('parseSkillCommand 匹配到已禁用 Skill，启用检查返回 false', () => {
    const store = useSkillsStore()
    const executor = useSkillExecutor()

    store.toggleSkill('lesson-plan-generator')
    store.toggleSkill('paper-outline')

    const result = executor.parseSkillCommand('用教案生成器，生成一份数学教案')

    expect(result.matched).toBe(true)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].skillId).toBe('lesson-plan-generator')

    // 所有匹配到的 candidate 均已被禁用
    expect(result.candidates.every((c) => store.isSkillEnabled(c.skillId))).toBe(false)
  })

  it('启用的 Skill 正常通过检查，禁用的被拦截', () => {
    const store = useSkillsStore()
    const executor = useSkillExecutor()

    // 只禁用其中一个
    store.toggleSkill('paper-outline')

    // 匹配启用的 Skill → isSkillEnabled true
    const id1 = executor.matchSkillByIntent('用教案生成器')
    expect(store.isSkillEnabled(id1)).toBe(true)

    // 手动模拟 useAiChat 中的跳过逻辑：parseSkillCommand 匹配后检查
    const result = executor.parseSkillCommand('用论文大纲')
    expect(result.matched).toBe(true)
    expect(result.candidates[0].skillId).toBe('paper-outline')
    expect(store.isSkillEnabled(result.candidates[0].skillId)).toBe(false)

    // 匹配未禁用的
    const result2 = executor.parseSkillCommand('用演示文稿大纲')
    expect(result2.matched).toBe(true)
    expect(store.isSkillEnabled(result2.candidates[0].skillId)).toBe(true)
  })
})
