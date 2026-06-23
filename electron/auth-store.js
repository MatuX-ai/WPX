const crypto = require('node:crypto')
const { app, ipcMain, safeStorage } = require('electron')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000
const SAFE_PREFIX = 'safe:'
const AES_PREFIX = 'aes:'

/** @type {import('electron-store').default | null} */
let authStore = null

function deriveAesKey() {
  const seed = `${app.getPath('userData')}|wpx-auth-store-v1`
  return crypto.pbkdf2Sync(seed, 'wpx-auth-aes-salt', PBKDF2_ITERATIONS, 32, 'sha256')
}

/**
 * @param {string} plaintext
 */
function encryptWithAes(plaintext) {
  const value = String(plaintext || '').trim()
  if (!value) return ''

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, deriveAesKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/**
 * @param {string} ciphertext
 */
function decryptWithAes(ciphertext) {
  const value = String(ciphertext || '').trim()
  if (!value) return ''

  const payload = Buffer.from(value, 'base64')
  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('无效的 AES 加密凭据')
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, deriveAesKey(), iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function isSafeStorageAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * @param {string} plaintext
 */
function encryptValue(plaintext) {
  const value = String(plaintext || '').trim()
  if (!value) return ''

  if (isSafeStorageAvailable()) {
    const encrypted = safeStorage.encryptString(value)
    return `${SAFE_PREFIX}${encrypted.toString('base64')}`
  }

  return `${AES_PREFIX}${encryptWithAes(value)}`
}

/**
 * @param {string} stored
 */
function decryptValue(stored) {
  const value = String(stored || '').trim()
  if (!value) return ''

  if (value.startsWith(SAFE_PREFIX)) {
    const encrypted = Buffer.from(value.slice(SAFE_PREFIX.length), 'base64')
    return safeStorage.decryptString(encrypted)
  }

  if (value.startsWith(AES_PREFIX)) {
    return decryptWithAes(value.slice(AES_PREFIX.length))
  }

  // 兼容旧版无前缀 AES 存储
  return decryptWithAes(value)
}

async function initAuthStore() {
  if (authStore) return

  const { default: Store } = await import('electron-store')
  authStore = new Store({
    name: 'auth-credentials',
    defaults: {
      tokenEnc: '',
      refreshTokenEnc: '',
    },
  })

  registerAuthStoreIpcHandlers()
}

/**
 * @param {{ token?: string, refreshToken?: string }} payload
 */
function storeToken(payload = {}) {
  if (!authStore) {
    throw new Error('[auth-store] Store is not initialized')
  }

  const token = String(payload.token || '').trim()
  if (!token) {
    throw new Error('token 不能为空')
  }

  const refreshToken = String(payload.refreshToken || '').trim()

  authStore.set('tokenEnc', encryptValue(token))
  authStore.set('refreshTokenEnc', refreshToken ? encryptValue(refreshToken) : '')

  return { ok: true }
}

function getToken() {
  if (!authStore) {
    throw new Error('[auth-store] Store is not initialized')
  }

  const tokenEnc = String(authStore.get('tokenEnc') || '').trim()
  const refreshTokenEnc = String(authStore.get('refreshTokenEnc') || '').trim()

  if (!tokenEnc) {
    return { token: '', refreshToken: '' }
  }

  try {
    const token = decryptValue(tokenEnc)
    let refreshToken = ''

    if (refreshTokenEnc) {
      try {
        refreshToken = decryptValue(refreshTokenEnc)
      } catch {
        refreshToken = ''
      }
    }

    return { token, refreshToken }
  } catch {
    return { token: '', refreshToken: '' }
  }
}

function clearToken() {
  if (!authStore) {
    throw new Error('[auth-store] Store is not initialized')
  }

  authStore.set('tokenEnc', '')
  authStore.set('refreshTokenEnc', '')

  return { ok: true }
}


function registerAuthStoreIpcHandlers() {
  ipcMain.handle('auth:store-token', (_event, payload = {}) => storeToken(payload))
  ipcMain.handle('auth:get-token', () => getToken())
  ipcMain.handle('auth:clear-token', () => clearToken())
}

module.exports = {
  initAuthStore,
  storeToken,
  getToken,
  clearToken,
  encryptValue,
  decryptValue,
  isSafeStorageAvailable,
}
