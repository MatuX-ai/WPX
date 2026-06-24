/**
 * JWT 鉴权中间件
 * 校验由 account.proclaw.cc 颁发的访问令牌
 * 校验成功后挂载 req.user = { id, accountId, roles, raw }
 *
 * 配置：
 *  - ACCOUNT_JWT_SECRET   共享密钥（HS256） 或 PEM 公钥（RS256）
 *  - ACCOUNT_JWT_ALG      签名算法，默认 HS256
 *  - ACCOUNT_JWT_ISSUER   期望的签发者，默认 account.proclaw.cc
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
  // account.proclaw.cc 颁发的 token 通常包含：sub/accountId/email/roles/exp 等
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
 * 角色守卫工厂
 * @param  {...string} allowed 允许的角色列表
 */
function requireRole(...allowed) {
  const set = new Set(allowed);
  return function (req, res, next) {
    if (!req.user) return next(new UnauthorizedError('未认证'));
    const hit = (req.user.roles || []).some((r) => set.has(r));
    if (!hit) return next(new ForbiddenError('无权限访问该资源'));
    return next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole
};
