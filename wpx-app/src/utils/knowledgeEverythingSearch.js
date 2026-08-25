/**
 * Everything 风格文件名匹配
 *
 * - 大小写不敏感
 * - 空格分隔多词 = AND
 * - `*` 匹配任意长度，`?` 匹配单个字符
 * - 无通配符时按子串匹配（与 Everything 默认行为一致）
 * - 含通配符时对「文件名」整段锚定匹配（如 `*.pdf`）
 */

/**
 * 将单个 Everything 风格词转为正则（已转义普通字符）
 * 含通配符时锚定整段文本（与 Everything 对 `*.pdf` 的整名匹配一致）
 * @param {string} term
 * @returns {RegExp}
 */
export function termToRegExp(term) {
  const escaped = String(term || '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

/**
 * 判断单段文本是否匹配单个检索词
 * @param {string} text
 * @param {string} term
 * @returns {boolean}
 */
function matchTermAgainstText(text, term) {
  const haystack = String(text || '')
  if (/[*?]/.test(term)) {
    return termToRegExp(term).test(haystack)
  }
  return haystack.toLowerCase().includes(term.toLowerCase())
}

/**
 * 判断文本是否匹配 Everything 风格查询
 * @param {string} text
 * @param {string} query
 * @returns {boolean}
 */
export function matchesEverythingQuery(text, query) {
  const haystack = String(text || '')
  const raw = String(query || '').trim()
  if (!raw) return true

  const terms = raw.split(/\s+/).filter(Boolean)
  if (!terms.length) return true

  return terms.every((term) => matchTermAgainstText(haystack, term))
}

/**
 * 判断资料条目是否匹配查询（文件名优先；类型/URL 仅参与无通配符子串检索）
 * @param {{ filename?: string, type?: string, sourceUrl?: string }} item
 * @param {string} query
 * @returns {boolean}
 */
export function matchesKnowledgeItem(item, query) {
  const raw = String(query || '').trim()
  if (!raw) return true
  if (!item) return false

  const filename = String(item.filename || '')
  const extras = [item.type, item.sourceUrl].filter(Boolean).map(String)
  const terms = raw.split(/\s+/).filter(Boolean)

  return terms.every((term) => {
    if (/[*?]/.test(term)) {
      // 通配符只对文件名整段匹配，避免「文件名含空格 + 拼接 type」误伤
      return matchTermAgainstText(filename, term)
    }
    if (matchTermAgainstText(filename, term)) return true
    return extras.some((field) => matchTermAgainstText(field, term))
  })
}

/**
 * 从资料条目中取用于展示/调试的检索文本
 * @param {{ filename?: string, type?: string, sourceUrl?: string }} item
 * @returns {string}
 */
export function knowledgeItemSearchText(item) {
  if (!item) return ''
  return [item.filename, item.type, item.sourceUrl].filter(Boolean).join(' ')
}

/**
 * 即时过滤资料列表（Everything 式文件名检索）
 * @param {Array} items
 * @param {string} query
 * @returns {Array}
 */
export function filterKnowledgeItems(items, query) {
  const list = Array.isArray(items) ? items : []
  const raw = String(query || '').trim()
  if (!raw) return list

  return list.filter((item) => matchesKnowledgeItem(item, raw))
}
