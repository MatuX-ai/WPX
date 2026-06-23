const { ipcMain, dialog, BrowserWindow } = require('electron')
const { randomUUID } = require('node:crypto')
const path = require('node:path')
const {
  compress,
  extract,
  list,
  cancelOperation,
  isCancelledError,
} = require('./zip-service')

const ARCHIVE_EXTENSIONS = new Set([
  '.7z',
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.xz',
  '.wim',
])

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

function sendProgress(event, payload) {
  const window = getSenderWindow(event)
  if (window && !window.isDestroyed()) {
    window.webContents.send('zip:progress', payload)
  }
}

function serializeError(error) {
  if (isCancelledError(error)) {
    return {
      cancelled: true,
      code: 'CANCELLED',
      message: error.message || '操作已取消',
      name: 'CancelledError',
    }
  }

  if (!(error instanceof Error)) {
    return { message: '操作失败', name: 'Error' }
  }

  return {
    message: error.message,
    name: error.name,
    code: error.code,
  }
}

function buildOperationFailure(operationId, error) {
  const serialized = serializeError(error)

  if (serialized.cancelled || serialized.code === 'CANCELLED') {
    return {
      ok: false,
      operationId,
      cancelled: true,
      code: 'CANCELLED',
    }
  }

  return {
    ok: false,
    operationId,
    ...serialized,
    error: serialized.message,
  }
}

function registerZipIpcHandlers() {
  ipcMain.handle('zip:compress', async (event, payload = {}) => {
    const operationId =
      typeof payload.operationId === 'string' && payload.operationId
        ? payload.operationId
        : randomUUID()

    sendProgress(event, { operationId, percent: 0, currentFile: '' })

    try {
      const { promise } = compress(payload.sources, payload.outputPath, {
        format: payload.format,
        level: payload.level,
        password: payload.password,
        archiveBaseDir: payload.archiveBaseDir,
        operationId,
        onProgress: (percent) => {
          sendProgress(event, { operationId, percent, currentFile: '' })
        },
      })

      const result = await promise

      sendProgress(event, { operationId, percent: 100, currentFile: '' })
      return { ok: true, operationId, ...result }
    } catch (error) {
      return buildOperationFailure(operationId, error)
    }
  })

  ipcMain.handle('zip:extract', async (event, payload = {}) => {
    const operationId =
      typeof payload.operationId === 'string' && payload.operationId
        ? payload.operationId
        : randomUUID()

    sendProgress(event, { operationId, percent: 0, currentFile: '' })

    try {
      const { promise } = extract(payload.archivePath, payload.outputDir, {
        password: payload.password,
        files: payload.files,
        operationId,
        onProgress: (percent) => {
          sendProgress(event, { operationId, percent, currentFile: '' })
        },
      })

      const result = await promise

      sendProgress(event, { operationId, percent: 100, currentFile: '' })
      return { ok: true, operationId, ...result }
    } catch (error) {
      return buildOperationFailure(operationId, error)
    }
  })

  ipcMain.handle('zip:list', async (_event, payload = {}) => {
    const archivePath =
      typeof payload === 'string' ? payload : payload?.archivePath
    const password = typeof payload === 'object' ? payload?.password : undefined

    try {
      if (!archivePath) {
        throw new TypeError('archivePath 必须是非空字符串')
      }

      const files = await list(archivePath, { password })
      return { ok: true, files }
    } catch (error) {
      return { ok: false, files: [], ...serializeError(error), error: error instanceof Error ? error.message : '无法读取压缩包' }
    }
  })

  ipcMain.handle('zip:cancel', (_event, operationId) => {
    if (typeof operationId !== 'string' || !operationId) {
      return { ok: false }
    }

    return { ok: cancelOperation(operationId) }
  })

  ipcMain.handle('zip:pick-save-path', async (event, payload = {}) => {
    const window = getSenderWindow(event)
    const defaultPath = typeof payload.defaultPath === 'string' ? payload.defaultPath : undefined
    const filters = Array.isArray(payload.filters) ? payload.filters : [
      { name: '7-Zip Archive', extensions: ['7z'] },
      { name: 'ZIP Archive', extensions: ['zip'] },
      { name: 'TAR Archive', extensions: ['tar'] },
    ]

    const result = await dialog.showSaveDialog(window ?? undefined, {
      defaultPath,
      filters,
    })

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true }
    }

    return { ok: true, filePath: result.filePath }
  })

  ipcMain.handle('zip:pick-directory', async (event, payload = {}) => {
    const window = getSenderWindow(event)
    const defaultPath = typeof payload.defaultPath === 'string' ? payload.defaultPath : undefined

    const result = await dialog.showOpenDialog(window ?? undefined, {
      defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, canceled: true }
    }

    return { ok: true, directoryPath: result.filePaths[0] }
  })

  ipcMain.handle('zip:pick-archive', async (event, payload = {}) => {
    const window = getSenderWindow(event)
    const defaultPath = typeof payload.defaultPath === 'string' ? payload.defaultPath : undefined

    const result = await dialog.showOpenDialog(window ?? undefined, {
      defaultPath,
      properties: ['openFile'],
      filters: [
        {
          name: 'Archives',
          extensions: ['7z', 'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'wim'],
        },
      ],
    })

    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, canceled: true }
    }

    return { ok: true, filePath: result.filePaths[0] }
  })
}

function isArchiveFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false
  return ARCHIVE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function initZipService() {
  registerZipIpcHandlers()
}

module.exports = {
  initZipService,
  isArchiveFile,
  ARCHIVE_EXTENSIONS,
}
