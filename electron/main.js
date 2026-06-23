const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  globalShortcut,
  ipcMain,
  dialog,
  shell,
  session,
} = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const {
  startLocalServer,
  stopLocalServer,
  getLocalServerBaseUrl,
} = require('./local-server')
const {
  checkPandocAvailable,
  PANDOC_INSTALL_HINT,
  registerExportAiLayoutSuggestHandler,
} = require('./services/export-routes')
const {
  getAssociationsEnabled,
  setAssociationsEnabled,
} = require('./file-associations')
const {
  readAssociatedFilePayload,
  createFileOpenController,
  extractAssociablePathsFromArgv,
} = require('./file-open')
const WindowManager = require('./window-manager')
const { initUserDataService } = require('./user-data-service')
const { initModelIpc } = require('./model-ipc')
const { initAuthStore } = require('./auth-store')
const { initFreeQuotaIpc } = require('./free-quota-ipc')
const {
  initAuthProtocol,
  handleAuthCallbackUrl,
  extractProtocolUrlsFromArgv,
} = require('./auth-protocol')
const { initKnowledgeService } = require('./knowledge-service')
const { initMemoryService } = require('./memory-service')
const { loadDevConfig } = require('./dev-config')
const {
  initDevLogger,
  installIpcLogging,
  logAppDebugPort,
} = require('./dev-logger')
const {
  initWindowDebug,
  configureAppRemoteDebugging,
} = require('./window-debug')
const { get7ZipLicensePath } = require('./7za-path')
const { resolveBuiltInFontLicensePath } = require('./built-in-font-licenses')
const { getAppInfo, checkForUpdates } = require('./about-update')
const { initZipService, isArchiveFile } = require('./zip-ipc')
const { registerFontIpcHandlers } = require('./font-ipc')

const devConfig = loadDevConfig({ isPackaged: app.isPackaged })
initDevLogger(devConfig)
initWindowDebug(devConfig)
installIpcLogging(ipcMain)

const debugBootstrap = configureAppRemoteDebugging(app, devConfig).then((port) => {
  if (port != null) {
    logAppDebugPort(port)
  }
  return port
})

const APP_NAME = 'WPX'
const WPX_PROTOCOL = 'wpx'
const WPX_APP_ROOT = path.join(__dirname, '..', 'wpx-app')

/** @type {string | null} */
let pendingWpxProtocolUrl = null

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null
/** @type {import('electron').Tray | null} */
let tray = null
let isQuitting = false
/** @type {boolean} */
let trayMinimizedOnLastClose = process.platform === 'darwin'
/** @type {WeakSet<import('electron').BrowserWindow>} */
const forceClosingWindows = new WeakSet()
/** @type {ReturnType<typeof createFileOpenController> | null} */
let fileOpenController = null
/** @type {Array<{ id: string, title: string, path?: string }>} */
let recentDocuments = []

// ── 图标路径（预留，打包时替换为 .ico / .png）────────────────────────────
const ICON_CANDIDATES = [
  path.join(WPX_APP_ROOT, 'public', 'icon.ico'),
  path.join(WPX_APP_ROOT, 'public', 'icon.png'),
  path.join(WPX_APP_ROOT, 'public', 'favicon.svg'),
]

function resolveIconPath() {
  return ICON_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? ICON_CANDIDATES[0]
}

function loadNativeIcon() {
  const iconPath = resolveIconPath()
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? nativeImage.createEmpty() : image
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

function showMainWindow() {
  if (!mainWindow) return
  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.focus()
}

function hideMainWindow() {
  mainWindow?.hide()
}

function toggleMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    hideMainWindow()
    return
  }
  showMainWindow()
}

async function openAssociatedFile(filePath) {
  if (!getAssociationsEnabled()) return

  try {
    if (isArchiveFile(filePath)) {
      const deliverArchive = () => {
        mainWindow?.webContents?.send('file:open-archive', { archivePath: filePath })
      }

      if (!mainWindow) return

      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', deliverArchive)
      } else {
        deliverArchive()
      }

      showMainWindow()
      return
    }

    const payload = await readAssociatedFilePayload(filePath)
    if (!payload) return

    const deliver = () => {
      mainWindow?.webContents?.send('file:open', payload)
    }

    if (!mainWindow) return

    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', deliver)
    } else {
      deliver()
    }

    showMainWindow()
  } catch (error) {
    console.error('[main] Failed to open associated file:', error)
    dialog.showErrorBox('无法打开文件', `${filePath}\n\n${error.message}`)
  }
}

