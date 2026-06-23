import { getElectronAPI, isElectron } from '@/utils/electron'
import { hashDocumentContent, previewTokenConsume } from '@/utils/tokenApi'

const WPX_FONT_ID_PATTERN = /WPX-([a-zA-Z0-9._-]+)/
const WPX_FONT_ID_CSS_PATTERN = /WPX-([^,'"]+)/

const SUBSET_BASE_CHARS =
  ' \n\r\t.,;:!?\'"()[]{}<>+-=*/\\|@#$%^&_~`。，、；：？！「」『』（）【】《》…—·'

/**
 * @typedef {Object} ExportFontUsageItem
 * @property {string} fontId
 * @property {string} name
 * @property {number} charCount
 * @property {number} tokenCost
 * @property {boolean} deduplicated
 */

/**
 * @typedef {Object} ExportFontAnalysis
 * @property {boolean} hasCommercialFonts
 * @property {string} docHash
 * @property {ExportFontUsageItem[]} fonts
 * @property {number} totalCost
 * @property {number} balance
 * @property {boolean} sufficient
 * @property {number} shortfall
 */

let commercialFontIdsCache = null
/** @type {Map<string, string>} */
let commercialFontNameCache = new Map()

function countBillableChars(text) {
  return String(text || '').replace(/\s/g, '').length
}

export function parseWpxFontId(cssFamily) {
  if (!cssFamily) return null
  const match = String(cssFamily).match(WPX_FONT_ID_PATTERN)
  return match?.[1] || null
}

export function parseWpxFontIdFromCss(cssFamily) {
  if (!cssFamily) return null
  const match = String(cssFamily).match(WPX_FONT_ID_CSS_PATTERN)
  return match?.[1]?.trim() || null
}

function collectCharsForSubset(text) {
  return [...new Set(`${String(text || '')}${SUBSET_BASE_CHARS}`)].join('')
}

async function loadCommercialFontCatalog() {
  if (commercialFontIdsCache && commercialFontIdsCache.size > 0) {
    return commercialFontIdsCache
  }

  if (!isElectron() || !getElectronAPI()?.fonts?.getCommercialList) {
    return new Set()
  }

  const result = await getElectronAPI().fonts.getCommercialList({})
  const fonts = result?.ok && Array.isArray(result.fonts) ? result.fonts : []

  if (fonts.length === 0) {
    return new Set()
  }

  commercialFontNameCache = new Map(fonts.map((font) => [font.id, font.name]))
  commercialFontIdsCache = new Set(fonts.map((font) => font.id))
  return commercialFontIdsCache
}

/** 测试/E2E 用：清除商业字体目录缓存 */
export function resetCommercialFontCatalogCache() {
  commercialFontIdsCache = null
  commercialFontNameCache = new Map()
}

function resolveCommercialFontName(fontId) {
  return commercialFontNameCache.get(fontId) || fontId
}

/**
 * @param {unknown} node
 * @param {Map<string, Set<string>>} usage
 */
function walkAllFontUsage(node, usage) {
  if (!node || typeof node !== 'object') return

  if (node.type === 'text') {
    const fontMark = Array.isArray(node.marks)
      ? node.marks.find((mark) => mark.type === 'fontFamily')
      : null
    const fontId = parseWpxFontIdFromCss(fontMark?.attrs?.fontFamily)
    if (!fontId) return

    if (!usage.has(fontId)) {
      usage.set(fontId, new Set())
    }

    const chars = usage.get(fontId)
    for (const char of String(node.text || '')) {
      chars.add(char)
    }
    return
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkAllFontUsage(child, usage)
    }
  }
}

/**
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {Map<string, Set<string>>}
 */
export function extractAllFontUsage(editor) {
  /** @type {Map<string, Set<string>>} */
  const usage = new Map()

  if (!editor) return usage

  walkAllFontUsage(editor.getJSON(), usage)
  return usage
}

/**
 * 收集导出需嵌入的字体及其字符集。
 *
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {Array<{ fontId: string, text: string }>}
 */
export function collectDocumentEmbedFonts(editor) {
  const usage = extractAllFontUsage(editor)

  return [...usage.entries()]
    .map(([fontId, chars]) => ({
      fontId,
      text: collectCharsForSubset([...chars].join('')),
    }))
    .filter((item) => item.text.length > 0)
}

/**
 * @param {unknown} node
 * @param {Map<string, number>} usage
 */
function walkDocumentNode(node, usage) {
  if (!node || typeof node !== 'object') return

  if (node.type === 'text') {
    const fontMark = Array.isArray(node.marks)
      ? node.marks.find((mark) => mark.type === 'fontFamily')
      : null
    const fontId = parseWpxFontIdFromCss(fontMark?.attrs?.fontFamily)
    if (!fontId || !commercialFontIdsCache?.has(fontId)) return

    const charCount = countBillableChars(node.text)
    if (charCount <= 0) return

    usage.set(fontId, (usage.get(fontId) || 0) + charCount)
    return
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkDocumentNode(child, usage)
    }
  }
}

