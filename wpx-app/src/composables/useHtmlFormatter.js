/**
 * WPX HTML 智能排版引擎
 *
 * 职责：
 *  1. 从 doc.attrs.htmlSource 读取原始 HTML
 *  2. 通过 useMarkdownFormatter.formatDocument 应用模板规则
 *  3. 若模板 = webpage-archive 或显式开启 insertWebpageHeader：在文档开头插入「来源信息块」
 *  4. 标记排版完成（lastFormattedTemplate / lastFormattedAt）
 *  5. 保留 htmlSource，供后续 restoreFromHtmlSource 恢复
 *
 * 与 MD 排版引擎的关系：
 *  - 模板规则完全复用 MARKDOWN_TEMPLATES（包括新增的 webpage-archive）
 *  - AiAssistantPlaceholder 层做分发：hasHtmlImport → useHtmlFormatter.formatHtmlDocument
 *  - 普通 MD 文档走 useMarkdownFormatter.formatDocument
 *
 * 设计要点：
 *  - 不调用 AI API，零 Token、零延迟、离线可用
 *  - 「来源信息块」由两个段落 + 一个分隔线组成，符合通用文章排版规则
 */

import {
  formatDocument,
  getTemplateById,
  hasImagesInDoc,
} from '@/composables/useMarkdownFormatter'
import {
  getHtmlImportMeta,
  hasHtmlImport,
  restoreFromHtmlSource,
} from '@/composables/useHtmlImporter'

// ── 重新导出 useHtmlImporter 中的常用 API ──
// 业务层（如 AiAssistantPlaceholder）只需从 useHtmlFormatter 导入，
// 减少 import 语句数量，避免一文件多 import 路径混乱。
export { getHtmlImportMeta, hasHtmlImport, restoreFromHtmlSource }

/**
 * 把 ISO 时间格式化为本地化展示串（如 "2026-06-26 10:30"）。
 * 容错：解析失败时回退到原始字符串。
 * @param {string|null|undefined} isoString
 * @returns {string}
 */
