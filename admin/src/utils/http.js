/**
 * Axios 实例配置
 *
 * 包含两个实例：
 *  - httpAccount：WPX 自托管邮箱认证（主域 prowpx.com）
 *  - httpApi   ：对 WPX 后端 API 的业务接口（api.prowpx.com）
 *
 * 两者都通过 localStorage 中的 JWT 进行 Bearer 认证。
 *
 * 管理后台统一挂在 https://prowpx.com/admin 下，默认走 /api/* 同源反代
 * 避免浏览器 CORS；如需直连后端，可通过 VITE_API_BASE_URL / VITE_ACCOUNT_BASE_URL 覆盖。
 */
import axios from 'axios'

// 应用配置（由 vite.config.js 通过 __APP_INFO__ 注入）
// 默认值必须使用相对路径（同源请求），绝不能硬编码为 https://prowpx.com 等绝对域名。
// 原因：当前 Vercel 项目对 apex 域名（prowpx.com）配置了 "Redirect to www"（308 重定向，
// 在 Vercel Dashboard 的 Domain Settings 里手动启用），任何对 apex 域名的请求都会被
// Vercel Edge Network 在到达 Function 之前重定向到 www 子域。
// 而 CORS preflight（OPTIONS）响应不允许 3xx 状态码，浏览器会直接阻断 preflight，
// 导致 POST /api/auth/login 等跨子域请求彻底失败：
//   "Response to preflight request doesn't pass access control check:
//    Redirect is not allowed for a preflight request."
// 修复办法：使用 '/' 作为 baseURL，让 axios 解析为当前 origin 的相对路径，
// 用户从 www.prowpx.com 进入就请求 www，从 prowpx.com 进入就请求 prowpx.com，
// 同源请求不会触发 preflight 的 308 重定向问题。
const APP_INFO =
  typeof __APP_INFO__ !== 'undefined'
    ? __APP_INFO__
    : {
        // 自托管认证入口：默认同源（走 /api/* → /api/proxy 反代）
        accountBaseUrl: '/',
        // 业务 API：默认同源（走 /api/* → /api/proxy 反代）
        apiBaseUrl: '/api'
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
      const data = response.data
      // 后端约定：{ ok: false, error: { code, message } } 表示业务错误
      if (data && typeof data === 'object' && data.ok === false) {
        const errMsg = data.error?.message || '业务错误'
        const errCode = data.error?.code || 'UNKNOWN'
        const err = new Error(errMsg)
        err.code = errCode
        err.payload = data
        return Promise.reject(err)
      }
      return response.data
    },
    (error) => {
      // HTTP 层错误（网络错误 / 非 2xx）
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

// WPX 自托管认证实例（prowpx.com）
export const httpAccount = createInstance(ACCOUNT_BASE_URL)

// WPX 后端 API 实例（api.prowpx.com）
export const httpApi = createInstance(API_BASE_URL)

export default httpApi