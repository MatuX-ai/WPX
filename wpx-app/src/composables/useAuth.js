import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { getElectronAPI, isElectron } from '@/utils/electron'

const ACCOUNT_BASE_URL = 'https://account.proclaw.cc'
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

/** @type {{ state: string, resolve: (value: boolean) => void, reject: (reason?: unknown) => void, timeoutId: ReturnType<typeof setTimeout> | null } | null} */
let pendingLogin = null

/** @type {(() => void) | null} */
let unsubscribeCallback = null

/**
 * @param {unknown} user
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
 * @param {string} token
 */
async function fetchUserProfile(token) {
  const value = String(token || '').trim()
  if (!value) return null

  const response = await fetch(`${ACCOUNT_BASE_URL}/api/user/profile`, {
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

function generateAuthState() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function clearPendingLogin() {
  if (pendingLogin?.timeoutId) {
    clearTimeout(pendingLogin.timeoutId)
  }
  pendingLogin = null
}

/**
 * @param {unknown} payload
 */
async function handleAuthCallback(payload) {
  if (!pendingLogin) return

  const current = pendingLogin
  clearPendingLogin()

  try {
    const record = payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {}
    const error = String(record.error || '').trim()
    if (error) {
      throw new Error(error)
    }

    const callbackState = String(record.state || '').trim()
    if (!callbackState || callbackState !== current.state) {
      throw new Error('登录状态校验失败，请重试')
    }

    const token = String(record.token || '').trim()
    const refreshToken = String(record.refreshToken || '').trim()
    if (!token) {
      throw new Error('未收到有效的登录令牌')
    }

    const authStore = useAuthStore()
    const user = await fetchUserProfile(token)
    if (!user) {
      throw new Error('无法获取用户信息')
    }

    await authStore.login(token, refreshToken, user)
    current.resolve(true)
  } catch (error) {
    current.reject(error)
  }
}

function ensureAuthCallbackListener() {
  if (unsubscribeCallback || !isElectron()) return

  const api = getElectronAPI()?.auth
  if (!api?.onCallback) return

  unsubscribeCallback = api.onCallback((payload) => {
    void handleAuthCallback(payload)
  })
}

/**
 * 封装登录 / 登出流程。
 */
export function useAuth() {
  const authStore = useAuthStore()
  const { isAuthenticated, currentUser, isGuest, isLoggedIn } = storeToRefs(authStore)
  const isLoggingIn = ref(false)

  ensureAuthCallbackListener()

  async function login(options = {}) {
    if (pendingLogin) {
      throw new Error('已有登录流程进行中')
    }

    if (!isElectron()) {
      throw new Error('请在 WPX 客户端中登录')
    }

    const api = getElectronAPI()?.auth
    if (!api?.startLogin) {
      throw new Error('当前环境不支持登录')
    }

    ensureAuthCallbackListener()

    const state = generateAuthState()
    const entry = options.entry === 'register' ? 'register' : 'login'
    isLoggingIn.value = true

    try {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (!pendingLogin) return
          clearPendingLogin()
          reject(new Error('登录超时，请重试'))
        }, LOGIN_TIMEOUT_MS)

        pendingLogin = {
          state,
          resolve,
          reject,
          timeoutId,
        }

        void api
          .startLogin({ state, entry })
          .catch((error) => {
            clearPendingLogin()
            reject(error)
          })
      })

      return true
    } finally {
      isLoggingIn.value = false
    }
  }

  async function register() {
    return login({ entry: 'register' })
  }

  async function logout() {
    const token = authStore.token
    const refreshToken = authStore.refreshToken

    if (token || refreshToken) {
      try {
        /** @type {Record<string, string>} */
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }

        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        await fetch(`${ACCOUNT_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            refresh_token: refreshToken || undefined,
          }),
        })
      } catch (error) {
        console.warn('[useAuth] logout API failed:', error)
      }
    }

    await authStore.logout()
  }

  return {
    login,
    register,
    logout,
    isLoggingIn,
    isAuthenticated,
    isLoggedIn,
    currentUser,
    isGuest,
  }
}
