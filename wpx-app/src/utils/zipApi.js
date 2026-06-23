import { fetchLibraryHealth } from '@/utils/libraryApi'
import { getElectronAPI, isElectron } from '@/utils/electron'

export const ARCHIVE_EXTENSIONS = ['.7z', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.wim']

let cachedLibraryRoot = ''

function getZipApi() {
  const api = getElectronAPI()?.zip
  if (!api) {
    throw new Error('压缩/解压缩功能仅在 WPX 桌面端可用')
  }
  return api
}

export const MAX_ARCHIVE_PREVIEWS = 3

export function isArchivePath(filePath) {
  if (!filePath) return false
  const lower = filePath.toLowerCase()
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function isZipOr7zArchive(filePath) {
  if (!filePath) return false
  const lower = filePath.toLowerCase()
  return lower.endsWith('.7z') || lower.endsWith('.zip')
}

export async function getLibraryRoot() {
  if (cachedLibraryRoot) return cachedLibraryRoot
  const health = await fetchLibraryHealth()
  cachedLibraryRoot = health.libraryRoot || ''
  return cachedLibraryRoot
}

export function joinLibraryAbsolutePath(libraryRoot, relativePath = '') {
  const root = String(libraryRoot || '').replace(/[\\/]+$/, '')
  const segments = String(relativePath || '')
    .split(/[\\/]/)
    .filter(Boolean)
  return [root, ...segments].join('\\')
}

export function suggestArchiveName(sourceLabel, format = '7z') {
  const base = String(sourceLabel || 'archive')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.[^.\\/]+$/, '')
    .trim() || 'archive'
  return `${base}.${format}`
}

export function deriveArchiveBaseName(targetPaths = []) {
  if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
    return 'archive'
  }

  if (targetPaths.length === 1) {
    const primary = String(targetPaths[0])
    const lastSep = Math.max(primary.lastIndexOf('\\'), primary.lastIndexOf('/'))
    const fileName = lastSep >= 0 ? primary.slice(lastSep + 1) : primary
    return fileName.replace(/\.[^.]+$/, '') || 'archive'
  }

  return 'archive'
}

export function buildDefaultOutputPath(targetPaths = [], format = '7z') {
  const primary = targetPaths[0]
  if (!primary) {
    return suggestArchiveName('archive', format)
  }

  const lastSep = Math.max(primary.lastIndexOf('\\'), primary.lastIndexOf('/'))
  const parentDir = lastSep >= 0 ? primary.slice(0, lastSep) : ''
  const baseName = deriveArchiveBaseName(targetPaths)
  const fileName = `${baseName}.${format}`
  const sep = primary.includes('\\') ? '\\' : '/'

  if (!parentDir) return fileName
  return `${parentDir}${sep}${fileName}`
}

export async function pickSaveArchivePath(defaultPath) {
  return getZipApi().pickSavePath({ defaultPath })
}

export async function pickExtractDirectory(defaultPath) {
  return getZipApi().pickDirectory({ defaultPath })
}

export async function pickArchiveFile(defaultPath) {
  return getZipApi().pickArchive({ defaultPath })
}

export async function listArchive(archivePath, password) {
  const payload =
    typeof archivePath === 'string'
      ? { archivePath, password }
      : archivePath
  return getZipApi().list(payload)
}

export function isPasswordRelatedError(message = '') {
  return /password|口令|encrypted|wrong password|can not open encrypted|wrong/i.test(message)
}

export async function compressPaths(payload) {
  return getZipApi().compress(payload)
}

export async function extractArchive(payload) {
  return getZipApi().extract(payload)
}

export async function cancelZipOperation(operationId) {
  return getZipApi().cancel(operationId)
}

export function subscribeZipProgress(callback) {
  const unsubscribe = getZipApi().onProgress?.(callback)
  return typeof unsubscribe === 'function' ? unsubscribe : () => {}
}

export function zipFeatureAvailable() {
  return isElectron() && Boolean(getElectronAPI()?.zip)
}

export function isZipCancelled(result) {
  return Boolean(result?.cancelled || result?.code === 'CANCELLED')
}

/**
 * 从拖放 DataTransfer 中提取本地压缩包绝对路径（Electron 下 File.path 可用）
 * @param {DataTransfer | null} dataTransfer
 * @returns {string[]}
 */
export function getArchivePathsFromDataTransfer(dataTransfer) {
  if (!dataTransfer || !isElectron()) return []

  return Array.from(dataTransfer.files || [])
    .map((file) => file.path || '')
    .filter((filePath) => isArchivePath(filePath))
}

export function hasArchiveFilesInDataTransfer(dataTransfer) {
  return getArchivePathsFromDataTransfer(dataTransfer).length > 0
}
