/**
 * 版本管理
 *   - list / findById / create / update / remove
 *   - publish       设置 published_at 并切换到已发布（自身不区分 status，通过 published_at 判定）
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'versions';
const ALLOWED_CHANNEL = ['stable', 'beta', 'alpha'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'published_at', 'version']);

async function list({ q, channel, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(version ILIKE $${i} OR release_notes ILIKE $${i})`);
  }
  if (channel) {
    if (!ALLOWED_CHANNEL.includes(channel)) throw new BadRequestError('channel 取值非法');
    params.push(channel);
    where.push(`channel = $${params.length}`);
  }

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, version, channel, release_notes, downloads, force_update,
           min_supported_version, published_at, created_at, updated_at
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

async function findByVersion(version) {
  const res = await db.query(`SELECT * FROM ${TABLE} WHERE version = $1 LIMIT 1`, [version]);
  return res.rows[0] || null;
}

async function create(payload) {
  const {
    version, channel = 'stable', releaseNotes = null,
    downloads = {}, forceUpdate = false, minSupportedVersion = null,
    publishedAt = null
  } = payload || {};
  if (!version) throw new BadRequestError('缺少 version');
  if (!ALLOWED_CHANNEL.includes(channel)) throw new BadRequestError('channel 取值非法');

  const sql = `
    INSERT INTO ${TABLE}
      (version, channel, release_notes, downloads, force_update, min_supported_version, published_at)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
    RETURNING *
  `;
  const res = await db.query(sql, [
    version, channel, releaseNotes,
    JSON.stringify(downloads || {}), !!forceUpdate, minSupportedVersion, publishedAt
  ]);
  return res.rows[0];
}

async function update(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    version: 'version',
    channel: 'channel',
    releaseNotes: 'release_notes',
    downloads: 'downloads',
    forceUpdate: 'force_update',
    minSupportedVersion: 'min_supported_version',
    publishedAt: 'published_at'
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      let val = patch[k];
      if (k === 'channel' && !ALLOWED_CHANNEL.includes(val)) {
        throw new BadRequestError('channel 取值非法');
      }
      if (k === 'downloads') val = JSON.stringify(patch[k] || {});
      if (k === 'forceUpdate') val = !!patch[k];
      params.push(val);
      const suffix = k === 'downloads' ? '::jsonb' : '';
      fields.push(`${col} = $${params.length}${suffix}`);
    }
  }
  if (fields.length === 0) return findById(id);
  const sql = `UPDATE ${TABLE} SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

async function publish(id) {
  const sql = `
    UPDATE ${TABLE}
    SET published_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const res = await db.query(sql, [id]);
  return res.rows[0] || null;
}

async function remove(id) {
  const res = await db.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return res.rowCount > 0;
}

module.exports = {
  ALLOWED_CHANNEL,
  list,
  findById,
  findByVersion,
  create,
  update,
  publish,
  remove
};