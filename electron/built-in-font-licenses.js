const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const PROJECT_ROOT = path.join(__dirname, '..')

/** @type {string[]} */
const LICENSE_CANDIDATES = [
  'LICENSE',
  'LICENSE.txt',
  'License.txt',
  'OFL.txt',
  'OFL-FAQ.txt',
  'COPYING',
]

/**
 * @returns {string}
 */
function getBuiltInFontsDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'fonts', 'built-in')
  }

  return path.join(PROJECT_ROOT, 'resources', 'fonts', 'built-in')
}

/**
 * @param {string} fontId
 * @returns {string | null}
 */
function resolveBuiltInFontLicensePath(fontId) {
  if (typeof fontId !== 'string' || !fontId.trim()) {
    return null
  }

  const normalizedId = fontId.trim()
  if (!/^[a-zA-Z0-9._-]+$/.test(normalizedId)) {
    return null
  }

  const fontDir = path.join(getBuiltInFontsDir(), normalizedId)
  if (!fs.existsSync(fontDir)) {
    return null
  }

  for (const candidate of LICENSE_CANDIDATES) {
    const licensePath = path.join(fontDir, candidate)
    if (fs.existsSync(licensePath) && fs.statSync(licensePath).isFile()) {
      return licensePath
    }
  }

  return null
}

module.exports = {
  getBuiltInFontsDir,
  resolveBuiltInFontLicensePath,
  LICENSE_CANDIDATES,
}