function buildWindowsTraySubmenu() {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  const windows = WindowManager.getWindowList()

  if (!windows.length) {
    return [{ label: '暂无窗口', enabled: false }]
  }

  return windows.map((win) => {
    const browserWindow = WindowManager.getWindow(win.id)
    return {
      label: win.title,
      type: 'checkbox',
      checked: Boolean(browserWindow && browserWindow === focusedWindow),
      click: () => {
        WindowManager.focusWindow(win.id)
      },
    }
  })
}

function buildAppMenu() {
  const windows = WindowManager.getWindowList()
  const windowSubmenu = []

  windowSubmenu.push({
    label: '新建窗口',
    accelerator: 'CmdOrCtrl+N',
    click: () => {
      createManagedWindow()
    },
  })

  windowSubmenu.push({ type: 'separator' })

  if (windows.length === 0) {
    windowSubmenu.push({ label: '暂无窗口', enabled: false })
  } else {
    for (const win of windows) {
      windowSubmenu.push({
        label: win.title,
        click: () => {
          WindowManager.focusWindow(win.id)
        },
      })
    }
  }

  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建窗口',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createManagedWindow()
          },
        },
        {
          label: '偏好设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            openSettingsInFocusedWindow()
          },
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            initiateQuit()
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '窗口',
      submenu: windowSubmenu,
    },
  ]

  // macOS 应用菜单
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 WPX' },
        {
          label: '偏好设置…',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            openSettingsInFocusedWindow()
          },
        },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Cmd+Q',
          click: () => {
            initiateQuit()
          },
        },
      ],
    })
    // 从文件菜单移除退出项（macOS 标准）
    const fileMenu = template.find((m) => m.label === '文件')
    if (fileMenu?.submenu) {
      fileMenu.submenu = fileMenu.submenu.filter(
        (item) => item.label !== '退出',
      )
    }
  }

  return Menu.buildFromTemplate(template)
}

function refreshAppMenu() {
  Menu.setApplicationMenu(buildAppMenu())
}

function buildTrayContextMenu() {
  const recentSubmenu =
    recentDocuments.length > 0
      ? recentDocuments.map((doc) => ({
          label: doc.title,
          click: () => {
            mainWindow?.webContents?.send('tray:open-recent', doc)
            showMainWindow()
          },
        }))
      : [{ label: '暂无最近文档', enabled: false }]

  return Menu.buildFromTemplate([
    {
      label: '新建窗口',
      click: () => {
        createManagedWindow()
      },
    },
    {
      label: '打开最近文档',
      submenu: recentSubmenu,
    },
    {
      label: '窗口',
      submenu: buildWindowsTraySubmenu(),
    },
    {
      label: '偏好设置',
      click: () => {
        openSettingsInFocusedWindow()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        initiateQuit()
      },
    },
  ])
}

function refreshTrayMenu() {
  tray?.setContextMenu(buildTrayContextMenu())
  refreshAppMenu()
}

function openSettingsInFocusedWindow() {
  const target = BrowserWindow.getFocusedWindow() || mainWindow
  if (!target || target.isDestroyed()) return

  if (!target.isVisible()) {
    target.show()
  }
  if (target.isMinimized()) {
    target.restore()
  }
  target.focus()
  target.webContents.send('app:open-settings')
}

function createTray() {
  const icon = loadNativeIcon()
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  refreshTrayMenu()

  tray.on('click', () => {
    toggleMainWindow()
  })

  tray.on('right-click', () => {
    refreshTrayMenu()
    tray?.popUpContextMenu()
  })
}

/** @type {WeakMap<import('electron').BrowserWindow, ReturnType<typeof setTimeout>>} */
const closeCheckTimers = new WeakMap()
/** @type {WeakSet<import('electron').BrowserWindow>} */
const closeCheckAwaiting = new WeakSet()

function clearWindowCloseCheck(window) {
  const timer = closeCheckTimers.get(window)
  if (timer) {
    clearTimeout(timer)
    closeCheckTimers.delete(window)
  }
  closeCheckAwaiting.delete(window)
}

function forceCloseBrowserWindow(window) {
  if (!window || window.isDestroyed()) return
  forceClosingWindows.add(window)
  window.destroy()
}

function bindWindowCloseGuard(window) {
  window.on('close', (event) => {
    if (forceClosingWindows.has(window)) return

    // 渲染进程未响应时，再次 Alt+F4 强制关闭
    if (closeCheckAwaiting.has(window)) {
      clearWindowCloseCheck(window)
      forceCloseBrowserWindow(window)
      return
    }

    event.preventDefault()
    closeCheckAwaiting.add(window)
    window.webContents.send('window:close-check')

    const timer = setTimeout(() => {
      clearWindowCloseCheck(window)
      forceCloseBrowserWindow(window)
    }, 3000)
    closeCheckTimers.set(window, timer)
  })

  window.on('closed', () => {
    clearWindowCloseCheck(window)
  })
}

