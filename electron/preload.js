const { contextBridge, ipcRenderer } = require('electron')

function onChannel(channel, callback) {
  const handler = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const electronAPI = {
  /** @type {'renderer'} */
  processType: process.type,
  platform: process.platform,
  tray: {
    hideMainWindow: () => ipcRenderer.invoke('tray:hide-main-window'),
    showMainWindow: () => ipcRenderer.invoke('tray:show-main-window'),
    show: () => ipcRenderer.invoke('tray:show'),
    hide: () => ipcRenderer.invoke('tray:hide'),
    setRecentDocuments: (documents) =>
      ipcRenderer.invoke('tray:set-recent-documents', documents),
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeRestore: () => ipcRenderer.send('window:maximize-restore'),
  maximize: () => ipcRenderer.send('window:maximize'),
  unmaximize: () => ipcRenderer.send('window:unmaximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  requestWindowList: () => ipcRenderer.invoke('window:list-request'),
  createWindow: (docPath) => ipcRenderer.invoke('window:create', docPath),
  focusWindow: (windowId) => ipcRenderer.send('window:focus-other', windowId),
  close: () => ipcRenderer.send('window:close'),
  requestClose: () => ipcRenderer.send('window:request-close'),
  confirmClose: () => ipcRenderer.send('window:confirm-close'),
  cancelClose: () => ipcRenderer.send('window:cancel-close'),
  onCloseCheck: (callback) => onChannel('window:close-check', callback),
  onAiChatToggle: (callback) => onChannel('shortcut:ai-chat-toggle', callback),
  onWindowFocus: (callback) => onChannel('window:focus', callback),
  onWindowBlur: (callback) => onChannel('window:blur', callback),
  onOpenFile: (callback) => onChannel('file:open', callback),
  onOpenMarkdownFile: (callback) => onChannel('file:open', callback),
  onOpenArchive: (callback) => onChannel('file:open-archive', callback),
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  files: {
    readDocument: (filePath) => ipcRenderer.invoke('file:read-document', filePath),
    writeDocument: (filePath, content) =>
      ipcRenderer.invoke('file:write-document', filePath, content),
    getModifiedTime: (filePath) => ipcRenderer.invoke('file:get-modified-time', filePath),
    convertDocx: (filePath) => ipcRenderer.invoke('file:convert-docx', filePath),
    onOpenFile: (callback) => onChannel('file:open', callback),
    onOpenMarkdown: (callback) => onChannel('file:open', callback),
    onOpenArchive: (callback) => onChannel('file:open-archive', callback),
  },
  fileAssociations: {
    getEnabled: () => ipcRenderer.invoke('file-associations:get-enabled'),
    setEnabled: (enabled) => ipcRenderer.invoke('file-associations:set-enabled', enabled),
  },
  onTrayOpenRecent: (callback) => onChannel('tray:open-recent', callback),
  onOpenSettings: (callback) => onChannel('app:open-settings', callback),
  localServer: {
    getBaseUrl: () => ipcRenderer.invoke('local-server:get-base-url'),
  },
  preferences: {
    get: () => ipcRenderer.invoke('data:preferences:get'),
    set: (partial) => ipcRenderer.invoke('data:preferences:set', partial),
    onChanged: (callback) => onChannel('data:preferences:changed', callback),
  },
  auth: {
    // 凭据持久化：仍由 Electron 主进程的 auth-store.js 加密保存到本地磁盘
    storeToken: (payload) => ipcRenderer.invoke('auth:store-token', payload),
    getToken: () => ipcRenderer.invoke('auth:get-token'),
    clearToken: () => ipcRenderer.invoke('auth:clear-token')
    // 注意：旧的 auth.startLogin / auth.onCallback 已移除。
    // WPX 改为应用内嵌 AuthModal 登录（POST prowpx.com/api/auth/login），
    // 不再走外部浏览器回调。
  },
  freeQuota: {
    getStatus: (payload) => ipcRenderer.invoke('free-quota:get-status', payload),
    check: (payload) => ipcRenderer.invoke('free-quota:check', payload),
    consumeTokens: (payload) => ipcRenderer.invoke('free-quota:consume-tokens', payload),
    resetDeviceId: () => ipcRenderer.invoke('free-quota:reset-device-id'),
  },
  models: {
    setApiKey: (payload) => ipcRenderer.invoke('models:api-key:set', payload),
    clearApiKey: (payload) => ipcRenderer.invoke('models:api-key:clear', payload),
    getMaskedApiKey: (payload) => ipcRenderer.invoke('models:api-key:get-masked', payload),
    getAllMasked: () => ipcRenderer.invoke('models:api-key:get-all-masked'),
    getDecryptedApiKey: (payload) => ipcRenderer.invoke('models:api-key:get-decrypted', payload),
    testConnection: (payload) => ipcRenderer.invoke('models:test-connection', payload),
  },
  knowledge: {
    list: () => ipcRenderer.invoke('knowledge:list'),
    preview: (id) => ipcRenderer.invoke('knowledge:preview', id),
    fetchUrlPreview: (url) => ipcRenderer.invoke('knowledge:fetch-url-preview', url),
    upload: (payload) => ipcRenderer.invoke('knowledge:upload', payload),
    delete: (id) => ipcRenderer.invoke('knowledge:delete', id),
    clearIndex: () => ipcRenderer.invoke('knowledge:clear-index'),
    search: (query, topK) => ipcRenderer.invoke('knowledge:search', { query, topK }),
    getVersions: (docId) => ipcRenderer.invoke('knowledge:versions', docId),
    getVersionContent: (docId, verId) => ipcRenderer.invoke('knowledge:version-content', docId, verId),
    rollback: (docId, verId) => ipcRenderer.invoke('knowledge:rollback', docId, verId),
    fulltextSearch: (query, limit) => ipcRenderer.invoke('knowledge:fulltext-search', { query, limit }),
    getTags: () => ipcRenderer.invoke('knowledge:tags'),
    getIndex: () => ipcRenderer.invoke('knowledge:index'),
    getLinks: (docId) => ipcRenderer.invoke('knowledge:links', docId),
    onUpdated: (callback) => onChannel('data:knowledge:updated', callback),
  },
  memory: {
    record: (payload) => ipcRenderer.invoke('data:memory:record', payload),
    getTemplates: () => ipcRenderer.invoke('memory:templates:get'),
    regenerateTemplates: () => ipcRenderer.invoke('memory:templates:regenerate'),
    clear: () => ipcRenderer.invoke('memory:clear'),
    onTemplatesUpdated: (callback) => onChannel('data:templates:updated', callback),
  },
  about: {
    getAppInfo: () => ipcRenderer.invoke('about:get-app-info'),
    checkForUpdates: () => ipcRenderer.invoke('about:check-for-updates'),
    read7ZipLicense: () => ipcRenderer.invoke('about:read-7zip-license'),
    open7ZipLicense: () => ipcRenderer.invoke('about:open-7zip-license'),
    openBuiltInFontLicense: (payload) =>
      ipcRenderer.invoke('about:open-built-in-font-license', payload),
  },
  zip: {
    compress: (payload) => ipcRenderer.invoke('zip:compress', payload),
    extract: (payload) => ipcRenderer.invoke('zip:extract', payload),
    list: (payload) =>
      ipcRenderer.invoke(
        'zip:list',
        typeof payload === 'string' ? { archivePath: payload } : payload,
      ),
    cancel: (operationId) => ipcRenderer.invoke('zip:cancel', operationId),
    pickSavePath: (payload) => ipcRenderer.invoke('zip:pick-save-path', payload),
    pickDirectory: (payload) => ipcRenderer.invoke('zip:pick-directory', payload),
    pickArchive: (payload) => ipcRenderer.invoke('zip:pick-archive', payload),
    onProgress: (callback) => onChannel('zip:progress', callback),
  },
  fonts: {
    getAll: () => ipcRenderer.invoke('font:get-all'),
    getBuiltIn: () => ipcRenderer.invoke('font:get-built-in'),
    checkRecommended: (payload) => ipcRenderer.invoke('font:check-recommended', payload),
    getPreferences: () => ipcRenderer.invoke('font:get-preferences'),
    setEnabled: (payload) => ipcRenderer.invoke('font:set-enabled', payload),
    download: (payload) => ipcRenderer.invoke('font:download', payload),
    getCommercialList: (payload) => ipcRenderer.invoke('font:get-commercial-list', payload),
    decryptPreview: (payload) => ipcRenderer.invoke('font:decrypt-preview', payload),
    cleanupPreview: (payload) => ipcRenderer.invoke('font:cleanup-preview', payload),
    subsetForExport: (payload) => ipcRenderer.invoke('font:subset-for-export', payload),
    onDownloadProgress: (callback) => onChannel('font:download-progress', callback),
  },
  jcode: {
    // 探测本地安装（jcode 可执行文件 / 版本 / 路径）
    detect: () => ipcRenderer.invoke('jcode:detect'),
    // 当前运行状态（state / pid / port / lastError）
    getStatus: () => ipcRenderer.invoke('jcode:get-status'),
    // 启动 / 停止引擎
    start: () => ipcRenderer.invoke('jcode:start'),
    stop: () => ipcRenderer.invoke('jcode:stop'),
    // 偏好读写
    getSettings: () => ipcRenderer.invoke('jcode:get-settings'),
    setSettings: (partial) => ipcRenderer.invoke('jcode:set-settings', partial),
    // 调用适配层（jcode-routes），主进程内部转 jcode 子进程
    callSwarm: (payload) => ipcRenderer.invoke('jcode:call-swarm', payload),
    stream: (payload) => ipcRenderer.invoke('jcode:stream', payload),
    // 清理本地记忆文件
    clearMemory: () => ipcRenderer.invoke('jcode:clear-memory'),
    backupMemory: () => ipcRenderer.invoke('jcode:backup-memory'),
    restoreMemory: () => ipcRenderer.invoke('jcode:restore-memory'),
    listBackups: () => ipcRenderer.invoke('jcode:list-backups'),
    // 标记「安装引导提示」已展示，避免重复打扰
    markInstallHintShown: () => ipcRenderer.invoke('jcode:mark-install-hint-shown'),
    // 订阅 / 取消订阅状态广播
    onStatusChanged: (callback) => onChannel('jcode:status-changed', callback),
    onStreamEvent: (callback) => onChannel('jcode:stream-event', callback),
    onSettingsChanged: (callback) => onChannel('jcode:settings-changed', callback),
    offStatusChanged: (callback) => {
      if (typeof callback !== 'function') return
      ipcRenderer.removeListener('jcode:status-changed', callback)
    },
    offStreamEvent: (callback) => {
      if (typeof callback !== 'function') return
      ipcRenderer.removeListener('jcode:stream-event', callback)
    },
    offSettingsChanged: (callback) => {
      if (typeof callback !== 'function') return
      ipcRenderer.removeListener('jcode:settings-changed', callback)
    },
  },
  shell: {
    // 用于在桌面端用系统默认浏览器打开外部链接
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
contextBridge.exposeInMainWorld('wpx', { window: electronAPI })
