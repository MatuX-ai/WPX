/**
 * 鉴权控制器（WPX 自托管邮箱认证）
 *
 * 提供端点（与 prowpx.com/api/auth/* 对齐）：
 *  - POST   /api/auth/register        { email, password, nickname? }  -> { token, refreshToken, user }
 *  - GET    /api/auth/verify-email?token=...                        -> { ok: true }
 *  - POST   /api/auth/login           { email, password }            -> { token, refreshToken, user }
 *  - POST   /api/auth/refresh         { refresh_token }             -> { token, refreshToken }
 *  - POST   /api/auth/logout                                           -> { ok: true }
 *  - POST   /api/auth/forgot-password { email }                      -> { ok: true }
 *  - POST   /api/auth/reset-password  { token, password }            -> { ok: true }
 *  - GET    /api/auth/me               (requireAuth)                  -> { user, profile }
 *  - GET    /api/auth/verify           (requireAuth)                  -> { valid: true, user }
 */
'use strict';

const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const { BadRequestError, UnauthorizedError } = require('../utils/errors');
const userModel = require('../models/user');
const logger = require('../utils/logger');

const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError('未认证');
  // 兼容老 token（来自 account.proclaw.cc，payload.accountId 可能存在）
  let profile = null;
  const accountId = req.user.accountId || req.user.id;
  if (accountId) {
    try {
      profile = await userModel.findByAccountId(accountId);
      if (!profile) {
        // 退化为自托管用户表查询
        const user = await userModel.findById(accountId);
        if (user) {
          profile = userModel.toPublic(user);
        }
      }
    } catch (err) {
      logger.warn('user lookup failed', { err: err.message });
    }
  }
  return ok(res, {
    user: req.user,
    profile
  });
});

const verify = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError('未认证');
  return ok(res, { valid: true, user: req.user });
});

const register = asyncHandler(async (req, res) => {
  const { email, password, nickname } = req.body || {};
  const result = await userModel.createUser({ email, password, nickname });
  return ok(res, {
    user: result,
    // 提示：前端应继续调用 /api/auth/verify-email 完成验证
    message: '注册成功，请前往邮箱完成验证'
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) throw new BadRequestError('缺少验证令牌');
  const user = await userModel.consumeEmailVerifyToken(token);
  return ok(res, {
    ok: true,
    user,
    message: '邮箱已验证，现在可以使用该邮箱登录'
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const result = await userModel.authenticate({ email, password });
  return ok(res, result);
});

const refresh = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const refreshToken =
    body.refresh_token || body.refreshToken || body.token;
  if (!refreshToken) {
    throw new BadRequestError('缺少 refresh_token');
  }
  const result = await userModel.refreshAccessToken(refreshToken);
  return ok(res, result);
});

const logout = asyncHandler(async (req, res) => {
  // 简化实现：服务端无状态 JWT，登出由前端清理本地凭据即可
  // 后续可扩展为 refresh token 黑名单
  return ok(res, { ok: true });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const result = await userModel.requestPasswordReset(email);
  // 出于隐私，无论邮箱是否存在都返回 ok: true
  return ok(res, {
    ok: true,
    sent: Boolean(result.sent),
    message: '若该邮箱已注册，重置链接已发送到该邮箱'
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  await userModel.consumePasswordResetToken(token, password);
  return ok(res, {
    ok: true,
    message: '密码已重置，请使用新密码登录'
  });
});

module.exports = {
  me,
  verify,
  register,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword
};
