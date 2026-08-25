import { COLD_START_TEMPLATES } from '@/data/cold-start-templates'
import { getRecommendedSkillIdsForTemplate } from '@/data/template-skill-recommendations'

const EMPTY_CONTEXT = Object.freeze({
  documentType: '',
  templateId: '',
  recommendedSkillIds: [],
  recommendedSkills: [],
})

/**
 * @typedef {object} DocumentSkillContext
 * @property {string} documentType
 * @property {string} templateId
 * @property {string[]} recommendedSkillIds
 * @property {import('@/data/skills').SkillDefinition[]} recommendedSkills
 */

/**
 * 根据当前会话 documentType 解析模板上下文与推荐 Skills（仅已启用项）。
 *
 * @param {string} documentType
 * @param {{ allSkills?: Array<{ id: string, name: string, description?: string, promptTemplate?: string }>, isSkillEnabled?: (id: string) => boolean } | null | undefined} skillsStore
 * @returns {DocumentSkillContext}
 */
export function getDocumentSkillContext(documentType, skillsStore) {
  const normalized = String(documentType || '').trim()
  if (!normalized || normalized === '_default') {
    return { ...EMPTY_CONTEXT }
  }

  const template = COLD_START_TEMPLATES.find((item) => item.documentType === normalized) || null
  const templateId = template?.id || ''
  const candidateIds = templateId ? getRecommendedSkillIdsForTemplate(templateId) : []

  const allSkills = skillsStore?.allSkills || []
  const isEnabled = typeof skillsStore?.isSkillEnabled === 'function'
    ? (id) => skillsStore.isSkillEnabled(id)
    : () => true

  const recommendedSkills = []
  const recommendedSkillIds = []

  for (const id of candidateIds) {
    const skill = allSkills.find((item) => item.id === id)
    if (!skill || !isEnabled(id)) continue
    recommendedSkills.push(skill)
    recommendedSkillIds.push(id)
    if (recommendedSkills.length >= 4) break
  }

  return {
    documentType: normalized,
    templateId,
    recommendedSkillIds,
    recommendedSkills,
  }
}

/**
 * 推荐 Skill 芯片点击时的默认触发文案。
 *
 * 统一使用「用{name}」前缀，命中 useAiChat Step 0（parseSkillCommand）：
 * - 教育类（有 inputSchema）→ 弹出参数表单
 * - 通用类（空 schema + core prompt）→ executeSkillLenient 硬执行
 *
 * @param {{ name: string, promptTemplate?: string }} skill
 * @returns {string}
 */
export function buildQuickSkillMessage(skill) {
  if (!skill?.name) return ''
  return `用${skill.name}`
}

export default getDocumentSkillContext
