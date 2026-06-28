/**
 * 仪表盘数据 API
 *
 * 后端约定：
 *  - GET /api/admin/stats/dashboard       -> 统计卡片
 *      {
 *        dau: number,                     // 今日 DAU
 *        newUsers: number,                // 今日新增注册用户
 *        aiCalls: number,                 // 今日 AI 调用次数
 *        totalUsers: number,              // 累计注册用户
 *        fontExportTop5: [{ name, count }],
 *        activeSkillsTop10: [{ id, name, calls }]
 *      }
 *  - GET /api/admin/stats/trends?range=7d|30d -> 趋势数据
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
    return await httpApi.get('/api/admin/stats/dashboard')
  } catch (_e) {
    return null
  }
}

export async function fetchTrends(days = 7) {
  try {
    return await httpApi.get('/api/admin/stats/trends', { params: { range: `${days}d` } })
  } catch (_e) {
    return null
  }
}

/**
 * GET /api/admin/skills/top/usage?days=1&limit=10
 */
export async function fetchTopSkills(days = 1, limit = 10) {
  try {
    return await httpApi.get('/api/admin/skills/top/usage', { params: { days, limit } })
  } catch (_e) {
    return null
  }
}

/**
 * GET /api/admin/stats/anysearch — AnySearch 调用统计
 */
export async function fetchAnysearchStats() {
  try {
    return await httpApi.get('/api/admin/stats/anysearch')
  } catch (_e) {
    return null
  }
}