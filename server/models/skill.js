/**
 * Skills（技能库）
 *   - list / findById / create / update / remove
 *   - 内置技能不可删除
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'skills';
const ALLOWED_CATEGORY = ['student', 'teacher', 'general'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'name', 'code', 'category']);

async function list({ q, category, enabled, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(id ILIKE $${i} OR name ILIKE $${i} OR code ILIKE $${i} OR $${i} = ANY(tags))`);
  }
  if (category) {
    if (!ALLOWED_CATEGORY.includes(category)) throw new BadRequestError('category 取值非法');
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (enabled !== undefined && enabled !== null && enabled !== '') {
    params.push(String(enabled) === 'true' || enabled === true);
    where.push(`enabled = $${params.length}`);
  }

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, name, code, category, description, enabled, builtin, tags, created_at, updated_at
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
    id, name, code, category = 'general', description = null,
    systemPrompt = null, enabled = true, builtin = false,
    tags = [], config = {}, meta = {}
  } = payload || {};
  if (!id) throw new BadRequestError('缺少 id');
  if (!name) throw new BadRequestError('缺少 name');
  if (!code) throw new BadRequestError('缺少 code');
  if (!ALLOWED_CATEGORY.includes(category)) throw new BadRequestError('category 取值非法');

  const sql = `
    INSERT INTO ${TABLE}
      (id, name, code, category, description, system_prompt, enabled, builtin, tags, config, meta)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb, $11::jsonb)
    RETURNING *
  `;
  const res = await db.query(sql, [
    id, name, code, category, description, systemPrompt,
    !!enabled, !!builtin, tags || [],
    JSON.stringify(config || {}), JSON.stringify(meta || {})
  ]);
  return res.rows[0];
}

async function update(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    name: 'name',
    code: 'code',
    category: 'category',
    description: 'description',
    systemPrompt: 'system_prompt',
    enabled: 'enabled',
    tags: 'tags',
    config: 'config',
    meta: 'meta'
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      let val = patch[k];
      if (k === 'category' && !ALLOWED_CATEGORY.includes(val)) {
        throw new BadRequestError('category 取值非法');
      }
      if (k === 'config') val = JSON.stringify(patch[k] || {});
      if (k === 'meta') val = JSON.stringify(patch[k] || {});
      if (k === 'tags') val = patch[k] || [];
      if (k === 'enabled') val = !!patch[k];
      params.push(val);
      let suffix = '';
      if (k === 'config' || k === 'meta') suffix = '::jsonb';
      else if (k === 'tags') suffix = '::text[]';
      fields.push(`${col} = $${params.length}${suffix}`);
    }
  }
  if (fields.length === 0) return findById(id);
  const sql = `UPDATE ${TABLE} SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

async function remove(id) {
  // 内置技能不可删除
  const found = await findById(id);
  if (!found) return false;
  if (found.builtin) {
    throw new BadRequestError('内置技能不可删除');
  }
  const res = await db.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return res.rowCount > 0;
}

module.exports = {
  ALLOWED_CATEGORY,
  list,
  findById,
  create,
  update,
  remove
};