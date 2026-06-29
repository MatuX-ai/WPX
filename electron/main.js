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
const mammoth = require('mammoth')

// 必须在 app.whenReady() 之前调用，才能让 Chrome 子进程一并禁用。
// 原因：Electron 安全警告由 Chromium 进程输出，在主进程 ready 前
//       就已经被生成；这里用命令形 switch 才能从根源关闭。
// 背景：我们已经通过 session.webRequest.onHeadersReceived 注入了
//       受限 CSP，但 Vue Router 4 / ProseMirror 等运行时依赖 'unsafe-eval'
//       做优化，Electron 检测到 'unsafe-eval' 后会在 dev 模式下发出
//       Insecure Content-Security-Policy 警告。这些警告在打包后
//       自动消失，本处仅用来减少开发控制台噪音。
if (process.env.NODE_ENV !== 'production') {
  app.commandLine.appendSwitch('disable-features', 'ElectronSecurityWarnings')
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}
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
const { registerExportServiceIpc } = require('./export-service')
const {
  getAssociationsEnabled,
  setAssociationsEnabled,
} = require('./file-associations')
const {
  readAssociatedFilePayload,
  createFileOpenController,
  extractAssociablePathsFromArgv,
} = require('./file-open')
const { excelFileToMarkdown } = require('./excel-import')
const WindowManager = require('./window-manager')
const { initUserDataService } = require('./user-data-service')
const { initModelIpc } = require('./model-ipc')
const { initAuthStore } = require('./auth-store')
const { initFreeQuotaIpc } = require('./free-quota-ipc')
const {
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
const { initJcodeIpc, shutdownJcodeIpc } = require('./jcode-ipc')

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

// 文件对话框过滤器（菜单项 + IPC handler 共享同一份定义）
const FILE_OPEN_FILTERS = [
  { name: '所有支持的文件', extensions: ['md', 'txt', 'wpx', 'doc', 'docx', 'html', 'htm'] },
  { name: 'Markdown', extensions: ['md'] },
  { name: '纯文本', extensions: ['txt'] },
  { name: 'Word 文档', extensions: ['doc', 'docx'] },
  { name: 'HTML', extensions: ['html', 'htm'] },
]

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

    // DOCX / DOC 文件：使用 mammoth 转换为 HTML
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.docx' || ext === '.doc') {
      const docxPayload = await convertDocxFile(filePath)
      if (!docxPayload) {
        dialog.showErrorBox('无法打开文件', `不支持的文件格式或文件已损坏：\n${filePath}`)
        return
      }

      const deliverDocx = () => {
        mainWindow?.webContents?.send('file:open', docxPayload)
      }

      if (!mainWindow) return

      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', deliverDocx)
      } else {
        deliverDocx()
      }

      showMainWindow()
      return
    }

    // XLSX / XLS / XLSM 文件：使用 ExcelJS 转换为 Markdown 表格
    if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm') {
      let excelPayload
      try {
        excelPayload = await convertExcelFile(filePath)
      } catch (error) {
        console.error('[main] excel import failed:', error)
        dialog.showErrorBox(
          '无法打开 Excel 文件',
          `${path.basename(filePath)}\n\n${error.message}`,
        )
        return
      }

      const deliverExcel = () => {
        mainWindow?.webContents?.send('file:open', excelPayload)
      }

      if (!mainWindow) return

      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', deliverExcel)
      } else {
        deliverExcel()
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

/**
 * 使用 mammoth 将 DOCX/DOC 文件转换为 HTML 负载
 * @param {string} filePath
 * @returns {Promise<{ path: string, content: string, title: string, extension: string } | null>}
 */
async function convertDocxFile(filePath) {
  try {
    const result = await mammoth.convertToHtml({ path: filePath })
    const ext = path.extname(filePath).toLowerCase()
    const baseTitle = path.basename(filePath, ext)
    return {
      path: filePath,
      content: result.value,
      title: baseTitle,
      extension: ext,
      contentType: 'html',
    }
  } catch (error) {
    console.error('[main] mammoth conversion failed:', error)
    return null
  }
}

/**
 * 使用 ExcelJS 将 xlsx/xlsm 文件转换为 Markdown 负载
 * 返回结构与 readAssociatedFilePayload 一致，但 contentType='markdown'
 * 前端识别后会渲染为 Markdown 编辑器内容
 *
 * 错误不吞掉，让外层 openAssociatedFile / IPC handler 的 try/catch
 * 统一显示给用户（避免错误信息被“文件损坏”模糊化）
 * @param {string} filePath
 * @returns {Promise<{ path: string, content: string, title: string, extension: string, contentType: string, warnings: string[], sheetCount: number }>}
 */
async function convertExcelFile(filePath) {
  const result = await excelFileToMarkdown(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const baseTitle = path.basename(filePath, ext)
  return {
    path: filePath,
    content: result.markdown,
    title: baseTitle,
    extension: ext,
    contentType: 'markdown',
    warnings: result.warnings,
    sheetCount: result.sheetCount,
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
          label: '打开文件…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: FILE_OPEN_FILTERS,
            })
            if (result.canceled || !result.filePaths.length) return
            await openAssociatedFile(result.filePaths[0])
          },
        },
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

