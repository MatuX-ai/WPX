const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

function createEmptyDatabase() {
  return {
    disabledFontIds: [],
  }
}

class FontPreferencesStore {
  /**
   * @param {string} userDataPath
   */
  constructor(userDataPath) {
    this.dbPath = path.join(userDataPath, 'fonts', 'font-preferences.json')
    /** @type {{ disabledFontIds: string[] }} */
    this.data = createEmptyDatabase()
    /** @type {Promise<void>} */
    this.lock = Promise.resolve()
  }

  async init() {
    await fsp.mkdir(path.dirname(this.dbPath), { recursive: true })

    if (fs.existsSync(this.dbPath)) {
      const raw = await fsp.readFile(this.dbPath, 'utf8')
      const parsed = JSON.parse(raw)
      this.data = {
        disabledFontIds: Array.isArray(parsed.disabledFontIds) ? parsed.disabledFontIds : [],
      }
      return
    }

    await this.save()
  }

  async save() {
    const tempPath = `${this.dbPath}.${randomUUID()}.tmp`
    await fsp.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8')
    await fsp.rename(tempPath, this.dbPath)
  }

  /**
   * @template T
   * @param {() => Promise<T>} task
   */
  async withLock(task) {
    const next = this.lock.then(task)
    this.lock = next.then(
      () => {},
      () => {},
    )
    return next
  }

  getDisabledFontIds() {
    return [...this.data.disabledFontIds]
  }

  isEnabled(fontId) {
    return !this.data.disabledFontIds.includes(fontId)
  }

  /**
   * @param {string} fontId
   * @param {boolean} enabled
   */
  async setFontEnabled(fontId, enabled) {
    return this.withLock(async () => {
      const normalizedId = String(fontId || '').trim()
      if (!normalizedId) {
        throw new Error('fontId 无效')
      }

      const disabled = new Set(this.data.disabledFontIds)
      if (enabled) {
        disabled.delete(normalizedId)
      } else {
        disabled.add(normalizedId)
      }

      this.data.disabledFontIds = [...disabled]
      await this.save()
      return this.getDisabledFontIds()
    })
  }
}

/** @type {FontPreferencesStore | null} */
let fontPreferencesStore = null

/**
 * @param {string} userDataPath
 */
async function initFontPreferencesStore(userDataPath) {
  fontPreferencesStore = new FontPreferencesStore(userDataPath)
  await fontPreferencesStore.init()
  return fontPreferencesStore
}

function getFontPreferencesStore() {
  if (!fontPreferencesStore) {
    throw new Error('[font-preferences-store] Store is not initialized')
  }
  return fontPreferencesStore
}

module.exports = {
  FontPreferencesStore,
  initFontPreferencesStore,
  getFontPreferencesStore,
}
