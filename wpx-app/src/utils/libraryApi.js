import { getLocalApiBase } from '@/utils/localApi'
import { isElectron } from '@/utils/electron'

/**
 * 解析文库 API base URL。
 *
 * - Electron 桌面端：从 local-server 动态端口拿 base URL（与 export / jcode / knowledge 同源）。
 * - Web 端：优先 `VITE_LIBRARY_API_URL`；为空则走相对路径（依赖 Vite proxy `/api/library → :3004`）。
 *
 * 历史问题：旧版直接读 `VITE_LIBRARY_API_URL`，Electron 打包后该变量为空，
 * 导致 fetch 走相对路径 `file:///api/library/save` 触发 "Failed to fetch"。
 */
let cachedBase = null
let inflightPromise = null

async function getApiBase() {
  if (cachedBase) return cachedBase
  if (inflightPromise) return inflightPromise

  inflightPromise = (async () => {
    if (isElectron()) {
      // local-server 提供文库路由（详见 electron/services/library-routes.js）
      const base = await getLocalApiBase()
      cachedBase = base || ''
      return cachedBase
    }

    // Web 端：构建期变量优先，未配置则返回空串 → fetch 走相对路径，由 Vite proxy 转发
    cachedBase = (import.meta.env.VITE_LIBRARY_API_URL || '').replace(/\/$/, '')
    return cachedBase
  })()

  try {
    return await inflightPromise
  } finally {
    inflightPromise = null
  }
}

/**
 * 显式预热缓存。Electron 启动早期调用一次，可避免后续请求时串行等待
 * localServer.getBaseUrl()，从而让保存对话框首屏立即拿到 fetch 可用地址。
 */
export function primeLibraryApiBase() {
  return getApiBase()
}

async function parseError(response) {
  const payload = await response.json().catch(() => ({}))
  const detail = payload.detail || payload.message
  const message = payload.error || `请求失败 (${response.status})`
  throw new Error(detail ? `${message}：${detail}` : message)
}

export async function analyzeDocument({ content, title = '', pathCorrections = [] }) {
  const base = await getApiBase()
  const response = await fetch(`${base}/api/library/analyze`, {
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
  const base = await getApiBase()
  const response = await fetch(`${base}/api/library/save`, {
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
  const base = await getApiBase()
  const response = await fetch(`${base}/api/library/tree`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function searchLibrary(query) {
  const base = await getApiBase()
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`${base}/api/library/search?${params}`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function fetchLibraryDocument(relativePath) {
  const base = await getApiBase()
  const params = new URLSearchParams({ relativePath })
  const response = await fetch(`${base}/api/library/document?${params}`)
  if (!response.ok) await parseError(response)
  return response.json()
}

export async function fetchLibraryHealth() {
  const base = await getApiBase()
  const response = await fetch(`${base}/api/library/health`)
  if (!response.ok) await parseError(response)
  return response.json()
}