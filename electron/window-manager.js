const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { attachWindowDebugging } = require('./window-debug')

const MAX_WINDOWS = 8
const APP_NAME = 'WPX'

/** @type {{ MAX_WINDOWS: 'MAX_WINDOWS' }} */
const WINDOW_CREATE_ERROR = {
  MAX_WINDOWS: 'MAX_WINDOWS',
}

const MAX_WINDOWS_MESSAGE = '最多只能打开8个窗口，请关闭一个后再试'
// 显式用 127.0.0.1 (IPv4) 而非 localhost，避开 Windows / Electron Chromium 的 Happy Eyeballs
// 解析偶发只走 IPv4 失败的问题。Vite 18+ 默认只监听 IPv6，Electron 加载 localhost 偶尔会卡。
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const WPX_APP_ROOT = path.join(__dirname, '..', 'wpx-app')

function resolvePreloadPath() {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, 'electron', 'preload.js'),
    path.join(appPath.replace(/\.asar$/, '.asar.unpacked'), 'electron', 'preload.js'),
    path.join(__dirname, 'preload.js'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
}

function resolveProdIndexHtml() {
  const candidates = [
    path.join(app.getAppPath(), 'wpx-app', 'dist', 'index.html'),
    path.join(WPX_APP_ROOT, 'dist', 'index.html'),
  ]
  const resolved = candidates.find((candidate) => fs.existsSync(candidate))
  if (!resolved) {
    console.error('[window] dist/index.html not found, tried:', candidates)
  }
  return resolved ?? candidates[0]
}

const ICON_CANDIDATES = [
  path.join(WPX_APP_ROOT, 'public', 'icon.ico'),
  path.join(WPX_APP_ROOT, 'public', 'icon.png'),
  path.join(WPX_APP_ROOT, 'public', 'favicon.svg'),
]

function resolveIconPath() {
  return ICON_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? ICON_CANDIDATES[0]
}

function buildSearchParams(windowId, docPath) {
  const params = new URLSearchParams()
  params.set('windowId', String(windowId))
  if (docPath) {
    params.set('docPath', docPath)
  }
  return params.toString()
}

class WindowManager {
  constructor() {
    /** @type {Map<number, import('electron').BrowserWindow>} */
    this._windows = new Map()
    /** @type {Map<number, { docPath?: string, debugPort?: number }>} */
    this._meta = new Map()
    this._nextId = 1
  }

  /**
   * @param {string} [docPath]
   * @param {{ suppressDialog?: boolean }} [options]
   * @returns {{ ok: true, windowId: number } | { ok: false, error: string }}
   */
  createWindow(docPath, options = {}) {
    if (this._windows.size >= MAX_WINDOWS) {
      if (!options.suppressDialog) {
        dialog.showMessageBoxSync({
          type: 'warning',
          title: '窗口数量已达上限',
          message: MAX_WINDOWS_MESSAGE,
          buttons: ['确定'],
        })
      }
      return { ok: false, error: WINDOW_CREATE_ERROR.MAX_WINDOWS }
    }

    const windowId = this._nextId++
    const isDev = !app.isPackaged
    const search = buildSearchParams(windowId, docPath)
    const meta = { docPath: docPath ?? '' }

    const window = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      show: false,
      frame: false,
      title: APP_NAME,
      icon: resolveIconPath(),
      backgroundColor: '#1a1a1a',
      webPreferences: {
        preload: resolvePreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    this._windows.set(windowId, window)
    this._meta.set(windowId, meta)

    if (isDev) {
      void attachWindowDebugging(window, windowId, meta)
    }

    window.once('ready-to-show', () => {
      window.show()
      window.moveTop()
      window.focus()
    })

    if (!isDev) {
      window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return
        console.error('[window] did-fail-load', errorCode, errorDescription, validatedURL)
        dialog.showErrorBox(
          '页面加载失败',
          `无法加载应用界面（${errorCode}）：${errorDescription}`,
        )
      })
    }

    window.on('closed', () => {
      this._windows.delete(windowId)
      this._meta.delete(windowId)
    })

    if (isDev) {
      window.loadURL(`${DEV_SERVER_URL}?${search}`)
    } else {
      window.loadFile(resolveProdIndexHtml(), { search })
    }

    return { ok: true, windowId }
  }

  /**
   * @param {number} windowId
   * @returns {import('electron').BrowserWindow | null}
   */
  getWindow(windowId) {
    const window = this._windows.get(windowId)
    if (!window || window.isDestroyed()) {
      this._windows.delete(windowId)
      this._meta.delete(windowId)
      return null
    }
    return window
  }

  /**
   * @param {import('electron').BrowserWindow} browserWindow
   * @returns {number | null}
   */
  findWindowId(browserWindow) {
    for (const [id, window] of this._windows) {
      if (window === browserWindow) return id
    }
    return null
  }

  /**
   * @param {number} windowId
   * @returns {boolean}
   */
  closeWindow(windowId) {
    const window = this._windows.get(windowId)
    if (!window || window.isDestroyed()) {
      this._windows.delete(windowId)
      this._meta.delete(windowId)
      return false
    }

    window.close()
    return true
  }

  /**
   * @param {import('electron').WebContents} webContents
   * @returns {number | null}
   */
  findWindowIdByWebContents(webContents) {
    for (const [id, window] of this._windows) {
      if (window.webContents === webContents) return id
    }
    return null
  }

  /**
   * @returns {Array<{ id: number, title: string, docPath: string, debugPort?: number }>}
   */
  getWindowList() {
    const list = []

    for (const [id, window] of this._windows) {
      if (window.isDestroyed()) {
        this._windows.delete(id)
        this._meta.delete(id)
        continue
      }

      const meta = this._meta.get(id)
      list.push({
        id,
        title: window.getTitle() || APP_NAME,
        docPath: meta?.docPath ?? '',
        debugPort: meta?.debugPort,
      })
    }

    return list
  }

  /**
   * @param {number} windowId
   * @returns {boolean}
   */
  focusWindow(windowId) {
    const window = this._windows.get(windowId)
    if (!window || window.isDestroyed()) {
      this._windows.delete(windowId)
      this._meta.delete(windowId)
      return false
    }

    if (window.isMinimized()) {
      window.restore()
    }
    window.show()
    window.moveTop()
    window.focus()
    return true
  }
}

module.exports = new WindowManager()
module.exports.WINDOW_CREATE_ERROR = WINDOW_CREATE_ERROR
module.exports.MAX_WINDOWS = MAX_WINDOWS
