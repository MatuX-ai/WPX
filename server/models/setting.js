/**
 * 系统设置（KV + JSONB）
 *   - list / get / getAll / upsert / remove
 *   - 批量更新（事务）
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'system_settings';

/**
 * 列出配置项，支持按 category 过滤 + 分页
 *   - category    general | payment | ai | security | feature | ...
 *   - q           key / description 模糊匹配
 *   - pageSize    默认 50，最大 200
 */
async function list({ q, category, page = 1, pageSize = 50 } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(key ILIKE $${i} OR description ILIKE $${i})`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT key, value, category, description, is_public, updated_by, created_at, updated_at
    FROM ${TABLE}
    ${whereSql}
    ORDER BY category ASC, key ASC
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
 * 取单个 key（不存在返回 null）
 */
async function get(key) {
  const res = await db.query(`SELECT * FROM ${TABLE} WHERE key = $1 LIMIT 1`, [key]);
  return res.rows[0] || null;
}

/**
 * 读取所有 is_public=TRUE 的 key（供客户端启动时拉取）
 */
async function listPublic() {
  const res = await db.query(
    `SELECT key, value FROM ${TABLE} WHERE is_public = TRUE ORDER BY key ASC`
  );
  return res.rows;
}

/**
 * 批量写入：items = [{ key, value, category?, description?, isPublic?, updatedBy? }]
 *   - 已存在 -> UPSERT
 *   - 不存在 -> INSERT
 *   - 同一事务
 */
async function upsertMany(items, updatedBy) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('items 不能为空');
  }
  return db.withTransaction(async (client) => {
    const out = [];
    for (const it of items) {
      if (!it || !it.key) throw new BadRequestError('每项必须包含 key');
      const sql = `
        INSERT INTO ${TABLE} (key, value, category, description, is_public, updated_by, updated_at)
        VALUES ($1, $2::jsonb, $3, $4, $5, $6, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          category = COALESCE(EXCLUDED.category, ${TABLE}.category),
          description = COALESCE(EXCLUDED.description, ${TABLE}.description),
          is_public = COALESCE(EXCLUDED.is_public, ${TABLE}.is_public),
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `;
      const params = [
        it.key,
        JSON.stringify(it.value === undefined ? {} : it.value),
        it.category || 'general',
        it.description || null,
        typeof it.isPublic === 'boolean' ? it.isPublic : false,
        updatedBy || null
      ];
      const res = await client.query(sql, params);
      out.push(res.rows[0]);
    }
    return out;
  });
}

async function remove(key) {
  const res = await db.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
  return res.rowCount > 0;
}

module.exports = {
  list,
  get,
  listPublic,
  upsertMany,
  remove
};