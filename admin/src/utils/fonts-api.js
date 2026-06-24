/**
 * 字体商店管理 API
 *
 * 后端约定：
 *  - GET    /api/admin/fonts?keyword=&type=&vendor=&status=
 *      -> List<Font> | { list: Font[] }
 *  - POST   /api/admin/fonts                       (multipart: fontFile + cover + meta)
 *      -> Font
 *  - PUT    /api/admin/fonts/:id                   (json: meta; 单独上传用 PATCH /file)
 *      -> Font
 *  - PATCH  /api/admin/fonts/:id/file              (multipart: fontFile)
 *      -> Font
 *  - PATCH  /api/admin/fonts/:id/cover             (multipart: cover)
 *      -> Font
 *  - PATCH  /api/admin/fonts/:id/status            { status: 'on' | 'off' }
 *      -> Font
 *  - DELETE /api/admin/fonts/:id
 *      -> { code: 0 }
 *  - GET    /api/admin/fonts/:id/stats?days=30
 *      -> {
 *           totalExports: number,
 *           totalTokens:  number,
 *           trend: [{ date, exports, tokens }],
 *           userTop10: [{ userId, name, exports, tokens }]
 *         }
 *
 * Font 字段：
 *   { id, name, vendor, type, tags[], pricePerChar, status: 'on' | 'off',
 *     description, coverUrl?, fileUrl?, fileSize?, fileName?, updatedAt }
 */
import { httpApi } from './http'

export async function fetchFonts(params = {}) {
  try {
    return await httpApi.get('/api/admin/fonts', { params })
  } catch (_e) {
    return null
  }
}

/**
 * 创建字体（含 .ttf/.otf 文件 + 预览图）
 * @param {{
 *   name: string, vendor: string, type: string, tags: string[],
 *   pricePerChar: number, description: string, status: 'on' | 'off',
 *   fontFile?: File, coverFile?: File
 * }} payload
 */
export async function createFont(payload) {
  const fd = buildFontFormData(payload)
  return await httpApi.post('/api/admin/fonts', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/**
 * 更新字体元数据
 */
export async function updateFont(id, payload) {
  return await httpApi.put(`/api/admin/fonts/${id}`, {
    name: payload.name,
    vendor: payload.vendor,
    type: payload.type,
    tags: payload.tags,
    pricePerChar: payload.pricePerChar,
    description: payload.description,
    status: payload.status
  })
}

/**
 * 替换字体文件
 */
export async function replaceFontFile(id, file) {
  const fd = new FormData()
  fd.append('fontFile', file, file.name)
  return await httpApi.patch(`/api/admin/fonts/${id}/file`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/**
 * 替换预览图
 */
export async function replaceFontCover(id, file) {
  const fd = new FormData()
  fd.append('cover', file, file.name)
  return await httpApi.patch(`/api/admin/fonts/${id}/cover`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/**
 * 上架 / 下架
 */
export async function toggleFontStatus(id, status) {
  return await httpApi.patch(`/api/admin/fonts/${id}/status`, { status })
}

/**
 * 删除字体
 */
export async function deleteFont(id) {
  return await httpApi.delete(`/api/admin/fonts/${id}`)
}

/**
 * 获取字体使用统计
 * @param {string} id
 * @param {number} days 7 | 30
 */
export async function fetchFontStats(id, days = 30) {
  try {
    return await httpApi.get(`/api/admin/fonts/${id}/stats`, {
      params: { days }
    })
  } catch (_e) {
    return null
  }
}

/**
 * 构建创建用的 multipart/form-data
 * @param {object} payload
 */
function buildFontFormData(payload) {
  const fd = new FormData()
  fd.append('name', payload.name || '')
  fd.append('vendor', payload.vendor || '')
  fd.append('type', payload.type || '')
  fd.append('pricePerChar', String(payload.pricePerChar ?? 0))
  fd.append('description', payload.description || '')
  fd.append('status', payload.status || 'off')
  fd.append('tags', (payload.tags || []).join(','))
  if (payload.fontFile) fd.append('fontFile', payload.fontFile, payload.fontFile.name)
  if (payload.coverFile) fd.append('cover', payload.coverFile, payload.coverFile.name)
  return fd
}