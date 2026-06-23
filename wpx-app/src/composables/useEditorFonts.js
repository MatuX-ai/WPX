import { computed, onBeforeUnmount, ref } from 'vue'
import { ONLINE_FREE_FONTS } from '@/constants/onlineFonts'
import { SYSTEM_FONTS } from '@/constants/systemFonts'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useToast } from '@/composables/useToast'
import {
  getFontDownloadProgress,
  isFontDownloadFailed,
  isFontDownloading,
  useFontDownloader,
} from '@/composables/useFontDownloader'

/** @typedef {'installed' | 'online' | 'commercial' | 'system'} FontGroupKey */
/** @typedef {'built-in' | 'free' | 'commercial' | 'system' | 'online'} FontItemKind */
/** @typedef {'idle' | 'loading' | 'ready' | 'error'} FontPreviewStatus */

/**
 * @typedef {Object} FontSelectItem
 * @property {string} id
 * @property {string} name
 * @property {FontGroupKey} group
 * @property {FontItemKind} kind
 * @property {string | null} badge
 * @property {string | null} badgeTitle
 * @property {string} cssFamily
 * @property {string} [path]
 * @property {string} [fontId]
 * @property {string} [downloadUrl]
 * @property {string} [fileName]
 * @property {boolean} [needsDownload]
 */

const DEFAULT_PREVIEW_FONT = 'inherit'
const PREVIEW_CONCURRENCY = 3

const registeredFaces = new Set()
/** @type {Map<string, Promise<string>>} */
const fontLoadPromises = new Map()
/** @type {Set<string>} */
const previewTempPaths = new Set()

function getUserId() {
  if (typeof window === 'undefined') return 'local-user'
  return window.localStorage.getItem('wpx-user-id') || 'local-user'
}

function pathToFileUrl(filePath) {
  if (!filePath) return ''
  if (filePath.startsWith('file://')) return filePath
  const normalized = filePath.replace(/\\/g, '/')
  return encodeURI(`file:///${normalized.replace(/^\/+/, '')}`)
}

