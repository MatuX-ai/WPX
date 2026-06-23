import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PORT = Number(process.env.EXPORT_SERVICE_PORT) || 3001

function resolvePandocPath() {
  if (process.env.PANDOC_PATH) return process.env.PANDOC_PATH

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

const PANDOC_BIN = resolvePandocPath()

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

const PDF_ENGINE_BIN = resolvePdfEnginePath()

function getPdfEngineEnv() {
  const binDir = path.dirname(PDF_ENGINE_BIN)
  if (!binDir || binDir === '.' || !fs.existsSync(binDir)) {
    return process.env
  }

  const sep = process.platform === 'win32' ? ';' : ':'
  return { ...process.env, PATH: `${binDir}${sep}${process.env.PATH || ''}` }
}

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

const PANDOC_INSTALL_HINT =
  '请先安装 Pandoc：https://pandoc.org/installing.html。' +
  'Windows 可使用 choco install pandoc，或从官网下载安装包。' +
  '导出 PDF 还需安装 LaTeX 引擎（如 MiKTeX）。'

const app = express()
const upload = multer()

app.use(cors())
app.use(express.json({ limit: '50mb' }))

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

function runPandoc(inputPath, outputPath, format) {
  const args = [inputPath, '-f', 'markdown', '-o', outputPath]
  const options = { env: process.env }

  if (format === 'pdf') {
    args.push(`--pdf-engine=${PDF_ENGINE_BIN}`)
    if (process.platform === 'win32') {
      args.push('-V', 'mainfont=Microsoft YaHei')
    }
    options.env = getPdfEngineEnv()
  }

  return new Promise((resolve, reject) => {
    execFile(PANDOC_BIN, args, options, (error, _stdout, stderr) => {
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

class PandocNotFoundError extends Error {
  constructor() {
    super('Pandoc 未安装或不在 PATH 中')
    this.name = 'PandocNotFoundError'
  }
}

async function cleanupDir(dir) {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore cleanup failures
  }
}

function parseExportRequest(req) {
  const content = req.body?.content
  const format = req.body?.format

  if (!content || typeof content !== 'string') {
    return { error: '缺少 content 参数（markdown 字符串）' }
  }

  if (!format || !SUPPORTED_FORMATS[format]) {
    return { error: '无效的 format 参数，支持：docx、pdf、html' }
  }

  return { content, format }
}

async function handleExport(req, res) {
  const parsed = parseExportRequest(req)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  const { content, format } = parsed
  const formatMeta = SUPPORTED_FORMATS[format]
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wpx-export-'))
  const inputPath = path.join(tempDir, 'input.md')
  const outputPath = path.join(tempDir, `output.${formatMeta.ext}`)

  try {
    await fs.promises.writeFile(inputPath, content, 'utf8')
    await runPandoc(inputPath, outputPath, format)

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

// JSON 或 multipart/form-data：content + format
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
    formats: Object.keys(SUPPORTED_FORMATS),
  })
})

app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

app.use((err, _req, res, _next) => {
  console.error('[export-service]', err)
  res.status(500).json({ error: '服务器内部错误', details: err.message })
})

async function start() {
  const pandocAvailable = await checkPandocAvailable()
  const pdfEngineAvailable = await checkPdfEngineAvailable()
  if (!pandocAvailable) {
    console.warn('[export-service] 警告：未检测到 Pandoc，/api/export 将返回 503')
    console.warn(`[export-service] ${PANDOC_INSTALL_HINT}`)
  }
  if (!pdfEngineAvailable) {
    console.warn('[export-service] 警告：未检测到 PDF 引擎（pdflatex），PDF 导出将失败')
  }

  app.listen(PORT, () => {
    console.log(`[export-service] 运行于 http://localhost:${PORT}`)
    console.log(`[export-service] Pandoc: ${PANDOC_BIN}`)
    console.log(`[export-service] PDF engine: ${PDF_ENGINE_BIN}`)
    console.log(`[export-service] POST /api/export  { content, format }`)
  })
}

start()
