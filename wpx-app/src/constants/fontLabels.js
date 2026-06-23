/** 字体 inferFontType 对应中文标签 */
export const FONT_TYPE_LABELS = {
  'sans-serif': '黑体',
  serif: '宋体',
  handwriting: '手写',
  monospace: '等宽',
  emoji: '表情',
}

export const FONT_SOURCE_LABELS = {
  'built-in': '免费内置',
  free: '免费在线',
  commercial: '商业',
}

export function getFontTypeLabel(type) {
  return FONT_TYPE_LABELS[type] || type || '未知'
}

export function getFontSourceLabel(source) {
  return FONT_SOURCE_LABELS[source] || source || '未知'
}

export const CONSUME_TIME_FILTERS = [
  { key: 'all', label: '全部' },
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: 'custom', label: '自定义' },
]
