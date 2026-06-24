/**
 * 站内 SEO 元信息工具。
 * 用于在 SPA 路由切换或 SSR 预渲染时，统一管理 document.head 中的 <meta> / <link> / <title>。
 *
 * 浏览器环境：直接操作 document.head。
 * Node/SSR 环境：返回一个 head 字符串，由调用方拼接到 HTML 中。
 */

const DEFAULT_OG = Object.freeze({
  type: 'website',
  siteName: 'WPX · AI 智能文档编辑器',
  image: '/og-image.svg',
  imageWidth: '1200',
  imageHeight: '630',
  locale: 'zh_CN',
})

/**
 * 规范化 URL：相对路径补全成 origin 完整链接。
 * 优先级：base 参数 > window.location.origin
 * @param {string} url
 * @param {string} [base]
 */
function toAbsoluteUrl(url, base) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (base) {
    try {
      return new URL(url, base).toString()
    } catch (_) {
      return base + url
    }
  }
  if (typeof window !== 'undefined' && window.location && url.startsWith('/')) {
    return window.location.origin + url
  }
  return url
}

/**
 * @typedef {Object} MetaInput
 * @property {string} title
 * @property {string} description
 * @property {string} [path]      当前页面路径，例：'/about'
 * @property {string} [image]     OG 分享图绝对或相对 URL
 * @property {string} [type]      OG type，默认 'website'
 * @property {string} [siteUrl]   站点 origin，例：'https://wpx.app'
 * @property {string} [themeColor]
 * @property {string} [keywords]
 * @property {string} [twitterCard]   'summary' | 'summary_large_image'
 * @property {string} [author]
 */

/**
 * 构造 head meta tags 列表（数组格式）。
 * 同一资源在 SSR / 客户端的写入逻辑统一来自此处，避免不一致。
 * @param {MetaInput} input
 * @returns {Array<Record<string,string>>}
 */
export function buildMeta(input) {
  const {
    title,
    description,
    path = '/',
    image = DEFAULT_OG.image,
    type = DEFAULT_OG.type,
    siteUrl = '',
    themeColor = '#7c3aed',
    keywords = '',
    twitterCard = 'summary_large_image',
    author = 'WPX',
  } = input || {}

  if (!title) throw new Error('[seo] buildMeta: title is required')
  if (!description) throw new Error('[seo] buildMeta: description is required')

  const canonical = toAbsoluteUrl(path, siteUrl) || path
  const fullImage = toAbsoluteUrl(image, siteUrl) || image

  const tags = [
    { name: 'description', content: description },
    { name: 'theme-color', content: themeColor },
    { name: 'color-scheme', content: 'light dark' },
    { name: 'format-detection', content: 'telephone=no' },
  ]

  if (keywords) {
    tags.push({ name: 'keywords', content: keywords })
  }
  if (author) {
    tags.push({ name: 'author', content: author })
  }

  // Open Graph
  tags.push(
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: DEFAULT_OG.siteName },
    { property: 'og:locale', content: DEFAULT_OG.locale },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: fullImage },
    { property: 'og:image:secure_url', content: fullImage },
    { property: 'og:image:width', content: DEFAULT_OG.imageWidth },
    { property: 'og:image:height', content: DEFAULT_OG.imageHeight },
    { property: 'og:image:alt', content: title },
  )

  // Twitter Card
  tags.push(
    { name: 'twitter:card', content: twitterCard },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: fullImage },
    { name: 'twitter:image:alt', content: title },
  )

  return tags
}

/**
 * 构造 head 注入的 <link> 列表（canonical / alternate / preload 等）。
 * @param {MetaInput} input
 */
export function buildLinks(input) {
  const { path = '/', siteUrl = '' } = input || {}
  const canonical = toAbsoluteUrl(path, siteUrl) || path
  return [
    { rel: 'canonical', href: canonical },
  ]
}

/**
 * 浏览器端：将 meta 标签写入 document.head。
 * 同名 meta 复用；不重复追加。每次调用都重新覆盖 title 与对应 meta。
 * @param {MetaInput} input
 */
export function setMeta(input) {
  if (typeof document === 'undefined') return

  if (input.title) {
    document.title = input.title
  }

  const tags = buildMeta(input)
  const links = buildLinks(input)

  for (const tag of tags) {
    const key = tag.name ? 'name' : 'property'
    const value = tag[key]
    if (!value) continue
    let el = document.head.querySelector(`meta[${key}="${cssEscape(value)}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(key, value)
      document.head.appendChild(el)
    }
    el.setAttribute('content', tag.content || '')
  }

  for (const link of links) {
    let el = document.head.querySelector(`link[rel="${cssEscape(link.rel)}"][href="${cssEscape(link.href)}"]`)
    if (!el) {
      el = document.head.querySelector(`link[rel="${cssEscape(link.rel)}"]`)
    }
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', link.rel)
      document.head.appendChild(el)
    }
    el.setAttribute('href', link.href)
  }
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return String(value).replace(/(["'\\])/g, '\\$1')
}

export const SEO_DEFAULTS = Object.freeze({
  siteName: DEFAULT_OG.siteName,
  ogImage: DEFAULT_OG.image,
})
