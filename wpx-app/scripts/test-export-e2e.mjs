/**
 * 端到端导出测试：验证 PPTX 和 PDF 导出能力
 *
 * 走真实代码路径（非 mock）：
 *  - 加载 utils/slideExport.js
 *  - 加载 composables/useSlideGenerator.js 生成幻灯片
 *  - 调用 exportSlidesAsPptx 真实生成 PPTX 二进制
 *  - 调用 exportSlidesAsPdf 生成可打印 HTML
 *  - 落盘验证文件大小、ZIP 头、幻灯片页数
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outDir = path.join(__dirname, '..', '.test-output')
fs.mkdirSync(outDir, { recursive: true })

let pass = 0
let fail = 0
const logs = []

function ok(name) {
  pass++
  logs.push(`✅ ${name}`)
  console.log(`✅ ${name}`)
}
function ng(name, err) {
  fail++
  logs.push(`❌ ${name}：${err?.message || err}`)
  console.log(`❌ ${name}：${err?.message || err}`)
}

/* ───────── 准备示例数据 ───────── */
const sampleSlides = [
  {
    component: 'CoverSlide',
    props: { title: '测试演示文稿', subtitle: '端到端导出验证', author: 'QA' },
  },
  {
    component: 'TextSlide',
    props: {
      title: '章节一：概述',
      bulletPoints: ['第一条要点', '第二条要点', '第三条要点'],
    },
  },
  {
    component: 'TextSlide',
    props: {
      title: '章节二：方法',
      bulletPoints: ['方法 A', '方法 B'],
    },
  },
  {
    component: 'TableSlide',
    props: {
      title: '数据表',
      tableData: {
        headers: ['项目', '数量', '占比'],
        rows: [
          ['A', '100', '50%'],
          ['B', '60', '30%'],
          ['C', '40', '20%'],
        ],
      },
    },
  },
  {
    component: 'EndSlide',
    props: { text: '感谢观看', contactInfo: { website: 'https://wpx.example' } },
  },
]

/* ───────── 1. PPTX 导出 ───────── */
try {
  const mod = await import('../src/utils/slideExport.js')
  const data = await mod.exportSlidesAsPptx(sampleSlides, {
    theme: 'light',
    title: '端到端导出测试',
  })

  if (!data) throw new Error('exportSlidesAsPptx 返回空')
  const buf = Buffer.from(data)
  const size = buf.byteLength
  if (size < 1000) throw new Error(`PPTX 文件过小：${size} bytes`)

  // 验证 ZIP 头（PPTX 本质是 ZIP）
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`PPTX 头部不是 ZIP 签名：${buf[0].toString(16)} ${buf[1].toString(16)}`)
  }

  // 验证关键 PPTX 文件存在
  const asString = buf.toString('binary')
  const checks = [
    { needle: 'ppt/presentation.xml', name: '含 presentation.xml' },
    { needle: 'ppt/slides/slide1.xml', name: '含 slide1.xml' },
    { needle: 'ppt/slides/slide5.xml', name: '含 slide5.xml（结束页）' },
    { needle: '[Content_Types].xml', name: '含 Content Types' },
  ]
  for (const c of checks) {
    if (!asString.includes(c.needle)) throw new Error(c.name + ' 缺失')
  }

  const pptxPath = path.join(outDir, 'export-test.pptx')
  fs.writeFileSync(pptxPath, buf)
  ok(`PPTX 导出 (${(size / 1024).toFixed(1)} KB) → ${pptxPath}`)
} catch (e) {
  ng('PPTX 导出', e)
}

