/**
 * 仪表盘统计模型
 */
'use strict';

const db = require('./db');

/**
 * 顶部卡片数据
 *   - dau:           24h 内活跃用户数（按 usage_events 去重）
 *   - newUsers24h:   24h 内新增用户数
 *   - calls24h:      24h 内调用总量
 *   - revenue24h:    24h 内已支付金额（分）
 *   - totals:        累计用户 / 活跃 / 禁用
 */
async function dashboard() {
  const sql = `
    WITH last24 AS (
      SELECT account_id, kind, quantity
      FROM usage_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    ),
    pay24 AS (
      SELECT COALESCE(SUM(amount_cents), 0)::bigint AS revenue
      FROM payments
      WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '24 hours'
    )
    SELECT
      (SELECT COUNT(DISTINCT account_id)::int FROM last24)               AS dau,
      (SELECT COALESCE(SUM(quantity), 0)::bigint FROM last24)            AS calls24h,
      (SELECT COUNT(*)::int FROM user_profiles
        WHERE created_at >= NOW() - INTERVAL '24 hours')                 AS new_users_24h,
      (SELECT revenue FROM pay24)                                        AS revenue_24h,
      (SELECT COUNT(*)::int FROM user_profiles)                          AS total_users,
      (SELECT COUNT(*)::int FROM user_profiles WHERE status = 'active')   AS active_users,
      (SELECT COUNT(*)::int FROM user_profiles
        WHERE status IN ('disabled', 'banned'))                          AS disabled_users
  `;
  const res = await db.query(sql);
  const row = res.rows[0] || {};
  return {
    dau: row.dau || 0,
    newUsers24h: row.new_users_24h || 0,
    calls24h: Number(row.calls24h || 0),
    revenue24h: Number(row.revenue_24h || 0),
    totals: {
      users: row.total_users || 0,
      activeUsers: row.active_users || 0,
      disabledUsers: row.disabled_users || 0
    }
  };
}

/**
 * 趋势数据：按天聚合 DAU / 新增 / 调用量 / 收入
 * @param {number} days  7 或 30
 */
async function trends(days = 7) {
  const safeDays = [7, 30].includes(Number(days)) ? Number(days) : 7;

  // 1) 拿到日期序列（用 generate_series）
  const datesRes = await db.query(
    `SELECT d::date AS date
     FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d`,
    [safeDays]
  );
  const dates = datesRes.rows.map((r) => r.date);

  // 2) 每日调用量 / DAU
  const usageRes = await db.query(
    `SELECT
       created_at::date AS date,
       COUNT(DISTINCT account_id)::int        AS dau,
       COALESCE(SUM(quantity), 0)::bigint     AS calls
     FROM usage_events
     WHERE created_at::date >= CURRENT_DATE - ($1::int - 1)
     GROUP BY 1`,
    [safeDays]
  );
  const usageMap = new Map(usageRes.rows.map((r) => [String(r.date), r]));

  // 3) 每日新增用户
  const newUsersRes = await db.query(
    `SELECT created_at::date AS date, COUNT(*)::int AS new_users
     FROM user_profiles
     WHERE created_at::date >= CURRENT_DATE - ($1::int - 1)
     GROUP BY 1`,
    [safeDays]
  );
  const newUserMap = new Map(newUsersRes.rows.map((r) => [String(r.date), r]));

  // 4) 每日收入
  const payRes = await db.query(
    `SELECT created_at::date AS date,
            COALESCE(SUM(amount_cents), 0)::bigint AS revenue
     FROM payments
     WHERE status = 'paid'
       AND created_at::date >= CURRENT_DATE - ($1::int - 1)
     GROUP BY 1`,
    [safeDays]
  );
  const payMap = new Map(payRes.rows.map((r) => [String(r.date), r]));

  // 5) 拼装完整序列
  const series = dates.map((d) => {
    const key = String(d);
    const u = usageMap.get(key) || {};
    const n = newUserMap.get(key) || {};
    const p = payMap.get(key) || {};
    return {
      date: key,
      dau: u.dau || 0,
      calls: Number(u.calls || 0),
      newUsers: n.new_users || 0,
      revenue: Number(p.revenue || 0)
    };
  });

  return {
    range: `${safeDays}d`,
    series
  };
}

module.exports = { dashboard, trends };
