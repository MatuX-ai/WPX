/**
 * 导出母版纸张布局工具
 *
 * - 集中维护纸张尺寸、页边距档位、Pandoc 几何参数与 docx 模板片段
 * - 提供纯函数构建 PDF geometry args / LaTeX 头 / docx reference 片段
 * - 不修改原始 Pandoc 输入文本，仅注入参数与模板
 */

const fs = require('node:fs')

const PAPER_DIMENSIONS = Object.freeze({
  A4: {
    pandocName: 'a4paper',
    widthMm: 210,
    heightMm: 297,
    twipsWidth: 11906,
    twipsHeight: 16838,
  },
  Letter: {
    pandocName: 'letterpaper',
    widthMm: 216,
    heightMm: 279,
    twipsWidth: 12240,
    twipsHeight: 15840,
  },
  '16K': {
    pandocName: '16k',
    widthMm: 184,
    heightMm: 260,
    twipsWidth: 10429,
    twipsHeight: 14740,
  },
  mobile: {
    pandocName: 'mobile',
    widthMm: 132,
    heightMm: 235,
    twipsWidth: 7500,
    twipsHeight: 13350,
  },
  none: null,
})

const MARGIN_PRESETS_MM = Object.freeze({
  wide: { top: 25, bottom: 25, left: 25, right: 25 },
  normal: { top: 20, bottom: 20, left: 20, right: 20 },
  narrow: { top: 15, bottom: 15, left: 15, right: 15 },
})

const DEFAULT_MARGIN_MM = 20
const MIN_MARGIN_MM = 0
const MAX_MARGIN_MM = 100

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function clampMargin(value) {
  return clampNumber(value, DEFAULT_MARGIN_MM, MIN_MARGIN_MM, MAX_MARGIN_MM)
}

const VALID_PAPER_SIZES = Object.freeze(['A4', 'Letter', '16K', 'mobile', 'none'])
const VALID_MARGIN_PRESETS = Object.freeze(['wide', 'normal', 'narrow', 'custom'])
const VALID_HEADER_FOOTERS = Object.freeze(['none', 'pageNumber', 'custom'])

function normalizePaper(rawPaper) {
  const paper = rawPaper && typeof rawPaper === 'object' ? rawPaper : {}
  const paperSize = VALID_PAPER_SIZES.includes(paper.paperSize) ? paper.paperSize : 'A4'
  const paperMargin = VALID_MARGIN_PRESETS.includes(paper.paperMargin)
    ? paper.paperMargin
    : 'normal'
  const headerFooter = VALID_HEADER_FOOTERS.includes(paper.headerFooter)
    ? paper.headerFooter
    : 'none'

  const customMargin =
    paperMargin === 'custom' && paper.customMargin && typeof paper.customMargin === 'object'
      ? {
          top: clampMargin(paper.customMargin.top),
          bottom: clampMargin(paper.customMargin.bottom),
          left: clampMargin(paper.customMargin.left),
          right: clampMargin(paper.customMargin.right),
        }
      : null

  return {
    paperSize,
    paperMargin,
    customMargin,
    headerFooter,
  }
}

function normalizeExportOptions(rawOptions) {
  const options = rawOptions && typeof rawOptions === 'object' ? rawOptions : {}
  return {
    paper: normalizePaper(options.paper),
    autoPaginate: options.autoPaginate !== false,
    fitImagesToWidth: options.fitImagesToWidth !== false,
    generateToc: Boolean(options.generateToc),
  }
}

function resolveMarginsMm(paper) {
  if (paper.paperMargin === 'custom' && paper.customMargin) {
    return paper.customMargin
  }
  return MARGIN_PRESETS_MM[paper.paperMargin] || MARGIN_PRESETS_MM.normal
}

function resolvePaperDimension(paperSize) {
  return PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.A4
}

/**
 * Pandoc 几何参数：
 * `-V geometry:paper=a4paper,top=20mm,bottom=20mm,left=20mm,right=20mm`
 *
 * 当 paperSize === 'none' 时返回空数组，由 Pandoc 默认值兜底
 */
