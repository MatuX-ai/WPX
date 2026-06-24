import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useAuthModalStore } from '@/stores/authModal'
import { getElectronAPI, isElectron } from '@/utils/electron'

// WPX 自托管邮箱认证：统一走主域名 https://prowpx.com
// 旧版 account.proclaw.cc 已下线，所有认证接口由本项目后端提供
const ACCOUNT_BASE_URL = 'https://prowpx.com'
const AUTH_FETCH_TIMEOUT_MS = 10000

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @typedef {{ id: string, nickname: string, avatar: string }} AuthUser
 */

/**
 * @param {unknown} user
 * @returns {AuthUser | null}
 */
function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null

  const id = /** @type {{ id?: unknown }} */ (user).id
  if (id === undefined || id === null || String(id).trim() === '') {
    return null
  }

  return {
    id: String(id),
    nickname: String(/** @type {{ nickname?: unknown }} */ (user).nickname || '').trim() || '用户',
    avatar: String(/** @type {{ avatar?: unknown }} */ (user).avatar || '').trim(),
  }
}

/**
 * @param {unknown} payload
 */
function extractProfileUser(payload) {
  if (!payload || typeof payload !== 'object') return null

  const record = /** @type {Record<string, unknown>} */ (payload)
  const nested = record.user || record.data || record.profile
  if (nested && typeof nested === 'object') {
    return normalizeUser(nested)
  }

  return normalizeUser(record)
}

/**
 * @param {unknown} payload
 */
function extractTokens(payload) {
  if (!payload || typeof payload !== 'object') return null

  const record = /** @type {Record<string, unknown>} */ (payload)
  const nested =
    record.data && typeof record.data === 'object'
      ? /** @type {Record<string, unknown>} */ (record.data)
      : record

  const token = nested.token || nested.access_token || nested.accessToken
  if (!token) return null

  const refreshToken = nested.refresh_token || nested.refreshToken

  return {
    token: String(token).trim(),
    refreshToken: refreshToken ? String(refreshToken).trim() : '',
  }
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, refreshToken: string, user: AuthUser | null }>}
 */
export async function loginWithCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPassword = String(password || '')

  if (!normalizedEmail) {
    throw new Error('请输入邮箱')
  }
  if (!normalizedPassword) {
    throw new Error('请输入密码')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('邮箱格式不正确')
  }

  let response
  try {
    response = await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: normalizedPassword
      })
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('登录请求超时，请稍后重试')
    }
    throw new Error('无法连接登录服务，请检查网络')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    // 后端可能返回纯文本错误
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && (
        payload.message ||
        payload.error?.message ||
        payload.error
      )) ||
      `登录失败（HTTP ${response.status}）`
    throw new Error(String(message))
  }

  const tokens = extractTokens(payload)
  if (!tokens?.token) {
    throw new Error('登录响应缺少访问令牌，请联系管理员')
  }

  const user = extractProfileUser(payload) || {
    id: 'pending',
    nickname: normalizedEmail.split('@')[0] || '用户',
    avatar: ''
  }

  return {
    token: tokens.token,
    refreshToken: tokens.refreshToken || '',
    user
  }
}

/**
 * @param {{ email: string, password: string, nickname?: string }} payload
 * @returns {Promise<{ token: string, refreshToken: string, user: AuthUser | null }>}
 */
export async function registerWithCredentials(payload) {
  const normalizedEmail = String(payload?.email || '').trim().toLowerCase()
  const normalizedPassword = String(payload?.password || '')
  const normalizedNickname = String(payload?.nickname || '').trim()

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('请输入正确的邮箱地址')
  }
  if (!normalizedPassword || normalizedPassword.length < 8) {
    throw new Error('密码至少 8 位')
  }

  let response
  try {
    response = await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: normalizedPassword,
        nickname: normalizedNickname || undefined
      })
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('注册请求超时，请稍后重试')
    }
    throw new Error('无法连接注册服务，请检查网络')
  }

  let data = null
  try {
    data = await response.json()
  } catch (_) {
    /* noop */
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (
        data.message ||
        data.error?.message ||
        data.error
      )) ||
      `注册失败（HTTP ${response.status}）`
    throw new Error(String(message))
  }

  const tokens = extractTokens(data)
  if (!tokens?.token) {
    throw new Error('注册响应缺少访问令牌，请稍后登录')
  }

  const user = extractProfileUser(data) || {
    id: 'pending',
    nickname: normalizedNickname || normalizedEmail.split('@')[0] || '用户',
    avatar: ''
  }

  return {
    token: tokens.token,
    refreshToken: tokens.refreshToken || '',
    user
  }
}

