const crypto = require('node:crypto')

/** @typedef {{ date: string, tokensUsed: number }} QuotaUsageRow */

/** @type {import('electron-store').default | null} */
let quotaStore = null

/** 访客不提供公共模型免费 Token */
const DEFAULT_GUEST_DAILY_TOKEN_LIMIT = 0
/** 注册用户默认每日 100M Token */
const DEFAULT_USER_DAILY_TOKEN_LIMIT = 100_000_000

function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getOrCreateDeviceId() {
  if (!quotaStore) {
    throw new Error('[free-quota-store] Store is not initialized')
  }

  const existing = String(quotaStore.get('deviceId') || '').trim()
  if (existing) return existing

  const deviceId = crypto.randomUUID()
  quotaStore.set('deviceId', deviceId)
  return deviceId
}

/**
 * @param {boolean} isGuest
 */
function getDailyTokenLimit(isGuest) {
  if (!quotaStore) {
    return isGuest ? DEFAULT_GUEST_DAILY_TOKEN_LIMIT : DEFAULT_USER_DAILY_TOKEN_LIMIT
  }

  const limits = quotaStore.get('limits') || {}
  const configured = isGuest ? limits.guest : limits.user
  const fallback = isGuest ? DEFAULT_GUEST_DAILY_TOKEN_LIMIT : DEFAULT_USER_DAILY_TOKEN_LIMIT
  const value = Number(configured)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function resolveSubjectKey(payload = {}) {
  const isGuest = Boolean(payload.isGuest)
  const userId = String(payload.userId || '').trim()

  if (!isGuest && userId) {
    return `user:${userId}`
  }

  return `guest:${getOrCreateDeviceId()}`
}

/**
 * @param {unknown} row
 * @param {string} today
 * @returns {QuotaUsageRow}
 */
function normalizeUsageRow(row, today) {
  if (!row || typeof row !== 'object' || row.date !== today) {
    return { date: today, tokensUsed: 0 }
  }

  const record = /** @type {Record<string, unknown>} */ (row)
  if (Number.isFinite(Number(record.tokensUsed))) {
    return {
      date: today,
      tokensUsed: Math.max(0, Number(record.tokensUsed)),
    }
  }

  return { date: today, tokensUsed: 0 }
}

/**
 * @param {string} subjectKey
 * @returns {QuotaUsageRow}
 */
function getUsageRow(subjectKey) {
  if (!quotaStore) {
    throw new Error('[free-quota-store] Store is not initialized')
  }

  const usage = quotaStore.get('usage') || {}
  const today = getTodayKey()
  return normalizeUsageRow(usage[subjectKey], today)
}

/**
 * @param {string} subjectKey
 * @param {QuotaUsageRow} row
 */
function setUsageRow(subjectKey, row) {
  if (!quotaStore) {
    throw new Error('[free-quota-store] Store is not initialized')
  }

  const usage = quotaStore.get('usage') || {}
  usage[subjectKey] = row
  quotaStore.set('usage', usage)
}

/**
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function getQuotaStatus(payload = {}) {
  const isGuest = Boolean(payload.isGuest)
  const subjectKey = resolveSubjectKey(payload)
  const limit = getDailyTokenLimit(isGuest)
  const row = getUsageRow(subjectKey)
  const used = Math.max(0, row.tokensUsed)
  const remaining = Math.max(0, limit - used)

  return {
    ok: true,
    subjectKey,
    isGuest,
    limit,
    used,
    remaining,
    date: row.date,
    unit: 'token',
  }
}

/**
 * 调用平台模型前检查是否仍有剩余 Token 额度。
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function checkQuotaAvailable(payload = {}) {
  const status = getQuotaStatus(payload)

  if (status.limit <= 0 || status.remaining <= 0) {
    return {
      ok: false,
      code: 'FREE_QUOTA_EXHAUSTED',
      ...status,
    }
  }

  return {
    ok: true,
    ...status,
  }
}

/**
 * 对话完成后按实际 Token 数累加用量（允许末次请求略超剩余额度）。
 * @param {{ isGuest?: boolean, userId?: string | null, tokens?: number }} payload
 */
function consumeQuotaTokens(payload = {}) {
  const tokens = Math.max(0, Math.ceil(Number(payload.tokens) || 0))
  const status = getQuotaStatus(payload)

  if (tokens === 0) {
    return {
      ok: true,
      consumed: 0,
      ...status,
    }
  }

  const nextUsed = status.used + tokens
  setUsageRow(status.subjectKey, {
    date: status.date,
    tokensUsed: nextUsed,
  })

  const refreshed = getQuotaStatus(payload)
  return {
    ok: true,
    consumed: tokens,
    ...refreshed,
  }
}

function resetGuestDeviceId() {
  if (!quotaStore) {
    throw new Error('[free-quota-store] Store is not initialized')
  }

  const oldDeviceId = String(quotaStore.get('deviceId') || '').trim()
  const usage = quotaStore.get('usage') || {}

  if (oldDeviceId) {
    delete usage[`guest:${oldDeviceId}`]
  }

  const newDeviceId = crypto.randomUUID()
  quotaStore.set('deviceId', newDeviceId)
  quotaStore.set('usage', usage)

  return {
    ok: true,
    deviceId: newDeviceId,
    previousDeviceId: oldDeviceId || null,
  }
}

async function initFreeQuotaStore() {
  if (quotaStore) return

  const { default: Store } = await import('electron-store')
  quotaStore = new Store({
    name: 'free-quota',
    defaults: {
      deviceId: '',
      limits: {
        guest: DEFAULT_GUEST_DAILY_TOKEN_LIMIT,
        user: DEFAULT_USER_DAILY_TOKEN_LIMIT,
      },
      usage: {},
    },
  })
}

module.exports = {
  initFreeQuotaStore,
  getQuotaStatus,
  checkQuotaAvailable,
  consumeQuotaTokens,
  resetGuestDeviceId,
  getOrCreateDeviceId,
  getDailyTokenLimit,
  resolveSubjectKey,
  DEFAULT_GUEST_DAILY_TOKEN_LIMIT,
  DEFAULT_USER_DAILY_TOKEN_LIMIT,
  FREE_QUOTA_EXHAUSTED: 'FREE_QUOTA_EXHAUSTED',
}
