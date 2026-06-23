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
 * @typedef {Object} PaperMarginPayload
 * @property {number} top
 * @property {number} bottom
 * @property {number} left
 * @property {number} right
 */

/**
 * @typedef {Object} PaperPayload
 * @property {'A4' | 'Letter' | '16K' | 'mobile' | 'none'} paperSize
 * @property {'wide' | 'normal' | 'narrow' | 'custom'} paperMargin
 * @property {PaperMarginPayload} [customMargin]
 * @property {'none' | 'pageNumber' | 'custom'} headerFooter
 */

/**
 * @typedef {Object} ExportOptionPayload
 * @property {PaperPayload} paper
 * @property {boolean} [autoPaginate]
 * @property {boolean} [fitImagesToWidth]
 * @property {boolean} [generateToc]
 */

/**
 * @param {string} content
 * @param {'docx' | 'pdf' | 'html'} format
 * @param {string} [filename]
 * @param {{ embedFonts?: Array<{ fontId?: string, path?: string, text: string }>, contentFormat?: 'markdown' | 'html', exportOptions?: ExportOptionPayload }} [options]
 */
export async function exportViaApi(content, format, filename = 'document', options = {}) {
  const apiBase = await getLocalApiBase()
  const { embedFonts, contentFormat = 'markdown', exportOptions } = options

  /** @type {Record<string, unknown>} */
  const body = { content, format, contentFormat }
  if (Array.isArray(embedFonts) && embedFonts.length > 0) {
    body.embedFonts = embedFonts
  }
  if (exportOptions && typeof exportOptions === 'object') {
    body.exportOptions = exportOptions
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
