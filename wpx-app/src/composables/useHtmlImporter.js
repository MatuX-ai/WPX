/**
 * WPX HTML 文件导入工具
 *
 * 职责：
 *  1. 检测剪贴板/文件中的 HTML 内容
 *  2. 解析 HTML 源码 → Tiptap 文档（通过 editor.commands.setContent 内部走 prosemirror-model DOMParser）
 *  3. 把 HTML 源码 + 元数据写入 doc 节点 attrs（依赖 HtmlSourceExtension 注册的 schema）
 *  4. 提供 getHtmlImportMeta / hasHtmlImport / clearHtmlAttrs / restoreFromHtmlSource 等 API
 *
 * 设计原则：
 *  - 业务层不直接写 transaction，所有 doc attrs 修改走扩展命令
 *  - "导入无感"：本模块不触发任何弹窗，只在调用方决定是否提示
 *  - HTML 源码大小阈值：超过 2MB 时返回错误（避免 attrs 过大导致 JSON 序列化卡顿）
 */

const MAX_HTML_SOURCE_BYTES = 2 * 1024 * 1024 // 2MB

/** @typedef {'paste' | 'file' | 'url'} HtmlImportSource */

/**
 * 检测字符串是否像 HTML（含 <html>、<!DOCTYPE 或至少一个开标签 + 闭标签）
 * 用于区分「粘贴的是 HTML 源码」和「粘贴的是纯文本」。
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeHtml(text) {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  if (trimmed.length < 16) return false
  // 1. DOCTYPE / <html> 标签
  if (/^<!doctype\s+html/i.test(trimmed)) return true
  if (/<html[\s>]/i.test(trimmed)) return true
  // 2. 至少一个开标签 + 对应闭标签（如 <p>...</p>、<h1>...</h1>）
  if (/<([a-z][a-z0-9]*)\b[^>]*>([\s\S]*?)<\/\1>/i.test(trimmed)) return true
  // 3. 自闭合标签密集（如 <br/><hr/><img ... />）
  if ((trimmed.match(/<(br|hr|img|input|meta|link)\b[^>]*\/?>/gi) || []).length >= 2) return true
  return false
}

/**
 * 从 ClipboardEvent.clipboardData 中检测是否存在 HTML 内容。
 * - 优先取 text/html，长度 > 100 视为真实 HTML（避免误判 < 100 char 的纯文本中偶然出现的尖括号）
 * @param {DataTransfer | null} clipboardData
 * @returns {string | null}
 */
export function extractHtmlFromClipboard(clipboardData) {
  if (!clipboardData) return null
  let html = ''
  try {
    html = clipboardData.getData('text/html') || ''
  } catch {
    return null
  }
  if (!html || html.length < 100) return null
  return html
}

/**
 * 检测剪贴板中是否含 HTML（高于纯文本优先级的判别）。
 * @param {DataTransfer | null} clipboardData
 * @returns {boolean}
 */
export function detectHtmlInClipboard(clipboardData) {
  return Boolean(extractHtmlFromClipboard(clipboardData))
}

/**
 * 校验 HTML 源码大小是否在阈值内。
 * @param {string} htmlString
 * @returns {{ ok: boolean, bytes?: number, error?: string }}
 */
function validateHtmlSize(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') {
    return { ok: false, error: 'html-empty' }
  }
  // 粗略估计：JS 字符串按 UTF-16 编码，每个字符 2 字节
  const bytes = htmlString.length * 2
  if (bytes > MAX_HTML_SOURCE_BYTES) {
    return { ok: false, bytes, error: `html-too-large (${(bytes / 1024 / 1024).toFixed(1)}MB > 2MB)` }
  }
  return { ok: true, bytes }
}

/**
 * 读取当前 doc 的 HTML 导入元数据。
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {{
 *   htmlSource: string | null,
 *   sourceUrl: string | null,
 *   importedAt: string | null,
 *   importSource: HtmlImportSource | null,
 *   lastFormattedTemplate: string | null,
 *   lastFormattedAt: string | null,
 * } | null}
 */
export function getHtmlImportMeta(editor) {
  if (!editor || !editor.state || !editor.state.doc) return null
  const attrs = editor.state.doc.attrs || {}
  if (!attrs.htmlSource && !attrs.sourceUrl && !attrs.importedAt) return null
  return {
    htmlSource: attrs.htmlSource ?? null,
    sourceUrl: attrs.sourceUrl ?? null,
    importedAt: attrs.importedAt ?? null,
    importSource: attrs.importSource ?? null,
    lastFormattedTemplate: attrs.lastFormattedTemplate ?? null,
    lastFormattedAt: attrs.lastFormattedAt ?? null,
  }
}

/**
 * 当前文档是否含 HTML 导入元数据（用于决定是否触发排版弹窗）。
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {boolean}
 */
export function hasHtmlImport(editor) {
  if (!editor || !editor.state || !editor.state.doc) return false
  const attrs = editor.state.doc.attrs || {}
  return Boolean(attrs.htmlSource)
}

