/**
 * Axios 实例配置
 *
 * 包含两个实例：
 *  - httpAccount：对 account.proclaw.cc 的认证接口
 *  - httpApi   ：对 WPX 后端 API 的业务接口
 *
 * 两者都通过 localStorage 中的 JWT 进行 Bearer 认证。
 */
import axios from 'axios'

// 应用配置（由 vite.config.js 通过 __APP_INFO__ 注入）
const APP_INFO =
  typeof __APP_INFO__ !== 'undefined'
    ? __APP_INFO__
    : {
        accountBaseUrl: 'https://account.proclaw.cc',
        apiBaseUrl: 'https://api.proclaw.cc/admin'
      }

export const ACCOUNT_BASE_URL = APP_INFO.accountBaseUrl
export const API_BASE_URL = APP_INFO.apiBaseUrl

const TOKEN_KEY = 'wpx_admin_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch (_e) {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch (_e) {
    /* noop */
  }
}

export function clearToken() {
  setToken('')
}

/**
 * 创建 axios 实例的统一工厂
 */
function createInstance(baseURL) {
  const instance = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // 请求拦截器：自动注入 JWT
  instance.interceptors.request.use(
    (config) => {
      const token = getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  // 响应拦截器：统一处理错误码 + 401 跳转
  instance.interceptors.response.use(
    (response) => {
      // 后端约定：业务错误码非 0 时也走 catch 分支
      const data = response.data
      if (data && typeof data === 'object' && 'code' in data) {
        if (data.code !== 0 && data.code !== 200) {
          const err = new Error(data.message || '业务错误')
          err.code = data.code
          err.payload = data
          return Promise.reject(err)
        }
        return data
      }
      return response.data
    },
    (error) => {
      // 401：未登录或 token 失效
      if (error?.response?.status === 401) {
        clearToken()
        // 避免在登录页重复跳转
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          const redirect = encodeURIComponent(
            window.location.pathname + window.location.search
          )
          window.location.replace(`/login?redirect=${redirect}`)
        }
      }
      return Promise.reject(error)
    }
  )

  return instance
}

// account.proclaw.cc 认证服务实例
export const httpAccount = createInstance(ACCOUNT_BASE_URL)

// WPX 后端 API 实例
export const httpApi = createInstance(API_BASE_URL)

export default httpApi