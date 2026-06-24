/**
 * 字体库
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'fonts';
const LOG_TABLE = 'font_usage_logs';
const ALLOWED_FORMAT = ['woff2', 'woff', 'ttf', 'otf', 'eot'];
const ALLOWED_CATEGORY = ['chinese', 'english', 'mono', 'display', 'handwriting'];
const ALLOWED_STATUS = ['active', 'inactive', 'reviewing'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'name', 'family', 'category', 'file_size']);

// =========================
// CRUD
// =========================

async function list({ q, status, category, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(id ILIKE $${i} OR name ILIKE $${i} OR family ILIKE $${i} OR $${i} = ANY(tags))`);
  }
  if (status) {
    if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (category) {
    if (!ALLOWED_CATEGORY.includes(category)) throw new BadRequestError('category 取值非法');
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, name, family, url, format, category, license, file_size, status, tags, created_at, updated_at
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

async function create(payload) {
  const {
    id, name, family, url, format = 'woff2', category = 'chinese',
    license = null, fileSize = null, status = 'active', tags = [], meta = {}
  } = payload || {};
  if (!id) throw new BadRequestError('缺少 id');
  if (!name) throw new BadRequestError('缺少 name');
  if (!family) throw new BadRequestError('缺少 family');
  if (!url) throw new BadRequestError('缺少 url');
  if (!ALLOWED_FORMAT.includes(format)) throw new BadRequestError('format 取值非法');
  if (!ALLOWED_CATEGORY.includes(category)) throw new BadRequestError('category 取值非法');
  if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');

  const sql = `
    INSERT INTO ${TABLE}
      (id, name, family, url, format, category, license, file_size, status, tags, meta)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::jsonb)
    RETURNING *
  `;
  const res = await db.query(sql, [
    id, name, family, url, format, category, license, fileSize, status,
    tags || [], JSON.stringify(meta || {})
  ]);
  return res.rows[0];
}

async function update(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    name: 'name',
    family: 'family',
    url: 'url',
    format: 'format',
    category: 'category',
    license: 'license',
    fileSize: 'file_size',
    status: 'status',
    tags: 'tags',
    meta: 'meta'
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      let val = patch[k];
      if (k === 'format' && !ALLOWED_FORMAT.includes(val)) throw new BadRequestError('format 取值非法');
      if (k === 'category' && !ALLOWED_CATEGORY.includes(val)) throw new BadRequestError('category 取值非法');
      if (k === 'status' && !ALLOWED_STATUS.includes(val)) throw new BadRequestError('status 取值非法');
      if (k === 'meta') val = JSON.stringify(patch[k] || {});
      if (k === 'tags') val = patch[k] || [];
      params.push(val);
      fields.push(`${col} = $${params.length}${k === 'meta' ? '::jsonb' : ''}${k === 'tags' ? '::text[]' : ''}`);
    }
  }
  if (fields.length === 0) return findById(id);
  const sql = `UPDATE ${TABLE} SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

async function updateStatus(id, status) {
  if (!ALLOWED_STATUS.includes(status)) throw new BadRequestError('status 取值非法');
  const res = await db.query(
    `UPDATE ${TABLE} SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return res.rows[0] || null;
}

// =========================
// 统计
// =========================

/**
 * 单个字体使用统计
 *   - window        '1h' | '24h' | '7d' | '30d'
 *   - kind          'preview' | 'download' | 'apply' | 'embed'  (可选)
 */
async function stats(id, { window: win = '7d', kind } = {}) {
  const windowMap = {
    '1h': "INTERVAL '1 hour'",
    '24h': "INTERVAL '24 hours'",
    '7d': "INTERVAL '7 days'",
    '30d': "INTERVAL '30 days'"
  };
  const intervalSql = windowMap[win] || windowMap['7d'];

  // 校验字体存在
  const font = await findById(id);
  if (!font) return null;

  // 概要
  const params = [id];
  const kindClause = [];
  if (kind) {
    params.push(kind);
    kindClause.push(`AND kind = $${params.length}`);
  }

  const summarySql = `
    SELECT
      COUNT(*)::int                                                AS total_events,
      COUNT(DISTINCT account_id)::int                              AS unique_users,
      COUNT(*) FILTER (WHERE kind = 'preview')::int                AS preview_count,
      COUNT(*) FILTER (WHERE kind = 'download')::int               AS download_count,
      COUNT(*) FILTER (WHERE kind = 'apply')::int                  AS apply_count,
      COUNT(*) FILTER (WHERE kind = 'embed')::int                  AS embed_count
    FROM ${LOG_TABLE}
    WHERE font_id = $1
      AND created_at >= NOW() - ${intervalSql}
      ${kindClause.join(' ')}
  `;
  const summaryRes = await db.query(summarySql, params);
  const summary = summaryRes.rows[0] || {};

  // 每日趋势
  const dailySql = `
    SELECT
      created_at::date AS date,
      COUNT(*)::int    AS events,
      COUNT(DISTINCT account_id)::int AS users
    FROM ${LOG_TABLE}
    WHERE font_id = $1
      AND created_at::date >= CURRENT_DATE - (INTERVAL '${win === '1h' ? '1 day' : (win === '24h' ? '1 day' : (win === '7d' ? '6 days' : '29 days'))}')::interval
      ${kindClause.join(' ')}
    GROUP BY 1
    ORDER BY 1
  `;
  const dailyRes = await db.query(dailySql, params);

  // 累计
  const allTimeSql = `
    SELECT
      COUNT(*)::int                       AS total_events,
      COUNT(DISTINCT account_id)::int     AS unique_users
    FROM ${LOG_TABLE}
    WHERE font_id = $1
      ${kindClause.join(' ')}
  `;
  const allTimeRes = await db.query(allTimeSql, params);
  const allTime = allTimeRes.rows[0] || {};

  return {
    font: {
      id: font.id,
      name: font.name,
      family: font.family,
      category: font.category,
      status: font.status
    },
    window: win,
    summary: {
      totalEvents: summary.total_events || 0,
      uniqueUsers: summary.unique_users || 0,
      previewCount: summary.preview_count || 0,
      downloadCount: summary.download_count || 0,
      applyCount: summary.apply_count || 0,
      embedCount: summary.embed_count || 0
    },
    daily: dailyRes.rows,
    allTime: {
      totalEvents: allTime.total_events || 0,
      uniqueUsers: allTime.unique_users || 0
    }
  };
}

module.exports = {
  ALLOWED_FORMAT,
  ALLOWED_CATEGORY,
  ALLOWED_STATUS,
  list,
  findById,
  create,
  update,
  updateStatus,
  stats
};