/**
 * @param {string} email
 */
export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('请输入正确的邮箱地址')
  }

  let response
  try {
    response = await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: normalizedEmail })
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试')
    }
    throw new Error('无法连接重置服务，请检查网络')
  }

  if (!response.ok) {
    let msg = `请求失败（HTTP ${response.status}）`
    try {
      const data = await response.json()
      msg = data?.message || data?.error?.message || data?.error || msg
    } catch (_) {
      /* noop */
    }
    throw new Error(String(msg))
  }

  return { ok: true }
}

/**
 * @param {string} token
 * @param {string} password
 */
export async function confirmPasswordReset(token, password) {
  const normalizedToken = String(token || '').trim()
  const normalizedPassword = String(password || '')
  if (!normalizedToken) throw new Error('缺少重置令牌')
  if (!normalizedPassword || normalizedPassword.length < 8) {
    throw new Error('密码至少 8 位')
  }

  let response
  try {
    response = await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: normalizedToken, password: normalizedPassword })
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试')
    }
    throw new Error('无法连接重置服务，请检查网络')
  }

  if (!response.ok) {
    let msg = `重置失败（HTTP ${response.status}）`
    try {
      const data = await response.json()
      msg = data?.message || data?.error?.message || data?.error || msg
    } catch (_) {
      /* noop */
    }
    throw new Error(String(msg))
  }

  return { ok: true }
}

/**
 * @param {string} token
 */
export async function verifyEmailToken(token) {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) throw new Error('缺少验证令牌')

  let response
  try {
    response = await fetchWithTimeout(
      `${ACCOUNT_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(normalizedToken)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('验证请求超时，请稍后重试')
    }
    throw new Error('无法连接验证服务，请检查网络')
  }

  if (!response.ok) {
    let msg = `验证失败（HTTP ${response.status}）`
    try {
      const data = await response.json()
      msg = data?.message || data?.error?.message || data?.error || msg
    } catch (_) {
      /* noop */
    }
    throw new Error(String(msg))
  }

  try {
    return await response.json()
  } catch (_) {
    return { ok: true }
  }
}

/**
 * 封装登录 / 登出流程。
 *
 * - `login()` 现在打开 AuthModal（嵌入式邮箱+密码表单），由用户提交后调用
 *   `loginWithCredentials` 完成登录；不再走外部浏览器。
 * - 直接调用方也可使用 `loginWithCredentials(email, password)` 跳过 UI。
 */
export function useAuth() {
  const authStore = useAuthStore()
  const { isAuthenticated, currentUser, isGuest, isLoggedIn } = storeToRefs(authStore)
  const isLoggingIn = ref(false)

  /**
   * 触发嵌入式登录模态框，返回登录成功的 Promise。
   * @param {{ mode?: 'login' | 'register' }} [options]
   */
  async function login(options = {}) {
    const mode = options.mode === 'register' ? 'register' : 'login'
    isLoggingIn.value = true

    try {
      const authModalStore = useAuthModalStore()
      const result = await authModalStore.open({ mode })

      if (!result?.success) {
        if (result?.reason === 'dismissed') {
          throw new Error('已取消登录')
        }
        throw new Error(result?.error || '登录未完成')
      }

      return true
    } finally {
      isLoggingIn.value = false
    }
  }

  /**
   * 直接以凭据登录（嵌入式表单提交后调用，跳过 UI）。
   * @param {{ email: string, password: string }} payload
   */
  async function loginDirect(payload) {
    const result = await loginWithCredentials(payload.email, payload.password)
    await authStore.login(result.token, result.refreshToken, result.user)
    return result
  }

  async function register() {
    return login({ mode: 'register' })
  }

  async function logout() {
    const token = authStore.token
    const refreshToken = authStore.refreshToken

    if (token || refreshToken) {
      try {
        /** @type {Record<string, string>} */
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }

        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            refresh_token: refreshToken || undefined
          })
        })
      } catch (error) {
        console.warn('[useAuth] logout API failed:', error)
      }
    }

    await authStore.logout()
  }

  return {
    login,
    loginDirect,
    register,
    logout,
    isLoggingIn,
    isAuthenticated,
    isLoggedIn,
    currentUser,
    isGuest
  }
}

// 兼容 Electron 环境下导出 auth API 探测（保持 isElectron/getElectronAPI 可被外部引用）
export { isElectron, getElectronAPI }

// 暴露可被测试桩替换的网络入口（仅在测试环境使用）
export const __testing = { loginWithCredentials, registerWithCredentials }

// 兼容 default 导出，避免外部 require 报错
export default useAuth
