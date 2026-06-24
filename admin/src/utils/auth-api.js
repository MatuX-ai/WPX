/**
 * WPX 自托管邮箱认证 API（prowpx.com）
 *
 * 接口约定（与本项目后端 server/controllers/auth.controller.js 对齐）：
 *  - POST /api/auth/register          { email, password, nickname? }  -> { token, refreshToken, user }
 *  - POST /api/auth/login             { email, password }            -> { token, refreshToken, user }
 *  - POST /api/auth/refresh                                       -> { token, refreshToken }
 *  - POST /api/auth/logout                                          -> { ok: true }
 *  - POST /api/auth/forgot-password    { email }                    -> { ok: true }
 *  - POST /api/auth/reset-password     { token, password }          -> { ok: true }
 *  - GET  /api/auth/verify-email?token=...                          -> { ok: true }
 *  - GET  /api/auth/me                                             -> { user, profile }
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