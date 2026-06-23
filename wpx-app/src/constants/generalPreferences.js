/** @typedef {'light' | 'dark' | 'system'} GeneralThemeMode */
/** @typedef {'zh-CN' | 'en-US'} GeneralLanguage */
/** @typedef {'small' | 'medium' | 'large'} EditorFontSize */
/** @typedef {'blank' | 'restore-last'} StartupBehavior */

export const THEME_OPTIONS = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: '英文' },
]

export const AUTO_SAVE_INTERVAL_OPTIONS = [
  { value: 30000, label: '30 秒' },
  { value: 60000, label: '1 分钟' },
  { value: 300000, label: '5 分钟' },
]

export const EDITOR_FONT_SIZE_OPTIONS = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
]

/** @type {Record<EditorFontSize, string>} */
export const EDITOR_FONT_SIZE_PX = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

export const STARTUP_BEHAVIOR_OPTIONS = [
  { value: 'blank', label: '打开空白文档' },
  { value: 'restore-last', label: '恢复上次文档' },
]

const VALID_THEMES = new Set(['light', 'dark', 'system'])
const VALID_LANGUAGES = new Set(['zh-CN', 'en-US'])
const VALID_FONT_SIZES = new Set(['small', 'medium', 'large'])
const VALID_STARTUP = new Set(['blank', 'restore-last'])
const VALID_INTERVALS = new Set(AUTO_SAVE_INTERVAL_OPTIONS.map((item) => item.value))

export function createDefaultGeneralSettings() {
  return {
    defaultSavePath: '',
    autoSave: {
      enabled: true,
      intervalMs: 30000,
    },
    editorFontSize: 'medium',
    startupBehavior: 'restore-last',
  }
}

/**
 * @param {ReturnType<typeof createDefaultGeneralSettings>} current
 * @param {Partial<ReturnType<typeof createDefaultGeneralSettings>> | null | undefined} partial
 */
export function mergeGeneralSettings(current, partial) {
  const base = createDefaultGeneralSettings()
  const next = {
    ...base,
    ...(current && typeof current === 'object' ? current : {}),
    ...(partial && typeof partial === 'object' ? partial : {}),
  }

  next.defaultSavePath = typeof next.defaultSavePath === 'string' ? next.defaultSavePath : ''

  const autoSave = {
    ...base.autoSave,
    ...(current?.autoSave && typeof current.autoSave === 'object' ? current.autoSave : {}),
    ...(partial?.autoSave && typeof partial.autoSave === 'object' ? partial.autoSave : {}),
  }
  next.autoSave = {
    enabled: autoSave.enabled !== false,
    intervalMs: VALID_INTERVALS.has(autoSave.intervalMs) ? autoSave.intervalMs : 30000,
  }

  if (!VALID_FONT_SIZES.has(next.editorFontSize)) {
    next.editorFontSize = 'medium'
  }

  if (!VALID_STARTUP.has(next.startupBehavior)) {
    next.startupBehavior = 'restore-last'
  }

  return next
}

/**
 * @param {Partial<{
 *   theme?: GeneralThemeMode,
 *   language?: GeneralLanguage,
 *   general?: Partial<ReturnType<typeof createDefaultGeneralSettings>>,
 * }> | null | undefined} prefs
 */
export function normalizeGeneralPreferences(prefs) {
  const general = mergeGeneralSettings({}, prefs?.general)

  let theme = prefs?.theme
  if (!VALID_THEMES.has(theme)) {
    theme = 'system'
  }

  let language = prefs?.language
  if (!VALID_LANGUAGES.has(language)) {
    language = 'zh-CN'
  }

  return {
    theme,
    language,
    ...general,
  }
}
