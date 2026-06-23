/**
 * Electron 主进程 — 系统托盘逻辑
 * ---------------------------------------------------------------------------
 * 本文件供桌面端打包时使用，在 electron/main.js 中引入：
 *
 *   import { createAppTray } from '../src/electron/tray.js'
 *
 *   app.whenReady().then(() => {
 *     const mainWindow = createMainWindow()
 *     const tray = createAppTray(mainWindow, {
 *       onNewDocument: () => mainWindow.webContents.send('tray:new-document'),
 *       onOpenRecent: (doc) => mainWindow.webContents.send('tray:open-recent', doc),
 *       onExit: () => app.quit(),
 *     })
 *   })
 *
 * preload.js 需暴露 window.electronAPI.tray：
 *
 *   tray: {
 *     hideMainWindow: () => ipcRenderer.invoke('tray:hide-main-window'),
 *     showMainWindow: () => ipcRenderer.invoke('tray:show-main-window'),
 *     show: () => ipcRenderer.invoke('tray:show'),
 *     hide: () => ipcRenderer.invoke('tray:hide'),
 *   },
 *   app: {
 *     quit: () => ipcRenderer.invoke('app:quit'),
 *   }
 *
 * ---------------------------------------------------------------------------
 */

// import { app, Menu, Tray, nativeImage } from 'electron'
// import path from 'node:path'

/** @typedef {{ id: string, title: string, path?: string }} TrayRecentDocument */

/**
 * @typedef {object} TrayOptions
 * @property {string} [iconPath] 托盘图标路径（.ico / .png / .Template.png）
 * @property {string} [tooltip] 托盘 hover 提示
 * @property {TrayRecentDocument[]} [recentDocuments] 最近文档列表
 * @property {() => void} [onNewDocument] 菜单「新建文档」
 * @property {(doc: TrayRecentDocument) => void} [onOpenRecent] 菜单「最近文档」子项
 * @property {() => void} [onExit] 菜单「退出」
 * @property {() => void} [onClick] 左键单击托盘图标（通常用于恢复主窗口）
 */

/**
 * 构建托盘右键菜单
 * @param {TrayOptions} options
 * @returns {import('electron').Menu}
 */
export function buildTrayContextMenu(options = {}) {
  // const {
  //   recentDocuments = [],
  //   onNewDocument,
  //   onOpenRecent,
  //   onExit,
  // } = options
  //
  // const recentSubmenu = recentDocuments.length
  //   ? recentDocuments.map((doc) => ({
  //       label: doc.title,
  //       click: () => onOpenRecent?.(doc),
  //     }))
  //   : [{ label: '暂无最近文档', enabled: false }]
  //
  // return Menu.buildFromTemplate([
  //   { label: '新建文档', click: () => onNewDocument?.() },
  //   { label: '最近文档', submenu: recentSubmenu },
  //   { type: 'separator' },
  //   { label: '退出', click: () => onExit?.() },
  // ])

  throw new Error('[electron/tray] buildTrayContextMenu 仅在 Electron 主进程中可用')
}

/**
 * 创建系统托盘并在主窗口最小化时保持应用运行
 * @param {import('electron').BrowserWindow} mainWindow
 * @param {TrayOptions} [options]
 * @returns {import('electron').Tray}
 */
export function createAppTray(mainWindow, options = {}) {
  // const iconPath = options.iconPath ?? path.join(__dirname, '../public/favicon.ico')
  // const tray = new Tray(nativeImage.createFromPath(iconPath))
  //
  // tray.setToolTip(options.tooltip ?? 'WPX 智能文档')
  //
  // const refreshMenu = (recentDocuments = []) => {
  //   tray.setContextMenu(
  //     buildTrayContextMenu({
  //       ...options,
  //       recentDocuments,
  //     }),
  //   )
  // }
  //
  // refreshMenu(options.recentDocuments)
  //
  // tray.on('click', () => {
  //   if (options.onClick) {
  //     options.onClick()
  //     return
  //   }
  //   if (!mainWindow.isVisible()) {
  //     mainWindow.show()
  //     mainWindow.focus()
  //   }
  // })
  //
  // // IPC：渲染进程最小化到托盘
  // ipcMain.handle('tray:hide-main-window', () => {
  //   mainWindow.hide()
  // })
  //
  // ipcMain.handle('tray:show-main-window', () => {
  //   mainWindow.show()
  //   mainWindow.focus()
  // })
  //
  // ipcMain.handle('tray:show', () => {
  //   tray.setVisible?.(true) // Electron 22+；旧版 tray 创建后即显示
  // })
  //
  // return {
  //   tray,
  //   refreshMenu,
  // }

  void mainWindow
  void options
  throw new Error('[electron/tray] createAppTray 仅在 Electron 主进程中可用')
}

/**
 * 主窗口 close 事件：默认最小化到托盘而非退出（Windows / Linux 常见行为）
 * @param {import('electron').BrowserWindow} mainWindow
 * @param {import('electron').Tray} tray
 */
export function bindCloseToTray(mainWindow, tray) {
  // mainWindow.on('close', (event) => {
  //   if (app.isQuitting) return
  //   event.preventDefault()
  //   mainWindow.hide()
  //   tray.displayBalloon?.({
  //     title: 'WPX',
  //     content: '应用已收起到系统托盘',
  //   })
  // })
  //
  // app.on('before-quit', () => {
  //   app.isQuitting = true
  // })

  void mainWindow
  void tray
}
