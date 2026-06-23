import { onBeforeUnmount, ref } from 'vue'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useToast } from '@/composables/useToast'

const MAX_RETRIES = 2

/** @type {import('vue').Ref<string | null>} */
const activeDownloadId = ref(null)
/** @type {import('vue').Ref<Record<string, number>>} */
const downloadProgressById = ref({})
/** @type {import('vue').Ref<Record<string, string>>} */
const downloadFailedById = ref({})

function getUserId() {
  if (typeof window === 'undefined') return 'local-user'
  return window.localStorage.getItem('wpx-user-id') || 'local-user'
}

/**
 * @param {import('@/types/electron').FontDownloadResult | undefined} result
 * @returns {string | null}
 */
function resolveLocalPath(result) {
  if (result?.path) return result.path
  if (result?.font?.path) return result.font.path
  return null
}

/**
 * @param {string} id
 * @param {number} percent
 */
function setDownloadProgress(id, percent) {
  downloadProgressById.value = {
    ...downloadProgressById.value,
    [id]: percent,
  }
}

/**
 * @param {string} id
 */
function clearDownloadFailed(id) {
  if (!downloadFailedById.value[id]) return
  const next = { ...downloadFailedById.value }
  delete next[id]
  downloadFailedById.value = next
}

/**
 * @param {string} id
 * @param {string} message
 */
function markDownloadFailed(id, message) {
  downloadFailedById.value = {
    ...downloadFailedById.value,
    [id]: message,
  }
}

/**
 * @param {string | null | undefined} id
 * @returns {boolean}
 */
export function isFontDownloading(id) {
  return Boolean(id) && activeDownloadId.value === id
}

/**
 * @param {string | null | undefined} id
 * @returns {boolean}
 */
export function isFontDownloadFailed(id) {
  return Boolean(id && downloadFailedById.value[id])
}

/**
 * @param {string | null | undefined} id
 * @returns {number}
 */
export function getFontDownloadProgress(id) {
  if (!id) return 0
  return downloadProgressById.value[id] ?? 0
}

/**
 * 字体下载 composable：通过 IPC 触发主进程下载，监听进度并在失败时自动重试。
 */
export function useFontDownloader() {
  const progress = ref(0)
  const isDownloading = ref(false)
  const error = ref(null)
  const toast = useToast()

  /** @type {(() => void) | null} */
  let progressUnsubscribe = null

  function teardownProgressListener() {
    progressUnsubscribe?.()
    progressUnsubscribe = null
  }

  onBeforeUnmount(() => {
    teardownProgressListener()
  })

  /**
   * @param {string} downloadId
   * @param {(percent: number) => void} [onProgress]
   */
  function attachProgressListener(downloadId, onProgress) {
    teardownProgressListener()

    const api = getElectronAPI()
    if (!api?.fonts?.onDownloadProgress) return

    progressUnsubscribe = api.fonts.onDownloadProgress((payload) => {
      if (!payload || payload.downloadId !== downloadId) return
      if (payload.phase === 'error') return

      let percent = progress.value
      if (typeof payload.percent === 'number') {
        percent = payload.percent
      } else if (payload.phase === 'complete') {
        percent = 100
      } else if (payload.phase === 'start') {
        percent = 0
      }

      progress.value = percent
      setDownloadProgress(downloadId, percent)
      onProgress?.(percent)
    })
  }

  /**
   * @param {string} fontId
   * @param {string} url
   * @param {{
   *   downloadId?: string,
   *   onProgress?: (percent: number) => void,
   *   onComplete?: (localPath: string) => void,
   *   type?: 'free' | 'commercial',
   *   fileName?: string,
   *   fontName?: string,
   *   meta?: Record<string, unknown>,
   * }} options
   * @param {number} attemptIndex
   * @returns {Promise<string>}
   */
  async function runDownloadAttempt(fontId, url, options, attemptIndex) {
    const api = getElectronAPI()
    if (!api?.fonts?.download) {
      throw new Error('当前环境无法下载字体')
    }

    const { onProgress, type = 'free', fileName, meta } = options
    const downloadId =
      attemptIndex > 0
        ? `${options.downloadId || fontId}-retry-${attemptIndex}-${Date.now()}`
        : options.downloadId || fontId

    attachProgressListener(downloadId, onProgress)

    /** @type {import('@/types/electron').FontDownloadPayload} */
    const payload = {
      url,
      type,
      fontId,
      fileName: fileName || `${fontId}.ttf`,
      downloadId,
    }

    if (type === 'commercial') {
      payload.userId = getUserId()
      if (meta) payload.meta = meta
    }

    const result = await api.fonts.download(payload)

    if (!result?.ok) {
      throw new Error(result?.error || '字体下载失败')
    }

    const localPath = resolveLocalPath(result)
    if (!localPath) {
      throw new Error('下载完成但未返回本地路径')
    }

    progress.value = 100
    setDownloadProgress(downloadId, 100)
    onProgress?.(100)

    return localPath
  }

  /**
   * 下载字体并在完成后返回本地路径。
   *
   * @param {string} fontId
   * @param {string} url
   * @param {{
   *   downloadId?: string,
   *   onProgress?: (percent: number) => void,
   *   onComplete?: (localPath: string) => void,
   *   type?: 'free' | 'commercial',
   *   fileName?: string,
   *   fontName?: string,
   *   meta?: Record<string, unknown>,
   * }} [options]
   * @returns {Promise<string>}
   */
  async function download(fontId, url, options = {}) {
    const normalizedFontId = String(fontId || '').trim()
    const normalizedUrl = String(url || '').trim()
    const downloadKey = options.downloadId || normalizedFontId

    if (!normalizedFontId || !normalizedUrl) {
      const message = 'fontId 与 url 不能为空'
      error.value = message
      toast.error(message)
      throw new Error(message)
    }

    if (!isElectron()) {
      const message = '当前环境无法下载字体'
      error.value = message
      toast.error(message)
      throw new Error(message)
    }

    isDownloading.value = true
    error.value = null
    progress.value = 0
    activeDownloadId.value = downloadKey
    clearDownloadFailed(downloadKey)
    setDownloadProgress(downloadKey, 0)
    options.onProgress?.(0)

    /** @type {Error | null} */
    let lastError = null

    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          if (attempt > 0) {
            progress.value = 0
            setDownloadProgress(downloadKey, 0)
            options.onProgress?.(0)
          }

          const localPath = await runDownloadAttempt(
            normalizedFontId,
            normalizedUrl,
            { ...options, downloadId: downloadKey },
            attempt,
          )
          options.onComplete?.(localPath)
          if (options.fontName) {
            toast.success(`${options.fontName} 下载完成`)
          } else {
            toast.success('字体下载完成')
          }
          return localPath
        } catch (attemptError) {
          lastError =
            attemptError instanceof Error ? attemptError : new Error(String(attemptError))

          if (attempt < MAX_RETRIES) {
            continue
          }
        }
      }

      const message = lastError?.message || '字体下载失败'
      error.value = message
      markDownloadFailed(downloadKey, message)
      toast.error(options.fontName ? `${options.fontName} 下载失败` : message)
      throw lastError || new Error(message)
    } finally {
      isDownloading.value = false
      activeDownloadId.value = null
      teardownProgressListener()
    }
  }

  return {
    download,
    progress,
    isDownloading,
    error,
    activeDownloadId,
    downloadProgressById,
    downloadFailedById,
    isFontDownloading,
    isFontDownloadFailed,
    getFontDownloadProgress,
  }
}
