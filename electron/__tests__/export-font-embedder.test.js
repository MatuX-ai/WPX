/**
 * 导出字体嵌入（DOCX / PDF 辅助逻辑）
 *
 * 运行：npx vitest run --config electron/vitest.config.js export-font-embedder
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const {
  embedFontsInDocx,
  injectHtmlFontFaces,
  buildPdfHeaderIncludes,
} = require('../services/export-font-embedder.js')

async function createMinimalDocx(outputPath) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  )
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
  )
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>测试</w:t></w:r></w:p></w:body></w:document>',
  )

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  await fsp.writeFile(outputPath, buffer)
}

describe('export-font-embedder', () => {
  /** @type {string} */
  let workDir

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-export-embed-'))
  })

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true })
  })

  it('10. DOCX 嵌入子集字体后包含 word/fonts 与 fontTable', async () => {
    const docxPath = path.join(workDir, 'output.docx')
    const fontPath = path.join(workDir, 'subset.ttf')
    await createMinimalDocx(docxPath)
    await fsp.writeFile(fontPath, Buffer.from('fake-font-binary'))

    await embedFontsInDocx(docxPath, [
      {
        path: fontPath,
        familyName: 'WPX Test Font',
        cssFamily: "'WPX-test-font', sans-serif",
        fontId: 'test-font',
      },
    ])

    const zip = await JSZip.loadAsync(await fsp.readFile(docxPath))
    expect(zip.file('word/fonts/font1.ttf')).toBeTruthy()
    expect(zip.file('word/fontTable.xml')).toBeTruthy()

    const fontTable = await zip.file('word/fontTable.xml').async('string')
    expect(fontTable).toContain('WPX-test-font')
    expect(fontTable).toContain('WPX Test Font')
  })

  it('10. PDF 导出 HTML 注入 @font-face 指向子集字体文件', () => {
    const fontPath = path.join(workDir, 'subset.ttf').replace(/\\/g, '/')
    const html = injectHtmlFontFaces('<p>测试</p>', [
      {
        cssFamily: "'WPX-founder-lanting-hei', sans-serif",
        path: fontPath,
      },
    ])

    expect(html).toContain('@font-face')
    expect(html).toContain('WPX-founder-lanting-hei')
    expect(html).toContain(encodeURI(`file:///${fontPath.replace(/^\/+/, '')}`))
  })

  it('10. PDF header 包含 fontspec 与字体路径', () => {
    const fontPath = path.join(workDir, 'subset.ttf')
    fs.writeFileSync(fontPath, 'font')

    const header = buildPdfHeaderIncludes([
      {
        path: fontPath,
        familyName: '方正兰亭黑',
      },
    ])

    expect(header).toContain('\\usepackage{fontspec}')
    expect(header).toContain(path.resolve(fontPath).replace(/\\/g, '/'))
    expect(header).toContain('方正兰亭黑')
  })
})
