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
  files: {
    readDocument: (filePath) => ipcRenderer.invoke('file:read-document', filePath),
    writeDocument: (filePath, content) =>
      ipcRenderer.invoke('file:write-document', filePath, content),
    getModifiedTime: (filePath) => ipcRenderer.invoke('file:get-modified-time', filePath),
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
    storeToken: (payload) => ipcRenderer.invoke('auth:store-token', payload),
    getToken: () => ipcRenderer.invoke('auth:get-token'),
    clearToken: () => ipcRenderer.invoke('auth:clear-token'),
    startLogin: (payload) => ipcRenderer.invoke('auth:start-login', payload),
    onCallback: (callback) => onChannel('auth:callback', callback),
  },
  freeQuota: {
    getStatus: (payload) => ipcRenderer.invoke('free-quota:get-status', payload),
    consume: (payload) => ipcRenderer.invoke('free-quota:consume', payload),
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
    upload: (payload) => ipcRenderer.invoke('knowledge:upload', payload),
    delete: (id) => ipcRenderer.invoke('knowledge:delete', id),
    clearIndex: () => ipcRenderer.invoke('knowledge:clear-index'),
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
    getPreferences: () => ipcRenderer.invoke('font:get-preferences'),
    setEnabled: (payload) => ipcRenderer.invoke('font:set-enabled', payload),
    download: (payload) => ipcRenderer.invoke('font:download', payload),
    getCommercialList: (payload) => ipcRenderer.invoke('font:get-commercial-list', payload),
    decryptPreview: (payload) => ipcRenderer.invoke('font:decrypt-preview', payload),
    cleanupPreview: (payload) => ipcRenderer.invoke('font:cleanup-preview', payload),
    subsetForExport: (payload) => ipcRenderer.invoke('font:subset-for-export', payload),
    onDownloadProgress: (callback) => onChannel('font:download-progress', callback),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
contextBridge.exposeInMainWorld('wpx', { window: electronAPI })
