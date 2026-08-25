/**
 * 冷启动模板 → 推荐 Skills 映射
 *
 * 仅用于「软引导」：系统提示词加权、意图匹配加分、AI 面板快捷入口。
 * 不会修改用户全局 Skill 启用/禁用状态。
 *
 * Skill ID 来源：
 * - @/data/skills.js（通用写作/编辑能力）
 * - @/data/built-in-skills.js（教师/大学生专用能力）
 */

/** @type {Record<string, string[]>} */
export const TEMPLATE_SKILL_RECOMMENDATIONS = {
  blank: ['outline', 'continue-writing'],
  'weekly-report': ['summarize', 'abbreviate', 'expand'],
  'daily-journal': ['continue-writing', 'summarize'],
  'todo-list': ['outline'],
  'reading-notes': ['summarize', 'expand'],
  'wechat-article': ['title-generate', 'expand', 'rewrite'],
  'novel-writing': ['continue-writing', 'outline', 'expand'],
  'meeting-notes': ['summarize', 'abbreviate'],
  'interview-notes': ['summarize', 'comment-generator'],
  'book-review': ['expand', 'rewrite', 'summarize'],
  'mind-map': ['outline'],
  'note-card': ['summarize', 'expand'],
  'study-summary': ['summarize', 'outline'],
  'weekly-plan': ['table-ops'],
  'project-tracker': ['table-ops', 'summarize'],
  kanban: ['table-ops'],
  'ppt-outline': ['courseware-outline', 'outline'],
  'pitch-deck': ['outline', 'expand'],
  'product-intro': ['outline', 'expand'],
  'lesson-plan': ['lesson-plan-generator', 'courseware-outline'],
  'lesson-lecture': ['lesson-plan-generator', 'knowledge-breakdown'],
  'exam-paper': ['smart-quiz-generator', 'variant-question-generator'],
  'student-evaluation': ['comment-generator', 'feedback-polisher'],
}

/**
 * @param {string} templateId
 * @returns {string[]}
 */
export function getRecommendedSkillIdsForTemplate(templateId) {
  const ids = TEMPLATE_SKILL_RECOMMENDATIONS[templateId]
  return Array.isArray(ids) ? [...ids] : []
}

export default TEMPLATE_SKILL_RECOMMENDATIONS
