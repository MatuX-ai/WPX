export {}

declare global {
  interface Window {
    electronAPI?: {
      processType?: 'renderer'
      platform?: NodeJS.Platform
      minimize?: () => void
      maximizeRestore?: () => void
      maximize?: () => void
      unmaximize?: () => void
      isMaximized?: () => Promise<boolean>
      requestWindowList?: () => Promise<{
        windows: Array<{ id: number; title: string }>
        currentWindowId: number | null
      }>
      createWindow?: (docPath?: string) => Promise<{
        ok: boolean
        windowId?: number
        error?: 'MAX_WINDOWS' | 'UNKNOWN' | 'UNSUPPORTED'
      }>
      focusWindow?: (windowId: number) => void
      onWindowFocus?: (callback: () => void) => () => void
      onWindowBlur?: (callback: () => void) => () => void
      close?: () => void
      requestClose?: () => void
      confirmClose?: () => void
      cancelClose?: () => void
      onCloseCheck?: (callback: () => void) => () => void
      onAiChatToggle?: (callback: () => void) => () => void
      tray?: {
        hideMainWindow?: () => Promise<void>
        showMainWindow?: () => Promise<void>
        show?: () => Promise<void>
        hide?: () => Promise<void>
        setRecentDocuments?: (documents: unknown[]) => Promise<void>
      }
      app?: {
        quit?: () => Promise<void>
      }
      onOpenFile?: (
        callback: (payload: {
          path?: string
          content: string
          title?: string
          format?: object | null
          extension?: string
        }) => void,
      ) => () => void
      onOpenMarkdownFile?: (
        callback: (payload: {
          path?: string
          content: string
          title?: string
          format?: object | null
          extension?: string
        }) => void,
      ) => () => void
      onOpenArchive?: (
        callback: (payload: { archivePath: string }) => void,
      ) => () => void
      files?: {
        readDocument?: (
          filePath: string,
        ) => Promise<{
          path?: string
          content: string
          title?: string
          format?: object | null
          extension?: string
        } | null>
        getModifiedTime?: (
          filePath: string,
        ) => Promise<{ mtimeMs: number } | null>
        writeDocument?: (
          filePath: string,
          content: string,
        ) => Promise<{ ok: boolean; error?: string }>
        onOpenFile?: (
          callback: (payload: {
            path?: string
            content: string
            title?: string
            format?: object | null
            extension?: string
          }) => void,
        ) => () => void
        onOpenMarkdown?: (
          callback: (payload: {
            path?: string
            content: string
            title?: string
            format?: object | null
            extension?: string
          }) => void,
        ) => () => void
        onOpenArchive?: (
          callback: (payload: { archivePath: string }) => void,
        ) => () => void
      }
      fileAssociations?: {
        getEnabled?: () => Promise<boolean>
        setEnabled?: (enabled: boolean) => Promise<boolean>
      }
      localServer?: {
        getBaseUrl?: () => Promise<string | null>
      }
      onTrayOpenRecent?: (
        callback: (doc: { id: string; title: string; path?: string }) => void,
      ) => () => void
      onOpenSettings?: (callback: () => void) => () => void
      preferences?: {
        get?: () => Promise<Record<string, unknown>>
        set?: (partial: Record<string, unknown>) => Promise<Record<string, unknown>>
        onChanged?: (callback: (preferences: Record<string, unknown>) => void) => () => void
      }
      auth?: {
        storeToken?: (payload: {
          token: string
          refreshToken?: string
        }) => Promise<{ ok: boolean }>
        getToken?: () => Promise<{ token: string; refreshToken: string }>
        clearToken?: () => Promise<{ ok: boolean }>
        startLogin?: (payload: { state: string }) => Promise<{ ok: boolean }>
        onCallback?: (
          callback: (payload: {
            token?: string
            refreshToken?: string
            state?: string
            error?: string
            url?: string
          }) => void,
        ) => () => void
      }
      freeQuota?: {
        getStatus?: (payload: {
          isGuest?: boolean
          userId?: string | null
        }) => Promise<{
          ok: boolean
          subjectKey?: string
          isGuest?: boolean
          limit: number
          used: number
          remaining: number
          date?: string
          code?: string
        }>
        consume?: (payload: {
          isGuest?: boolean
          userId?: string | null
        }) => Promise<{
          ok: boolean
          code?: string
          subjectKey?: string
          isGuest?: boolean
          limit: number
          used: number
          remaining: number
          date?: string
        }>
        resetDeviceId?: () => Promise<{
          ok: boolean
          deviceId?: string
          previousDeviceId?: string | null
        }>
      }
      models?: {
        setApiKey?: (payload: {
          block: 'text' | 'vision'
          apiKey: string
        }) => Promise<{ hasKey: boolean; masked: string }>
        clearApiKey?: (payload: {
          block: 'text' | 'vision'
        }) => Promise<{ hasKey: boolean; masked: string }>
        getMaskedApiKey?: (payload: {
          block: 'text' | 'vision'
        }) => Promise<{ hasKey: boolean; masked: string }>
        getAllMasked?: () => Promise<{
          text: { hasKey: boolean; masked: string }
          vision: { hasKey: boolean; masked: string }
        }>
        getDecryptedApiKey?: (payload: {
          block: 'text' | 'vision'
        }) => Promise<{ apiKey: string }>
        testConnection?: (payload: {
          block?: 'text' | 'vision'
          endpoint: string
          apiKey?: string
          modelName?: string
        }) => Promise<{ ok: boolean; message: string }>
      }
      knowledge?: {
        list?: () => Promise<{ items: KnowledgeItem[] }>
        preview?: (id: string) => Promise<KnowledgePreview>
        upload?: (payload: KnowledgeUploadPayload) => Promise<{ success: boolean; item: KnowledgeItem }>
        delete?: (id: string) => Promise<{ success: boolean; id: string }>
        clearIndex?: () => Promise<{ success: boolean; cleared?: number }>
        onUpdated?: (callback: () => void) => () => void
      }
      memory?: {
        record?: (payload: MemoryRecordPayload) => Promise<{ success: boolean; templates?: SmartTemplate[] }>
        getTemplates?: () => Promise<{ templates: SmartTemplate[] }>
        regenerateTemplates?: () => Promise<{ templates: SmartTemplate[] }>
        clear?: () => Promise<{ success: boolean }>
        onTemplatesUpdated?: (
          callback: (payload: { templates: SmartTemplate[] }) => void,
        ) => () => void
      }
      about?: {
        getAppInfo?: () => Promise<{ name: string; version: string; isPackaged?: boolean }>
        checkForUpdates?: () => Promise<{
          ok: boolean
          status: 'latest' | 'available' | 'error'
          message: string
          name?: string
          version?: string
          remoteVersion?: string | null
        }>
        read7ZipLicense?: () => Promise<{
          ok: boolean
          content?: string
          path?: string
          error?: string
        }>
        open7ZipLicense?: () => Promise<{ ok: boolean; error?: string }>
        openBuiltInFontLicense?: (payload: {
          fontId: string
        }) => Promise<{ ok: boolean; path?: string; error?: string }>
      }
      zip?: {
        compress?: (payload: ZipCompressPayload) => Promise<ZipOperationResult>
        extract?: (payload: ZipExtractPayload) => Promise<ZipOperationResult>
        list?: (archivePath: string) => Promise<ZipListResult>
        cancel?: (operationId: string) => Promise<{ ok: boolean }>
        pickSavePath?: (payload?: ZipPickSavePayload) => Promise<ZipPickPathResult>
        pickDirectory?: (payload?: ZipPickDirectoryPayload) => Promise<ZipPickDirectoryResult>
        pickArchive?: (payload?: ZipPickDirectoryPayload) => Promise<ZipPickPathResult>
        onProgress?: (
          callback: (payload: ZipProgressPayload) => void,
        ) => () => void
      }
      fonts?: {
        getAll?: () => Promise<FontListResult>
        getBuiltIn?: () => Promise<FontListResult>
        getPreferences?: () => Promise<FontPreferencesResult>
        setEnabled?: (payload: FontSetEnabledPayload) => Promise<FontPreferencesResult>
        download?: (payload: FontDownloadPayload) => Promise<FontDownloadResult>
        getCommercialList?: (payload?: FontCommercialListPayload) => Promise<FontCommercialListResult>
        decryptPreview?: (payload: FontDecryptPreviewPayload) => Promise<FontDecryptPreviewResult>
        cleanupPreview?: (payload: FontCleanupPreviewPayload) => Promise<FontOperationResult>
        subsetForExport?: (payload: FontSubsetExportPayload) => Promise<FontSubsetExportResult>
        onDownloadProgress?: (
          callback: (payload: FontDownloadProgressPayload) => void,
        ) => () => void
      }
    }
    wpx?: {
      window?: Window['electronAPI']
    }
    __WPX_ELECTRON__?: boolean
    __WPX_WINDOW_ID__?: number
  }

  interface KnowledgeItem {
    id: string
    filename: string
    type: string
    source?: string
    uploadedAt: string
    charCount?: number
    parseStatus?: 'pending' | 'parsed' | 'failed'
    errorMessage?: string
  }

  interface KnowledgePreview extends KnowledgeItem {
    content: string
  }

  interface KnowledgeUploadPayload {
    filename?: string
    mimeType?: string
    data?: ArrayBuffer | Uint8Array
    url?: string
  }

  interface SmartTemplate {
    documentType: string
    count: number
    format?: {
      font?: string | null
      fontSize?: string | null
      lineHeight?: string | null
      heading?: number | null
    } | null
    habits?: Record<string, unknown>
  }

  interface MemoryRecordPayload {
    action: 'format' | 'save'
    type?: 'format' | 'save'
    documentType?: string
    format?: {
      font?: string | null
      fontSize?: string | null
      lineHeight?: string | null
      heading?: number | null
    }
  }

  interface ZipCompressPayload {
    sources: string[]
    outputPath: string
    format?: '7z' | 'zip' | 'tar'
    level?: 1 | 5 | 9
    password?: string
    archiveBaseDir?: string
    operationId?: string
  }

  interface ZipExtractPayload {
    archivePath: string
    outputDir: string
    password?: string
    files?: string[]
  }

  interface ZipOperationResult {
    ok: boolean
    operationId?: string
    outputPath?: string
    outputDir?: string
    message?: string
    name?: string
    error?: string
  }

  interface ZipArchiveEntry {
    name: string
    size: number
    compressedSize: number
    date: string
    isDirectory: boolean
  }

  interface ZipListResult {
    ok: boolean
    files?: ZipArchiveEntry[]
    message?: string
    name?: string
    error?: string
  }

  interface ZipProgressPayload {
    operationId: string
    percent: number
    currentFile?: string
  }

  interface ZipPickSavePayload {
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }

  interface ZipPickDirectoryPayload {
    defaultPath?: string
  }

  interface ZipPickPathResult {
    ok: boolean
    canceled?: boolean
    filePath?: string
  }

  interface ZipPickDirectoryResult {
    ok: boolean
    canceled?: boolean
    directoryPath?: string
  }

  interface FontInfo {
    id: string
    fontId?: string
    name: string
    family: string
    fullName: string
    path: string
    weight: number
    weightName: string
    type: string
    copyright: string | null
    source: 'built-in' | 'free' | 'commercial'
    format: 'ttf' | 'otf' | 'enc' | 'wpxfont' | 'unknown'
  }

  interface FontOperationResult {
    ok: boolean
    error?: string
    code?: string
    name?: string
  }

  interface FontListResult extends FontOperationResult {
    fonts?: FontInfo[]
  }

  interface FontPreferencesResult extends FontOperationResult {
    disabledFontIds?: string[]
    fontId?: string
    enabled?: boolean
  }

  interface FontSetEnabledPayload {
    fontId: string
    enabled?: boolean
  }

  interface FontDownloadPayload {
    url: string
    type: 'free' | 'commercial'
    fontId?: string
    userId?: string
    fileName?: string
    downloadId?: string
    meta?: Record<string, unknown>
  }

  interface FontDownloadResult extends FontOperationResult {
    downloadId?: string
    path?: string
    fonts?: FontInfo[]
    font?: FontInfo
  }

  interface FontDownloadProgressPayload {
    downloadId: string
    phase: 'start' | 'progress' | 'complete' | 'error'
    receivedBytes?: number
    totalBytes?: number
    percent?: number | null
    fileName?: string
    error?: string
  }

  interface FontCommercialListPayload {
    authToken?: string
  }

  interface FontCommercialListResult extends FontOperationResult {
    fonts?: unknown[]
    source?: string
  }

  interface FontDecryptPreviewPayload {
    fontId: string
    userId?: string
  }

  interface FontDecryptPreviewResult extends FontOperationResult {
    tempPath?: string
    fontId?: string
  }

  interface FontCleanupPreviewPayload {
    tempPath: string
  }

  interface FontSubsetExportPayload {
    fontId?: string
    path?: string
    text: string
    userId?: string
    outputPath?: string
    outputName?: string
  }

  interface FontSubsetResult {
    path: string
    size: number
    originalSize: number
    engine: 'fonttools' | 'harfbuzz' | 'fontkit'
    charCount: number
  }

  interface FontSubsetExportResult extends FontOperationResult {
    subset?: FontSubsetResult
  }
}
