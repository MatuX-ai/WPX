const ENC_PREFIX = 'enc:v1:'
const SALT_STORAGE_KEY = 'wpx-api-key-salt'

let cachedKeyPromise = null

function canUseWebCrypto() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle)
}

function bytesToBase64(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function getEncryptionKey() {
  if (!canUseWebCrypto()) {
    throw new Error('当前环境不支持 API Key 加密存储')
  }

  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      let salt = ''
      if (typeof localStorage !== 'undefined') {
        salt = localStorage.getItem(SALT_STORAGE_KEY) || crypto.randomUUID()
        localStorage.setItem(SALT_STORAGE_KEY, salt)
      } else {
        salt = 'wpx-default-salt'
      }

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(`wpx-local-${salt}`),
        'PBKDF2',
        false,
        ['deriveKey'],
      )

      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode('wpx-aes-key'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
  }

  return cachedKeyPromise
}

/**
 * @param {string} plainText
 */
export async function encryptApiKey(plainText) {
  const value = String(plainText || '').trim()
  if (!value) return ''

  if (!canUseWebCrypto()) {
    return `${ENC_PREFIX}${btoa(unescape(encodeURIComponent(value)))}`
  }

  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  )

  const payload = new Uint8Array(iv.length + encrypted.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(encrypted), iv.length)

  return `${ENC_PREFIX}${bytesToBase64(payload)}`
}

/**
 * @param {string} encryptedValue
 */
export async function decryptApiKey(encryptedValue) {
  const value = String(encryptedValue || '').trim()
  if (!value) return ''

  if (!value.startsWith(ENC_PREFIX)) {
    return value
  }

  const payload = value.slice(ENC_PREFIX.length)

  if (!canUseWebCrypto()) {
    try {
      return decodeURIComponent(escape(atob(payload)))
    } catch {
      return ''
    }
  }

  const key = await getEncryptionKey()
  const bytes = base64ToBytes(payload)
  const iv = bytes.slice(0, 12)
  const data = bytes.slice(12)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export function hasEncryptedApiKey(encryptedValue) {
  return Boolean(String(encryptedValue || '').trim())
}
