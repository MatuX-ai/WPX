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

  it('converts horizontal rules', () => {
    const html = markdownToHtml('上文\n\n---\n\n下文')
    expect(html).toContain('<hr />')
    expect(html).toContain('<p>下文</p>')
  })
})
