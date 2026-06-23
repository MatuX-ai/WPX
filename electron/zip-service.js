const { spawn } = require('node:child_process')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { get7zaPath } = require('./7za-path')

const SUPPORTED_FORMATS = new Set(['7z', 'zip', 'tar'])
const SUPPORTED_LEVELS = new Set([1, 5, 9])
const SUPPORTED_CONFLICT_MODES = new Set(['overwrite', 'skip', 'rename'])
const PROGRESS_PATTERN = /(\d+)%/

/** @type {Map<string, () => boolean>} */
const activeOperations = new Map()

class SevenZipNotFoundError extends Error {
  constructor(binaryPath) {
    super(`7-Zip 命令行工具未找到：${binaryPath}`)
    this.name = 'SevenZipNotFoundError'
    this.binaryPath = binaryPath
  }
}

class ZipSlipError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ZipSlipError'
  }
}

class SevenZipCommandError extends Error {
  /**
   * @param {string} message
   * @param {{ exitCode?: number | null, stdout?: string, stderr?: string }} [details]
   */
  constructor(message, details = {}) {
    super(message)
    this.name = 'SevenZipCommandError'
    this.exitCode = details.exitCode ?? null
    this.stdout = details.stdout ?? ''
    this.stderr = details.stderr ?? ''
  }
}

class CancelledError extends Error {
  constructor(message = '操作已取消') {
    super(message)
    this.name = 'CancelledError'
    this.code = 'CANCELLED'
  }
}

function isCancelledError(error) {
  return error instanceof CancelledError || error?.code === 'CANCELLED'
}

function ensure7zaAvailable() {
  const binaryPath = get7zaPath()
  if (!fs.existsSync(binaryPath)) {
    throw new SevenZipNotFoundError(binaryPath)
  }
  return binaryPath
}

function normalizeArchivePath(entryPath) {
  return String(entryPath || '').replace(/\\/g, '/')
}

/**
 * Reject archive entries that could escape the output directory (Zip Slip).
 * @param {Array<{ name: string }>} entries
 */
function assertSafeArchivePaths(entries) {
  for (const entry of entries) {
    const normalized = normalizeArchivePath(entry.name)

    if (!normalized || normalized === '.') continue

    if (
      normalized.includes('..') ||
      path.isAbsolute(normalized) ||
      normalized.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalized)
    ) {
      throw new ZipSlipError(`检测到不安全的压缩包路径，已拒绝解压：${entry.name}`)
    }
  }
}

function parseProgressChunk(text, onProgress) {
  if (typeof onProgress !== 'function') return

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(PROGRESS_PATTERN)
    if (match) {
      onProgress(Number(match[1]))
    }
  }
}

function killChildProcess(child) {
  if (!child?.pid) return

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    return
  }

  child.kill('SIGTERM')
}

async function cleanupPartialFile(filePath) {
  if (!filePath) return

  try {
    await fsp.rm(filePath, { force: true })
  } catch {
    // ignore cleanup failures
  }
}

async function cleanupPartialExtract(outputDir, outputDirExisted) {
  if (!outputDir || outputDirExisted) return

  try {
    await fsp.rm(outputDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup failures
  }
}

/**
 * @param {string[]} args
 * @param {{ onProgress?: (percent: number) => void, operationId?: string }} [options]
 * @returns {{ promise: Promise<{ stdout: string, stderr: string }>, cancel: () => boolean }}
 */
function run7za(args, options = {}) {
  const { onProgress, operationId, cwd } = options
  const binaryPath = ensure7zaAvailable()

  /** @type {import('node:child_process').ChildProcessWithoutNullStreams | null} */
  let child = null
  let cancelled = false

  const promise = new Promise((resolve, reject) => {
    child = spawn(binaryPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      parseProgressChunk(text, onProgress)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      parseProgressChunk(text, onProgress)
    })

    child.on('error', (error) => {
      if (cancelled) {
        reject(new CancelledError())
        return
      }

      reject(error)
    })

    child.on('close', (code) => {
      if (cancelled) {
        reject(new CancelledError())
        return
      }

      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      const detail = (stderr || stdout || '').trim()
      reject(
        new SevenZipCommandError(
          detail || `7za 命令执行失败（退出码 ${code ?? 'unknown'}）`,
          { exitCode: code, stdout, stderr },
        ),
      )
    })
  })

  function cancel() {
    if (cancelled || !child) return false

    cancelled = true

    if (operationId) {
      activeOperations.delete(operationId)
    }

    killChildProcess(child)
    return true
  }

  return { promise, cancel }
}

/**
 * @param {string} operationId
 * @returns {boolean}
 */
function cancelOperation(operationId) {
  const cancel = activeOperations.get(operationId)
  if (typeof cancel !== 'function') return false
  return cancel()
}