function promoteNextMainWindow() {
  const remaining = WindowManager.getWindowList()
  if (remaining.length === 0) {
    mainWindow = null
    return
  }

  const nextMain = WindowManager.getWindow(remaining[0].id)
  mainWindow = nextMain ?? null
}

function bindManagedWindow(window, { isMain = false } = {}) {
  window.on('focus', () => {
    window.webContents.send('window:focus')
  })

  window.on('blur', () => {
    window.webContents.send('window:blur')
  })

  bindWindowCloseGuard(window)

  if (isMain) {
    window.once('ready-to-show', () => {
      fileOpenController?.onMainWindowReady()
    })
  }

  window.on('closed', () => {
    if (window === mainWindow) {
      promoteNextMainWindow()
    }
    refreshTrayMenu()
  })
}

/**
 * @param {string} [docPath]
 * @param {{ suppressDialog?: boolean }} [options]
 * @returns {{ ok: true, windowId: number } | { ok: false, error: string }}
 */
function createManagedWindow(docPath, options = {}) {
  const result = WindowManager.createWindow(docPath, options)
  if (!result.ok) return result

  const windowId = result.windowId
  const window = WindowManager.getWindow(windowId)
  if (!window) {
    return { ok: false, error: 'UNKNOWN' }
  }

  const isMain = mainWindow == null
  if (isMain) {
    mainWindow = window
  }

  bindManagedWindow(window, { isMain })
  refreshTrayMenu()
  return { ok: true, windowId }
}

function confirmCloseSenderWindow(event) {
  const window = getSenderWindow(event)
  if (!window) return

  clearWindowCloseCheck(window)

  const windowId = WindowManager.findWindowId(window)
  if (windowId == null) return

  forceClosingWindows.add(window)
  WindowManager.closeWindow(windowId)
}

function initiateQuit() {
  const windows = WindowManager.getWindowList()
  if (windows.length === 0) {
    app.quit()
    return
  }

  for (const win of windows) {
    const bw = WindowManager.getWindow(win.id)
    if (bw && !bw.isDestroyed()) {
      bw.close()
    }
  }
}

function configureProductionSession() {
  if (!app.isPackaged) return

  // 生产环境 file:// 加载时，避免 CSP 阻止内联脚本或本地模块
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders ?? {}) }
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    callback({ responseHeaders })
  })
}

