const { app } = require('electron')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const PROJECT_ROOT = path.join(__dirname, '..')
const BINARY_BASE_NAME = '7za'
const LICENSE_FILE_NAME = '7-Zip-LICENSE.txt'

let startupCheckDone = false

function get7zaBinaryName() {
  return process.platform === 'win32' ? `${BINARY_BASE_NAME}.exe` : BINARY_BASE_NAME
}

/**
 * Resolve the path to the bundled 7za executable.
 * @returns {string}
 */
function get7zaPath() {
  const binaryName = get7zaBinaryName()

  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', binaryName)
  }

  return path.join(PROJECT_ROOT, 'resources', 'bin', binaryName)
}

/**
 * Resolve the path to the bundled 7-Zip LGPL license file.
 * @returns {string}
 */
function get7ZipLicensePath() {
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', LICENSE_FILE_NAME)
  }

  return path.join(PROJECT_ROOT, 'resources', 'bin', LICENSE_FILE_NAME)
}

/**
 * Read the bundled 7-Zip license text.
 * @returns {Promise<string | null>}
 */
async function read7ZipLicenseContent() {
  try {
    return await fsp.readFile(get7ZipLicensePath(), 'utf8')
  } catch {
    return null
  }
}

function verify7zaBinaryAtStartup() {
  if (startupCheckDone) return fs.existsSync(get7zaPath())
  startupCheckDone = true

  const binaryPath = get7zaPath()
  if (fs.existsSync(binaryPath)) {
    return true
  }

  const message = `7-Zip 命令行工具未找到：${binaryPath}。压缩/解压缩功能将不可用。请将 7za 放入 resources/bin/ 目录。`

  if (app.isPackaged) {
    console.error(`[7za-path] ${message}`)
  } else {
    console.warn(`[7za-path] ${message}`)
  }

  return false
}

if (app && typeof app.isReady === 'function') {
  if (app.isReady()) {
    verify7zaBinaryAtStartup()
  } else if (typeof app.whenReady === 'function') {
    app.whenReady().then(verify7zaBinaryAtStartup)
  }
}

module.exports = {
  get7zaPath,
  get7ZipLicensePath,
  read7ZipLicenseContent,
}
