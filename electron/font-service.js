const { app } = require('electron')
const { execFile } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')
const fontkit = require('fontkit')

const execFileAsync = promisify(execFile)

const PROJECT_ROOT = path.join(__dirname, '..')
const FONT_EXTENSIONS = new Set(['.ttf', '.otf'])
const COMMERCIAL_META_SUFFIX = '.meta.json'
const COMMERCIAL_ENCRYPTED_SUFFIX = '.enc'
const LEGACY_COMMERCIAL_ENCRYPTED_SUFFIX = '.wpxfont'
const CACHE_VERSION = 1
const CACHE_FILE_NAME = '.parse-cache.json'
const ENCRYPTION_VERSION = 1
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEY_LENGTH = 32
const PBKDF2_DIGEST = 'sha256'
const GCM_IV_LENGTH = 12
const GCM_AUTH_TAG_LENGTH = 16
const FONT_DECRYPT_FAILED = 'FONT_DECRYPT_FAILED'
const SUBSET_BINARY_NAMES = ['subset-font.exe', 'subset-font', 'pyftsubset.exe', 'pyftsubset']
const SUBSET_SCRIPT_NAME = 'subset_font.py'
const SUBSET_BASE_CHARS =
  ' \n\r\t.,;:!?\'"()[]{}<>+-=*/\\|@#$%^&_~`。，、；：？！「」『』（）【】《》…—·'
const SUBSET_TIMEOUT_MS = 120_000

/** @typedef {'built-in' | 'free' | 'commercial'} FontSource */
/** @typedef {'fonttools' | 'harfbuzz' | 'fontkit'} SubsetEngine */

/**
 * @typedef {Object} SubsetFontResult
 * @property {string} path
 * @property {number} size
 * @property {number} originalSize
 * @property {SubsetEngine} engine
 * @property {number} charCount
 * @property {string} [familyName]
 * @property {string} [fontId]
 * @property {FontSource} [source]
 * @property {string} [cssFamily]
 */

/**
 * @typedef {Object} FontInfo
 * @property {string} id
 * @property {string} [fontId]
 * @property {string} name
 * @property {string} family
 * @property {string} fullName
 * @property {string} path
 * @property {number} weight
 * @property {string} weightName
 * @property {string} type
 * @property {string | null} copyright
 * @property {FontSource} source
 * @property {'ttf' | 'otf' | 'enc' | 'wpxfont' | 'unknown'} format
 */

/**
 * @typedef {Object} UserCredentials
 * @property {string} userId
 */

class FontDecryptError extends Error {
  /**
   * @param {string} [message]
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message = FONT_DECRYPT_FAILED, options = {}) {
    super(message)
    this.name = 'FontDecryptError'
    this.code = FONT_DECRYPT_FAILED
    if (options.cause) {
      this.cause = options.cause
    }
  }
}

function normalizeFontId(fontId) {
  if (typeof fontId !== 'string' || !fontId.trim()) {
    throw new Error('[font-service] fontId is required')
  }

  const normalized = fontId.trim()
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new Error('[font-service] fontId contains invalid characters')
  }

  return normalized
}

function getDeviceFingerprint() {
  /** @type {string[]} */
  const parts = [os.platform(), os.arch(), os.hostname()]

  try {
    parts.push(os.userInfo().username)
  } catch {
    parts.push('unknown-user')
  }

  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue

    for (const entry of entries) {
      if (entry.internal || !entry.mac || entry.mac === '00:00:00:00:00:00') continue
      parts.push(entry.mac)
      break
    }
  }

  return crypto.createHash('sha256').update(parts.join('|')).digest('hex')
}
class FontService {
  constructor() {
    /** @type {Map<string, { mtimeMs: number, data: FontInfo[] }>} */
    this.memoryCache = new Map()
    /** @type {{ version: number, entries: Record<string, { mtimeMs: number, data: FontInfo[] }> }} */
    this.diskCache = { version: CACHE_VERSION, entries: {} }
    this.diskCacheLoaded = false
    this.diskCacheDirty = false
    /** @type {string | null} */
    this.userId = null
    /** @type {string | null} */
    this.deviceFingerprint = null
    /** @type {Set<string>} */
    this.activeTempFiles = new Set()
    this.registerAppCleanupHooks()
  }

  registerAppCleanupHooks() {
    if (typeof app.on !== 'function') return

    app.on('will-quit', () => {
      void this.cleanupAllDecryptedFonts()
    })
  }

  /**
   * @param {UserCredentials} credentials
   */
  setUserCredentials(credentials) {
    if (!credentials || typeof credentials.userId !== 'string' || !credentials.userId.trim()) {
      throw new Error('[font-service] userId is required')
    }

    this.userId = credentials.userId.trim()
  }

  clearUserCredentials() {
    this.userId = null
  }

  /**
   * @returns {string}
   */
  getDeviceFingerprint() {
    if (!this.deviceFingerprint) {
      this.deviceFingerprint = getDeviceFingerprint()
    }

    return this.deviceFingerprint
  }

