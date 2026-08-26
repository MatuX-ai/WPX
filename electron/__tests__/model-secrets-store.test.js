/**
 * model-secrets-store —— 加密存储与「已保存」状态一致性
 *
 * 回归：解密失败时不得虚报 hasKey，否则设置页显示「已保存」而 AI 读不到 Key。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import Module from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

describe('model-secrets-store', () => {
  /** @type {string} */
  let tmpDir
  /** @type {any} */
  let store
  /** @type {typeof Module._load} */
  const originalLoad = Module._load
  /** @type {string | null} */
  let activeUserData = null

  async function loadStore(userDataDir) {
    activeUserData = userDataDir
    vi.resetModules()

    Module._load = function loadWithUserData(request, parent, isMain) {
      if (request === 'electron') {
        return {
          app: {
            isPackaged: false,
            isReady: () => true,
            whenReady: () => Promise.resolve(),
            getName: () => 'wpx-test',
            getPath: (name) => (name === 'userData' ? activeUserData : activeUserData),
          },
        }
      }
      return originalLoad.call(this, request, parent, isMain)
    }

    const modPath = path.join(__dirname, '../services/model-secrets-store.js')
    delete require.cache[require.resolve(modPath)]
    store = require(modPath)
    await store.initModelSecretsStore()
    return store
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpx-model-secrets-'))
    store = await loadStore(tmpDir)
  })

  afterEach(() => {
    Module._load = originalLoad
    activeUserData = null
    vi.resetModules()
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('写入后 getMasked / getDecrypted 一致可读', () => {
    const key = 'sk-test-key-abcdefghijklmnop'
    const setResult = store.setApiKey('text', key)
    expect(setResult.hasKey).toBe(true)
    expect(setResult.masked).toContain('sk-t')

    const masked = store.getMaskedApiKey('text')
    expect(masked.hasKey).toBe(true)
    expect(masked.masked).toBe(setResult.masked)
    expect(store.getDecryptedApiKey('text')).toBe(key)
  })

  it('损坏密文不得虚报 hasKey，解密返回空串', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'model-secrets.json'),
      JSON.stringify({ text: 'not-a-valid-ciphertext!!!', vision: '' }),
    )

    store = await loadStore(tmpDir)

    const masked = store.getMaskedApiKey('text')
    expect(masked.hasKey).toBe(false)
    expect(masked.masked).toBe('')
    expect(store.getDecryptedApiKey('text')).toBe('')
  })

  it('历史明文 sk- Key 可回退读取', async () => {
    const plain = 'sk-legacy-plaintext-key-123456'
    fs.writeFileSync(
      path.join(tmpDir, 'model-secrets.json'),
      JSON.stringify({ text: plain, vision: '' }),
    )

    store = await loadStore(tmpDir)

    expect(store.getDecryptedApiKey('text')).toBe(plain)
    expect(store.getMaskedApiKey('text').hasKey).toBe(true)
  })
})
