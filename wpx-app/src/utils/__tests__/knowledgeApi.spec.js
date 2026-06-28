import { describe, expect, it, vi } from 'vitest'
import { buildWebImportEditorContent, buildWebImportPayload } from '@/utils/knowledgeApi'

vi.mock('@/utils/electron', () => ({
  isElectron: vi.fn(() => false),
  getElectronAPI: vi.fn(() => null),
}))

describe('knowledgeApi — buildWebImportEditorContent', () => {
  it('在 markdown 中转义 URL 括号，防止下游正则误吞', () => {
    const preview = {
      url: 'https://example.com',
      title: '含括号 URL',
      paragraphs: [{ id: 'p0', text: '正文段落用于凑足长度便于断言。' }],
      images: [
        { id: 'i0', url: 'https://cdn.example.com/photo(1).jpg', alt: '配图' },
      ],
    }
    const content = buildWebImportEditorContent(preview, preview)
    // 原始括号被转义
    expect(content).toContain('\\(1\\)')
    // 不出现原始的 (1)
    expect(content).not.toMatch(/photo\(1\)/)
  })

  it('alt 中的 [ ] 与 \\ 会被转义为 [ ] \\ ', () => {
    const preview = {
      url: 'https://example.com',
      title: '',
      paragraphs: [{ id: 'p0', text: '正文段落。'.repeat(10) }],
      images: [
        { id: 'i0', url: 'https://cdn.example.com/photo.jpg', alt: '图A[精选]\\路径' },
      ],
    }
    const content = buildWebImportEditorContent(preview, preview)
    // [ ] \\ 都需转义，防止提前关闭 alt
    expect(content).toContain('图A\\[精选\\]\\\\路径')
    // 不能让下游正则看到不转义的 [ ] 错位
    expect(content).not.toMatch(/图A\[精选\]/)
  })

  it('没有图时也能正常生成纯文本 markdown', () => {
    const preview = {
      url: 'https://example.com',
      title: '无图文章',
      paragraphs: [{ id: 'p0', text: '第一段正文内容。'.repeat(10) }],
      images: [],
    }
    const content = buildWebImportEditorContent(preview, preview)
    expect(content).toContain('# 无图文章')
    expect(content).not.toContain('![')
  })

  it('同时有图与文时按段落均匀混排', () => {
    const preview = {
      url: 'https://example.com',
      title: 't',
      paragraphs: [
        { id: 'p0', text: '段1。'.repeat(8) },
        { id: 'p1', text: '段2。'.repeat(8) },
        { id: 'p2', text: '段3。'.repeat(8) },
      ],
      images: [
        { id: 'i0', url: 'https://a/1.jpg' },
        { id: 'i1', url: 'https://a/2.jpg' },
      ],
    }
    const content = buildWebImportEditorContent(preview, preview)
    // 图片 markdown 计数
    const matches = content.match(/!\[[^\]]*\]/g) || []
    expect(matches.length).toBe(2)
  })

  it('buildWebImportPayload 透传选中字段', () => {
    const preview = {
      url: 'https://example.com',
      title: '原始标题',
      paragraphs: [{ id: 'p0', text: '正文' }],
      images: [{ id: 'i0', url: 'https://a/1.jpg' }],
    }
    const selection = { title: '用户改的标题', sourceUrl: 'https://override.com', paragraphs: [], images: [] }
    const payload = buildWebImportPayload(preview, selection)
    expect(payload.title).toBe('用户改的标题')
    expect(payload.sourceUrl).toBe('https://override.com')
  })
})