/**
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {Map<string, number>}
 */
export function extractCommercialFontUsage(editor) {
  /** @type {Map<string, number>} */
  const usage = new Map()

  if (!editor) return usage

  walkDocumentNode(editor.getJSON(), usage)
  return usage
}

export async function resolveSourceHanSansFamily() {
  if (!isElectron() || !getElectronAPI()?.fonts?.getAll) {
    return `'WPX-source-han-sans', sans-serif`
  }

  const result = await getElectronAPI().fonts.getAll()
  const fonts = result?.ok && Array.isArray(result.fonts) ? result.fonts : []
  const match = fonts.find(
    (font) =>
      font.source === 'built-in' &&
      (font.name?.includes('思源黑体') ||
        font.family?.includes('Source Han Sans') ||
        font.path?.includes('source-han-sans')),
  )

  if (!match) {
    return `'WPX-source-han-sans', sans-serif`
  }

  const fontId = match.fontId || match.id?.replace(/^[^:]+:\s*/, '') || 'source-han-sans'
  return `'WPX-${fontId}', sans-serif`
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {Set<string>} commercialFontIds
 * @param {string} targetCssFamily
 */
export function replaceCommercialFontsInEditor(editor, commercialFontIds, targetCssFamily) {
  if (!editor || !commercialFontIds.size) return false

  const { state } = editor
  const fontFamilyMark = state.schema.marks.fontFamily
  if (!fontFamilyMark) return false

  let changed = false
  const transaction = state.tr

  state.doc.descendants((node, pos) => {
    if (!node.isText) return

    const mark = node.marks.find((item) => item.type.name === 'fontFamily')
    if (!mark) return

    const fontId = parseWpxFontId(mark.attrs.fontFamily)
    if (!fontId || !commercialFontIds.has(fontId)) return

    const from = pos
    const to = pos + node.nodeSize
    transaction.removeMark(from, to, fontFamilyMark)
    transaction.addMark(
      from,
      to,
      fontFamilyMark.create({
        fontFamily: targetCssFamily,
      }),
    )
    changed = true
  })

  if (changed) {
    editor.view.dispatch(transaction)
  }

  return changed
}

/**
 * 本地检测文档是否使用商业字体（不调用扣费预览 API）。
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {Promise<{ hasCommercialFonts: true, fonts: Array<{ fontId: string, name: string, charCount: number }> } | null>}
 */
export async function detectCommercialFontUsage(editor) {
  await loadCommercialFontCatalog()

  const usage = extractCommercialFontUsage(editor)
  if (usage.size === 0) {
    return null
  }

  const fonts = [...usage.entries()].map(([fontId, charCount]) => ({
    fontId,
    name: resolveCommercialFontName(fontId),
    charCount,
  }))

  return {
    hasCommercialFonts: true,
    fonts,
  }
}

/**
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {string} markdown
 * @returns {Promise<ExportFontAnalysis | null>}
 */
export async function analyzeExportFonts(editor, markdown) {
  const localUsage = await detectCommercialFontUsage(editor)
  if (!localUsage) {
    return null
  }

  const docHash = await hashDocumentContent(markdown)
  const fontsPayload = localUsage.fonts.map((font) => ({
    font_id: font.fontId,
    char_count: font.charCount,
  }))

  const preview = await previewTokenConsume({
    fonts: fontsPayload,
    doc_hash: docHash,
  })

  /** @type {ExportFontUsageItem[]} */
  const fonts = (preview.fonts || fontsPayload).map((item) => ({
    fontId: item.font_id,
    name: item.font_name || resolveCommercialFontName(item.font_id),
    charCount: item.char_count,
    tokenCost: item.token_used ?? 0,
    deduplicated: Boolean(item.deduplicated),
  }))

  const totalCost = Number(preview.total_consumed) || 0
  const balance = Number(preview.balance) || 0
  const sufficient = Boolean(preview.sufficient)

  return {
    hasCommercialFonts: true,
    docHash,
    fonts,
    totalCost,
    balance,
    sufficient,
    shortfall: sufficient ? 0 : Math.max(0, totalCost - balance),
  }
}

export async function getCommercialFontIdSet() {
  return loadCommercialFontCatalog()
}
