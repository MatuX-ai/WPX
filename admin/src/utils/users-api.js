/**
 * 用户管理 API
 *
 * 后端约定:
 *  - GET    /api/admin/users                -> 用户列表（支持搜索/筛选/分页）
 *  - GET    /api/admin/users/:id            -> 用户详情
 *  - PUT    /api/admin/users/:id/status     -> 禁用/启用用户
 *  - DELETE /api/admin/users/:id            -> 删除用户
 *  - GET    /api/admin/users/visitors       -> 访客统计
 */
import { httpApi } from './http'

/**
 * @param {{ search?: string, status?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number }} [params]
 */
export async function fetchUsers(params = {}) {
  try {
    return await httpApi.get('/api/admin/users', { params })
  } catch (_e) {
    return null
  }
}

/**
 * @param {string} id
 */
export async function fetchUserDetail(id) {
  try {
    return await httpApi.get(`/api/admin/users/${id}`)
  } catch (_e) {
    return null
  }
}

/**
 * @param {string} id
 * @param {'active' | 'disabled'} status
 */
export async function updateUserStatus(id, status) {
  try {
    return await httpApi.put(`/api/admin/users/${id}/status`, { status })
  } catch (_e) {
    return null
  }
}

/**
 * @param {string} id
 */
export async function deleteUser(id) {
  try {
    return await httpApi.delete(`/api/admin/users/${id}`)
  } catch (_e) {
    return null
  }
}

/**
 * 访客统计（设备 ID 维度）
 */
export async function fetchVisitorStats() {
  try {
    return await httpApi.get('/api/admin/users/visitors')
  } catch (_e) {
    return null
  }
}
