import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { extractArticleFromHtml, buildUrlPreviewFromHtml, isAntiBotHtml } = require('../services/url-extractor.js')

const url =
  'https://www.msn.cn/zh-cn/news/other/%E5%A4%AE%E8%A7%86%E6%9B%9D%E5%85%89-%E5%A4%9A%E6%AC%BE%E6%B0%B4%E6%9E%9C%E8%B7%8C%E8%90%BD%E7%A5%9E%E5%9D%9B-%E7%94%9C%E5%91%B3%E5%89%828000%E5%80%8D%E7%94%9C%E5%BA%A6-%E8%BF%9D%E8%A7%84%E9%98%B2%E8%85%90%E5%89%82/ar-AA26eZb1'

const response = await fetch(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    Accept: 'text/html,application/xhtml+xml',
  },
})

console.log('status', response.status)
const html = await response.text()
console.log('html length', html.length)
console.log('antiBot', isAntiBotHtml(html, response.status))

const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
console.log('title', titleMatch?.[1]?.trim())

for (const pattern of [
  /property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  /content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  /property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  /name=["']description["'][^>]+content=["']([^"']+)["']/i,
]) {
  const m = html.match(pattern)
  if (m) console.log('meta', pattern.source.slice(0, 40), m[1].slice(0, 200))
}

const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
console.log('json-ld count', ldMatches.length)
for (const [i, match] of ldMatches.entries()) {
  try {
    const data = JSON.parse(match[1])
    console.log(`ld[${i}] keys`, Object.keys(Array.isArray(data) ? data[0] : data))
    const text = JSON.stringify(data).slice(0, 400)
    console.log(`ld[${i}] sample`, text)
  } catch (e) {
    console.log(`ld[${i}] parse fail`, match[1].slice(0, 100))
  }
}

const article = extractArticleFromHtml(html, url, 'msn.cn')
console.log('extractArticle', article ? { title: article.title, len: article.content?.length, preview: article.content?.slice(0, 200) } : null)

try {
  const preview = buildUrlPreviewFromHtml(html, url)
  console.log('preview ok', preview.paragraphs.length, preview.images.length)
} catch (e) {
  console.log('preview fail', e.message)
}

// Look for embedded JSON state
for (const signal of ['__NEXT_DATA__', 'articleBody', 'NewsArticle', 'ApolloState', 'window.__'] ) {
  console.log(signal, html.includes(signal))
}
