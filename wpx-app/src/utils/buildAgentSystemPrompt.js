import {
  AGENT_DOMAIN_OPTIONS,
  AGENT_REPLY_LENGTH_OPTIONS,
  AGENT_TONE_OPTIONS,
  createDefaultAgentSettings,
  mergeAgentSettings,
} from '@/constants/agentPreferences'

const TONE_LABELS = Object.fromEntries(AGENT_TONE_OPTIONS.map((item) => [item.value, item.label]))
const REPLY_LENGTH_LABELS = Object.fromEntries(
  AGENT_REPLY_LENGTH_OPTIONS.map((item) => [item.value, item.label]),
)

function resolveToneLabel(agent) {
  if (agent.toneStyle === 'custom') {
    const custom = String(agent.customTone || '').trim()
    return custom || '自定义语气'
  }
  return TONE_LABELS[agent.toneStyle] || TONE_LABELS.formal
}

function resolveDomainLabels(domains) {
  if (!Array.isArray(domains) || domains.includes('all')) {
    return '全部领域'
  }

  const labelMap = Object.fromEntries(AGENT_DOMAIN_OPTIONS.map((item) => [item.value, item.label]))
  return domains.map((id) => labelMap[id] || id).join('、')
}

/**
 * @param {ReturnType<typeof createDefaultAgentSettings>} agentSettings
 */
export function buildAgentSystemPromptSection(agentSettings) {
  const agent = mergeAgentSettings({}, agentSettings)
  const toneLabel = resolveToneLabel(agent)
  const replyLengthLabel = REPLY_LENGTH_LABELS[agent.replyLength] || '标准'
  const domainLabel = resolveDomainLabels(agent.domains)

  return `【Agent 身份与风格】
- 助手名称：${agent.assistantName}
- 身份描述：${agent.identityDescription}
- 语气风格：${toneLabel}
- 专业领域：${domainLabel}
- 回复长度：${replyLengthLabel}
- 语言偏好：${agent.languagePreference === 'en' ? '英文' : agent.languagePreference === 'auto' ? '自动' : '中文'}

请始终以以上身份与语气与用户交流，并在改写选中文本时保持一致的表达风格。`
}
