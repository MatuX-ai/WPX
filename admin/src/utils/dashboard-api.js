/**
 * 仪表盘数据 API
 *
 * 后端约定：
 *  - GET /api/admin/dashboard/overview       -> 6 张统计卡片
 *      {
 *        dau: number,                     // 今日 DAU
 *        newUsers: number,                // 今日新增注册用户
 *        aiCalls: number,                 // 今日 AI 调用次数
 *        tokenRecharge: number,           // 今日 Token 充值总额
 *        fontExportTop5: [{ name, count }],
 *        activeSkillsTop10: [{ id, name, calls }]
 *      }
 *  - GET /api/admin/dashboard/trends?days=7 -> 趋势数据
 *      {
 *        userGrowth: [{ date, count }],              // 7 日用户增长
 *        aiCalls: [{ date, free, paid }]              // 7 日 AI 调用（免费/付费）
 *      }
 *
 * 失败容错：任一接口失败时返回 null，由页面层回退到 demo 数据。
 */
import { httpApi } from './http'

export async function fetchOverview() {
  try {
    return await httpApi.get('/api/admin/dashboard/overview')
  } catch (_e) {
    return null
  }
}

export async function fetchTrends(days = 7) {
  try {
    return await httpApi.get('/api/admin/dashboard/trends', { params: { days } })
  } catch (_e) {
    return null
  }
}