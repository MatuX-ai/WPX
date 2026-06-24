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
  return jwt.sign(payload, config.auth.secret, {
    algorithm: config.auth.algorithm,
    expiresIn: config.auth.accessTokenTtl,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    subject: payload.sub
  });
}

function signRefreshToken(payload) {
  return jwt.sign(
    { ...payload, kind: 'refresh' },
    config.auth.secret,
    {
      algorithm: config.auth.algorithm,
      expiresIn: config.auth.refreshTokenTtl,
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      subject: payload.sub
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
