/**
 * 用户模型
 *
 * 既支持 WPX 自托管邮箱认证（users 表，bcrypt 哈希）
 * 也保留旧版 account.proclaw.cc 中心化账户的 account_id 兼容字段（user_profiles 表）。
 */
'use strict';

const db = require('./db');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/errors');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const emailService = require('../services/email-service');
const logger = require('../utils/logger');

const TABLE = 'users';
const PROFILE_TABLE = 'user_profiles';
const ALLOWED_STATUS = ['active', 'disabled', 'banned'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_MINUTES = 30;

// =========================
// 基础 CRUD
// =========================

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * 按 email 查找用户（不区分大小写）
 */
async function findByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const res = await db.query(
    `SELECT * FROM ${TABLE} WHERE LOWER(email) = $1 LIMIT 1`,
    [normalized]
  );
  return res.rows[0] || null;
}

/**
 * 按 id 查找用户
 */
async function findById(id) {
  if (!id) return null;
  const res = await db.query(`SELECT * FROM ${TABLE} WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
}

/**
 * 过滤对外返回字段（剥离敏感信息）
 */
function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    avatar: row.avatar,
    roles: row.roles || ['user'],
    status: row.status,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  };
}

// =========================
// 注册 / 验证邮件
// =========================

/**
 * 创建新用户（邮箱+密码+昵称），自动生成邮箱验证令牌。
 * @param {{ email: string, password: string, nickname?: string }} payload
 */
async function createUser(payload) {
  const email = normalizeEmail(payload.email);
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new BadRequestError('请输入正确的邮箱地址');
  }
  const password = String(payload.password || '');
  if (password.length < 8) {
    throw new BadRequestError('密码至少 8 位');
  }

  const existing = await findByEmail(email);
  if (existing) {
    throw new BadRequestError('该邮箱已注册，可直接登录或找回密码');
  }

  const passwordHash = await hashPassword(password);
  const verifyToken = emailService.generateToken();
  const verifyExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 3600 * 1000);
  const nickname = payload.nickname ? String(payload.nickname).trim().slice(0, 32) : null;

  // Bootstrap: 表中第一个用户自动获得 admin 角色（方便 bootstrap / Vercel Function 部署）
  // 后续用户默认 ['user']。如需手动晋升 admin，可直接 UPDATE users SET roles = ARRAY['admin','user'] WHERE email = ...
  const countRes = await db.query(`SELECT COUNT(*)::int AS n FROM ${TABLE}`);
  const isFirstUser = countRes.rows[0].n === 0;
  const roles = isFirstUser ? ['admin', 'user'] : ['user'];

  const res = await db.query(
    `INSERT INTO ${TABLE} (email, password_hash, nickname, email_verify_token, email_verify_expires_at, roles)
     VALUES ($1, $2, $3, $4, $5, $6::TEXT[])
     RETURNING *`,
    [email, passwordHash, nickname, verifyToken, verifyExpiresAt, roles]
  );

  const user = res.rows[0];

  // 异步发送验证邮件（失败不影响注册成功）
  emailService
    .sendVerifyEmail({ to: email, token: verifyToken, nickname })
    .catch((err) => logger.error('[user] sendVerifyEmail failed', { err: err.message }));

  return toPublic(user);
}

/**
 * 校验邮箱验证令牌并标记邮箱已验证
 * @param {string} token
 */
async function consumeEmailVerifyToken(token) {
  if (!token) throw new BadRequestError('缺少验证令牌');
  const res = await db.query(
    `SELECT * FROM ${TABLE}
     WHERE email_verify_token = $1
       AND email_verify_expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  const user = res.rows[0];
  if (!user) {
    throw new BadRequestError('验证链接无效或已过期');
  }
  await db.query(
    `UPDATE ${TABLE}
     SET email_verified = TRUE,
         email_verify_token = NULL,
         email_verify_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [user.id]
  );
  return toPublic(user);
}

// =========================
// 登录 / JWT
// =========================

/**
 * 校验邮箱+密码，成功后返回 access/refresh token 与用户公开信息
 * @param {{ email: string, password: string }} payload
 */
async function authenticate(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  if (!email || !password) {
    throw new BadRequestError('请输入邮箱与密码');
  }
  const user = await findByEmail(email);
  // 统一返回"邮箱或密码错误"，避免暴露账号是否存在
  if (!user || !user.password_hash) {
    throw new BadRequestError('邮箱或密码错误');
  }
  if (user.status !== 'active') {
    throw statusToForbiddenError(user.status);
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw new BadRequestError('邮箱或密码错误');
  }

  // 更新最近登录时间
  db.query(`UPDATE ${TABLE} SET last_login_at = NOW() WHERE id = $1`, [user.id]).catch(
    (err) => logger.warn('[user] update last_login_at failed', { err: err.message })
  );

  return issueTokensForUser(user);
}

function statusToForbiddenError(status) {
  if (status === 'banned') return new ForbiddenError('账号已被封禁，请联系管理员');
  if (status === 'disabled') return new ForbiddenError('账号已停用，请联系管理员');
  return new ForbiddenError('账号当前不可登录');
}

/**
 * 为指定用户签发新的 access + refresh token
 */
function issueTokensForUser(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    nickname: user.nickname || '',
    roles: user.roles || ['user']
  };
  const token = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: user.id });
  return {
    token,
    refreshToken,
    user: toPublic(user)
  };
}

/**
 * 使用 refresh token 换取新的 access token
 * @param {string} refreshToken
 */
async function refreshAccessToken(refreshToken) {
  const payload = verifyToken(String(refreshToken || ''));
  if (payload.kind !== 'refresh' || !payload.sub) {
    throw new BadRequestError('refresh token 无效');
  }
  const user = await findById(payload.sub);
  if (!user) {
    throw new NotFoundError('账号不存在');
  }
  if (user.status !== 'active') {
    throw statusToForbiddenError(user.status);
  }
  return issueTokensForUser(user);
}

// =========================
// 找回密码
// =========================

/**
 * 生成密码重置令牌并发送邮件。出于隐私考虑：邮箱不存在时也返回成功，
 * 但不发送任何邮件。
 * @param {string} email
 */
async function requestPasswordReset(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_REGEX.test(normalized)) {
    throw new BadRequestError('请输入正确的邮箱地址');
  }
  const user = await findByEmail(normalized);
  if (!user) {
    // 不暴露账号是否存在
    return { ok: true, sent: false };
  }
  const token = emailService.generateToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await db.query(
    `UPDATE ${TABLE}
     SET password_reset_token = $2,
         password_reset_expires_at = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [user.id, token, expiresAt]
  );

  emailService
    .sendResetPasswordEmail({ to: normalized, token, nickname: user.nickname })
    .catch((err) => logger.error('[user] sendResetPasswordEmail failed', { err: err.message }));

  return { ok: true, sent: true };
}

/**
 * 消费重置令牌并设置新密码
 */
async function consumePasswordResetToken(token, newPassword) {
  if (!token) throw new BadRequestError('缺少重置令牌');
  if (String(newPassword || '').length < 8) {
    throw new BadRequestError('新密码至少 8 位');
  }
  const res = await db.query(
    `SELECT * FROM ${TABLE}
     WHERE password_reset_token = $1
       AND password_reset_expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  const user = res.rows[0];
  if (!user) {
    throw new BadRequestError('重置链接无效或已过期');
  }
  const newHash = await hashPassword(newPassword);
  await db.query(
    `UPDATE ${TABLE}
     SET password_hash = $2,
         password_reset_token = NULL,
         password_reset_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [user.id, newHash]
  );
  return { ok: true };
}

// =========================
// 兼容旧版：account_id 画像
// =========================

/**
 * 按 account id 查找本地画像（兼容老 account.proclaw.cc 用户）
 */
async function findByAccountId(accountId) {
  const res = await db.query(
    `SELECT * FROM ${PROFILE_TABLE} WHERE account_id = $1 LIMIT 1`,
    [accountId]
  );
  return res.rows[0] || null;
}

/**
 * Upsert 用户画像（兼容老数据）
 */
async function upsertProfile(accountId, profile) {
  const sql = `
    INSERT INTO ${PROFILE_TABLE} (account_id, nickname, avatar, email, meta, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
    ON CONFLICT (account_id) DO UPDATE SET
      nickname = EXCLUDED.nickname,
      avatar = EXCLUDED.avatar,
      email = EXCLUDED.email,
      meta = EXCLUDED.meta,
      updated_at = NOW()
    RETURNING *
  `;
  const res = await db.query(sql, [
    accountId,
    profile.nickname || null,
    profile.avatar || null,
    profile.email || null,
    JSON.stringify(profile.meta || {})
  ]);
  return res.rows[0];
}

/**
 * 分页查询用户列表（管理后台用）
 */
async function list({
  q,
  status,
  page = 1,
  pageSize = 20,
  sort = 'created_at',
  order = 'desc'
} = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(LOWER(email) LIKE $${i} OR LOWER(COALESCE(nickname, '')) LIKE $${i})`);
  }
  if (status) {
    if (!ALLOWED_STATUS.includes(status)) {
      throw new BadRequestError('status 取值必须是 active / disabled / banned');
    }
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'nickname', 'email', 'status']);
  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataSql = `
    SELECT id, email, nickname, avatar, roles, status, email_verified, last_login_at, created_at, updated_at
    FROM ${TABLE}
    ${whereSql}
    ORDER BY ${safeSort} ${safeOrder}
    LIMIT ${safeSize} OFFSET ${offset}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM ${TABLE} ${whereSql}`;

  const [dataRes, countRes] = await Promise.all([
    db.query(dataSql, params),
    db.query(countSql, params)
  ]);

  const total = countRes.rows[0].total;
  return {
    items: dataRes.rows.map(toPublic),
    pagination: {
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize))
    }
  };
}

async function detail(id) {
  const user = await findById(id);
  if (!user) return null;

  const eventsRes = await db.query(
    `SELECT id, kind, quantity, created_at
     FROM usage_events
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [id]
  );

  const payRes = await db.query(
    `SELECT id, amount_cents, currency, status, product, created_at
     FROM payments
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [id]
  );

  const statsRes = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM usage_events WHERE account_id = $1) AS total_events,
       (SELECT COALESCE(SUM(quantity), 0)::bigint FROM usage_events WHERE account_id = $1) AS total_quantity,
       (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM payments
         WHERE account_id = $1 AND status = 'paid') AS total_paid_cents`,
    [id]
  );

  return {
    profile: toPublic(user),
    recentEvents: eventsRes.rows,
    recentPayments: payRes.rows,
    stats: statsRes.rows[0]
  };
}

async function updateStatus(id, status, reason, operatorId) {
  if (!ALLOWED_STATUS.includes(status)) {
    throw new BadRequestError('status 取值必须是 active / disabled / banned');
  }

  const metaPatch = {
    status_updated_at: new Date().toISOString(),
    status_updated_by: operatorId || null,
    status_reason: reason || null
  };

  const sql = `
    UPDATE ${TABLE}
    SET status = $2,
        meta = meta || $3::jsonb,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const res = await db.query(sql, [id, status, JSON.stringify(metaPatch)]);
  return toPublic(res.rows[0] || null);
}

async function remove(id) {
  const res = await db.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]);
  return res.rowCount > 0;
}

module.exports = {
  ALLOWED_STATUS,
  findByEmail,
  findById,
  createUser,
  consumeEmailVerifyToken,
  authenticate,
  refreshAccessToken,
  requestPasswordReset,
  consumePasswordResetToken,
  findByAccountId,
  upsertProfile,
  list,
  detail,
  updateStatus,
  remove,
  toPublic
};
