/** AI 模型在对话窗标题栏中的简短显示名 */
export const AI_MODEL_SHORT_LABELS = {
  'deepseek-chat': 'DeepSeek-V3',
  'deepseek-reasoner': 'DeepSeek-R1',
}

/**
 * @param {string} modelValue
 * @returns {string}
 */
export function getAiModelDisplayName(modelValue) {
  return AI_MODEL_SHORT_LABELS[modelValue] || modelValue || 'DeepSeek-V3'
}
