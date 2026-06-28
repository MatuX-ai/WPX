/**
 * Skills 使用统计模型
 *
 * 追踪：
 *   - 每个 skill 的总调用次数
 *   - 最近 30 天每日调用次数
 *   - 活跃用户数（30 天内至少调用 1 次的独立用户）
 *
 * 表结构（自动创建）：
 *   skill_usage_logs:
 *     - id SERIAL PRIMARY KEY
 *     - skill_id TEXT NOT NULL
 *     - user_id TEXT NOT NULL    (accountId 或 deviceId)
 *     - called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *     - context JSONB            (调用上下文: 文档类型、触发方式等)
 *     - duration_ms INTEGER      (执行耗时)
 *     - success BOOLEAN DEFAULT TRUE
 */

'use strict';

const db = require('./db');

const LOG_TABLE = 'skill_usage_logs';

/**
 * 确保统计表存在
 */
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${LOG_TABLE} (
      id SERIAL PRIMARY KEY,
      skill_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      context JSONB,
      duration_ms INTEGER,
      success BOOLEAN DEFAULT TRUE
    );
    CREATE INDEX IF NOT EXISTS idx_skill_logs_skill_id ON ${LOG_TABLE}(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_logs_user_id ON ${LOG_TABLE}(user_id);
    CREATE INDEX IF NOT EXISTS idx_skill_logs_called_at ON ${LOG_TABLE}(called_at);
  `);
}

// 懒初始化
let tableReady = false;
async function init() {
  if (!tableReady) {
    await ensureTable();
    tableReady = true;
  }
}

/**
 * 记录一次技能调用
 * @param {object} entry
 * @param {string} entry.skillId
 * @param {string} entry.userId
 * @param {object} [entry.context]
 * @param {number} [entry.durationMs]
 * @param {boolean} [entry.success=true]
 */
async function logUsage(entry) {
  await init();
  const { skillId, userId, context = null, durationMs = null, success = true } = entry || {};
  if (!skillId || !userId) return;

  await db.query(
    `INSERT INTO ${LOG_TABLE} (skill_id, user_id, context, duration_ms, success)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [skillId, userId, context ? JSON.stringify(context) : null, durationMs, !!success]
  );
}

/**
 * 获取单个 Skill 的统计数据
 * @param {string} skillId
 * @param {object} [options]
 * @param {number} [options.days=30] 统计天数
 * @returns {Promise<{callCount: number, activeUsers: number, trend: Array<{date: string, calls: number}>}>}
 */
async function getSkillStats(skillId, options = {}) {
  await init();
  const days = Math.max(1, Math.min(90, parseInt(options.days || '30', 10) || 30));

  const statsRes = await db.query(
    `SELECT
       COUNT(*)::int AS call_count,
       COUNT(DISTINCT user_id)::int AS active_users
     FROM ${LOG_TABLE}
     WHERE skill_id = $1
       AND called_at >= NOW() - INTERVAL '${days} days'`,
    [skillId]
  );

  const trendRes = await db.query(
    `SELECT
       TO_CHAR(called_at::date, 'YYYY-MM-DD') AS date,
       COUNT(*)::int AS calls
     FROM ${LOG_TABLE}
     WHERE skill_id = $1
       AND called_at >= NOW() - INTERVAL '${days} days'
     GROUP BY called_at::date
     ORDER BY called_at::date ASC`,
    [skillId]
  );

  return {
    callCount: statsRes.rows[0]?.call_count || 0,
    activeUsers: statsRes.rows[0]?.active_users || 0,
    trend: trendRes.rows
  };
}

/**
 * 获取所有 Skills 的汇总统计（用于仪表盘 Top 10）
 * @param {object} [options]
 * @param {number} [options.days=1] 统计天数（默认今日）
 * @param {number} [options.limit=10]
 * @returns {Promise<Array<{skillId: string, name: string, calls: number, activeUsers: number}>>}
 */
async function getTopSkills(options = {}) {
  await init();
  const days = Math.max(1, parseInt(options.days || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit || '10', 10) || 10));

  const res = await db.query(
    `SELECT
       sl.skill_id AS "skillId",
       COALESCE(s.name, sl.skill_id) AS name,
       COUNT(*)::int AS calls,
       COUNT(DISTINCT sl.user_id)::int AS "activeUsers"
     FROM ${LOG_TABLE} sl
     LEFT JOIN skills s ON s.id = sl.skill_id
     WHERE sl.called_at >= NOW() - INTERVAL '${days} days'
     GROUP BY sl.skill_id, s.name
     ORDER BY calls DESC
     LIMIT $1`,
    [limit]
  );

  return res.rows;
}

/**
 * 获取指定时间段内的 Skill 调用汇总（按日）
 * @param {number} days
 * @returns {Promise<Array<{date: string, totalCalls: number, uniqueSkills: number}>>}
 */
async function getDailySummary(days = 7) {
  await init();
  const res = await db.query(
    `SELECT
       TO_CHAR(called_at::date, 'YYYY-MM-DD') AS date,
       COUNT(*)::int AS "totalCalls",
       COUNT(DISTINCT skill_id)::int AS "uniqueSkills"
     FROM ${LOG_TABLE}
     WHERE called_at >= NOW() - INTERVAL '${days} days'
     GROUP BY called_at::date
     ORDER BY called_at::date ASC`,
    []
  );
  return res.rows;
}

/**
 * 清理过期日志（保留 180 天）
 */
async function purgeOldLogs() {
  await init();
  const res = await db.query(
    `DELETE FROM ${LOG_TABLE}
     WHERE called_at < NOW() - INTERVAL '180 days'`,
    []
  );
  return { deleted: res.rowCount };
}

module.exports = {
  logUsage,
  getSkillStats,
  getTopSkills,
  getDailySummary,
  purgeOldLogs
};
