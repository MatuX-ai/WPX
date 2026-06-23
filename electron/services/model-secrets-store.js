const crypto = require('node:crypto')
const { app } = require('electron')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000
const VALID_BLOCKS = new Set(['text', 'vision'])

/** @type {import('electron-store').default | null} */
let secretsStore = null

function deriveEncryptionKey() {
  const seed = `${app.getPath('userData')}|wpx-model-secrets-v1`
  return crypto.pbkdf2Sync(seed, 'wpx-model-aes-salt', PBKDF2_ITERATIONS, 32, 'sha256')
}

/**
 * @param {string} plaintext
 */
function encryptSecret(plaintext) {
  const value = String(plaintext || '').trim()
  if (!value) return ''

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, deriveEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/**
 * @param {string} ciphertext
 */
function decryptSecret(ciphertext) {
  const value = String(ciphertext || '').trim()
  if (!value) return ''

  const payload = Buffer.from(value, 'base64')
  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('无效的加密 API Key')
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, deriveEncryptionKey(), iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * @param {string} apiKey
 */
function maskApiKey(apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  const middleLength = Math.min(Math.max(key.length - 8, 4), 12)
  return `${key.slice(0, 4)}${'•'.repeat(middleLength)}${key.slice(-4)}`
}

function assertValidBlock(block) {
  if (!VALID_BLOCKS.has(block)) {
    throw new Error(`未知的模型类型：${block}`)
  }
}

async function initModelSecretsStore() {
  if (secretsStore) return

  const { default: Store } = await import('electron-store')
  secretsStore = new Store({
    name: 'model-secrets',
    defaults: {
      text: '',
      vision: '',
    },
  })
}

/**
 * @param {'text' | 'vision'} block
 * @param {string} apiKey
 */
function setApiKey(block, apiKey) {
  assertValidBlock(block)
  if (!secretsStore) {
    throw new Error('[model-secrets-store] Store is not initialized')
  }

  const value = String(apiKey || '').trim()
  if (!value) {
    secretsStore.set(block, '')
    return { hasKey: false, masked: '' }
  }

  secretsStore.set(block, encryptSecret(value))
  return { hasKey: true, masked: maskApiKey(value) }
}

/**
 * @param {'text' | 'vision'} block
 */
function clearApiKey(block) {
  assertValidBlock(block)
  if (!secretsStore) {
    throw new Error('[model-secrets-store] Store is not initialized')
  }

  secretsStore.set(block, '')
  return { hasKey: false, masked: '' }
}

/**
 * @param {'text' | 'vision'} block
 */
function hasApiKey(block) {
  assertValidBlock(block)
  if (!secretsStore) return false
  return Boolean(String(secretsStore.get(block) || '').trim())
}

/**
 * @param {'text' | 'vision'} block
 */
function getMaskedApiKey(block) {
  assertValidBlock(block)
  if (!secretsStore) {
    return { hasKey: false, masked: '' }
  }

  const encrypted = String(secretsStore.get(block) || '').trim()
  if (!encrypted) {
    return { hasKey: false, masked: '' }
  }

  try {
    const decrypted = decryptSecret(encrypted)
    return { hasKey: Boolean(decrypted), masked: maskApiKey(decrypted) }
  } catch {
    return { hasKey: true, masked: '••••••••' }
  }
}

/**
 * @param {'text' | 'vision'} block
 */
function getDecryptedApiKey(block) {
  assertValidBlock(block)
  if (!secretsStore) return ''

  const encrypted = String(secretsStore.get(block) || '').trim()
  if (!encrypted) return ''

  return decryptSecret(encrypted)
}

function getAllMaskedApiKeys() {
  return {
    text: getMaskedApiKey('text'),
    vision: getMaskedApiKey('vision'),
  }
}

module.exports = {
  initModelSecretsStore,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getMaskedApiKey,
  getDecryptedApiKey,
  getAllMaskedApiKeys,
  maskApiKey,
}
