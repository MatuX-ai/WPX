/**
 * 虚拟纸张（导出母版）相关偏好
 *
 * - paperSize: 纸张尺寸（A4 / Letter / 16K / mobile / none）
 * - paperMargin: 纸张页边距档位（wide / normal / narrow / custom）
 * - customMargin: 仅当 paperMargin === 'custom' 时启用，单位 mm
 * - headerFooter: 页眉页脚显示策略（none / pageNumber / custom）
 * - focusMode: 焦点写作模式开关
 *
 * 与 agentPreferences 类似，独立维护默认值与合并函数，
 * 通过 preferences store 持久化到 electron-store 并跨窗口同步。
 */

export const PAPER_SIZE_OPTIONS = [
  { value: 'A4', label: 'A4 (210 × 297 mm)' },
  { value: 'Letter', label: 'Letter (216 × 279 mm)' },
  { value: '16K', label: '16 开 (184 × 260 mm)' },
  { value: 'mobile', label: '手机长图（375 px 宽）' },
  { value: 'none', label: '无（仅文本）' },
]

export const PAPER_MARGIN_OPTIONS = [
  { value: 'wide', label: '宽（25 mm）' },
  { value: 'normal', label: '标准（20 mm）' },
  { value: 'narrow', label: '窄（15 mm）' },
  { value: 'custom', label: '自定义' },
]

export const HEADER_FOOTER_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'pageNumber', label: '仅页码' },
  { value: 'custom', label: '自定义文字' },
]

export const PAPER_SIZE_VALUES = PAPER_SIZE_OPTIONS.map((option) => option.value)
export const PAPER_MARGIN_VALUES = PAPER_MARGIN_OPTIONS.map((option) => option.value)
export const HEADER_FOOTER_VALUES = HEADER_FOOTER_OPTIONS.map((option) => option.value)

export const DEFAULT_CUSTOM_MARGIN = Object.freeze({
  top: 20,
  bottom: 20,
  left: 20,
  right: 20,
})

export const MIN_CUSTOM_MARGIN_MM = 0
export const MAX_CUSTOM_MARGIN_MM = 100

/**
 * 纸张尺寸 → ProseMirror 纸张像素宽度映射
 * 用于焦点写作模式下的内容区域 max-width 约束。
 * none / 手机长图尺寸较小，常规纸张按 96 DPI 估算。
 */
export const PAPER_SIZE_WIDTH_PX = Object.freeze({
  A4: 794,
  Letter: 816,
  '16K': 728,
  mobile: 375,
  none: null,
})

export const DEFAULT_PAPER_WIDTH_PX = PAPER_SIZE_WIDTH_PX.A4

export function getPaperWidthPx(paperSize) {
  const width = PAPER_SIZE_WIDTH_PX[paperSize]
  return typeof width === 'number' ? width : DEFAULT_PAPER_WIDTH_PX
}

export function isFocusModeApplicable(focusMode, paperSize) {
  if (!focusMode) return false
  return paperSize !== 'none'
}

function clamp(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export function normalizeCustomMargin(value) {
  const base = { ...DEFAULT_CUSTOM_MARGIN }
  if (!value || typeof value !== 'object') return base

  base.top = clamp(Number(value.top), MIN_CUSTOM_MARGIN_MM, MAX_CUSTOM_MARGIN_MM)
  base.bottom = clamp(Number(value.bottom), MIN_CUSTOM_MARGIN_MM, MAX_CUSTOM_MARGIN_MM)
  base.left = clamp(Number(value.left), MIN_CUSTOM_MARGIN_MM, MAX_CUSTOM_MARGIN_MM)
  base.right = clamp(Number(value.right), MIN_CUSTOM_MARGIN_MM, MAX_CUSTOM_MARGIN_MM)
  return base
}

export function createDefaultPaperSettings() {
  return {
    paperSize: 'A4',
    paperMargin: 'normal',
    customMargin: { ...DEFAULT_CUSTOM_MARGIN },
    headerFooter: 'none',
    focusMode: false,
  }
}

export function mergePaperSettings(current, partial) {
  const base = createDefaultPaperSettings()

  if (!current || typeof current !== 'object') {
    current = {}
  }

  const candidate = { ...base, ...current, ...(partial || {}) }

  // customMargin 需要深度合并：partial.customMargin 只指定部分字段时，
  // 保留 current.customMargin 中未指定的字段，再统一规范化。
  const baseMargin = normalizeCustomMargin(current.customMargin)
  const incomingMargin =
    partial && typeof partial === 'object' && partial.customMargin && typeof partial.customMargin === 'object'
      ? partial.customMargin
      : candidate.customMargin
  candidate.customMargin = normalizeCustomMargin({ ...baseMargin, ...incomingMargin })

  if (!PAPER_SIZE_VALUES.includes(candidate.paperSize)) {
    candidate.paperSize = base.paperSize
  }
  if (!PAPER_MARGIN_VALUES.includes(candidate.paperMargin)) {
    candidate.paperMargin = base.paperMargin
  }
  if (!HEADER_FOOTER_VALUES.includes(candidate.headerFooter)) {
    candidate.headerFooter = base.headerFooter
  }

  candidate.focusMode = Boolean(candidate.focusMode)

  return candidate
}