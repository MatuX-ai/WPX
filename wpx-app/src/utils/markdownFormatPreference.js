/**
 * WPX MD 智能排版引擎 - 默认模板偏好持久化
 *
 * 用户在排版完成提示中点击「以后是不是都这样排版?」 → 是
 * 则记录所选模板到 localStorage；下次检测到 MD 时自动应用，跳过模板选择器。
 *
 * 数据形态：
 *   {
 *     version: 1,
 *     templateId: 'article',
 *     imageAlignMode: 'fill' | 'narrow' | 'keep' | null,
 *     savedAt: 1700000000000
 *   }
 */

const STORAGE_KEY = 'wpx-markdown-format-preference'
const PREF_VERSION = 1

/** 当前支持的模板 id 列表（与 useMarkdownFormatter.MARKDOWN_TEMPLATES 一致） */
export const VALID_TEMPLATE_IDS = ['article', 'report', 'official', 'lesson-plan', 'paper']

/** @returns {boolean} */
function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * 读取并校验偏好。返回 null 表示没有偏好或偏好已失效。
 * @returns {{ templateId: string, imageAlignMode: string | null, savedAt: number } | null}
 */
export function getDefaultTemplate() {
  if (!hasLocalStorage()) return null
  let raw = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.version !== PREF_VERSION) return null
  if (typeof parsed.templateId !== 'string') return null
  if (!VALID_TEMPLATE_IDS.includes(parsed.templateId)) return null

  return {
    templateId: parsed.templateId,
    imageAlignMode:
      typeof parsed.imageAlignMode === 'string' &&
      ['fill', 'narrow', 'keep'].includes(parsed.imageAlignMode)
        ? parsed.imageAlignMode
        : null,
    savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
  }
}

/**
 * 写入默认模板偏好
 * @param {string} templateId
 * @param {string | null} [imageAlignMode]
 * @returns {{ ok: boolean, error?: string }}
 */
export function setDefaultTemplate(templateId, imageAlignMode = null) {
  if (!VALID_TEMPLATE_IDS.includes(templateId)) {
    return { ok: false, error: `无效的模板 id: ${templateId}` }
  }
  if (imageAlignMode != null && !['fill', 'narrow', 'keep'].includes(imageAlignMode)) {
    imageAlignMode = null
  }
  if (!hasLocalStorage()) return { ok: false, error: 'localStorage 不可用' }
  try {
    const payload = {
      version: PREF_VERSION,
      templateId,
      imageAlignMode,
      savedAt: Date.now(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) }
  }
}

/**
 * 清除默认模板偏好
 * @returns {{ ok: boolean }}
 */
export function clearDefaultTemplate() {
  if (!hasLocalStorage()) return { ok: false }
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * 是否有已保存的默认偏好。
 * 是 getDefaultTemplate() !== null 的语义化封装。
 * @returns {boolean}
 */
export function hasDefaultTemplate() {
  return getDefaultTemplate() !== null
}