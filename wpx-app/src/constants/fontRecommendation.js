/**
 * 字体推荐检查的首启动状态
 *
 * 用于在第一次/定时调度 AI 助手弹窗时：
 * - dismissed:  用户已主动选择「不再提醒」
 * - installed:  用户曾点击「已安装全部」或「不再需要」
 * - downloaded: 用户曾点击「全部加载」且全部完成
 * - pending:    尚未决定
 */
export const FONT_RECOMMENDATION_STATE_KEY = 'wpx-font-recommendation-state-v1'
export const FONT_RECOMMENDATION_LAST_CHECK_KEY = 'wpx-font-recommendation-last-check-v1'

/** 距上次检查超过该毫秒数才再次弹窗（默认 7 天） */
export const FONT_RECOMMENDATION_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @returns {'pending' | 'dismissed' | 'installed' | 'downloaded' | null}
 */
export function getFontRecommendationState() {
  if (typeof localStorage === 'undefined') return null
  const value = localStorage.getItem(FONT_RECOMMENDATION_STATE_KEY)
  if (value === 'pending' || value === 'dismissed' || value === 'installed' || value === 'downloaded') {
    return value
  }
  return null
}

/**
 * @param {'pending' | 'dismissed' | 'installed' | 'downloaded'} state
 */
export function setFontRecommendationState(state) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FONT_RECOMMENDATION_STATE_KEY, state)
}

/**
 * @returns {number|null} 上次检查的毫秒时间戳
 */
export function getFontRecommendationLastCheck() {
  if (typeof localStorage === 'undefined') return null
  const value = localStorage.getItem(FONT_RECOMMENDATION_LAST_CHECK_KEY)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * @param {number} timestamp
 */
export function setFontRecommendationLastCheck(timestamp = Date.now()) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FONT_RECOMMENDATION_LAST_CHECK_KEY, String(timestamp))
}

/**
 * @param {number} [intervalMs]
 * @returns {boolean} 是否已经到达再次弹窗的间隔
 */
export function shouldRunFontRecommendationCheck(intervalMs = FONT_RECOMMENDATION_CHECK_INTERVAL_MS) {
  const state = getFontRecommendationState()
  if (state === 'installed' || state === 'downloaded') return false
  const last = getFontRecommendationLastCheck()
  if (last === null) return true
  return Date.now() - last >= intervalMs
}
