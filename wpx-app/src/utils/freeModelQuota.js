const AI_BASE_URL = 'https://ai.proclaw.cc'
export const GUEST_FREE_MODEL_LABEL = 'WPX 免费模型（由 ai.proclaw.cc 提供）'
export const DEFAULT_GUEST_DAILY_LIMIT = 50

/**
 * @param {unknown} payload
 * @returns {{ limit: number, remaining: number | null, used: number | null }}
 */
function normalizeQuotaPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      limit: DEFAULT_GUEST_DAILY_LIMIT,
      remaining: null,
      used: null,
    }
  }

  const record = /** @type {Record<string, unknown>} */ (payload)
  const nested =
    record.data && typeof record.data === 'object'
      ? /** @type {Record<string, unknown>} */ (record.data)
      : record

  const limitRaw = nested.limit ?? nested.daily_limit ?? nested.dailyLimit ?? DEFAULT_GUEST_DAILY_LIMIT
  const limit = Number(limitRaw)
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_GUEST_DAILY_LIMIT

  const remainingRaw = nested.remaining ?? nested.remaining_count ?? nested.remainingCount
  const usedRaw = nested.used ?? nested.used_count ?? nested.usedCount

  let remaining = remainingRaw === undefined || remainingRaw === null ? null : Number(remainingRaw)
  let used = usedRaw === undefined || usedRaw === null ? null : Number(usedRaw)

  if (!Number.isFinite(remaining) && Number.isFinite(used)) {
    remaining = Math.max(0, safeLimit - used)
  }

  if (!Number.isFinite(used) && Number.isFinite(remaining)) {
    used = Math.max(0, safeLimit - remaining)
  }

  if (Number.isFinite(remaining)) {
    remaining = Math.max(0, Math.min(safeLimit, remaining))
  }

  return {
    limit: safeLimit,
    remaining: Number.isFinite(remaining) ? remaining : null,
    used: Number.isFinite(used) ? used : null,
  }
}

/**
 * 获取访客免费模型今日剩余调用次数。
 * @returns {Promise<{ limit: number, remaining: number | null, used: number | null }>}
 */
export async function fetchGuestFreeQuota() {
  try {
    const response = await fetch(`${AI_BASE_URL}/api/free/quota`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json()
    return normalizeQuotaPayload(payload)
  } catch {
    return {
      limit: DEFAULT_GUEST_DAILY_LIMIT,
      remaining: null,
      used: null,
    }
  }
}

/**
 * @param {{ limit: number, remaining: number | null }} quota
 */
export function formatGuestQuotaLabel(quota) {
  const limit = quota?.limit ?? DEFAULT_GUEST_DAILY_LIMIT
  if (quota?.remaining === null || quota?.remaining === undefined) {
    return `剩余 —/${limit} 次`
  }
  return `剩余 ${quota.remaining}/${limit} 次`
}
