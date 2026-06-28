import { describe, expect, it } from 'vitest'
import { extractPreviewImages, hasPreviewImages } from '@/utils/knowledgePreview'

describe('knowledgePreview — 图片/文本分离', () => {
  it('从 <img src="data:..."> 抽出 src 并剥离标签', () => {
    const input = `前言段落。\n\n<img src="data:image/png;base64,iVBORw0KGgo" alt="x" />\n\n后续段落。`
    const { textPreview, images } = extractPreviewImages(input)
    expect(images).toEqual(['data:image/png;base64,iVBORw0KGgo'])
    expect(textPreview).not.toContain('<img')
    expect(textPreview).toContain('前言段落')
    expect(textPreview).toContain('后续段落')
  })

  it('支持多张图片与不同引号', () => {
    const input = `<img src='data:image/png;base64,AAA' />中间<img src="data:image/jpeg;base64,BBB">`
    const { textPreview, images } = extractPreviewImages(input)
    expect(images).toHaveLength(2)
    expect(images[0]).toContain('AAA')
    expect(images[1]).toContain('BBB')
    expect(textPreview).not.toContain('<img')
  })

  it('保留 markdown 图片语法 ![alt](url) 不动', () => {
    const input = '前面\n\n![配图](https://example.com/photo.jpg) (1280×720)\n\n后面'
    const { textPreview, images } = extractPreviewImages(input)
    expect(images).toEqual([]) // markdown 不抽
    expect(textPreview).toBe(input) // 完全保持
  })

  it('空 content 不报错', () => {
    const r = extractPreviewImages('')
    expect(r.textPreview).toBe('')
    expect(r.images).toEqual([])
    expect(hasPreviewImages('')).toBe(false)
  })

  it('没有图片时原样返回文本', () => {
    const input = '纯文本内容，没有任何图片。'
    const r = extractPreviewImages(input)
    expect(r.images).toEqual([])
    expect(r.textPreview).toBe(input)
    expect(hasPreviewImages(input)).toBe(false)
  })

  it('hasPreviewImages 仅在有 <img 时返回 true', () => {
    expect(hasPreviewImages('<img src="x">')).toBe(true)
    expect(hasPreviewImages('![alt](x)')).toBe(false)
    expect(hasPreviewImages(null)).toBe(false)
    expect(hasPreviewImages(undefined)).toBe(false)
  })

  it('不影响前后空白与换行', () => {
    const input = '前\n\n<img src="data:image/png;base64,A" />\n\n后'
    const { textPreview } = extractPreviewImages(input)
    expect(textPreview).toMatch(/^前/)
    expect(textPreview).toMatch(/后$/)
  })

  it('多次调用 lastIndex 状态不互相影响（g 标志陷阱）', () => {
    const input = '<img src="a"><img src="b">'
    // 先 hasPreviewImages 触发 test
    hasPreviewImages(input)
    hasPreviewImages(input)
    // 再 extract 不能因为 lastIndex 漏掉图
    const r = extractPreviewImages(input)
    expect(r.images).toEqual(['a', 'b'])
  })
})
