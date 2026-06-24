/**
 * 用户相关业务示例
 * 实际项目中可在此扩展 profile / preference / quota 等
 */
'use strict';

const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const userModel = require('../models/user');

const getProfile = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId;
  const profile = await userModel.findByAccountId(accountId);
  if (!profile) {
    throw new NotFoundError('用户画像不存在，请先调用 /api/users/me/sync');
  }
  return ok(res, { profile });
});

const syncProfile = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId;
  const { nickname, avatar, email, meta } = req.body || {};
  const profile = await userModel.upsertProfile(accountId, { nickname, avatar, email, meta });
  return ok(res, { profile });
});

module.exports = { getProfile, syncProfile };
