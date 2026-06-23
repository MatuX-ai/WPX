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

export async function fetchKnowledgeUrlPreview(url) {
  const api = getKnowledgeApi()
  if (api?.fetchUrlPreview) {
    const result = await api.fetchUrlPreview(url)
    if (result?.success === false) {
      const err = new Error(result.message || 'URL 抓取失败')
      err.code = result.code
      throw err
    }
    return result?.preview ?? null
  }

  throw new Error('当前环境不支持网页预览抓取')
}

export async function uploadKnowledgeUrl(url, webImport = null) {
  const api = getKnowledgeApi()
  if (api?.upload) {
    const payload = webImport ? { url, webImport } : { url }
    return api.upload(payload)
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

export function shouldPromptWebUrlImport(preview) {
  if (!preview) return false
  const paragraphCount = preview.paragraphs?.length ?? 0
  const imageCount = preview.images?.length ?? 0
  return paragraphCount > 1 || imageCount > 0
}

export function buildWebImportPayload(preview, selection) {
  return {
    title: selection.title || preview.title,
    sourceUrl: selection.sourceUrl || preview.url,
    paragraphs: selection.paragraphs || [],
    images: selection.images || [],
  }
}

function normalizeImportText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function imageMarkdownLine(image, index) {
  const alt = normalizeImportText(image.alt || '') || `图片 ${index + 1}`
  return `![${alt}](${image.url})`
}

/** 将图片均匀插入段落之间，便于编辑区图文混排 */
function distributeImageSlots(paragraphCount, imageCount) {
  const slots = []
  for (let i = 0; i < imageCount; i += 1) {
    const slot = Math.min(
      Math.max(paragraphCount - 1, 0),
      Math.floor(((i + 1) * paragraphCount) / (imageCount + 1)) - 1,
    )
    slots.push(Math.max(slot, 0))
  }
  return slots
}

function appendInterleavedContent(parts, paragraphs, images) {
  const paragraphTexts = paragraphs
    .map((paragraph) => normalizeImportText(paragraph?.text || ''))
    .filter(Boolean)

  if (!images.length) {
    parts.push(...paragraphTexts)
    return
  }

  if (!paragraphTexts.length) {
    images.forEach((image, index) => {
      parts.push(imageMarkdownLine(image, index))
    })
    return
  }

  const slots = distributeImageSlots(paragraphTexts.length, images.length)
  let imageIndex = 0

  paragraphTexts.forEach((text, paragraphIndex) => {
    parts.push(text)
    while (imageIndex < images.length && slots[imageIndex] === paragraphIndex) {
      parts.push(imageMarkdownLine(images[imageIndex], imageIndex))
      imageIndex += 1
    }
  })

  while (imageIndex < images.length) {
    parts.push(imageMarkdownLine(images[imageIndex], imageIndex))
    imageIndex += 1
  }
}

/** 将网页抓取选择结果转为可插入编辑器的 Markdown 文本 */
export function buildWebImportEditorContent(preview, selection) {
  const payload = buildWebImportPayload(preview, selection)
  const parts = []

  if (payload.title) parts.push(`# ${normalizeImportText(payload.title)}`)
  if (payload.sourceUrl) parts.push(`来源: ${payload.sourceUrl}`)

  appendInterleavedContent(parts, payload.paragraphs, payload.images)

  const content = normalizeImportText(parts.join('\n\n'))
  if (!content) {
    throw new Error('请至少选择一段正文或一张图片')
  }

  return content
}

export function buildWebImportSelection(preview, selection) {
  const payload = buildWebImportPayload(preview, selection)
  if (!payload.paragraphs.length && !payload.images.length) {
    throw new Error('请至少选择一段正文或一张图片')
  }
  return payload
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