/**
 * @param {string} text
 * @returns {Array<{ name: string, size: number, compressedSize: number, date: string, isDirectory: boolean }>}
 */
function parseSltListing(text) {
  /** @type {Array<{ name: string, size: number, compressedSize: number, date: string, isDirectory: boolean }>} */
  const entries = []
  const blocks = text.split(/^-{10,}/m).filter((block) => block.trim())

  for (const block of blocks) {
    /** @type {Record<string, string>} */
    const fields = {}

    for (const line of block.split(/\r?\n/)) {
      const match = line.match(/^(.+?) = (.*)$/)
      if (!match) continue
      fields[match[1].trim()] = match[2].trim()
    }

    if (!fields.Path) continue

    entries.push({
      name: fields.Path,
      size: Number.parseInt(fields.Size, 10) || 0,
      compressedSize: Number.parseInt(fields['Packed Size'], 10) || 0,
      date: fields.Modified || '',
      isDirectory: fields.Folder === '+',
    })
  }

  return entries
}

function validateCompressInputs(sources, outputPath, options) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError('sources 必须是非空字符串数组')
  }

  for (const source of sources) {
    if (typeof source !== 'string' || !source.trim()) {
      throw new TypeError('sources 中的每个路径必须是非空字符串')
    }
    if (!fs.existsSync(source)) {
      throw new Error(`源路径不存在：${source}`)
    }
  }

  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new TypeError('outputPath 必须是非空字符串')
  }

  const format = options.format ?? '7z'
  const level = options.level ?? 5

  if (!SUPPORTED_FORMATS.has(format)) {
    throw new TypeError(`不支持的压缩格式：${format}`)
  }

  if (!SUPPORTED_LEVELS.has(level)) {
    throw new TypeError(`不支持的压缩级别：${level}`)
  }

  if (options.password != null && typeof options.password !== 'string') {
    throw new TypeError('password 必须是字符串')
  }
}

function validateExtractInputs(archivePath, outputDir, options) {
  if (typeof archivePath !== 'string' || !archivePath.trim()) {
    throw new TypeError('archivePath 必须是非空字符串')
  }

  if (!fs.existsSync(archivePath)) {
    throw new Error(`压缩包不存在：${archivePath}`)
  }

  if (typeof outputDir !== 'string' || !outputDir.trim()) {
    throw new TypeError('outputDir 必须是非空字符串')
  }

  if (options.password != null && typeof options.password !== 'string') {
    throw new TypeError('password 必须是字符串')
  }

  if (options.files != null) {
    if (!Array.isArray(options.files) || options.files.length === 0) {
      throw new TypeError('files 必须是非空字符串数组')
    }

    for (const file of options.files) {
      if (typeof file !== 'string' || !file.trim()) {
        throw new TypeError('files 中的每个路径必须是非空字符串')
      }
    }
  }

  if (options.conflictMode != null && !SUPPORTED_CONFLICT_MODES.has(options.conflictMode)) {
    throw new TypeError(`不支持的冲突处理模式：${options.conflictMode}`)
  }
}

function appendExtractConflictArg(args, conflictMode) {
  if (conflictMode === 'skip') {
    args.push('-aos')
    return
  }

  if (conflictMode === 'rename') {
    args.push('-aou')
    return
  }

  if (conflictMode === 'overwrite') {
    args.push('-aoa')
    return
  }

  args.push('-y')
}

/**
 * @param {string[]} sources
 * @param {string} outputPath
 * @param {{ format?: '7z' | 'zip' | 'tar', level?: 1 | 5 | 9, password?: string, archiveBaseDir?: string, onProgress?: (percent: number) => void, operationId?: string }} [options]
 * @returns {{ promise: Promise<{ outputPath: string }>, cancel: () => boolean }}
 */
function compress(sources, outputPath, options = {}) {
  validateCompressInputs(sources, outputPath, options)

  const format = options.format ?? '7z'
  const level = options.level ?? 5
  const resolvedOutputPath = path.resolve(outputPath)
  const archiveBaseDir = options.archiveBaseDir ? path.resolve(options.archiveBaseDir) : null

  /** @type {string[]} */
  const args = ['a', `-t${format}`, `-mx=${level}`, '-bsp1', '-y', resolvedOutputPath]

  if (options.password) {
    args.push(`-p${options.password}`)
  }

  let spawnCwd
  const resolvedSources = sources.map((source) => path.resolve(source))

  if (archiveBaseDir) {
    spawnCwd = archiveBaseDir
    for (const source of resolvedSources) {
      const relativeSource = path.relative(archiveBaseDir, source)
      if (!relativeSource || relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) {
        throw new Error(`无法在文档目录内解析路径：${source}`)
      }
      args.push(relativeSource)
    }
  } else {
    for (const source of resolvedSources) {
      args.push(source)
    }
  }

  /** @type {{ cancel: () => boolean } | null} */
  let activeRun = null
  let pendingCancel = false

  function cancel() {
    if (activeRun) {
      return activeRun.cancel()
    }

    pendingCancel = true
    return true
  }

  if (options.operationId) {
    activeOperations.set(options.operationId, cancel)
  }

  const promise = (async () => {
    try {
      if (pendingCancel) {
        throw new CancelledError()
      }

      await fsp.mkdir(path.dirname(resolvedOutputPath), { recursive: true })

      if (pendingCancel) {
        throw new CancelledError()
      }

      activeRun = run7za(args, {
        onProgress: options.onProgress,
        operationId: options.operationId,
        cwd: spawnCwd,
      })

      if (pendingCancel) {
        activeRun.cancel()
      }

      await activeRun.promise
      return { outputPath: resolvedOutputPath }
    } catch (error) {
      if (isCancelledError(error)) {
        await cleanupPartialFile(resolvedOutputPath)
      }
      throw error
    } finally {
      if (options.operationId) {
        activeOperations.delete(options.operationId)
      }
    }
  })()

  return { promise, cancel }
}

