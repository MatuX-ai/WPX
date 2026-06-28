const { Readability } = require('@mozilla/readability')
const { parseHTML } = require('linkedom')

const FETCH_TIMEOUT_MS = 30_000
const MIN_ARTICLE_CHARS = 80
const MIN_PARAGRAPH_CHARS = 10
const MIN_IMAGE_DIMENSION = 32

/** 反爬虫 / 访问受限时展示给用户的温情提示 */
const ANTI_BOT_USER_MESSAGE =
  '抱歉，该网页无法获取其数据，请用其他方法哦。您可以复制正文粘贴上传，或使用 PDF、Word 等方式导入。'

/** 动态加载页（如 MSN 等 SPA）无法从 HTML 提取时的提示 */
const DYNAMIC_PAGE_USER_MESSAGE =
  '该网页在浏览器中动态加载，暂时无法自动获取正文。您可以复制正文粘贴上传，或使用 PDF、Word 等方式导入哦。'

class AntiBotError extends Error {
  constructor(message = ANTI_BOT_USER_MESSAGE) {
    super(message)
    this.name = 'AntiBotError'
    this.code = 'ANTI_BOT'
  }
}

class DynamicPageError extends Error {
  constructor(message = DYNAMIC_PAGE_USER_MESSAGE) {
    super(message)
    this.name = 'DynamicPageError'
    this.code = 'DYNAMIC_PAGE'
  }
}

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'])

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function extractTitleFromHtml(html, fallback = '') {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!titleMatch) return fallback
  return normalizeText(decodeBasicEntities(titleMatch[1].replace(/<[^>]+>/g, ''))) || fallback
}

function extractMetaContent(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const value = normalizeText(decodeBasicEntities(match[1]))
      if (value.length >= MIN_ARTICLE_CHARS) return value
    }
  }
  return ''
}

function resolveAbsoluteUrl(raw, pageUrl) {
  const src = String(raw || '').trim()
  if (!src || src.startsWith('javascript:') || src.startsWith('vbscript:')) return ''
  // data: URL（base64 内联图/SVG）原样保留；上游会按体积裁断
  if (src.startsWith('data:')) return src
  try {
    return new URL(src, pageUrl).href
  } catch {
    return ''
  }
}

/** data: URL 体积上限（原始字符串长度）。超限跳过，防止 markdown 炸 */
const MAX_DATA_URL_LENGTH = 2 * 1024 * 1024

function parseDimension(value) {
  const parsed = Number.parseInt(String(value || '').replace(/px$/i, ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function extractReadableArticle(html, url) {
  const { document } = parseHTML(html)
  if (url) {
    try {
      document.documentURI = url
    } catch {
      // linkedom may not support assignment on all builds
    }
  }

  const reader = new Readability(document, {
    charThreshold: 100,
    keepClasses: false,
  })
  return reader.parse()
}

function extractWithReadability(html, url) {
  const article = extractReadableArticle(html, url)
  if (!article?.textContent?.trim()) return null

  return {
    title: normalizeText(article.title || ''),
    content: normalizeText(article.textContent),
    html: article.content || '',
  }
}

function extractFromSemanticNodes(document) {
  const selectors = ['article', 'main', '[role="main"]', '.article-content', '.post-content', '#content']
  for (const selector of selectors) {
    const node = document.querySelector(selector)
    if (!node) continue
    const content = normalizeText(node.textContent || '')
    if (content.length >= MIN_ARTICLE_CHARS) {
      return { html: node.innerHTML || '', text: content }
    }
  }
  return { html: '', text: '' }
}

function extractJsonLdArticleBody(html) {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1])
      const nodes = Array.isArray(payload) ? payload : [payload]
      for (const node of nodes) {
        const body = node?.articleBody
        if (typeof body === 'string' && body.trim().length >= MIN_ARTICLE_CHARS) {
          return normalizeText(body)
        }
        if (Array.isArray(node?.['@graph'])) {
          for (const item of node['@graph']) {
            const graphBody = item?.articleBody
            if (typeof graphBody === 'string' && graphBody.trim().length >= MIN_ARTICLE_CHARS) {
              return normalizeText(graphBody)
            }
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }

  return ''
}

function stripHtmlFallback(html) {
  const raw = normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '\n')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '\n'),
  )

  const decoded = decodeBasicEntities(raw)
  const lines = decoded
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      if (line.length >= 40) return true
      if (/[\u4e00-\u9fff]{8,}/.test(line)) return true
      return false
    })

  return normalizeText(lines.join('\n'))
}

