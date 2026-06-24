/**
 * 公共模型管理 & 调用监控 API
 *
 * 后端约定：
 *  - GET    /api/admin/models                  -> List<Model>
 *  - POST   /api/admin/models                  -> Model
 *  - PUT    /api/admin/models/:id              -> Model
 *  - PATCH  /api/admin/models/:id/status       -> Model    { enabled }
 *  - DELETE /api/admin/models/:id              -> { code: 0 }
 *  - GET    /api/admin/models/monitor/overview -> { qps, todayTotal, successRate, perModel: [{ id, name, count }] }
 *  - GET    /api/admin/models/monitor/errors?limit=100 -> List<ErrorLog>
 *
 * Model 字段：
 *   { id, name, endpoint, apiKey?, dailyFreeLimit, enabled, remark?, updatedAt }
 *
 * 失败容错：任何接口失败均返回 null 或抛错，由 UI 决定是否回退到 demo 数据。
 */
import { httpApi } from './http'

export async function fetchModels() {
  try {
    return await httpApi.get('/api/admin/models')
  } catch (_e) {
    return null
  }
}

export async function createModel(payload) {
  return await httpApi.post('/api/admin/models', payload)
}

export async function updateModel(id, payload) {
  return await httpApi.put(`/api/admin/models/${id}`, payload)
}

export async function toggleModelStatus(id, enabled) {
  return await httpApi.patch(`/api/admin/models/${id}/status`, { enabled })
}

export async function deleteModel(id) {
  return await httpApi.delete(`/api/admin/models/${id}`)
}

export async function fetchMonitorOverview() {
  try {
    return await httpApi.get('/api/admin/models/monitor/overview')
  } catch (_e) {
    return null
  }
}

export async function fetchErrorLogs(limit = 100) {
  try {
    return await httpApi.get('/api/admin/models/monitor/errors', {
      params: { limit }
    })
  } catch (_e) {
    return null
  }
}