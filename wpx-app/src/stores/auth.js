import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getElectronAPI, isElectron } from '@/utils/electron'

// WPX 自托管认证：统一走主域名 https://prowpx.com
// 旧版 account.proclaw.cc 已下线，所有认证接口由本项目后端提供
const ACCOUNT_BASE_URL = 'https://prowpx.com'
const WEB_CREDENTIALS_KEY = 'wpx-auth-credentials-web'
const AUTH_FETCH_TIMEOUT_MS = 8000

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
 * @typedef {{ token: string, refreshToken: string, user: AuthUser | null }} AuthCredentials
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
 * @returns {AuthUser | null}
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
 * @returns {{ token: string, refreshToken: string } | null}
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
 * @param {{ token: string, refreshToken: string }} stored
 * @returns {Promise<{ valid: boolean, token: string, refreshToken: string }>}
 */
async function refreshSessionWithServer(stored) {
  const refreshTokenValue = String(stored.refreshToken || stored.token || '').trim()
  if (!refreshTokenValue) {
    return { valid: false, token: '', refreshToken: '' }
  }

  const response = await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  })

  if (!response.ok) {
    return { valid: false, token: '', refreshToken: '' }
  }

  try {
    const payload = await response.json()
    const tokens = extractTokens(payload)
    if (!tokens?.token) {
      return { valid: false, token: '', refreshToken: '' }
    }

    return {
      valid: true,
      token: tokens.token,
      refreshToken: tokens.refreshToken || stored.refreshToken || '',
    }
  } catch {
    return { valid: false, token: '', refreshToken: '' }
  }
}

/**
 * @param {string} token
 * @returns {Promise<AuthUser | null>}
 */
async function fetchUserProfile(token) {
  const value = String(token || '').trim()
  if (!value) return null

  const response = await fetchWithTimeout(`${ACCOUNT_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${value}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) return null

  try {
    const payload = await response.json()
    return extractProfileUser(payload)
  } catch {
    return null
  }
}

/**
 * @returns {Promise<AuthCredentials | null>}
 */
async function loadCredentialsFromStorage() {
  if (isElectron()) {
    const api = getElectronAPI()?.auth
    if (!api?.getToken) return null

    const tokens = await api.getToken()
    return {
      token: String(tokens?.token || '').trim(),
      refreshToken: String(tokens?.refreshToken || '').trim(),
      user: null,
    }
  }

  if (typeof sessionStorage === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(WEB_CREDENTIALS_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    return {
      token: String(parsed.token || '').trim(),
      refreshToken: String(parsed.refreshToken || '').trim(),
      user: normalizeUser(parsed.user),
    }
  } catch {
    return null
  }
}

/**
 * @param {AuthCredentials} credentials
 */
async function saveCredentialsToStorage(credentials) {
  if (isElectron()) {
    const api = getElectronAPI()?.auth
    if (!api?.storeToken) {
      throw new Error('当前环境不支持保存登录凭据')
    }

    await api.storeToken({
      token: credentials.token,
      refreshToken: credentials.refreshToken,
    })
    return
  }

  if (typeof sessionStorage === 'undefined') return

  sessionStorage.setItem(
    WEB_CREDENTIALS_KEY,
    JSON.stringify({
      token: credentials.token,
      refreshToken: credentials.refreshToken,
      user: credentials.user,
    }),
  )
}

async function clearCredentialsFromStorage() {
  if (isElectron()) {
    const api = getElectronAPI()?.auth
    if (api?.clearToken) {
      await api.clearToken()
    }
    return
  }

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WEB_CREDENTIALS_KEY)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  /** @type {import('vue').Ref<AuthUser | null>} */
  const user = ref(null)
  const token = ref(null)
  const refreshToken = ref(null)
  const isGuest = ref(true)
  const sessionRestored = ref(false)

  const isAuthenticated = computed(() => isLoggedIn.value)
  const currentUser = computed(() => user.value)

  function applyGuestState() {
    isLoggedIn.value = false
    user.value = null
    token.value = null
    refreshToken.value = null
    isGuest.value = true
  }

  /**
   * @param {string} nextToken
   * @param {string | null | undefined} nextRefreshToken
   * @param {AuthUser | null | undefined} nextUser
   */
  function applyLoggedInState(nextToken, nextRefreshToken, nextUser) {
    isLoggedIn.value = true
    token.value = nextToken
    refreshToken.value = nextRefreshToken || null
    user.value = nextUser || null
    isGuest.value = false
  }

  /**
   * @param {string} nextToken
   * @param {string | null | undefined} nextRefreshToken
   * @param {unknown} nextUser
   */
  async function login(nextToken, nextRefreshToken, nextUser) {
    const normalizedToken = String(nextToken || '').trim()
    const normalizedUser = normalizeUser(nextUser)

    if (!normalizedToken || !normalizedUser) {
      throw new Error('登录凭据无效')
    }

    const normalizedRefreshToken = String(nextRefreshToken || '').trim()

    await saveCredentialsToStorage({
      token: normalizedToken,
      refreshToken: normalizedRefreshToken,
      user: normalizedUser,
    })

    applyLoggedInState(normalizedToken, normalizedRefreshToken || null, normalizedUser)
  }

  async function logout() {
    await clearCredentialsFromStorage()
    applyGuestState()
  }

  /**
   * 应用启动时恢复会话：通过 IPC 读取 token，调用 refresh 校验并拉取用户信息。
   * @returns {Promise<boolean>} 是否恢复为已登录状态
   */
  async function restoreSession() {
    try {
      const stored = await loadCredentialsFromStorage()
      if (!stored?.token && !stored?.refreshToken) {
        applyGuestState()
        return false
      }

      const refreshResult = await refreshSessionWithServer(stored)
      if (!refreshResult.valid) {
        await logout()
        return false
      }

      const profileUser = await fetchUserProfile(refreshResult.token)
      if (!profileUser) {
        await logout()
        return false
      }

      await saveCredentialsToStorage({
        token: refreshResult.token,
        refreshToken: refreshResult.refreshToken || stored.refreshToken || '',
        user: profileUser,
      })

      applyLoggedInState(
        refreshResult.token,
        refreshResult.refreshToken || stored.refreshToken || null,
        profileUser,
      )

      return true
    } catch (error) {
      console.warn('[auth] restoreSession failed:', error)
      await logout()
      return false
    } finally {
      sessionRestored.value = true
    }
  }

  return {
    isLoggedIn,
    user,
    token,
    refreshToken,
    isGuest,
    sessionRestored,
    isAuthenticated,
    currentUser,
    login,
    logout,
    restoreSession,
  }
})
