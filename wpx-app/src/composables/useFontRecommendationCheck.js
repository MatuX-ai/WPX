import { computed, ref } from 'vue'
import { RECOMMENDED_FREE_FONTS } from '@/constants/recommendedFonts'
import {
  setFontRecommendationLastCheck,
  setFontRecommendationState,
} from '@/constants/fontRecommendation'
import { getElectronAPI, isElectron } from '@/utils/electron'

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   category?: string,
 *   sampleText?: string,
 *   description?: string,
 *   downloadUrl?: string,
 *   fileName?: string,
 *   systemAliases?: string[],
 *   matchedFamily?: string
 * }} RecommendedFont
 */

/**
 * @typedef {{
 *   recommended: RecommendedFont[],
 *   available: RecommendedFont[],
 *   missing: RecommendedFont[],
 *   systemFontCount: number
 * }} RecommendationReport
 */

/**
 * 共享的检查结果 ref：UI 弹窗和首启动调度共用。
 * @type {import('vue').Ref<RecommendationReport | null>}
 */
const sharedReport = ref(null)

/** @type {import('vue').Ref<boolean>} */
const sharedLoading = ref(false)

/** @type {import('vue').Ref<string | null>} */
const sharedError = ref(null)

/** @type {Promise<RecommendationReport | null> | null} */
let inflight = null

/**
 * 调用后端对比系统字体与推荐字体清单。
 * 多次并发调用会复用同一个 inflight Promise，避免重复 IPC。
 *
 * @param {RecommendedFont[]} [recommendedList]
 * @returns {Promise<RecommendationReport | null>}
 */
export async function checkRecommendedFonts(recommendedList = RECOMMENDED_FREE_FONTS) {
  if (typeof window === 'undefined') return null
  if (!isElectron()) return null

  const api = getElectronAPI()
  if (!api?.fonts?.checkRecommended) {
    return null
  }

  if (inflight) {
    return inflight
  }

  sharedLoading.value = true
  sharedError.value = null

  inflight = (async () => {
    try {
      const result = await api.fonts.checkRecommended({ recommended: recommendedList })
      if (!result || result.ok !== true) {
        const message = result?.error || '字体推荐检查失败'
        sharedError.value = message
        sharedReport.value = null
        return null
      }

      const report = {
        recommended: Array.isArray(result.recommended) ? result.recommended : recommendedList,
        available: Array.isArray(result.available) ? result.available : [],
        missing: Array.isArray(result.missing) ? result.missing : [],
        systemFontCount:
          typeof result.systemFontCount === 'number' ? result.systemFontCount : 0,
      }
      sharedReport.value = report
      setFontRecommendationLastCheck(Date.now())
      return report
    } catch (error) {
      sharedError.value = error?.message || '字体推荐检查失败'
      sharedReport.value = null
      return null
    } finally {
      sharedLoading.value = false
      inflight = null
    }
  })()

  return inflight
}

/**
 * 主动重置共享状态（弹窗关闭后用于强制下次重新检测）。
 */
export function resetFontRecommendationReport() {
  sharedReport.value = null
  sharedError.value = null
  inflight = null
}

/**
 * @param {('pending'|'dismissed'|'installed'|'downloaded')} state
 */
export function markFontRecommendationState(state) {
  setFontRecommendationState(state)
}

/**
 * @returns {RecommendationReport | null}
 */
export function useFontRecommendationReport() {
  return sharedReport
}

/**
 * 暴露给 UI 组件使用的状态集合。
 */
export function useFontRecommendationCheck() {
  const report = computed(() => sharedReport.value)
  const loading = computed(() => sharedLoading.value)
  const error = computed(() => sharedError.value)
  const missing = computed(() => sharedReport.value?.missing || [])
  const available = computed(() => sharedReport.value?.available || [])
  const systemFontCount = computed(() => sharedReport.value?.systemFontCount || 0)

  return {
    report,
    loading,
    error,
    missing,
    available,
    systemFontCount,
    checkRecommendedFonts,
    resetFontRecommendationReport,
    markFontRecommendationState,
  }
}
