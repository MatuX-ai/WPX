/**
 * 资料库预览的图片/文本分离
 *
 * 资料库里有些文件（如上传的 HTML / Markdown）图片是用 data: URL base64 内联的。
 * 如果直接 `<pre>{{ content }}</pre>` 渲染，会把整段 `<img src="data:image/png;base64,iVBOR...>` 字面值铺满屏幕。
 *
 * 本模块把这种 content 拆成两部分：
 *  - textPreview: 不含 <img> 标签的可读纯文本（避免噪音）
 *  - images:     抽出来的所有图片 URL 数组（用于缩略图渲染）
 *
 * 设计要点：
 *  - 保留 markdown 图片语法 `![alt](url)` 不动（让 markdown 文本阅读时仍能看到图说明）
 *  - 只剥离 HTML 的 `<img src="...">` 标签字面值
 *  - 不修改原文其他部分
 *
 * @param {string} content 资料库原始 content
 * @returns {{ textPreview: string, images: string[] }}
 */
const HTML_IMG_SRC = '<img\\b[^>]*?src=["\']([^"\']+)["\'][^>]*>'

function newImgRegex() {
  // 每次新建实例，避免 g 标志的 lastIndex 状态污染
  return new RegExp(HTML_IMG_SRC, 'gi')
}

export function extractPreviewImages(content) {
  const text = String(content || '')
  const images = []
  const re = newImgRegex()
  for (const match of text.matchAll(re)) {
    const src = match[1]
    if (src) images.push(src)
  }
  const textPreview = text.replace(newImgRegex(), '')
  return { textPreview, images }
}

/** 判断是否有图片需要单独展示 */
export function hasPreviewImages(content) {
  if (!content) return false
  return newImgRegex().test(String(content))
}
