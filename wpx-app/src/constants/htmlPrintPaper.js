/**
 * HTML 导出打印纸张白名单
 *
 * 与 Word/PDF 母版（`PAPER_SIZE_OPTIONS`）不同，HTML 打印纸张受限于 CSS
 * `@page { size }` 浏览器原生识别的关键字，因此仅保留：
 *   - A4 / Letter / B5：标准 ISO/美规尺寸
 *   - none：不写入 @page，按窗口宽度自适应
 *
 * 16K / 手机长图等定制尺寸在此白名单中不展示，避免误导用户选择后浏览器无效果。
 *
 * 该常量被三处共享：
 *   1. `components/export/ExportHtmlOptionsConfirm.vue` 渲染下拉选项
 *   2. `components/export/ExportMenu.vue` `buildHtmlExportOptionsPayload` 入参白名单
 *   3. `electron/services/export-paper-layout.js` 后端 `resolveHtmlPrintPaperCss`
 *      与该白名单一一对应，新增/修改时请同步后端。
 */
export const HTML_PRINT_PAPER_VALUES = Object.freeze(['A4', 'Letter', 'B5', 'none'])

export const HTML_PRINT_PAPER_OPTIONS = Object.freeze([
  { value: 'A4', label: 'A4 (210 × 297 mm)' },
  { value: 'Letter', label: 'Letter (216 × 279 mm)' },
  { value: 'B5', label: 'B5 (176 × 250 mm)' },
  { value: 'none', label: '不设置（跟随窗口宽度）' },
])

/** 默认值 */
export const HTML_DEFAULT_PRINT_PAPER = 'A4'

/**
 * 将传入值规范化到白名单内；非法值回退到默认。
 * @param {unknown} value
 * @returns {'A4' | 'Letter' | 'B5' | 'none'}
 */
export function normalizeHtmlPrintPaper(value) {
  return HTML_PRINT_PAPER_VALUES.includes(value) ? value : HTML_DEFAULT_PRINT_PAPER
}