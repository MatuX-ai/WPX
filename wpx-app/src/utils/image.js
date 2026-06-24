/**
 * 图片资源帮助函数。
 * 与 <AppPicture> 组件配合使用：在可用时输出 WebP，回退到原始格式。
 *
 * 用法：
 *   toWebp('/assets/hero.png')                 // => '/assets/hero.webp'
 *   toFallback('/assets/hero.webp')           // => '/assets/hero.png'
 *   buildPictureSources('/assets/hero.png')   // => { webp: '/assets/hero.webp', fallback: '/assets/hero.png' }
 *
 * 设计：
 * - 仅处理路径变换，不做运行时探测；探测留给 <picture> 浏览器原生。
 * - 同源资源通过 Vite 静态分析，文件名变化后会保留 hashed name。
 * - 远程 URL（http://...）原样返回，由 CDN 控制 WebP 协商。
 */

const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif']

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isRemoteUrl(url) {
  if (!url) return false
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^(data|blob):/i.test(url)
}

/**
 * @param {string} url
 * @returns {string}
 */
export function toWebp(url) {
  if (!url || isRemoteUrl(url)) return url
  const dot = url.lastIndexOf('.')
  const sep = url.lastIndexOf('/')
  if (dot < 0 || dot < sep) return url
  const ext = url.slice(dot + 1).toLowerCase()
  if (!IMG_EXTS.includes(ext)) return url
  return url.slice(0, dot) + '.webp'
}

/**
 * @param {string} url
 * @returns {string}
 */
export function toFallback(url) {
  if (!url || isRemoteUrl(url)) return url
  const dot = url.lastIndexOf('.')
  const sep = url.lastIndexOf('/')
  if (dot < 0 || dot < sep) return url
  if (url.slice(dot + 1).toLowerCase() !== 'webp') return url
  // 简单兜底：优先 png，jpg/jpeg 取决于同源是否存在
  return url.slice(0, dot) + '.png'
}

/**
 * 构造 <picture> 所需的 sources。
 * @param {string} url
 * @returns {{ webp: string, fallback: string }}
 */
export function buildPictureSources(url) {
  return {
    webp: toWebp(url),
    fallback: toFallback(toWebp(url)) || url,
  }
}

/**
 * 为给定宽度（可选）生成 srcset。
 * 当前实现保留单一宽度，srcset 占位以避免 <picture> 缺少 srcset 的警告。
 * @param {string} url
 * @param {number} [width]
 */
export function buildSrcset(url, width) {
  if (!url) return undefined
  if (isRemoteUrl(url)) return url
  if (!width) return undefined
  return `${url} ${width}w`
}