  /**
   * @returns {string}
   */
  requireUserId() {
    if (!this.userId) {
      throw new Error('[font-service] user credentials are not set')
    }

    return this.userId
  }

  /**
   * @returns {Buffer}
   */
  deriveEncryptionKey() {
    const userId = this.requireUserId()
    const salt = `wpx-commercial-font-v1:${this.getDeviceFingerprint()}`

    return crypto.pbkdf2Sync(
      userId,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
    )
  }

  /**
   * @param {Buffer} plaintext
   * @param {Buffer} key
   * @returns {Buffer}
   */
  encryptBuffer(plaintext, key) {
    const iv = crypto.randomBytes(GCM_IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([
      Buffer.from([ENCRYPTION_VERSION]),
      iv,
      authTag,
      ciphertext,
    ])
  }

  /**
   * @param {Buffer} payload
   * @param {Buffer} key
   * @returns {Buffer}
   */
  decryptBuffer(payload, key) {
    if (payload.length <= 1 + GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH) {
      throw new FontDecryptError()
    }

    const version = payload[0]
    if (version !== ENCRYPTION_VERSION) {
      throw new FontDecryptError()
    }

    const iv = payload.subarray(1, 1 + GCM_IV_LENGTH)
    const authTag = payload.subarray(1 + GCM_IV_LENGTH, 1 + GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH)
    const ciphertext = payload.subarray(1 + GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH)

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()])
    } catch (error) {
      throw new FontDecryptError(FONT_DECRYPT_FAILED, { cause: error })
    }
  }

  /** @returns {string} */
  getTempFontsDir() {
    try {
      return path.join(app.getPath('temp'), 'wpx-fonts')
    } catch {
      return path.join(PROJECT_ROOT, '.wpx-temp-fonts')
    }
  }

  /** @returns {Promise<void>} */
  async ensureCommercialDir() {
    await fsp.mkdir(this.getCommercialFontsDir(), { recursive: true })
  }

  /**
   * @param {string} fontId
   * @returns {string}
   */
  getCommercialEncPath(fontId) {
    return path.join(this.getCommercialFontsDir(), `${normalizeFontId(fontId)}${COMMERCIAL_ENCRYPTED_SUFFIX}`)
  }

  /**
   * @param {string} fontId
   * @returns {string}
   */
  getCommercialMetaPath(fontId) {
    return path.join(this.getCommercialFontsDir(), `${normalizeFontId(fontId)}${COMMERCIAL_META_SUFFIX}`)
  }

  /**
   * @param {string} fontId
   * @returns {Promise<Record<string, unknown> | null>}
   */
  async readCommercialMeta(fontId) {
    try {
      const raw = await fsp.readFile(this.getCommercialMetaPath(fontId), 'utf8')
      return JSON.parse(raw)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * 从 CDN 下载后的明文文件加密入库，原文件删除。
   * @param {string} fontId
   * @param {string} plainFontPath
   * @param {Record<string, unknown>} [meta]
   * @returns {Promise<FontInfo>}
   */
  async storeCommercialFont(fontId, plainFontPath, meta = {}) {
    const normalizedFontId = normalizeFontId(fontId)
    await this.ensureCommercialDir()

    const sourceStat = await fsp.stat(plainFontPath)
    if (!sourceStat.isFile()) {
      throw new Error('[font-service] plainFontPath must be a file')
    }

    const ext = path.extname(plainFontPath).toLowerCase()
    if (!FONT_EXTENSIONS.has(ext)) {
      throw new Error('[font-service] only .ttf/.otf files can be encrypted')
    }

    const plaintext = await fsp.readFile(plainFontPath)
    const encrypted = this.encryptBuffer(plaintext, this.deriveEncryptionKey())
    const encPath = this.getCommercialEncPath(normalizedFontId)
    await fsp.writeFile(encPath, encrypted)

    /** @type {Record<string, unknown>} */
    let parsedMeta = { ...meta }
    try {
      const opened = fontkit.openSync(plainFontPath)
      const fonts = this.expandFontkitFonts(opened)
      if (fonts[0]) {
        const preview = this.buildFontInfo(plainFontPath, 'commercial', fonts[0])
        parsedMeta = {
          name: preview.name,
          family: preview.family,
          fullName: preview.fullName,
          weight: preview.weight,
          weightName: preview.weightName,
          type: preview.type,
          copyright: preview.copyright,
          ...meta,
        }
      }
    } catch (error) {
      console.warn('[font-service] Failed to parse font metadata before encryption:', error.message)
    }

    const metaPath = this.getCommercialMetaPath(normalizedFontId)
    const fullMeta = {
      fontId: normalizedFontId,
      encryptedFile: `${normalizedFontId}${COMMERCIAL_ENCRYPTED_SUFFIX}`,
      originalFormat: ext.slice(1),
      ...parsedMeta,
    }

    await fsp.writeFile(metaPath, JSON.stringify(fullMeta, null, 2), 'utf8')
    await fsp.unlink(plainFontPath)

    return this.buildCommercialFontInfo(metaPath, fullMeta)
  }

  /**
   * @param {string} fontId
   * @returns {Promise<string>}
   */
  async decryptFont(fontId) {
    const normalizedFontId = normalizeFontId(fontId)
    const encPath = this.getCommercialEncPath(normalizedFontId)

    try {
      const payload = await fsp.readFile(encPath)
      const plaintext = this.decryptBuffer(payload, this.deriveEncryptionKey())
      const meta = await this.readCommercialMeta(normalizedFontId)
      const originalFormat =
        meta && typeof meta.originalFormat === 'string' && meta.originalFormat
          ? `.${meta.originalFormat}`
          : '.ttf'

      await fsp.mkdir(this.getTempFontsDir(), { recursive: true })
      const tempPath = path.join(
        this.getTempFontsDir(),
        `${normalizedFontId}-${crypto.randomBytes(8).toString('hex')}${originalFormat}`,
      )

      await fsp.writeFile(tempPath, plaintext)
      this.activeTempFiles.add(tempPath)
      return tempPath
    } catch (error) {
      if (error instanceof FontDecryptError) {
        throw error
      }

      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new FontDecryptError(FONT_DECRYPT_FAILED, { cause: error })
      }

      throw new FontDecryptError(FONT_DECRYPT_FAILED, { cause: error })
    }
  }

  /**
   * @param {string} tempPath
   * @returns {Promise<void>}
   */
  async cleanupDecryptedFont(tempPath) {
    if (!tempPath || typeof tempPath !== 'string') return

    const tempRoot = this.getTempFontsDir()
    if (!tempPath.startsWith(tempRoot)) {
      throw new Error('[font-service] refusing to delete file outside temp fonts directory')
    }

    this.activeTempFiles.delete(tempPath)

    try {
      await fsp.unlink(tempPath)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async cleanupAllDecryptedFonts() {
    const tempFiles = [...this.activeTempFiles]
    this.activeTempFiles.clear()

    await Promise.all(
      tempFiles.map(async (tempPath) => {
        try {
          await fsp.unlink(tempPath)
        } catch {
          // ignore cleanup errors on shutdown
        }
      }),
    )
  }

  /**
   * @template T
   * @param {string} fontId
   * @param {(tempPath: string) => Promise<T>} handler
   * @returns {Promise<T>}
   */
  async withDecryptedFont(fontId, handler) {
    const tempPath = await this.decryptFont(fontId)

    try {
      return await handler(tempPath)
    } finally {
      await this.cleanupDecryptedFont(tempPath)
    }
  }
  /** @returns {string} */
  getBuiltInFontsDir() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'fonts', 'built-in')
    }

    return path.join(PROJECT_ROOT, 'resources', 'fonts', 'built-in')
  }

  /** @returns {string} */
  getFreeFontsDir() {
    return path.join(this.getUserDataPath(), 'fonts', 'free')
  }

  /** @returns {string} */
  getCommercialFontsDir() {
    return path.join(this.getUserDataPath(), 'fonts', 'commercial')
  }

  /** @returns {string} */
  getParseCacheFilePath() {
    return path.join(this.getUserDataPath(), 'fonts', CACHE_FILE_NAME)
  }

  /** @returns {string} */
  getUserDataPath() {
    try {
      return app.getPath('userData')
    } catch {
      return path.join(PROJECT_ROOT, '.wpx-user-data')
    }
  }

  async loadDiskCache() {
    if (this.diskCacheLoaded) return

    this.diskCacheLoaded = true

    try {
      const raw = await fsp.readFile(this.getParseCacheFilePath(), 'utf8')
      const parsed = JSON.parse(raw)

      if (parsed?.version === CACHE_VERSION && parsed.entries && typeof parsed.entries === 'object') {
        this.diskCache = parsed
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        console.warn('[font-service] Failed to load parse cache:', error.message)
      }
    }
  }

  async flushDiskCache() {
    if (!this.diskCacheDirty) return

    this.diskCacheDirty = false

    try {
      const cacheDir = path.dirname(this.getParseCacheFilePath())
      await fsp.mkdir(cacheDir, { recursive: true })
      await fsp.writeFile(
        this.getParseCacheFilePath(),
        JSON.stringify(this.diskCache, null, 2),
        'utf8',
      )
    } catch (error) {
      console.warn('[font-service] Failed to write parse cache:', error.message)
    }
  }

  /**
   * @param {string} filePath
   * @param {number} mtimeMs
   * @returns {FontInfo[] | null}
   */
  getCachedFontEntries(filePath, mtimeMs) {
    const memoryEntry = this.memoryCache.get(filePath)
    if (memoryEntry && memoryEntry.mtimeMs === mtimeMs) {
      return memoryEntry.data
    }

    const diskEntry = this.diskCache.entries[filePath]
    if (diskEntry && diskEntry.mtimeMs === mtimeMs) {
      this.memoryCache.set(filePath, diskEntry)
      return diskEntry.data
    }

    return null
  }

  /**
   * @param {string} filePath
   * @param {number} mtimeMs
   * @param {FontInfo[]} entries
   */
  setCachedFontEntries(filePath, mtimeMs, entries) {
    const entry = { mtimeMs, data: entries }
    this.memoryCache.set(filePath, entry)
    this.diskCache.entries[filePath] = entry
    this.diskCacheDirty = true
  }

  /**
   * @param {string} dir
   * @returns {Promise<string[]>}
   */
  async collectFontFiles(dir) {
    /** @type {string[]} */
    const results = []

    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return results
      }
      throw error
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        results.push(...(await this.collectFontFiles(fullPath)))
        continue
      }

      if (!entry.isFile()) continue

      const ext = path.extname(entry.name).toLowerCase()
      if (FONT_EXTENSIONS.has(ext)) {
        results.push(fullPath)
      }
    }

    return results
  }

  /**
   * @param {string} dir
   * @returns {Promise<string[]>}
   */
  async collectCommercialMetaFiles(dir) {
    /** @type {string[]} */
    const results = []

    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return results
      }
      throw error
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        results.push(...(await this.collectCommercialMetaFiles(fullPath)))
        continue
      }

      if (entry.isFile() && entry.name.endsWith(COMMERCIAL_META_SUFFIX)) {
        results.push(fullPath)
      }
    }

    return results
  }

  /**
   * @param {string} dir
   * @returns {Promise<string[]>}
   */
  async collectCommercialEncryptedFiles(dir) {
    /** @type {string[]} */
    const results = []

    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return results
      }
      throw error
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        results.push(...(await this.collectCommercialEncryptedFiles(fullPath)))
        continue
      }

      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase()
        if (
          lowerName.endsWith(COMMERCIAL_ENCRYPTED_SUFFIX) ||
          lowerName.endsWith(LEGACY_COMMERCIAL_ENCRYPTED_SUFFIX)
        ) {
          results.push(fullPath)
        }
      }
    }

    return results
  }

  /**
   * @param {import('fontkit').Font | import('fontkit').FontCollection} opened
   * @returns {import('fontkit').Font[]}
   */
  expandFontkitFonts(opened) {
    if (opened && typeof opened === 'object' && Array.isArray(opened.fonts)) {
      return opened.fonts
    }

    return [opened]
  }

  /**
   * @param {number} weight
   * @param {string | null | undefined} subfamilyName
   * @returns {string}
   */
  resolveWeightName(weight, subfamilyName) {
    if (subfamilyName) return subfamilyName

    const weightNames = {
      100: 'Thin',
      200: 'ExtraLight',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'SemiBold',
      700: 'Bold',
      800: 'ExtraBold',
      900: 'Black',
    }

    return weightNames[weight] || String(weight)
  }

  /**
   * @param {import('fontkit').Font} font
   * @returns {number}
   */
  resolveFontWeight(font) {
    const os2 = font['OS/2']
    if (os2?.usWeightClass) {
      return os2.usWeightClass
    }

    const subfamily = (font.subfamilyName || '').toLowerCase()

    if (subfamily.includes('thin')) return 100
    if (subfamily.includes('extralight') || subfamily.includes('ultra light')) return 200
    if (subfamily.includes('light')) return 300
    if (subfamily.includes('medium')) return 500
    if (subfamily.includes('semibold') || subfamily.includes('demibold')) return 600
    if (subfamily.includes('bold')) return 700
    if (subfamily.includes('extrabold') || subfamily.includes('ultra bold')) return 800
    if (subfamily.includes('black') || subfamily.includes('heavy')) return 900

    return 400
  }

  /**
   * @param {import('fontkit').Font} font
   * @returns {string}
   */
  inferFontType(font) {
    if (font.post?.isFixedPitch) {
      return 'monospace'
    }

    const text = `${font.familyName || ''} ${font.subfamilyName || ''} ${font.fullName || ''}`.toLowerCase()

    if (/emoji/.test(text)) return 'emoji'
    if (/mono|等宽|courier|consolas|jetbrains/.test(text)) return 'monospace'
    if (/kai|楷|hand|script|wenkai|文楷|brush|毛笔|手写/.test(text)) return 'handwriting'
    if (/serif|song|宋|ming|明|仿宋|fangsong|宋体|书宋/.test(text) && !/sans|黑/.test(text)) {
      return 'serif'
    }
    if (/黑|hei|sans|gothic|yuan|圆|puhui|普惠|harmony|harmonyos/.test(text)) {
      return 'sans-serif'
    }

    return 'sans-serif'
  }

  /**
   * @param {string} filePath
   * @param {FontSource} source
   * @param {import('fontkit').Font} font
   * @returns {FontInfo}
   */
  buildFontInfo(filePath, source, font) {
    const weight = this.resolveFontWeight(font)
    const family = font.familyName || path.basename(filePath, path.extname(filePath))
    const fullName = font.fullName || family
    const ext = path.extname(filePath).toLowerCase()

    return {
      id: `${source}:${filePath}`,
      name: fullName,
      family,
      fullName,
      path: filePath,
      weight,
      weightName: this.resolveWeightName(weight, font.subfamilyName),
      type: this.inferFontType(font),
      copyright: font.copyright || null,
      source,
      format: ext === '.otf' ? 'otf' : 'ttf',
    }
  }

  /**
   * @param {string} filePath
   * @param {FontSource} source
   * @returns {Promise<FontInfo[]>}
   */
  async parseFontFile(filePath, source) {
    const stat = await fsp.stat(filePath)
    const cached = this.getCachedFontEntries(filePath, stat.mtimeMs)
    if (cached) {
      return cached.map((entry) => ({ ...entry, source }))
    }

    let opened
    try {
      opened = fontkit.openSync(filePath)
    } catch (error) {
      console.warn(`[font-service] Failed to parse font: ${filePath}`, error.message)
      return []
    }

    const fonts = this.expandFontkitFonts(opened)
    /** @type {FontInfo[]} */
    const results = []

    for (const font of fonts) {
      const info = this.buildFontInfo(filePath, source, font)
      if (fonts.length > 1) {
        info.id = `${source}:${filePath}:${info.weightName}`
        info.fullName = font.fullName || `${info.family} ${info.weightName}`
        info.name = info.fullName
      }
      results.push(info)
    }

    this.setCachedFontEntries(
      filePath,
      stat.mtimeMs,
      results.map(({ source: _source, ...entry }) => entry),
    )

    return results
  }

  /**
   * @param {string} dir
   * @param {FontSource} source
   * @returns {Promise<FontInfo[]>}
   */
  async scanFontDirectory(dir, source) {
    await this.loadDiskCache()

    const files = await this.collectFontFiles(dir)
    /** @type {FontInfo[]} */
    const fonts = []

    for (const filePath of files) {
      const parsed = await this.parseFontFile(filePath, source)
      fonts.push(...parsed)
    }

    return fonts.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  /**
   * @returns {Promise<FontInfo[]>}
   */
  async getBuiltInFonts() {
    return this.scanFontDirectory(this.getBuiltInFontsDir(), 'built-in')
  }

  /**
   * @returns {Promise<FontInfo[]>}
   */
  async getDownloadedFonts() {
    return this.scanFontDirectory(this.getFreeFontsDir(), 'free')
  }

  /**
   * @param {string} metaPath
   * @param {Record<string, unknown>} meta
   * @returns {FontInfo}
   */
  buildCommercialFontInfo(metaPath, meta) {
    const dir = path.dirname(metaPath)
    const fontId =
      typeof meta.fontId === 'string'
        ? meta.fontId
        : path.basename(metaPath, COMMERCIAL_META_SUFFIX)

    const encryptedFile =
      typeof meta.encryptedFile === 'string'
        ? meta.encryptedFile
        : `${fontId}${COMMERCIAL_ENCRYPTED_SUFFIX}`

    const fontPath = path.isAbsolute(encryptedFile)
      ? encryptedFile
      : path.join(dir, encryptedFile)

    const weight = typeof meta.weight === 'number' ? meta.weight : 400
    const family =
      typeof meta.family === 'string'
        ? meta.family
        : typeof meta.name === 'string'
          ? meta.name
          : fontId

    const fullName =
      typeof meta.name === 'string'
        ? meta.name
        : typeof meta.fullName === 'string'
          ? meta.fullName
          : family

    const isLegacyEncrypted = fontPath.endsWith(LEGACY_COMMERCIAL_ENCRYPTED_SUFFIX)

    return {
      id: `commercial:${fontId}`,
      fontId,
      name: fullName,
      family,
      fullName,
      path: fontPath,
      weight,
      weightName:
        typeof meta.weightName === 'string'
          ? meta.weightName
          : this.resolveWeightName(weight, typeof meta.subfamilyName === 'string' ? meta.subfamilyName : null),
      type: typeof meta.type === 'string' ? meta.type : 'sans-serif',
      copyright: typeof meta.copyright === 'string' ? meta.copyright : null,
      source: 'commercial',
      format: isLegacyEncrypted ? 'wpxfont' : 'enc',
    }
  }

  /**
   * @param {string} encryptedPath
   * @returns {FontInfo}
   */
  buildCommercialFallbackInfo(encryptedPath) {
    const ext = path.extname(encryptedPath)
    const baseName = path.basename(encryptedPath, ext)
    const isLegacyEncrypted = ext === LEGACY_COMMERCIAL_ENCRYPTED_SUFFIX

    return {
      id: `commercial:${baseName}`,
      fontId: baseName,
      name: baseName,
      family: baseName,
      fullName: baseName,
      path: encryptedPath,
      weight: 400,
      weightName: 'Regular',
      type: 'sans-serif',
      copyright: null,
      source: 'commercial',
      format: isLegacyEncrypted ? 'wpxfont' : 'enc',
    }
  }

  /**
   * @returns {Promise<FontInfo[]>}
   */
  async getCommercialFonts() {
    const dir = this.getCommercialFontsDir()
    /** @type {FontInfo[]} */
    const fonts = []
    /** @type {Set<string>} */
    const seenPaths = new Set()

    const metaFiles = await this.collectCommercialMetaFiles(dir)

    for (const metaPath of metaFiles) {
      try {
        const raw = await fsp.readFile(metaPath, 'utf8')
        const meta = JSON.parse(raw)
        const info = this.buildCommercialFontInfo(metaPath, meta)
        fonts.push(info)
        seenPaths.add(info.path)
      } catch (error) {
        console.warn(`[font-service] Failed to read commercial font meta: ${metaPath}`, error.message)
      }
    }

    const encryptedFiles = await this.collectCommercialEncryptedFiles(dir)

    for (const encryptedPath of encryptedFiles) {
      if (seenPaths.has(encryptedPath)) continue
      fonts.push(this.buildCommercialFallbackInfo(encryptedPath))
    }

    const plainFontFiles = await this.collectFontFiles(dir)
    for (const filePath of plainFontFiles) {
      const parsed = await this.parseFontFile(filePath, 'commercial')
      fonts.push(...parsed)
    }

    return fonts.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  /**
   * @returns {Promise<FontInfo[]>}
   */
  async getAllFonts() {
    const [builtIn, downloaded, commercial] = await Promise.all([
      this.getBuiltInFonts(),
      this.getDownloadedFonts(),
      this.getCommercialFonts(),
    ])

    await this.flushDiskCache()

    return [...builtIn, ...downloaded, ...commercial]
  }

  /** @returns {string} */
  getResourcesBinDir() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin')
    }

    return path.join(PROJECT_ROOT, 'resources', 'bin')
  }

  /** @returns {string | null} */
  resolveSubsetBinaryPath() {
    const binDir = this.getResourcesBinDir()

    for (const name of SUBSET_BINARY_NAMES) {
      const candidate = path.join(binDir, name)
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    return null
  }

  /** @returns {string} */
  getSubsetScriptPath() {
    return path.join(this.getResourcesBinDir(), SUBSET_SCRIPT_NAME)
  }

  /**
   * @returns {Promise<string | null>}
   */
  async resolvePythonExecutable() {
    /** @type {string[]} */
    const candidates =
      process.platform === 'win32'
        ? ['python', 'python3', 'py']
        : ['python3', 'python']

    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, ['--version'], { timeout: 5_000 })
        return candidate
      } catch {
        // try next candidate
      }
    }

    return null
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  buildSubsetText(text) {
    if (typeof text !== 'string' || !text) {
      return SUBSET_BASE_CHARS
    }

    return [...new Set(`${text}${SUBSET_BASE_CHARS}`)].join('')
  }

  /**
   * @param {string} userId
   * @returns {string}
   */
  buildSubsetWatermark(userId) {
    const normalized = String(userId || '').trim() || 'anonymous'
    return `© WPX | User:${normalized} | Subset licensed for personal export only`
  }

  /**
   * @param {string} fontPath
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async applySubsetWatermark(fontPath, userId) {
    if (!fontPath || !userId) return

    const copyright = this.buildSubsetWatermark(userId)
    const scriptPath = this.getSubsetScriptPath()

    if (fs.existsSync(scriptPath)) {
      const pythonExecutable = await this.resolvePythonExecutable()
      if (pythonExecutable) {
        await execFileAsync(
          pythonExecutable,
          [scriptPath, '--patch-copyright', '--input', fontPath, '--copyright', copyright],
          { timeout: SUBSET_TIMEOUT_MS },
        )
        return
      }
    }

    try {
      const font = fontkit.openSync(fontPath)
      if (typeof font._tables?.name?.setName === 'function') {
        font._tables.name.setName(copyright, 0, 3, 1, 0x409)
        await fsp.writeFile(fontPath, Buffer.from(font.encode()))
      }
    } catch (error) {
      console.warn('[font-service] Failed to apply subset watermark:', error.message)
    }
  }

  /**
   * @param {string} fontPath
   * @returns {{ familyName: string, postscriptName: string | null }}
   */
  readFontNames(fontPath) {
    try {
      const font = fontkit.openSync(fontPath)
      return {
        familyName: font.familyName || path.basename(fontPath, path.extname(fontPath)),
        postscriptName: font.postscriptName || null,
      }
    } catch {
      return {
        familyName: path.basename(fontPath, path.extname(fontPath)),
        postscriptName: null,
      }
    }
  }

  /**
   * @param {string} exportFontId
   * @returns {Promise<FontInfo>}
   */
  async resolveExportFont(exportFontId) {
    if (typeof exportFontId !== 'string' || !exportFontId.trim()) {
      throw new Error('[font-service] exportFontId is required')
    }

    const normalizedId = exportFontId.trim()
    const allFonts = await this.getAllFonts()
    const normalizedLower = normalizedId.toLowerCase()

    for (const font of allFonts) {
      const candidates = [
        font.fontId,
        font.id?.replace(/^[^:]+:\s*/, ''),
        path.basename(font.path, path.extname(font.path)),
        font.path,
        font.family,
      ]
        .filter(Boolean)
        .map((value) => String(value))

      if (candidates.some((value) => value === normalizedId || value.toLowerCase() === normalizedLower)) {
        return font
      }
    }

    try {
      const commercialMeta = await this.readCommercialMeta(normalizeFontId(normalizedId))
      if (commercialMeta) {
        return this.buildCommercialFontInfo(
          this.getCommercialMetaPath(normalizeFontId(normalizedId)),
          commercialMeta,
        )
      }
    } catch {
      // ignore invalid commercial id
    }

    throw new Error(`[font-service] export font not found: ${normalizedId}`)
  }

  /**
   * @param {string} fontPath
   * @param {string} text
   * @param {string} outputPath
   * @returns {Promise<SubsetEngine>}
   */
  async subsetWithFonttoolsBinary(fontPath, text, outputPath) {
    const binaryPath = this.resolveSubsetBinaryPath()
    if (!binaryPath) {
      throw new Error('fonttools binary not found')
    }

    const binaryName = path.basename(binaryPath).toLowerCase()
    /** @type {string[]} */
    const args =
      binaryName.startsWith('pyftsubset')
        ? [fontPath, `--output-file=${outputPath}`, `--text=${text}`, '--layout-features=*']
        : ['--input', fontPath, '--output', outputPath, '--text', text]

    await execFileAsync(binaryPath, args, { timeout: SUBSET_TIMEOUT_MS })
    return 'fonttools'
  }

  /**
   * @param {string} fontPath
   * @param {string} text
   * @param {string} outputPath
   * @param {string} [copyright]
   * @returns {Promise<SubsetEngine>}
   */
  async subsetWithFonttoolsScript(fontPath, text, outputPath, copyright = '') {
    const scriptPath = this.getSubsetScriptPath()
    if (!fs.existsSync(scriptPath)) {
      throw new Error('subset_font.py not found')
    }

    const pythonExecutable = await this.resolvePythonExecutable()
    if (!pythonExecutable) {
      throw new Error('python executable not found')
    }

    /** @type {string[]} */
    const args = [scriptPath, '--input', fontPath, '--output', outputPath, '--text', text]
    if (copyright) {
      args.push('--copyright', copyright)
    }

    await execFileAsync(pythonExecutable, args, { timeout: SUBSET_TIMEOUT_MS })

    return 'fonttools'
  }

  /**
   * @param {string} fontPath
   * @param {string} text
   * @param {string} outputPath
   * @returns {Promise<SubsetEngine>}
   */
  async subsetWithHarfbuzz(fontPath, text, outputPath) {
    const subsetFont = require('subset-font')
    const inputBuffer = await fsp.readFile(fontPath)
    const ext = path.extname(fontPath).toLowerCase()
    const targetFormat = ext === '.woff2' ? 'woff2' : ext === '.woff' ? 'woff' : 'sfnt'
    const subsetBuffer = await subsetFont(inputBuffer, text, {
      targetFormat,
      preserveNameIds: [0, 1, 2, 3, 4, 5, 6],
    })

    await fsp.writeFile(outputPath, subsetBuffer)
    return 'harfbuzz'
  }

  /**
   * @param {string} fontPath
   * @param {string} text
   * @param {string} outputPath
   * @returns {Promise<SubsetEngine>}
   */
  async subsetWithFontkit(fontPath, text, outputPath) {
    const font = fontkit.openSync(fontPath)
    const run = font.layout(text)
    const subset = font.createSubset()
    const included = new Set()

    subset.includeGlyph(0)
    included.add(0)

    for (const glyph of run.glyphs) {
      if (included.has(glyph.id)) continue
      subset.includeGlyph(glyph)
      included.add(glyph.id)
    }

    await fsp.writeFile(outputPath, Buffer.from(subset.encode()))
    return 'fontkit'
  }

  /**
   * 提取 text 中出现的字符并生成子集化字体。
   * 优先 fonttools（resources/bin 可执行文件或 Python 脚本），备选 harfbuzzjs（subset-font），最后 fontkit。
   *
   * @param {string} fontPath
   * @param {string} text
   * @param {string} outputPath
   * @param {{ userId?: string }} [options]
   * @returns {Promise<SubsetFontResult>}
   */
  async subsetFont(fontPath, text, outputPath, options = {}) {
    if (!fontPath || typeof fontPath !== 'string') {
      throw new Error('[font-service] fontPath is required')
    }

    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error('[font-service] outputPath is required')
    }

    const sourceStat = await fsp.stat(fontPath)
    if (!sourceStat.isFile()) {
      throw new Error('[font-service] fontPath must be a file')
    }

    const ext = path.extname(fontPath).toLowerCase()
    if (!FONT_EXTENSIONS.has(ext)) {
      throw new Error('[font-service] only .ttf/.otf fonts can be subset')
    }

    const subsetText = this.buildSubsetText(text)
    const userId = typeof options.userId === 'string' ? options.userId.trim() : ''
    const copyright = userId ? this.buildSubsetWatermark(userId) : ''
    await fsp.mkdir(path.dirname(outputPath), { recursive: true })

    /** @type {Array<{ engine: SubsetEngine, run: () => Promise<SubsetEngine> }>} */
    const engines = [
      { engine: 'fonttools', run: () => this.subsetWithFonttoolsBinary(fontPath, subsetText, outputPath) },
      {
        engine: 'fonttools',
        run: () => this.subsetWithFonttoolsScript(fontPath, subsetText, outputPath, copyright),
      },
      { engine: 'harfbuzz', run: () => this.subsetWithHarfbuzz(fontPath, subsetText, outputPath) },
      { engine: 'fontkit', run: () => this.subsetWithFontkit(fontPath, subsetText, outputPath) },
    ]

    /** @type {Error[]} */
    const errors = []
    let usedEngine = null

    for (const candidate of engines) {
      try {
        usedEngine = await candidate.run()
        break
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }

    if (!usedEngine) {
      const detail = errors.map((error) => error.message).join('; ')
      throw new Error(`[font-service] font subsetting failed: ${detail}`)
    }

    if (userId && usedEngine !== 'fonttools') {
      await this.applySubsetWatermark(outputPath, userId)
    }

    const outputStat = await fsp.stat(outputPath)
    const names = this.readFontNames(outputPath)

    return {
      path: outputPath,
      size: outputStat.size,
      originalSize: sourceStat.size,
      engine: usedEngine,
      charCount: [...new Set(subsetText)].length,
      familyName: names.familyName,
    }
  }

  /**
   * @param {string} fontId
   * @param {string} text
   * @param {string} outputPath
   * @param {{ userId?: string }} [options]
   * @returns {Promise<SubsetFontResult>}
   */
  async subsetCommercialFont(fontId, text, outputPath, options = {}) {
    return this.withDecryptedFont(fontId, async (plainPath) => {
      const result = await this.subsetFont(plainPath, text, outputPath, options)
      return { ...result, fontId, source: 'commercial' }
    })
  }

  /**
   * 导出 PDF/DOCX 前的批量子集化集成点。
   *
   * @param {Array<{ path?: string, fontId?: string, text: string, outputName?: string }>} items
   * @param {string} outputDir
   * @param {{ userId?: string }} [options]
   * @returns {Promise<SubsetFontResult[]>}
   */
  async prepareExportFontSubsets(items, outputDir, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      return []
    }

    await fsp.mkdir(outputDir, { recursive: true })
    /** @type {SubsetFontResult[]} */
    const results = []

    for (const [index, item] of items.entries()) {
      if (!item || typeof item.text !== 'string') {
        throw new Error('[font-service] each embed font item requires text')
      }

      const sourceExt =
        typeof item.path === 'string' && path.extname(item.path)
          ? path.extname(item.path)
          : '.ttf'
      const outputName =
        typeof item.outputName === 'string' && item.outputName.trim()
          ? item.outputName.trim()
          : `subset-${index}${sourceExt}`
      const outputPath = path.join(outputDir, outputName)
      const subsetOptions = { userId: options.userId }

      if (typeof item.fontId === 'string' && item.fontId.trim()) {
        const exportFontId = item.fontId.trim()
        let resolved = null

        try {
          resolved = await this.resolveExportFont(exportFontId)
        } catch {
          resolved = null
        }

        if (resolved?.source === 'commercial') {
          const commercialId = resolved.fontId || exportFontId
          const result = await this.subsetCommercialFont(
            commercialId,
            item.text,
            outputPath,
            subsetOptions,
          )
          results.push({
            ...result,
            cssFamily: `'WPX-${commercialId}', sans-serif`,
          })
          continue
        }

        if (resolved?.path) {
          const result = await this.subsetFont(resolved.path, item.text, outputPath, subsetOptions)
          results.push({
            ...result,
            fontId: exportFontId,
            source: resolved.source,
            cssFamily: `'WPX-${exportFontId}', sans-serif`,
          })
          continue
        }

        throw new Error(`[font-service] export font not found: ${exportFontId}`)
      }

      if (typeof item.path === 'string' && item.path.trim()) {
        const result = await this.subsetFont(item.path.trim(), item.text, outputPath, subsetOptions)
        results.push(result)
        continue
      }

      throw new Error('[font-service] embed font item requires path or fontId')
    }

    return results
  }
}

const fontService = new FontService()

module.exports = fontService
module.exports.FontDecryptError = FontDecryptError
module.exports.FONT_DECRYPT_FAILED = FONT_DECRYPT_FAILED
module.exports.getDeviceFingerprint = getDeviceFingerprint
