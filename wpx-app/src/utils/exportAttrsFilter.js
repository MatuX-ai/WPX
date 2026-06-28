/**
 * WPX 导出时 HTML 内部属性过滤
 *
 * 职责：
 *  - 在 MD / PDF / Word 导出时把 doc 节点上的 HTML 内部 attrs（htmlSource 等）剥离
 *  - 排版状态字段（lastFormattedTemplate 等）一并清除
 *  - 不修改其他节点类型
 *  - 不修改 HTML 内部状态（运行时仍保留 attrs，仅导出阶段净化）
 *
 * 字段列表（与 HtmlSourceExtension.addGlobalAttributes 保持一致）：
 *  - htmlSource              完整原始 HTML 源码
 *  - sourceUrl               来源 URL
 *  - importedAt              导入时间戳
 *  - importSource            导入方式
 *  - lastFormattedTemplate   最近一次排版模板 id
 *  - lastFormattedAt         最近一次排版时间
 */

export const INTERNAL_HTML_ATTRS = [
  'htmlSource',
  'sourceUrl',
  'importedAt',
  'importSource',
  'lastFormattedTemplate',
  'lastFormattedAt',
]

/**
 * 判断属性名是否属于内部 HTML attrs。
 * @param {string} key
 * @returns {boolean}
 */
export function isInternalHtmlAttr(key) {
  return INTERNAL_HTML_ATTRS.includes(key)
}

/**
 * 深拷贝 doc JSON 并剥离 doc 节点上的内部 HTML attrs。
 *
 * @param {object | null | undefined} json Tiptap doc JSON
 * @returns {object | null | undefined}
 */
export function stripInternalAttrsFromJson(json) {
  if (!json || typeof json !== 'object') return json
  if (json.type !== 'doc') return json
  const sourceAttrs = json.attrs || {}
  const cleanedAttrs = {}
  for (const key of Object.keys(sourceAttrs)) {
    if (!isInternalHtmlAttr(key)) {
      cleanedAttrs[key] = sourceAttrs[key]
    }
  }
  return { ...json, attrs: cleanedAttrs }
}

/**
 * 包装 editor.getJSON() 调用，返回净化后的 doc JSON。
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {object | null}
 */
export function getSanitizedJson(editor) {
  if (!editor) return null
  try {
    const json = editor.getJSON()
    return stripInternalAttrsFromJson(json)
  } catch (error) {
    console.warn('[exportAttrsFilter] getSanitizedJson failed:', error)
    return null
  }
}

export default {
  INTERNAL_HTML_ATTRS,
  isInternalHtmlAttr,
  stripInternalAttrsFromJson,
  getSanitizedJson,
}