function buildCssFamily(fontId) {
  return `'WPX-${fontId}', sans-serif`
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function mapInstalledFont(font) {
  const fontId = font.fontId || font.id?.replace(/^[^:]+:\s*/, '') || font.family
  return {
    id: font.id,
    fontId,
    name: font.name || font.family,
    path: font.path,
    source: font.source,
    familyKey: normalizeName(font.family || font.name),
  }
}

/**
 * @param {string} fontId
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function loadFontFaceAsync(fontId, filePath) {
  const normalizedFontId = String(fontId || '').trim()
  if (!normalizedFontId || !filePath) {
    throw new Error('字体加载参数无效')
  }

  const styleId = `wpx-font-face-${normalizedFontId}`
  if (registeredFaces.has(styleId)) {
    return buildCssFamily(normalizedFontId)
  }

  const existingPromise = fontLoadPromises.get(normalizedFontId)
  if (existingPromise) {
    return existingPromise
  }

  const loadPromise = (async () => {
    const familyName = `WPX-${normalizedFontId}`
    const src = pathToFileUrl(filePath)

    if (typeof FontFace !== 'undefined' && document.fonts) {
      const face = new FontFace(familyName, `url('${src}')`, { display: 'swap' })
      await face.load()
      document.fonts.add(face)
    } else {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `@font-face { font-family: '${familyName}'; src: url('${src}'); font-display: swap; }`
      document.head.appendChild(style)
    }

    registeredFaces.add(styleId)
    return buildCssFamily(normalizedFontId)
  })()

  fontLoadPromises.set(normalizedFontId, loadPromise)

  try {
    return await loadPromise
  } finally {
    fontLoadPromises.delete(normalizedFontId)
  }
}

async function runWithConcurrency(tasks, limit = PREVIEW_CONCURRENCY) {
  if (tasks.length === 0) return

  const queue = [...tasks]
  const workerCount = Math.min(limit, queue.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const task = queue.shift()
        if (task) {
          await task()
        }
      }
    }),
  )
}

export function useEditorFonts() {
  const toast = useToast()
  const { download: downloadFontByUrl, activeDownloadId } = useFontDownloader()
  const loading = ref(false)
  /** @type {import('vue').Ref<FontSelectItem[]>} */
  const fontItems = ref([])
  /** @type {import('vue').Ref<Array<{ key: FontGroupKey, items: FontSelectItem[] }>>} */
  const fontGroups = ref([])
  /** @type {import('vue').Ref<Record<string, FontPreviewStatus>>} */
  const previewStatus = ref({})

  function setPreviewStatus(itemId, status) {
    previewStatus.value = {
      ...previewStatus.value,
      [itemId]: status,
    }
  }

  function buildGroups(items) {
    /** @type {Record<FontGroupKey, FontSelectItem[]>} */
    const buckets = {
      installed: [],
      online: [],
      commercial: [],
      system: [],
    }

    for (const item of items) {
      buckets[item.group]?.push(item)
    }

    return [
      { key: 'installed', items: buckets.installed },
      { key: 'online', items: buckets.online },
      { key: 'commercial', items: buckets.commercial },
      { key: 'system', items: buckets.system },
    ].filter((group) => group.items.length > 0)
  }

  function markSystemFontsReady(items) {
    const next = { ...previewStatus.value }
    for (const item of items) {
      if (item.kind === 'system') {
        next[item.id] = 'ready'
      }
    }
    previewStatus.value = next
  }

  async function loadFonts() {
    loading.value = true

    try {
      /** @type {FontSelectItem[]} */
      const items = []

      if (!isElectron() || !getElectronAPI()?.fonts?.getAll) {
        fontItems.value = SYSTEM_FONTS.map((font) => ({
          id: font.id,
          name: font.name,
          group: 'system',
          kind: 'system',
          badge: '⚠️',
          badgeTitle: '此字体可能不可商用',
          cssFamily: font.cssFamily,
        }))
        fontGroups.value = buildGroups(fontItems.value)
        markSystemFontsReady(fontItems.value)
        return
      }

      const api = getElectronAPI()
      const [allResult, commercialResult, prefsResult] = await Promise.all([
        api.fonts.getAll(),
        api.fonts.getCommercialList?.({}) ?? Promise.resolve({ ok: false }),
        api.fonts.getPreferences?.() ?? Promise.resolve({ ok: false }),
      ])

      const disabledFontIds = new Set(
        prefsResult?.ok && Array.isArray(prefsResult.disabledFontIds)
          ? prefsResult.disabledFontIds
          : [],
      )

      const isFontEnabled = (fontRecordId) => !disabledFontIds.has(fontRecordId)

      const installedFonts = allResult?.ok && Array.isArray(allResult.fonts) ? allResult.fonts : []
      const installed = installedFonts.map(mapInstalledFont)
      const installedIds = new Set(installed.map((font) => font.fontId))
      const installedNames = new Set(installed.map((font) => font.familyKey))

      for (const font of installed.filter((item) => item.source === 'built-in' || item.source === 'free')) {
        if (!isFontEnabled(font.id)) continue

        items.push({
          id: font.id,
          name: font.name,
          group: 'installed',
          kind: font.source === 'built-in' ? 'built-in' : 'free',
          badge: null,
          badgeTitle: null,
          cssFamily: buildCssFamily(font.fontId),
          path: font.path,
          fontId: font.fontId,
        })
      }

      for (const catalogFont of ONLINE_FREE_FONTS) {
        const alreadyDownloaded =
          installedIds.has(catalogFont.id) ||
          installedNames.has(normalizeName(catalogFont.name))

        if (alreadyDownloaded) continue

        items.push({
          id: catalogFont.id,
          name: catalogFont.name,
          group: 'online',
          kind: 'online',
          badge: '↓',
          badgeTitle: '点击下载字体',
          cssFamily: buildCssFamily(catalogFont.id),
          fontId: catalogFont.id,
          downloadUrl: catalogFont.downloadUrl,
          fileName: catalogFont.fileName,
          needsDownload: true,
        })
      }

      const commercialCatalog =
        commercialResult?.ok && Array.isArray(commercialResult.fonts)
          ? commercialResult.fonts
          : []

      const installedCommercial = new Map(
        installed.filter((item) => item.source === 'commercial').map((item) => [item.fontId, item]),
      )

      const commercialIds = new Set()

      for (const font of commercialCatalog) {
        commercialIds.add(font.id)
        const commercialItemId = `commercial:${font.id}`
        if (!isFontEnabled(commercialItemId)) continue

        const installedMatch = installedCommercial.get(font.id)
        items.push({
          id: commercialItemId,
          name: font.name,
          group: 'commercial',
          kind: 'commercial',
          badge: '⚡',
          badgeTitle: '导出时按字扣 Token',
          cssFamily: buildCssFamily(font.id),
          fontId: font.id,
          path: installedMatch?.path,
        })
      }

      for (const font of installed.filter((item) => item.source === 'commercial')) {
        if (commercialIds.has(font.fontId)) continue
        if (!isFontEnabled(font.id)) continue

        items.push({
          id: font.id,
          name: font.name,
          group: 'commercial',
          kind: 'commercial',
          badge: '⚡',
          badgeTitle: '导出时按字扣 Token',
          cssFamily: buildCssFamily(font.fontId),
          fontId: font.fontId,
          path: font.path,
        })
      }

      for (const font of SYSTEM_FONTS) {
        items.push({
          id: font.id,
          name: font.name,
          group: 'system',
          kind: 'system',
          badge: '⚠️',
          badgeTitle: '此字体可能不可商用',
          cssFamily: font.cssFamily,
        })
      }

      fontItems.value = items
      fontGroups.value = buildGroups(items)
      markSystemFontsReady(items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载字体列表失败')
      fontItems.value = []
      fontGroups.value = []
    } finally {
      loading.value = false
    }
  }

  async function downloadFontItem(item) {
    if (!item?.downloadUrl) {
      throw new Error('当前环境无法下载字体')
    }

    await downloadFontByUrl(item.fontId || item.id, item.downloadUrl, {
      downloadId: item.id,
      fileName: item.fileName || `${item.fontId || item.id}.ttf`,
      fontName: item.name,
      type: 'free',
    })

    await loadFonts()
  }

  /**
   * @param {FontSelectItem} item
   * @returns {{ kind: 'loading' | 'failed' | 'download' | 'badge', value?: string, title?: string | null } | null}
   */
  function getFontDownloadBadge(item) {
    if (!item) return null

    if (isFontDownloading(item.id)) {
      return {
        kind: 'loading',
        title: `下载中 ${getFontDownloadProgress(item.id)}%`,
      }
    }

    if (isFontDownloadFailed(item.id)) {
      return {
        kind: 'failed',
        value: '⚠️',
        title: '下载失败，点击重试',
      }
    }

    if (item.needsDownload) {
      return {
        kind: 'download',
        value: '↓',
        title: item.badgeTitle || '点击下载字体',
      }
    }

    if (item.badge) {
      return {
        kind: 'badge',
        value: item.badge,
        title: item.badgeTitle || null,
      }
    }

    return null
  }

  async function downloadOnlineFont(item) {
    await downloadFontItem(item)
  }

  async function resolveCommercialPreviewPath(item) {
    if (item.path && !item.path.endsWith('.enc')) {
      return item.path
    }

    const api = getElectronAPI()
    if (!api?.fonts?.decryptPreview || !item.fontId) {
      throw new Error('无法预览商业字体')
    }

    const result = await api.fonts.decryptPreview({
      fontId: item.fontId,
      userId: getUserId(),
    })

    if (!result?.ok || !result.tempPath) {
      throw new Error(result?.error || '商业字体解密失败')
    }

    previewTempPaths.add(result.tempPath)
    return result.tempPath
  }

  /**
   * @param {FontSelectItem} item
   * @returns {Promise<string | null>}
   */
  async function resolveFontFilePath(item) {
    if (item.kind === 'system' || item.needsDownload) {
      return null
    }

    if (item.kind === 'commercial') {
      return resolveCommercialPreviewPath(item)
    }

    return item.path || null
  }

  /**
   * 异步加载 @font-face，供下拉预览与编辑器使用。
   * @param {FontSelectItem} item
   * @returns {Promise<string | null>}
   */
  async function ensureFontPreview(item) {
    if (!item) return null

    if (item.kind === 'system') {
      setPreviewStatus(item.id, 'ready')
      return item.cssFamily
    }

    if (item.needsDownload) {
      return null
    }

    const status = previewStatus.value[item.id]
    if (status === 'ready') {
      return item.cssFamily
    }

    if (status === 'loading') {
      const fontId = item.fontId || item.id
      const pending = fontLoadPromises.get(fontId)
      if (pending) {
        await pending.catch(() => {})
        return previewStatus.value[item.id] === 'ready' ? item.cssFamily : null
      }
    }

    setPreviewStatus(item.id, 'loading')

    try {
      const fontId = item.fontId || item.id.replace(/^[^:]+:\s*/, '')
      const filePath = await resolveFontFilePath(item)

      if (!filePath) {
        setPreviewStatus(item.id, 'error')
        return null
      }

      await loadFontFaceAsync(fontId, filePath)
      setPreviewStatus(item.id, 'ready')
      return item.cssFamily
    } catch {
      setPreviewStatus(item.id, 'error')
      return null
    }
  }

  /**
   * @param {FontSelectItem} item
   */
  function getPreviewFontFamily(item) {
    if (item.kind === 'system') {
      return item.cssFamily
    }

    if (item.needsDownload || previewStatus.value[item.id] !== 'ready') {
      return DEFAULT_PREVIEW_FONT
    }

    return item.cssFamily
  }

  function prefetchPreview(item) {
    if (!item || item.needsDownload) return
    void ensureFontPreview(item)
  }

  async function preloadDropdownPreviews() {
    const previewable = fontItems.value.filter((item) => !item.needsDownload)

    await runWithConcurrency(
      previewable.map((item) => () => ensureFontPreview(item)),
      PREVIEW_CONCURRENCY,
    )
  }

  async function prepareFontFamily(item) {
    if (item.kind === 'system') {
      return item.cssFamily
    }

    if (item.needsDownload) {
      await downloadOnlineFont(item)
      const refreshed = fontItems.value.find(
        (font) => font.fontId === item.fontId || font.id === item.id,
      )
      if (!refreshed) {
        throw new Error('字体下载后未能加载')
      }
      await ensureFontPreview(refreshed)
      return refreshed.cssFamily
    }

    await ensureFontPreview(item)
    return item.cssFamily
  }

  async function applyFontToEditor(editor, item) {
    if (!editor || !item) return false

    try {
      if (item.needsDownload) {
        const cssFamily = await prepareFontFamily(item)
        editor.chain().focus().setMark('fontFamily', { fontFamily: cssFamily }).run()
        return true
      }

      const cssFamily = item.kind === 'system' ? item.cssFamily : item.cssFamily

      editor.chain().focus().setMark('fontFamily', { fontFamily: cssFamily }).run()
      void ensureFontPreview(item)

      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '应用字体失败')
      return false
    }
  }

  async function cleanupPreviewFonts() {
    const api = getElectronAPI()
    if (!api?.fonts?.cleanupPreview) return

    await Promise.all(
      [...previewTempPaths].map(async (tempPath) => {
        try {
          await api.fonts.cleanupPreview({ tempPath })
        } catch {
          // ignore cleanup errors
        }
      }),
    )
    previewTempPaths.clear()
  }

  onBeforeUnmount(() => {
    void cleanupPreviewFonts()
  })

  const flatItems = computed(() => fontItems.value)

  return {
    loading,
    downloadingId: activeDownloadId,
    fontGroups,
    flatItems,
    previewStatus,
    loadFonts,
    applyFontToEditor,
    downloadFontItem,
    downloadOnlineFont,
    getFontDownloadBadge,
    cleanupPreviewFonts,
    ensureFontPreview,
    prefetchPreview,
    preloadDropdownPreviews,
    getPreviewFontFamily,
    isFontDownloading,
    isFontDownloadFailed,
    getFontDownloadProgress,
  }
}
