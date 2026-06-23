const API_BASE = (import.meta.env.VITE_LIBRARY_API_URL || '').replace(/\/$/, '')

async function parseError(response) {
  const payload = await response.json().catch(() => ({}))
  const detail = payload.detail || payload.message
  const message = payload.error || `请求失败 (${response.status})`
  throw new Error(detail ? `${message}：${detail}` : message)
}

export async function analyzeDocument({ content, title = '', pathCorrections = [] }) {
  const response = await fetch(`${API_BASE}/api/library/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title, pathCorrections }),
  })

  if (!response.ok) await parseError(response)
  return response.json()
}

export async function saveDocument({
  title,
  content,
  path,
  tags = [],
  summary = '',
  suggestedPath = '',
}) {
  const response = await fetch(`${API_BASE}/api/library/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      path,
      tags,
      summary,
      suggestedPath,
    }),
  })

  if (!response.ok) await parseError(response)
  return response.json()
}

export function extractTitleFromMarkdown(markdown) {
  if (!markdown) return '未命名文档'

  for (const line of markdown.split('\n')) {
    const match = line.trim().match(/^#\s+(.+)$/)
    if (match) return match[1].trim()
  }

  return '未命名文档'
}

export async function fetchLibraryTree() {
  const response = await fetch(`${API_BASE}/api/library/tree`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function searchLibrary(query) {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`${API_BASE}/api/library/search?${params}`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function fetchLibraryDocument(relativePath) {
  const params = new URLSearchParams({ relativePath })
  const response = await fetch(`${API_BASE}/api/library/document?${params}`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function fetchLibraryHealth() {
  const response = await fetch(`${API_BASE}/api/library/health`)
  if (!response.ok) await parseError(response)
  return response.json()
}