/* ───────── 2. PDF 导出（生成可打印 HTML） ───────── */
try {
  const mod = await import('../src/utils/slideExport.js')
  // autoPrint:false 让函数直接返回 HTML 字符串，而不是弹打印对话框
  const result = mod.exportSlidesAsPdf(sampleSlides, {
    theme: 'light',
    title: 'PDF 测试',
    autoPrint: false,
  })

  if (!result.ok) throw new Error(`exportSlidesAsPdf 返回 ok=false：${result.error || ''}`)
  if (!result.html) throw new Error('返回 HTML 为空')
  if (!result.html.startsWith('<!doctype html>')) throw new Error('HTML 不是 doctype 开头')

  const checks = [
    { needle: '13.33in 7.5in', name: 'PDF 打印纸张 16:9 横向' },
    { needle: '@media print', name: '含 print 媒体查询' },
    { needle: 'slide-page', name: '含幻灯片容器' },
    { needle: 'page-break-after: always', name: '含分页符' },
    { needle: '感谢观看', name: '含结束页文本' },
    { needle: '数据表', name: '含表格页标题' },
    { needle: '章节一', name: '含章节一' },
  ]
  for (const c of checks) {
    if (!result.html.includes(c.needle)) throw new Error(c.name + ' 缺失')
  }

  const pdfHtmlPath = path.join(outDir, 'export-test-pdf-source.html')
  fs.writeFileSync(pdfHtmlPath, result.html)
  ok(
    `PDF 导出 HTML (${(result.html.length / 1024).toFixed(1)} KB) → ${pdfHtmlPath}（浏览器打开 → 打印 → 另存 PDF）`,
  )
} catch (e) {
  ng('PDF 导出', e)
}

/* ───────── 3. HTML 导出（独立播放器） ───────── */
try {
  const mod = await import('../src/utils/slideExport.js')
  const html = mod.exportSlidesAsHtml(sampleSlides, { theme: 'light', title: 'HTML 测试' })

  const checks = [
    { needle: 'addEventListener', name: '含事件绑定' },
    { needle: 'ArrowLeft', name: '含左方向键翻页' },
    { needle: 'ArrowRight', name: '含右方向键翻页' },
    { needle: '感谢观看', name: '含结束页内容' },
    { needle: '数据表', name: '含表格页' },
  ]
  for (const c of checks) {
    if (!html.includes(c.needle)) throw new Error(c.name + ' 缺失')
  }

  const htmlPath = path.join(outDir, 'export-test.html')
  fs.writeFileSync(htmlPath, html)
  ok(`HTML 导出 (${(html.length / 1024).toFixed(1)} KB) → ${htmlPath}`)
} catch (e) {
  ng('HTML 导出', e)
}

/* ───────── 4. 大纲 → 幻灯片 → PPTX 全链路 ───────── */
try {
  const { outlineToSlides } = await import('../src/composables/useSlideGenerator.js')
  const outline = `# 端到端测试演示
# 背景
- 这是测试大纲
- 用于验证全链路
# 方法
- 方法一
- 方法二
# 结果
- 成功
# 销量趋势图表
- 一月 100
- 二月 200
- 三月 150
- 四月 250`
  const slides = outlineToSlides(outline)
  if (!Array.isArray(slides) || slides.length < 3) {
    throw new Error(`生成幻灯片数量异常：${slides?.length}`)
  }

  const mod = await import('../src/utils/slideExport.js')
  const data = await mod.exportSlidesAsPptx(slides, { theme: 'light' })
  const buf = Buffer.from(data)
  const size = buf.byteLength
  if (size < 1000) throw new Error('全链路 PPTX 过小')

  const e2ePath = path.join(outDir, 'e2e-from-outline.pptx')
  fs.writeFileSync(e2ePath, buf)
  ok(`全链路：outline→slides→PPTX (${slides.length} 页, ${(size / 1024).toFixed(1)} KB) → ${e2ePath}`)
} catch (e) {
  ng('全链路 outline→PPTX', e)
}

/* ───────── 总结 ───────── */
console.log('\n' + '='.repeat(60))
console.log(`通过：${pass} / 失败：${fail} / 总计：${pass + fail}`)
console.log(`输出目录：${outDir}`)
console.log('='.repeat(60))

const summaryPath = path.join(outDir, 'export-test-summary.txt')
fs.writeFileSync(summaryPath, logs.join('\n') + `\n\n通过：${pass} / 失败：${fail}\n`)

process.exit(fail > 0 ? 1 : 0)