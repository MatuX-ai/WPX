import { getElectronAPI, isElectron } from '@/utils/electron'

const API_BASE = (import.meta.env.VITE_KNOWLEDGE_API_URL || '').replace(/\/$/, '')

async function parseError(response) {
  const payload = await response.json().catch(() => ({}))
  const detail = payload.detail || payload.message
  const message = payload.error || `请求失败 (${response.status})`
  throw new Error(detail ? `${message}：${detail}` : message)
}

function getKnowledgeApi() {
  if (!isElectron()) return null
  return getElectronAPI()?.knowledge ?? null
}

export async function fetchKnowledgeList() {
  const api = getKnowledgeApi()
  if (api?.list) {
    const result = await api.list()
    return result?.items ?? []
  }

  const response = await fetch(`${API_BASE}/api/knowledge/list`)
  if (!response.ok) await parseError(response)
  const data = await response.json()
  return data.items || []
}

export async function uploadKnowledgeFile(file) {
  const api = getKnowledgeApi()
  if (api?.upload) {
    const data = await file.arrayBuffer()
    const result = await api.upload({
      filename: file.name,
      mimeType: file.type,
      data,
    })
    return result
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/knowledge/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function uploadKnowledgeUrl(url) {
  const api = getKnowledgeApi()
  if (api?.upload) {
    return api.upload({ url })
  }

  const formData = new FormData()
  formData.append('url', url)

  const response = await fetch(`${API_BASE}/api/knowledge/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function fetchKnowledgePreview(id) {
  const api = getKnowledgeApi()
  if (api?.preview) {
    return api.preview(id)
  }

  const response = await fetch(`${API_BASE}/api/knowledge/${encodeURIComponent(id)}/preview`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function deleteKnowledgeItem(id) {
  const api = getKnowledgeApi()
  if (api?.delete) {
    return api.delete(id)
  }

  throw new Error('当前环境不支持删除资料')
}

export async function clearKnowledgeIndex() {
  const api = getKnowledgeApi()
  if (api?.clearIndex) {
    return api.clearIndex()
  }

  const response = await fetch(`${API_BASE}/api/knowledge/clear`, {
    method: 'POST',
  })
  if (!response.ok) await parseError(response)
  return response.json()
}

export function onKnowledgeUpdated(callback) {
  const api = getKnowledgeApi()
  if (typeof api?.onUpdated === 'function') {
    return api.onUpdated(callback)
  }
  return () => {}
}

export const ACCEPTED_FILE_TYPES = '.pdf,.docx,.md,.markdown,.txt'
export const ACCEPTED_MIME_HINT = 'PDF、Word、Markdown、TXT'
