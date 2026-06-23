const path = require('node:path')
const fsp = require('node:fs/promises')
const { isAssociableFile, getAssociationsEnabled } = require('./file-associations')
const { isArchiveFile } = require('./zip-ipc')

function isOpenableFile(filePath) {
  return isAssociableFile(filePath) || isArchiveFile(filePath)
}

/**
 * @param {string} filePath
 * @returns {Promise<{ path: string, content: string, title: string, format?: object | null, extension: string } | null>}
 */
async function readAssociatedFilePayload(filePath) {
  if (!isAssociableFile(filePath)) return null

  const ext = path.extname(filePath).toLowerCase()
  const baseTitle = path.basename(filePath, ext)
  const raw = await fsp.readFile(filePath, 'utf-8')

  if (ext === '.wpx') {
    try {
      const doc = JSON.parse(raw)
      return {
        path: filePath,
        content: String(doc.markdown ?? doc.content ?? ''),
        title: String(doc.title || baseTitle),
        format: doc.format ?? null,
        extension: ext,
      }
    } catch {
      return {
        path: filePath,
        content: raw,
        title: baseTitle,
        format: null,
        extension: ext,
      }
    }
  }

  return {
    path: filePath,
    content: raw,
    title: baseTitle,
    format: null,
    extension: ext,
  }
}

function extractAssociablePathsFromArgv(argv = process.argv) {
  return argv.filter((arg) => {
    if (!arg || arg.startsWith('-')) return false
    if (!path.isAbsolute(arg)) return false
    return isOpenableFile(arg)
  })
}

/**
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 * @param {(filePath: string) => Promise<void>} openFile
 */
function createFileOpenController(getMainWindow, openFile) {
  /** @type {string[]} */
  const pendingOpenFiles = []
  let isFlushing = false

  function shouldHandleOpen() {
    return getAssociationsEnabled()
  }

  async function deliverOpenFile(filePath) {
    if (!shouldHandleOpen()) return
    await openFile(filePath)
  }

  async function flushPendingOpenFiles() {
    if (isFlushing || pendingOpenFiles.length === 0) return

    isFlushing = true
    try {
      while (pendingOpenFiles.length > 0) {
        const filePath = pendingOpenFiles.shift()
        if (!filePath) continue
        await deliverOpenFile(filePath)
      }
    } finally {
      isFlushing = false
    }
  }

  function queueOpenFile(filePath) {
    if (!filePath || !isOpenableFile(filePath)) return
    if (!shouldHandleOpen()) return

    if (!pendingOpenFiles.includes(filePath)) {
      pendingOpenFiles.push(filePath)
    }

    const mainWindow = getMainWindow()
    if (mainWindow?.webContents && !mainWindow.webContents.isLoading()) {
      flushPendingOpenFiles()
    }
  }

  function handleOpenFileEvent(event, filePath) {
    event.preventDefault()
    queueOpenFile(filePath)
  }

  function handleStartupFiles(argv = process.argv) {
    const files = extractAssociablePathsFromArgv(argv)
    for (const filePath of files) {
      queueOpenFile(filePath)
    }
  }

  function onMainWindowReady() {
    flushPendingOpenFiles()
  }

  return {
    queueOpenFile,
    flushPendingOpenFiles,
    handleOpenFileEvent,
    handleStartupFiles,
    onMainWindowReady,
    getPendingCount: () => pendingOpenFiles.length,
  }
}

module.exports = {
  readAssociatedFilePayload,
  extractAssociablePathsFromArgv,
  isOpenableFile,
  createFileOpenController,
}
