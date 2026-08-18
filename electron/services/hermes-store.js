/**
 * hermes-store —— Hermes Gateway 偏好存储（Phase 3 / M3，仿 jcode-store）
 */
const { app } = require('electron')

/** @type {import('electron-store').default | null} */
let prefsStore = null

const DEFAULTS = Object.freeze({
  enabled: false,
  preStart: false,
  // 自动路由：复杂任务（shouldUseHermes 命中）在对话中自动走 Hermes
  autoRoute: false,
  gatewayPort: 8642,
  lastDetectedState: '',
  lastDetectAt: 0,
  lastInstallHintShown: 0,
})

function sanitize(partial) {
  const next = { ...DEFAULTS, ...(partial && typeof partial === 'object' ? partial : {}) }
  next.enabled = Boolean(next.enabled)
  next.preStart = Boolean(next.preStart)
  next.autoRoute = Boolean(next.autoRoute)
  next.gatewayPort = Number.isFinite(Number(next.gatewayPort)) ? Number(next.gatewayPort) : 8642
  next.lastDetectedState = String(next.lastDetectedState || '').trim()
  next.lastDetectAt = Number.isFinite(Number(next.lastDetectAt)) ? Number(next.lastDetectAt) : 0
  next.lastInstallHintShown = Number.isFinite(Number(next.lastInstallHintShown))
    ? Number(next.lastInstallHintShown)
    : 0
  return next
}

async function initHermesStore() {
  if (prefsStore) return prefsStore
  const { default: Store } = await import('electron-store')
  prefsStore = new Store({
    name: 'hermes-prefs',
    defaults: { ...DEFAULTS },
  })
  return prefsStore
}

function ensureReady() {
  if (!prefsStore) {
    throw new Error('[hermes-store] Store is not initialized. Call initHermesStore() first.')
  }
}

function getHermesSettings() {
  ensureReady()
  return sanitize(prefsStore.get('prefs'))
}

function setHermesSettings(partial) {
  ensureReady()
  const current = getHermesSettings()
  const next = sanitize({ ...current, ...(partial && typeof partial === 'object' ? partial : {}) })
  prefsStore.set('prefs', next)
  return next
}

function recordDetection(detectionResult) {
  if (!detectionResult || typeof detectionResult !== 'object') return getHermesSettings()
  const patch = {
    lastDetectAt: Date.now(),
    lastDetectedState: detectionResult.state || '',
  }
  return setHermesSettings(patch)
}

function markInstallHintShown() {
  return setHermesSettings({ lastInstallHintShown: Date.now() })
}

function shouldShowInstallHint() {
  const s = getHermesSettings()
  if (!s.lastInstallHintShown) return true
  const days = (Date.now() - s.lastInstallHintShown) / 86_400_000
  return days > 7
}

module.exports = {
  initHermesStore,
  getHermesSettings,
  setHermesSettings,
  recordDetection,
  markInstallHintShown,
  shouldShowInstallHint,
  DEFAULTS,
}
