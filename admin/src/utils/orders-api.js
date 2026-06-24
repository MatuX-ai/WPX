/**
 * Token 与订单 API
 *
 * 后端约定：
 *
 * 充值订单：
 *  - GET  /api/admin/orders/recharge?keyword=&status=&payMethod=&startDate=&endDate=&page=&pageSize=
 *      -> { list: Order[], total: number }
 *  - POST /api/admin/orders/recharge/:id/refund   { amount?: number, reason?: string }
 *      -> Order
 *
 * Order 字段：
 *   { id, orderNo, userId, userEmail, userName, amount, currency, tokens,
 *     payMethod, status: 'pending' | 'paid' | 'refunded' | 'failed',
 *     createdAt, paidAt?, refundedAt?, packageName? }
 *
 * 消费记录：
 *  - GET  /api/admin/orders/consumption?keyword=&fontId=&startDate=&endDate=&page=&pageSize=
 *      -> { list: Consumption[], total: number }
 *
 * Consumption 字段：
 *   { id, userId, userEmail, userName, fontId, fontName, chars, tokens,
 *     docHash, createdAt }
 *
 * 收入统计：
 *  - GET  /api/admin/orders/revenue/overview
 *      -> {
 *           today: number, week: number, month: number, total: number,
 *           trend: [{ date, amount, orders }],
 *           byPackage: [{ packageName, count, amount }]
 *         }
 */
import { httpApi } from './http'

// ============ 充值订单 ============
export async function fetchRechargeOrders(params = {}) {
  try {
    return await httpApi.get('/api/admin/orders/recharge', { params })
  } catch (_e) {
    return null
  }
}

export async function refundOrder(id, payload = {}) {
  return await httpApi.post(`/api/admin/orders/recharge/${id}/refund`, payload)
}

// ============ 消费记录 ============
export async function fetchConsumption(params = {}) {
  try {
    return await httpApi.get('/api/admin/orders/consumption', { params })
  } catch (_e) {
    return null
  }
}

// ============ 收入统计 ============
export async function fetchRevenueOverview() {
  try {
    return await httpApi.get('/api/admin/orders/revenue/overview')
  } catch (_e) {
    return null
  }
}