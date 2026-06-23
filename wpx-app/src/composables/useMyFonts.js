import { computed, ref } from 'vue'
import { getFontTypeLabel, CONSUME_TIME_FILTERS } from '@/constants/fontLabels'
import { fetchConsumeRecords, formatRecordTime } from '@/utils/tokenApi'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useToast } from '@/composables/useToast'

/**
 * @typedef {Object} MyFontItem
 * @property {string} id
 * @property {string} name
 * @property {string} typeLabel
 * @property {string} weightLabel
 * @property {boolean} enabled
 * @property {boolean} isCommercial
 * @property {string} source
 */

function buildWeightLabel(font) {
  if (font.weightName) return font.weightName
  if (font.weight) return String(font.weight)
  return 'Regular'
}

export function useMyFonts() {
  const toast = useToast()
  const loading = ref(false)
  const recordsLoading = ref(false)
  /** @type {import('vue').Ref<MyFontItem[]>} */
  const fonts = ref([])
  /** @type {import('vue').Ref<Array<Record<string, unknown>>>} */
  const consumeRecords = ref([])
  const timeFilter = ref('all')
  const customFrom = ref('')
  const customTo = ref('')

  const timeFilters = CONSUME_TIME_FILTERS

  const timeRange = computed(() => {
    const now = Date.now()

    if (timeFilter.value === '7d') {
      return {
        from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: undefined,
      }
    }

    if (timeFilter.value === '30d') {
      return {
        from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: undefined,
      }
    }

    if (timeFilter.value === 'custom') {
      return {
        from: customFrom.value ? new Date(`${customFrom.value}T00:00:00`).toISOString() : undefined,
        to: customTo.value ? new Date(`${customTo.value}T23:59:59.999`).toISOString() : undefined,
      }
    }

    return { from: undefined, to: undefined }
  })

  async function loadFonts() {
    loading.value = true

    try {
      if (!isElectron() || !getElectronAPI()?.fonts?.getAll) {
        fonts.value = []
        return
      }

      const api = getElectronAPI()
      const [allResult, prefsResult] = await Promise.all([
        api.fonts.getAll(),
        api.fonts.getPreferences?.() ?? Promise.resolve({ ok: false }),
      ])

      const disabledFontIds = new Set(
        prefsResult?.ok && Array.isArray(prefsResult.disabledFontIds)
          ? prefsResult.disabledFontIds
          : [],
      )

      const installedFonts = allResult?.ok && Array.isArray(allResult.fonts) ? allResult.fonts : []

      fonts.value = installedFonts
        .filter((font) => ['built-in', 'free', 'commercial'].includes(font.source))
        .map((font) => ({
          id: font.id,
          name: font.name || font.family || font.fontId || font.id,
          typeLabel: getFontTypeLabel(font.type),
          weightLabel: buildWeightLabel(font),
          enabled: !disabledFontIds.has(font.id),
          isCommercial: font.source === 'commercial',
          source: font.source,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载字体列表失败')
      fonts.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadConsumeRecords() {
    recordsLoading.value = true

    try {
      const range = timeRange.value
      consumeRecords.value = await fetchConsumeRecords({
        limit: 100,
        from: range.from,
        to: range.to,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载消费明细失败')
      consumeRecords.value = []
    } finally {
      recordsLoading.value = false
    }
  }

  async function setFontEnabled(fontItem, enabled) {
    const api = getElectronAPI()
    if (!api?.fonts?.setEnabled) {
      toast.error('当前环境无法修改字体设置')
      return
    }

    const previous = fontItem.enabled
    fontItem.enabled = enabled

    try {
      const result = await api.fonts.setEnabled({
        fontId: fontItem.id,
        enabled,
      })

      if (!result?.ok) {
        throw new Error(result?.error || '更新字体状态失败')
      }

      toast.success(enabled ? '字体已启用' : '字体已停用')
    } catch (error) {
      fontItem.enabled = previous
      toast.error(error instanceof Error ? error.message : '更新字体状态失败')
    }
  }

  async function initialize() {
    await Promise.all([loadFonts(), loadConsumeRecords()])
  }

  return {
    loading,
    recordsLoading,
    fonts,
    consumeRecords,
    timeFilter,
    customFrom,
    customTo,
    timeFilters,
    loadFonts,
    loadConsumeRecords,
    setFontEnabled,
    initialize,
    formatRecordTime,
  }
}
