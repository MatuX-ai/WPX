/**
 * Skills 管理 API
 *
 * 后端约定：
 *
 * 内置 Skills：
 *  - GET    /api/admin/skills/builtin?category=
 *      -> List<BuiltInSkill>
 *  - PATCH  /api/admin/skills/builtin/:id/status  { enabled }
 *      -> BuiltInSkill
 *
 * 在线 Skills（CRUD + 上下架 + 统计）：
 *  - GET    /api/admin/skills/online?category=&keyword=&status=
 *      -> List<OnlineSkill>
 *  - POST   /api/admin/skills/online
 *      -> OnlineSkill
 *  - PUT    /api/admin/skills/online/:id
 *      -> OnlineSkill
 *  - PATCH  /api/admin/skills/online/:id/status  { status: 'on' | 'off' }
 *      -> OnlineSkill
 *  - DELETE /api/admin/skills/online/:id
 *      -> { code: 0 }
 *  - GET    /api/admin/skills/online/:id/stats
 *      -> { callCount, activeUsers, trend?: [{ date, calls }] }
 *
 * 社区 Skills（预留审核）：
 *  - GET    /api/admin/skills/community?status=pending|approved|rejected
 *      -> List<CommunitySkill>
 *  - POST   /api/admin/skills/community/:id/approve
 *  - POST   /api/admin/skills/community/:id/reject    { reason }
 *
 * Skill 通用字段：
 *   {
 *     id, name, category, description, icon, status: 'on' | 'off',
 *     callCount?, activeUsers?, updatedAt?
 *   }
 * OnlineSkill 扩展字段：
 *   {
 *     ...通用,
 *     promptTemplate: string,
 *     inputFields: [{ name, label, type, options?, required?, placeholder? }]
 *   }
 * type ∈ 'text' | 'textarea' | 'number' | 'select'
 */
import { httpApi } from './http'

// ============ 内置 Skills ============
export async function fetchBuiltInSkills(params = {}) {
  try {
    return await httpApi.get('/api/admin/skills/builtin', { params })
  } catch (_e) {
    return null
  }
}

export async function toggleBuiltInSkill(id, enabled) {
  return await httpApi.patch(`/api/admin/skills/builtin/${id}/status`, {
    enabled
  })
}

// ============ 在线 Skills ============
export async function fetchOnlineSkills(params = {}) {
  try {
    return await httpApi.get('/api/admin/skills/online', { params })
  } catch (_e) {
    return null
  }
}

export async function createOnlineSkill(payload) {
  return await httpApi.post('/api/admin/skills/online', payload)
}

export async function updateOnlineSkill(id, payload) {
  return await httpApi.put(`/api/admin/skills/online/${id}`, payload)
}

export async function toggleOnlineSkill(id, status) {
  return await httpApi.patch(`/api/admin/skills/online/${id}/status`, {
    status
  })
}

export async function deleteOnlineSkill(id) {
  return await httpApi.delete(`/api/admin/skills/online/${id}`)
}

export async function fetchOnlineSkillStats(id) {
  try {
    return await httpApi.get(`/api/admin/skills/online/${id}/stats`)
  } catch (_e) {
    return null
  }
}

// ============ 社区 Skills ============
export async function fetchCommunitySkills(params = {}) {
  try {
    return await httpApi.get('/api/admin/skills/community', { params })
  } catch (_e) {
    return null
  }
}

export async function approveCommunitySkill(id) {
  return await httpApi.post(`/api/admin/skills/community/${id}/approve`)
}

export async function rejectCommunitySkill(id, reason = '') {
  return await httpApi.post(`/api/admin/skills/community/${id}/reject`, {
    reason
  })
}