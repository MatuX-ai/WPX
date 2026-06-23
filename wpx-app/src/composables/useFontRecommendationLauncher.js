import { ref, watch } from 'vue'
import {
  getFontRecommendationState,
  setFontRecommendationLastCheck,
  setFontRecommendationState,
  shouldRunFontRecommendationCheck,
} from '@/constants/fontRecommendation'
import { checkRecommendedFonts } from '@/composables/useFontRecommendationCheck'
import { useFloatingWindows, FLOATING_WINDOW_ID } from '@/composables/useFloatingWindows'

/** 共享的弹窗显示状态（任意调用方都能打开/关闭） */
const dialogVisible = ref(false)
const dialogReason = ref('initial')

/** 当前一次检查的命中状态，避免组件内重复 push 通知 */
let lastPromptedMissingIds = ''

/**
 * 触发一次系统字体推荐检查，并在缺失时弹出 AI 助手弹窗。
 * 默认只在第一次启动 / 距上次检查超过间隔 时触发。
 *
 * @param {{ force?: boolean, openChatOnShow?: boolean }} [options]
 * @returns {Promise<{ shown: boolean, missing: number, skipped: boolean }>}
 */
export async function maybePromptFontRecommendation(options = {}) {
  if (typeof window === 'undefined') {
    return { shown: false, missing: 0, skipped: true }
  }

  const force = Boolean(options.force)
  const openChatOnShow = options.openChatOnShow !== false

  if (!force && !shouldRunFontRecommendationCheck()) {
    return { shown: false, missing: 0, skipped: true }
  }

  // 记录本次检查时间，避免 1 分钟内连点多次触发
  setFontRecommendationLastCheck(Date.now())

  const report = await checkRecommendedFonts()
  if (!report) {
    return { shown: false, missing: 0, skipped: true }
  }

  const missing = report.missing || []
  if (!missing.length) {
    // 系统已包含所有推荐字体 → 标记为 installed，不再弹窗
    setFontRecommendationState('installed')
    return { shown: false, missing: 0, skipped: false }
  }

  const fingerprint = missing.map((font) => font.id).sort().join('|')
  if (!force && fingerprint === lastPromptedMissingIds) {
    return { shown: false, missing: missing.length, skipped: true }
  }
  lastPromptedMissingIds = fingerprint

  dialogReason.value = force ? 'manual' : 'initial'
  dialogVisible.value = true

  if (openChatOnShow) {
    try {
      const floatingWindows = useFloatingWindows()
      floatingWindows.openWindow(FLOATING_WINDOW_ID.AI_CHAT)
    } catch (error) {
      // 非 Electron 环境或窗口管理器尚未就绪，静默忽略
      console.warn('[font-recommendation] failed to open AI chat window:', error)
    }
  }

  return { shown: true, missing: missing.length, skipped: false }
}

/**
 * 主动关闭弹窗。
 *
 * @param {{ dismissPermanently?: boolean, markedDownloaded?: boolean }} [options]
 */
export function dismissFontRecommendationDialog(options = {}) {
  dialogVisible.value = false

  if (options.markedDownloaded) {
    setFontRecommendationState('downloaded')
    return
  }
  if (options.dismissPermanently) {
    setFontRecommendationState('dismissed')
  }
}

/**
 * 读取当前弹窗状态（用于在 App.vue 中渲染弹窗）。
 */
export function useFontRecommendationDialog() {
  return {
    visible: dialogVisible,
    reason: dialogReason,
    state: ref(getFontRecommendationState()),
  }
}

/**
 * 当弹窗显示状态从 true 变 false 时，更新本地缓存的状态值，
 * 让触发条件（installed/downloaded/dismissed）能立即生效。
 */
watch(dialogVisible, (visible) => {
  if (visible) return
  // 不在弹窗里修改 state，由调用方通过 dismissFontRecommendationDialog 显式传入
})
