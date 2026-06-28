const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { app, ipcMain } = require('electron')
const fontService = require('../font-service')

// 源码项目根目录（仅开发模式用于定位 resources/bin/ 下的内置二进制）
const PROJECT_ROOT = path.join(__dirname, '..', '..')

const {
  embedFontsInDocx,
  injectHtmlFontFaces,
  buildPdfHeaderIncludes,
} = require('./export-font-embedder')
const {
  buildDocxFooterXml,
  buildPdfGeometryArgs,
  buildPdfHeaderInclude,
  buildHtmlFitCss,
  normalizeExportOptions,
  writeDocxReferenceDocx,
} = require('./export-paper-layout')
const {
  analyzeLayoutSuggestions,
  applyLayoutSuggestions,
  isAvailable: isAiLayoutAvailable,
} = require('./ai-layout-suggest-service')

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
  if (!app) return null

  const binaryName = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'

  // 打包后：resources/bin/pandoc/ 是 extraResources 的目标位置
  // 开发模式：直接读取源码目录 resources/bin/pandoc/，无需系统安装
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'bin', 'pandoc', binaryName),
        path.join(process.resourcesPath, 'pandoc', binaryName),
      ]
    : [
        path.join(PROJECT_ROOT, 'resources', 'bin', 'pandoc', binaryName),
        path.join(PROJECT_ROOT, 'resources', 'pandoc', binaryName),
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
  const {
    subsetFonts = [],
    contentFormat = 'markdown',
    headerPath = null,
    referenceDocxPath = null,
    geometryArgs = [],
    toc = false,
  } = options
  const pandocInputFormat = buildPandocInputFormat(contentFormat)
  const args = [inputPath, '-f', pandocInputFormat, '-o', outputPath]
  /** @type {NodeJS.ProcessEnv} */
  let env = { ...process.env }

  if (referenceDocxPath) {
    args.push('--reference-doc', referenceDocxPath)
  }

  if (Array.isArray(geometryArgs)) {
    for (const pair of geometryArgs) {
      args.push(...pair)
    }
  }

  if (toc) {
    args.push('--toc')
  }

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
  const rawExportOptions = req.body?.exportOptions

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

  const exportOptions = normalizeExportOptions(rawExportOptions)

  return {
    content,
    format,
    embedFonts,
    contentFormat: contentFormat || 'markdown',
    userId: resolveUserId(req),
    exportOptions,
  }
}

async function handleExport(req, res) {
  const parsed = parseExportRequest(req)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  const { content, format, embedFonts, contentFormat, userId, exportOptions } = parsed
  const formatMeta = SUPPORTED_FORMATS[format]
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wpx-export-'))
  const inputPath = path.join(tempDir, contentFormat === 'html' ? 'input.html' : 'input.md')
  const outputPath = path.join(tempDir, `output.${formatMeta.ext}`)
  const subsetDir = path.join(tempDir, 'fonts')
  let pdfHeaderPath = null
  let referenceDocxPath = null

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

    // 在导出前调用 AI 排版建议（可选；不可用时静默回退）
    if (isAiLayoutAvailable()) {
      try {
        const suggestions = await analyzeLayoutSuggestions(exportContent, exportOptions.paper)
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          exportContent = applyLayoutSuggestions(exportContent, suggestions, format)
        }
      } catch (error) {
        if (process.env.WPX_EXPORT_DEBUG) {
          console.warn('[export-routes] ai layout suggest failed:', error?.message)
        }
      }
    }

    if (shouldEmbedFonts && contentFormat === 'html') {
      exportContent = injectHtmlFontFaces(
        content,
        subsetFonts.map((font) => ({
          cssFamily: font.cssFamily || `'WPX-${font.fontId || 'font'}', sans-serif`,
          path: font.path,
        })),
      )
    } else if (format === 'html' && exportOptions) {
      // HTML 输出直接注入适配 CSS
      const fitCss = buildHtmlFitCss(exportOptions)
      if (/<head[\s>]/i.test(exportContent)) {
        exportContent = exportContent.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${fitCss}\n`)
      } else {
        exportContent = `<head>${fitCss}</head>\n${exportContent}`
      }
    }

    await fs.promises.writeFile(inputPath, exportContent, 'utf8')

    // PDF：组合字体头 + 页眉页脚 + 分页 widow/orphan 控制
    if (format === 'pdf' && (subsetFonts.length > 0 || exportOptions.paper.headerFooter !== 'none' || exportOptions.fitImagesToWidth || exportOptions.autoPaginate)) {
      const headerLines = []
      if (subsetFonts.length > 0) {
        headerLines.push(buildPdfHeaderIncludes(subsetFonts))
      }
      const layoutHeader = buildPdfHeaderInclude(exportOptions.paper, exportOptions)
      if (layoutHeader) {
        headerLines.push(layoutHeader)
      }
      if (headerLines.length > 0) {
        pdfHeaderPath = path.join(tempDir, 'font-header.tex')
        await fs.promises.writeFile(pdfHeaderPath, headerLines.join('\n'), 'utf8')
      }
    }

    // docx：根据纸张参数动态生成 reference.docx（页面尺寸、页边距、页脚）
    if (format === 'docx') {
      referenceDocxPath = path.join(tempDir, 'reference.docx')
      await writeDocxReferenceDocx(referenceDocxPath, exportOptions.paper)
    }

    const geometryArgs = format === 'pdf' ? buildPdfGeometryArgs(exportOptions.paper) : []

    await runPandoc(inputPath, outputPath, format, {
      subsetFonts,
      contentFormat,
      headerPath: pdfHeaderPath,
      referenceDocxPath,
      geometryArgs,
      toc: Boolean(exportOptions.generateToc),
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

/**
 * 注册 'export:ai-layout-suggest' IPC 通道。
 * 渲染层将来可直接通过 window.electronAPI.aiLayoutSuggest(...) 调用。
 * 当前后端默认静默回退（返回空数组），前端 UI 不实现。
 *
 * @param {import('electron').IpcMain} [targetIpcMain]
 */
function registerExportAiLayoutSuggestHandler(targetIpcMain = ipcMain) {
  if (!targetIpcMain || typeof targetIpcMain.handle !== 'function') return

  targetIpcMain.handle('export:ai-layout-suggest', async (_event, payload = {}) => {
    const markdown = typeof payload?.markdown === 'string' ? payload.markdown : ''
    const paper = payload?.paper && typeof payload.paper === 'object' ? payload.paper : null

    if (!markdown) {
      return { suggestions: [], available: false, reason: 'empty markdown' }
    }

    try {
      const suggestions = await analyzeLayoutSuggestions(markdown, paper)
      return {
        suggestions: Array.isArray(suggestions) ? suggestions : [],
        available: isAiLayoutAvailable(),
      }
    } catch (error) {
      return {
        suggestions: [],
        available: false,
        reason: error?.message || 'unknown error',
      }
    }
  })
}

module.exports = {
  registerExportRoutes,
  registerExportAiLayoutSuggestHandler,
  checkPandocAvailable,
  checkPdfEngineAvailable,
  PANDOC_INSTALL_HINT,
}
