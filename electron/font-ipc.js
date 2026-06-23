const { app, ipcMain, BrowserWindow } = require('electron')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { Transform } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { randomUUID } = require('node:crypto')
const fontService = require('./font-service')
const { getLocalServerBaseUrl } = require('./local-server')
const {
  initFontPreferencesStore,
  getFontPreferencesStore,
} = require('./services/font-preferences-store')
const { RECOMMENDED_FREE_FONTS } = require('./services/recommended-fonts')

const LOG_PREFIX = '[font-ipc]'
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2'])
const COMMERCIAL_LIST_PATH = '/api/fonts/commercial/list'

/** @type {Set<string>} */
const activePreviewTempPaths = new Set()

function logInfo(message, extra) {
  if (extra !== undefined) {
    console.log(`${LOG_PREFIX} ${message}`, extra)
    return
  }
  console.log(`${LOG_PREFIX} ${message}`)
}

function logWarn(message, extra) {
  if (extra !== undefined) {
    console.warn(`${LOG_PREFIX} ${message}`, extra)
    return
  }
  console.warn(`${LOG_PREFIX} ${message}`)
}

function logError(message, error) {
  if (error instanceof Error) {
    console.error(`${LOG_PREFIX} ${message}`, error.message, error.stack)
    return
  }
  console.error(`${LOG_PREFIX} ${message}`, error)
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

function sendDownloadProgress(event, payload) {
  const window = getSenderWindow(event)
  if (window && !window.isDestroyed()) {
    window.webContents.send('font:download-progress', payload)
  }
}

function serializeError(error) {
  if (!(error instanceof Error)) {
    return { message: '操作失败', name: 'Error', code: 'FONT_UNKNOWN_ERROR' }
  }

  return {
    message: error.message,
    name: error.name,
    code: typeof error.code === 'string' ? error.code : 'FONT_ERROR',
  }
}

function success(data = {}) {
  return { ok: true, ...data }
}

function failure(error, code) {
  const serialized = serializeError(error)
  return {
    ok: false,
    error: serialized.message,
    code: code || serialized.code,
    name: serialized.name,
  }
}

function sanitizeFileName(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null
  }

  const baseName = path.basename(fileName.trim())
  if (!baseName || baseName === '.' || baseName === '..') {
    return null
  }

  return baseName.replace(/[<>:"|?*]/g, '_')
}

function resolveDownloadFileName(url, fileName, fontId) {
  const sanitized = sanitizeFileName(fileName)
  if (sanitized) return sanitized

  try {
    const parsed = new URL(url)
    const fromUrl = sanitizeFileName(path.basename(parsed.pathname))
    if (fromUrl && FONT_EXTENSIONS.has(path.extname(fromUrl).toLowerCase())) {
      return fromUrl
    }
  } catch {
    // ignore invalid URL during basename fallback
  }

  const safeId = typeof fontId === 'string' && fontId.trim() ? fontId.trim() : 'font'
  return `${safeId}.ttf`
}

function resolveCommercialApiUrl() {
  const configuredBase = process.env.WPX_API_BASE?.replace(/\/$/, '')
  if (configuredBase) {
    return `${configuredBase}${COMMERCIAL_LIST_PATH}`
  }

  const localBase = getLocalServerBaseUrl()
  if (localBase) {
    return `${localBase}${COMMERCIAL_LIST_PATH}`
  }

  return null
}

function createProgressTransform(onProgress) {
  let receivedBytes = 0

  return new Transform({
    transform(chunk, encoding, callback) {
      receivedBytes += chunk.length
      onProgress(receivedBytes)
      callback(null, chunk)
    },
  })
}

/**
 * @param {string} url
 * @param {string} destPath
 * @param {(receivedBytes: number, totalBytes: number) => void} onProgress
 */
async function downloadFile(url, destPath, onProgress) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`下载失败：HTTP ${response.status}`)
  }

  if (!response.body) {
    throw new Error('下载失败：响应体为空')
  }

  const totalBytes = Number(response.headers.get('content-length') || 0)
  await fsp.mkdir(path.dirname(destPath), { recursive: true })

  const tempPath = `${destPath}.download-${randomUUID()}`
  let receivedBytes = 0

  try {
    const progressStream = createProgressTransform((nextReceived) => {
      receivedBytes = nextReceived
      onProgress(receivedBytes, totalBytes)
    })

    await pipeline(response.body, progressStream, fs.createWriteStream(tempPath))
    await fsp.rename(tempPath, destPath)
    onProgress(receivedBytes, totalBytes || receivedBytes)
  } catch (error) {
    await fsp.unlink(tempPath).catch(() => {})
    throw error
  }
}

function validateDownloadPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('缺少下载参数')
  }

  const { url, type } = payload
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('url 无效')
  }

  if (type !== 'free' && type !== 'commercial') {
    throw new Error('type 必须是 free 或 commercial')
  }

  if (type === 'commercial') {
    if (typeof payload.fontId !== 'string' || !payload.fontId.trim()) {
      throw new Error('商业字体下载需要 fontId')
    }
    if (typeof payload.userId !== 'string' || !payload.userId.trim()) {
      throw new Error('商业字体下载需要 userId')
    }
  }
}

function validateSubsetPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('缺少子集化参数')
  }

  if (typeof payload.text !== 'string') {
    throw new Error('text 无效')
  }

  const hasFontId = typeof payload.fontId === 'string' && payload.fontId.trim()
  const hasPath = typeof payload.path === 'string' && payload.path.trim()

  if (!hasFontId && !hasPath) {
    throw new Error('fontId 或 path 至少提供一个')
  }
}

let fontPreferencesReady = false

async function ensureFontPreferencesStore() {
  if (fontPreferencesReady) return
  await initFontPreferencesStore(app.getPath('userData'))
  fontPreferencesReady = true
}

function registerFontIpcHandlers() {
  ipcMain.handle('font:get-all', async () => {
    try {
      logInfo('font:get-all')
      const fonts = await fontService.getAllFonts()
      return success({ fonts })
    } catch (error) {
      logError('font:get-all failed', error)
      return failure(error, 'FONT_LIST_FAILED')
    }
  })

  ipcMain.handle('font:get-built-in', async () => {
    try {
      logInfo('font:get-built-in')
      const fonts = await fontService.getBuiltInFonts()
      return success({ fonts })
    } catch (error) {
      logError('font:get-built-in failed', error)
      return failure(error, 'FONT_LIST_FAILED')
    }
  })

  ipcMain.handle('font:check-recommended', async (_event, payload = {}) => {
    try {
      const list = Array.isArray(payload?.recommended) ? payload.recommended : RECOMMENDED_FREE_FONTS
      logInfo('font:check-recommended', { count: list.length })
      const result = await fontService.checkRecommendedFonts(list)
      return success(result)
    } catch (error) {
      logError('font:check-recommended failed', error)
      return failure(error, 'FONT_RECOMMEND_CHECK_FAILED')
    }
  })

  ipcMain.handle('font:get-preferences', async () => {
    try {
      await ensureFontPreferencesStore()
      const disabledFontIds = getFontPreferencesStore().getDisabledFontIds()
      return success({ disabledFontIds })
    } catch (error) {
      logError('font:get-preferences failed', error)
      return failure(error, 'FONT_PREFERENCES_FAILED')
    }
  })

  ipcMain.handle('font:set-enabled', async (_event, payload = {}) => {
    try {
      await ensureFontPreferencesStore()

      const fontId = typeof payload.fontId === 'string' ? payload.fontId.trim() : ''
      if (!fontId) {
        throw new Error('fontId 无效')
      }

      const enabled = payload.enabled !== false
      const disabledFontIds = await getFontPreferencesStore().setFontEnabled(fontId, enabled)

      logInfo('font preference updated', { fontId, enabled })
      return success({ fontId, enabled, disabledFontIds })
    } catch (error) {
      logError('font:set-enabled failed', error)
      return failure(error, 'FONT_PREFERENCES_FAILED')
    }
  })

  ipcMain.handle('font:download', async (event, payload = {}) => {
    const downloadId =
      typeof payload.downloadId === 'string' && payload.downloadId
        ? payload.downloadId
        : randomUUID()

    try {
      validateDownloadPayload(payload)
      logInfo('font:download start', { downloadId, type: payload.type, url: payload.url })

      const fileName = resolveDownloadFileName(payload.url, payload.fileName, payload.fontId)
      sendDownloadProgress(event, {
        downloadId,
        phase: 'start',
        receivedBytes: 0,
        totalBytes: 0,
        percent: 0,
        fileName,
      })

      if (payload.type === 'free') {
        const destPath = path.join(fontService.getFreeFontsDir(), fileName)
        await downloadFile(payload.url, destPath, (receivedBytes, totalBytes) => {
          sendDownloadProgress(event, {
            downloadId,
            phase: 'progress',
            receivedBytes,
            totalBytes,
            percent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : null,
            fileName,
          })
        })

        const fonts = await fontService.parseFontFile(destPath, 'free')
        sendDownloadProgress(event, {
          downloadId,
          phase: 'complete',
          receivedBytes: 0,
          totalBytes: 0,
          percent: 100,
          fileName,
        })

        logInfo('font:download complete (free)', { downloadId, destPath })
        return success({ downloadId, path: destPath, fonts })
      }

      fontService.setUserCredentials({ userId: payload.userId.trim() })
      const tempPath = path.join(fontService.getTempFontsDir(), `${downloadId}-${fileName}`)

      await downloadFile(payload.url, tempPath, (receivedBytes, totalBytes) => {
        sendDownloadProgress(event, {
          downloadId,
          phase: 'progress',
          receivedBytes,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : null,
          fileName,
        })
      })

      const fontInfo = await fontService.storeCommercialFont(
        payload.fontId.trim(),
        tempPath,
        payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
      )

      sendDownloadProgress(event, {
        downloadId,
        phase: 'complete',
        receivedBytes: 0,
        totalBytes: 0,
        percent: 100,
        fileName,
      })

      logInfo('font:download complete (commercial)', { downloadId, fontId: payload.fontId })
      return success({ downloadId, font: fontInfo })
    } catch (error) {
      logError('font:download failed', error)
      sendDownloadProgress(event, {
        downloadId,
        phase: 'error',
        error: error instanceof Error ? error.message : '下载失败',
      })
      return failure(error, 'FONT_DOWNLOAD_FAILED')
    }
  })

  ipcMain.handle('font:get-commercial-list', async (_event, payload = {}) => {
    try {
      const apiUrl = resolveCommercialApiUrl()
      if (!apiUrl) {
        throw new Error('字体商店 API 不可用')
      }

      logInfo('font:get-commercial-list', { apiUrl })

      /** @type {Record<string, string>} */
      const headers = { Accept: 'application/json' }
      if (typeof payload.authToken === 'string' && payload.authToken.trim()) {
        headers.Authorization = `Bearer ${payload.authToken.trim()}`
      }

      const response = await fetch(apiUrl, { headers })
      if (!response.ok) {
        throw new Error(`字体商店请求失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      const fonts = Array.isArray(data?.fonts) ? data.fonts : Array.isArray(data) ? data : data?.items

      if (!Array.isArray(fonts)) {
        throw new Error('字体商店响应格式无效')
      }

      return success({ fonts, source: apiUrl })
    } catch (error) {
      logError('font:get-commercial-list failed', error)
      return failure(error, 'FONT_COMMERCIAL_LIST_FAILED')
    }
  })

  ipcMain.handle('font:decrypt-preview', async (_event, payload = {}) => {
    try {
      const fontId = typeof payload.fontId === 'string' ? payload.fontId.trim() : ''
      if (!fontId) {
        throw new Error('fontId 无效')
      }

      if (typeof payload.userId === 'string' && payload.userId.trim()) {
        fontService.setUserCredentials({ userId: payload.userId.trim() })
      }

      logInfo('font:decrypt-preview', { fontId })
      const tempPath = await fontService.decryptFont(fontId)
      activePreviewTempPaths.add(tempPath)

      return success({ tempPath, fontId })
    } catch (error) {
      logError('font:decrypt-preview failed', error)
      const code =
        error instanceof Error && error.code === 'FONT_DECRYPT_FAILED'
          ? 'FONT_DECRYPT_FAILED'
          : 'FONT_DECRYPT_PREVIEW_FAILED'
      return failure(error, code)
    }
  })

  ipcMain.handle('font:cleanup-preview', async (_event, payload = {}) => {
    try {
      const tempPath = typeof payload.tempPath === 'string' ? payload.tempPath : ''
      if (!tempPath) {
        throw new Error('tempPath 无效')
      }

      await fontService.cleanupDecryptedFont(tempPath)
      activePreviewTempPaths.delete(tempPath)
      logInfo('font:cleanup-preview', { tempPath })
      return success()
    } catch (error) {
      logError('font:cleanup-preview failed', error)
      return failure(error, 'FONT_CLEANUP_PREVIEW_FAILED')
    }
  })

  ipcMain.handle('font:subset-for-export', async (_event, payload = {}) => {
    try {
      validateSubsetPayload(payload)
      logInfo('font:subset-for-export', {
        fontId: payload.fontId,
        path: payload.path,
        textLength: payload.text.length,
      })

      if (typeof payload.userId === 'string' && payload.userId.trim()) {
        fontService.setUserCredentials({ userId: payload.userId.trim() })
      }

      let outputPath =
        typeof payload.outputPath === 'string' && payload.outputPath.trim()
          ? payload.outputPath.trim()
          : ''

      if (!outputPath) {
        const ext =
          typeof payload.path === 'string' && path.extname(payload.path)
            ? path.extname(payload.path)
            : '.ttf'
        const baseName =
          typeof payload.outputName === 'string' && payload.outputName.trim()
            ? sanitizeFileName(payload.outputName.trim())
            : null

        await fsp.mkdir(fontService.getTempFontsDir(), { recursive: true })
        outputPath = path.join(
          fontService.getTempFontsDir(),
          baseName || `export-subset-${randomUUID()}${ext}`,
        )
      }

      let result
      if (typeof payload.fontId === 'string' && payload.fontId.trim()) {
        result = await fontService.subsetCommercialFont(
          payload.fontId.trim(),
          payload.text,
          outputPath,
        )
      } else {
        result = await fontService.subsetFont(payload.path.trim(), payload.text, outputPath)
      }

      return success({ subset: result })
    } catch (error) {
      logError('font:subset-for-export failed', error)
      return failure(error, 'FONT_SUBSET_FAILED')
    }
  })

  if (typeof app !== 'undefined' && typeof app.on === 'function') {
    app.on('will-quit', async () => {
      const tempPaths = [...activePreviewTempPaths]
      activePreviewTempPaths.clear()
      await Promise.all(
        tempPaths.map(async (tempPath) => {
          try {
            await fontService.cleanupDecryptedFont(tempPath)
          } catch (error) {
            logWarn('failed to cleanup preview temp on quit', { tempPath, error })
          }
        }),
      )
    })
  }
}

module.exports = {
  registerFontIpcHandlers,
}