function extractArticleFromHtml(html, url, fallbackTitle = '') {
  let title = extractTitleFromHtml(html, fallbackTitle)

  try {
    const readability = extractWithReadability(html, url)
    if (readability?.content?.length >= MIN_ARTICLE_CHARS) {
      return {
        title: readability.title || title || fallbackTitle,
        content: readability.content,
        html: readability.html || '',
      }
    }
  } catch {
    // fall through to other strategies
  }

  const { document } = parseHTML(html)
  const semantic = extractFromSemanticNodes(document)
  if (semantic.text.length >= MIN_ARTICLE_CHARS) {
    return { title: title || fallbackTitle, content: semantic.text, html: semantic.html }
  }

  const jsonLdContent = extractJsonLdArticleBody(html)
  if (jsonLdContent.length >= MIN_ARTICLE_CHARS) {
    return { title: title || fallbackTitle, content: jsonLdContent, html: '' }
  }

  const metaContent = extractMetaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ])
  if (metaContent.length >= MIN_ARTICLE_CHARS) {
    return { title: title || fallbackTitle, content: metaContent, html: '' }
  }

  const fallbackContent = stripHtmlFallback(html)
  if (fallbackContent.length >= MIN_ARTICLE_CHARS) {
    return { title: title || fallbackTitle, content: fallbackContent, html: '' }
  }

  return null
}

function splitTextToParagraphs(text) {
  return normalizeText(text)
    .split(/\n\n+/)
    .map((part) => normalizeText(part))
    .filter((part) => part.length >= MIN_PARAGRAPH_CHARS)
    .map((part, index) => ({
      id: `p${index}`,
      text: part,
      kind: 'paragraph',
    }))
}

function parseArticleHtmlBlocks(articleHtml) {
  if (!articleHtml) return []

  const { document } = parseHTML(`<div id="wpx-article-root">${articleHtml}</div>`)
  const root = document.getElementById('wpx-article-root')
  if (!root) return []

  const blocks = []
  let index = 0

  for (const node of root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre')) {
    const tag = node.tagName?.toLowerCase?.() || 'p'
    if (!BLOCK_TAGS.has(tag)) continue

    const text = normalizeText(node.textContent || '')
    if (text.length < MIN_PARAGRAPH_CHARS) continue

    blocks.push({
      id: `p${index}`,
      text,
      kind: tag,
    })
    index += 1
  }

  return blocks
}

function isLikelyDecorativeImage(img, width, height) {
  const src = String(img.getAttribute('src') || img.getAttribute('data-src') || '').toLowerCase()
  if (src.includes('pixel') || src.includes('spacer') || src.includes('1x1')) return true
  if ((width > 0 && width < MIN_IMAGE_DIMENSION) || (height > 0 && height < MIN_IMAGE_DIMENSION)) {
    return true
  }
  return false
}

/** 判断 URL 是否像「懒加载占位符」（不是真实图） */
function isLikelyPlaceholderUrl(url) {
  const u = String(url || '').toLowerCase()
  if (!u) return true
  if (u.includes('placeholder')) return true
  if (u.includes('spacer')) return true
  if (u.includes('blank.gif') || u.includes('blank.png')) return true
  if (u.includes('loading.gif') || u.includes('loader.gif') || u.includes('lazy.gif')) return true
  if (u.startsWith('data:image/gif;base64,r0lgodlh')) return true // 1x1 透明 gif
  return false
}

