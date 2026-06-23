/** @typedef {'platform' | 'custom'} ModelSource */

/** @typedef {Object} CustomModelConfig
 * @property {string} endpoint
 * @property {string} modelName
 * @property {string} [apiKeyEnc]
 */

/** @typedef {Object} ModelBlockConfig
 * @property {ModelSource} source
 * @property {CustomModelConfig} custom
 */

/** @typedef {Object} ModelParameters
 * @property {number} temperature
 * @property {number} topP
 * @property {number} maxOutputTokens
 */

export const PLATFORM_TEXT_MODEL = 'deepseek-chat'
export const PLATFORM_VISION_MODEL = 'gpt-4o'

export const DEFAULT_TEXT_CUSTOM = {
  endpoint: 'https://api.deepseek.com/v1',
  modelName: 'deepseek-chat',
}

export const DEFAULT_VISION_CUSTOM = {
  endpoint: 'https://api.openai.com/v1',
  modelName: 'gpt-4o',
}

export function createDefaultModelParameters() {
  return {
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 4096,
  }
}

export function createDefaultModelBlockConfig(defaultCustom) {
  return {
    source: 'platform',
    custom: { ...defaultCustom },
  }
}

export function createDefaultModelSettings() {
  return {
    text: createDefaultModelBlockConfig(DEFAULT_TEXT_CUSTOM),
    vision: createDefaultModelBlockConfig(DEFAULT_VISION_CUSTOM),
    parameters: createDefaultModelParameters(),
  }
}

/**
 * @param {ReturnType<typeof createDefaultModelSettings>} current
 * @param {Partial<ReturnType<typeof createDefaultModelSettings>>} partial
 */
export function mergeModelSettings(current, partial) {
  const base = createDefaultModelSettings()
  const merged = {
    ...base,
    ...current,
    ...partial,
    text: {
      ...base.text,
      ...current?.text,
      ...partial?.text,
      custom: {
        ...base.text.custom,
        ...current?.text?.custom,
        ...partial?.text?.custom,
      },
    },
    vision: {
      ...base.vision,
      ...current?.vision,
      ...partial?.vision,
      custom: {
        ...base.vision.custom,
        ...current?.vision?.custom,
        ...partial?.vision?.custom,
      },
    },
    parameters: {
      ...base.parameters,
      ...current?.parameters,
      ...partial?.parameters,
    },
  }

  merged.parameters.temperature = clampNumber(merged.parameters.temperature, 0, 2, 0.7)
  merged.parameters.topP = clampNumber(merged.parameters.topP, 0, 1, 0.9)
  merged.parameters.maxOutputTokens = clampNumber(merged.parameters.maxOutputTokens, 1, 128000, 4096)

  return merged
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

/**
 * @param {string} endpoint
 */
export function normalizeModelEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/$/, '')
  if (!trimmed) return ''
  return trimmed
}

/**
 * @param {string} endpoint
 */
export function buildChatCompletionsUrl(endpoint) {
  const normalized = normalizeModelEndpoint(endpoint)
  if (!normalized) return ''

  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/chat/completions`
  }

  return `${normalized}/v1/chat/completions`
}

/**
 * @param {string} endpoint
 */
export function buildModelsListUrl(endpoint) {
  const normalized = normalizeModelEndpoint(endpoint)
  if (!normalized) return ''

  if (normalized.endsWith('/v1/models')) {
    return normalized
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/models`
  }

  return `${normalized}/v1/models`
}