export function formatImportTime(isoString) {
  if (!isoString || typeof isoString !== 'string') return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

/**
 * 在文档开头插入「来源信息块」（用于 webpage-archive 模板）。
 *
 * 信息块结构（3 行）：
 *   来源：xxx
 *   抓取时间：2026-06-26 10:30（粘贴导入）
 *   ─────
 *
 * 实现策略：
 *   - 使用 editor.chain().insertContentAt(0, htmlString) 直接插入到文档开头
 *   - 不走 transaction 自定义，依赖 Tiptap 的 parseHTML pipeline
 *   - 插入位置：文档开头（位置 0）
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sourceUrl?: string|null, importedAt?: string|null, importSource?: string|null }} meta
 * @returns {boolean}
 */
function insertWebpageHeaderAtTop(editor, meta) {
  if (!editor) return false
  const sourceUrl = meta?.sourceUrl || '（未指定）'
  const importedAt = meta?.importedAt
  const timeText = importedAt ? formatImportTime(importedAt) : '（未指定）'
  const importSourceLabel = {
    paste: '粘贴导入',
    file: '文件导入',
    url: '链接导入',
  }[meta?.importSource || 'paste'] || '导入'

  const headerHtml =
    `<p data-import-meta="sourceUrl"><strong>来源：</strong>${escapeHtml(sourceUrl)}</p>` +
    `<p data-import-meta="importedAt"><strong>抓取时间：</strong>${escapeHtml(timeText)}（${escapeHtml(importSourceLabel)}）</p>` +
    `<hr />`

  try {
    // parseHTML:false 避免插入后立即触发 onUpdate 事件链
    // emitUpdate:false 让 UI 在下一个 tick 统一刷新
    editor.chain().focus().insertContentAt(0, headerHtml, { parseHTML: true }).run()
    return true
  } catch (error) {
    console.warn('[useHtmlFormatter] insertWebpageHeaderAtTop failed:', error)
    return false
  }
}

/**
 * HTML escape（用于「来源信息块」文本拼接）
 * @param {string} text
 */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 应用 HTML 排版模板：
 *  1. 检查是否有 htmlSource
 *  2. 调用 formatDocument() 应用节点 attrs（复用 MD 排版引擎）
 *  3. 若 templateId === 'webpage-archive' 或 insertWebpageHeader=true：在文档开头插入来源信息块
 *  4. 标记 lastFormattedTemplate / lastFormattedAt
 *  5. 保留 htmlSource
 *
 * @param {import('@tiptap/core').Editor | null} editor
 * @param {string} templateId
 * @param {{
 *   insertWebpageHeader?: boolean,
 *   generateHeader?: boolean,
 * }} [options]
 * @returns {{
 *   ok: boolean,
 *   modified?: number,
 *   templateLabel?: string,
 *   templateId?: string,
 *   hasImages?: boolean,
 *   message?: string,
 *   error?: string,
 * }}
 */
export function formatHtmlDocument(editor, templateId, options = {}) {
  if (!editor) {
    return {
      ok: false,
      modified: 0,
      templateLabel: '',
      message: '⚠️ 编辑器不可用',
      error: 'editor-unavailable',
    }
  }

  if (!hasHtmlImport(editor)) {
    return {
      ok: false,
      modified: 0,
      templateLabel: '',
      message: '⚠️ 当前文档未含 HTML 源码，无法触发 HTML 排版',
      error: 'no-html-source',
    }
  }

  const tpl = getTemplateById(templateId)
  if (!tpl) {
    return {
      ok: false,
      modified: 0,
      templateLabel: '',
      message: `⚠️ 未找到模板「${templateId}」`,
      error: 'template-not-found',
    }
  }

  const meta = getHtmlImportMeta(editor)
  const hasImages = hasImagesInDoc(editor)

  // 1) 应用模板规则（复用 MD 排版引擎）
  let result
  try {
    result = formatDocument(editor, templateId)
  } catch (error) {
    return {
      ok: false,
      modified: 0,
      templateLabel: tpl.label,
      hasImages,
      message: '⚠️ 排版失败：' + (error?.message || '未知错误'),
      error: 'format-failed',
    }
  }

  // 2) 是否插入来源信息块
  const needInsertHeader =
    Boolean(options.insertWebpageHeader) ||
    Boolean(options.generateHeader) ||
    tpl.id === 'webpage-archive'
  if (needInsertHeader && meta) {
    insertWebpageHeaderAtTop(editor, {
      sourceUrl: meta.sourceUrl,
      importedAt: meta.importedAt,
      importSource: meta.importSource,
    })
  }

  // 3) 标记排版完成（保留 htmlSource 供恢复）
  try {
    editor.commands.setFormatState({
      templateId,
      formattedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.warn('[useHtmlFormatter] setFormatState failed:', error)
  }

  if (!result.ok) {
    return {
      ...result,
      templateId,
      hasImages,
      message: result.message || '⚠️ HTML 排版未完成',
    }
  }

  return {
    ok: true,
    modified: result.modified ?? 0,
    templateLabel: result.templateLabel || tpl.label,
    templateId,
    hasImages,
    message: `✅ 已按【${tpl.label}】格式排版`,
  }
}

/**
 * 简化封装：仅检查当前文档是否含 htmlSource。
 * @param {import('@tiptap/core').Editor | null} editor
 */
export function hasHtmlImportMeta(editor) {
  return hasHtmlImport(editor)
}

/**
 * 读取引入元数据完整结构
 */
export function readHtmlImportMeta(editor) {
  return getHtmlImportMeta(editor)
}

export function useHtmlFormatter() {
  return {
    formatHtmlDocument,
    hasHtmlImport: hasHtmlImportMeta,
    getHtmlImportMeta: readHtmlImportMeta,
    formatImportTime,
  }
}

export default {
  formatHtmlDocument,
  hasHtmlImport: hasHtmlImportMeta,
  getHtmlImportMeta: readHtmlImportMeta,
  formatImportTime,
  useHtmlFormatter,
}
