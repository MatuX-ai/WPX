'use strict'

/**
 * WPX 自托管邮箱认证（prowpx.com）—— 协议兼容层
 *
 * 重构说明：
 *  - 项目已从 `account.proclaw.cc` 外跳浏览器登录，迁移为应用内嵌表单（AuthModal），
 *    登录请求直接 POST 到 https://prowpx.com/api/auth/login，不再走外部浏览器。
 *  - 保留 `parseAuthCallbackUrl` / `handleAuthCallbackUrl` 仅作为 `wpx://` 协议的
 *    解析兼容入口：旧版本客户端可能仍在系统中打开 `wpx://auth?...` 链接，
 *    此时我们丢弃 payload 并把 IPC 事件标记为 no-op（不会自动登入）。
 *  - 不再注册 `auth:start-login` IPC 处理器，也不再调用 `shell.openExternal`。
 *
 * 依赖项：`ipcMain`、`shell` 不再被使用，但保留 require 以防老代码 import。
 */

// 兼容旧模块导出：避免外部 require 报错。值为 ''，仅用于日志/调试。
const ACCOUNT_LOGIN_BASE = ''
const ACCOUNT_REGISTER_BASE = ''
const AUTH_CALLBACK_SCHEME = 'wpx://auth'

/**
 * @param {import('electron').BrowserWindow[]} windows
 * @param {Record<string, unknown>} payload
 */
function broadcastAuthCallback(windows, payload) {
  for (const window of windows) {
    if (window.isDestroyed()) continue
    window.webContents.send('auth:callback', payload)
  }
}

/**
 * @param {string} rawUrl
 */
function parseAuthCallbackUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim())
    if (url.protocol !== 'wpx:') return null
    if (url.hostname !== 'auth') return null

    return {
      token: url.searchParams.get('token') || '',
      refreshToken:
        url.searchParams.get('refresh_token') ||
        url.searchParams.get('refreshToken') ||
        '',
      state: url.searchParams.get('state') || '',
      error: url.searchParams.get('error') || url.searchParams.get('error_description') || '',
    }
  } catch {
    return null
  }
}

/**
 * @param {unknown} argv
 * @returns {string[]}
 */
function extractProtocolUrlsFromArgv(argv = []) {
  if (!Array.isArray(argv)) return []

  return argv.filter((arg) => typeof arg === 'string' && arg.startsWith('wpx://'))
}

/**
 * 处理 wpx:// 回调（保留兼容，不再触发自动登入）。
 * @param {import('electron').BrowserWindow[]} windows
 * @param {string} rawUrl
 * @returns {boolean}
 */
function handleAuthCallbackUrl(windows, rawUrl) {
  const parsed = parseAuthCallbackUrl(rawUrl)
  if (!parsed) return false

  // 重构后：只把回调广播给渲染进程用于"忽略提示"，不再依赖 IPC 等待 Promise。
  broadcastAuthCallback(windows, {
    ...parsed,
    url: rawUrl,
    ignored: true,
  })

  return true
}

/**
 * 兼容入口：原先 initAuthProtocol 注册了 `auth:start-login` 处理（打开外部浏览器）。
 * 现已不再需要；保留函数以避免破坏旧引用。
 */
function initAuthProtocol() {
  // noop: WPX 已迁移为应用内嵌 AuthModal 登录，不再打开外部浏览器。
}

function buildLoginUrl() {
  // 保留兼容：返回 prowpx.com 自托管入口（实际由 AuthModal POST /api/auth/login）
  return 'https://prowpx.com/api/auth/login'
}

module.exports = {
  initAuthProtocol,
  handleAuthCallbackUrl,
  extractProtocolUrlsFromArgv,
  parseAuthCallbackUrl,
  buildLoginUrl,
  // 仅导出供调试/测试使用，业务代码不应依赖
  _ACCOUNT_LOGIN_BASE: ACCOUNT_LOGIN_BASE,
  _ACCOUNT_REGISTER_BASE: ACCOUNT_REGISTER_BASE,
  _AUTH_CALLBACK_SCHEME: AUTH_CALLBACK_SCHEME,
}