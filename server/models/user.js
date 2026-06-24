/**
 * 用户模型 - 与 account.proclaw.cc 中心化账户对接
 * 本服务通常不需要独立 user 表，但提供本地缓存/扩展字段表
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'user_profiles';
const ALLOWED_STATUS = ['active', 'disabled', 'banned'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'nickname', 'email', 'status']);

/**
 * 按 account id 查找本地画像
 */
async function findByAccountId(accountId) {
  const res = await db.query(
    `SELECT * FROM ${TABLE} WHERE account_id = $1 LIMIT 1`,
    [accountId]
  );
  return res.rows[0] || null;
}

/**
 * Upsert 用户画像
 */
async function upsertProfile(accountId, profile) {
  const sql = `
    INSERT INTO ${TABLE} (account_id, nickname, avatar, email, meta, updated_at)
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

// =========================
// 管理后台相关
// =========================

/**
 * 分页查询用户列表
 * @param {Object} opts
 *   - q         关键字，匹配 account_id / nickname / email
 *   - status    状态筛选
 *   - page      页码（从 1 开始）
 *   - pageSize  每页条数
 *   - sort      排序列
 *   - order     'asc' | 'desc'
 */
async function list({ q, status, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(account_id ILIKE $${i} OR nickname ILIKE $${i} OR email ILIKE $${i})`);
  }
  if (status) {
    if (!ALLOWED_STATUS.includes(status)) {
      throw new BadRequestError('status 取值必须是 active / disabled / banned');
    }
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataSql = `
    SELECT account_id, nickname, avatar, email, status, created_at, updated_at
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
    items: dataRes.rows,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize))
    }
  };
}

/**
 * 获取用户详情（含画像 + 最近活动 + 累计统计）
 */
async function detail(accountId) {
  const profileRes = await db.query(
    `SELECT * FROM ${TABLE} WHERE account_id = $1 LIMIT 1`,
    [accountId]
  );
  const profile = profileRes.rows[0] || null;
  if (!profile) return null;

  // 最近 10 条使用事件
  const eventsRes = await db.query(
    `SELECT id, kind, quantity, created_at
     FROM usage_events
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [accountId]
  );

  // 最近 10 条支付
  const payRes = await db.query(
    `SELECT id, amount_cents, currency, status, product, created_at
     FROM payments
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [accountId]
  );

  // 累计统计
  const statsRes = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM usage_events WHERE account_id = $1) AS total_events,
       (SELECT COALESCE(SUM(quantity), 0)::bigint FROM usage_events WHERE account_id = $1) AS total_quantity,
       (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM payments
         WHERE account_id = $1 AND status = 'paid') AS total_paid_cents`,
    [accountId]
  );

  return {
    profile,
    recentEvents: eventsRes.rows,
    recentPayments: payRes.rows,
    stats: statsRes.rows[0]
  };
}

/**
 * 修改用户状态
 * @param {string} accountId
 * @param {string} status  'active' | 'disabled' | 'banned'
 * @param {string} [reason]  原因，写入 meta.disabled_reason
 * @param {string} [operatorId]  操作人 accountId
 */
async function updateStatus(accountId, status, reason, operatorId) {
  if (!ALLOWED_STATUS.includes(status)) {
    throw new BadRequestError('status 取值必须是 active / disabled / banned');
  }

  // 合并 meta：在原 meta 基础上写入/移除 disabled 相关信息
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
    WHERE account_id = $1
    RETURNING *
  `;
  const res = await db.query(sql, [
    accountId,
    status,
    JSON.stringify(metaPatch)
  ]);
  return res.rows[0] || null;
}

/**
 * 硬删除用户画像（级联：usage_events / payments 暂不级联，按业务需要另议）
 */
async function remove(accountId) {
  const res = await db.query(
    `DELETE FROM ${TABLE} WHERE account_id = $1 RETURNING account_id`,
    [accountId]
  );
  return res.rowCount > 0;
}

module.exports = {
  ALLOWED_STATUS,
  findByAccountId,
  upsertProfile,
  list,
  detail,
  updateStatus,
  remove
};
