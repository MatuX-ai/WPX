import { describe, it, expect } from 'vitest'
import { exportSlidesAsHtml } from '@/utils/slideExport'

describe('slideExport - HTML 导出', () => {
  it('导出空数组时仍返回合法 HTML 字符串', () => {
    const html = exportSlidesAsHtml([], { theme: 'light' })
    expect(typeof html).toBe('string')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('id="total">0<')
  })

  it('包含 slides JSON 数据', () => {
    const slides = [
      { component: 'CoverSlide', props: { title: '演示标题', subtitle: '副标题' } },
      { component: 'TextSlide', props: { title: '正文', bulletPoints: ['A', 'B'] } },
      { component: 'EndSlide', props: { text: '感谢观看' } },
    ]
    const html = exportSlidesAsHtml(slides, { theme: 'dark' })
    expect(html).toContain('演示标题')
    expect(html).toContain('副标题')
    expect(html).toContain('感谢观看')
    // JSON 化的 slides 数组长度
    expect(html).toMatch(/"index":\s*0/)
    expect(html).toMatch(/"index":\s*1/)
    expect(html).toMatch(/"index":\s*2/)
    expect(html).toContain('data-theme="dark"')
  })

  it('对 ChartSlide 与 ImageTextSlide 使用占位渲染', () => {
    const slides = [
      { component: 'ChartSlide', props: { title: '统计', chartType: 'bar' } },
      { component: 'ImageTextSlide', props: { title: '图', text: '描述', imageUrl: 'https://x/y.png' } },
    ]
    const html = exportSlidesAsHtml(slides, {})
    expect(html).toContain('图表占位')
    expect(html).toContain('图片占位')
  })

  it('HTML 转义特殊字符', () => {
    const slides = [
      { component: 'TextSlide', props: { title: '<script>alert(1)</script>', bulletPoints: [] } },
    ]
    const html = exportSlidesAsHtml(slides, {})
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})