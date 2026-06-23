import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FONT_MARKET_CATEGORIES, DEFAULT_FONT_PREVIEW_TEXT } from '@/constants/fontMarket'
import { ONLINE_FREE_FONTS } from '@/constants/onlineFonts'
import { useEditorStore } from '@/stores/editor'
import { useAppStore } from '@/stores/app'
import { fetchTokenBalance } from '@/utils/fontMarketApi'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useToast } from '@/composables/useToast'
import { useFontDownloader } from '@/composables/useFontDownloader'

/**
 * @typedef {'commercial' | 'free-online' | 'built-in'} MarketFontType
 */

/**
 * @typedef {Object} MarketFont
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {MarketFontType} type
 * @property {boolean} isFree
 * @property {string} sampleText
 * @property {string} [thumbnailUrl]
 * @property {string} [vendor]
 * @property {number} [pricePerChar]
 * @property {string} [localPath]
 * @property {boolean} [needsDownload]
 * @property {string} [downloadUrl]
 * @property {string} [fileName]
 * @property {string} fontId
 */

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function inferBuiltInCategory(name) {
  const text = String(name || '')
  if (/宋|serif/i.test(text)) return '宋体'
  if (/楷|手写|wenkai|kaiti/i.test(text)) return '手写'
  if (/圆|装饰|emoji|mono/i.test(text)) return '装饰'
  return '黑体'
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
 * @param {MarketFont} marketFont
 */
export function toFontSelectItem(marketFont) {
  if (marketFont.type === 'commercial') {
    return {
      id: `commercial:${marketFont.fontId}`,
      name: marketFont.name,
      group: 'commercial',
      kind: 'commercial',
      badge: '⚡',
      badgeTitle: '导出时按字扣 Token',
      cssFamily: `'WPX-${marketFont.fontId}', sans-serif`,
      fontId: marketFont.fontId,
      path: marketFont.localPath,
    }
  }

  if (marketFont.type === 'free-online') {
    return {
      id: marketFont.id,
      name: marketFont.name,
      group: marketFont.needsDownload ? 'online' : 'installed',
      kind: 'online',
      badge: marketFont.needsDownload ? '↓' : null,
      badgeTitle: marketFont.needsDownload ? '点击下载字体' : null,
      cssFamily: `'WPX-${marketFont.fontId}', sans-serif`,
      fontId: marketFont.fontId,
      path: marketFont.localPath,
      downloadUrl: marketFont.downloadUrl,
      fileName: marketFont.fileName,
      needsDownload: marketFont.needsDownload,
    }
  }

  return {
    id: marketFont.id,
    name: marketFont.name,
    group: 'installed',
    kind: 'built-in',
    badge: null,
    badgeTitle: null,
    cssFamily: `'WPX-${marketFont.fontId}', sans-serif`,
    fontId: marketFont.fontId,
    path: marketFont.localPath,
  }
}

export function useFontMarket() {
  const toast = useToast()
  const router = useRouter()
  const editorStore = useEditorStore()
  const appStore = useAppStore()
  const { download: downloadFontByUrl } = useFontDownloader()

  const loading = ref(false)
  const tokenBalance = ref(0)
  const activeCategory = ref('all')
  /** @type {import('vue').Ref<MarketFont[]>} */
  const fonts = ref([])
  const previewVisible = ref(false)
  /** @type {import('vue').Ref<MarketFont | null>} */
  const previewFont = ref(null)

  const categories = FONT_MARKET_CATEGORIES

  const filteredFonts = computed(() => {
    const category = activeCategory.value
    if (category === 'all') return fonts.value
    if (category === 'free') return fonts.value.filter((font) => font.isFree)
    return fonts.value.filter((font) => font.category === category)
  })

  async function refreshTokenBalance() {
    try {
      tokenBalance.value = await fetchTokenBalance()
    } catch {
      tokenBalance.value = 0
    }
  }

  async function loadMarketFonts() {
    loading.value = true

    try {
      /** @type {MarketFont[]} */
      const items = []

      if (!isElectron() || !getElectronAPI()?.fonts?.getAll) {
        for (const font of ONLINE_FREE_FONTS) {
          items.push({
            id: font.id,
            fontId: font.id,
            name: font.name,
            category: font.category,
            type: 'free-online',
            isFree: true,
            sampleText: font.sampleText || font.name,
            needsDownload: true,
            downloadUrl: font.downloadUrl,
            fileName: font.fileName,
          })
        }
        fonts.value = items
        return
      }

      const api = getElectronAPI()
      const [allResult, commercialResult] = await Promise.all([
        api.fonts.getAll(),
        api.fonts.getCommercialList?.({}) ?? Promise.resolve({ ok: false }),
      ])

      const installedFonts = allResult?.ok && Array.isArray(allResult.fonts) ? allResult.fonts : []
      const installed = installedFonts.map(mapInstalledFont)
      const installedById = new Map(installed.map((font) => [font.fontId, font]))
      const installedNames = new Set(installed.map((font) => font.familyKey))

      for (const font of installed.filter((item) => item.source === 'built-in')) {
        items.push({
          id: font.id,
          fontId: font.fontId,
          name: font.name,
          category: inferBuiltInCategory(font.name),
          type: 'built-in',
          isFree: true,
          sampleText: font.name,
          localPath: font.path,
          needsDownload: false,
        })
      }

      for (const catalogFont of ONLINE_FREE_FONTS) {
        const installedMatch = installedById.get(catalogFont.id)
        const downloadedByName = installedNames.has(normalizeName(catalogFont.name))
        const localPath = installedMatch?.path
        const needsDownload = !localPath && !downloadedByName

        items.push({
          id: catalogFont.id,
          fontId: catalogFont.id,
          name: catalogFont.name,
          category: catalogFont.category,
          type: 'free-online',
          isFree: true,
          sampleText: catalogFont.sampleText || catalogFont.name,
          localPath,
          needsDownload,
          downloadUrl: catalogFont.downloadUrl,
          fileName: catalogFont.fileName,
        })
      }

      const commercialCatalog =
        commercialResult?.ok && Array.isArray(commercialResult.fonts)
          ? commercialResult.fonts
          : []

      for (const font of commercialCatalog) {
        const installedMatch = installed.find(
          (item) => item.source === 'commercial' && item.fontId === font.id,
        )

        items.push({
          id: font.id,
          fontId: font.id,
          name: font.name,
          category: font.category || '黑体',
          type: 'commercial',
          isFree: false,
          sampleText: font.name,
          thumbnailUrl: font.thumbnail_url,
          vendor: font.vendor,
          pricePerChar: font.price_per_char,
          localPath: installedMatch?.path,
          needsDownload: false,
        })
      }

      fonts.value = items
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载字体商店失败')
      fonts.value = []
    } finally {
      loading.value = false
    }
  }

  function openPreview(font) {
    previewFont.value = font
    previewVisible.value = true
  }

  function closePreview() {
    previewVisible.value = false
    previewFont.value = null
  }

  async function useFontInEditor(payload) {
    const fontItem = payload?.fontItem || (payload ? toFontSelectItem(payload) : null)
    const marketFont = payload?.marketFont || payload

    if (!fontItem || !marketFont) return

    editorStore.requestApplyFont(fontItem)

    if (!appStore.hasOpenDocument) {
      appStore.openDocument()
    }

    closePreview()
    await router.push({ name: 'editor' })
    toast.success(`已切换到字体「${marketFont.name}」`)
  }

  async function downloadMarketFont(font) {
    if (!font?.downloadUrl) {
      toast.error('当前字体无法下载')
      return false
    }

    try {
      await downloadFontByUrl(font.fontId || font.id, font.downloadUrl, {
        downloadId: font.id,
        fileName: font.fileName || `${font.fontId || font.id}.ttf`,
        fontName: font.name,
        type: 'free',
      })
      await loadMarketFonts()
      return true
    } catch {
      return false
    }
  }

  async function initialize() {
    await Promise.all([loadMarketFonts(), refreshTokenBalance()])
  }

  return {
    loading,
    tokenBalance,
    activeCategory,
    categories,
    fonts,
    filteredFonts,
    previewVisible,
    previewFont,
    defaultPreviewText: DEFAULT_FONT_PREVIEW_TEXT,
    initialize,
    loadMarketFonts,
    refreshTokenBalance,
    openPreview,
    closePreview,
    useFontInEditor,
    downloadMarketFont,
    toFontSelectItem,
  }
}