function collectImagesFromRoot(root, pageUrl, seen) {
  const images = []

  for (const img of root.querySelectorAll('img, picture source[srcset], source[srcset]')) {
    let src = ''
    if (img.tagName?.toLowerCase() === 'img') {
      // 覆盖主流懒加载库：lazyload/echo.js/jQuery.Lazy/部分中文站点
      // 先拼出所有候选 src，再跳过明显是占位图的，最后取首个有效值
      const candidates = [
        img.getAttribute('src'),
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-echo'),
        img.getAttribute('data-defer-src'),
        img.getAttribute('data-url'),
        img.getAttribute('data-original-src'),
        img.getAttribute('_src'),
      ]
      for (const candidate of candidates) {
        if (candidate && !isLikelyPlaceholderUrl(candidate)) {
          src = candidate
          break
        }
      }
      if (!src) src = candidates.find((c) => c) || ''
    } else {
      // srcset 形如 "url 1x, url 2x" 或 "url 1200w, url 600w"
      const srcset = img.getAttribute('srcset') || ''
      // 取最后一个（一般是最清晰的）并去掉宽高描述符
      const candidates = srcset
        .split(',')
        .map((s) => s.trim().split(/\s+/)[0])
        .filter(Boolean)
      src = candidates[candidates.length - 1] || ''
    }

    const absoluteUrl = resolveAbsoluteUrl(src, pageUrl)
    if (!absoluteUrl || seen.has(absoluteUrl)) continue
    // 体积裁断：data: URL 超过 2MB 不入插图列表（避免炸 markdown）
    if (absoluteUrl.startsWith('data:') && absoluteUrl.length > MAX_DATA_URL_LENGTH) continue

    const width = Math.max(
      parseDimension(img.getAttribute('width')),
      parseDimension(img.getAttribute('data-width')),
    )
    const height = Math.max(
      parseDimension(img.getAttribute('height')),
      parseDimension(img.getAttribute('data-height')),
    )

    if (img.tagName?.toLowerCase() === 'img' && isLikelyDecorativeImage(img, width, height)) {
      continue
    }

    seen.add(absoluteUrl)
    images.push({
      id: `img${images.length}`,
      url: absoluteUrl,
      alt: normalizeText(img.getAttribute('alt') || ''),
      width,
      height,
    })
  }

  return images
}

function parseArticleHtmlImages(articleHtml, pageUrl) {
  if (!articleHtml) return []
  const { document } = parseHTML(`<div id="wpx-article-root">${articleHtml}</div>`)
  const root = document.getElementById('wpx-article-root')
  if (!root) return []
  return collectImagesFromRoot(root, pageUrl, new Set())
}

function parsePageImages(html, pageUrl) {
  const { document } = parseHTML(html)
  const scopes = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('[role="main"]'),
    document.body,
  ].filter(Boolean)

  const seen = new Set()
  const images = []

  for (const scope of scopes) {
    images.push(...collectImagesFromRoot(scope, pageUrl, seen))
  }

  return images
}

function isSpaShellHtml(html) {
  const sample = String(html || '')
  if (sample.includes('data-client-settings') && /"pagetype"\s*:\s*"article"/i.test(sample)) {
    return true
  }
  if (/<div id="root"[^>]*>\s*<\/div>/i.test(sample)) {
    return true
  }
  if (/<div id="ssr"[^>]*data-ssr-entry/i.test(sample) && !/<article[\s>]/i.test(sample)) {
    return true
  }
  return false
}

function extractMsnArticleId(url) {
  const match = String(url || '').match(/\/ar-([A-Za-z0-9]+)(?:[/?]|$)/i)
  return match?.[1] || null
}