function buildPdfGeometryArgs(paper) {
  const normalized = normalizePaper(paper)
  if (normalized.paperSize === 'none') return []

  const dim = resolvePaperDimension(normalized.paperSize)
  const margins = resolveMarginsMm(normalized)

  const parts = [`paper=${dim.pandocName}`]
  if (margins) {
    parts.push(`top=${margins.top}mm`)
    parts.push(`bottom=${margins.bottom}mm`)
    parts.push(`left=${margins.left}mm`)
    parts.push(`right=${margins.right}mm`)
    parts.push(`hmargin=${margins.left}mm,${margins.right}mm`)
  }

  return [['-V', `geometry:${parts.join(',')}`]]
}

/**
 * PDF 页码 / 页眉页脚 LaTeX 头：
 * - headerFooter === 'pageNumber' 时输出 pagestyle plain + fancyhdr 页码
 * - headerFooter === 'custom' 时仅输出 fancyhdr 包，留待模板扩展
 */
function buildPdfHeaderFooterHeader(paper) {
  const normalized = normalizePaper(paper)
  if (normalized.headerFooter === 'none') return null

  const lines = ['\\usepackage{fancyhdr}']
  if (normalized.headerFooter === 'pageNumber') {
    lines.push('\\pagestyle{plain}')
    lines.push('\\fancyhf{}')
    lines.push('\\fancyfoot[C]{\\thepage}')
    lines.push('\\renewcommand{\\headrulewidth}{0pt}')
  }
  return `${lines.join('\n')}\n`
}

/**
 * PDF 图片/表格适配：使用 adjustbox 让 \includegraphics 与表格自动缩放到内容宽度。
 */
function buildPdfFitImagesHeader() {
  return (
    '\\usepackage[export]{adjustbox}\n' +
    '\\adjustboxset{max width=\\linewidth}\n'
  )
}

/**
 * PDF 分页 widow/orphan 控制：避免孤行寡行
 */
function buildPdfPaginationHeader() {
  return '\\widowpenalty=10000\n\\clubpenalty=10000\n'
}

/**
 * 组合 PDF include-in-header 文本
 */
function buildPdfHeaderInclude(paper, exportOptions) {
  const parts = []
  const geometry = buildPdfGeometryArgs(paper)
  if (geometry.length > 0) {
    // geometry 通过 -V 注入，无需 header
    void geometry
  }
  const headerFooter = buildPdfHeaderFooterHeader(paper)
  if (headerFooter) parts.push(headerFooter)
  if (exportOptions?.fitImagesToWidth !== false) {
    parts.push(buildPdfFitImagesHeader())
  }
  if (exportOptions?.autoPaginate !== false) {
    parts.push(buildPdfPaginationHeader())
  }
  return parts.length ? `${parts.join('\n')}\n` : null
}

/**
 * 生成 docx reference.docx 中的 sectPr 片段（页面尺寸、页边距、页脚引用）
 */
function buildDocxSectPrXml(paper) {
  const normalized = normalizePaper(paper)
  const dim = normalized.paperSize === 'none' ? PAPER_DIMENSIONS.A4 : resolvePaperDimension(normalized.paperSize)
  const margins = resolveMarginsMm(normalized)
  if (!dim || !margins) return ''

  const marginTop = twipsFromMm(margins.top)
  const marginBottom = twipsFromMm(margins.bottom)
  const marginLeft = twipsFromMm(margins.left)
  const marginRight = twipsFromMm(margins.right)
  const header = twipsFromMm(Math.max(8, Math.round((margins.top || 12) / 2)))
  const footer = twipsFromMm(Math.max(8, Math.round((margins.bottom || 12) / 2)))

  const footerReference = normalized.headerFooter === 'pageNumber'
    ? '<w:footerReference w:type="default" r:id="rIdWpxFooter"/>'
    : ''

  return (
    `<w:sectPr>` +
    `${footerReference}` +
    `<w:pgSz w:w="${dim.twipsWidth}" w:h="${dim.twipsHeight}" w:orient="portrait"/>` +
    `<w:pgMar w:top="${marginTop}" w:right="${marginRight}" w:bottom="${marginBottom}" w:left="${marginLeft}" w:header="${header}" w:footer="${footer}" w:gutter="0"/>` +
    `<w:cols w:space="720"/>` +
    `<w:docGrid w:linePitch="360"/>` +
    `</w:sectPr>`
  )
}

/**
 * 生成 docx reference 中的页脚 XML（仅在 headerFooter === 'pageNumber' 时使用）
 */
function buildDocxFooterXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:instrText xml:space="preserve">PAGE</w:instrText></w:r>` +
    `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
    `</w:p>` +
    `</w:ftr>`
  )
}

