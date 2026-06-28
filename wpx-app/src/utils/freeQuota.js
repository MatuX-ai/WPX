import { getElectronAPI, isElectron } from '@/utils/electron'

export const FREE_QUOTA_EXHAUSTED = 'FREE_QUOTA_EXHAUSTED'
// V1 完全免费模式：平台不再提供任何「公共模型」免费 Token 额度。
// 仅保留错误码与文桉常量以兼容历史调用方，但 limit 一律为 0。
export const FREE_QUOTA_MESSAGE =
  'V1 平台不提供公共模型额度，请前往「我的模型」接入大模型 API'

/** 访客不提供公共模型免费 Token */
export const DEFAULT_GUEST_DAILY_TOKEN_LIMIT = 0
/**
 * V1 完全免费模式：注册用户也不再享有平台免费 Token 额度，
 * 与访客一致、一律为 0。所有 AI 调用必须由用户自己接入 API。
 */
export const DEFAULT_USER_DAILY_TOKEN_LIMIT = 0

const WEB_QUOTA_KEY = 'wpx-free-quota-web'

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
 * @param {unknown} usage
 * @param {{ fallbackText?: string }} [options]
 */
export function resolveUsageTokens(usage, options = {}) {
  if (usage && typeof usage === 'object') {
    const record = /** @type {Record<string, unknown>} */ (usage)
    const total = Number(record.totalTokens ?? record.total_tokens)
    if (Number.isFinite(total) && total > 0) {
      return Math.ceil(total)
    }

    const input = Number(record.inputTokens ?? record.prompt_tokens) || 0
    const output = Number(record.outputTokens ?? record.completion_tokens) || 0
    if (input + output > 0) {
      return Math.ceil(input + output)
    }

    const raw = record.raw
    if (raw && typeof raw === 'object') {
      const rawRecord = /** @type {Record<string, unknown>} */ (raw)
      const rawTotal = Number(rawRecord.total_tokens ?? rawRecord.totalTokens)
      if (Number.isFinite(rawTotal) && rawTotal > 0) {
        return Math.ceil(rawTotal)
      }
    }
  }

  return estimateTokensFromText(options.fallbackText || '')
}

/**
 * @param {string} text
 */
export function estimateTokensFromText(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return 1
  return Math.max(1, Math.ceil(trimmed.length / 2))
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
 * @param {unknown} row
 * @param {string} today
 */
function normalizeWebUsageRow(row, today) {
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
 */
function readWebUsage(subjectKey) {
  const today = getTodayKey()

  if (typeof localStorage === 'undefined') {
    return { date: today, tokensUsed: 0 }
  }

  try {
    const raw = localStorage.getItem(WEB_QUOTA_KEY)
    if (!raw) return { date: today, tokensUsed: 0 }

    const parsed = JSON.parse(raw)
    return normalizeWebUsageRow(parsed?.[subjectKey], today)
  } catch {
    return { date: today, tokensUsed: 0 }
  }
}

/**
 * @param {string} subjectKey
 * @param {{ date: string, tokensUsed: number }} row
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
  const limit = isGuest ? DEFAULT_GUEST_DAILY_TOKEN_LIMIT : DEFAULT_USER_DAILY_TOKEN_LIMIT
  const row = readWebUsage(subjectKey)
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
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
function checkWebQuota(payload = {}) {
  const status = getWebQuotaStatus(payload)

  if (status.limit <= 0 || status.remaining <= 0) {
    return {
      ok: false,
      code: FREE_QUOTA_EXHAUSTED,
      ...status,
    }
  }

  return {
    ok: true,
    ...status,
  }
}

/**
 * @param {{ isGuest?: boolean, userId?: string | null, tokens?: number }} payload
 */
function consumeWebQuotaTokens(payload = {}) {
  const tokens = Math.max(0, Math.ceil(Number(payload.tokens) || 0))
  const status = getWebQuotaStatus(payload)

  if (tokens === 0) {
    return {
      ok: true,
      consumed: 0,
      ...status,
    }
  }

  const nextUsed = status.used + tokens
  writeWebUsage(status.subjectKey, {
    date: status.date,
    tokensUsed: nextUsed,
  })

  const refreshed = getWebQuotaStatus(payload)
  return {
    ok: true,
    consumed: tokens,
    ...refreshed,
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
 * 平台模型调用前检查是否仍有剩余 Token 额度。
 * @param {{ isGuest?: boolean, userId?: string | null }} payload
 */
export async function checkFreeQuota(payload = {}) {
  let result

  if (isElectron()) {
    const api = getElectronAPI()?.freeQuota
    if (api?.check) {
      result = await api.check(payload)
    } else {
      result = checkWebQuota(payload)
    }
  } else {
    result = checkWebQuota(payload)
  }

  if (!result?.ok && result?.code === FREE_QUOTA_EXHAUSTED) {
    throw new FreeQuotaExhaustedError(result)
  }

  return result
}

/**
 * 平台模型对话完成后，按实际 Token 数累加用量。
 * @param {{ isGuest?: boolean, userId?: string | null, tokens: number }} payload
 */
export async function consumeFreeQuotaTokens(payload = {}) {
  if (isElectron()) {
    const api = getElectronAPI()?.freeQuota
    if (api?.consumeTokens) {
      return api.consumeTokens(payload)
    }
  }

  return consumeWebQuotaTokens(payload)
}

/**
 * 格式化 Token 数量显示（如 1.2M、350K）。
 * @param {number} value
 */
export function formatTokenAmount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  if (num >= 1_000_000) {
    const millions = num / 1_000_000
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, '')}M`
  }
  if (num >= 1_000) {
    const thousands = num / 1_000
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}K`
  }
  return String(Math.round(num))
}

/**
 * 重置访客设备 ID，并清除该设备对应的 Token 用量。
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
