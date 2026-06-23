const { loadDevConfig } = require('./dev-config')
const { findAvailablePort, findAvailablePortInRange } = require('./debug-port')
const {
  logWindowCreated,
  logWindowDestroyed,
  logWindowDebugReady,
} = require('./dev-logger')

/** @type {DevConfig | null} */
let devConfig = null
/** @type {number | null} */
let appRemoteDebugPort = null

/**
 * @param {import('./dev-config').DevConfig} config
 */
function initWindowDebug(config) {
  devConfig = config
}

/**
 * @param {number} port
 */
function setAppRemoteDebugPort(port) {
  appRemoteDebugPort = port
}

function getAppRemoteDebugPort() {
  return appRemoteDebugPort
}

/**
 * 在 app.ready 之前调用，设置进程级 remote-debugging-port。
 * @param {import('electron').App} electronApp
 * @param {import('./dev-config').DevConfig} config
 */
async function configureAppRemoteDebugging(electronApp, config) {
  if (!config.enabled) return null

  let port = config.remoteDebugPort
  if (!port) {
    port = await findAvailablePortInRange(config.debugPortBase, config.debugPortSpan)
  } else if (!(await require('./debug-port').isPortAvailable(port))) {
    port = await findAvailablePort(0)
  }

  electronApp.commandLine.appendSwitch('remote-debugging-port', String(port))
  setAppRemoteDebugPort(port)
  return port
}

/**
 * @param {number} windowId
 * @returns {Promise<number>}
 */
async function allocateWindowDebugPort(windowId) {
  const base = (devConfig?.debugPortBase ?? 9222) + windowId
  const span = devConfig?.debugPortSpan ?? 200
  return findAvailablePortInRange(base, span)
}

/**
 * @param {string} url
 * @param {number} remotePort
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function findDebugTarget(url, remotePort) {
  if (!remotePort) return null

  try {
    const response = await fetch(`http://127.0.0.1:${remotePort}/json/list`)
    if (!response.ok) return null
    const targets = await response.json()
    if (!Array.isArray(targets)) return null

    return (
      targets.find((target) => typeof target.url === 'string' && target.url.includes(url)) ||
      targets.find((target) => typeof target.url === 'string' && target.url.includes('localhost')) ||
      null
    )
  } catch {
    return null
  }
}

/**
 * @param {import('electron').BrowserWindow} window
 * @param {number} windowId
 * @param {{ docPath?: string, debugPort?: number }} meta
 */
async function attachWindowDebugging(window, windowId, meta) {
  if (!devConfig?.enabled) return

  const windowDebugPort = await allocateWindowDebugPort(windowId)
  meta.debugPort = windowDebugPort

  logWindowCreated({
    windowId,
    windowDebugPort,
    appRemoteDebugPort: appRemoteDebugPort,
    docPath: meta.docPath || '',
    note:
      'Electron 的 --remote-debugging-port 为进程级；windowDebugPort 为该窗口分配的独立调试槽位标识',
  })

  if (devConfig.autoDevTools) {
    window.webContents.once('did-finish-load', () => {
      if (window.isDestroyed()) return
      window.webContents.openDevTools({ mode: 'detach', activate: false })
    })
  }

  window.webContents.once('did-finish-load', async () => {
    if (window.isDestroyed()) return

    const pageUrl = window.webContents.getURL()
    const target = await findDebugTarget(`windowId=${windowId}`, appRemoteDebugPort ?? 0)

    logWindowDebugReady({
      windowId,
      windowDebugPort: meta.debugPort,
      appRemoteDebugPort: appRemoteDebugPort,
      pageUrl,
      devtoolsFrontendUrl: target?.devtoolsFrontendUrl ?? null,
      webSocketDebuggerUrl: target?.webSocketDebuggerUrl ?? null,
      jsonList: appRemoteDebugPort
        ? `http://127.0.0.1:${appRemoteDebugPort}/json/list`
        : null,
    })
  })

  window.on('closed', () => {
    logWindowDestroyed({
      windowId,
      windowDebugPort: meta.debugPort,
    })
  })
}

module.exports = {
  initWindowDebug,
  configureAppRemoteDebugging,
  attachWindowDebugging,
  getAppRemoteDebugPort,
  allocateWindowDebugPort,
}
