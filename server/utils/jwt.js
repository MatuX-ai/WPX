/**
 * WPX JWT 签发与校验
 *
 * access token  短效（默认 2h），用于 Authorization: Bearer
 * refresh token 长效（默认 30d），用于刷新 access token
 *
 * 配置读取自 config.auth：
 *   - secret     共享密钥（HS256）/ PEM 公钥（RS256）
 *   - algorithm  HS256 / RS256，默认 HS256
 *   - issuer     默认 'prowpx.com'
 *   - audience   默认 'wpx-server'
 *   - accessTokenTtl / refreshTokenTtl
 */
'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(payload) {
  // 注意：jsonwebtoken 不允许同时在 payload 和 options.subject 里设置 sub，
  // 否则报 'Bad "options.subject" option. The payload already has a "sub" property.'。
  // payload 里已包含 sub（参见 models/user.js issueTokensForUser），这里不再重复设置。
  return jwt.sign(payload, config.auth.secret, {
    algorithm: config.auth.algorithm,
    expiresIn: config.auth.accessTokenTtl,
    issuer: config.auth.issuer,
    audience: config.auth.audience
  });
}

function signRefreshToken(payload) {
  // 同上，payload 已包含 sub，不重复设置 options.subject
  return jwt.sign(
    { ...payload, kind: 'refresh' },
    config.auth.secret,
    {
      algorithm: config.auth.algorithm,
      expiresIn: config.auth.refreshTokenTtl,
      issuer: config.auth.issuer,
      audience: config.auth.audience
    }
  );
}

function verifyToken(token, options = {}) {
  return jwt.verify(token, config.auth.secret, {
    algorithms: [config.auth.algorithm],
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    ...options
  });
}

module.exports = { signAccessToken, signRefreshToken, verifyToken };
