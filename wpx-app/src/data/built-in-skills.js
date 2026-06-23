/**
 * WPX 内置 Skills 聚合
 * 合并所有分类的默认 Skills，并提供便捷查询工具
 */

import { TEACHER_SKILLS } from './teacher-skills'
import { COLLEGE_SKILLS } from './college-skills'

// ── 合并所有内置 Skill ──────────────────────────
/** @type {import('./teacher-skills').TeacherSkillDefinition[]} */
export const BUILT_IN_SKILLS = [...TEACHER_SKILLS, ...COLLEGE_SKILLS]

// ── 按分类分组 ──────────────────────────────────
/** @type {Object<string, import('./teacher-skills').TeacherSkillDefinition[]>} */
const byCategory = {
  education: TEACHER_SKILLS,
  college: COLLEGE_SKILLS
}

// ── 按 ID 索引 ──────────────────────────────────
/** @type {Object<string, import('./teacher-skills').TeacherSkillDefinition>} */
const byId = {}
for (const skill of BUILT_IN_SKILLS) {
  byId[skill.id] = skill
}

/** 按分类分组的导出对象 */
export const SKILL_INDEX = {
  all: BUILT_IN_SKILLS,
  byCategory,
  byId
}

// ── 工具函数 ────────────────────────────────────

/**
 * 按 ID 查找内置 Skill
 * @param {string} id
 * @returns {import('./teacher-skills').TeacherSkillDefinition | undefined}
 */
export function getSkillById (id) {
  return byId[id]
}

/**
 * 按分类获取 Skills
 * @param {'education' | 'college'} category
 * @returns {import('./teacher-skills').TeacherSkillDefinition[]}
 */
export function getSkillsByCategory (category) {
  return byCategory[category] ?? []
}

/**
 * 返回所有内置 Skill 的 ID 列表
 * @returns {string[]}
 */
export function getBuiltInSkillIds () {
  return BUILT_IN_SKILLS.map(s => s.id)
}

export default SKILL_INDEX
