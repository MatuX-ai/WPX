import { getLocalApiBase } from '@/utils/localApi'

function getUserId() {
  if (typeof window === 'undefined') return 'local-user'
  return window.localStorage.getItem('wpx-user-id') || 'local-user'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * @param {string} content
 * @param {'docx' | 'pdf' | 'html'} format
 * @param {string} [filename]
 * @param {{ embedFonts?: Array<{ fontId?: string, path?: string, text: string }>, contentFormat?: 'markdown' | 'html' }} [options]
 */
export async function exportViaApi(content, format, filename = 'document', options = {}) {
  const apiBase = await getLocalApiBase()
  const { embedFonts, contentFormat = 'markdown' } = options

  /** @type {Record<string, unknown>} */
  const body = { content, format, contentFormat }
  if (Array.isArray(embedFonts) && embedFonts.length > 0) {
    body.embedFonts = embedFonts
  }

  const response = await fetch(`${apiBase}/api/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WPX-User-Id': getUserId(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const detail = payload.message || payload.details
    const message = payload.error || `导出失败 (${response.status})`
    throw new Error(detail ? `${message}：${detail}` : message)
  }

  const blob = await response.blob()
  downloadBlob(blob, `${filename}.${format}`)
}
