/**
 * 反馈管理 API
 *
 * GET    /api/admin/feedbacks         — 反馈列表
 * GET    /api/admin/feedbacks/stats   — 反馈统计
 * GET    /api/admin/feedbacks/:id     — 反馈详情
 * PUT    /api/admin/feedbacks/:id     — 更新状态
 */
import { httpApi } from './http'

export async function fetchFeedbacks(params = {}) {
  try {
    return await httpApi.get('/api/admin/feedbacks', { params })
  } catch (_e) {
    return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
  }
}

export async function fetchFeedbackStats() {
  try {
    return await httpApi.get('/api/admin/feedbacks/stats')
  } catch (_e) {
    return { total: 0, pending: 0, resolved: 0, closed: 0, last7d: 0, byCategory: {} }
  }
}

export async function fetchFeedback(id) {
  try {
    return await httpApi.get(`/api/admin/feedbacks/${id}`)
  } catch (_e) {
    return null
  }
}

export async function updateFeedbackStatus(id, payload) {
  try {
    return await httpApi.put(`/api/admin/feedbacks/${id}`, payload)
  } catch (_e) {
    return null
  }
}
