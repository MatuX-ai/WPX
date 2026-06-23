export const AGENT_TONE_OPTIONS = [
  { value: 'formal', label: '专业正式' },
  { value: 'casual', label: '轻松口语化' },
  { value: 'humorous', label: '幽默风趣' },
  { value: 'custom', label: '自定义' },
]

export const AGENT_DOMAIN_OPTIONS = [
  { value: 'tech', label: '技术开发' },
  { value: 'product', label: '产品管理' },
  { value: 'marketing', label: '市场营销' },
  { value: 'academic', label: '学术论文' },
  { value: 'fiction', label: '小说创作' },
  { value: 'legal', label: '法律文书' },
  { value: 'all', label: '全部' },
]

export const AGENT_REPLY_LENGTH_OPTIONS = [
  { value: 'concise', label: '简洁' },
  { value: 'standard', label: '标准' },
  { value: 'detailed', label: '详细' },
]

export const AGENT_LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'auto', label: '自动' },
]

export function createDefaultAgentSettings() {
  return {
    assistantName: 'WPX 助手',
    identityDescription: '全能的写作伙伴',
    toneStyle: 'formal',
    customTone: '',
    domains: ['all'],
    replyLength: 'standard',
    languagePreference: 'zh',
  }
}

export function mergeAgentSettings(current, partial) {
  const base = createDefaultAgentSettings()
  const merged = { ...base, ...current, ...partial }

  if (!Array.isArray(merged.domains) || merged.domains.length === 0) {
    merged.domains = ['all']
  }

  return merged
}
