/**
 * 导出母版纸张布局工具单元测试
 *
 * 运行：npx vitest run --config electron/vitest.config.js export-paper-layout
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  DEFAULT_MARGIN_MM,
  MARGIN_PRESETS_MM,
  MAX_MARGIN_MM,
  MIN_MARGIN_MM,
  PAPER_DIMENSIONS,
  VALID_HEADER_FOOTERS,
  VALID_MARGIN_PRESETS,
  VALID_PAPER_SIZES,
  buildDocxDocumentRelsXml,
  buildDocxDocumentTemplateXml,
  buildDocxFooterXml,
  buildDocxRootRelsXml,
  buildDocxSectPrXml,
  buildDocxStylesXml,
  buildHtmlFitCss,
  buildPdfFitImagesHeader,
  buildPdfGeometryArgs,
  buildPdfHeaderFooterHeader,
  buildPdfHeaderInclude,
  buildPdfPaginationHeader,
  clampMargin,
  normalizeExportOptions,
  normalizePaper,
  resolveHtmlPrintPaperCss,
  resolveMarginsMm,
  twipsFromMm,
  writeDocxReferenceDocx,
} = require('../services/export-paper-layout.js')

const JSZip = require('jszip')

describe('export-paper-layout — normalizePaper', () => {
  it('缺省时回退到 A4 / normal / 20mm / none', () => {
    const paper = normalizePaper()
    expect(paper).toEqual({
      paperSize: 'A4',
      paperMargin: 'normal',
      customMargin: null,
      headerFooter: 'none',
    })
  })

  it('拒绝非法 paperSize / paperMargin / headerFooter 并回退到默认', () => {
    const paper = normalizePaper({
      paperSize: 'XXL',
      paperMargin: 'huge',
      headerFooter: 'whatever',
    })
    expect(paper.paperSize).toBe('A4')
    expect(paper.paperMargin).toBe('normal')
    expect(paper.headerFooter).toBe('none')
  })

  it('接受合法枚举值', () => {
    const paper = normalizePaper({
      paperSize: 'Letter',
      paperMargin: 'wide',
      headerFooter: 'pageNumber',
    })
    expect(paper.paperSize).toBe('Letter')
    expect(paper.paperMargin).toBe('wide')
    expect(paper.headerFooter).toBe('pageNumber')
    expect(paper.customMargin).toBeNull()
  })

  it('custom 边距夹紧到 [0, 100] 并四舍五入', () => {
    const paper = normalizePaper({
      paperMargin: 'custom',
      customMargin: { top: -10, bottom: 500, left: 30.4, right: 'bad' },
    })
    expect(paper.customMargin).toEqual({ top: 0, bottom: 100, left: 30, right: 20 })
  })
})

describe('export-paper-layout — normalizeExportOptions', () => {
  it('autoPaginate/fitImagesToWidth 默认 true，generateToc 默认 false', () => {
    const options = normalizeExportOptions()
    expect(options.autoPaginate).toBe(true)
    expect(options.fitImagesToWidth).toBe(true)
    expect(options.generateToc).toBe(false)
    expect(options.paper.paperSize).toBe('A4')
  })

  it('normalizeExportOptions 接受嵌套 paper 自定义', () => {
    const options = normalizeExportOptions({
      paper: { paperSize: '16K', paperMargin: 'narrow', headerFooter: 'pageNumber' },
      generateToc: true,
    })
    expect(options.paper.paperSize).toBe('16K')
    expect(options.paper.paperMargin).toBe('narrow')
    expect(options.paper.headerFooter).toBe('pageNumber')
    expect(options.generateToc).toBe(true)
  })
})

describe('export-paper-layout — 常量与解析', () => {
  it('枚举值包含所有允许档位', () => {
    expect(VALID_PAPER_SIZES).toEqual(['A4', 'Letter', '16K', 'mobile', 'none'])
    expect(VALID_MARGIN_PRESETS).toEqual(['wide', 'normal', 'narrow', 'custom'])
    expect(VALID_HEADER_FOOTERS).toEqual(['none', 'pageNumber', 'custom'])
  })

  it('每种纸张尺寸都有对应的几何参数与 twips', () => {
    for (const size of VALID_PAPER_SIZES) {
      if (size === 'none') continue
      expect(PAPER_DIMENSIONS[size].pandocName).toBeTruthy()
      expect(PAPER_DIMENSIONS[size].twipsWidth).toBeGreaterThan(0)
      expect(PAPER_DIMENSIONS[size].twipsHeight).toBeGreaterThan(0)
    }
  })

  it('页边距档位映射到 15/20/25 mm', () => {
    expect(MARGIN_PRESETS_MM.wide.top).toBe(25)
    expect(MARGIN_PRESETS_MM.normal.top).toBe(20)
    expect(MARGIN_PRESETS_MM.narrow.top).toBe(15)
  })

  it('twipsFromMm 与边界值', () => {
    expect(twipsFromMm(0)).toBe(0)
    expect(twipsFromMm(25.4)).toBe(1440)
    expect(twipsFromMm(-5)).toBe(0)
  })

  it('clampMargin 在越界/NaN 时回退到默认 20', () => {
    expect(clampMargin(-1)).toBe(MIN_MARGIN_MM)
    expect(clampMargin(200)).toBe(MAX_MARGIN_MM)
    expect(clampMargin(NaN)).toBe(DEFAULT_MARGIN_MM)
    expect(clampMargin('bad')).toBe(DEFAULT_MARGIN_MM)
  })

  it('resolveMarginsMm 返回 normal 默认 / wide / custom', () => {
    expect(resolveMarginsMm({ paperMargin: 'wide' })).toEqual(MARGIN_PRESETS_MM.wide)
    const custom = resolveMarginsMm({ paperMargin: 'custom', customMargin: { top: 5, bottom: 6, left: 7, right: 8 } })
    expect(custom).toEqual({ top: 5, bottom: 6, left: 7, right: 8 })
  })
})

describe('export-paper-layout — PDF 几何参数', () => {
  it('A4 + normal 生成标准 geometry 字符串', () => {
    const args = buildPdfGeometryArgs({ paperSize: 'A4', paperMargin: 'normal' })
    expect(args).toHaveLength(1)
    const [flag, value] = args[0]
    expect(flag).toBe('-V')
    expect(value).toBe('geometry:paper=a4paper,top=20mm,bottom=20mm,left=20mm,right=20mm,hmargin=20mm,20mm')
  })

  it('Letter + wide 生成 letterpaper geometry', () => {
    const args = buildPdfGeometryArgs({ paperSize: 'Letter', paperMargin: 'wide' })
    expect(args[0][1]).toBe('geometry:paper=letterpaper,top=25mm,bottom=25mm,left=25mm,right=25mm,hmargin=25mm,25mm')
  })

  it('16K + narrow 使用 16k 名与 15mm 边距', () => {
    const args = buildPdfGeometryArgs({ paperSize: '16K', paperMargin: 'narrow' })
    expect(args[0][1]).toBe('geometry:paper=16k,top=15mm,bottom=15mm,left=15mm,right=15mm,hmargin=15mm,15mm')
  })

  it('custom 边距使用传入的 customMargin 值', () => {
    const args = buildPdfGeometryArgs({
      paperSize: 'A4',
      paperMargin: 'custom',
      customMargin: { top: 12, bottom: 18, left: 24, right: 30 },
    })
    expect(args[0][1]).toBe('geometry:paper=a4paper,top=12mm,bottom=18mm,left=24mm,right=30mm,hmargin=24mm,30mm')
  })

  it('none 返回空数组', () => {
    expect(buildPdfGeometryArgs({ paperSize: 'none' })).toEqual([])
  })

  it('非法 paperSize 由 normalizePaper 回退到 A4', () => {
    const args = buildPdfGeometryArgs({ paperSize: 'unknown' })
    expect(args[0][1]).toBe('geometry:paper=a4paper,top=20mm,bottom=20mm,left=20mm,right=20mm,hmargin=20mm,20mm')
  })
})

describe('export-paper-layout — PDF 头注入', () => {
  it('headerFooter=none 不输出页码头', () => {
    expect(buildPdfHeaderFooterHeader({ headerFooter: 'none' })).toBeNull()
  })

  it('headerFooter=pageNumber 输出 fancyhdr 与页码居中', () => {
    const header = buildPdfHeaderFooterHeader({ headerFooter: 'pageNumber' })
    expect(header).toContain('\\usepackage{fancyhdr}')
    expect(header).toContain('\\fancyfoot[C]{\\thepage}')
  })

  it('headerFooter=custom 输出 fancyhdr 但不强制页码', () => {
    const header = buildPdfHeaderFooterHeader({ headerFooter: 'custom' })
    expect(header).toContain('\\usepackage{fancyhdr}')
    expect(header).not.toContain('\\fancyfoot[C]')
  })

  it('图片适配头使用 adjustbox + max width', () => {
    expect(buildPdfFitImagesHeader()).toContain('adjustbox')
    expect(buildPdfFitImagesHeader()).toContain('max width=\\linewidth')
  })

  it('分页头包含 widow/club penalty', () => {
    expect(buildPdfPaginationHeader()).toContain('\\widowpenalty=10000')
    expect(buildPdfPaginationHeader()).toContain('\\clubpenalty=10000')
  })

  it('buildPdfHeaderInclude 组合 fit / pagination / headerFooter', () => {
    const header = buildPdfHeaderInclude(
      { headerFooter: 'pageNumber' },
      { autoPaginate: true, fitImagesToWidth: true },
    )
    expect(header).toContain('\\usepackage{fancyhdr}')
    expect(header).toContain('adjustbox')
    expect(header).toContain('\\widowpenalty')
  })

  it('关闭 autoPaginate / fitImagesToWidth 时不输出对应片段', () => {
    const header = buildPdfHeaderInclude(
      { headerFooter: 'none' },
      { autoPaginate: false, fitImagesToWidth: false },
    )
    expect(header).toBeNull()
  })
})

describe('export-paper-layout — docx reference 片段', () => {
  it('sectPr 包含 pgSz / pgMar 且尺寸匹配', () => {
    const sectPr = buildDocxSectPrXml({ paperSize: 'A4', paperMargin: 'normal' })
    expect(sectPr).toContain(`w:w="${PAPER_DIMENSIONS.A4.twipsWidth}"`)
    expect(sectPr).toContain(`w:h="${PAPER_DIMENSIONS.A4.twipsHeight}"`)
    expect(sectPr).toContain('w:pgMar')
    expect(sectPr).toContain('w:top="1134"') // 20mm = 1134 twips
    expect(sectPr).toContain('w:left="1134"')
  })

  it('headerFooter=pageNumber 注入 footerReference', () => {
    const sectPr = buildDocxSectPrXml({ paperSize: 'A4', paperMargin: 'normal', headerFooter: 'pageNumber' })
    expect(sectPr).toContain('w:footerReference')
    expect(sectPr).toContain('rIdWpxFooter')
  })

  it('headerFooter=none 时不输出 footerReference', () => {
    const sectPr = buildDocxSectPrXml({ paperSize: 'A4', paperMargin: 'normal', headerFooter: 'none' })
    expect(sectPr).not.toContain('w:footerReference')
  })

  it('footer xml 包含 PAGE 域', () => {
    const xml = buildDocxFooterXml()
    expect(xml).toContain('<w:ftr')
    expect(xml).toContain('PAGE')
  })

  it('styles xml 包含 docDefaults 与 Normal', () => {
    const xml = buildDocxStylesXml()
    expect(xml).toContain('<w:docDefaults>')
    expect(xml).toContain('w:styleId="Normal"')
  })

  it('document template 包裹 sectPr', () => {
    const xml = buildDocxDocumentTemplateXml({ paperSize: 'A4', paperMargin: 'normal' })
    expect(xml).toContain('<w:document')
    expect(xml).toContain('<w:sectPr')
  })

  it('主包 rels 包含 officeDocument 关系', () => {
    const xml = buildDocxRootRelsXml()
    expect(xml).toContain('rId1')
    expect(xml).toContain('officeDocument')
  })

  it('document rels 在包含页脚时多一项 footer 关系', () => {
    const withFooter = buildDocxDocumentRelsXml(true)
    const withoutFooter = buildDocxDocumentRelsXml(false)
    expect(withFooter).toContain('rIdWpxFooter')
    expect(withoutFooter).not.toContain('rIdWpxFooter')
  })
})

describe('export-paper-layout — writeDocxReferenceDocx', () => {
  /** @type {string} */
  let workDir

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-paper-layout-'))
  })

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true })
  })

  it('生成可解析的 docx，包含 sectPr 与可选页脚', async () => {
    const target = path.join(workDir, 'reference.docx')
    await writeDocxReferenceDocx(target, {
      paperSize: 'A4',
      paperMargin: 'normal',
      headerFooter: 'pageNumber',
    })

    expect(fs.existsSync(target)).toBe(true)
    const zip = await JSZip.loadAsync(await fsp.readFile(target))
    expect(zip.file('word/document.xml')).toBeTruthy()
    expect(zip.file('word/styles.xml')).toBeTruthy()
    expect(zip.file('word/footer1.xml')).toBeTruthy()

    const documentXml = await zip.file('word/document.xml').async('string')
    expect(documentXml).toContain('w:pgSz')
    expect(documentXml).toContain('w:pgMar')
    expect(documentXml).toContain('w:footerReference')

    const relsXml = await zip.file('word/_rels/document.xml.rels').async('string')
    expect(relsXml).toContain('rIdWpxFooter')
  })

  it('headerFooter=none 时不写入 footer1.xml', async () => {
    const target = path.join(workDir, 'reference-nofooter.docx')
    await writeDocxReferenceDocx(target, {
      paperSize: 'A4',
      paperMargin: 'normal',
      headerFooter: 'none',
    })

    const zip = await JSZip.loadAsync(await fsp.readFile(target))
    expect(zip.file('word/footer1.xml')).toBeFalsy()

    const documentXml = await zip.file('word/document.xml').async('string')
    expect(documentXml).not.toContain('w:footerReference')
  })
})

