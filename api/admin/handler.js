// Vercel Serverless Function: WPX Admin 后端（in-memory 实现）
// 路径：/admin/api/* （通过 Vercel rewrites 路由）
//
// 设计动机（2026-06-30）：
//  WPX 是营销站 + 桌面端下载页，admin 后台仅作演示用途。
//  不需要 Express + PostgreSQL + Redis 的完整后端，
//  用 Vercel Function + in-memory Map 提供最小可用 API。
//  状态仅在 Vercel 实例内存（冷启动会清空，足够 demo）。
//
// 接口（与 admin/src/utils/auth-api.js 对齐）：
//   POST /api/auth/register            { email, password, nickname? } -> { code:0, data:{ token, refreshToken, user } }
//   POST /api/auth/login               { email, password }            -> { code:0, data:{ token, refreshToken, user } }
//   POST /api/auth/refresh                                           -> { code:0, data:{ token, refreshToken } }
//   POST /api/auth/logout                                             -> { code:0, data:{ ok: true } }
//   POST /api/auth/forgot-password    { email }                       -> { code:0, data:{ ok: true } }
//   POST /api/auth/reset-password     { token, password }             -> { code:0, data:{ ok: true } }
//   GET  /api/auth/verify-email?token=...                             -> { code:0, data:{ ok: true } }
//   GET  /api/auth/me                                                  -> { code:0, data:{ user, profile } }
//   GET  /api/admin/dashboard/stats                                    -> { code:0, data:{...} } (运营概览占位)

const crypto = require('crypto')

// in-memory store（冷启动会清空）
const users = new Map() // email -> { id, email, passwordHash, nickname, role, createdAt, emailVerified }
const tokens = new Map() // token -> { email, expiresAt, refreshToken? }

// 简单密码 hash（不要用于生产；demo 用）
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(String(pwd) + 'wpx-demo-salt').digest('hex')
}

function generateToken(email) {
  return crypto.randomBytes(24).toString('base64url')
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function generateId() {
  return crypto.randomBytes(8).toString('hex')
}

function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname || u.email.split('@')[0],
    role: u.role,
    createdAt: u.createdAt,
    emailVerified: u.emailVerified
  }
}

function ok(res, data, status = 200) {
  res.status(status).json({ code: 0, message: 'ok', data })
}

function fail(res, status, code, message) {
  res.status(status).json({ code, message, data: null })
}

function readPath(req) {
  // Vercel rewrites 把 /admin/api/<path> -> /api/admin/handler?path=<path>
  // proxy.js 也用同款 ?path= 协议
  const fromQuery = (req.query && req.query.path) || ''
  if (fromQuery) return String(fromQuery).replace(/^\/+/, '')
  // 兜底：直接看 req.url（如 Vercel Function 自身被 hit）
  const u = req.url || ''
  return u.replace(/^\/+/, '').split('?')[0]
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch (_) { return {} }
  }
  if (typeof req.body === 'object') return req.body
  return {}
}

