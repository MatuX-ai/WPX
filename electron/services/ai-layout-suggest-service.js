/**
 * AI 排版建议服务（预留给未来的 AI 排版优化）
 *
 * 目标：
 * - 在导出前调用 AI 分析文档结构，返回排版指令（pageBreakBefore / imageFloat / figureAdjustment ...）
 * - 当 AI 服务不可用 / 超时 / 返回格式异常时，静默回退为空数组
 * - 不会阻塞或破坏已有导出流程
 *
 * 启用条件：
 * - 环境变量 WPX_EXPORT_AI_LAYOUT_ENABLED=true（默认关闭，避免无谓网络请求）
 * - 且 model-secrets-store 中存在 text API Key
 *
 * 调用方式：
 *   const suggestions = await analyzeLayoutSuggestions(markdown, paper)
 */

const modelSecretsStore = require('./model-secrets-store')

const DEFAULT_ENDPOINT = process.env.WPX_EXPORT_AI_LAYOUT_ENDPOINT ||
  'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = process.env.WPX_EXPORT_AI_LAYOUT_MODEL || 'deepseek-chat'
const REQUEST_TIMEOUT_MS = 8_000

/** @type {ReturnType<typeof setTimeout> | null} */
let cachedAbortController = null

/**
 * @typedef {Object} PageBreakBeforeSuggestion
 * @property {'pageBreakBefore'} type
 * @property {string} anchor - 触发分页的锚点（标题文本或行号）
 * @property {number} [headingLevel]
 * @property {string} [reason]
 *
 * @typedef {Object} ImageFloatSuggestion
 * @property {'imageFloat'} type
 * @property {string} anchor
 * @property {'left' | 'right' | 'none'} float
 * @property {string} [reason]
 *
 * @typedef {Object} FigureAdjustmentSuggestion
 * @property {'figureAdjustment'} type
 * @property {string} anchor
 * @property {'center' | 'shrink' | 'inline'} action
 * @property {string} [reason]
 *
 * @typedef {Object} TableBreakSuggestion
 * @property {'tableBreak'} type
 * @property {string} anchor
 * @property {string} [reason]
 *
 * @typedef {PageBreakBeforeSuggestion | ImageFloatSuggestion | FigureAdjustmentSuggestion | TableBreakSuggestion} LayoutSuggestion
 */

const SUGGESTION_TYPES = new Set([
  'pageBreakBefore',
  'imageFloat',
  'figureAdjustment',
  'tableBreak',
])

function isSuggestionEnabled() {
  const flag = process.env.WPX_EXPORT_AI_LAYOUT_ENABLED
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false
  return false
}

function hasModelKey() {
  try {
    return Boolean(modelSecretsStore.hasApiKey('text'))
  } catch {
    return false
  }
}

function isAvailable() {
  return isSuggestionEnabled() && hasModelKey()
}

function getApiKey() {
  try {
    return modelSecretsStore.getDecryptedApiKey('text') || ''
  } catch {
    return ''
  }
}

function buildPrompt(markdown, paper) {
  const paperSummary = paper
    ? `纸张=${paper.paperSize || 'A4'} 边距=${paper.paperMargin || 'normal'} 页眉页脚=${paper.headerFooter || 'none'}`
    : '纸张=默认'

  const trimmed = String(markdown || '').slice(0, 8000)
  return [
    '你是文档排版助手，仅返回 JSON，不要包含任何额外文本或 Markdown 代码块。',
    '根据文档结构与纸张参数，输出排版建议列表 suggestions。',
    '每个建议对象必须包含 type 字段，允许的 type：pageBreakBefore / imageFloat / figureAdjustment / tableBreak。',
    '可选字段：anchor（必填，定位锚点，例如标题文本或 markdown 行号）、headingLevel（pageBreakBefore 时可选 1-6）、float（imageFloat 时 left/right/none）、action（figureAdjustment 时 center/shrink/inline）、reason（解释）。',
    '若文档无需调整，返回空数组：{"suggestions": []}。',
    '',
    `当前纸张设定：${paperSummary}`,
    '',
    '--- DOCUMENT ---',
    trimmed,
    '--- END ---',
  ].join('\n')
}

function sanitizeSuggestions(rawSuggestions) {
  if (!Array.isArray(rawSuggestions)) return []
  const out = []
  for (const item of rawSuggestions) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.type !== 'string' || !SUGGESTION_TYPES.has(item.type)) continue
    const sanitized = { type: item.type }
    if (typeof item.anchor === 'string') {
      const trimmed = item.anchor.trim()
      if (!trimmed) continue
      sanitized.anchor = trimmed.slice(0, 200)
    } else if (typeof item.anchor === 'number' && Number.isFinite(item.anchor)) {
      sanitized.anchor = String(item.anchor)
    } else {
      continue
    }
    if (item.headingLevel !== undefined) {
      const level = item.headingLevel
      if (
        typeof level === 'number' &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= 6
      ) {
        sanitized.headingLevel = level
      }
    }
    if (item.float === 'left' || item.float === 'right' || item.float === 'none') {
      sanitized.float = item.float
    }
    if (item.action === 'center' || item.action === 'shrink' || item.action === 'inline') {
      sanitized.action = item.action
    }
    if (typeof item.reason === 'string') {
      sanitized.reason = item.reason.slice(0, 200)
    }
    out.push(sanitized)
  }
  return out
}

