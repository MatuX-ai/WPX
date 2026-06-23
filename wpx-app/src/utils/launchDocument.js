import { getElectronAPI, isElectron } from '@/utils/electron'
import { getDocPathFromUrl } from '@/utils/windowContext'

function pathBasename(filePath) {
  const parts = String(filePath).replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || ''
}

function toFileUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`
  }
  return `file:///${normalized}`
}

/**
 * @param {string} docPath
 * @param {string} raw
 * @returns {{ path: string, content: string, title: string, format?: object | null }}
 */
export function parseDocumentPayload(docPath, raw) {
  const fileName = pathBasename(docPath)
  const ext = fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase() || ''
  const baseTitle = fileName.replace(/\.[^.]+$/i, '') || '未命名文档'

  if (ext === '.wpx') {
    try {
      const doc = JSON.parse(raw)
      return {
        path: docPath,
        content: String(doc.markdown ?? doc.content ?? ''),
        title: String(doc.title || baseTitle),
        format: doc.format ?? null,
      }
    } catch {
      return {
        path: docPath,
        content: raw,
        title: baseTitle,
        format: null,
      }
    }
  }

  return {
    path: docPath,
    content: raw,
    title: baseTitle,
    format: null,
  }
}

/**
 * @param {string} docPath
 * @returns {Promise<{ path: string, content: string, title: string, format?: object | null } | null>}
 */
export async function loadDocumentFromPath(docPath) {
  if (!docPath) return null

  const api = getElectronAPI()
  if (isElectron() && typeof api?.files?.readDocument === 'function') {
    try {
      return await api.files.readDocument(docPath)
    } catch (error) {
      console.warn('[launchDocument] Failed to read document via IPC:', error)
      return null
    }
  }

  try {
    const target = /^https?:\/\//i.test(docPath) ? docPath : toFileUrl(docPath)
    const response = await fetch(target)
    if (!response.ok) return null
    const raw = await response.text()
    return parseDocumentPayload(docPath, raw)
  } catch (error) {
    console.warn('[launchDocument] Failed to load document:', error)
    return null
  }
}

export { getDocPathFromUrl }
