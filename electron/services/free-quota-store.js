const crypto = require('node:crypto')

/** @typedef {{ date: string, count: number }} QuotaUsageRow */

/** @type {import('electron-store').default | null} */
let quotaStore = null

const DEFAULT_GUEST_DAILY_LIMIT = 50
const DEFAULT_USER_DAILY_LIMIT = 50

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
function getDailyLimit(isGuest) {
  if (!quotaStore) {
    return isGuest ? DEFAULT_GUEST_DAILY_LIMIT : DEFAULT_USER_DAILY_LIMIT
  }

  const limits = quotaStore.get('limits') || {}
  const configured = isGuest ? limits.guest : limits.user
  const fallback = isGuest ? DEFAULT_GUEST_DAILY_LIMIT : DEFAULT_USER_DAILY_LIMIT
  const value = Number(configured)
  return Number.isFinite(value) && value > 0 ? value : fallback
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
 * @param {string} subjectKey
 * @returns {QuotaUsageRow}
 */
function getUsageRow(subjectKey) {
  if (!quotaStore) {
    throw new Error('[free-quota-store] Store is not initialized')
  }

  const usage = quotaStore.get('usage') || {}
  const row = usage[subjectKey]
  const today = getTodayKey()

  if (!row || row.date !== today) {
    return { date: today, count: 0 }
  }

  return {
    date: today,
    count: Number(row.count) || 0,
  }
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
  const limit = getDailyLimit(isGuest)
  const row = getUsageRow(subjectKey)
  const used = Math.max(0, row.count)
  const remaining = Math.max(0, limit - used)

  return {
    ok: true,
    subjectKey,
    isGuest,
    limit,
    used,
    remaining,
    date: row.date,
  }
}

/**
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function consumeQuota(payload = {}) {
  const status = getQuotaStatus(payload)

  if (status.remaining <= 0) {
    return {
      ok: false,
      code: 'FREE_QUOTA_EXHAUSTED',
      ...status,
    }
  }

  const nextCount = status.used + 1
  setUsageRow(status.subjectKey, {
    date: status.date,
    count: nextCount,
  })

  return {
    ok: true,
    ...status,
    used: nextCount,
    remaining: Math.max(0, status.limit - nextCount),
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
        guest: DEFAULT_GUEST_DAILY_LIMIT,
        user: DEFAULT_USER_DAILY_LIMIT,
      },
      usage: {},
    },
  })
}

module.exports = {
  initFreeQuotaStore,
  getQuotaStatus,
  consumeQuota,
  resetGuestDeviceId,
  getOrCreateDeviceId,
  getDailyLimit,
  resolveSubjectKey,
  FREE_QUOTA_EXHAUSTED: 'FREE_QUOTA_EXHAUSTED',
}
