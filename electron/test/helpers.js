const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')

const PROJECT_ROOT = path.join(__dirname, '..', '..')
const BUNDLED_7ZA_NAME = process.platform === 'win32' ? '7za.exe' : '7za'
const BUNDLED_7ZA_PATH = path.join(PROJECT_ROOT, 'resources', 'bin', BUNDLED_7ZA_NAME)

const SYSTEM_7Z_CANDIDATES =
  process.platform === 'win32'
    ? ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe']
    : ['/usr/bin/7z', '/usr/local/bin/7z', '/opt/homebrew/bin/7z']

function hasBundled7za() {
  return fs.existsSync(BUNDLED_7ZA_PATH)
}

function getBundled7zaPath() {
  return BUNDLED_7ZA_PATH
}

function findSystem7ZipPath() {
  return SYSTEM_7Z_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null
}

async function createTempWorkDir(prefix = 'wpx-zip-test') {
  return fsp.mkdtemp(path.join(os.tmpdir(), `${prefix}-`))
}

async function writeTextFile(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, content, 'utf8')
}

async function writeBinaryFile(filePath, sizeBytes, fillByte = 0x61) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })

  const chunkSize = 1024 * 1024
  const handle = await fsp.open(filePath, 'w')

  try {
    let remaining = sizeBytes
    const chunk = Buffer.alloc(Math.min(chunkSize, sizeBytes), fillByte)

    while (remaining > 0) {
      const writeSize = Math.min(chunk.length, remaining)
      await handle.write(chunk.subarray(0, writeSize))
      remaining -= writeSize
    }
  } finally {
    await handle.close()
  }
}

async function readTextFile(filePath) {
  return fsp.readFile(filePath, 'utf8')
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath)
    return true
  } catch {
    return false
  }
}

function run7ZipCommand(binaryPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { windowsHide: true })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `7-Zip 命令失败（退出码 ${code ?? 'unknown'}）`))
    })
  })
}

async function testArchiveIntegrity(archivePath, password) {
  const binaryPath = findSystem7ZipPath() || BUNDLED_7ZA_PATH
  const args = ['t', archivePath]

  if (password) {
    args.push(`-p${password}`)
  }

  await run7ZipCommand(binaryPath, args)
}

async function listDirectoryEntries(dirPath, baseDir = dirPath) {
  const entries = []
  const items = await fsp.readdir(dirPath, { withFileTypes: true })

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/')

    if (item.isDirectory()) {
      entries.push(`${relativePath}/`)
      entries.push(...(await listDirectoryEntries(fullPath, baseDir)))
    } else {
      entries.push(relativePath)
    }
  }

  return entries.sort()
}

module.exports = {
  PROJECT_ROOT,
  BUNDLED_7ZA_PATH,
  hasBundled7za,
  getBundled7zaPath,
  findSystem7ZipPath,
  createTempWorkDir,
  writeTextFile,
  writeBinaryFile,
  readTextFile,
  pathExists,
  testArchiveIntegrity,
  listDirectoryEntries,
}
