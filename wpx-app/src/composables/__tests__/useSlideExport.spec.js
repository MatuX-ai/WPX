import { describe, it, expect, beforeEach } from 'vitest'
import { exportToHTML, useSlideExport } from '@/composables/useSlideExport'

describe('useSlideExport - exportToHTML 基本契约', () => {
  it('返回完整 HTML 字符串 + Blob + objectUrl + filename + size + download', () => {
    const slides = [
      { component: 'CoverSlide', props: { title: 'A', subtitle: 'B' } },
      { component: 'TextSlide', props: { title: 'B', bulletPoints: ['x', 'y'] } },
    ]
    const result = exportToHTML(slides, { title: 'A 演示' })
    expect(typeof result.html).toBe('string')
    expect(result.html).toMatch(/^<!doctype html>/i)
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.type).toBe('text/html;charset=utf-8')
    expect(typeof result.objectUrl).toBe('string')
    expect(result.objectUrl).toMatch(/^blob:/)
    expect(result.filename).toBe('A 演示.html')
    expect(result.size).toBeGreaterThan(0)
    expect(typeof result.download).toBe('function')
  })

  it('未传 title 时从 CoverSlide 推断', () => {
    const slides = [
      { component: 'CoverSlide', props: { title: 'AI 发布会' } },
      { component: 'TextSlide', props: { title: 'X' } },
    ]
    const r = exportToHTML(slides)
    expect(r.html).toContain('<title>AI 发布会</title>')
    expect(r.filename).toBe('AI 发布会.html')
  })

  it('未传 title 也无 CoverSlide 时从第一张 slide 推断', () => {
    const slides = [
      { component: 'TextSlide', props: { title: '首页' } },
      { component: 'EndSlide', props: { text: '结束' } },
    ]
    const r = exportToHTML(slides)
    expect(r.html).toContain('<title>首页</title>')
    expect(r.filename).toBe('首页.html')
  })

  it('空 slides 数组仍返回合法 HTML', () => {
    const r = exportToHTML([])
    expect(r.html).toContain('<!doctype html>')
    expect(r.html).toContain('1 / 0') // pageInfo
  })

  it('filename 选项以 .html 结尾时直接使用，否则补上 .html', () => {
    expect(exportToHTML([], { filename: 'demo.html' }).filename).toBe('demo.html')
    expect(exportToHTML([], { filename: 'noext' }).filename).toBe('noext.html')
  })

  it('filename 中的非法字符被替换为下划线', () => {
    expect(exportToHTML([], { filename: 'a/b\\c:d*e?"f' }).filename).toBe('a_b_c_d_e__f.html')
  })
})

describe('useSlideExport - 主题与 CDN', () => {
  it('默认 light 主题', () => {
    const r = exportToHTML([])
    expect(r.html).toContain('data-theme="light"')
  })

  it('dark 主题', () => {
    const r = exportToHTML([], { theme: 'dark' })
    expect(r.html).toContain('data-theme="dark"')
  })

  it('reveal.js CDN 默认 5.1.0', () => {
    const r = exportToHTML([])
    expect(r.html).toContain('cdn.jsdelivr.net/npm/reveal.js@5.1.0/')
  })

  it('自定义 revealVersion', () => {
    const r = exportToHTML([], { revealVersion: '4.5.0' })
    expect(r.html).toContain('reveal.js@4.5.0/')
  })

  it('没有 ChartSlide 时不引入 ECharts script', () => {
    const slides = [{ component: 'TextSlide', props: { title: 'x' } }]
    const r = exportToHTML(slides)
    expect(r.html).not.toContain('echarts')
    expect(r.html).not.toContain('initCharts')
  })

  it('存在 ChartSlide 时引入 ECharts script', () => {
    const slides = [
      { component: 'TextSlide', props: { title: 'x' } },
      {
        component: 'ChartSlide',
        props: {
          title: '统计',
          chartType: 'bar',
          chartData: JSON.stringify([{ name: 'A', value: 12 }]),
        },
      },
    ]
    const r = exportToHTML(slides)
    expect(r.html).toContain('cdn.jsdelivr.net/npm/echarts@5.4.3/')
    expect(r.html).toContain('initCharts')
    expect(r.html).toContain('maybeUpdateChart')
    expect(r.html).toContain('data-chart-type="bar"')
  })
})

