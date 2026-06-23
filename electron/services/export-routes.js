const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { app } = require('electron')
const fontService = require('../font-service')
const {
  embedFontsInDocx,
  injectHtmlFontFaces,
  buildPdfHeaderIncludes,
} = require('./export-font-embedder')

const PANDOC_INSTALL_HINT =
  '请先安装 Pandoc：https://pandoc.org/installing.html。' +
  'Windows 可使用 choco install pandoc，或从官网下载安装包。' +
  '导出 PDF 还需安装 LaTeX 引擎（如 MiKTeX）。' +
  '也可将 Pandoc 放入应用 resources/bin/pandoc/ 目录一并打包。'

const SUPPORTED_FORMATS = {
  docx: {
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  pdf: {
    ext: 'pdf',
    mime: 'application/pdf',
  },
  html: {
    ext: 'html',
    mime: 'text/html; charset=utf-8',
  },
}

function resolveBundledPandocPath() {
  if (!app?.isPackaged) return null

  const binaryName = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'
  const candidates = [
    path.join(process.resourcesPath, 'bin', 'pandoc', binaryName),
    path.join(process.resourcesPath, 'pandoc', binaryName),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function resolvePandocPath() {
  if (process.env.PANDOC_PATH) return process.env.PANDOC_PATH

  const bundled = resolveBundledPandocPath()
  if (bundled) return bundled

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Pandoc\\pandoc.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Pandoc', 'pandoc.exe'),
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  }

  return 'pandoc'
}

function resolvePdfEnginePath() {
  if (process.env.PDF_ENGINE_PATH) return process.env.PDF_ENGINE_PATH

  const engineNames = process.env.PDF_ENGINE
    ? [process.env.PDF_ENGINE]
    : ['xelatex', 'pdflatex', 'lualatex']

  if (process.platform === 'win32') {
    for (const name of engineNames) {
      const executable = `${name}.exe`
      const candidates = [
        path.join('E:', 'MiKTeX', 'miktex', 'bin', 'x64', executable),
        path.join('E:', 'MiKTeX', 'miktex', 'bin', executable),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MiKTeX', 'miktex', 'bin', 'x64', executable),
      ]

      for (const year of ['2025', '2024', '2023', '2022']) {
        for (const root of ['C:', 'D:', 'E:']) {
          candidates.push(path.join(`${root}\\texlive\\${year}\\bin\\windows`, executable))
        }
      }

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }

  return engineNames[0]
}

const PANDOC_BIN = resolvePandocPath()
const PDF_ENGINE_BIN = resolvePdfEnginePath()

function getPdfEngineEnv() {
  const binDir = path.dirname(PDF_ENGINE_BIN)
  if (!binDir || binDir === '.' || !fs.existsSync(binDir)) {
    return process.env
  }

  const sep = process.platform === 'win32' ? ';' : ':'
  return { ...process.env, PATH: `${binDir}${sep}${process.env.PATH || ''}` }
}

class PandocNotFoundError extends Error {
  constructor() {
    super('Pandoc 未安装或不在 PATH 中')
    this.name = 'PandocNotFoundError'
  }
}

function isPandocMissingError(error, stderr = '') {
  if (!error) return false
  if (error.code === 'ENOENT') return true
  const msg = `${error.message || ''} ${stderr || ''}`.toLowerCase()
  return (
    msg.includes('enoent') ||
    msg.includes('not recognized') ||
    msg.includes('不是内部或外部命令') ||
    msg.includes('command not found') ||
    msg.includes('cannot find the file')
  )
}

function checkPandocAvailable() {
  return new Promise((resolve) => {
    execFile(PANDOC_BIN, ['--version'], (error) => {
      resolve(!error)
    })
  })
}

function checkPdfEngineAvailable() {
  return new Promise((resolve) => {
    execFile(PDF_ENGINE_BIN, ['--version'], { env: getPdfEngineEnv() }, (error) => {
      resolve(!error)
    })
  })
}

function resolveUserId(req) {
  const headerValue = req.headers['x-wpx-user-id']
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim()
  }

  if (typeof req.body?.user_id === 'string' && req.body.user_id.trim()) {
    return req.body.user_id.trim()
  }

  return 'local-user'
}

function buildPandocInputFormat(contentFormat) {
  if (contentFormat === 'html') return 'html'
  return 'markdown+raw_html'
}

function runPandoc(inputPath, outputPath, format, options = {}) {
  const { subsetFonts = [], contentFormat = 'markdown', headerPath = null } = options
  const pandocInputFormat = buildPandocInputFormat(contentFormat)
  const args = [inputPath, '-f', pandocInputFormat, '-o', outputPath]
  /** @type {NodeJS.ProcessEnv} */
  let env = { ...process.env }

  if ((format === 'pdf' || format === 'docx') && subsetFonts.length > 0) {
    env.WPX_EXPORT_SUBSET_FONTS = subsetFonts.map((item) => item.path).join(path.delimiter)
  }

  if (format === 'pdf') {
    args.push(`--pdf-engine=${PDF_ENGINE_BIN}`)
    if (subsetFonts.length > 0) {
      const primaryFont = subsetFonts[0]?.familyName
      if (primaryFont) {
        args.push('-V', `mainfont=${primaryFont}`)
      }
      if (headerPath) {
        args.push('--include-in-header', headerPath)
      }
    } else if (process.platform === 'win32') {
      args.push('-V', 'mainfont=Microsoft YaHei')
    }
    env = { ...getPdfEngineEnv(), ...env }
  }

  return new Promise((resolve, reject) => {
    execFile(PANDOC_BIN, args, { env }, (error, _stdout, stderr) => {
      if (error) {
        if (isPandocMissingError(error, stderr)) {
          reject(new PandocNotFoundError())
        } else {
          const detail = stderr?.trim() || error.message
          if (
            format === 'pdf' &&
            /pdf-engine.*not found|pdflatex not found|xelatex not found|lualatex not found|Please select a different --pdf-engine/i.test(
              detail,
            )
          ) {
            reject(
              new Error(
                `PDF 转换失败：未找到 LaTeX 引擎。请安装 MiKTeX 或 TeX Live。详情：${detail}`,
              ),
            )
          } else {
            reject(new Error(format === 'pdf' ? `PDF 转换失败：${detail}` : detail))
          }
        }
      } else {
        resolve()
      }
    })
  })
}

async function cleanupDir(dir) {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

function parseExportRequest(req) {
  const content = req.body?.content
  const format = req.body?.format
  const embedFonts = req.body?.embedFonts
  const contentFormat = req.body?.contentFormat

  if (!content || typeof content !== 'string') {
    return { error: '缺少 content 参数（markdown 字符串）' }
  }

  if (!format || !SUPPORTED_FORMATS[format]) {
    return { error: '无效的 format 参数，支持：docx、pdf、html' }
  }

  if (embedFonts !== undefined && !Array.isArray(embedFonts)) {
    return { error: 'embedFonts 必须是数组' }
  }

  if (contentFormat !== undefined && contentFormat !== 'markdown' && contentFormat !== 'html') {
    return { error: 'contentFormat 仅支持 markdown 或 html' }
  }

  return {
    content,
    format,
    embedFonts,
    contentFormat: contentFormat || 'markdown',
    userId: resolveUserId(req),
  }
}

async function handleExport(req, res) {
  const parsed = parseExportRequest(req)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  const { content, format, embedFonts, contentFormat, userId } = parsed
  const formatMeta = SUPPORTED_FORMATS[format]
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wpx-export-'))
  const inputPath = path.join(tempDir, contentFormat === 'html' ? 'input.html' : 'input.md')
  const outputPath = path.join(tempDir, `output.${formatMeta.ext}`)
  const subsetDir = path.join(tempDir, 'fonts')
  let pdfHeaderPath = null

  try {
    fontService.setUserCredentials({ userId })

    /** @type {Awaited<ReturnType<typeof fontService.prepareExportFontSubsets>>} */
    let subsetFonts = []
    const shouldEmbedFonts =
      Array.isArray(embedFonts) &&
      embedFonts.length > 0 &&
      (format === 'pdf' || format === 'docx')

    if (shouldEmbedFonts) {
      subsetFonts = await fontService.prepareExportFontSubsets(embedFonts, subsetDir, { userId })
    }

    let exportContent = content
    if (shouldEmbedFonts && contentFormat === 'html') {
      exportContent = injectHtmlFontFaces(
        content,
        subsetFonts.map((font) => ({
          cssFamily: font.cssFamily || `'WPX-${font.fontId || 'font'}', sans-serif`,
          path: font.path,
        })),
      )
    }

    await fs.promises.writeFile(inputPath, exportContent, 'utf8')

    if (format === 'pdf' && subsetFonts.length > 0) {
      pdfHeaderPath = path.join(tempDir, 'font-header.tex')
      await fs.promises.writeFile(pdfHeaderPath, buildPdfHeaderIncludes(subsetFonts), 'utf8')
    }

    await runPandoc(inputPath, outputPath, format, {
      subsetFonts,
      contentFormat,
      headerPath: pdfHeaderPath,
    })

    if (format === 'docx' && subsetFonts.length > 0) {
      await embedFontsInDocx(
        outputPath,
        subsetFonts.map((font) => ({
          path: font.path,
          familyName: font.familyName || path.basename(font.path, path.extname(font.path)),
          cssFamily: font.cssFamily,
          fontId: font.fontId,
        })),
      )
    }

    res.setHeader('Content-Type', formatMeta.mime)
    res.setHeader('Content-Disposition', `attachment; filename="export.${formatMeta.ext}"`)

    const stream = fs.createReadStream(outputPath)
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: '文件流读取失败', details: err.message })
      }
    })
    stream.on('close', () => cleanupDir(tempDir))
    stream.pipe(res)
  } catch (err) {
    await cleanupDir(tempDir)

    if (err instanceof PandocNotFoundError) {
      return res.status(503).json({
        error: err.message,
        message: PANDOC_INSTALL_HINT,
      })
    }

    return res.status(500).json({
      error: '文档转换失败',
      details: err.message,
    })
  }
}

function registerExportRoutes(app, upload) {
  app.post('/api/export', (req, res, next) => {
    if (req.is('multipart/form-data')) {
      upload.none()(req, res, next)
    } else {
      next()
    }
  }, handleExport)

  app.get('/api/health', async (_req, res) => {
    const pandocAvailable = await checkPandocAvailable()
    const pdfEngineAvailable = await checkPdfEngineAvailable()
    res.json({
      status: 'ok',
      pandoc: pandocAvailable,
      pdfEngine: pdfEngineAvailable,
      pandocPath: PANDOC_BIN,
      formats: Object.keys(SUPPORTED_FORMATS),
      pandocInstallHint: PANDOC_INSTALL_HINT,
    })
  })
}

module.exports = {
  registerExportRoutes,
  checkPandocAvailable,
  checkPdfEngineAvailable,
  PANDOC_INSTALL_HINT,
}
