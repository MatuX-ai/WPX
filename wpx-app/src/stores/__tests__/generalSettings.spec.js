import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { useThemeStore } from '@/stores/theme'
import { EDITOR_FONT_SIZE_PX } from '@/constants/generalPreferences'

describe('generalSettings — 即时生效', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.lang = 'zh-CN'
    document.documentElement.style.removeProperty('--wpx-editor-base-font-size')
  })

  it('切换主题立即写入 data-theme', async () => {
    const store = useGeneralSettingsStore()
    await store.updateSettings({ theme: 'dark' })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(useThemeStore().mode).toBe('dark')
  })

  it('切换界面语言立即更新 html lang', async () => {
    const store = useGeneralSettingsStore()
    await store.updateSettings({ language: 'en-US' })

    expect(document.documentElement.lang).toBe('en')
  })

  it('切换编辑器字号立即更新 CSS 变量', async () => {
    const store = useGeneralSettingsStore()
    await store.updateSettings({ editorFontSize: 'large' })

    expect(document.documentElement.style.getPropertyValue('--wpx-editor-base-font-size')).toBe(
      EDITOR_FONT_SIZE_PX.large,
    )
  })

  it('修改自动保存间隔立即反映到 store', async () => {
    const store = useGeneralSettingsStore()
    await store.updateSettings({
      autoSave: { enabled: true, intervalMs: 300000 },
    })

    expect(store.autoSaveIntervalMs).toBe(300000)
    expect(store.autoSaveEnabled).toBe(true)
  })
})

describe('useAutoSave — 自动保存间隔', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('关闭自动保存时不调度写入', async () => {
    const { useAutoSave } = await import('@/composables/useAutoSave')
    const { useGeneralSettingsStore } = await import('@/stores/generalSettings')
    const { useAppStore } = await import('@/stores/app')

    const generalStore = useGeneralSettingsStore()
    await generalStore.updateSettings({
      autoSave: { enabled: false, intervalMs: 30000 },
    })

    const appStore = useAppStore()
    const { scheduleAutoSave } = useAutoSave(() => ({ content: 'hello' }))

    scheduleAutoSave()
    await vi.advanceTimersByTimeAsync(60000)

    expect(localStorage.getItem('wpx-editor-draft')).toBeNull()
    expect(appStore.documentSaveStatus).toBe('unsaved')
  })
})
