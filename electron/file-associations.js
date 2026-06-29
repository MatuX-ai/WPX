const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const ASSOCIATED_EXTENSIONS = new Set(['.md', '.txt', '.wpx', '.doc', '.docx', '.xls', '.xlsx', '.xlsm'])

function getPreferencePath() {
  return path.join(app.getPath('userData'), 'file-associations.json')
}

function readPreferenceFile() {
  try {
    const raw = fs.readFileSync(getPreferencePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePreferenceFile(data) {
  fs.writeFileSync(getPreferencePath(), JSON.stringify(data, null, 2), 'utf8')
}

function isAssociableFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  const ext = path.extname(filePath).toLowerCase()
  return ASSOCIATED_EXTENSIONS.has(ext)
}

function getAssociationsEnabled() {
  const prefs = readPreferenceFile()
  return prefs.enabled !== false
}

function setAssociationsEnabled(enabled) {
  const prefs = readPreferenceFile()
  prefs.enabled = Boolean(enabled)
  prefs.updatedAt = new Date().toISOString()
  writePreferenceFile(prefs)
  return prefs.enabled
}

module.exports = {
  ASSOCIATED_EXTENSIONS,
  isAssociableFile,
  getAssociationsEnabled,
  setAssociationsEnabled,
}
