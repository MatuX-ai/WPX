import { getElectronAPI, isElectron } from '@/utils/electron'

export const FREE_QUOTA_EXHAUSTED = 'FREE_QUOTA_EXHAUSTED'
export const FREE_QUOTA_MESSAGE =
  '今日免费次数已用完，请明天再试或登录获取更多次数'

const WEB_QUOTA_KEY = 'wpx-free-quota-web'
const DEFAULT_GUEST_DAILY_LIMIT = 50
const DEFAULT_USER_DAILY_LIMIT = 50

export class FreeQuotaExhaustedError extends Error {
  /**
   * @param {Record<string, unknown>} [details]
   */
  constructor(details = {}) {
    super(FREE_QUOTA_MESSAGE)
    this.name = 'FreeQuotaExhaustedError'
    this.code = FREE_QUOTA_EXHAUSTED
    this.details = details
  }
}

function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function resolveWebSubjectKey(payload = {}) {
  const isGuest = Boolean(payload.isGuest)
  const userId = String(payload.userId || '').trim()

  if (!isGuest && userId) {
    return `user:${userId}`
  }

  let deviceId = ''
  if (typeof localStorage !== 'undefined') {
    deviceId = localStorage.getItem('wpx-device-id') || ''
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('wpx-device-id', deviceId)
    }
  }

  return `guest:${deviceId || 'web'}`
}

/**
 * @param {string} subjectKey
 */
function readWebUsage(subjectKey) {
  if (typeof localStorage === 'undefined') {
    return { date: getTodayKey(), count: 0 }
  }

  try {
    const raw = localStorage.getItem(WEB_QUOTA_KEY)
    if (!raw) return { date: getTodayKey(), count: 0 }

    const parsed = JSON.parse(raw)
    const row = parsed?.[subjectKey]
    const today = getTodayKey()

    if (!row || row.date !== today) {
      return { date: today, count: 0 }
    }

    return { date: today, count: Number(row.count) || 0 }
  } catch {
    return { date: getTodayKey(), count: 0 }
  }
}

/**
 * @param {string} subjectKey
 * @param {{ date: string, count: number }} row
 */
function writeWebUsage(subjectKey, row) {
  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem(WEB_QUOTA_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[subjectKey] = row
    localStorage.setItem(WEB_QUOTA_KEY, JSON.stringify(parsed))
  } catch {
    // ignore persistence errors in web fallback
  }
}

/**
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function getWebQuotaStatus(payload = {}) {
  const isGuest = Boolean(payload.isGuest)
  const subjectKey = resolveWebSubjectKey(payload)
  const limit = isGuest ? DEFAULT_GUEST_DAILY_LIMIT : DEFAULT_USER_DAILY_LIMIT
  const row = readWebUsage(subjectKey)
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
function consumeWebQuota(payload = {}) {
  const status = getWebQuotaStatus(payload)

  if (status.remaining <= 0) {
    return {
      ok: false,
      code: FREE_QUOTA_EXHAUSTED,
      ...status,
    }
  }

  const nextCount = status.used + 1
  writeWebUsage(status.subjectKey, {
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

/**
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
export async function getFreeQuotaStatus(payload = {}) {
  if (isElectron()) {
    const api = getElectronAPI()?.freeQuota
    if (api?.getStatus) {
      return api.getStatus(payload)
    }
  }

  return getWebQuotaStatus(payload)
}

/**
 * 平台模型调用前检查并消耗一次免费额度。
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
export async function consumeFreeQuota(payload = {}) {
  let result

  if (isElectron()) {
    const api = getElectronAPI()?.freeQuota
    if (api?.consume) {
      result = await api.consume(payload)
    } else {
      result = consumeWebQuota(payload)
    }
  } else {
    result = consumeWebQuota(payload)
  }

  if (!result?.ok && result?.code === FREE_QUOTA_EXHAUSTED) {
    throw new FreeQuotaExhaustedError(result)
  }

  return result
}

/**
 * 重置访客设备 ID，并清除该设备对应的免费次数计数。
 * @returns {Promise<{ ok: boolean, deviceId?: string, previousDeviceId?: string | null }>}
 */
export async function resetGuestDeviceId() {
  if (isElectron()) {
    const api = getElectronAPI()?.freeQuota
    if (api?.resetDeviceId) {
      return api.resetDeviceId()
    }
  }

  if (typeof localStorage === 'undefined') {
    return { ok: true, deviceId: 'web' }
  }

  const oldDeviceId = localStorage.getItem('wpx-device-id') || ''
  const oldKey = oldDeviceId ? `guest:${oldDeviceId}` : ''

  if (oldKey) {
    try {
      const raw = localStorage.getItem(WEB_QUOTA_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      delete parsed[oldKey]
      localStorage.setItem(WEB_QUOTA_KEY, JSON.stringify(parsed))
    } catch {
      // ignore persistence errors in web fallback
    }
  }

  const newDeviceId = crypto.randomUUID()
  localStorage.setItem('wpx-device-id', newDeviceId)

  return {
    ok: true,
    deviceId: newDeviceId,
    previousDeviceId: oldDeviceId || null,
  }
}
