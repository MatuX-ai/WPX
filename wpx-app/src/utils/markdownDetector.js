/**
 * WPX MD 智能排版引擎 - Markdown 标记检测工具
 *
 * 职责：判断纯文本是否包含 Markdown 标记。
 * 不做语义解析（交给 markdown-it），只做"是否含 MD"的轻量扫描。
 *
 * 命中场景：
 *  - 标题       ^#{1,6}\s
 *  - 列表       ^[\-\*\+]\s 或 ^\d+\.\s
 *  - 引用       ^>\s
 *  - 表格       同行内含 ≥2 个 |
 *  - 链接/图片  []() / ![]()
 *  - 行内强调   ** __ *
 *  - 分隔线     --- *** ___
 *  - 代码围栏   ```
 *  - 删除线     ~~
 */

/**
 * 按行剥离围栏代码块（``` … ```），避免代码块内的 # - | 等被误判。
 * @param {string} text
 * @returns {string}
 */
function stripCodeFences(text) {
  if (!text) return ''
  // 匹配 ```lang\n…\n``` 块；允许多行
  return String(text).replace(/```[\s\S]*?```/g, '')
}

/**
 * 检测文本是否含 Markdown 标记。
 * @param {string} text
 * @returns {boolean}
 */
export function detectMarkdown(text) {
  if (!text || typeof text !== 'string') return false
  // 极短文本（< 2 字符）不视为 MD
  const trimmed = text.trim()
  if (trimmed.length < 2) return false

  const stripped = stripCodeFences(trimmed)

  // 标题：行首 # 开头（1-6 个）
  if (/(^|\n)#{1,6}\s+/.test(stripped)) return true

  // 无序列表：行首 - / * / +
  if (/(^|\n)[\-\*\+]\s+/.test(stripped)) return true

  // 有序列表：行首 数字.
  if (/(^|\n)\d+\.\s+/.test(stripped)) return true

  // 引用：行首 >
  if (/(^|\n)>\s+/.test(stripped)) return true

  // 表格：同行含 ≥2 个 |
  // 排除代码围栏（已剥离）以及简单数字小数点
  if (/\|[^\n]*\|/.test(stripped)) return true

  // 图片：![](url)
  if (/!\[.*?\]\(.*?\)/.test(stripped)) return true

  // 链接：[text](url)
  if (/\[.+?\]\(.*?\)/.test(stripped)) return true

  // 行内强调：** / __ / *
  if (/\*\*.+?\*\*/.test(stripped)) return true
  if (/__.+?__/.test(stripped)) return true
  // 单 * 强调要求两侧非空白且非字母数字（避免被误判为乘号/星号）
  if (/(^|[^\w*])\*[^\s*][\s\S]*?[^\s*]\*(?=$|[^\w*])/.test(stripped)) return true

  // 分隔线：--- / *** / ___
  if (/(^|\n)[\-\*_]{3,}\s*($|\n)/.test(stripped)) return true

  // 删除线：~~
  if (/~~.+?~~/.test(stripped)) return true

  return false
}

/**
 * 提取 Markdown 文本中命中的标记类型（用于提示文案）。
 * @param {string} text
 * @returns {string[]} 命中的标记种类数组（去重）
 */
export function detectMarkdownMarkers(text) {
  if (!text || typeof text !== 'string') return []
  const stripped = stripCodeFences(text.trim())
  const found = new Set()

  if (/(^|\n)#{1,6}\s+/.test(stripped)) found.add('#')
  if (/(^|\n)[\-\*\+]\s+/.test(stripped)) found.add('-')
  if (/(^|\n)\d+\.\s+/.test(stripped)) found.add('1.')
  if (/(^|\n)>\s+/.test(stripped)) found.add('>')
  if (/\|[^\n]*\|/.test(stripped)) found.add('|')
  if (/!\[.*?\]\(.*?\)/.test(stripped)) found.add('图片')
  if (/\*\*|__/.test(stripped)) found.add('**')
  if (/(^|\n)[\-\*_]{3,}\s*($|\n)/.test(stripped)) found.add('---')

  return Array.from(found)
}

/**
 * 提取一段用于提示的 Markdown 片段预览。
 * - 优先返回首行非空内容
 * - 截断到 maxLen 字符，附 …
 * @param {string} text
 * @param {number} [maxLen=60]
 * @returns {string}
 */
export function extractMarkdownSnippet(text, maxLen = 60) {
  if (!text || typeof text !== 'string') return ''
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) || ''
  const cleaned = firstLine.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return `${cleaned.slice(0, maxLen)}…`
}

export default {
  detectMarkdown,
  detectMarkdownMarkers,
  extractMarkdownSnippet,
}
