/**
 * pptx-import.test.js - PPTX → SlideDeck 解析单元测试
 */
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import JSZip from 'jszip'

const {
  decodeXmlEntities,
  extractTextRuns,
  extractParagraphTexts,
  parseSlideXml,
  mapToSlideComponent,
  parsePresentationRels,
  listSlideRIds,
  extractFirstTable,
  pptxFileToSlides,
  parseChartXml,
  collectImageEmbedIds,
} = require('../pptx-import')

describe('pptx-import - 纯函数', () => {
  it('decodeXmlEntities 解码常见实体', () => {
    expect(decodeXmlEntities('A &amp; B &lt;C&gt;')).toBe('A & B <C>')
  })

  it('extractTextRuns 按顺序提取 a:t', () => {
    const xml = '<root><a:t>你好</a:t><a:t>世界</a:t></root>'
    expect(extractTextRuns(xml)).toEqual(['你好', '世界'])
  })

  it('extractParagraphTexts 合并段落内 runs', () => {
    const xml =
      '<a:p><a:r><a:t>Hello</a:t></a:r><a:r><a:t> World</a:t></a:r></a:p>' +
      '<a:p><a:r><a:t>第二段</a:t></a:r></a:p>'
    expect(extractParagraphTexts(xml)).toEqual(['Hello World', '第二段'])
  })

  it('parseSlideXml 识别标题占位符与正文', () => {
    const xml = `
      <p:sld>
        <p:sp>
          <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
          <p:txBody><a:p><a:r><a:t>封面标题</a:t></a:r></a:p></p:txBody>
        </p:sp>
        <p:sp>
          <p:nvSpPr><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr>
          <p:txBody><a:p><a:r><a:t>副标题文案</a:t></a:r></a:p></p:txBody>
        </p:sp>
      </p:sld>`
    const parsed = parseSlideXml(xml)
    expect(parsed.title).toBe('封面标题')
    expect(parsed.subtitle).toBe('副标题文案')
  })

  it('extractFirstTable 解析表头与行', () => {
    const xml = `
      <a:tbl>
        <a:tr><a:tc><a:t>指标</a:t></a:tc><a:tc><a:t>Q1</a:t></a:tc></a:tr>
        <a:tr><a:tc><a:t>收入</a:t></a:tc><a:tc><a:t>100</a:t></a:tc></a:tr>
      </a:tbl>`
    const table = extractFirstTable(xml)
    expect(table.headers).toEqual(['指标', 'Q1'])
    expect(table.rows).toEqual([['收入', '100']])
  })

  it('mapToSlideComponent 首页映射 CoverSlide', () => {
    const slide = mapToSlideComponent(
      { title: '发布会', subtitle: '2026', bullets: [], table: null, allTexts: ['发布会'] },
      0,
      3,
      'light',
    )
    expect(slide.component).toBe('CoverSlide')
    expect(slide.props.title).toBe('发布会')
  })

  it('mapToSlideComponent 结束页映射 EndSlide', () => {
    const slide = mapToSlideComponent(
      { title: '谢谢观看', subtitle: '', bullets: [], table: null, allTexts: ['谢谢观看'] },
      2,
      3,
      'light',
    )
    expect(slide.component).toBe('EndSlide')
  })

  it('mapToSlideComponent 表格映射 TableSlide', () => {
    const slide = mapToSlideComponent(
      {
        title: '数据',
        subtitle: '',
        bullets: [],
        table: { headers: ['A', 'B'], rows: [['1', '2']] },
        allTexts: [],
        images: [],
        chart: null,
      },
      1,
      3,
      'light',
    )
    expect(slide.component).toBe('TableSlide')
    expect(slide.props.headers).toEqual(['A', 'B'])
  })

  it('mapToSlideComponent 有图表时优先 ChartSlide', () => {
    const slide = mapToSlideComponent(
      {
        title: '销售',
        subtitle: '',
        bullets: [],
        table: null,
        allTexts: [],
        images: ['data:image/png;base64,xx'],
        chart: {
          chartType: 'bar',
          chartData: {
            categories: ['Q1', 'Q2'],
            series: [{ name: '收入', data: [1, 2] }],
          },
        },
      },
      1,
      3,
      'light',
    )
    expect(slide.component).toBe('ChartSlide')
    expect(slide.props.chartType).toBe('bar')
  })

  it('mapToSlideComponent 有图片时映射 ImageTextSlide', () => {
    const slide = mapToSlideComponent(
      {
        title: '产品',
        subtitle: '',
        bullets: ['说明文字'],
        table: null,
        allTexts: [],
        images: ['data:image/png;base64,xx'],
        chart: null,
      },
      1,
      3,
      'light',
    )
    expect(slide.component).toBe('ImageTextSlide')
    expect(slide.props.imageUrl).toContain('data:image/png')
  })

  it('parseChartXml 解析柱状图系列', () => {
    const xml = `
      <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
        <c:chart><c:plotArea><c:barChart>
          <c:ser>
            <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>收入</c:v></c:pt></c:strCache></c:strRef></c:tx>
            <c:cat><c:strRef><c:strCache>
              <c:pt idx="0"><c:v>Q1</c:v></c:pt>
              <c:pt idx="1"><c:v>Q2</c:v></c:pt>
            </c:strCache></c:strRef></c:cat>
            <c:val><c:numRef><c:numCache>
              <c:pt idx="0"><c:v>10</c:v></c:pt>
              <c:pt idx="1"><c:v>20</c:v></c:pt>
            </c:numCache></c:numRef></c:val>
          </c:ser>
        </c:barChart></c:plotArea></c:chart>
      </c:chartSpace>`
    const parsed = parseChartXml(xml)
    expect(parsed.chartType).toBe('bar')
    expect(parsed.chartData.categories).toEqual(['Q1', 'Q2'])
    expect(parsed.chartData.series[0].name).toBe('收入')
    expect(parsed.chartData.series[0].data).toEqual([10, 20])
  })

  it('collectImageEmbedIds 提取 blip embed', () => {
    const xml = `<p:pic><a:blip r:embed="rId2"/></p:pic><a:blip r:embed="rId3"/>`
    expect(collectImageEmbedIds(xml)).toEqual(['rId2', 'rId3'])
  })

  it('parsePresentationRels + listSlideRIds 解析顺序', () => {
    const presentation = `
      <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:sldIdLst>
          <p:sldId id="256" r:id="rId2"/>
          <p:sldId id="257" r:id="rId3"/>
        </p:sldIdLst>
      </p:presentation>`
    const rels = `
      <Relationships>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
      </Relationships>`
    expect(listSlideRIds(presentation)).toEqual(['rId2', 'rId3'])
    const map = parsePresentationRels(rels)
    expect(map.get('rId2')).toBe('slides/slide1.xml')
    expect(map.get('rId3')).toBe('slides/slide2.xml')
  })
})

