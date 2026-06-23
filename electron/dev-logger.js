/** @type {DevConfig | null} */
let devConfig = null

function initDevLogger(config) {
  devConfig = config
}

function isEnabled() {
  return Boolean(devConfig?.enabled)
}

function timestamp() {
  return new Date().toISOString()
}

function summarizePayload(payload) {
  if (payload === undefined) return undefined
  if (payload === null) return null

  try {
    const text = JSON.stringify(payload)
    if (text.length <= 240) return payload
    return `${text.slice(0, 237)}...`
  } catch {
    return String(payload)
  }
}

function resolveWindowId(event) {
  if (!event?.sender) return null
  // 延迟 require，避免 dev-logger ↔ window-manager ↔ window-debug 循环依赖
  const WindowManager = require('./window-manager')
  return WindowManager.findWindowIdByWebContents(event.sender)
}

/**
 * @param {'info' | 'warn' | 'error'} level
 * @param {string} scope
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function write(level, scope, message, meta) {
  if (!isEnabled()) return

  const prefix = `[${timestamp()}] [${scope}] ${message}`
  if (meta && Object.keys(meta).length > 0) {
    console[level](prefix, meta)
    return
  }
  console[level](prefix)
}

function logWindowCreated(meta) {
  if (!devConfig?.logWindows) return
  write('info', 'window', 'created', meta)
}

function logWindowDestroyed(meta) {
  if (!devConfig?.logWindows) return
  write('info', 'window', 'destroyed', meta)
}

function logWindowDebugReady(meta) {
  if (!devConfig?.logWindows) return
  write('info', 'window:debug', 'ready', meta)
}

function logIpcIncoming(channel, event, args) {
  if (!devConfig?.logIpc) return
  write('info', 'ipc', `<= ${channel}`, {
    windowId: resolveWindowId(event),
    args: args.map(summarizePayload),
  })
}

function logIpcReply(channel, event, result) {
  if (!devConfig?.logIpc) return
  write('info', 'ipc', `=> ${channel}`, {
    windowId: resolveWindowId(event),
    result: summarizePayload(result),
  })
}

function logAppDebugPort(port) {
  if (!devConfig?.logWindows) return
  write('info', 'debug', 'remote debugging enabled', {
    remoteDebuggingPort: port,
    targets: `http://127.0.0.1:${port}/json/list`,
  })
}

/**
 * @param {import('electron').IpcMain} ipcMain
 */
function installIpcLogging(ipcMain) {
  if (!devConfig?.enabled || !devConfig.logIpc) return

  const originalOn = ipcMain.on.bind(ipcMain)
  const originalOnce = ipcMain.once.bind(ipcMain)
  const originalHandle = ipcMain.handle.bind(ipcMain)

  ipcMain.on = (channel, listener) => {
    return originalOn(channel, (event, ...args) => {
      logIpcIncoming(channel, event, args)
      return listener(event, ...args)
    })
  }

  ipcMain.once = (channel, listener) => {
    return originalOnce(channel, (event, ...args) => {
      logIpcIncoming(channel, event, args)
      return listener(event, ...args)
    })
  }

  ipcMain.handle = (channel, listener) => {
    return originalHandle(channel, async (event, ...args) => {
      logIpcIncoming(channel, event, args)
      try {
        const result = await listener(event, ...args)
        logIpcReply(channel, event, result)
        return result
      } catch (error) {
        write('error', 'ipc', `!! ${channel}`, {
          windowId: resolveWindowId(event),
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    })
  }
}

module.exports = {
  initDevLogger,
  installIpcLogging,
  logWindowCreated,
  logWindowDestroyed,
  logWindowDebugReady,
  logAppDebugPort,
}
