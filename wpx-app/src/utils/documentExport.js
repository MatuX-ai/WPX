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
  let apiBase
  try {
    apiBase = await getLocalApiBase()
  } catch (error) {
    if (error?.code === 'WPX_LOCAL_API_UNAVAILABLE') {
      throw new Error('本地导出服务尚未启动，请重试或重启 WPX。')
    }
    throw new Error(`无法连接本地服务：${error?.message || error}`)
  }
  const { embedFonts, contentFormat = 'markdown', exportOptions } = options

  /** @type {Record<string, unknown>} */
  const body = { content, format, contentFormat }
  if (Array.isArray(embedFonts) && embedFonts.length > 0) {
    body.embedFonts = embedFonts
  }
  if (exportOptions && typeof exportOptions === 'object') {
    body.exportOptions = exportOptions
  }

  let response
  try {
    response = await fetch(`${apiBase}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WPX-User-Id': getUserId(),
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    // fetch 抛出网络层异常（连接拒绝 / 服务未启动 / CSP 拦截 / URL 为空走相对路径失败）。
    // 将 “Failed to fetch” 等原始文案转换为面向用户的可读提示。
    const raw = String(error?.message || error || '')
    if (/Failed to fetch|NetworkError|fetch failed/i.test(raw)) {
      throw new Error(
        '无法连接本地导出服务（Failed to fetch）。可能原因：本地服务未启动、被安全软件拦截、或 API 地址未正确注入。请重启 WPX 后重试。',
      )
    }
    throw new Error(`网络请求失败：${raw}`)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const detail = payload.message || payload.details
    const message = payload.error || `导出失败 (${response.status})`
    throw new Error(detail ? `${message}：${detail}` : message)
  }

  const blob = await response.blob()
  downloadBlob(blob, `${filename}.${format}`)
}