function parseSuggestionsFromText(text) {
  if (typeof text !== 'string') return []
  // 兼容模型偶尔输出 ```json ... ``` 包裹
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenced ? fenced[1] : trimmed
  let parsed
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return []
  }
  if (Array.isArray(parsed)) return sanitizeSuggestions(parsed)
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.suggestions)) {
    return sanitizeSuggestions(parsed.suggestions)
  }
  return []
}

async function fetchAiSuggestions(prompt, apiKey) {
  const controller = new AbortController()
  cachedAbortController = controller
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: '只返回 JSON。' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!response.ok) return []

    const payload = await response.json().catch(() => null)
    const content = payload?.choices?.[0]?.message?.content
    return parseSuggestionsFromText(typeof content === 'string' ? content : '')
  } finally {
    clearTimeout(timeoutId)
    if (cachedAbortController === controller) {
      cachedAbortController = null
    }
  }
}

/**
 * 对外暴露：分析 markdown 文档结构，返回排版建议。
 * - 不可用或失败时静默返回空数组
 *
 * @param {string} markdown
 * @param {Object} [paper]
 * @returns {Promise<LayoutSuggestion[]>}
 */
async function analyzeLayoutSuggestions(markdown, paper) {
  if (!markdown || typeof markdown !== 'string') return []
  if (!isAvailable()) return []

  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    const prompt = buildPrompt(markdown, paper)
    return await fetchAiSuggestions(prompt, apiKey)
  } catch (error) {
    if (process.env.WPX_EXPORT_DEBUG) {
      console.warn('[ai-layout-suggest] failed, fallback to empty:', error?.message)
    }
    return []
  }
}

/**
 * 简单的本地回退实现：基于行号扫描 H1/H2 标题，生成 pageBreakBefore 建议。
 * 当 AI 服务未启用时，仍可提供轻量建议（便于离线 / 调试场景）。
 *
 * @param {string} markdown
 * @returns {LayoutSuggestion[]}
 */
function buildLocalFallbackSuggestions(markdown) {
  if (!markdown || typeof markdown !== 'string') return []
  const lines = markdown.split(/\r?\n/)
  /** @type {LayoutSuggestion[]} */
  const suggestions = []
  let lastTopHeadingIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const match = line.match(/^\s{0,3}(#{1,2})\s+(.+?)\s*$/)
    if (!match) continue
    const level = match[1].length
    const title = match[2]
    if (level === 1 && lastTopHeadingIndex >= 0 && i - lastTopHeadingIndex > 6) {
      suggestions.push({
        type: 'pageBreakBefore',
        anchor: title.slice(0, 200),
        headingLevel: level,
        reason: '本地回退：检测到连续 H1 段落',
      })
    }
    if (level === 1) lastTopHeadingIndex = i
  }
  return suggestions
}

/**
 * 把排版建议应用到 markdown 内容上。
 * - 对 pageBreakBefore：在匹配锚点的标题前插入 HTML 注释或 LaTeX 命令（按 format 区分）
 * - 对其他类型：当前仅记录锚点，不修改内容（避免引入未实现的副作用）
 *
 * @param {string} markdown
 * @param {LayoutSuggestion[]} suggestions
 * @param {'markdown' | 'html' | 'pdf' | 'docx'} format
 * @returns {string}
 */
function applyLayoutSuggestions(markdown, suggestions, format) {
  if (!markdown || !Array.isArray(suggestions) || suggestions.length === 0) return markdown

  const isPdf = format === 'pdf'
  const pageBreaks = suggestions.filter((s) => s && s.type === 'pageBreakBefore' && s.anchor)
  if (pageBreaks.length === 0) return markdown

  const lines = markdown.split(/\r?\n/)
  const result = []

  for (const line of lines) {
    let injected = false
    for (const suggestion of pageBreaks) {
      if (!suggestion.anchor) continue
      const anchorEscaped = suggestion.anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`^\\s{0,3}#{1,6}\\s+${anchorEscaped}`)
      if (pattern.test(line)) {
        if (isPdf) {
          result.push('\\newpage')
        } else if (format === 'html') {
          result.push('<div style="page-break-before: always;"></div>')
        } else {
          // docx / markdown：Pandoc + pagebreak lua filter 在 docx 中支持 \newpage 转 page break
          result.push('\\newpage')
        }
        injected = true
        break
      }
    }
    result.push(line)
    void injected
  }

  return result.join('\n')
}

module.exports = {
  analyzeLayoutSuggestions,
  applyLayoutSuggestions,
  buildLocalFallbackSuggestions,
  isAvailable,
  hasModelKey,
  isSuggestionEnabled,
  parseSuggestionsFromText,
  sanitizeSuggestions,
  DEFAULT_ENDPOINT,
  DEFAULT_MODEL,
  REQUEST_TIMEOUT_MS,
}