describe('export-paper-layout — HTML CSS', () => {
  it('默认输出图片/表格自适应 + widow/orphan 保护', () => {
    const css = buildHtmlFitCss({ autoPaginate: true, fitImagesToWidth: true })
    expect(css).toContain('img{max-width:100%')
    expect(css).toContain('table{width:100%')
    expect(css).toContain('page-break-inside:avoid')
    expect(css).toContain('@page{margin:0;}')
  })

  it('autoPaginate=false 时不输出分页保护', () => {
    const css = buildHtmlFitCss({ autoPaginate: false, fitImagesToWidth: true })
    expect(css).not.toContain('page-break-inside:avoid')
  })

  it('printPaper=A4 时输出 @page { size: A4; margin: 0 }', () => {
    const css = buildHtmlFitCss({ printPaper: 'A4' })
    expect(css).toContain('@page{size:A4;margin:0;}')
  })

  it('printPaper=Letter 时输出 @page { size: letter; margin: 0 }', () => {
    const css = buildHtmlFitCss({ printPaper: 'Letter' })
    expect(css).toContain('@page{size:letter;margin:0;}')
  })

  it('printPaper=B5 时输出 @page { size: B5; margin: 0 }', () => {
    const css = buildHtmlFitCss({ printPaper: 'B5' })
    expect(css).toContain('@page{size:B5;margin:0;}')
  })

  it('printPaper=none 时仅输出 @page margin，不指定 size', () => {
    const css = buildHtmlFitCss({ printPaper: 'none' })
    expect(css).toContain('@page{margin:0;}')
    expect(css).not.toMatch(/@page\{[^}]*size:/)
  })

  it('printPaper 取未知值时 fallback 到仅 margin，不注入 size', () => {
    const css = buildHtmlFitCss({ printPaper: 'mobile' })
    expect(css).not.toMatch(/@page\{[^}]*size:/)
    expect(css).toContain('@page{margin:0;}')
  })

  it('resolveHtmlPrintPaperCss 白名单映射', () => {
    expect(resolveHtmlPrintPaperCss('A4')).toBe('A4')
    expect(resolveHtmlPrintPaperCss('Letter')).toBe('letter')
    expect(resolveHtmlPrintPaperCss('B5')).toBe('B5')
    expect(resolveHtmlPrintPaperCss('none')).toBeNull()
    expect(resolveHtmlPrintPaperCss('mobile')).toBeNull()
    expect(resolveHtmlPrintPaperCss('16K')).toBeNull()
    expect(resolveHtmlPrintPaperCss(undefined)).toBeNull()
    expect(resolveHtmlPrintPaperCss(null)).toBeNull()
    expect(resolveHtmlPrintPaperCss('')).toBeNull()
  })
})