/**
 * 生成 docx reference 中的 styles XML（确保图片/表格默认自适应）
 */
function buildDocxStylesXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults>` +
    `<w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/><w:sz w:val="21"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-CN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    `</w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>` +
    `</w:styles>`
  )
}

/**
 * 生成 docx reference 中的 document.xml，仅含最小 sectPr，Pandoc 会填充正文
 */
function buildDocxDocumentTemplateXml(paper) {
  const sectPr = buildDocxSectPrXml(paper)
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body><w:p><w:pPr>${sectPr}</w:pPr></w:p></w:body>` +
    `</w:document>`
  )
}

/**
 * 生成 docx reference 中的 [Content_Types].xml
 */
function buildDocxContentTypesXml() {
  const hasFooter = true
  const footerOverride = hasFooter
    ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
    : ''
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `${footerOverride}` +
    `</Types>`
  )
}

/**
 * 生成 docx reference 中的主 rels（document.xml.rels）
 */
function buildDocxDocumentRelsXml(includeFooter) {
  const footerRel = includeFooter
    ? '<Relationship Id="rIdWpxFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
    : ''
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `${footerRel}` +
    `</Relationships>`
  )
}

/**
 * 主包 _rels/.rels
 */
function buildDocxRootRelsXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`
  )
}

/**
 * HTML 注入：CSS 让图片/表格自适应 + 可选 page-break 控制
 */
function buildHtmlFitCss(exportOptions) {
  const rules = [
    'img,table,figure{box-sizing:border-box;}',
    'img{max-width:100%;height:auto;}',
    'table{width:100%;border-collapse:collapse;}',
    'figure img{max-width:100%;}',
    '@page{margin:0;}',
  ]
  if (exportOptions?.autoPaginate !== false) {
    rules.push('p,li,figure,table{page-break-inside:avoid;orphans:3;widows:3;}')
  }
  return `<style>\n${rules.join('\n')}\n</style>`
}

function twipsFromMm(mm) {
  // 1 mm = 56.6929 twips (1 inch = 25.4 mm = 1440 twips)
  return Math.max(0, Math.round((Number(mm) || 0) * 1440 / 25.4))
}

/**
 * 同步构建 docx reference.docx（包含页面尺寸、页边距、页脚、styles）。
 * 仅依赖 JSZip，不要求后端安装 python-docx。
 *
 * @param {string} outputPath 目标文件路径
 * @param {Object} paper normalizedPaper
 */
function writeDocxReferenceDocx(outputPath, paper) {
  const normalized = normalizePaper(paper)
  const JSZip = require('jszip')
  const zip = new JSZip()

  zip.file('[Content_Types].xml', buildDocxContentTypesXml())
  zip.file('_rels/.rels', buildDocxRootRelsXml())
  zip.file('word/_rels/document.xml.rels', buildDocxDocumentRelsXml(normalized.headerFooter === 'pageNumber'))
  zip.file('word/document.xml', buildDocxDocumentTemplateXml(normalized))
  zip.file('word/styles.xml', buildDocxStylesXml())
  if (normalized.headerFooter === 'pageNumber') {
    zip.file('word/footer1.xml', buildDocxFooterXml())
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  }).then((buffer) => fs.writeFileSync(outputPath, buffer))
}

module.exports = {
  PAPER_DIMENSIONS,
  MARGIN_PRESETS_MM,
  VALID_PAPER_SIZES,
  VALID_MARGIN_PRESETS,
  VALID_HEADER_FOOTERS,
  DEFAULT_MARGIN_MM,
  MIN_MARGIN_MM,
  MAX_MARGIN_MM,
  normalizePaper,
  normalizeExportOptions,
  resolveMarginsMm,
  resolvePaperDimension,
  buildPdfGeometryArgs,
  buildPdfHeaderFooterHeader,
  buildPdfFitImagesHeader,
  buildPdfPaginationHeader,
  buildPdfHeaderInclude,
  buildDocxSectPrXml,
  buildDocxFooterXml,
  buildDocxStylesXml,
  buildDocxDocumentTemplateXml,
  buildDocxContentTypesXml,
  buildDocxDocumentRelsXml,
  buildDocxRootRelsXml,
  buildHtmlFitCss,
  writeDocxReferenceDocx,
  twipsFromMm,
  clampMargin,
}