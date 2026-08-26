/**
 * pptx-import.js - PowerPoint (.pptx) → WPX SlideDeck slides 解析器
 *
 * 有损导入：提取每页标题 / 正文要点 / 表格 / 图片 / 图表，映射到
 * CoverSlide / TextSlide / TableSlide / ImageTextSlide / ChartSlide / EndSlide。
 * 动画、母版、备注与精确布局忽略。
 *
 * 依赖：jszip（根 package.json 已有）。不引入额外 XML 解析库，用轻量正则。
 *
 * @module pptx-import
 */
'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const JSZip = require('jszip')

const SUPPORTED_EXTS = new Set(['.pptx'])

/** 单张图片最大体积（字节），超出则跳过并警告 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
}

/**
 * 解码 XML 实体与常见转义
 * @param {string} raw
 * @param {{ trim?: boolean }} [opts]
 */
function decodeXmlEntities(raw, opts = {}) {
  if (raw == null) return ''
  let s = String(raw)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\u00a0/g, ' ')
  if (opts.trim !== false) s = s.trim()
  return s
}

/**
 * 从 XML 片段中按顺序提取全部 <a:t> 文本
 * @param {string} xml
 * @param {{ trim?: boolean }} [opts]
 * @returns {string[]}
 */
function extractTextRuns(xml, opts = {}) {
  if (!xml) return []
  const shouldTrim = opts.trim !== false
  const runs = []
  const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const text = decodeXmlEntities(m[1], { trim: shouldTrim })
    if (text) runs.push(text)
  }
  return runs
}

/**
 * @param {string} xml
 * @returns {string[]}
 */
function extractParagraphTexts(xml) {
  if (!xml) return []
  const paragraphs = []
  const paraRe = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g
  let m
  while ((m = paraRe.exec(xml)) !== null) {
    const runs = extractTextRuns(m[1], { trim: false })
    if (!runs.length) continue
    const joined = runs.join('').replace(/\s+/g, ' ').trim()
    if (joined) paragraphs.push(joined)
  }
  if (!paragraphs.length) {
    return extractTextRuns(xml)
  }
  return paragraphs
}

function isTitleShape(shapeXml) {
  if (!shapeXml) return false
  return /<p:ph\b[^>]*\btype="(?:title|ctrTitle)"/i.test(shapeXml)
}

function isSubtitleShape(shapeXml) {
  if (!shapeXml) return false
  return /<p:ph\b[^>]*\btype="subTitle"/i.test(shapeXml)
}

function splitShapes(slideXml) {
  const shapes = []
  const re = /<p:sp\b[\s\S]*?<\/p:sp>/g
  let m
  while ((m = re.exec(slideXml)) !== null) {
    shapes.push(m[0])
  }
  return shapes
}

function extractFirstTable(slideXml) {
  const tblMatch = slideXml.match(/<a:tbl\b[\s\S]*?<\/a:tbl>/)
  if (!tblMatch) return null
  const tbl = tblMatch[0]
  const rows = []
  const rowRe = /<a:tr\b[\s\S]*?<\/a:tr>/g
  let rm
  while ((rm = rowRe.exec(tbl)) !== null) {
    const cells = []
    const cellRe = /<a:tc\b[\s\S]*?<\/a:tc>/g
    let cm
    while ((cm = cellRe.exec(rm[0])) !== null) {
      const texts = extractParagraphTexts(cm[0])
      cells.push(texts.join(' ').trim() || '')
    }
    if (cells.length) rows.push(cells)
  }
  if (rows.length < 1) return null
  const headers = rows[0].map((c) => String(c))
  const body = rows.slice(1).map((r) => {
    const normalized = [...r]
    while (normalized.length < headers.length) normalized.push('')
    return normalized.slice(0, headers.length).map((c) => String(c))
  })
  return { headers, rows: body }
}

/**
 * @param {string} relsXml
 * @returns {Map<string, { target: string, type: string }>}
 */
