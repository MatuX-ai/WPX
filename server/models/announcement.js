/**
 * 公告管理
 *   - list / findById / create / update / remove
 *   - toggleStatus 状态机流转：draft -> pending -> active -> expired/offline
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'announcements';
const ALLOWED_STATUS = ['draft', 'pending', 'active', 'expired', 'offline'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'start_at', 'end_at', 'pinned']);

async function list({
  q, status, page = 1, pageSize = 20, sort = 'pinned', order = 'desc'
} = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(title ILIKE $${i} OR body_md ILIKE $${i})`);
  }
  if (status) {
    if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'pinned';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, title, body_md, status, pinned, start_at, end_at, meta, created_at, updated_at
    FROM ${TABLE}
    ${whereSql}
    ORDER BY pinned DESC, ${safeSort} ${safeOrder}, id DESC
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

async function create(payload) {
  const {
    title, bodyMd, status = 'draft', pinned = false,
    startAt = null, endAt = null, meta = {}
  } = payload || {};
  if (!title) throw new BadRequestError('缺少 title');
  if (!bodyMd) throw new BadRequestError('缺少 bodyMd');
  if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');

  const sql = `
    INSERT INTO ${TABLE} (title, body_md, status, pinned, start_at, end_at, meta)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING *
  `;
  const res = await db.query(sql, [
    title, bodyMd, status, !!pinned, startAt, endAt,
    JSON.stringify(meta || {})
  ]);
  return res.rows[0];
}

async function update(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    title: 'title',
    bodyMd: 'body_md',
    status: 'status',
    pinned: 'pinned',
    startAt: 'start_at',
    endAt: 'end_at',
    meta: 'meta'
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      let val = patch[k];
      if (k === 'status' && !ALLOWED_STATUS.includes(val)) {
        throw new BadRequestError('status 取值非法');
      }
      if (k === 'meta') val = JSON.stringify(patch[k] || {});
      if (k === 'pinned') val = !!patch[k];
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

async function remove(id) {
  const res = await db.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return res.rowCount > 0;
}

module.exports = {
  ALLOWED_STATUS,
  list,
  findById,
  create,
  update,
  remove
};