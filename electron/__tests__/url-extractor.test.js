import { describe, expect, it } from 'vitest'
import {
  AntiBotError,
  buildImportContent,
  buildUrlPreviewFromHtml,
  buildWebImportRecord,
  extractArticleFromHtml,
  extractMsnArticleId,
  imageMeetsMinSize,
  isAntiBotHtml,
  isSpaShellHtml,
  parseMsnApiArticle,
} from '../services/url-extractor.js'

const SAMPLE_ARTICLE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <title>测试文章标题</title>
  <meta name="description" content="这是摘要，不应优先于正文。" />
  <script>window.__NUXT__ = {}</script>
  <style>.noise { display:none }</style>
</head>
<body>
  <nav>首页 关于 登录 注册 友情链接</nav>
  <article>
    <h1>测试文章标题</h1>
    <p>这是第一段正文内容，包含足够长的中文文本，用于验证 Readability 能否正确提取网页文章而不是导航栏噪音。</p>
    <p>这是第二段正文内容，继续补充一些细节，确保整体字符数超过最小提取阈值，便于自动化测试断言通过。</p>
    <img src="https://example.com/a.jpg" alt="配图A" width="800" height="600" />
    <img src="https://example.com/icon.png" alt="小图标" width="16" height="16" />
  </article>
  <footer>版权所有 © 2026</footer>
