import { describe, expect, it } from 'vitest'
import {
  PPTX_LOSSY_RISKS,
  buildPptxImportWarningSummary,
} from '@/utils/pptxImportWarning'

describe('pptxImportWarning', () => {
  it('固定风险条目非空', () => {
    expect(PPTX_LOSSY_RISKS.length).toBeGreaterThanOrEqual(4)
    expect(PPTX_LOSSY_RISKS.some((r) => /Ctrl\+S|覆盖/.test(r))).toBe(true)
  })

  it('汇总统计与文件名', () => {
    const s = buildPptxImportWarningSummary({
      title: '发布会',
      path: 'C:\\docs\\demo.pptx',
      slideCount: 5,
      imageCount: 2,
      chartCount: 1,
      warnings: [
        'PPTX 导入为有损转换：动画、母版、备注与精确布局不会保留；图片与图表会尽量保留。',
        '已导入 2 张图片。',
      ],
    })
    expect(s.title).toBe('发布会')
    expect(s.fileName).toBe('demo.pptx')
    expect(s.statsLabel).toContain('5 页')
    expect(s.statsLabel).toContain('2 张图片')
    expect(s.statsLabel).toContain('1 个图表')
    expect(s.risks).toEqual(PPTX_LOSSY_RISKS)
    expect(s.extraWarnings).toEqual(['已导入 2 张图片。'])
  })

  it('缺省标题回退', () => {
    const s = buildPptxImportWarningSummary({})
    expect(s.title).toBe('演示文稿')
    expect(s.statsLabel).toBe('内容已解析')
  })
})
