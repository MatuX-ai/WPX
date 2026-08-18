/**
 * JWT 鉴权中间件
 * 校验由 prowpx.com 自托管邮箱认证服务颁发的访问令牌
 * 校验成功后挂载 req.user = { id, accountId, email, nickname, roles, raw }
 *
 * 配置：
 *  - ACCOUNT_JWT_SECRET   共享密钥（HS256） 或 PEM 公钥（RS256）
 *  - ACCOUNT_JWT_ALG      签名算法，默认 HS256
 *  - ACCOUNT_JWT_ISSUER   期望的签发者，默认 prowpx.com
 *  - ACCOUNT_JWT_AUDIENCE 期望的受众，默认 wpx-server
 *  - AUTH_BYPASS          true 时跳过校验（仅本地开发）
 */
'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

function extractToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth) return null;
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function verifyToken(token) {
  const opts = {
    algorithms: [config.auth.algorithm],
    issuer: config.auth.issuer,
    audience: config.auth.audience
  };
  return jwt.verify(token, config.auth.secret, opts);
}

function normalizeUser(payload) {
  // prowpx.com 自托管认证 token 包含：sub/email/nickname/roles/exp 等
  // 兼容老 token（account.proclaw.cc 颁发，payload.accountId）
  return {
    id: payload.sub || payload.accountId || payload.userId,
    accountId: payload.accountId || payload.sub,
    email: payload.email,
    nickname: payload.nickname || payload.name,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    raw: payload
  };
}

/**
 * 强制鉴权：未通过则抛出 401
 */
function requireAuth(req, res, next) {
  if (config.auth.bypass) {
    req.user = { id: 'dev', accountId: 'dev', roles: config.auth.bypassRoles, raw: {} };
    return next();
  }
  const token = extractToken(req);
  if (!token) return next(new UnauthorizedError('缺少访问令牌'));
  try {
    const payload = verifyToken(token);
    req.user = normalizeUser(payload);
    return next();
  } catch (err) {
    logger.warn('JWT verify failed', { err: err.message });
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('令牌已过期'));
    }
    return next(new UnauthorizedError('无效的访问令牌'));
  }
}

/**
 * 可选鉴权：有 token 就解析，无 token 也不报错
 */
function optionalAuth(req, res, next) {
  if (config.auth.bypass) {
    req.user = { id: 'dev', accountId: 'dev', roles: config.auth.bypassRoles, raw: {} };
    return next();
  }
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    req.user = normalizeUser(payload);
  } catch (err) {
    // 静默，不阻断无状态接口
    logger.debug('optionalAuth: token ignored', { err: err.message });
  }
  return next();
}

/**
 * 角色等级表（设计动机 2026-07-01）：
 * - 此前 requireRole 对传参角色逐字面比较，导致拥有 super_admin 的超级管理员
 *   被 admin 等路由拒绝（403）。补救代码上需要 requireRole('admin', 'super_admin')
 *   同写两边，容易漏。
 * - 现在 requireRole 走"角色等级阈限"语义：传入角色的 ROLE_LEVEL 作为最低门槛，
 *   只要求调用者拥有任一 LEVEL ≥ 门槛的角色即放行。
 *   requireRole('admin') => 门槛=100，accept super_admin/admin/拒绝 operation_admin
 *   requireRole('operation_admin') => 门槛=50，accept 超集＋自身
 * 角色等级有序关系：
 *   super_admin (100)   ← 最高
 *   admin (100)
 *   operation_admin (50)
 *   content_editor (10) ← 最低
 *   其他/未知字符串             → LEVEL=0（默认拒绝进入任何 requireRole）
 */
const ROLE_LEVEL = Object.freeze({
  super_admin: 100,
  admin: 100,
  operation_admin: 50,
  content_editor: 10
})

function levelOf(role) {
  if (typeof role !== 'string') return 0
  const lv = ROLE_LEVEL[role]
  return typeof lv === 'number' ? lv : 0
}

/**
 * 角色守卫工厂（等级继承版）
 *
 * 调用方传参形式：
 *   requireRole('admin')                    -> 等级 ≥ admin(100) 放过
 *   requireRole('operation_admin')          -> 等级 ≥ operation_admin(50) 放过
 *   requireRole('admin', 'super_admin')     -> 以两者中最低等级作为门槛
 *
 * 未知角色视为 LEVEL 0。作为警告，会在服务端 logger 记录一次未知角色。
 *
 * 向后兼容：传 'admin' 仍然能进去（super_admin 等超集也能进入）。
 */
function requireRole(...allowed) {
  if (!allowed || allowed.length === 0) {
    // 兑底：传空等价于仅 requireAuth
    return function (req, res, next) {
      if (!req.user) return next(new UnauthorizedError('未认证'))
      return next()
    }
  }
  const levels = allowed.map(levelOf)
  const minLevel = Math.min(...levels)
  const unknownRoles = allowed.filter(
    (r) => !Object.prototype.hasOwnProperty.call(ROLE_LEVEL, r)
  )
  if (unknownRoles.length) {
    try {
      logger.warn('requireRole 收到未知角色字符串，已按等级0处理', { allowed, unknownRoles })
    } catch (_) { /* noop */ }
  }
  return function (req, res, next) {
    if (!req.user) return next(new UnauthorizedError('未认证'))
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : []
    const userLevelMax = Math.max(0, ...userRoles.map(levelOf))
    if (userLevelMax >= minLevel) return next()
    return next(new ForbiddenError('无权限访问该资源'))
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole
};
