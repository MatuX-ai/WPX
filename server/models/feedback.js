/**
 * 用户反馈模型
 *
 * 表：feedbacks
 * 功能：
 *   - 用户提交反馈（从 WPX 客户端内提交）
 *   - 管理员查看 / 筛选 / 标记已处理
 *   - 反馈统计
 */
'use strict';

const db = require('./db');

/**
 * 确保 feedbacks 表存在
 */
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id            BIGSERIAL PRIMARY KEY,
      user_id       VARCHAR(64) NOT NULL DEFAULT 'anonymous',
      category      VARCHAR(32) NOT NULL DEFAULT 'general',
      title         VARCHAR(255) NOT NULL DEFAULT '',
      content       TEXT NOT NULL DEFAULT '',
      contact       VARCHAR(255) DEFAULT '',
      app_version   VARCHAR(32) DEFAULT '',
      os            VARCHAR(32) DEFAULT '',
      status        VARCHAR(16) NOT NULL DEFAULT 'pending',
      admin_note    TEXT DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at   TIMESTAMPTZ
    )
  `);

  // 索引
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks (status)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks (created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks (category)
  `);
}

/**
 * 提交反馈
 * @param {object} params
 * @param {string} [params.userId] - 用户 ID（可选，匿名则为 'anonymous'）
 * @param {string} [params.category] - 分类：bug | feature | general | praise
 * @param {string} params.title - 标题
 * @param {string} params.content - 内容
 * @param {string} [params.contact] - 联系方式
 * @param {string} [params.appVersion] - 客户端版本
 * @param {string} [params.os] - 操作系统
 */
async function submit(params = {}) {
  await ensureTable();

  const { rows } = await db.query(
    `INSERT INTO feedbacks (user_id, category, title, content, contact, app_version, os, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [
      params.userId || 'anonymous',
      params.category || 'general',
      params.title || '',
      params.content || '',
      params.contact || '',
      params.appVersion || '',
      params.os || '',
    ]
  );

  return toPublic(rows[0]);
}

/**
 * 管理员：获取反馈列表（支持筛选）
 */
async function list({ status, category, page = 1, pageSize = 20 } = {}) {
  await ensureTable();

  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }
  if (category) {
    conditions.push(`category = $${idx++}`);
    values.push(category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM feedbacks ${where}`,
    values
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(pageSize));
  const limit = Math.min(100, Number(pageSize));

  const { rows } = await db.query(
    `SELECT * FROM feedbacks ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return {
    items: rows.map(toPublic),
    pagination: {
      page: Number(page),
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 管理员：获取单条反馈详情
 */
async function getById(id) {
  await ensureTable();
  const { rows } = await db.query('SELECT * FROM feedbacks WHERE id = $1', [id]);
  if (rows.length === 0) throw new Error('反馈不存在');
  return toPublic(rows[0]);
}

/**
 * 管理员：更新反馈状态
 */
async function updateStatus(id, { status, adminNote } = {}) {
  await ensureTable();
  const fields = [];
  const values = [];
  let idx = 1;

  if (status) {
    fields.push(`status = $${idx++}`);
    values.push(status);
    if (status === 'resolved') {
      fields.push(`resolved_at = NOW()`);
    }
  }
  if (adminNote !== undefined) {
    fields.push(`admin_note = $${idx++}`);
    values.push(adminNote);
  }
  fields.push(`updated_at = NOW()`);

  values.push(id);

  const { rows } = await db.query(
    `UPDATE feedbacks SET ${fields.join(', ')} WHERE id = $${idx++} RETURNING *`,
    values
  );

  if (rows.length === 0) throw new Error('反馈不存在');
  return toPublic(rows[0]);
}

/**
 * 管理员：获取反馈统计
 */
async function stats() {
  await ensureTable();
  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
      COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last7d,
      jsonb_object_agg(category, cat_count) AS by_category
    FROM (
      SELECT category, COUNT(*)::int AS cat_count
      FROM feedbacks
      GROUP BY category
    ) sub
  `);

  const row = rows[0] || {};
  return {
    total: row.total || 0,
    pending: row.pending || 0,
    resolved: row.resolved || 0,
    closed: row.closed || 0,
    last7d: row.last7d || 0,
    byCategory: row.by_category || {},
  };
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    content: row.content,
    contact: row.contact || '',
    appVersion: row.app_version || '',
    os: row.os || '',
    status: row.status,
    adminNote: row.admin_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null,
  };
}

module.exports = {
  ensureTable,
  submit,
  list,
  getById,
  updateStatus,
  stats,
};
