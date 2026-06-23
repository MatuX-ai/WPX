const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const TOKENS_PER_YUAN = 20

/** @typedef {'pending' | 'paid' | 'failed'} RechargeStatus */

/**
 * @typedef {Object} UserTokenRow
 * @property {string} user_id
 * @property {number} balance
 */

/**
 * @typedef {Object} RechargeRecord
 * @property {string} id
 * @property {string} user_id
 * @property {number} amount
 * @property {number} token_count
 * @property {string | null} payment_id
 * @property {RechargeStatus} status
 * @property {string} created_at
 */

/**
 * @typedef {Object} ConsumeRecord
 * @property {string} id
 * @property {string} user_id
 * @property {string} font_id
 * @property {number} char_count
 * @property {number} token_used
 * @property {string} doc_hash
 * @property {string | null} doc_name
 * @property {string} created_at
 */

/**
 * @typedef {Object} TokenDatabase
 * @property {UserTokenRow[]} user_tokens
 * @property {RechargeRecord[]} token_recharge_records
 * @property {ConsumeRecord[]} token_consume_records
 */

function createEmptyDatabase() {
  return {
    user_tokens: [],
    token_recharge_records: [],
    token_consume_records: [],
  }
}

class TokenStore {
  /**
   * @param {string} userDataPath
   */
  constructor(userDataPath) {
    this.dbPath = path.join(userDataPath, 'tokens', 'token-db.json')
    /** @type {TokenDatabase} */
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
        user_tokens: Array.isArray(parsed.user_tokens) ? parsed.user_tokens : [],
        token_recharge_records: Array.isArray(parsed.token_recharge_records)
          ? parsed.token_recharge_records
          : [],
        token_consume_records: Array.isArray(parsed.token_consume_records)
          ? parsed.token_consume_records
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
   * @returns {Promise<T>}
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
   * @param {string} userId
   * @returns {UserTokenRow}
   */
  ensureUserTokenRow(userId) {
    let row = this.data.user_tokens.find((item) => item.user_id === userId)
    if (!row) {
      row = { user_id: userId, balance: 0 }
      this.data.user_tokens.push(row)
    }
    return row
  }

  /**
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getBalance(userId) {
    return this.withLock(async () => {
      const row = this.ensureUserTokenRow(userId)
      await this.save()
      return row.balance
    })
  }

  /**
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<RechargeRecord>}
   */
  async createRechargeOrder(userId, amount) {
    return this.withLock(async () => {
      this.ensureUserTokenRow(userId)

      const record = {
        id: randomUUID(),
        user_id: userId,
        amount,
        token_count: amount * TOKENS_PER_YUAN,
        payment_id: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }

      this.data.token_recharge_records.push(record)
      await this.save()
      return record
    })
  }

  /**
   * @param {string} orderId
   * @returns {RechargeRecord | null}
   */
  findRechargeRecord(orderId) {
    return this.data.token_recharge_records.find((item) => item.id === orderId) ?? null
  }

  /**
   * @param {string} orderId
   * @param {string} paymentId
   * @returns {Promise<{ record: RechargeRecord, balance: number } | null>}
   */
  async completeRecharge(orderId, paymentId) {
    return this.withLock(async () => {
      const record = this.findRechargeRecord(orderId)
      if (!record) return null

      if (record.status === 'paid') {
        const row = this.ensureUserTokenRow(record.user_id)
        return { record, balance: row.balance }
      }

      record.status = 'paid'
      record.payment_id = paymentId

      const row = this.ensureUserTokenRow(record.user_id)
      row.balance += record.token_count

      await this.save()
      return { record, balance: row.balance }
    })
  }

  /**
   * @param {string} userId
   * @param {string} fontId
   * @param {string} docHash
   * @returns {ConsumeRecord | null}
   */
  findRecentConsumeRecord(userId, fontId, docHash) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS

    const matches = this.data.token_consume_records
      .filter(
        (item) =>
          item.user_id === userId &&
          item.font_id === fontId &&
          item.doc_hash === docHash &&
          Date.parse(item.created_at) >= cutoff,
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

    return matches[0] ?? null
  }

  /**
   * @param {string} userId
   * @param {Array<{ font_id: string, char_count: number }>} fonts
   * @param {string} docHash
   * @returns {{ skippedFonts: string[], chargePlan: Array<{ font_id: string, char_count: number, token_used: number }> }}
   */
  buildConsumePlan(userId, fonts, docHash) {
    /** @type {string[]} */
    const skippedFonts = []
    /** @type {Array<{ font_id: string, char_count: number, token_used: number }>} */
    const chargePlan = []

    for (const item of fonts) {
      const existing = this.findRecentConsumeRecord(userId, item.font_id, docHash)
      if (existing) {
        skippedFonts.push(item.font_id)
        continue
      }

      const tokenUsed = Math.max(0, Math.floor(Number(item.char_count) || 0))
      if (tokenUsed === 0) continue

      chargePlan.push({
        font_id: item.font_id,
        char_count: tokenUsed,
        token_used: tokenUsed,
      })
    }

    return { skippedFonts, chargePlan }
  }

  /**
   * @param {string} userId
   * @param {Array<{ font_id: string, char_count: number }>} fonts
   * @param {string} docHash
   * @returns {Promise<{
   *   success: boolean,
   *   balance: number,
   *   total_consumed: number,
   *   already_consumed: boolean,
   *   skipped_fonts: string[],
   *   charged_fonts: Array<{ font_id: string, char_count: number, token_used: number }>,
   *   sufficient: boolean,
   * }>}
   */
  async estimateConsumeTokens(userId, fonts, docHash) {
    return this.withLock(async () => {
      const row = this.ensureUserTokenRow(userId)
      const { skippedFonts, chargePlan } = this.buildConsumePlan(userId, fonts, docHash)
      const totalConsumed = chargePlan.reduce((sum, item) => sum + item.token_used, 0)

      return {
        success: true,
        balance: row.balance,
        total_consumed: totalConsumed,
        already_consumed: chargePlan.length === 0 && skippedFonts.length > 0,
        skipped_fonts: skippedFonts,
        charged_fonts: chargePlan,
        sufficient: row.balance >= totalConsumed,
      }
    })
  }

  /**
   * @param {string} userId
   * @param {Array<{ font_id: string, char_count: number }>} fonts
   * @param {string} docHash
   * @param {string | null | undefined} docName
   * @returns {Promise<{
   *   success: boolean,
   *   balance_after: number,
   *   total_consumed: number,
   *   already_consumed: boolean,
   *   skipped_fonts: string[],
   *   charged_fonts: Array<{ font_id: string, char_count: number, token_used: number }>,
   * }>}
   */
  async consumeTokens(userId, fonts, docHash, docName = null) {
    return this.withLock(async () => {
      const row = this.ensureUserTokenRow(userId)
      const normalizedDocName =
        typeof docName === 'string' && docName.trim() ? docName.trim().slice(0, 200) : null
      const { skippedFonts, chargePlan } = this.buildConsumePlan(userId, fonts, docHash)

      if (chargePlan.length === 0) {
        return {
          success: true,
          balance_after: row.balance,
          total_consumed: 0,
          already_consumed: skippedFonts.length > 0,
          skipped_fonts: skippedFonts,
          charged_fonts: [],
        }
      }

      const totalConsumed = chargePlan.reduce((sum, item) => sum + item.token_used, 0)
      if (row.balance < totalConsumed) {
        const error = new Error('Token 余额不足')
        error.code = 'TOKEN_INSUFFICIENT'
        throw error
      }

      row.balance -= totalConsumed
      const createdAt = new Date().toISOString()

      for (const item of chargePlan) {
        this.data.token_consume_records.push({
          id: randomUUID(),
          user_id: userId,
          font_id: item.font_id,
          char_count: item.char_count,
          token_used: item.token_used,
          doc_hash: docHash,
          doc_name: normalizedDocName,
          created_at: createdAt,
        })
      }

      await this.save()

      return {
        success: true,
        balance_after: row.balance,
        total_consumed: totalConsumed,
        already_consumed: false,
        skipped_fonts: skippedFonts,
        charged_fonts: chargePlan,
      }
    })
  }

  /**
   * @param {string} userId
   * @param {{ limit?: number }} [options]
   * @returns {Promise<Array<{ id: string, amount: number, token_count: number, status: RechargeStatus, payment_id: string | null, created_at: string }>>}
   */
  async listRechargeRecords(userId, options = {}) {
    return this.withLock(async () => {
      const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : 100

      return this.data.token_recharge_records
        .filter((item) => item.user_id === userId)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          amount: item.amount,
          token_count: item.token_count,
          status: item.status,
          payment_id: item.payment_id,
          created_at: item.created_at,
        }))
    })
  }

  /**
   * @param {string} userId
   * @param {{ limit?: number, from?: string, to?: string }} [options]
   * @returns {Promise<Array<{ id: string, font_id: string, char_count: number, token_used: number, doc_hash: string, doc_name: string | null, created_at: string }>>}
   */
  async listConsumeRecords(userId, options = {}) {
    return this.withLock(async () => {
      const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : 100
      const fromTime =
        typeof options.from === 'string' && options.from.trim()
          ? Date.parse(options.from)
          : Number.NaN
      const toTime =
        typeof options.to === 'string' && options.to.trim() ? Date.parse(options.to) : Number.NaN

      return this.data.token_consume_records
        .filter((item) => {
          if (item.user_id !== userId) return false

          const createdAt = Date.parse(item.created_at)
          if (Number.isFinite(fromTime) && createdAt < fromTime) return false
          if (Number.isFinite(toTime) && createdAt > toTime) return false

          return true
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          font_id: item.font_id,
          char_count: item.char_count,
          token_used: item.token_used,
          doc_hash: item.doc_hash,
          doc_name: item.doc_name ?? null,
          created_at: item.created_at,
        }))
    })
  }
}

/** @type {TokenStore | null} */
let tokenStore = null

/**
 * @param {string} userDataPath
 */
async function initTokenStore(userDataPath) {
  tokenStore = new TokenStore(userDataPath)
  await tokenStore.init()
  return tokenStore
}

function getTokenStore() {
  if (!tokenStore) {
    throw new Error('[token-store] Token store is not initialized')
  }
  return tokenStore
}

module.exports = {
  DEDUP_WINDOW_MS,
  TOKENS_PER_YUAN,
  TokenStore,
  initTokenStore,
  getTokenStore,
}
