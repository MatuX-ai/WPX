/**

 * @typedef {import('@/data/skills').SkillDefinition} SkillDefinition

 * @typedef {import('@/constants/agentPreferences').createDefaultAgentSettings} AgentSettings

 */



import { buildAgentSystemPromptSection } from '@/utils/buildAgentSystemPrompt'



const BASE_EDITOR_AI_RULES = `你是 WPX 文档写作助手。当用户提供【选中文本】时，请严格按要求改写该文本。

规则：

1. 只输出修改后的正文，不要解释、不要前后缀

2. 不要使用 markdown 代码块包裹结果

3. 保持用户要求的格式（如要点列表、段落等）

4. 当消息中包含【参考资料】时，优先基于提供的参考资料进行回答，并确保回答与资料内容一致`



export const DISABLED_SKILL_REPLY = '该能力未启用'



/**

 * @param {SkillDefinition[]} enabledSkills

 */

export function buildSkillsSystemPromptSection(enabledSkills) {

  if (!enabledSkills.length) {

    return `【可用 Skills】

用户已禁用全部内置 Skills。请勿主动调用续写、改写、翻译等扩展能力；仅按用户明确指令处理选中文本或回答问题。`

  }



  const skillLines = enabledSkills.map((skill) => `- ${skill.name}（${skill.id}）：${skill.description}`)



  return `【可用 Skills】

以下为用户已启用的能力，可在合适场景主动运用；未列出的 Skill 不可用，请勿调用：

${skillLines.join('\n')}`

}



/**

 * @param {SkillDefinition[]} disabledSkills

 */

export function buildDisabledSkillsSystemPromptSection(disabledSkills) {

  if (!disabledSkills.length) return ''



  const skillLines = disabledSkills.map((skill) => `- ${skill.name}（${skill.id}）`)



  return `【已禁用的 Skills】

以下能力已被用户禁用。当用户请求使用这些能力（例如「翻译这段」「帮我翻译」）时，必须明确回复「${DISABLED_SKILL_REPLY}」，且不要尝试执行：

${skillLines.join('\n')}`

}



/**

 * @param {{

 *   enabledSkills?: SkillDefinition[],

 *   disabledSkills?: SkillDefinition[],

 *   agentSettings?: ReturnType<typeof import('@/constants/agentPreferences').createDefaultAgentSettings>,

 * }} [options]

 */

export function buildEditorAiSystemPrompt(options = {}) {

  const { enabledSkills = [], disabledSkills = [], agentSettings } = options

  const sections = [BASE_EDITOR_AI_RULES]



  if (agentSettings) {

    sections.push(buildAgentSystemPromptSection(agentSettings))

  }



  sections.push(buildSkillsSystemPromptSection(enabledSkills))



  const disabledSection = buildDisabledSkillsSystemPromptSection(disabledSkills)

  if (disabledSection) {

    sections.push(disabledSection)

  }



  return sections.join('\n\n')

}


