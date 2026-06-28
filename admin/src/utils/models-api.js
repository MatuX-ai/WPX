/**
 * 公共模型管理 & 调用监控 API
 *
 * 后端约定：
 *  - GET    /api/admin/models                  -> List<Model>
 *  - POST   /api/admin/models                  -> Model
 *  - PUT    /api/admin/models/:id              -> Model (含 enabled 字段)
 *  - DELETE /api/admin/models/:id              -> { code: 0 }
 *  - GET    /api/admin/models/monitor?window=24h&groupBy=model -> 调用监控
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
  return await httpApi.put(`/api/admin/models/${id}`, { enabled })
}

export async function deleteModel(id) {
  return await httpApi.delete(`/api/admin/models/${id}`)
}

export async function fetchMonitorOverview(window = '24h', groupBy = 'model') {
  try {
    return await httpApi.get('/api/admin/models/monitor', { params: { window, groupBy } })
  } catch (_e) {
    return null
  }
}

export async function fetchErrorLogs(limit = 100) {
  try {
    // 后端暂未提供独立错误日志接口，可通过 monitor 接口筛选
    return await httpApi.get('/api/admin/models/monitor', {
      params: { window: '24h', groupBy: 'status', limit }
    })
  } catch (_e) {
    return null
  }
}