function extractMsnMarket(url) {
  try {
    const parsed = new URL(url)
    const pathMatch = parsed.pathname.match(/^\/([a-z]{2}-[a-z]{2})\//i)
    if (pathMatch) return pathMatch[1].toLowerCase()
    if (parsed.hostname.includes('.cn')) return 'zh-cn'
    return 'en-us'
  } catch {
    return 'zh-cn'
  }
}

function getMsnAssetsBase(url) {
  try {
    return new URL(url).hostname.includes('.cn')
      ? 'https://assets.msn.cn'
      : 'https://assets.msn.com'
  } catch {
    return 'https://assets.msn.cn'
  }
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} url
 */
function parseMsnApiArticle(data, url) {
  if (!data || typeof data !== 'object') return null

  const title = normalizeText(String(data.title || data.abstract || ''))
  const bodyHtml = String(data.body || '')
  let paragraphs = parseArticleHtmlBlocks(bodyHtml)

  if (!paragraphs.length) {
    const fallback = normalizeText(String(data.abstract || data.subtitle || ''))
    if (fallback.length >= MIN_PARAGRAPH_CHARS) {
      paragraphs = [{ id: 'p0', text: fallback, kind: 'paragraph' }]
    }
  }

  let images = parseArticleHtmlImages(bodyHtml, url)
  if (!images.length && Array.isArray(data.imageResources)) {
    images = data.imageResources
      .filter((img) => img && typeof img === 'object' && img.url)
      .map((img, index) => ({
        id: `img${index}`,
        url: String(img.url),
        alt: normalizeText(String(img.title || img.caption || '')),
        width: Number(img.width) || 0,
        height: Number(img.height) || 0,
      }))
  }

  if (!paragraphs.length) return null

  return {
    url,
    title: title || extractMsnArticleId(url) || 'MSN 文章',
    paragraphs,
    images,
  }
}

async function fetchMsnArticlePreview(url) {
  const articleId = extractMsnArticleId(url)
  if (!articleId) return null

  const market = extractMsnMarket(url)
  const apiBase = getMsnAssetsBase(url)
  const apiUrl = `${apiBase}/content/view/v2/Detail/${market}/${articleId}`

  const response = await fetch(apiUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: 'application/json, text/plain, */*',
    },
  })

  if (!response.ok) return null

  const data = await response.json()
  return parseMsnApiArticle(data, url)
}

function validateHttpUrl(url) {
  const trimmed = String(url || '').trim()
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('请输入有效的 http/https URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('请输入有效的 http/https URL')
  }

  return trimmed
}

function isAntiBotHtml(html, statusCode = 200) {
  if ([403, 429].includes(statusCode)) return true

  const sample = String(html || '').slice(0, 100_000).toLowerCase()
  const strongSignals = [
    'cf-browser-verification',
    'challenge-platform',
    'id="cf-challenge',
    'class="cf-error-overview',
    'g-recaptcha',
    'hcaptcha.com',
    'verify you are human',
    'checking your browser before accessing',
    'enable javascript and cookies to continue',
    'just a moment...',
    '请完成安全验证',
    '人机验证',
    '滑动验证',
    '访问过于频繁',
    '请点击验证',
    'robot check',
    'bot detection',
    'access denied',
    'wafblock',
  ]

  if (strongSignals.some((signal) => sample.includes(signal))) {
    return true
  }

  if (statusCode === 503 && sample.includes('cloudflare')) {
    return true
  }

  const title = extractTitleFromHtml(html, '').toLowerCase()
  if (/just a moment|attention required|captcha|403 forbidden|访问受限|安全验证/.test(title)) {
    return true
  }

  return false
}