/**
 * 把 HTML 字符串导入到编辑器，并把元数据写入 doc attrs。
 *
 * @param {import('@tiptap/core').Editor | null} editor
 * @param {string} htmlString
 * @param {{
 *   sourceUrl?: string | null,
 *   importSource?: HtmlImportSource,
 *   importedAt?: string,
 * }} [opts]
 * @returns {{
 *   ok: boolean,
 *   htmlSource?: string,
 *   sourceUrl?: string | null,
 *   importedAt?: string,
 *   importSource?: HtmlImportSource,
 *   bytes?: number,
 *   error?: string,
 *   message?: string,
 * }}
 */
export function importHtmlString(editor, htmlString, opts = {}) {
  if (!editor) {
    return { ok: false, error: 'editor-unavailable', message: '编辑器不可用' }
  }
  const sizeCheck = validateHtmlSize(htmlString)
  if (!sizeCheck.ok) {
    return { ok: false, error: sizeCheck.error, message: 'HTML 源码过大，已拒绝导入' }
  }

  const importSource = opts.importSource || 'paste'
  const importedAt = opts.importedAt || new Date().toISOString()
  const sourceUrl = opts.sourceUrl ?? null

  try {
    // 1. 用 Tiptap 内部 DOMParser 解析 HTML 为 ProseMirror 文档
    // setContent 接受 HTML 字符串，内部走 prosemirror-model 的 DOMParser
    editor.commands.setContent(htmlString, { emitUpdate: false })

    // 2. 写入 doc attrs（通过扩展命令，避免直接构造 transaction）
    editor.commands.setHtmlSource({
      htmlSource: htmlString,
      sourceUrl,
      importedAt,
      importSource,
    })
  } catch (error) {
    console.error('[useHtmlImporter] importHtmlString failed:', error)
    return {
      ok: false,
      error: error?.message || String(error),
      message: 'HTML 解析失败：' + (error?.message || '未知错误'),
    }
  }

  return {
    ok: true,
    htmlSource: htmlString,
    sourceUrl,
    importedAt,
    importSource,
    bytes: sizeCheck.bytes,
  }
}

/**
 * 清除所有 HTML 内部 attrs（"清除格式"或主动重置时调用）。
 * 保留 doc 已有内容，仅清除元数据。
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {{ ok: boolean }}
 */
export function clearHtmlAttrs(editor) {
  if (!editor) return { ok: false }
  try {
    editor.commands.clearHtmlSource()
    return { ok: true }
  } catch (error) {
    console.warn('[useHtmlImporter] clearHtmlAttrs failed:', error)
    return { ok: false, error: error?.message }
  }
}

/**
 * 从保存的 htmlSource 重新渲染为 Tiptap 文档（"恢复原样"调用）。
 * 注意：本函数会**覆盖**当前文档内容为原始 HTML 渲染结果，
 *       并保留 htmlSource / sourceUrl / importedAt / importSource 不变。
 *
 * @param {import('@tiptap/core').Editor | null} editor
 * @param {string} [htmlSource] 默认从 doc.attrs.htmlSource 读取
 * @returns {{ ok: boolean, error?: string, message?: string }}
 */
export function restoreFromHtmlSource(editor, htmlSource) {
  if (!editor) {
    return { ok: false, error: 'editor-unavailable', message: '编辑器不可用' }
  }
  const source =
    typeof htmlSource === 'string' && htmlSource
      ? htmlSource
      : editor.state?.doc?.attrs?.htmlSource
  if (!source) {
    return { ok: false, error: 'no-html-source', message: '未找到原始 HTML 源码' }
  }
  try {
    editor.commands.setContent(source, { emitUpdate: false })
    // 保留元数据，仅清空排版状态（因为已恢复原样）
    editor.commands.setFormatState({ templateId: null, formattedAt: null })
    return { ok: true }
  } catch (error) {
    console.error('[useHtmlImporter] restoreFromHtmlSource failed:', error)
    return {
      ok: false,
      error: error?.message || String(error),
      message: '恢复原样失败：' + (error?.message || '未知错误'),
    }
  }
}

/**
 * 读取 doc 上的最近排版状态（用于顶部提示条显示）。
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {{
 *   templateId: string | null,
 *   templateLabel: string | null,
 *   formattedAt: string | null,
 *   htmlSource: string | null,
 * } | null}
 */
export function getFormatState(editor) {
  if (!editor || !editor.state || !editor.state.doc) return null
  const attrs = editor.state.doc.attrs || {}
  if (!attrs.lastFormattedTemplate) return null
  return {
    templateId: attrs.lastFormattedTemplate,
    templateLabel: attrs.lastFormattedTemplate, // label 解析由调用方通过 getTemplateById 完成
    formattedAt: attrs.lastFormattedAt ?? null,
    htmlSource: attrs.htmlSource ?? null,
  }
}

export function useHtmlImporter() {
  return {
    looksLikeHtml,
    extractHtmlFromClipboard,
    detectHtmlInClipboard,
    importHtmlString,
    getHtmlImportMeta,
    hasHtmlImport,
    clearHtmlAttrs,
    restoreFromHtmlSource,
    getFormatState,
  }
}

export default {
  looksLikeHtml,
  extractHtmlFromClipboard,
  detectHtmlInClipboard,
  importHtmlString,
  getHtmlImportMeta,
  hasHtmlImport,
  clearHtmlAttrs,
  restoreFromHtmlSource,
  getFormatState,
  useHtmlImporter,
  MAX_HTML_SOURCE_BYTES,
}
