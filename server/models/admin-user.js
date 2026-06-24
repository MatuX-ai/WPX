/**
 * 管理员账号
 *   - list / findById / findByAccountId / create / update / remove / touchLogin
 *   - 不允许删除超级管理员
 */
'use strict';

const db = require('./db');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const TABLE = 'admin_users';
const ALLOWED_ROLE = ['super', 'ops', 'editor'];
const ALLOWED_STATUS = ['active', 'disabled'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'last_login_at', 'role', 'status', 'email']);

async function list({ q, role, status, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(account_id ILIKE $${i} OR email ILIKE $${i} OR nickname ILIKE $${i})`);
  }
  if (role) {
    if (!ALLOWED_ROLE.includes(role)) throw new BadRequestError('role 取值非法');
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  if (status) {
    if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');
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
    SELECT id, account_id, email, nickname, role, status, last_login_at, meta, created_at, updated_at
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

async function findById(id) {
  const res = await db.query(`SELECT * FROM ${TABLE} WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
}

async function findByAccountId(accountId) {
  const res = await db.query(`SELECT * FROM ${TABLE} WHERE account_id = $1 LIMIT 1`, [accountId]);
  return res.rows[0] || null;
}

async function create(payload) {
  const {
    accountId, email = null, nickname = null,
    role = 'ops', status = 'active', meta = {}
  } = payload || {};
  if (!accountId) throw new BadRequestError('缺少 accountId');
  if (!ALLOWED_ROLE.includes(role)) throw new BadRequestError('role 取值非法');
  if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');

  const sql = `
    INSERT INTO ${TABLE} (account_id, email, nickname, role, status, meta)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING *
  `;
  const res = await db.query(sql, [
    accountId, email, nickname, role, status, JSON.stringify(meta || {})
  ]);
  return res.rows[0];
}

async function update(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    email: 'email',
    nickname: 'nickname',
    role: 'role',
    status: 'status',
    meta: 'meta',
    lastLoginAt: 'last_login_at'
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      let val = patch[k];
      if (k === 'role' && !ALLOWED_ROLE.includes(val)) {
        throw new BadRequestError('role 取值非法');
      }
      if (k === 'status' && !ALLOWED_STATUS.includes(val)) {
        throw new BadRequestError('status 取值非法');
      }
      if (k === 'meta') val = JSON.stringify(patch[k] || {});
      params.push(val);
      const suffix = k === 'meta' ? '::jsonb' : '';
      fields.push(`${col} = $${params.length}${suffix}`);
    }
  }
  if (fields.length === 0) return findById(id);
  const sql = `UPDATE ${TABLE} SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

async function remove(id, currentAccountId) {
  const found = await findById(id);
  if (!found) return false;
  // 超级管理员不可删除
  if (found.role === 'super') {
    throw new BadRequestError('超级管理员不可删除');
  }
  // 不能删除自己
  if (currentAccountId && found.account_id === currentAccountId) {
    throw new BadRequestError('不能删除自己的账号');
  }
  const res = await db.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return res.rowCount > 0;
}

async function touchLogin(accountId) {
  const sql = `
    UPDATE ${TABLE}
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE account_id = $1
    RETURNING *
  `;
  const res = await db.query(sql, [accountId]);
  return res.rows[0] || null;
}

module.exports = {
  ALLOWED_ROLE,
  ALLOWED_STATUS,
  list,
  findById,
  findByAccountId,
  create,
  update,
  remove,
  touchLogin
};