const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const MAX_UPLOAD_BYTES = Number(process.env.REMOVE_BG_MAX_BYTES) || 20 * 1024 * 1024
const REMBG_RUNNER = path.join(__dirname, 'rembg_runner.py')

let pythonExecutable = null
let pythonRembgAvailable = null
let imglyModulePromise = null

function resolvePythonCandidates() {
  if (process.platform === 'win32') {
    return [
      ['py', ['-3']],
      ['python', []],
      ['python3', []],
    ]
  }

  return [
    ['python3', []],
    ['python', []],
  ]
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr
        reject(error)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function detectPythonRembg() {
  if (pythonRembgAvailable !== null) {
    return { available: pythonRembgAvailable, executable: pythonExecutable }
  }

  for (const [command, prefixArgs] of resolvePythonCandidates()) {
    try {
      await execFileAsync(command, [...prefixArgs, '-c', 'import rembg'], {
        timeout: 8000,
      })
      pythonExecutable = { command, prefixArgs }
      pythonRembgAvailable = true
      return { available: true, executable: pythonExecutable }
    } catch {
      // try next candidate
    }
  }

  pythonExecutable = null
  pythonRembgAvailable = false
  return { available: false, executable: null }
}

async function loadImglyModule() {
  if (!imglyModulePromise) {
    imglyModulePromise = import('@imgly/background-removal')
  }
  return imglyModulePromise
}

async function removeBgWithPython(buffer) {
  const { executable } = await detectPythonRembg()
  if (!executable) {
    throw new Error('Python rembg 不可用')
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wpx-rembg-'))
  const inputPath = path.join(tempDir, 'input.bin')
  const outputPath = path.join(tempDir, 'output.png')

  try {
    await fs.promises.writeFile(inputPath, buffer)
    await execFileAsync(
      executable.command,
      [...executable.prefixArgs, REMBG_RUNNER, inputPath, outputPath],
      { timeout: 120000, maxBuffer: 64 * 1024 * 1024 },
    )
    return fs.promises.readFile(outputPath)
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function removeBgWithImgly(buffer, mimeType = 'image/png') {
  const { removeBackground } = await loadImglyModule()
  const inputBlob = new Blob([buffer], { type: mimeType })
  const resultBlob = await removeBackground(inputBlob, {
    output: { format: 'image/png' },
  })
  const arrayBuffer = await resultBlob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function removeImageBackground(buffer, mimeType) {
  const python = await detectPythonRembg()
  if (python.available) {
    try {
      return { buffer: await removeBgWithPython(buffer), backend: 'python-rembg' }
    } catch (error) {
      console.warn('[remove-bg] Python rembg failed, falling back to imgly:', error.message)
    }
  }

  return { buffer: await removeBgWithImgly(buffer, mimeType), backend: 'imgly' }
}

function registerRemoveBgRoutes(app, upload) {
  app.get('/api/remove-bg/health', async (_req, res) => {
    const python = await detectPythonRembg()
    let imgly = false
    try {
      await loadImglyModule()
      imgly = true
    } catch {
      imgly = false
    }

    res.json({
      status: 'ok',
      rembg: python.available || imgly,
      pythonRembg: python.available,
      imgly,
      pythonExecutable: python.executable?.command ?? null,
    })
  })

  app.post('/api/remove-bg', upload.single('file'), async (req, res) => {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: '请上传图片文件' })
    }

    const { buffer, mimetype } = req.file
    if (mimetype && !mimetype.startsWith('image/')) {
      return res.status(400).json({ error: '请上传图片文件' })
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        error: `图片过大，最大支持 ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`,
      })
    }

    try {
      const result = await removeImageBackground(buffer, mimetype || 'image/png')
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('X-WPX-Remove-Bg-Backend', result.backend)
      res.send(result.buffer)
    } catch (error) {
      console.error('[remove-bg]', error)
      res.status(500).json({
        error: '去背景失败',
        details: error.message,
        message:
          '请安装 Python rembg（pip install rembg）或确保 @imgly/background-removal 可用。',
      })
    }
  })
}

module.exports = {
  registerRemoveBgRoutes,
  detectPythonRembg,
}
