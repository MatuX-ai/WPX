/**
 * 系统设置 / CDN / 管理员 / 操作日志 API
 *
 * 系统配置：
 *  - GET /api/admin/settings?category=system        -> SystemConfig
 *  - PUT /api/admin/settings                        -> { items: [{ key, value, ...}] }
 *
 * SystemConfig 字段：
 *   { appName, freeAiLimit, maxWindows, registrationOpen }
 *
 * CDN 配置：
 *  - GET /api/admin/settings?category=cdn           -> CdnConfig
 *  - PUT /api/admin/settings                        -> { items: [{ key, value, ...}] }
 *
 * CdnConfig 字段：
 *   { fonts: string, skills: string, install: string }
 *
 * 管理员账号：
 *  - GET    /api/admin/admins?q=&role=&status=
 *  - POST   /api/admin/admins
 *  - PUT    /api/admin/admins/:id
 *  - DELETE /api/admin/admins/:id
 *
 * Admin 字段：
 *   { id, email, name, role: 'super_admin'|'operation_admin'|'content_editor',
 *     status: 'active' | 'disabled', lastLoginAt?, createdAt }
 *
 * 操作日志：
 *  - GET /api/admin/logs?q=&action=&accountId=&resourceType=&resourceId=&status=&start=&end=&page=&pageSize=
 *  - GET /api/admin/logs/export (下载 CSV)
 *
 * Log 字段：
 *   { id, createdAt, accountId, email, role, action, resourceType, resourceId,
 *     method, path, statusCode, ip, durationMs }
 */
import { httpApi } from './http'

// ============ 系统配置 ============
export async function fetchSystemConfig() {
  try {
    return await httpApi.get('/api/admin/settings', { params: { category: 'system' } })
  } catch (_e) {
    return null
  }
}

export async function updateSystemConfig(payload) {
  return await httpApi.put('/api/admin/settings', { items: toSettingItems(payload) })
}

// ============ CDN 配置 ============
export async function fetchCdnConfig() {
  try {
    return await httpApi.get('/api/admin/settings', { params: { category: 'cdn' } })
  } catch (_e) {
    return null
  }
}

export async function updateCdnConfig(payload) {
  return await httpApi.put('/api/admin/settings', { items: toSettingItems(payload, 'cdn') })
}

// ============ 管理员账号 ============
export async function fetchAdmins(params = {}) {
  try {
    return await httpApi.get('/api/admin/admins', { params })
  } catch (_e) {
    return null
  }
}

export async function createAdmin(payload) {
  return await httpApi.post('/api/admin/admins', payload)
}

export async function updateAdmin(id, payload) {
  return await httpApi.put(`/api/admin/admins/${id}`, payload)
}

export async function setAdminRole(id, role) {
  return await httpApi.put(`/api/admin/admins/${id}`, { role })
}

export async function setAdminStatus(id, status) {
  return await httpApi.put(`/api/admin/admins/${id}`, { status })
}

export async function deleteAdmin(id) {
  return await httpApi.delete(`/api/admin/admins/${id}`)
}

// ============ 操作日志 ============
export async function fetchOperationLogs(params = {}) {
  try {
    return await httpApi.get('/api/admin/logs', { params })
  } catch (_e) {
    return null
  }
}

/**
 * 将 payload 对象转为 setting items 数组
 * @param {object} payload
 * @param {string} [category]
 */
function toSettingItems(payload, category) {
  return Object.entries(payload || {}).map(([key, value]) => ({
    key,
    value: String(value),
    category: category || undefined
  }))
}
