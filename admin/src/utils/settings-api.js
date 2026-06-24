/**
 * 系统设置 / CDN / 管理员 / 操作日志 API
 *
 * 系统配置：
 *  - GET /api/admin/settings/system        -> SystemConfig
 *  - PUT /api/admin/settings/system        -> SystemConfig
 *
 * SystemConfig 字段：
 *   { appName, freeAiLimit, maxWindows, registrationOpen }
 *
 * CDN 配置：
 *  - GET /api/admin/settings/cdn           -> CdnConfig
 *  - PUT /api/admin/settings/cdn           -> CdnConfig
 *
 * CdnConfig 字段：
 *   { fonts: string, skills: string, install: string }
 *
 * 管理员账号：
 *  - GET    /api/admin/admins?keyword=&role=
 *  - POST   /api/admin/admins
 *  - PUT    /api/admin/admins/:id
 *  - PATCH  /api/admin/admins/:id/role   { role }
 *  - PATCH  /api/admin/admins/:id/status { status: 'active' | 'disabled' }
 *  - DELETE /api/admin/admins/:id
 *
 * Admin 字段：
 *   { id, email, name, role: 'super_admin'|'operation_admin'|'content_editor',
 *     status: 'active' | 'disabled', lastLoginAt?, createdAt }
 *
 * 操作日志：
 *  - GET /api/admin/operation-logs?keyword=&type=&actor=&startDate=&endDate=&page=&pageSize=
 *      -> { list: Log[], total: number, page, pageSize }
 *
 * Log 字段：
 *   { id, createdAt, actorId, actorName, actorEmail?, type, ip?, detail: object|string }
 */
import { httpApi } from './http'

// ============ 系统配置 ============
export async function fetchSystemConfig() {
  try {
    return await httpApi.get('/api/admin/settings/system')
  } catch (_e) {
    return null
  }
}

export async function updateSystemConfig(payload) {
  return await httpApi.put('/api/admin/settings/system', payload)
}

// ============ CDN 配置 ============
export async function fetchCdnConfig() {
  try {
    return await httpApi.get('/api/admin/settings/cdn')
  } catch (_e) {
    return null
  }
}

export async function updateCdnConfig(payload) {
  return await httpApi.put('/api/admin/settings/cdn', payload)
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
  return await httpApi.patch(`/api/admin/admins/${id}/role`, { role })
}

export async function setAdminStatus(id, status) {
  return await httpApi.patch(`/api/admin/admins/${id}/status`, { status })
}

export async function deleteAdmin(id) {
  return await httpApi.delete(`/api/admin/admins/${id}`)
}

// ============ 操作日志 ============
export async function fetchOperationLogs(params = {}) {
  try {
    return await httpApi.get('/api/admin/operation-logs', { params })
  } catch (_e) {
    return null
  }
}
