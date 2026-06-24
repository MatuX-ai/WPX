/**
 * account.proclaw.cc 认证 API
 *
 * 接口约定（与 account 服务对齐；如服务端字段不同，请在 .env 中调整）：
 *  - POST /api/auth/login        { email, password }  -> { code, data: { token, user } }
 *  - POST /api/auth/logout                                -> { code: 0 }
 *  - GET  /api/auth/me                                   -> { code, data: user }
 *  - POST /api/auth/refresh                               -> { code, data: { token } }
 *
 * 失败容错：当后端暂时不可用时，本模块抛出包含可读 message 的 Error，
 * 由调用方（auth store / 登录页）决定如何提示管理员。
 */
import { httpAccount } from './http'

/**
 * 登录
 * @param {{ email: string, password: string, captcha?: string }} payload
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function login(payload) {
  // httpAccount 拦截器已统一处理业务错误码（code !== 0 走 reject）
  // 这里拿到的 data 即为 { token, user, ... }（按后端实际字段）
  return await httpAccount.post('/api/auth/login', payload)
}

/**
 * 获取当前登录用户信息（用于刷新页面后恢复会话）
 */
export async function fetchCurrentUser() {
  return await httpAccount.get('/api/auth/me')
}

/**
 * 登出（后端可选，前端仅清 token 也可）
 */
export async function logout() {
  try {
    await httpAccount.post('/api/auth/logout')
  } catch (_e) {
    /* 即使后端登出失败，前端也继续清理本地状态 */
  }
}

/**
 * 刷新 token（可选；用于即将过期时静默续期）
 */
export async function refreshToken() {
  return await httpAccount.post('/api/auth/refresh')
}