function parseRelsMap(relsXml) {
  const map = new Map()
  if (!relsXml) return map
  const re = /<Relationship\b[^>]*>/g
  let m
  while ((m = re.exec(relsXml)) !== null) {
    const tag = m[0]
    const id = /Id="([^"]+)"/.exec(tag)?.[1]
    const target = /Target="([^"]+)"/.exec(tag)?.[1]
    const type = /Type="([^"]+)"/.exec(tag)?.[1] || ''
    if (!id || !target) continue
    map.set(id, { target: target.replace(/\\/g, '/'), type })
  }
  return map
}

/**
 * @param {string} slideXml
 * @returns {string[]}
 */
function collectImageEmbedIds(slideXml) {
  if (!slideXml) return []
  const ids = []
  const seen = new Set()
  const re = /<(?:a:blip|p:blip)\b[^>]*\br:embed="([^"]+)"/gi
  let m
  while ((m = re.exec(slideXml)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

/**
 * @param {string} slideXml
 * @returns {string[]}
 */
function collectChartEmbedIds(slideXml) {
  if (!slideXml) return []
  const ids = []
  const seen = new Set()
  const re = /<(?:c:chart|cx:chart)\b[^>]*\br:id="([^"]+)"/gi
  let m
  while ((m = re.exec(slideXml)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_MIME[ext] || null
}

/**
 * @param {import('jszip')} zip
 * @param {string} filePath
 */
async function resolveZipEntry(zip, filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  let entry = zip.file(normalized)
  if (!entry) {
    const lower = normalized.toLowerCase()
    const name = Object.keys(zip.files).find((k) => k.toLowerCase() === lower)
    if (name) entry = zip.file(name)
  }
  return entry || null
}

async function readZipText(zip, filePath) {
  const entry = await resolveZipEntry(zip, filePath)
  if (!entry) return null
  return entry.async('string')
}

/**
 * @param {import('jszip')} zip
 * @param {string} zipPath
 * @param {string[]} warnings
 * @returns {Promise<string|null>}
 */
async function readZipImageDataUrl(zip, zipPath, warnings) {
  const mime = mimeFromPath(zipPath)
  if (!mime) {
    warnings.push(`跳过不支持的图片格式：${path.basename(zipPath)}`)
    return null
  }
  const entry = await resolveZipEntry(zip, zipPath)
  if (!entry) {
    warnings.push(`找不到图片资源：${zipPath}`)
    return null
  }
  const buf = await entry.async('nodebuffer')
  if (!buf || !buf.length) return null
  if (buf.length > MAX_IMAGE_BYTES) {
    warnings.push(
      `图片过大已跳过（>${MAX_IMAGE_BYTES / 1024 / 1024}MB）：${path.basename(zipPath)}`,
    )
    return null
  }
  return `data:${mime};base64,${buf.toString('base64')}`
}

/**
 * @param {string} xmlFragment
 * @returns {string[]}
 */
function extractChartPtValues(xmlFragment) {
  if (!xmlFragment) return []
  const pts = []
  const re = /<c:pt\b[^>]*\bidx="(\d+)"[^>]*>\s*<c:v>([\s\S]*?)<\/c:v>/gi
  let m
  while ((m = re.exec(xmlFragment)) !== null) {
    pts.push({ idx: Number(m[1]), value: decodeXmlEntities(m[2]) })
  }
  pts.sort((a, b) => a.idx - b.idx)
  return pts.map((p) => p.value)
}

/**
 * @param {string} chartXml
 * @returns {{ chartType: 'bar'|'line'|'pie', chartData: object } | null}
 */
function parseChartXml(chartXml) {
  if (!chartXml) return null

  let chartType = 'bar'
  if (/<c:pieChart\b/i.test(chartXml) || /<c:doughnutChart\b/i.test(chartXml)) {
    chartType = 'pie'
  } else if (/<c:lineChart\b/i.test(chartXml) || /<c:areaChart\b/i.test(chartXml)) {
    chartType = 'line'
  } else if (/<c:barChart\b/i.test(chartXml) || /<c:colChart\b/i.test(chartXml)) {
    chartType = 'bar'
  }

  const seriesBlocks = []
  const serRe = /<c:ser\b[\s\S]*?<\/c:ser>/gi
  let sm
  while ((sm = serRe.exec(chartXml)) !== null) {
    seriesBlocks.push(sm[0])
  }
  if (!seriesBlocks.length) return null

  /** @type {string[]} */
  let categories = []
  const series = []

  for (let i = 0; i < seriesBlocks.length; i++) {
    const ser = seriesBlocks[i]
    const txMatch = /<c:tx\b[\s\S]*?<\/c:tx>/i.exec(ser)
    const namePts = txMatch ? extractChartPtValues(txMatch[0]) : []
    const name =
      namePts[0] || extractTextRuns(txMatch?.[0] || '')[0] || `系列 ${i + 1}`

    const catMatch = /<c:cat\b[\s\S]*?<\/c:cat>/i.exec(ser)
    if (catMatch && !categories.length) {
      categories = extractChartPtValues(catMatch[0])
    }

    const valMatch = /<c:val\b[\s\S]*?<\/c:val>/i.exec(ser)
    const values = valMatch
      ? extractChartPtValues(valMatch[0]).map((v) => Number(v) || 0)
      : []

    series.push({ name, data: values })
  }

  if (!series.length) return null

  if (chartType === 'pie') {
    const first = series[0]
    const labels = categories.length
      ? categories
      : first.data.map((_, i) => `项 ${i + 1}`)
    return {
      chartType: 'pie',
      chartData: {
        categories: labels,
        series: [
          {
            name: first.name,
            data: first.data.map((value, i) => ({
              name: labels[i] || `项 ${i + 1}`,
              value,
            })),
          },
        ],
      },
    }
  }

  if (!categories.length) {
    const len = Math.max(...series.map((s) => s.data.length), 0)
    categories = Array.from({ length: len }, (_, i) => String(i + 1))
  }

  return {
    chartType,
    chartData: { categories, series },
  }
}

/**
 * @param {import('jszip')} zip
 * @param {string} slideXml
 * @param {Map<string, { target: string, type: string }>} rels
 * @param {string} slideDir
 * @param {string[]} warnings
 */
async function loadSlideImages(zip, slideXml, rels, slideDir, warnings) {
  const ids = collectImageEmbedIds(slideXml)
  const urls = []
  for (const id of ids) {
    const rel = rels.get(id)
    if (!rel) continue
    const zipPath = resolveZipPath(rel.target, slideDir)
    const dataUrl = await readZipImageDataUrl(zip, zipPath, warnings)
    if (dataUrl) urls.push(dataUrl)
  }
  return urls
}

/**
 * @param {import('jszip')} zip
 * @param {string} slideXml
 * @param {Map<string, { target: string, type: string }>} rels
 * @param {string} slideDir
 * @param {string[]} warnings
 */
async function loadSlideChart(zip, slideXml, rels, slideDir, warnings) {
  const ids = collectChartEmbedIds(slideXml)
  if (!ids.length) {
    for (const [id, rel] of rels) {
      if (/\/chart$/i.test(rel.type) || /charts\/chart/i.test(rel.target)) {
        ids.push(id)
      }
    }
  }
  for (const id of ids) {
    const rel = rels.get(id)
    if (!rel) continue
    const zipPath = resolveZipPath(rel.target, slideDir)
    const xml = await readZipText(zip, zipPath)
    if (!xml) {
      warnings.push(`找不到图表资源：${rel.target}`)
      continue
    }
    const parsed = parseChartXml(xml)
    if (parsed) return parsed
    warnings.push(`无法解析图表数据：${path.basename(rel.target)}`)
  }
  return null
}

function parseSlideXml(slideXml) {
  const shapes = splitShapes(slideXml)
  let title = ''
  let subtitle = ''
  const bodyParas = []

  for (const shape of shapes) {
    const paras = extractParagraphTexts(shape)
    if (!paras.length) continue
    if (isTitleShape(shape) && !title) {
      title = paras[0]
      if (paras.length > 1) bodyParas.push(...paras.slice(1))
      continue
    }
    if (isSubtitleShape(shape) && !subtitle) {
      subtitle = paras.join(' ')
      continue
    }
    bodyParas.push(...paras)
  }

  if (!title && bodyParas.length) {
    title = bodyParas.shift() || ''
  }

  const table = extractFirstTable(slideXml)
  const allTexts = extractParagraphTexts(slideXml)

  const bullets = bodyParas.filter((p) => {
    if (!p) return false
    if (p === title || p === subtitle) return false
    return true
  })

  return {
    title,
    subtitle,
    bullets,
    table,
    allTexts,
    images: /** @type {string[]} */ ([]),
    chart: /** @type {{ chartType: string, chartData: object } | null} */ (null),
  }
}

function looksLikeEndSlide(parsed, index, total) {
  if (total <= 1 || index !== total - 1) return false
  const blob = [parsed.title, ...parsed.bullets, ...parsed.allTexts].join(' ')
  return (
    /感谢|谢谢|谢谢观看|Thank\s*you|Q\s*&\s*A|问答|结束/i.test(blob) &&
    parsed.bullets.length <= 3
  )
}

/**
 * 优先级：图表 > 图片 > 表格 > 封面/结束/文本
 */
function mapToSlideComponent(parsed, index, total, theme) {
  const images = Array.isArray(parsed.images) ? parsed.images : []
  const chart = parsed.chart

  if (chart?.chartData) {
    return {
      component: 'ChartSlide',
      props: {
        title: parsed.title || `图表 ${index + 1}`,
        chartType: chart.chartType || 'bar',
        chartData: chart.chartData,
        theme,
      },
    }
  }

  if (images.length) {
    if (index === 0 && parsed.bullets.length <= 2 && !parsed.table) {
      return {
        component: 'CoverSlide',
        props: {
          title: parsed.title || '未命名演示文稿',
          subtitle: parsed.subtitle || parsed.bullets[0] || '',
          backgroundImage: images[0],
          theme,
        },
      }
    }
    return {
      component: 'ImageTextSlide',
      props: {
        title: parsed.title || `第 ${index + 1} 页`,
        text:
          parsed.bullets.length > 0
            ? parsed.bullets.join('\n\n')
            : parsed.subtitle || '',
        imageUrl: images[0],
        imagePosition: 'right',
        theme,
      },
    }
  }

  if (parsed.table && parsed.table.headers.length) {
    return {
      component: 'TableSlide',
      props: {
        title: parsed.title || `表格 ${index + 1}`,
        headers: parsed.table.headers,
        rows: parsed.table.rows,
        theme,
      },
    }
  }

  if (index === 0 && total >= 1 && parsed.bullets.length <= 2) {
    return {
      component: 'CoverSlide',
      props: {
        title: parsed.title || '未命名演示文稿',
        subtitle: parsed.subtitle || parsed.bullets[0] || '',
        theme,
      },
    }
  }

  if (looksLikeEndSlide(parsed, index, total)) {
    return {
      component: 'EndSlide',
      props: {
        text: parsed.title || parsed.bullets[0] || '感谢观看',
        theme,
      },
    }
  }

  const layout = parsed.bullets.length > 1 ? 'list' : 'paragraph'
  return {
    component: 'TextSlide',
    props: {
      title: parsed.title || `第 ${index + 1} 页`,
      bulletPoints: parsed.bullets.length
        ? parsed.bullets
        : parsed.subtitle
          ? [parsed.subtitle]
          : [],
      layout,
      theme,
    },
  }
}

function parsePresentationRels(relsXml) {
  const map = new Map()
  for (const [id, rel] of parseRelsMap(relsXml)) {
    if (!/slide$/i.test(rel.type) && !/slides\/slide/i.test(rel.target)) continue
    map.set(id, rel.target)
  }
  return map
}

function listSlideRIds(presentationXml) {
  const ids = []
  if (!presentationXml) return ids
  const re = /<p:sldId\b[^>]*\br:id="([^"]+)"/g
  let m
  while ((m = re.exec(presentationXml)) !== null) {
    ids.push(m[1])
  }
  return ids
}

