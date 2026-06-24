/**
 * image.js · 图片工具
 *
 * 核心能力：
 *  1) buildPictureSources(src, opts)  → 生成 WebP + 原格式双源结构
 *     返回 { webp, fallback, sizes, srcset, type }，供 <AppPicture> 或 <picture> 使用
 *  2) probeWebpSupport()              → 异步检测浏览器是否原生支持 WebP
 *  3) bestImageFormat(src, opts)      → 根据浏览器支持返回最优 URL（运行时降级）
 *  4) withCacheBuster(url, v)         → 给静态资源加版本号
 *
 * 设计原则：
 *  - 纯函数，零依赖
 *  - 默认尺寸：响应式多档 (1x/2x)
 *  - 默认 sizes：100vw（小图全宽）、(min-width: 768px) 50vw / 33vw（卡片）
 */

/**
 * 把源文件路径与扩展名替换为目标扩展
 *  - "/img/hero.png" → "/img/hero.webp"
 *  - "/img/hero"     → "/img/hero.webp"
 */
function replaceExt(src, ext) {
  if (!src) return src
  return src.replace(/\.(png|jpg|jpeg|gif|avif|webp)(\?.*)?$/i, (m, _e, qs) => '.' + ext + (qs || ''))
}

/**
 * 生成 srcset：1x/2x（按 width 估算）
 *  - width: 原始尺寸宽度
 *  - ratio: 2 表示同时生成 2x
 */
function buildSrcSet(src, { width = 0, ratio = 2 } = {}) {
  if (!width) return src
  const list = [`${src} ${width}w`]
  if (ratio >= 2) list.push(`${src} ${width * 2}w`)
  return list.join(', ')
}

/**
 * 生成 picture 源数据
 * @param {string} src       原图 URL（如 /img/hero.png 或 CDN）
 * @param {object} opts
 *   - webp:    布尔，是否生成 webp 源（默认 true）
 *   - fallback: 'png' | 'jpg' | 'auto'  原图类型
 *   - width:   number,  原图宽度（用于 srcset）
 *   - sizes:   string,  sizes 属性
 *   - quality: string,  可附加 ?q=75 等 CDN 参数
 * @returns {{ webp: string, fallback: string, type: string, srcset: string|null, sizes: string|null }}
 */
export function buildPictureSources(src, opts = {}) {
  const {
    webp = true,
    fallback = 'auto',
    width = 0,
    sizes = null,
    quality = ''
  } = opts

  if (!src) return { webp: '', fallback: '', type: '', srcset: null, sizes }

  // 推断 fallback 类型
  let type = fallback
  if (type === 'auto') {
    if (/\.png(\?|$)/i.test(src)) type = 'png'
    else if (/\.jpe?g(\?|$)/i.test(src)) type = 'jpeg'
    else if (/\.webp(\?|$)/i.test(src)) type = 'webp'
    else if (/\.avif(\?|$)/i.test(src)) type = 'avif'
    else type = 'png'
  }

  const finalSrc = src + (quality ? (src.includes('?') ? '&' : '?') + quality : '')
  const webpSrc = webp ? replaceExt(finalSrc, 'webp') : ''
  const srcset = width ? buildSrcSet(finalSrc, { width }) : null

  return {
    webp: webpSrc,
    fallback: finalSrc,
    type: 'image/' + type,
    srcset,
    sizes
  }
}

/**
 * 异步检测 WebP 支持（一次性缓存）
 *  返回 Promise<'probably' | 'maybe' | 'none'>
 */
let _webpCache = null
export function probeWebpSupport() {
  if (typeof window === 'undefined') return Promise.resolve('none')
  if (_webpCache) return _webpCache
  _webpCache = new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.width === 2 ? 'probably' : 'maybe')
    img.onerror = () => resolve('none')
    img.src =
      'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJZQCdAEO/gbsAAA='
  })
  return _webpCache
}

/**
 * 运行时获取最优图片 URL（同步版，需要先调用 probeWebpSupport 预热）
 */
export function bestImageFormat(src, opts = {}) {
  const sources = buildPictureSources(src, opts)
  if (!sources.webp) return sources.fallback
  const supported = typeof window !== 'undefined' && window.__wpx_webp_support
  return supported === 'probably' || supported === 'maybe'
    ? sources.webp
    : sources.fallback
}

/**
 * 给静态资源加缓存破坏参数
 */
export function withCacheBuster(url, version) {
  if (!url || !version) return url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + 'v=' + encodeURIComponent(version)
}

export default {
  buildPictureSources,
  probeWebpSupport,
  bestImageFormat,
  withCacheBuster
}