/**
 * @param {string} archivePath
 * @param {string} outputDir
 * @param {{ password?: string, files?: string[], conflictMode?: 'overwrite' | 'skip' | 'rename', onProgress?: (percent: number) => void, operationId?: string }} [options]
 * @returns {{ promise: Promise<{ outputDir: string }>, cancel: () => boolean }}
 */
function extract(archivePath, outputDir, options = {}) {
  validateExtractInputs(archivePath, outputDir, options)

  const resolvedArchivePath = path.resolve(archivePath)
  const resolvedOutputDir = path.resolve(outputDir)

  /** @type {{ cancel: () => boolean } | null} */
  let activeRun = null
  let pendingCancel = false

  function cancel() {
    if (activeRun) {
      return activeRun.cancel()
    }

    pendingCancel = true
    return true
  }

  if (options.operationId) {
    activeOperations.set(options.operationId, cancel)
  }

  const promise = (async () => {
    let outputDirExisted = fs.existsSync(resolvedOutputDir)

    try {
      if (pendingCancel) {
        throw new CancelledError()
      }

      const entries = await list(resolvedArchivePath)

      assertSafeArchivePaths(entries)

      if (Array.isArray(options.files) && options.files.length > 0) {
        assertSafeArchivePaths(options.files.map((name) => ({ name })))
      }

      if (pendingCancel) {
        throw new CancelledError()
      }

      outputDirExisted = fs.existsSync(resolvedOutputDir)
      await fsp.mkdir(resolvedOutputDir, { recursive: true })

      /** @type {string[]} */
      const args = ['x', resolvedArchivePath, `-o${resolvedOutputDir}`, '-bsp1']
      appendExtractConflictArg(args, options.conflictMode)

      if (options.password) {
        args.push(`-p${options.password}`)
      }

      if (Array.isArray(options.files) && options.files.length > 0) {
        args.push(...options.files)
      }

      if (pendingCancel) {
        throw new CancelledError()
      }

      activeRun = run7za(args, {
        onProgress: options.onProgress,
        operationId: options.operationId,
      })

      if (pendingCancel) {
        activeRun.cancel()
      }

      await activeRun.promise
      return { outputDir: resolvedOutputDir }
    } catch (error) {
      if (isCancelledError(error)) {
        await cleanupPartialExtract(resolvedOutputDir, outputDirExisted)
      }
      throw error
    } finally {
      if (options.operationId) {
        activeOperations.delete(options.operationId)
      }
    }
  })()

  return { promise, cancel }
}

/**
 * @param {string} archivePath
 * @param {{ password?: string }} [options]
 * @returns {Promise<Array<{ name: string, size: number, compressedSize: number, date: string, isDirectory: boolean }>>}
 */
async function list(archivePath, options = {}) {
  if (typeof archivePath !== 'string' || !archivePath.trim()) {
    throw new TypeError('archivePath 必须是非空字符串')
  }

  if (options.password != null && typeof options.password !== 'string') {
    throw new TypeError('password 必须是字符串')
  }

  const resolvedArchivePath = path.resolve(archivePath)
  if (!fs.existsSync(resolvedArchivePath)) {
    throw new Error(`压缩包不存在：${resolvedArchivePath}`)
  }

  /** @type {string[]} */
  const args = ['l', '-slt', resolvedArchivePath]

  if (options.password) {
    args.push(`-p${options.password}`)
  }

  const { promise } = run7za(args)
  const { stdout } = await promise
  return parseSltListing(stdout)
}

module.exports = {
  compress,
  extract,
  list,
  cancelOperation,
  assertSafeArchivePaths,
  appendExtractConflictArg,
  parseSltListing,
  isCancelledError,
  SevenZipNotFoundError,
  ZipSlipError,
  SevenZipCommandError,
  CancelledError,
}