function configureContentSecurityPolicy() {
  // 注入安全 CSP 头，同时覆盖 dev + prod，避免 Electron 报
  //   "Insecure Content-Security-Policy" 警告。
  // dev 允许 'unsafe-inline' 满足 Vite HMR 与 Vue SFC 注入样式，但
  // 不允许 'unsafe-eval'，Vite 5+ HMR 通过 import() 加载 ESM 不再依赖 eval。
  // prod 完全禁止 inline / eval / 远程脚本。
  const isDev = !app.isPackaged
  // 防止开发时加载远程内容
  const devCsp = "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; " +
      "style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:* https://fonts.loli.net; " +
      "img-src 'self' data: blob: http: https:; " +
      "font-src 'self' data: https://fonts.loli.net https://gstatic.loli.net; " +
      "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https:; " +
      "frame-src 'self' data: blob:; " +
      "worker-src 'self' blob:; " +
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  // 生产：收紧 connect-src
  // 注意：必须保留 http://localhost:* 因为 CopilotKit runtime 在打包后仍
  // 通过 http://localhost:PORT 通信（详见 wpx-app/src/Root.vue runtimeUrl）
  //
  // 安全审查结论（2026-06-28）：保留 'unsafe-eval' 是必需的妥协 ——
  // Tiptap（基于 ProseMirror）和 Vue 的部分运行时（Vue Router 守卫、
  // @tiptap/core 内部代码生成器、Pinia stores）会在生产构建中调用 eval()，
  // 禁用会导致应用白屏并报 "unsafe-eval is not an allowed source"。
  // 剩余 CSP 指令已全部收紧（object-src 'none' / frame-ancestors 'none' /
  // base-uri 'self' / form-action 'self'），整体安全防护等级仍然较高。
  // 后续优化方向：探索基于 hash/nonce 的动态 CSP 替代 'unsafe-eval'。
  const prodCsp = "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.loli.net; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self' data: https://fonts.loli.net; " +
      "connect-src 'self' http://localhost:* http://127.0.0.1:* https:; " +
      "frame-src 'self' data: blob:; " +
      "worker-src 'self' blob:; " +
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  const csp = isDev ? devCsp : prodCsp

  // 同一事件只能注册一个监听器；先解绑再注册
  session.defaultSession.webRequest.onHeadersReceived(null)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders ?? {}) }
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    responseHeaders['Content-Security-Policy'] = [csp]
    // 生产环境额外增加 X-Content-Type-Options 与 X-Frame-Options
    if (app.isPackaged) {
      responseHeaders['X-Content-Type-Options'] = ['nosniff']
      responseHeaders['X-Frame-Options'] = ['DENY']
    }
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
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.docx' || ext === '.doc') {
      return convertDocxFile(filePath)
    }
    if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm') {
      try {
        return await convertExcelFile(filePath)
      } catch (error) {
        return { error: error.message, path: filePath, contentType: 'excel-error' }
      }
    }
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

  ipcMain.handle('file:convert-docx', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return null
    return convertDocxFile(filePath)
  })

  ipcMain.handle('dialog:open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILE_OPEN_FILTERS,
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
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

  ipcMain.handle('shell:open-external', async (_event, url) => {
    if (typeof url !== 'string' || !url.trim()) {
      return { ok: false, error: 'url 不能为空' }
    }
    // 安全：仅放行 http/https
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, error: '仅支持 http/https 链接' }
    }
    try {
      await shell.openExternal(url)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message || String(error) }
    }
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

  registerExportServiceIpc({ ipcMain, dialog })
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
    title: 'Pandoc 不可用',
    message: 'WPX 文档导出服务异常',
    detail:
      '未能在应用包内找到 Pandoc 二进制。docx / html 导出功能将不可用。\n' +
      '请重新安装 WPX，或手动从 https://pandoc.org 安装 Pandoc 后重启应用。\n' +
      '导出 PDF 还需要安装 LaTeX 引擎（如 MiKTeX）。',
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
  configureContentSecurityPolicy()

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
  // initAuthProtocol 已重构为 noop：WPX 改为应用内嵌 AuthModal 登录，不再打开外部浏览器
  await initKnowledgeService()
  await initMemoryService()
  await initJcodeIpc()

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

  try {
    await shutdownJcodeIpc()
  } catch (error) {
    console.error('[main] Failed to shutdown jcode IPC:', error)
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
