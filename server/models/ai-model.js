/**
 * AI 模型配置 + 调用监控
 */
'use strict';

const db = require('./db');
const { BadRequestError } = require('../utils/errors');

const TABLE = 'ai_models';
const LOG_TABLE = 'model_call_logs';
const ALLOWED_TYPE = ['chat', 'embedding', 'image', 'layout', 'rerank'];
const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'name', 'code', 'provider', 'type']);

// =========================
// CRUD
// =========================

async function list({ q, type, enabled, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(id ILIKE $${i} OR name ILIKE $${i} OR code ILIKE $${i} OR provider ILIKE $${i})`);
  }
  if (type) {
    if (!ALLOWED_TYPE.includes(type)) throw new BadRequestError('type 取值非法');
    params.push(type);
    where.push(`type = $${params.length}`);
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
    SELECT * FROM ${TABLE}
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
    id, name, code, provider, type = 'chat', enabled = true,
    rateLimit = 60, config = {}, description = null
  } = payload || {};
  if (!id) throw new BadRequestError('缺少 id');
  if (!name) throw new BadRequestError('缺少 name');
  if (!code) throw new BadRequestError('缺少 code');
  if (!provider) throw new BadRequestError('缺少 provider');
  if (!ALLOWED_TYPE.includes(type)) throw new BadRequestError('type 取值非法');

  const sql = `
    INSERT INTO ${TABLE}
      (id, name, code, provider, type, enabled, rate_limit, config, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
    RETURNING *
  `;
  const res = await db.query(sql, [
    id, name, code, provider, type, !!enabled, rateLimit,
    JSON.stringify(config || {}), description
  ]);
  return res.rows[0];
}

async function update(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    name: 'name',
    code: 'code',
    provider: 'provider',
    type: 'type',
    enabled: 'enabled',
    rateLimit: 'rate_limit',
    config: 'config',
    description: 'description'
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(k === 'config' ? JSON.stringify(patch[k] || {}) : patch[k]);
      if (k === 'type' && !ALLOWED_TYPE.includes(patch[k])) {
        throw new BadRequestError('type 取值非法');
      }
      fields.push(`${col} = $${params.length}${k === 'config' ? '::jsonb' : ''}`);
    }
  }
  if (fields.length === 0) return findById(id);
  const sql = `UPDATE ${TABLE} SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

// =========================
// 监控
// =========================

/**
 * 调用监控聚合
 *   - window        '1h' | '24h' | '7d'（默认 24h）
 *   - groupBy       'model' | 'kind' | 'status'（默认 model）
 */
async function monitor({ window: win = '24h', groupBy = 'model' } = {}) {
  const windowMap = { '1h': "INTERVAL '1 hour'", '24h': "INTERVAL '24 hours'", '7d': "INTERVAL '7 days'" };
  const intervalSql = windowMap[win] || windowMap['24h'];

  const groupColMap = {
    model: 'model_id',
    kind: 'kind',
    status: 'status'
  };
  const groupCol = groupColMap[groupBy] || 'model_id';

  // 概览
  const summarySql = `
    SELECT
      COUNT(*)::int                                            AS total_calls,
      COUNT(*) FILTER (WHERE status = 'success')::int          AS success_calls,
      COUNT(*) FILTER (WHERE status = 'failed')::int           AS failed_calls,
      COUNT(*) FILTER (WHERE status = 'timeout')::int          AS timeout_calls,
      COALESCE(AVG(latency_ms), 0)::int                        AS avg_latency_ms,
      COALESCE(SUM(prompt_tokens), 0)::bigint                  AS total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::bigint              AS total_completion_tokens,
      COUNT(DISTINCT account_id)::int                          AS active_accounts
    FROM ${LOG_TABLE}
    WHERE created_at >= NOW() - ${intervalSql}
  `;
  const summaryRes = await db.query(summarySql);
  const summary = summaryRes.rows[0] || {};

  // 分组序列
  const seriesSql = `
    SELECT
      ${groupCol}                                              AS key,
      COUNT(*)::int                                            AS calls,
      COUNT(*) FILTER (WHERE status = 'success')::int          AS success_calls,
      COUNT(*) FILTER (WHERE status = 'failed')::int           AS failed_calls,
      COALESCE(AVG(latency_ms), 0)::int                        AS avg_latency_ms
    FROM ${LOG_TABLE}
    WHERE created_at >= NOW() - ${intervalSql}
    GROUP BY 1
    ORDER BY calls DESC
    LIMIT 50
  `;
  const seriesRes = await db.query(seriesSql);

  // 时间桶（按小时）
  const bucketSql = `
    SELECT
      date_trunc('hour', created_at) AS ts,
      COUNT(*)::int                  AS calls,
      COUNT(*) FILTER (WHERE status = 'success')::int AS success_calls,
      COUNT(*) FILTER (WHERE status <> 'success')::int AS failed_calls
    FROM ${LOG_TABLE}
    WHERE created_at >= NOW() - ${intervalSql}
    GROUP BY 1
    ORDER BY 1
  `;
  const bucketRes = await db.query(bucketSql);

  return {
    window: win,
    groupBy: groupColMap[groupBy] ? groupBy : 'model',
    summary: {
      totalCalls: summary.total_calls || 0,
      successCalls: summary.success_calls || 0,
      failedCalls: summary.failed_calls || 0,
      timeoutCalls: summary.timeout_calls || 0,
      avgLatencyMs: summary.avg_latency_ms || 0,
      totalPromptTokens: Number(summary.total_prompt_tokens || 0),
      totalCompletionTokens: Number(summary.total_completion_tokens || 0),
      activeAccounts: summary.active_accounts || 0
    },
    series: seriesRes.rows,
    timeline: bucketRes.rows
  };
}

module.exports = {
  ALLOWED_TYPE,
  list,
  findById,
  create,
  update,
  monitor
};
