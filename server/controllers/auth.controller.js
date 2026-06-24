/**
 * 鉴权控制器
 * - /me 返回当前用户基本信息
 * - /token/verify 主动校验 token 合法性（用于客户端刷新前的探测）
 */
'use strict';

const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');
const userModel = require('../models/user');

const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError('未认证');
  let profile = null;
  if (req.user.accountId) {
    // 本地画像为可选扩展，DB 异常时不影响 /me 主体功能
    try {
      profile = await userModel.findByAccountId(req.user.accountId);
    } catch (err) {
      logger.warn('user_profiles lookup failed', { err: err.message });
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

module.exports = { me, verify };
