const { app } = require('electron')

/** @type {import('electron-store').default | null} */
let prefsStore = null

const DEFAULTS = Object.freeze({
  enabled: false,
  useForComplexTasks: true,
  preStart: false,
  lastDetectedVersion: '',
  lastDetectAt: 0,
  lastInstallHintShown: 0,
})

function sanitize(partial) {
  const next = { ...DEFAULTS, ...(partial && typeof partial === 'object' ? partial : {}) }
  next.enabled = Boolean(next.enabled)
  next.useForComplexTasks = Boolean(next.useForComplexTasks)
  next.preStart = Boolean(next.preStart)
  next.lastDetectedVersion = String(next.lastDetectedVersion || '').trim()
  next.lastDetectAt = Number.isFinite(Number(next.lastDetectAt)) ? Number(next.lastDetectAt) : 0
  next.lastInstallHintShown = Number.isFinite(Number(next.lastInstallHintShown))
    ? Number(next.lastInstallHintShown)
    : 0
  return next
}

async function initJcodeStore() {
  if (prefsStore) return prefsStore
  const { default: Store } = await import('electron-store')
  prefsStore = new Store({
    name: 'jcode-prefs',
    defaults: { ...DEFAULTS },
  })
  return prefsStore
}

function ensureReady() {
  if (!prefsStore) {
    throw new Error('[jcode-store] Store is not initialized. Call initJcodeStore() first.')
  }
}

function getJcodeSettings() {
  ensureReady()
  return sanitize(prefsStore.get('prefs'))
}

function setJcodeSettings(partial) {
  ensureReady()
  const current = getJcodeSettings()
  const next = sanitize({ ...current, ...(partial && typeof partial === 'object' ? partial : {}) })
  prefsStore.set('prefs', next)
  return next
}

function recordDetection(detectionResult) {
  if (!detectionResult || typeof detectionResult !== 'object') return getJcodeSettings()
  const patch = {
    lastDetectAt: Date.now(),
    lastDetectedVersion: detectionResult.installed
      ? String(detectionResult.version || '').trim()
      : '',
  }
  return setJcodeSettings(patch)
}

function markInstallHintShown() {
  return setJcodeSettings({ lastInstallHintShown: Date.now() })
}

function shouldShowInstallHint() {
  const settings = getJcodeSettings()
  if (settings.enabled) return false
  // 24 小时内最多提示一次
  if (Date.now() - Number(settings.lastInstallHintShown || 0) < 24 * 60 * 60 * 1000) {
    return false
  }
  return true
}

function getStorePath() {
  if (prefsStore) return prefsStore.path
  // 未初始化时给出默认路径，便于诊断
  return `${app.getPath('userData')}/jcode-prefs.json`
}

module.exports = {
  initJcodeStore,
  getJcodeSettings,
  setJcodeSettings,
  recordDetection,
  markInstallHintShown,
  shouldShowInstallHint,
  getStorePath,
  DEFAULTS,
}
