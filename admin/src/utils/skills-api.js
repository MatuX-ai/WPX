/**
 * Skills 管理 API
 *
 * 后端约定：
 *  - GET    /api/admin/skills?q=&category=&enabled=&page=&pageSize=
 *  - POST   /api/admin/skills        { id, name, code, category?, description?, systemPrompt?, enabled?, builtin?, tags?, config?, meta? }
 *  - PUT    /api/admin/skills/:id     (部分字段更新，含 enabled, status)
 *
 * Skill 通用字段：
 *   { id, name, code, category, description, systemPrompt, enabled, builtin,
 *     callCount?, activeUsers?, updatedAt?, tags?, config?, meta? }
 *
 * 分类：builtin / online / community — 通过 category 字段区分
 */
import { httpApi } from './http'

// ============ 内置 Skills ============
export async function fetchBuiltInSkills(params = {}) {
  try {
    return await httpApi.get('/api/admin/skills', { params: { ...params, category: 'builtin' } })
  } catch (_e) {
    return null
  }
}

export async function toggleBuiltInSkill(id, enabled) {
  return await httpApi.put(`/api/admin/skills/${id}`, { enabled })
}

// ============ 在线 Skills ============
export async function fetchOnlineSkills(params = {}) {
  try {
    return await httpApi.get('/api/admin/skills/online/list', { params })
  } catch (_e) {
    return null
  }
}

export async function fetchOnlineSkillDetail(id) {
  try {
    return await httpApi.get(`/api/admin/skills/online/${id}`)
  } catch (_e) {
    return null
  }
}

export async function installOnlineSkill(id) {
  return await httpApi.post(`/api/admin/skills/online/${id}/install`)
}

export async function createOnlineSkill(payload) {
  return await httpApi.post('/api/admin/skills', { ...payload, category: 'online' })
}

export async function updateOnlineSkill(id, payload) {
  return await httpApi.put(`/api/admin/skills/${id}`, payload)
}

export async function toggleOnlineSkill(id, status) {
  return await httpApi.put(`/api/admin/skills/${id}`, { enabled: status === 'on' })
}

export async function deleteOnlineSkill(id) {
  return await httpApi.delete(`/api/admin/skills/${id}`)
}

export async function fetchOnlineSkillStats(id) {
  try {
    return await httpApi.get(`/api/admin/skills/${id}/stats`)
  } catch (_e) {
    return null
  }
}

// ============ 社区 Skills ============
export async function fetchCommunitySkills(params = {}) {
  try {
    return await httpApi.get('/api/admin/skills', { params: { ...params, category: 'community' } })
  } catch (_e) {
    return null
  }
}

export async function approveCommunitySkill(id) {
  return await httpApi.put(`/api/admin/skills/${id}`, { enabled: true, category: 'community' })
}

export async function rejectCommunitySkill(id, reason = '') {
  return await httpApi.delete(`/api/admin/skills/${id}`)
}