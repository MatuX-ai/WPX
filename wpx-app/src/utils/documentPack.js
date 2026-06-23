import { getElectronAPI } from '@/utils/electron'

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*<?([^>\s)]+)>?/g
const HTML_IMAGE_PATTERN = /<img[^>]+src=["']([^"']+)["']/gi

function normalizeSeparators(filePath) {
  return String(filePath || '').replace(/\//g, '\\')
}

export function dirname(filePath) {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  return index >= 0 ? normalized.slice(0, index) : ''
}

export function isRemoteOrEmbeddedImageSrc(src) {
  const value = String(src || '').trim().toLowerCase()
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  )
}

export function fileUrlToPath(url) {
  const raw = String(url || '').trim()
  if (!raw.toLowerCase().startsWith('file://')) return raw

  try {
    const decoded = decodeURIComponent(raw.replace(/^file:\/\//i, ''))
    if (/^[a-zA-Z]:/.test(decoded)) {
      return decoded.replace(/\//g, '\\')
    }
    return decoded.startsWith('/') ? decoded.slice(1).replace(/\//g, '\\') : decoded.replace(/\//g, '\\')
  } catch {
    return raw.replace(/^file:\/\//i, '').replace(/\//g, '\\')
  }
}

export function resolvePathRelativeToDocument(documentPath, ref) {
  let target = String(ref || '').trim()
  if (!target) return ''

  if (target.startsWith('file://')) {
    target = fileUrlToPath(target)
  }

  if (/^[a-zA-Z]:[\\/]/.test(target) || target.startsWith('\\\\') || target.startsWith('/')) {
    return normalizeSeparators(target)
  }

  const docDir = dirname(documentPath)
  const sep = documentPath.includes('\\') ? '\\' : '/'
  const baseParts = docDir ? docDir.split(/[\\/]/).filter(Boolean) : []
  const refParts = target.replace(/^\.[\\/]/, '').split(/[\\/]/).filter((part) => part !== '')

  const stack = [...baseParts]
  for (const part of refParts) {
    if (part === '.') continue
    if (part === '..') {
      stack.pop()
      continue
    }
    stack.push(part)
  }

  return stack.join(sep)
}

export function parseMarkdownImageSources(markdown) {
  const sources = []
  const content = String(markdown || '')

  for (const pattern of [MARKDOWN_IMAGE_PATTERN, HTML_IMAGE_PATTERN]) {
    pattern.lastIndex = 0
    let match = pattern.exec(content)
    while (match) {
      sources.push(match[1].trim())
      match = pattern.exec(content)
    }
  }

  return sources
}

async function pathExists(filePath) {
  const api = getElectronAPI()?.files
  if (!api?.getModifiedTime || !filePath) return false
  const stat = await api.getModifiedTime(filePath)
  return Boolean(stat)
}

export async function writeDocumentContent(documentPath, markdown) {
  const api = getElectronAPI()?.files
  if (!api?.writeDocument) {
    throw new Error('当前环境不支持写入本地文档')
  }

  const result = await api.writeDocument(documentPath, markdown ?? '')
  if (!result?.ok) {
    throw new Error(result?.error || '无法写入文档')
  }
}

export async function collectDocumentPackSources(documentPath, markdown) {
  if (!documentPath) {
    throw new Error('请先保存文档后再打包')
  }

  const sources = []
  const seen = new Set()

  function addSource(filePath) {
    const normalized = normalizeSeparators(filePath)
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) return
    seen.add(key)
    sources.push(normalized)
  }

  addSource(documentPath)

  for (const ref of parseMarkdownImageSources(markdown)) {
    if (isRemoteOrEmbeddedImageSrc(ref)) continue
    const resolved = resolvePathRelativeToDocument(documentPath, ref)
    if (!resolved) continue
    addSource(resolved)
  }

  const existing = []
  for (const source of sources) {
    if (await pathExists(source)) {
      existing.push(source)
    }
  }

  if (!existing.some((item) => item.toLowerCase() === normalizeSeparators(documentPath).toLowerCase())) {
    throw new Error('文档路径无效或文件不存在')
  }

  return existing
}
