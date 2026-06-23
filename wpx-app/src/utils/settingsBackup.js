import { stripApiKeysFromModelSettings } from '@/stores/modelSettings'
import { createDefaultPreferences } from '@/stores/preferences'
import { STORAGE_KEY as LIBRARY_STORAGE_KEY } from '@/stores/library'
import { SKILLS_STORAGE_KEY } from '@/stores/skills'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { usePreferencesStore } from '@/stores/preferences'
import { useSkillsStore, createDefaultSkillsEnabledMap } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

export const SETTINGS_BACKUP_VERSION = 2

function readStorageJson(key) {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function sanitizePreferencesForExport(preferences) {
  const base = createDefaultPreferences()
  const merged = {
    ...base,
    ...(preferences && typeof preferences === 'object' ? preferences : {}),
  }

  merged.ai = {
    ...base.ai,
    ...(merged.ai || {}),
    apiKey: '',
  }

  if (merged.models) {
    merged.models = stripApiKeysFromModelSettings(merged.models)
  }

  return merged
}

/**
 * 收集当前可导出的设置快照（不含 API Key 与记忆数据）。
 */
export function collectSettingsSnapshot() {
  const preferencesStore = usePreferencesStore()

  return {
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: sanitizePreferencesForExport(preferencesStore.data),
    skills: readStorageJson(SKILLS_STORAGE_KEY) || createDefaultSkillsEnabledMap(),
    libraryPreferences: readStorageJson(LIBRARY_STORAGE_KEY),
  }
}

function formatExportDate(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

/**
 * 导出设置并触发 JSON 文件下载。
 */
export function exportSettingsToFile() {
  const snapshot = collectSettingsSnapshot()
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `wpx-settings-${formatExportDate(new Date())}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  return snapshot
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('无效的设置文件')
  }

  if (!payload.preferences || typeof payload.preferences !== 'object') {
    throw new Error('设置文件缺少 preferences 字段')
  }

  return payload
}

/**
 * 从备份 JSON 恢复设置到 Pinia 与 electron-store。
 * @param {unknown} payload
 */
export async function importSettingsFromPayload(payload) {
  const backup = validateBackupPayload(payload)
  const preferences = sanitizePreferencesForExport(backup.preferences)

  const preferencesStore = usePreferencesStore()
  const userPreferencesStore = useUserPreferencesStore()
  const modelSettingsStore = useModelSettingsStore()
  const generalSettingsStore = useGeneralSettingsStore()
  const skillsStore = useSkillsStore()

  preferencesStore.applyPreferences(preferences)
  userPreferencesStore.hydrateFromPreferences(preferences.agent)
  modelSettingsStore.hydrateFromPreferences(preferences.models)
  generalSettingsStore.hydrateFromPreferences(preferences)

  if (backup.skills) {
    // 兼容新格式（string[] 禁用列表）和旧格式（Record<string, boolean>）
    const skillsMap = Array.isArray(backup.skills)
      ? Object.fromEntries(
          skillsStore.allSkills.map((s) => [s.id, !backup.skills.includes(s.id)]),
        )
      : backup.skills
    if (typeof skillsMap === 'object') {
      skillsStore.applyEnabledMap(skillsMap)
    }
  }

  if (isElectron()) {
    const api = getElectronAPI()
    if (api?.preferences?.set) {
      await api.preferences.set({
        theme: preferences.theme,
        language: preferences.language,
        general: preferences.general,
        agent: preferences.agent,
        models: preferences.models,
        ai: preferences.ai,
        defaultFont: preferences.defaultFont,
        libraryRootPath: preferences.libraryRootPath,
        fileAssociationsEnabled: preferences.fileAssociationsEnabled,
      })
    }
  } else {
    await userPreferencesStore.persistAgent()
    await generalSettingsStore.persistSettings()

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        'wpx-model-settings',
        JSON.stringify(stripApiKeysFromModelSettings(preferences.models)),
      )
    }
  }

  if (backup.libraryPreferences && typeof localStorage !== 'undefined') {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(backup.libraryPreferences))
  }

  return preferences
}

/**
 * @param {File} file
 */
export async function importSettingsFromFile(file) {
  const text = await file.text()
  let parsed

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('无法解析 JSON 文件')
  }

  return importSettingsFromPayload(parsed)
}
