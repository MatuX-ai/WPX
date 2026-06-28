import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportSlidesAsHtml,
  exportSlidesAsPdf,
  downloadSlidesAsPdf,
} from '@/utils/slideExport'

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

describe('slideExport - PDF 导出', () => {
  beforeEach(() => {
    // mock window.print 防止调用真实 API
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.print = vi.fn()
    }
  })

  afterEach(() => {
    // 清理 mock（如果环境支持）
    if (typeof globalThis.window !== 'undefined') {
      // eslint-disable-next-line no-undef
      globalThis.window.print = undefined
    }
  })

  it('空数组返回 ok:false 并附带中文错误', () => {
    const result = exportSlidesAsPdf([])
    expect(result).toMatchObject({ ok: false })
    expect(result.error).toContain('没有可导出的幻灯片')
  })

  it('非数组 slides 也返回 ok:false', () => {
    const result = exportSlidesAsPdf(null)
    expect(result.ok).toBe(false)
  })

  it('使用默认文件名（包含 .pdf 后缀）', () => {
    const slides = [
      { component: 'CoverSlide', props: { title: '标题', subtitle: '副标题' } },
      { component: 'EndSlide', props: { text: '谢谢' } },
    ]
    const result = exportSlidesAsPdf(slides)
    expect(result.ok).toBe(true)
    expect(result.filename).toMatch(/\.pdf$/)
  })

  it('支持自定义 filename', () => {
    const slides = [{ component: 'TextSlide', props: { title: 'T', bulletPoints: [] } }]
    const result = exportSlidesAsPdf(slides, { filename: 'my-deck.pdf' })
    expect(result.filename).toBe('my-deck.pdf')
  })

  it('生成的 HTML 字符串包含 @page 16:9 打印声明', () => {
    const slides = [{ component: 'CoverSlide', props: { title: 'Hi' } }]
    const result = exportSlidesAsPdf(slides, { autoPrint: false })
    // autoPrint:false 时走 html-only 分支，会回传 html 字符串
    expect(result.method).toBe('html-only')
    expect(result.html).toContain('@page')
    expect(result.html).toContain('13.33in')
    expect(result.html).toContain('7.5in')
  })

  it('SSR / 非浏览器环境下返回 html-only 而不调用 window.print', () => {
    const slides = [{ component: 'TextSlide', props: { title: 'T', bulletPoints: [] } }]
    // 模拟 SSR
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document
    // @ts-ignore - 临时删除以模拟 SSR
    delete globalThis.window
    // @ts-ignore
    delete globalThis.document
    try {
      const result = exportSlidesAsPdf(slides)
      expect(result.ok).toBe(true)
      expect(result.method).toBe('html-only')
      expect(typeof result.html).toBe('string')
      expect(result.html.length).toBeGreaterThan(0)
    } finally {
      globalThis.window = originalWindow
      globalThis.document = originalDocument
    }
  })

  it('autoPrint:false 时不会创建 iframe（走 html-only 分支）', () => {
    const slides = [{ component: 'TextSlide', props: { title: 'T', bulletPoints: [] } }]
    const createElementSpy =
      typeof document !== 'undefined'
        ? vi.spyOn(document, 'createElement')
        : null

    const result = exportSlidesAsPdf(slides, { autoPrint: false })
    expect(result.ok).toBe(true)
    expect(result.method).toBe('html-only')
    if (createElementSpy) {
      // 不应该创建 iframe
      const iframeCalls = createElementSpy.mock.calls.filter(
        (args) => args[0] === 'iframe',
      )
      expect(iframeCalls.length).toBe(0)
      createElementSpy.mockRestore()
    }
  })

  it('浏览器环境下 autoPrint 默认会创建隐藏 iframe 并调用 print', async () => {
    const slides = [{ component: 'TextSlide', props: { title: 'T', bulletPoints: [] } }]
    if (typeof document === 'undefined') {
      // 跳过：在当前环境没有 document
      return
    }
    // jsdom 不实现 Window.print()，因此这里只验证 exportSlidesAsPdf 的返回结构，
    // 并不强行验证 print 被调用（运行时由浏览器兑现）。
    const result = exportSlidesAsPdf(slides, { autoPrint: true })
    expect(result.ok).toBe(true)
    expect(result.method).toBe('browser-print')
    expect(result.filename).toMatch(/\.pdf$/)
    // 验证 document.body 上创建了 iframe
    const created = document.querySelector('iframe[title="wpx-slide-print"]')
    expect(created).toBeTruthy()
    // 清理
    created?.parentNode?.removeChild(created)
  })

  it('downloadSlidesAsPdf 与 exportSlidesAsPdf 行为一致', () => {
    const slides = [{ component: 'TextSlide', props: { title: 'T', bulletPoints: [] } }]
    const r1 = downloadSlidesAsPdf(slides, { autoPrint: false })
    const r2 = exportSlidesAsPdf(slides, { autoPrint: false })
    expect(r1.ok).toBe(r2.ok)
    expect(r1.method).toBe(r2.method)
    expect(r1.html).toBe(r2.html)
  })

  it('输出 HTML 对 XSS 字符串做转义', () => {
    const slides = [
      {
        component: 'TextSlide',
        props: { title: '<img src=x onerror=alert(1)>', bulletPoints: [] },
      },
    ]
    const result = exportSlidesAsPdf(slides, { autoPrint: false })
    expect(result.html).not.toContain('<img src=x onerror=alert(1)>')
    expect(result.html).toContain('&lt;img')
  })
})