async function fetchPageHtml(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    })

    const html = await response.text()

    if ([403, 429].includes(response.status) || isAntiBotHtml(html, response.status)) {
      throw new AntiBotError()
    }

    if (!response.ok) {
      throw new Error(`无法抓取该网页（HTTP ${response.status}）`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error('该链接不是网页，请粘贴文章页面的 http/https 地址')
    }

    return html
  } catch (error) {
    if (error instanceof AntiBotError) {
      throw error
    }
    if (error?.name === 'AbortError') {
      throw new Error('网页抓取超时，请稍后重试或换用其他链接')
    }
    if (error instanceof Error && error.message.startsWith('无法抓取')) {
      throw error
    }
    if (error instanceof Error && error.message.startsWith('该链接')) {
      throw error
    }
    throw new Error('无法访问该网页，请检查 URL 是否正确或站点是否限制访问')
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * @param {string} html
 * @param {string} url
 */
function buildUrlPreviewFromHtml(html, url) {
  const parsed = new URL(url)
  const fallbackTitle = parsed.hostname
  const article = extractArticleFromHtml(html, url, fallbackTitle)

  if (!article?.content) {
    if (isAntiBotHtml(html)) {
      throw new AntiBotError()
    }
    if (isSpaShellHtml(html) || extractMsnArticleId(url)) {
      throw new DynamicPageError()
    }
    throw new Error('未能从网页提取正文，该页面可能需要登录或为动态加载内容')
  }

  const title = article.title || fallbackTitle
  let paragraphs = parseArticleHtmlBlocks(article.html)
  if (!paragraphs.length) {
    paragraphs = splitTextToParagraphs(article.content)
  }

  let images = parseArticleHtmlImages(article.html, url)
  if (!images.length) {
    images = parsePageImages(html, url)
  }

  return {
    url,
    title: normalizeText(title),
    paragraphs,
    images,
  }
}

/**
 * @param {string} url
 */
async function fetchUrlPreview(url) {
  const trimmed = validateHttpUrl(url)

  if (extractMsnArticleId(trimmed)) {
    const msnPreview = await fetchMsnArticlePreview(trimmed)
    if (msnPreview) return msnPreview
    throw new DynamicPageError()
  }

  const html = await fetchPageHtml(trimmed)
  return buildUrlPreviewFromHtml(html, trimmed)
}

function imageMeetsMinSize(image, minWidth, minHeight) {
  const minW = Number(minWidth) || 0
  const minH = Number(minHeight) || 0
  if (minW <= 0 && minH <= 0) return true
  if (!image.width && !image.height) return true
  if (minW > 0 && image.width > 0 && image.width < minW) return false
  if (minH > 0 && image.height > 0 && image.height < minH) return false
  return true
}

/**
 * @param {{
 *   title?: string
 *   sourceUrl?: string
 *   paragraphs?: Array<{ text: string, kind?: string }>
 *   images?: Array<{ url: string, alt?: string, width?: number, height?: number }>
 * }} payload
 */
function buildImportContent(payload) {
  const parts = []
  const title = normalizeText(payload.title || '')
  const sourceUrl = String(payload.sourceUrl || '').trim()

  const paragraphs = Array.isArray(payload.paragraphs) ? payload.paragraphs : []
  const paragraphTexts = []
  for (const paragraph of paragraphs) {
    const text = normalizeText(paragraph?.text || '')
    if (!text) continue
    paragraphTexts.push(text)
  }

  const images = Array.isArray(payload.images) ? payload.images : []
  if (!paragraphTexts.length && !images.length) {
    throw new Error('请至少选择一段正文或一张图片')
  }

  if (title) parts.push(`# ${title}`)
  if (sourceUrl) parts.push(`来源: ${sourceUrl}`)
  parts.push(...paragraphTexts)

  if (images.length > 0) {
    parts.push('---')
    parts.push('## 配图')
    for (const [index, image] of images.entries()) {
      const alt = normalizeText(image.alt || '') || `图片 ${index + 1}`
      // 按 CommonMark 转义 alt / url 中的 \ [ ] ( ) \\ 防止下游 markdown 解析错误
      const safeAlt = alt.replace(/[\\[\]()]/g, '\\$&')
      const safeUrl = String(image.url || '').replace(/[()\\]/g, '\\$&')
      const dim =
        image.width && image.height ? ` (${image.width}×${image.height})` : ''
      parts.push(`![${safeAlt}](${safeUrl})${dim}`)
    }
  }

  return normalizeText(parts.join('\n\n'))
}

/**
 * @param {{
 *   title?: string
 *   sourceUrl?: string
 *   paragraphs?: Array<{ text: string, kind?: string }>
 *   images?: Array<{ url: string, alt?: string, width?: number, height?: number }>
 * }} webImport
 */
function buildWebImportRecord(webImport) {
  const title = normalizeText(webImport?.title || '') || '网页资料'
  const content = buildImportContent(webImport)
  return {
    filename: `${title}.web`,
    content,
  }
}

/**
 * @param {string} url
 * @returns {Promise<{ filename: string, content: string }>}
 */
async function extractUrl(url) {
  const preview = await fetchUrlPreview(url)
  return buildWebImportRecord({
    title: preview.title,
    sourceUrl: preview.url,
    paragraphs: preview.paragraphs,
    images: preview.images,
  })
}

module.exports = {
  extractUrl,
  fetchUrlPreview,
  fetchMsnArticlePreview,
  parseMsnApiArticle,
  buildUrlPreviewFromHtml,
  buildImportContent,
  buildWebImportRecord,
  extractArticleFromHtml,
  extractMsnArticleId,
  imageMeetsMinSize,
  isAntiBotHtml,
  isSpaShellHtml,
  AntiBotError,
  DynamicPageError,
  ANTI_BOT_USER_MESSAGE,
  DYNAMIC_PAGE_USER_MESSAGE,
  normalizeText,
}

