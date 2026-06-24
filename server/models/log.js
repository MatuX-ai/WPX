/**
 * 操作日志
 *   - record          异步写入（不阻塞主流程）
 *   - list            查询（筛选 + 分页）
 *   - exportRows      流式 CSV 导出所需的全量/范围查询
 */
'use strict';

const db = require('./db');
const logger = require('../utils/logger');

const TABLE = 'operation_logs';
const ALLOWED_SORT = new Set(['created_at', 'action', 'account_id', 'status_code', 'duration_ms']);

/**
 * 记录一条日志（失败仅记 warn，不影响业务）
 *   payload: {
 *     accountId, email, role, action, resourceType?, resourceId?,
 *     method?, path?, statusCode?, payload?, ip?, ua?, durationMs?, meta?
 *   }
 */
async function record(payload) {
  try {
    const {
      accountId, email, role, action,
      resourceType = null, resourceId = null,
      method = null, path = null, statusCode = null,
      payload: body = null, ip = null, ua = null,
      durationMs = 0, meta = {}
    } = payload || {};
    if (!action) return; // 必须有 action
    const sql = `
      INSERT INTO ${TABLE}
        (account_id, email, role, action, resource_type, resource_id,
         method, path, status_code, payload, ip, ua, duration_ms, meta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14::jsonb)
      RETURNING id
    `;
    const params = [
      accountId || 'anonymous',
      email || null,
      role || null,
      action,
      resourceType,
      resourceId,
      method,
      path,
      statusCode,
      JSON.stringify(body || {}),
      ip,
      ua,
      Number(durationMs) || 0,
      JSON.stringify(meta || {})
    ];
    const res = await db.query(sql, params);
    return res.rows[0]?.id;
  } catch (err) {
    logger.warn('operation_logs insert failed', { err: err.message });
  }
}

/**
 * 操作日志列表
 *   - q            account_id / email / action / path 模糊匹配
 *   - action       精确匹配，如 'user.disable'
 *   - accountId
 *   - resourceType + resourceId
 *   - status       'success' (2xx) | 'error' (>=400)
 *   - start / end
 */
async function list({
  q, action, accountId, resourceType, resourceId, status,
  start, end,
  page = 1, pageSize = 20, sort = 'created_at', order = 'desc'
} = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(account_id ILIKE $${i} OR email ILIKE $${i} OR action ILIKE $${i} OR path ILIKE $${i})`);
  }
  if (action) {
    params.push(action);
    where.push(`action = $${params.length}`);
  }
  if (accountId) {
    params.push(accountId);
    where.push(`account_id = $${params.length}`);
  }
  if (resourceType) {
    params.push(resourceType);
    where.push(`resource_type = $${params.length}`);
  }
  if (resourceId) {
    params.push(resourceId);
    where.push(`resource_id = $${params.length}`);
  }
  if (status === 'success') {
    where.push(`status_code >= 200 AND status_code < 400`);
  } else if (status === 'error') {
    where.push(`status_code >= 400`);
  }
  if (start) {
    params.push(start);
    where.push(`created_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    where.push(`created_at <= $${params.length}`);
  }

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, account_id, email, role, action, resource_type, resource_id,
           method, path, status_code, payload, ip, ua, duration_ms, meta, created_at
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
 * 导出用：返回当前筛选下的全量行（不应用分页，但限制最大行数防止失控）
 *   limit  默认 10000，最大 50000
 */
async function exportRows(filters = {}, limit = 10000) {
  const { q, action, accountId, resourceType, resourceId, status, start, end } = filters;
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(account_id ILIKE $${i} OR email ILIKE $${i} OR action ILIKE $${i} OR path ILIKE $${i})`);
  }
  if (action) {
    params.push(action);
    where.push(`action = $${params.length}`);
  }
  if (accountId) {
    params.push(accountId);
    where.push(`account_id = $${params.length}`);
  }
  if (resourceType) {
    params.push(resourceType);
    where.push(`resource_type = $${params.length}`);
  }
  if (resourceId) {
    params.push(resourceId);
    where.push(`resource_id = $${params.length}`);
  }
  if (status === 'success') where.push(`status_code >= 200 AND status_code < 400`);
  else if (status === 'error') where.push(`status_code >= 400`);
  if (start) {
    params.push(start);
    where.push(`created_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    where.push(`created_at <= $${params.length}`);
  }

  const safeLimit = Math.min(50000, Math.max(1, parseInt(limit, 10) || 10000));
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT id, account_id, email, role, action, resource_type, resource_id,
           method, path, status_code, ip, duration_ms, created_at
    FROM ${TABLE}
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;
  const res = await db.query(sql, params);
  return res.rows;
}

module.exports = {
  record,
  list,
  exportRows
};