async function handle(req, res) {
  // CORS：handler 也作为 Function 直接被 hit 时（同源）需透传 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const path = readPath(req) // e.g. "auth/login", "auth/me", "admin/dashboard/stats"
  const body = parseBody(req)
  const method = req.method

  // ============ /auth/register ============
  if (path === 'auth/register' && method === 'POST') {
    const { email, password, nickname } = body
    if (!email || !password) return fail(res, 400, 4001, '邮箱和密码必填')
    const lower = String(email).trim().toLowerCase()
    if (users.has(lower)) return fail(res, 409, 4091, '邮箱已注册')
    const user = {
      id: generateId(),
      email: lower,
      passwordHash: hashPassword(password),
      nickname: nickname || lower.split('@')[0],
      role: 'user',
      createdAt: new Date().toISOString(),
      emailVerified: true // demo: 跳过邮件验证
    }
    users.set(lower, user)
    const token = generateToken(lower)
    const refreshToken = generateRefreshToken()
    tokens.set(token, { email: lower, expiresAt: Date.now() + 24 * 3600 * 1000, refreshToken })
    return ok(res, { token, refreshToken, user: publicUser(user) })
  }

  // ============ /auth/login ============
  if (path === 'auth/login' && method === 'POST') {
    const { email, password } = body
    if (!email || !password) return fail(res, 400, 4001, '邮箱和密码必填')
    const lower = String(email).trim().toLowerCase()
    const user = users.get(lower)
    // demo 友好：邮箱不存在时自动注册（让用户能直接登录）
    let finalUser = user
    if (!finalUser) {
      finalUser = {
        id: generateId(),
        email: lower,
        passwordHash: hashPassword(password),
        nickname: lower.split('@')[0],
        role: lower === '[email protected]' ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        emailVerified: true
      }
      users.set(lower, finalUser)
    } else if (finalUser.passwordHash !== hashPassword(password)) {
      return fail(res, 401, 4011, '邮箱或密码错误')
    }
    const token = generateToken(lower)
    const refreshToken = generateRefreshToken()
    tokens.set(token, { email: lower, expiresAt: Date.now() + 24 * 3600 * 1000, refreshToken })
    return ok(res, { token, refreshToken, user: publicUser(finalUser) })
  }

  // ============ /auth/me ============
  if (path === 'auth/me' && method === 'GET') {
    const auth = req.headers.authorization || ''
    const token = auth.replace(/^Bearer\s+/i, '').trim()
    if (!token) return fail(res, 401, 4011, '未登录')
    const session = tokens.get(token)
    if (!session || session.expiresAt < Date.now()) {
      tokens.delete(token)
      return fail(res, 401, 4011, 'token 已过期')
    }
    const user = users.get(session.email)
    if (!user) return fail(res, 401, 4011, '用户不存在')
    return ok(res, { user: publicUser(user), profile: { permissions: ['read', 'write'] } })
  }

  // ============ /auth/refresh ============
  if (path === 'auth/refresh' && method === 'POST') {
    const auth = req.headers.authorization || ''
    const oldToken = auth.replace(/^Bearer\s+/i, '').trim()
    const session = oldToken ? tokens.get(oldToken) : null
    if (!session) return fail(res, 401, 4011, 'refresh 失败')
    const newToken = generateToken(session.email)
    tokens.set(newToken, { email: session.email, expiresAt: Date.now() + 24 * 3600 * 1000, refreshToken: session.refreshToken })
    if (oldToken) tokens.delete(oldToken)
    return ok(res, { token: newToken, refreshToken: session.refreshToken })
  }

  // ============ /auth/logout ============
  if (path === 'auth/logout' && method === 'POST') {
    const auth = req.headers.authorization || ''
    const token = auth.replace(/^Bearer\s+/i, '').trim()
    if (token) tokens.delete(token)
    return ok(res, { ok: true })
  }

  // ============ /auth/forgot-password ============
  if (path === 'auth/forgot-password' && method === 'POST') {
    // demo: 直接返回 ok，不发邮件
    return ok(res, { ok: true })
  }

  // ============ /auth/reset-password ============
  if (path === 'auth/reset-password' && method === 'POST') {
    return ok(res, { ok: true })
  }

  // ============ /auth/verify-email ============
  if (path === 'auth/verify-email' && method === 'GET') {
    return ok(res, { ok: true })
  }

  // ============ /admin/dashboard/stats ============
  if (path === 'admin/dashboard/stats' && method === 'GET') {
    return ok(res, {
      users: users.size,
      orders: 0,
      announcements: 0,
      logs: 0,
      feedback: 0,
      skills: 32,
      models: 0,
      generatedAt: new Date().toISOString()
    })
  }

  // ============ 兜底：未实现路径返回 404 ============
  return fail(res, 404, 4041, `Not implemented: ${method} /${path}`)
}

module.exports = handle
// 兼容 Vercel Node.js Function 导出风格
module.exports.default = handle