function registerIpcHandlers() {
  ipcMain.handle('tray:hide-main-window', () => {
    hideMainWindow()
  })

  ipcMain.handle('tray:show-main-window', () => {
    showMainWindow()
  })

  ipcMain.handle('tray:show', () => {
    tray?.setImage(loadNativeIcon())
  })

  ipcMain.handle('tray:hide', () => {
    // Tray 图标保持可见以便用户恢复窗口；此处保留 API 兼容渲染层
  })

  ipcMain.handle('tray:set-recent-documents', (_event, documents) => {
    if (!Array.isArray(documents)) return
    recentDocuments = documents
    refreshTrayMenu()
  })

  ipcMain.handle('app:quit', () => {
    initiateQuit()
  })

  ipcMain.on('window:minimize', (event) => {
    getSenderWindow(event)?.minimize()
  })

  ipcMain.on('window:maximize-restore', (event) => {
    const win = getSenderWindow(event)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
      return
    }
    win.maximize()
  })

  ipcMain.on('window:maximize', (event) => {
    getSenderWindow(event)?.maximize()
  })

  ipcMain.on('window:unmaximize', (event) => {
    getSenderWindow(event)?.unmaximize()
  })

  ipcMain.handle('window:is-maximized', (event) => {
    return getSenderWindow(event)?.isMaximized() ?? false
  })

  ipcMain.on('window:close', (event) => {
    getSenderWindow(event)?.close()
  })

  ipcMain.handle('window:list-request', (event) => {
    const senderWindow = getSenderWindow(event)
    const currentWindowId = WindowManager.findWindowId(senderWindow)
    const windows = WindowManager.getWindowList().map(({ id, title }) => ({ id, title }))
    return {
      windows,
      currentWindowId: currentWindowId ?? null,
    }
  })

  ipcMain.on('window:focus-other', (event, windowId) => {
    if (typeof windowId !== 'number' || !Number.isFinite(windowId)) return
    WindowManager.focusWindow(windowId)
  })

  ipcMain.handle('window:create', (_event, docPath) => {
    return createManagedWindow(docPath, { suppressDialog: true })
  })

  ipcMain.on('window:request-close', (event) => {
    event.sender.send('window:close-check')
  })

  ipcMain.on('window:confirm-close', (event) => {
    confirmCloseSenderWindow(event)
  })

  ipcMain.on('window:cancel-close', (event) => {
    const window = getSenderWindow(event)
    if (window) clearWindowCloseCheck(window)
  })

  ipcMain.on('shortcut:ai-chat-toggle', (event) => {
    const window = getSenderWindow(event)
    if (window && !window.isDestroyed()) {
      window.webContents.send('shortcut:ai-chat-toggle')
    }
  })

  ipcMain.handle('file:read-document', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return null
    return readAssociatedFilePayload(filePath)
  })

  ipcMain.handle('file:write-document', async (_event, filePath, content) => {
    if (!filePath || typeof filePath !== 'string') {
      return { ok: false, error: '无效路径' }
    }

    try {
      await fsp.writeFile(filePath, content ?? '', 'utf8')
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '无法写入文档',
      }
    }
  })

  ipcMain.handle('file:get-modified-time', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return null

    try {
      const stat = await fsp.stat(filePath)
      return { mtimeMs: stat.mtimeMs }
    } catch {
      return null
    }
  })

  ipcMain.handle('local-server:get-base-url', () => {
    return getLocalServerBaseUrl()
  })

  ipcMain.handle('file-associations:get-enabled', () => {
    return getAssociationsEnabled()
  })

  ipcMain.handle('file-associations:set-enabled', (_event, enabled) => {
    return setAssociationsEnabled(enabled)
  })

  ipcMain.handle('about:read-7zip-license', async () => {
    const licensePath = get7ZipLicensePath()

    try {
      const content = await fsp.readFile(licensePath, 'utf8')
      return { ok: true, content, path: licensePath }
    } catch (error) {
      return {
        ok: false,
        path: licensePath,
        error: error instanceof Error ? error.message : '无法读取许可证文件',
      }
    }
  })

  ipcMain.handle('about:open-7zip-license', async () => {
    const licensePath = get7ZipLicensePath()

    if (!fs.existsSync(licensePath)) {
      return { ok: false, error: '许可证文件不存在' }
    }

    const result = await shell.openPath(licensePath)
    if (result) {
      return { ok: false, error: result }
    }

    return { ok: true }
  })

  ipcMain.handle('about:open-built-in-font-license', async (_event, payload = {}) => {
    const fontId = typeof payload?.fontId === 'string' ? payload.fontId.trim() : ''
    if (!fontId) {
      return { ok: false, error: '缺少 fontId 参数' }
    }

    const licensePath = resolveBuiltInFontLicensePath(fontId)
    if (!licensePath) {
      return {
        ok: false,
        error: '未找到该字体的 LICENSE 文件，请确认 resources/fonts/built-in/ 下已放置对应许可证',
      }
    }

    const result = await shell.openPath(licensePath)
    if (result) {
      return { ok: false, error: result }
    }

    return { ok: true, path: licensePath }
  })

  ipcMain.handle('about:get-app-info', () => getAppInfo())

  ipcMain.handle('about:check-for-updates', async () => checkForUpdates())

  registerExportAiLayoutSuggestHandler(ipcMain)
}

function registerGlobalShortcuts() {
  const toggleAccelerator = 'CommandOrControl+Shift+W'
  const toggleRegistered = globalShortcut.register(toggleAccelerator, () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.webContents.send('shortcut:ai-chat-toggle')
    }
  })

  if (!toggleRegistered) {
    console.warn(`[main] Failed to register global shortcut: ${toggleAccelerator}`)
  }

  const newWindowAccelerator = 'CommandOrControl+N'
  const newWindowRegistered = globalShortcut.register(newWindowAccelerator, () => {
    createManagedWindow()
  })

  if (!newWindowRegistered) {
    console.warn(`[main] Failed to register global shortcut: ${newWindowAccelerator}`)
  }
}

function setupOpenFileHandling() {
  fileOpenController = createFileOpenController(() => mainWindow, openAssociatedFile)

  // macOS：必须在 app ready 之前注册，否则 Dock/访达双击无法捕获
  app.on('open-file', (event, filePath) => {
    fileOpenController?.handleOpenFileEvent(event, filePath)
  })
}

function getLiveWindows() {
  return BrowserWindow.getAllWindows()
}