describe('pptx-import - 真实 zip 文件', () => {
  /** @type {string} */
  let tmpDir
  /** @type {string} */
  let pptxPath

  beforeAll(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-pptx-import-'))
    pptxPath = path.join(tmpDir, 'demo.pptx')

    const zip = new JSZip()
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
    )
    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/presentation.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
    <p:sldId id="257" r:id="rId3"/>
  </p:sldIdLst>
</p:presentation>`,
    )
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/slides/slide1.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>产品发布会</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>WPX 2026</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`,
    )
    zip.file(
      'ppt/slides/slide2.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>核心要点</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
      <p:txBody>
        <a:p><a:r><a:t>要点一</a:t></a:r></a:p>
        <a:p><a:r><a:t>要点二</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`,
    )

    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    await fsp.writeFile(pptxPath, buf)
  })

  afterAll(async () => {
    try {
      await fsp.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('pptxFileToSlides 解析出 Cover + Text', async () => {
    const result = await pptxFileToSlides(pptxPath)
    expect(result.slideCount).toBe(2)
    expect(result.slides[0].component).toBe('CoverSlide')
    expect(result.slides[0].props.title).toBe('产品发布会')
    expect(result.slides[0].props.subtitle).toBe('WPX 2026')
    expect(result.slides[1].component).toBe('TextSlide')
    expect(result.slides[1].props.title).toBe('核心要点')
    expect(result.slides[1].props.bulletPoints).toEqual(['要点一', '要点二'])
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('拒绝 .ppt 扩展名', async () => {
    const bad = path.join(tmpDir, 'old.ppt')
    await fsp.writeFile(bad, 'not-a-real-ppt')
    await expect(pptxFileToSlides(bad)).rejects.toThrow(/pptx/)
  })
})

describe('pptx-import - 图片与图表', () => {
  /** @type {string} */
  let tmpDir
  /** @type {string} */
  let pptxPath

  // 1x1 PNG
  const PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  beforeAll(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-pptx-media-'))
    pptxPath = path.join(tmpDir, 'media.pptx')
    const zip = new JSZip()
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
</Types>`,
    )
    zip.file(
      '_rels/.rels',
      `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/presentation.xml',
      `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
    <p:sldId id="257" r:id="rId3"/>
  </p:sldIdLst>
</p:presentation>`,
    )
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/slides/slide1.xml',
      `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>图文页</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:txBody><a:p><a:r><a:t>配图说明</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:pic>
      <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
    </p:pic>
  </p:spTree></p:cSld>
</p:sld>`,
    )
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`,
    )
    zip.file('ppt/media/image1.png', Buffer.from(PNG_B64, 'base64'))

    zip.file(
      'ppt/slides/slide2.xml',
      `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>季度数据</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:graphicFrame>
      <a:graphic><a:graphicData>
        <c:chart r:id="rId2"/>
      </a:graphicData></a:graphic>
    </p:graphicFrame>
  </p:spTree></p:cSld>
</p:sld>`,
    )
    zip.file(
      'ppt/slides/_rels/slide2.xml.rels',
      `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`,
    )
    zip.file(
      'ppt/charts/chart1.xml',
      `<?xml version="1.0"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <c:chart><c:plotArea><c:barChart>
    <c:ser>
      <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>销量</c:v></c:pt></c:strCache></c:strRef></c:tx>
      <c:cat><c:strRef><c:strCache>
        <c:pt idx="0"><c:v>Q1</c:v></c:pt>
        <c:pt idx="1"><c:v>Q2</c:v></c:pt>
      </c:strCache></c:strRef></c:cat>
      <c:val><c:numRef><c:numCache>
        <c:pt idx="0"><c:v>11</c:v></c:pt>
        <c:pt idx="1"><c:v>22</c:v></c:pt>
      </c:numCache></c:numRef></c:val>
    </c:ser>
  </c:barChart></c:plotArea></c:chart>
</c:chartSpace>`,
    )

    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    await fsp.writeFile(pptxPath, buf)
  })

  afterAll(async () => {
    try {
      await fsp.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('导入图片为 ImageTextSlide，图表为 ChartSlide', async () => {
    const result = await pptxFileToSlides(pptxPath)
    expect(result.slideCount).toBe(2)
    expect(result.imageCount).toBe(1)
    expect(result.chartCount).toBe(1)

    // 第 1 页有图：非首页索引逻辑下是 ImageText；index 0 且 bullets<=2 会变 Cover
    expect(['CoverSlide', 'ImageTextSlide']).toContain(result.slides[0].component)
    if (result.slides[0].component === 'CoverSlide') {
      expect(result.slides[0].props.backgroundImage).toMatch(/^data:image\/png;base64,/)
    } else {
      expect(result.slides[0].props.imageUrl).toMatch(/^data:image\/png;base64,/)
    }

    expect(result.slides[1].component).toBe('ChartSlide')
    expect(result.slides[1].props.chartType).toBe('bar')
    expect(result.slides[1].props.chartData.categories).toEqual(['Q1', 'Q2'])
    expect(result.slides[1].props.chartData.series[0].data).toEqual([11, 22])
  })
})