function resolveZipPath(relPath, baseDir = 'ppt') {
  let p = String(relPath || '').replace(/\\/g, '/')
  if (p.startsWith('/')) p = p.slice(1)
  if (p.startsWith('../') || p.startsWith('./')) {
    return path.posix.normalize(path.posix.join(baseDir, p))
  }
  if (p.startsWith('ppt/')) return p
  return path.posix.join(baseDir, p)
}

/**
 * @param {string} filePath
 * @param {{ theme?: 'light'|'dark', maxSlides?: number }} [options]
 */
async function pptxFileToSlides(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new Error(`不支持的格式 ${ext}。请将文件另存为 .pptx 后再打开。`)
  }

  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const maxSlides = Number.isFinite(options.maxSlides) ? options.maxSlides : 200
  const warnings = [
    'PPTX 导入为有损转换：动画、母版、备注与精确布局不会保留；图片与图表会尽量保留。',
  ]

  const buf = await fsp.readFile(filePath)
  const zip = await JSZip.loadAsync(buf)

  const presentationXml = await readZipText(zip, 'ppt/presentation.xml')
  if (!presentationXml) {
    throw new Error('无效的 PPTX：缺少 ppt/presentation.xml')
  }

  const relsXml = await readZipText(zip, 'ppt/_rels/presentation.xml.rels')
  const relMap = parsePresentationRels(relsXml || '')
  const rIds = listSlideRIds(presentationXml)

  let slidePaths = rIds.map((id) => relMap.get(id)).filter(Boolean)

  if (!slidePaths.length) {
    slidePaths = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => {
        const na = Number(/slide(\d+)/i.exec(a)?.[1] || 0)
        const nb = Number(/slide(\d+)/i.exec(b)?.[1] || 0)
        return na - nb
      })
    if (slidePaths.length) {
      warnings.push('未能从 presentation.xml 解析幻灯片顺序，已按文件名回退。')
    }
  }

  if (!slidePaths.length) {
    throw new Error('PPTX 中未找到任何幻灯片')
  }

  if (slidePaths.length > maxSlides) {
    warnings.push(`幻灯片超过 ${maxSlides} 页，仅导入前 ${maxSlides} 页。`)
    slidePaths = slidePaths.slice(0, maxSlides)
  }

  const parsedList = []
  let imageCount = 0
  let chartCount = 0

  for (const rel of slidePaths) {
    const zipPath = resolveZipPath(rel, 'ppt')
    const xml = await readZipText(zip, zipPath)
    if (!xml) {
      warnings.push(`跳过缺失幻灯片：${rel}`)
      continue
    }

    const slideDir = path.posix.dirname(zipPath)
    const slideBase = path.posix.basename(zipPath)
    const relsPath = path.posix.join(slideDir, '_rels', `${slideBase}.rels`)
    const slideRelsXml = await readZipText(zip, relsPath)
    const slideRels = parseRelsMap(slideRelsXml || '')

    const parsed = parseSlideXml(xml)
    parsed.images = await loadSlideImages(zip, xml, slideRels, slideDir, warnings)
    parsed.chart = await loadSlideChart(zip, xml, slideRels, slideDir, warnings)
    imageCount += parsed.images.length
    if (parsed.chart) chartCount += 1
    parsedList.push(parsed)
  }

  if (!parsedList.length) {
    throw new Error('无法解析 PPTX 中的幻灯片内容')
  }

  const total = parsedList.length
  const slides = parsedList.map((p, i) => mapToSlideComponent(p, i, total, theme))

  if (imageCount) warnings.push(`已导入 ${imageCount} 张图片。`)
  if (chartCount) warnings.push(`已导入 ${chartCount} 个图表。`)

  const title =
    slides[0]?.props?.title || path.basename(filePath, ext) || '未命名演示文稿'

  return {
    slides,
    warnings,
    slideCount: slides.length,
    title,
    imageCount,
    chartCount,
  }
}

function isPptxFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  const ext = path.extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTS.has(ext)) return false
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

module.exports = {
  SUPPORTED_EXTS,
  pptxFileToSlides,
  isPptxFile,
  decodeXmlEntities,
  extractTextRuns,
  extractParagraphTexts,
  parseSlideXml,
  mapToSlideComponent,
  parsePresentationRels,
  listSlideRIds,
  extractFirstTable,
  parseChartXml,
  collectImageEmbedIds,
  collectChartEmbedIds,
  parseRelsMap,
}