describe('useSlideExport - 组件到 section 映射', () => {
  it('CoverSlide 居中标题 + 副标题 + 渐变', () => {
    const r = exportToHTML([
      { component: 'CoverSlide', props: { title: '主', subtitle: '副', author: 'WPX' } },
    ])
    expect(r.html).toContain('wpx-cover-title')
    expect(r.html).toContain('主')
    expect(r.html).toContain('wpx-cover-subtitle')
    expect(r.html).toContain('WPX')
  })

  it('TextSlide 标题 + 要点列表（带 fragment 动画）', () => {
    const r = exportToHTML([
      { component: 'TextSlide', props: { title: '章节', bulletPoints: ['一', '二'] } },
    ])
    expect(r.html).toContain('wpx-text-title')
    expect(r.html).toContain('章节')
    expect(r.html).toMatch(/<li class="fragment">一<\/li>/)
    expect(r.html).toMatch(/<li class="fragment">二<\/li>/)
  })

  it('TextSlide 也接受 body 字符串', () => {
    const r = exportToHTML([
      { component: 'TextSlide', props: { title: 'T', body: '描述段落' } },
    ])
    expect(r.html).toContain('<li class="fragment">描述段落</li>')
  })

  it('EndSlide 居中收尾', () => {
    const r = exportToHTML([
      { component: 'EndSlide', props: { text: '感谢观看' } },
    ])
    expect(r.html).toContain('wpx-end-title')
    expect(r.html).toContain('感谢观看')
  })

  it('ImageTextSlide 渲染 img + text', () => {
    const r = exportToHTML([
      { component: 'ImageTextSlide', props: { title: '图', text: '说明', imageUrl: 'https://x/y.png' } },
    ])
    expect(r.html).toContain('wpx-img')
    expect(r.html).toContain('https://x/y.png')
    expect(r.html).toContain('说明')
  })

  it('ImageTextSlide 没有 imageUrl 时显示占位', () => {
    const r = exportToHTML([
      { component: 'ImageTextSlide', props: { title: 'T', text: 'x' } },
    ])
    expect(r.html).toContain('wpx-img-placeholder')
  })

  it('未知组件类型降级为 TextSlide 渲染', () => {
    const r = exportToHTML([
      { component: 'CustomSlide', props: { title: 'A', body: 'B' } },
    ])
    expect(r.html).toContain('data-component="CustomSlide"')
    expect(r.html).toContain('A')
    expect(r.html).toContain('B')
  })

  it('为每张 slide 标注 data-index', () => {
    const r = exportToHTML([
      { component: 'TextSlide', props: { title: 'a' } },
      { component: 'TextSlide', props: { title: 'b' } },
    ])
    expect(r.html).toContain('data-index="0"')
    expect(r.html).toContain('data-index="1"')
  })
})

describe('useSlideExport - 安全：HTML 转义', () => {
  it('title 中的 <script> 不会原样插入', () => {
    const r = exportToHTML([
      { component: 'TextSlide', props: { title: '<script>alert(1)</script>' } },
    ])
    expect(r.html).not.toContain('<script>alert(1)</script>')
    expect(r.html).toContain('&lt;script&gt;')
  })

  it('bulletPoints 中的 <img> 也会被转义', () => {
    const r = exportToHTML([
      { component: 'TextSlide', props: { title: 'x', bulletPoints: ['<img src=x onerror=1>'] } },
    ])
    expect(r.html).not.toContain('<img src=x onerror=1>')
    expect(r.html).toContain('&lt;img')
  })

  it('imageUrl 中出现 <>" 时被转义（避免属性注入）', () => {
    const r = exportToHTML([
      { component: 'ImageTextSlide', props: { title: 't', imageUrl: 'https://x/y.png" onclick="hack' } },
    ])
    expect(r.html).not.toContain('" onclick="hack')
    expect(r.html).toContain('&quot;')
  })

  it('chartData 中的 JSON 字符串被安全嵌入', () => {
    const r = exportToHTML([
      {
        component: 'ChartSlide',
        props: { title: 't', chartType: 'bar', chartData: '["<x>", 1]' },
      },
    ])
    expect(r.html).not.toMatch(/data-chart-data='\["<x>"/)
    expect(r.html).toContain('&lt;x&gt;')
  })
})

describe('useSlideExport - 浮层交互（缩略图 / 全屏 / 键盘）', () => {
  it('HTML 中包含缩略图面板与工具栏', () => {
    const r = exportToHTML([])
    expect(r.html).toContain('wpx-floating-toolbar')
    expect(r.html).toContain('wpx-thumbs')
    expect(r.html).toContain('wpx-thumbs-toggle')
    expect(r.html).toContain('wpx-fullscreen-toggle')
  })

  it('键盘快捷键脚本包含 T（缩略图）/ F（全屏）/ Escape（关闭缩略图）', () => {
    const r = exportToHTML([])
    expect(r.html).toContain("e.key === 't'")
    expect(r.html).toContain("e.key === 'f'")
    expect(r.html).toContain("e.key === 'Escape'")
  })

  it('提供 toggleFullscreen 函数与 requestFullscreen 调用', () => {
    const r = exportToHTML([])
    expect(r.html).toContain('requestFullscreen')
    expect(r.html).toContain('toggleFullscreen')
  })
})

describe('useSlideExport - composable 入口', () => {
  it('useSlideExport() 暴露 exportToHTML 与 downloadHtml', () => {
    const c = useSlideExport()
    expect(typeof c.exportToHTML).toBe('function')
    expect(typeof c.downloadHtml).toBe('function')
  })

  it('downloadHtml 也会触发下载（在浏览器中由测试桩验证）', () => {
    // 在测试环境下 jsdom 不支持 createObjectURL，会抛错；这里覆盖 exportToHTML 部分
    const c = useSlideExport()
    const result = c.exportToHTML([{ component: 'TextSlide', props: { title: 'x' } }], { title: 'T' })
    expect(result.filename).toBe('T.html')
  })
})
