/**
 * pptxImportWarning - PPTX 有损导入提示文案
 *
 * 用于打开 .pptx 前向用户展示固定风险说明 + 本次导入统计。
 */

/** 固定风险条目（始终展示） */
export const PPTX_LOSSY_RISKS = [
  '动画、切换效果、母版样式与精确排版不会保留',
  '备注、批注、页眉页脚与部分特殊形状可能丢失',
  'EMF/WMF 等特殊图片格式无法导入；过大图片会被跳过',
  '图表会尽量保留数据，但样式与交互效果会重建',
  '若对原文件执行保存（Ctrl+S），将按 WPX 结构重新生成 PPTX，可能覆盖原文件细节',
]

/**
 * @param {{
 *   title?: string,
 *   slideCount?: number,
 *   imageCount?: number,
 *   chartCount?: number,
 *   warnings?: string[],
 *   path?: string,
 * }} payload
 */
export function buildPptxImportWarningSummary(payload = {}) {
  const title = String(payload.title || '演示文稿').trim() || '演示文稿'
  const slideCount = Number(payload.slideCount) || 0
  const imageCount = Number(payload.imageCount) || 0
  const chartCount = Number(payload.chartCount) || 0
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings
        .map((w) => String(w || '').trim())
        .filter(Boolean)
        // 过滤与固定风险重复的笼统首句
        .filter((w) => !/有损转换|精确布局不会保留/.test(w))
    : []

  const stats = []
  if (slideCount > 0) stats.push(`${slideCount} 页幻灯片`)
  if (imageCount > 0) stats.push(`${imageCount} 张图片`)
  if (chartCount > 0) stats.push(`${chartCount} 个图表`)

  return {
    title,
    fileName: payload.path
      ? String(payload.path).replace(/^.*[\\/]/, '')
      : '',
    statsLabel: stats.length ? stats.join(' · ') : '内容已解析',
    risks: [...PPTX_LOSSY_RISKS],
    extraWarnings: warnings.slice(0, 6),
  }
}
