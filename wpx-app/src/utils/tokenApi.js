import { useAuthStore } from '@/stores/auth'
import { getLocalApiBase } from '@/utils/localApi'

export const TOKENS_PER_YUAN = 20
export const PRESET_RECHARGE_AMOUNT = 10

function getUserId() {
  if (typeof window === 'undefined') return 'local-user'
  return window.localStorage.getItem('wpx-user-id') || 'local-user'
}

function buildAuthHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  }

  try {
    const authStore = useAuthStore()
    const token = String(authStore.token || '').trim()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const userId = authStore.currentUser?.id
    if (userId) {
      headers['X-WPX-User-Id'] = String(userId)
      return headers
    }
  } catch {
    // Pinia 未初始化时回退到本地 user id
  }

  headers['X-WPX-User-Id'] = getUserId()
  return headers
}

async function parseError(response) {
  const payload = await response.json().catch(() => ({}))
  const detail = payload.details || payload.detail || payload.message
  const message = payload.error || `请求失败 (${response.status})`
  throw new Error(detail ? `${message}：${detail}` : message)
}

export function calcTokenCount(amount) {
  const normalized = Number(amount)
  if (!Number.isFinite(normalized) || normalized < 0) return 0
  return normalized * TOKENS_PER_YUAN
}

export async function fetchTokenBalance() {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    return 0
  }

  const response = await fetch(`${baseUrl}/api/token/balance`, {
    headers: buildAuthHeaders(),
  })

  if (!response.ok) {
    await parseError(response)
  }

  const payload = await response.json()
  return Number(payload.balance) || 0
}

export async function createTokenRechargeOrder(amount) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    throw new Error('本地服务不可用')
  }

  const response = await fetch(`${baseUrl}/api/token/recharge`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({ amount }),
  })

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}

export async function fetchRechargeOrderStatus(orderId) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    throw new Error('本地服务不可用')
  }

  const response = await fetch(`${baseUrl}/api/token/recharge/${encodeURIComponent(orderId)}/status`, {
    headers: buildAuthHeaders(),
  })

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}

export async function fetchRechargeRecords(limit = 50) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    return []
  }

  const response = await fetch(`${baseUrl}/api/token/recharge-records?limit=${limit}`, {
    headers: buildAuthHeaders(),
  })

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}

/**
 * @param {{ limit?: number, from?: string, to?: string }} [options]
 */
export async function fetchConsumeRecords(options = {}) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    return []
  }

  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.from) params.set('from', options.from)
  if (options.to) params.set('to', options.to)

  const query = params.toString()
  const response = await fetch(`${baseUrl}/api/token/records${query ? `?${query}` : ''}`, {
    headers: buildAuthHeaders(),
  })

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}

export async function simulateRechargePayment(orderId) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    throw new Error('本地服务不可用')
  }

  const response = await fetch(
    `${baseUrl}/api/token/recharge/${encodeURIComponent(orderId)}/simulate-pay`,
    {
      method: 'POST',
      headers: buildAuthHeaders(),
    },
  )

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}

export function formatRechargeStatus(status) {
  switch (status) {
    case 'paid':
      return '成功'
    case 'failed':
      return '失败'
    case 'pending':
    default:
      return '待支付'
  }
}

export function formatRecordTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function hashDocumentContent(content) {
  const text = String(content || '')
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return `fallback-${Math.abs(hash)}`
}

export async function previewTokenConsume(payload) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    throw new Error('本地服务不可用')
  }

  const response = await fetch(`${baseUrl}/api/token/consume/preview`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}

export async function consumeTokensForExport(payload) {
  const baseUrl = await getLocalApiBase()
  if (!baseUrl) {
    throw new Error('本地服务不可用')
  }

  const response = await fetch(`${baseUrl}/api/token/consume`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await parseError(response)
  }

  return response.json()
}
