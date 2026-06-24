/**
 * Token（充值订单 / 消费记录 / 收入统计）
 *   - orders        充值订单列表
 *   - refund        手动退款
 *   - consumptions  消费记录列表
 *   - revenue       收入统计（今日 / 本周 / 本月 / 累计）
 */
'use strict';

const db = require('./db');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const ORDER_TABLE = 'token_orders';
const CONSUMP_TABLE = 'token_consumptions';

const ALLOWED_ORDER_STATUS = ['pending', 'paid', 'refunded', 'failed', 'cancelled'];
const ALLOWED_PAY_METHOD = ['alipay', 'wechat', 'stripe', 'paypal', 'manual'];

// =========================
// 充值订单
// =========================

/**
 * 列表 + 筛选
 *   - q           订单号 / 邮箱 模糊匹配
 *   - status
 *   - payMethod
 *   - start / end ISO 日期
 */
async function listOrders({
  q, status, payMethod, start, end,
  page = 1, pageSize = 20, sort = 'created_at', order = 'desc'
} = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(order_no ILIKE $${i} OR email ILIKE $${i} OR account_id ILIKE $${i})`);
  }
  if (status) {
    if (!ALLOWED_ORDER_STATUS.includes(status)) throw new BadRequestError('status 取值非法');
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (payMethod) {
    if (!ALLOWED_PAY_METHOD.includes(payMethod)) throw new BadRequestError('payMethod 取值非法');
    params.push(payMethod);
    where.push(`pay_method = $${params.length}`);
  }
  if (start) {
    params.push(start);
    where.push(`created_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    where.push(`created_at <= $${params.length}`);
  }

  const ALLOWED_SORT = new Set(['created_at', 'paid_at', 'amount_cents', 'order_no']);
  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, order_no, account_id, email, package, amount_cents, currency,
           pay_method, status, paid_at, refunded_at, refund_amount_cents, refund_reason,
           meta, created_at, updated_at
    FROM ${ORDER_TABLE}
    ${whereSql}
    ORDER BY ${safeSort} ${safeOrder}
    LIMIT ${safeSize} OFFSET ${offset}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM ${ORDER_TABLE} ${whereSql}`;
  const [dataRes, countRes] = await Promise.all([
    db.query(dataSql, params),
    db.query(countSql, params)
  ]);
  const total = countRes.rows[0].total;
  // 总额（受筛选条件影响）
  const sumSql = `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total_amount FROM ${ORDER_TABLE} ${whereSql}`;
  const sumRes = await db.query(sumSql, params);

  return {
    items: dataRes.rows,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize))
    },
    summary: {
      totalAmountCents: Number(sumRes.rows[0]?.total_amount || 0)
    }
  };
}

/**
 * 退款：仅 paid 订单可退；记录退款金额与原因
 *   payload: { orderNo, amountCents?, reason }
 */
async function refund(payload) {
  const { orderNo, amountCents, reason = null } = payload || {};
  if (!orderNo) throw new BadRequestError('缺少 orderNo');
  const found = await db.query(
    `SELECT * FROM ${ORDER_TABLE} WHERE order_no = $1 LIMIT 1`,
    [orderNo]
  );
  const order = found.rows[0];
  if (!order) throw new NotFoundError('订单不存在');
  if (order.status !== 'paid') {
    throw new BadRequestError(`当前状态 ${order.status} 不可退款`);
  }
  const refundAmount = amountCents === undefined || amountCents === null
    ? order.amount_cents
    : Math.min(Number(amountCents), order.amount_cents);
  if (refundAmount <= 0) throw new BadRequestError('退款金额必须 > 0');

  const sql = `
    UPDATE ${ORDER_TABLE}
    SET status = 'refunded',
        refunded_at = NOW(),
        refund_amount_cents = $2,
        refund_reason = $3,
        updated_at = NOW()
    WHERE order_no = $1
    RETURNING *
  `;
  const res = await db.query(sql, [orderNo, refundAmount, reason]);
  return res.rows[0];
}

// =========================
// 消费记录
// =========================

async function listConsumptions({
  q, kind, start, end,
  page = 1, pageSize = 20, sort = 'created_at', order = 'desc'
} = {}) {
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(account_id ILIKE $${i} OR email ILIKE $${i} OR target_name ILIKE $${i} OR target_id ILIKE $${i})`);
  }
  if (kind) {
    params.push(kind);
    where.push(`kind = $${params.length}`);
  }
  if (start) {
    params.push(start);
    where.push(`created_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    where.push(`created_at <= $${params.length}`);
  }

  const ALLOWED_SORT = new Set(['created_at', 'tokens', 'quantity', 'amount_cents']);
  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataSql = `
    SELECT id, account_id, email, kind, target_id, target_name,
           quantity, tokens, amount_cents, meta, created_at
    FROM ${CONSUMP_TABLE}
    ${whereSql}
    ORDER BY ${safeSort} ${safeOrder}
    LIMIT ${safeSize} OFFSET ${offset}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM ${CONSUMP_TABLE} ${whereSql}`;
  const sumSql = `
    SELECT
      COALESCE(SUM(quantity), 0)::bigint      AS total_quantity,
      COALESCE(SUM(tokens), 0)::bigint        AS total_tokens,
      COALESCE(SUM(amount_cents), 0)::bigint  AS total_amount_cents
    FROM ${CONSUMP_TABLE} ${whereSql}
  `;
  const [dataRes, countRes, sumRes] = await Promise.all([
    db.query(dataSql, params),
    db.query(countSql, params),
    db.query(sumSql, params)
  ]);
  const total = countRes.rows[0].total;
  const sum = sumRes.rows[0] || {};
  return {
    items: dataRes.rows,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize))
    },
    summary: {
      totalQuantity: Number(sum.total_quantity || 0),
      totalTokens: Number(sum.total_tokens || 0),
      totalAmountCents: Number(sum.total_amount_cents || 0)
    }
  };
}

// =========================
// 收入统计
// =========================

/**
 * 收入统计 - 4 维度：today / week / month / all
 *   - 仅统计 paid 状态订单的收入，refunded 从累计中扣除
 */
async function revenue() {
  const sql = `
    SELECT
      COALESCE(SUM(amount_cents) FILTER (
        WHERE status = 'paid' AND paid_at::date = CURRENT_DATE
      ), 0)::bigint                                                            AS today,

      COALESCE(SUM(amount_cents) FILTER (
        WHERE status = 'paid' AND paid_at >= date_trunc('week', NOW())
      ), 0)::bigint                                                            AS week,

      COALESCE(SUM(amount_cents) FILTER (
        WHERE status = 'paid' AND paid_at >= date_trunc('month', NOW())
      ), 0)::bigint                                                            AS month,

      COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::bigint
        - COALESCE(SUM(refund_amount_cents), 0)::bigint                        AS all_time,

      COUNT(*) FILTER (WHERE status = 'paid')::int                              AS paid_orders,
      COUNT(*) FILTER (WHERE status = 'refunded')::int                          AS refunded_orders,
      COUNT(*) FILTER (WHERE status = 'pending')::int                          AS pending_orders,

      COUNT(DISTINCT account_id) FILTER (WHERE status = 'paid')::int           AS paying_users
    FROM ${ORDER_TABLE}
  `;
  const res = await db.query(sql);
  const row = res.rows[0] || {};

  // 按充值包分布
  const pkgSql = `
    SELECT
      COALESCE(package, 'unknown')  AS package,
      COUNT(*)::int                 AS orders,
      COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
    FROM ${ORDER_TABLE}
    WHERE status = 'paid'
    GROUP BY 1
    ORDER BY amount_cents DESC
    LIMIT 20
  `;
  const pkgRes = await db.query(pkgSql);

  // 30 天趋势（按天）
  const trendSql = `
    SELECT
      paid_at::date            AS date,
      COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents,
      COUNT(*)::int            AS orders
    FROM ${ORDER_TABLE}
    WHERE status = 'paid'
      AND paid_at >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY 1
    ORDER BY 1
  `;
  const trendRes = await db.query(trendSql);

  return {
    summary: {
      todayCents: Number(row.today || 0),
      weekCents: Number(row.week || 0),
      monthCents: Number(row.month || 0),
      allTimeCents: Number(row.all_time || 0),
      paidOrders: row.paid_orders || 0,
      refundedOrders: row.refunded_orders || 0,
      pendingOrders: row.pending_orders || 0,
      payingUsers: row.paying_users || 0
    },
    byPackage: pkgRes.rows,
    dailyTrend: trendRes.rows
  };
}

module.exports = {
  ALLOWED_ORDER_STATUS,
  ALLOWED_PAY_METHOD,
  listOrders,
  refund,
  listConsumptions,
  revenue
};