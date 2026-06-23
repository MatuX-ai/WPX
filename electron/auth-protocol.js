const { ipcMain, shell } = require('electron')

const ACCOUNT_LOGIN_BASE = 'https://account.proclaw.cc/login'
const ACCOUNT_REGISTER_BASE = 'https://account.proclaw.cc/register'
const AUTH_CALLBACK_SCHEME = 'wpx://auth'

/**
 * @param {import('electron').BrowserWindow[]} windows
 * @param {Record<string, unknown>} payload
 */
function broadcastAuthCallback(windows, payload) {
  for (const window of windows) {
    if (window.isDestroyed()) continue
    window.webContents.send('auth:callback', payload)
  }
}

/**
 * @param {string} state
 * @param {'login' | 'register'} [entry]
 */
function buildLoginUrl(state, entry = 'login') {
  const base = entry === 'register' ? ACCOUNT_REGISTER_BASE : ACCOUNT_LOGIN_BASE
  const params = new URLSearchParams({
    callback: AUTH_CALLBACK_SCHEME,
    state: String(state || '').trim(),
  })
  return `${base}?${params.toString()}`
}

/**
 * @param {string} rawUrl
 */
function parseAuthCallbackUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim())
    if (url.protocol !== 'wpx:') return null
    if (url.hostname !== 'auth') return null

    return {
      token: url.searchParams.get('token') || '',
      refreshToken:
        url.searchParams.get('refresh_token') ||
        url.searchParams.get('refreshToken') ||
        '',
      state: url.searchParams.get('state') || '',
      error: url.searchParams.get('error') || url.searchParams.get('error_description') || '',
    }
  } catch {
    return null
  }
}

/**
 * @param {unknown} argv
 * @returns {string[]}
 */
function extractProtocolUrlsFromArgv(argv = []) {
  if (!Array.isArray(argv)) return []

  return argv.filter((arg) => typeof arg === 'string' && arg.startsWith('wpx://'))
}

/**
 * @param {import('electron').BrowserWindow[]} windows
 * @param {string} rawUrl
 * @returns {boolean}
 */
function handleAuthCallbackUrl(windows, rawUrl) {
  const parsed = parseAuthCallbackUrl(rawUrl)
  if (!parsed) return false

  broadcastAuthCallback(windows, {
    ...parsed,
    url: rawUrl,
  })

  return true
}

function registerAuthProtocolIpcHandlers() {
  ipcMain.handle('auth:start-login', async (_event, payload = {}) => {
    const state = String(payload.state || '').trim()
    if (!state) {
      throw new Error('state 不能为空')
    }

    const entry = payload.entry === 'register' ? 'register' : 'login'
    await shell.openExternal(buildLoginUrl(state, entry))
    return { ok: true }
  })
}

function initAuthProtocol() {
  registerAuthProtocolIpcHandlers()
}

module.exports = {
  initAuthProtocol,
  handleAuthCallbackUrl,
  extractProtocolUrlsFromArgv,
  parseAuthCallbackUrl,
  buildLoginUrl,
}
