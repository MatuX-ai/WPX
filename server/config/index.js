/**
 * 应用配置加载
 * 统一读取并校验环境变量
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function bool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, defaultValue) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function list(value, defaultValue = []) {
  if (!value) return defaultValue;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3000),
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  logLevel: process.env.LOG_LEVEL || 'info',
  // 公开外网域名（用于生成绝对 URL / 跨域）
  publicHost: process.env.PUBLIC_HOST || `http://localhost:${int(process.env.PORT, 3000)}`,
  // API 网关主域名（用于日志/响应头标识）
  apiDomain: process.env.API_DOMAIN || 'api.prowpx.com',
  // CDN 前缀（如 https://cdn.prowpx.com），可空
  cdnBase: (process.env.CDN_BASE || '').replace(/\/$/, ''),
  // 邮件中链接的公共 Web URL（用于生成验证 / 重置链接）
  publicWebBase: process.env.PUBLIC_WEB_BASE || 'https://prowpx.com',
  // 信任的反向代理跳数（默认 1，配合 Nginx / Aliyun SLB）
  trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 1),

  cors: {
    // 统一以数组形式存储；若包含 '*'，表示放行任意 origin
    origins: (() => {
      const v = process.env.CORS_ORIGIN;
      if (!v) return ['*'];
      const arr = String(v).split(',').map((s) => s.trim()).filter(Boolean);
      return arr.length ? arr : ['*'];
    })(),
    credentials: bool(process.env.CORS_CREDENTIALS, true)
  },

  pg: {
    host: process.env.PG_HOST || '127.0.0.1',
    port: int(process.env.PG_PORT, 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'wpx',
    max: int(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: int(process.env.PG_IDLE_TIMEOUT_MS, 30000),
    ssl: bool(process.env.PG_SSL, false) ? { rejectUnauthorized: bool(process.env.PG_SSL_REJECT_UNAUTHORIZED, true) } : false
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    password: process.env.REDIS_PASSWORD || undefined,
    db: int(process.env.REDIS_DB, 0)
  },

  auth: {
    secret: process.env.ACCOUNT_JWT_SECRET || '',
    algorithm: process.env.ACCOUNT_JWT_ALG || 'HS256',
    // prowpx.com 自托管邮箱认证签发的 JWT
    issuer: process.env.ACCOUNT_JWT_ISSUER || 'prowpx.com',
    audience: process.env.ACCOUNT_JWT_AUDIENCE || 'wpx-server',
    accessTokenTtl: process.env.ACCOUNT_ACCESS_TOKEN_TTL || '2h',
    refreshTokenTtl: process.env.ACCOUNT_REFRESH_TOKEN_TTL || '30d',
    bypass: bool(process.env.AUTH_BYPASS, false),
    bypassRoles: list(process.env.AUTH_BYPASS_ROLES, ['dev'])
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'WPX <noreply@prowpx.com>'
  }
};

// 启动时打印关键配置（隐藏敏感字段）
function describe() {
  const safe = JSON.parse(JSON.stringify(config));
  if (safe.pg.password) safe.pg.password = '***';
  if (safe.redis.password) safe.redis.password = '***';
  if (safe.auth.secret) safe.auth.secret = '***';
  return safe;
}

module.exports = config;
module.exports.describe = describe;
