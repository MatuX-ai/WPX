import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractCommercialFontUsage,
  parseWpxFontId,
  analyzeExportFonts,
  collectDocumentEmbedFonts,
  getCommercialFontIdSet,
} from '@/utils/exportFontAnalysis'

vi.mock('@/utils/electron', () => ({
  isElectron: () => true,
  getElectronAPI: () => ({
    fonts: {
      getCommercialList: vi.fn(() =>
        Promise.resolve({
          ok: true,
          fonts: [{ id: 'founder-lanting-hei', name: '方正兰亭黑' }],
        }),
      ),
    },
  }),
}))

vi.mock('@/utils/tokenApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    hashDocumentContent: vi.fn(() => Promise.resolve('doc-hash-abc')),
    previewTokenConsume: vi.fn(() =>
      Promise.resolve({
        balance: 500,
        total_consumed: 12,
        sufficient: true,
        fonts: [
          {
            font_id: 'founder-lanting-hei',
            font_name: '方正兰亭黑',
            char_count: 12,
            token_used: 12,
            deduplicated: false,
          },
        ],
      }),
    ),
  }
})

function createMockEditor(docJson) {
  return {
    getJSON: () => docJson,
  }
}

describe('exportFontAnalysis', () => {
  beforeEach(async () => {
    await getCommercialFontIdSet()
  })

  it('3. 识别商业字体 ⚡ 的 fontId', () => {
    expect(parseWpxFontId("'WPX-founder-lanting-hei', sans-serif")).toBe('founder-lanting-hei')
  })

  it('4. 统计商业字体使用字数用于导出确认', () => {
    const editor = createMockEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '商业字体测试',
              marks: [
                {
                  type: 'fontFamily',
                  attrs: { fontFamily: "'WPX-founder-lanting-hei', sans-serif" },
                },
              ],
            },
          ],
        },
      ],
    })

    const usage = extractCommercialFontUsage(editor)
    expect(usage.get('founder-lanting-hei')).toBe(6)
  })

  it('detectCommercialFontUsage 仅本地检测，不调用扣费预览', async () => {
    const { detectCommercialFontUsage } = await import('@/utils/exportFontAnalysis')
    const { previewTokenConsume } = await import('@/utils/tokenApi')

    const editor = createMockEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '本地检测',
              marks: [
                {
                  type: 'fontFamily',
                  attrs: { fontFamily: "'WPX-founder-lanting-hei', sans-serif" },
                },
              ],
            },
          ],
        },
      ],
    })

    const result = await detectCommercialFontUsage(editor)
    expect(result?.hasCommercialFonts).toBe(true)
    expect(result?.fonts[0]).toMatchObject({
      fontId: 'founder-lanting-hei',
      name: '方正兰亭黑',
      charCount: 4,
    })
    expect(previewTokenConsume).not.toHaveBeenCalled()
  })

  it('4. analyzeExportFonts 返回正确的 Token 消耗预览', async () => {
    const editor = createMockEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '导出扣费',
              marks: [
                {
                  type: 'fontFamily',
                  attrs: { fontFamily: "'WPX-founder-lanting-hei', sans-serif" },
                },
              ],
            },
          ],
        },
      ],
    })

    const analysis = await analyzeExportFonts(editor, '# 导出扣费')
    expect(analysis?.hasCommercialFonts).toBe(true)
    expect(analysis?.fonts[0]).toMatchObject({
      fontId: 'founder-lanting-hei',
      name: '方正兰亭黑',
      charCount: 12,
      tokenCost: 12,
    })
    expect(analysis?.totalCost).toBe(12)
    expect(analysis?.balance).toBe(500)
    expect(analysis?.sufficient).toBe(true)
  })

  it('collectDocumentEmbedFonts 收集所有 WPX 字体字符', () => {
    const editor = createMockEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Aa',
              marks: [
                {
                  type: 'fontFamily',
                  attrs: { fontFamily: "'WPX-source-han-sans', sans-serif" },
                },
              ],
            },
          ],
        },
      ],
    })

    const embedFonts = collectDocumentEmbedFonts(editor)
    expect(embedFonts).toHaveLength(1)
    expect(embedFonts[0].fontId).toBe('source-han-sans')
    expect(embedFonts[0].text).toContain('A')
  })
})