function registerWpxProtocolClient() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(WPX_PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
      return
    }
  }

  app.setAsDefaultProtocolClient(WPX_PROTOCOL)
}

/**
 * 解析 wpx:// 回调并通过 IPC 通知渲染进程。
 * @param {string} rawUrl
 * @returns {boolean}
 */
function deliverWpxProtocolCallback(rawUrl) {
  const handled = handleAuthCallbackUrl(getLiveWindows(), rawUrl)
  if (handled) {
    showMainWindow()
  }
  return handled
}

/**
 * @param {string[]} urls
 */
function deliverWpxProtocolUrls(urls = []) {
  for (const url of urls) {
    deliverWpxProtocolCallback(url)
  }
}

function flushPendingWpxProtocolUrl() {
  if (!pendingWpxProtocolUrl) return
  const url = pendingWpxProtocolUrl
  pendingWpxProtocolUrl = null
  deliverWpxProtocolCallback(url)
}

function setupWpxProtocolHandlers() {
  // macOS：通过 open-url 接收 wpx:// 回调
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (typeof url !== 'string' || !url.startsWith('wpx://')) return

    if (app.isReady()) {
      deliverWpxProtocolCallback(url)
      return
    }

    pendingWpxProtocolUrl = url
  })
}

function setupSingleInstance() {
  if (devConfig.enabled && devConfig.disableSingleInstance) {
    console.log('[main] Single instance lock disabled for development')
    return true
  }

  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', (_event, argv) => {
    // Windows / Linux：协议回调由已运行实例通过 second-instance 接收
    deliverWpxProtocolUrls(extractProtocolUrlsFromArgv(argv))

    for (const filePath of extractAssociablePathsFromArgv(argv)) {
      openAssociatedFile(filePath)
    }
    showMainWindow()
  })

  return true
}

async function maybePromptPandocInstall() {
  const available = await checkPandocAvailable()
  if (available) return

  const flagPath = path.join(app.getPath('userData'), '.pandoc-prompt-shown')
  if (fs.existsSync(flagPath)) return

  await dialog.showMessageBox({
    type: 'info',
    title: 'Pandoc 未安装',
    message: 'WPX 文档导出需要 Pandoc',
    detail: PANDOC_INSTALL_HINT,
    buttons: ['知道了'],
  })

  await fsp.writeFile(flagPath, new Date().toISOString(), 'utf8')
}

app.setName(APP_NAME)

if (process.platform === 'win32') {
  app.setAppUserModelId('com.wpx.app')
}

// 单实例锁优先：避免多开时 wpx:// 回调被错误实例处理
if (!setupSingleInstance()) {
  process.exit(0)
}

registerWpxProtocolClient()
setupWpxProtocolHandlers()
setupOpenFileHandling()

app.whenReady().then(async () => {
  await debugBootstrap
  configureProductionSession()

  try {
    const { baseUrl } = await startLocalServer()
    console.log(`[main] Local API server ready at ${baseUrl}`)
  } catch (error) {
    console.error('[main] Failed to start local API server:', error)
    await dialog.showErrorBox(
      '本地服务启动失败',
      `无法启动导出/去背景服务：${error.message}`,
    )
  }

  registerIpcHandlers()
  registerFontIpcHandlers()
  initZipService()
  await initUserDataService()
  await initModelIpc()
  await initAuthStore()
  await initFreeQuotaIpc()
  initAuthProtocol()
  await initKnowledgeService()
  await initMemoryService()

  const initialWindows = devConfig.enabled ? devConfig.initialWindows : 1
  for (let index = 0; index < initialWindows; index += 1) {
    createManagedWindow()
  }

  createTray()
  refreshAppMenu()
  registerGlobalShortcuts()

  await maybePromptPandocInstall()

  fileOpenController.handleStartupFiles(process.argv)
  await fileOpenController.flushPendingOpenFiles()

  deliverWpxProtocolUrls(extractProtocolUrlsFromArgv(process.argv))
  flushPendingWpxProtocolUrl()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createManagedWindow()
    } else {
      showMainWindow()
    }
  })
})

let isCleaningUp = false

app.on('before-quit', async (event) => {
  if (isCleaningUp) return

  event.preventDefault()
  isCleaningUp = true
  isQuitting = true
  globalShortcut.unregisterAll()

  try {
    await stopLocalServer()
  } catch (error) {
    console.error('[main] Failed to stop local API server:', error)
  }

  app.exit(0)
})

app.on('window-all-closed', () => {
  if (trayMinimizedOnLastClose) {
    return
  }
  isQuitting = true
  app.quit()
})
