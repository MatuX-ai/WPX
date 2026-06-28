import { describe, expect, it } from 'vitest'
import { markdownToHtml } from '@/utils/markdownToEditor'

describe('markdownToHtml', () => {
  it('converts markdown images to editor img tags', () => {
    const html = markdownToHtml('![配图](https://example.com/a.jpg)\n\n正文段落')
    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/a.jpg"')
    expect(html).toContain('alt="配图"')
    expect(html).toContain('data-float="left"')
    expect(html).toContain('<p>正文段落</p>')
  })

  it('ignores trailing dimension hints on image lines', () => {
    const html = markdownToHtml('![图](https://example.com/a.jpg) (800×600)')
    expect(html).toContain('src="https://example.com/a.jpg"')
    expect(html).not.toContain('800')
  })

  // ---- 修复点 1：URL 含括号不再被吞 ----
  it('parses image with parentheses inside the URL', () => {
    const html = markdownToHtml('![配图](https://cdn.example.com/photo(1).jpg)')
    expect(html).toContain('<img')
    expect(html).toContain('src="https://cdn.example.com/photo(1).jpg"')
    // 不能再是字面量文本
    expect(html).not.toContain('![配图]')
  })

  it('parses image with parentheses in query string', () => {
    const html = markdownToHtml('![配图](https://api.example.com/img?sign=abc(123)&t=1)')
    expect(html).toContain('<img')
    // alt 与 url 都在；& 被转义成 &amp; 是 HTML 属性转义标准行为
    expect(html).toContain('src="https://api.example.com/img?sign=abc(123)&amp;t=1"')
    expect(html).not.toContain('![配图]')
  })

  // ---- 修复点 2：上游转义括号也解转义 ----
  it('unescapes backslash-escaped parentheses from upstream', () => {
    const html = markdownToHtml('![配图](https://cdn.example.com/photo\\(1\\).jpg)')
    expect(html).toContain('src="https://cdn.example.com/photo(1).jpg"')
  })

  it('keeps dim suffix ignored even when URL has parens', () => {
    const html = markdownToHtml('![配图](https://cdn.example.com/photo(1).jpg) (1280×720)')
    expect(html).toContain('src="https://cdn.example.com/photo(1).jpg"')
    expect(html).not.toContain('1280')
  })

  it('converts horizontal rules', () => {
    const html = markdownToHtml('上文\n\n---\n\n下文')
    expect(html).toContain('<hr />')
    expect(html).toContain('<p>下文</p>')
  })
})