</body>
</html>`

describe('url-extractor', () => {
  it('extracts article body via Readability', () => {
    const result = extractArticleFromHtml(
      SAMPLE_ARTICLE_HTML,
      'https://example.com/article',
      'example.com',
    )

    expect(result).not.toBeNull()
    expect(result.title).toBe('测试文章标题')
    expect(result.content).toContain('第一段正文内容')
    expect(result.content).toContain('第二段正文内容')
    expect(result.content).not.toContain('友情链接')
  })

  it('builds preview with paragraphs and images', () => {
    const preview = buildUrlPreviewFromHtml(
      SAMPLE_ARTICLE_HTML,
      'https://example.com/article',
    )

    expect(preview.title).toBe('测试文章标题')
    expect(preview.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(preview.images.some((image) => image.url.includes('a.jpg'))).toBe(true)
    expect(preview.images.some((image) => image.url.includes('icon.png'))).toBe(false)
  })

  it('builds import content from selected paragraphs and images', () => {
    const preview = buildUrlPreviewFromHtml(
      SAMPLE_ARTICLE_HTML,
      'https://example.com/article',
    )
    const record = buildWebImportRecord({
      title: preview.title,
      sourceUrl: preview.url,
      paragraphs: [preview.paragraphs[0]],
      images: preview.images.slice(0, 1),
    })

    expect(record.filename).toContain('测试文章标题')
    expect(record.content).toContain('第一段正文内容')
    expect(record.content).toContain('![配图A]')
    expect(record.content).not.toContain('第二段正文内容')
  })

  it('requires at least one paragraph or image', () => {
    expect(() =>
      buildImportContent({
        title: '空内容',
        sourceUrl: 'https://example.com',
        paragraphs: [],
        images: [],
      }),
    ).toThrow('请至少选择一段正文或一张图片')
  })

  it('filters images by minimum size', () => {
    expect(imageMeetsMinSize({ width: 800, height: 600 }, 400, 300)).toBe(true)
    expect(imageMeetsMinSize({ width: 100, height: 80 }, 400, 300)).toBe(false)
    expect(imageMeetsMinSize({ width: 0, height: 0 }, 400, 300)).toBe(true)
  })

  it('detects anti-bot challenge pages', () => {
    const html = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>
      <div id="cf-browser-verification">Checking your browser before accessing</div>
    </body></html>`
    expect(isAntiBotHtml(html, 200)).toBe(true)
    expect(isAntiBotHtml('<html><body>正常文章</body></html>', 403)).toBe(true)
  })

  it('throws warm anti-bot message', () => {
    const error = new AntiBotError()
    expect(error.code).toBe('ANTI_BOT')
    expect(error.message).toContain('请用其他方法')
  })

  it('parses MSN API article payload', () => {
    const preview = parseMsnApiArticle(
      {
        title: '央视曝光! 多款水果跌落神坛',
        abstract: '央视曝光！多款水果跌落神坛，甜味剂8000倍甜度、违规防腐剂',
        body: '<p>这是 MSN 正文第一段，长度足够用于提取测试，应该出现在资料库预览里。</p><p>第二段补充说明，继续增加可读内容。</p>',
        imageResources: [
          {
            url: 'https://img-s.msn.cn/tenant/amp/entityid/AA26f9fI.img',
            width: 640,
            height: 370,
            title: '配图说明',
          },
        ],
      },
      'https://www.msn.cn/zh-cn/news/other/test/ar-AA26eZb1',
    )

    expect(preview?.title).toContain('央视曝光')
    expect(preview?.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(preview?.images[0]?.url).toContain('AA26f9fI')
  })

  it('detects MSN SPA shell HTML', () => {
    const html = `<!DOCTYPE html><html><head><title>MSN</title><script>window._clientSettings={"pagetype":"article"}</script></head><body><div id="root"></div></body></html>`
    expect(isSpaShellHtml(html)).toBe(true)
  })

  // ---- 修复点：补充懒加载属性 + srcset 多个候选 ----
  it('picks up images from common lazy-load attributes', () => {
    const html = `<!DOCTYPE html><html><body><article>
      <p>${'足够长的中文正文内容用于触发 Readability 提取。'.repeat(6)}</p>
      <img src="https://example.com/real-a.jpg" width="600" height="400" />
      <img data-src="https://example.com/real-b.jpg" width="600" height="400" />
      <img data-echo="https://example.com/real-c.jpg" width="600" height="400" />
      <img data-defer-src="https://example.com/real-d.jpg" width="600" height="400" />
      <img _src="https://example.com/real-e.jpg" width="600" height="400" />
    </article></body></html>`

    const preview = buildUrlPreviewFromHtml(html, 'https://example.com/article')
    const urls = preview.images.map((i) => i.url)
    expect(urls).toContain('https://example.com/real-a.jpg')
    expect(urls).toContain('https://example.com/real-b.jpg')
    expect(urls).toContain('https://example.com/real-c.jpg')
    expect(urls).toContain('https://example.com/real-d.jpg')
    expect(urls).toContain('https://example.com/real-e.jpg')
  })

  it('prefers the last (largest) candidate from srcset', () => {
    const html = `<!DOCTYPE html><html><body><article>
      <p>${'足够长的中文正文内容用于触发 Readability 提取。'.repeat(6)}</p>
      <img src="https://example.com/fallback.jpg" width="600" height="400" />
      <picture>
        <source srcset="https://example.com/small.jpg 600w, https://example.com/large.jpg 1200w" />
      </picture>
    </article></body></html>`

    const preview = buildUrlPreviewFromHtml(html, 'https://example.com/article')
    const urls = preview.images.map((i) => i.url)
    expect(urls).toContain('https://example.com/large.jpg')
  })

  // ---- 修复点：保留 data: URL ----
  it('keeps small data: URLs as inline images', () => {
    // 100×100 红色 PNG（不被当装饰图）约 200 字节
    const png =
      'data:image/png;base64,' +
      'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAYklEQVR42u3OQQ0AAAjEMK5/aWdg' +
      'cG8jiIGcxIqJUOQplmqdUJpLpOYQ3k1xZuQA8A8GAhDpHgYHAgEBAQEBAQEBAQEBAQEBvhwYCAQEB' +
      'AQEB/fw0EAgICAgICAQEB/fxQIBwQEBAQEBAQEB/r4aCAQEBAQEBAQEB/r4KCAQEB</PLACEHOLDER>'.replace('</PLACEHOLDER>', '')
    const html = `<!DOCTYPE html><html><body><article>
      <p>${'足够长的中文正文内容用于触发 Readability 提取。'.repeat(6)}</p>
      <img src="${png}" width="100" height="100" />
    </article></body></html>`

    const preview = buildUrlPreviewFromHtml(html, 'https://example.com/article')
    expect(preview.images.some((i) => i.url.startsWith('data:image/png'))).toBe(true)
  })

  // ---- 修复点：buildImportContent 转义 URL 括号 ----
  it('escapes parentheses in image URLs inside import content', () => {
    const content = buildImportContent({
      title: '带括号 URL',
      sourceUrl: 'https://example.com',
      paragraphs: [{ text: '正文内容。'.repeat(15) }],
      images: [
        { url: 'https://cdn.example.com/photo(1).jpg', alt: '配图', width: 800, height: 600 },
      ],
    })
    // 原始 ( 变成 \( ）避免被下游 markdown 解析器误吞
    expect(content).toContain('\\(1\\)')
    // 之后 markdownToHtml 负责还原
  })
})
