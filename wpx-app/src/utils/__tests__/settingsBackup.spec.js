import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultAgentSettings } from '@/constants/agentPreferences'
import { createDefaultPreferences } from '@/stores/preferences'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { usePreferencesStore } from '@/stores/preferences'
import { useSkillsStore } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import {
  collectSettingsSnapshot,
  importSettingsFromPayload,
  SETTINGS_BACKUP_VERSION,
} from '@/utils/settingsBackup'

vi.mock('@/utils/electron', () => ({
  isElectron: vi.fn(() => false),
  getElectronAPI: vi.fn(() => null),
}))

describe('settingsBackup — 导出与导入', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('导出 JSON 不含 API Key 明文', async () => {
    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({
      ai: { apiKey: 'sk-secret-should-not-export' },
      agent: {
        ...createDefaultAgentSettings(),
        assistantName: '备份助手',
      },
    })

    const snapshot = collectSettingsSnapshot()

    expect(snapshot.version).toBe(SETTINGS_BACKUP_VERSION)
    expect(snapshot.preferences.agent.assistantName).toBe('备份助手')
    expect(snapshot.preferences.ai.apiKey).toBe('')
  })

  it('重置后导入可恢复 Agent 与通用设置', async () => {
    const backup = {
      version: SETTINGS_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      preferences: createDefaultPreferences(),
      skills: { translate: false },
      libraryPreferences: { pathCorrections: [] },
    }

    backup.preferences.agent = {
      ...createDefaultAgentSettings(),
      assistantName: '导入助手',
      toneStyle: 'humorous',
    }
    backup.preferences.theme = 'dark'
    backup.preferences.language = 'en-US'
    backup.preferences.general = {
      ...backup.preferences.general,
      autoSave: { enabled: true, intervalMs: 60000 },
      editorFontSize: 'large',
    }

    await importSettingsFromPayload(backup)

    const userPreferencesStore = useUserPreferencesStore()
    const generalSettingsStore = useGeneralSettingsStore()
    const skillsStore = useSkillsStore()

    expect(userPreferencesStore.agent.assistantName).toBe('导入助手')
    expect(userPreferencesStore.agent.toneStyle).toBe('humorous')
    expect(generalSettingsStore.theme).toBe('dark')
    expect(generalSettingsStore.language).toBe('en-US')
    expect(generalSettingsStore.autoSaveIntervalMs).toBe(60000)
    expect(generalSettingsStore.editorFontSize).toBe('large')
    expect(skillsStore.isSkillEnabled('translate')).toBe(false)
  })
})
