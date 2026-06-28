/**
 * 公告与版本 API
 *
 * 公告：
 *  - GET    /api/admin/announcements?status=&keyword=
 *      -> List<Announcement> | { list }
 *  - POST   /api/admin/announcements
 *      -> Announcement
 *  - PUT    /api/admin/announcements/:id     (含 status 字段)
 *      -> Announcement
 *  - DELETE /api/admin/announcements/:id
 *      -> { code: 0 }
 *
 * Announcement 字段：
 *   { id, title, content, summary?, effectiveAt?, expireAt?, status,
 *     createdAt, updatedAt? }
 * status: 'draft' | 'pending' | 'published' | 'offline'
 * （后端根据 effectiveAt/expireAt 自动计算 published 或 pending 状态时，UI 自行判定）
 *
 * 版本：
 *  - GET    /api/admin/versions?keyword=
 *      -> List<Version> | { list }
 *  - POST   /api/admin/versions
 *      -> Version
 *  - PUT    /api/admin/versions/:id
 *      -> Version
 *  - PATCH  /api/admin/versions/:id/force  { forced: boolean }
 *      -> Version
 *  - DELETE /api/admin/versions/:id
 *      -> { code: 0 }
 *
 * Version 字段：
 *   { id, version, channel?: 'stable' | 'beta', changelog,
 *     downloads: { windows?, macos?, linux? },
 *     forced, releasedAt, createdAt }
 */
import { httpApi } from './http'

// ============ 公告 ============
export async function fetchAnnouncements(params = {}) {
  try {
    return await httpApi.get('/api/admin/announcements', { params })
  } catch (_e) {
    return null
  }
}

export async function createAnnouncement(payload) {
  return await httpApi.post('/api/admin/announcements', payload)
}

export async function updateAnnouncement(id, payload) {
  return await httpApi.put(`/api/admin/announcements/${id}`, payload)
}

export async function toggleAnnouncementStatus(id, status) {
  return await httpApi.put(`/api/admin/announcements/${id}`, { status })
}

export async function deleteAnnouncement(id) {
  return await httpApi.delete(`/api/admin/announcements/${id}`)
}

// ============ 版本 ============
export async function fetchVersions(params = {}) {
  try {
    return await httpApi.get('/api/admin/versions', { params })
  } catch (_e) {
    return null
  }
}

export async function createVersion(payload) {
  return await httpApi.post('/api/admin/versions', payload)
}

export async function updateVersion(id, payload) {
  return await httpApi.put(`/api/admin/versions/${id}`, payload)
}

export async function toggleVersionForce(id, forced) {
  return await httpApi.put(`/api/admin/versions/${id}`, { forceUpdate: forced })
}

export async function deleteVersion(id) {
  return await httpApi.delete(`/api/admin/versions/${id}`)
}