const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const JSZip = require('jszip')

const FONT_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font'
const FONT_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.obfuscatedFont'

/**
 * @param {string} filePath
 * @returns {string}
 */
function toFileUrl(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/')
  return encodeURI(`file:///${normalized.replace(/^\/+/, '')}`)
}

/**
 * @param {Array<{ cssFamily: string, path: string }>} subsetFonts
 * @returns {string}
 */
function buildHtmlFontFaceStyles(subsetFonts) {
  if (!subsetFonts.length) return ''

  const rules = subsetFonts.map((font) => {
    const src = toFileUrl(font.path)
    return `@font-face { font-family: ${font.cssFamily}; src: url('${src}'); font-display: swap; }`
  })

  return `<style>\n${rules.join('\n')}\n</style>`
}

/**
 * 为 Pandoc HTML 输入注入 @font-face，使 PDF 引擎能加载子集字体。
 *
 * @param {string} html
 * @param {Array<{ cssFamily: string, path: string }>} subsetFonts
 * @returns {string}
 */
function injectHtmlFontFaces(html, subsetFonts) {
  if (!subsetFonts.length) return html

  const styles = buildHtmlFontFaceStyles(subsetFonts)
  const trimmed = String(html || '').trim()

  if (/<html[\s>]/i.test(trimmed)) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${styles}\n`)
    }
    return trimmed.replace(/<html(\s[^>]*)?>/i, (match) => `${match}\n<head>${styles}</head>`)
  }

  return `<!DOCTYPE html><html><head>${styles}</head><body>${trimmed}</body></html>`
}

/**
 * @param {string} xml
 * @returns {number}
 */
function getMaxRelationshipId(xml) {
  const matches = [...String(xml || '').matchAll(/\bId="rId(\d+)"/g)]
  if (!matches.length) return 0
  return Math.max(...matches.map((match) => Number(match[1]) || 0))
}

/**
 * @param {string} xml
 * @param {string} tagName
 * @returns {boolean}
 */
function hasContentTypeOverride(xml, tagName) {
  return xml.includes(`PartName="${tagName}"`)
}

/**
 * @param {string} fontTableXml
 * @param {string} fontName
 * @returns {boolean}
 */
function fontTableHasName(fontTableXml, fontName) {
  const escaped = fontName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<w:font\\s+w:name="${escaped}"`).test(fontTableXml)
}

/**
 * @param {string} fontTableXml
 * @param {string} fontName
 * @param {string} relationshipId
 * @returns {string}
 */
function appendFontTableEntry(fontTableXml, fontName, relationshipId) {
  const entry =
    `<w:font w:name="${fontName}">` +
    `<w:embedRegular r:id="${relationshipId}"/>` +
    `</w:font>`

  if (fontTableHasName(fontTableXml, fontName)) {
    return fontTableXml
  }

  return fontTableXml.replace(/<\/w:fonts>\s*$/, `${entry}</w:fonts>`)
}

/**
 * @typedef {Object} DocxEmbedFont
 * @property {string} path
 * @property {string} familyName
 * @property {string} [cssFamily]
 * @property {string} [fontId]
 */

/**
 * 将子集字体文件写入 DOCX 包并更新 fontTable / 关系 / Content Types。
 *
 * @param {string} docxPath
 * @param {DocxEmbedFont[]} fonts
 * @returns {Promise<void>}
 */
async function embedFontsInDocx(docxPath, fonts) {
  if (!fonts.length) return

  const zip = await JSZip.loadAsync(await fsp.readFile(docxPath))
  const relsPath = 'word/_rels/document.xml.rels'
  const relsFile = zip.file(relsPath)

  if (!relsFile) {
    throw new Error('DOCX 缺少 word/_rels/document.xml.rels，无法嵌入字体')
  }

  let relsXml = await relsFile.async('string')
  let contentTypesXml = (await zip.file('[Content_Types].xml')?.async('string')) || ''
  let fontTableXml =
    (await zip.file('word/fontTable.xml')?.async('string')) ||
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"></w:fonts>'

  let nextRelId = getMaxRelationshipId(relsXml) + 1

  for (const [index, font] of fonts.entries()) {
    const ext = path.extname(font.path).toLowerCase() || '.ttf'
    const zipFontName = `font${index + 1}${ext}`
    const zipFontPath = `word/fonts/${zipFontName}`
    const relationshipId = `rId${nextRelId}`
    nextRelId += 1

    zip.file(zipFontPath, await fsp.readFile(font.path))

    relsXml = relsXml.replace(
      /<\/Relationships>\s*$/,
      `<Relationship Id="${relationshipId}" Type="${FONT_REL_TYPE}" Target="fonts/${zipFontName}"/></Relationships>`,
    )

    const partName = `/word/fonts/${zipFontName}`
    if (!hasContentTypeOverride(contentTypesXml, partName)) {
      contentTypesXml = contentTypesXml.replace(
        /<\/Types>\s*$/,
        `<Override PartName="${partName}" ContentType="${FONT_CONTENT_TYPE}"/></Types>`,
      )
    }

    const names = new Set([font.familyName])
    if (font.cssFamily) names.add(font.cssFamily.replace(/^['"]|['"]$/g, ''))
    if (font.fontId) names.add(`WPX-${font.fontId}`)

    for (const name of names) {
      if (!name) continue
      fontTableXml = appendFontTableEntry(fontTableXml, name, relationshipId)
    }
  }

  zip.file(relsPath, relsXml)
  zip.file('[Content_Types].xml', contentTypesXml)
  zip.file('word/fontTable.xml', fontTableXml)

  const output = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })

  await fsp.writeFile(docxPath, output)
}

/**
 * @param {Array<{ path: string, familyName: string, fontId?: string }>} subsetFonts
 * @returns {string}
 */
function buildPdfHeaderIncludes(subsetFonts) {
  if (!subsetFonts.length) return ''

  const lines = ['\\usepackage{fontspec}']

  for (const [index, font] of subsetFonts.entries()) {
    const fontPath = path.resolve(font.path).replace(/\\/g, '/')
    const family = font.familyName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    lines.push(`\\newfontfamily\\wpxfont${index}{${family}}[Path=${fontPath}]`)
  }

  return `${lines.join('\n')}\n`
}

module.exports = {
  buildHtmlFontFaceStyles,
  injectHtmlFontFaces,
  embedFontsInDocx,
  buildPdfHeaderIncludes,
  toFileUrl,
}
