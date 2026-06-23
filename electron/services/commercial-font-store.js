const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const CDN_BASE_URL = (process.env.WPX_FONT_CDN_BASE || 'https://cdn.wpx.app/commercial-fonts').replace(
  /\/$/,
  '',
)

/**
 * @typedef {Object} CommercialFont
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} preview_url
 * @property {string} thumbnail_url
 * @property {string} vendor
 * @property {number} price_per_char
 * @property {string} description
 * @property {string} sample_text
 * @property {string} font_file_url
 * @property {string[]} tags
 */

/**
 * @typedef {Object} PurchasedFontRecord
 * @property {string} id
 * @property {string} user_id
 * @property {string} font_id
 * @property {string} purchased_at
 */

/** @type {CommercialFont[]} */
const SEED_COMMERCIAL_FONTS = [
  {
    id: 'founder-lanting-hei',
    name: '方正兰亭黑',
    category: '黑体',
    vendor: '方正字库',
    price_per_char: 1,
    description: '现代商务黑体，结构稳定，适合正文与标题混排。',
    sample_text: '方正兰亭黑 · 现代商务文档首选',
    tags: ['商务', '正文', '标题'],
  },
  {
    id: 'hyqihe-x-hei',
    name: '汉仪旗黑',
    category: '黑体',
    vendor: '汉仪字库',
    price_per_char: 1,
    description: '字形端正、识别度高，适合报告、方案与品牌宣传物料。',
    sample_text: '汉仪旗黑 · 清晰有力的现代黑体',
    tags: ['报告', '品牌', '黑体'],
  },
  {
    id: 'makefont-langsong',
    name: '造字工房朗宋',
    category: '宋体',
    vendor: '造字工房',
    price_per_char: 1,
    description: '笔画爽利，兼具宋体韵味与当代阅读节奏。',
    sample_text: '造字工房朗宋 · 书卷气与可读性并存',
    tags: ['宋体', '书籍', '长文'],
  },
  {
    id: 'aa-shuang-body',
    name: 'Aa字库爽体',
    category: '手写',
    vendor: 'Aa字库',
    price_per_char: 1,
    description: '轻松手写风格，适合笔记、请柬与生活方式类内容。',
    sample_text: 'Aa字库爽体 · 轻松自然的手写感',
    tags: ['手写', '笔记', '生活'],
  },
  {
    id: 'founder-qingkeben',
    name: '方正清刻本悦宋',
    category: '宋体',
    vendor: '方正字库',
    price_per_char: 1,
    description: '源自刻本灵感，适合出版物、文化类专题与深度阅读。',
    sample_text: '方正清刻本悦宋 · 刻本韵味的现代宋体',
    tags: ['宋体', '出版', '文化'],
  },
  {
    id: 'hyrun-yuan',
    name: '汉仪润圆',
    category: '装饰',
    vendor: '汉仪字库',
    price_per_char: 1,
    description: '圆润柔和，适合儿童、食品、活动海报等亲和场景。',
    sample_text: '汉仪润圆 · 圆润亲和的装饰字体',
    tags: ['圆体', '海报', '亲和'],
  },
  {
    id: 'makefont-shanghei',
    name: '造字工房尚黑',
    category: '黑体',
    vendor: '造字工房',
    price_per_char: 1,
    description: '几何感强，适合科技、产品发布与 UI 标题。',
    sample_text: '造字工房尚黑 · 科技感现代黑体',
    tags: ['科技', '标题', '黑体'],
  },
  {
    id: 'aa-thick-black',
    name: 'Aa厚底黑',
    category: '装饰',
    vendor: 'Aa字库',
    price_per_char: 1,
    description: '厚重有力的展示型黑体，适合封面、Banner 与短视频标题。',
    sample_text: 'Aa厚底黑 · 视觉冲击力展示字',
    tags: ['展示', '封面', '装饰'],
  },
].map((font) => ({
  ...font,
  preview_url: `${CDN_BASE_URL}/${font.id}/preview.png`,
  thumbnail_url: `${CDN_BASE_URL}/${font.id}/thumb.png`,
  font_file_url: `${CDN_BASE_URL}/${font.id}/font.otf`,
}))

function createEmptyPurchaseDatabase() {
  return {
    user_purchased_fonts: [],
  }
}

class CommercialFontStore {
  /**
   * @param {string} userDataPath
   */
  constructor(userDataPath) {
    this.dbPath = path.join(userDataPath, 'fonts', 'commercial-store.json')
    /** @type {{ user_purchased_fonts: PurchasedFontRecord[] }} */
    this.data = createEmptyPurchaseDatabase()
    /** @type {Promise<void>} */
    this.lock = Promise.resolve()
  }

  async init() {
    await fsp.mkdir(path.dirname(this.dbPath), { recursive: true })

    if (fs.existsSync(this.dbPath)) {
      const raw = await fsp.readFile(this.dbPath, 'utf8')
      const parsed = JSON.parse(raw)
      this.data = {
        user_purchased_fonts: Array.isArray(parsed.user_purchased_fonts)
          ? parsed.user_purchased_fonts
          : [],
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

  /**
   * @returns {Array<Pick<CommercialFont, 'id' | 'name' | 'category' | 'preview_url' | 'thumbnail_url' | 'vendor' | 'price_per_char'>>}
   */
  listCommercialFonts() {
    return SEED_COMMERCIAL_FONTS.map(
      ({ id, name, category, preview_url, thumbnail_url, vendor, price_per_char }) => ({
        id,
        name,
        category,
        preview_url,
        thumbnail_url,
        vendor,
        price_per_char,
      }),
    )
  }

  /**
   * @param {string} fontId
   * @returns {CommercialFont | null}
   */
  getCommercialFontById(fontId) {
    return SEED_COMMERCIAL_FONTS.find((font) => font.id === fontId) ?? null
  }

  /**
   * @param {string} userId
   * @param {string} fontId
   * @returns {boolean}
   */
  hasUserPurchasedFont(userId, fontId) {
    return this.data.user_purchased_fonts.some(
      (item) => item.user_id === userId && item.font_id === fontId,
    )
  }

  /**
   * @param {string} userId
   * @param {string} fontId
   * @returns {Promise<PurchasedFontRecord>}
   */
  async recordPurchase(userId, fontId) {
    return this.withLock(async () => {
      const existing = this.data.user_purchased_fonts.find(
        (item) => item.user_id === userId && item.font_id === fontId,
      )
      if (existing) return existing

      const record = {
        id: randomUUID(),
        user_id: userId,
        font_id: fontId,
        purchased_at: new Date().toISOString(),
      }

      this.data.user_purchased_fonts.push(record)
      await this.save()
      return record
    })
  }

  /**
   * @param {string} userId
   * @returns {Promise<PurchasedFontRecord[]>}
   */
  async listUserPurchasedFonts(userId) {
    return this.withLock(async () => {
      return this.data.user_purchased_fonts.filter((item) => item.user_id === userId)
    })
  }
}

/** @type {CommercialFontStore | null} */
let commercialFontStore = null

/**
 * @param {string} userDataPath
 */
async function initCommercialFontStore(userDataPath) {
  commercialFontStore = new CommercialFontStore(userDataPath)
  await commercialFontStore.init()
  return commercialFontStore
}

function getCommercialFontStore() {
  if (!commercialFontStore) {
    throw new Error('[commercial-font-store] Store is not initialized')
  }
  return commercialFontStore
}

module.exports = {
  CDN_BASE_URL,
  SEED_COMMERCIAL_FONTS,
  CommercialFontStore,
  initCommercialFontStore,
  getCommercialFontStore,
}
