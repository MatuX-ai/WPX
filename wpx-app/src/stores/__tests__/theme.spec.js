import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore } from '@/stores/theme'

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('无存储时默认为浅色', () => {
    const store = useThemeStore()
    store.init()

    expect(store.mode).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('从 wpx-general-settings 读取主题', () => {
    localStorage.setItem(
      'wpx-general-settings',
      JSON.stringify({ theme: 'dark', language: 'zh-CN' }),
    )

    const store = useThemeStore()
    store.init()

    expect(store.mode).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('theme 键优先于 wpx-general-settings', () => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem(
      'wpx-general-settings',
      JSON.stringify({ theme: 'dark', language: 'zh-CN' }),
    )

    const store = useThemeStore()
    store.init()

    expect(store.mode).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('跟随系统时解析为 OS 暗色并写入 data-theme', () => {
    localStorage.setItem('theme', 'system')
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const store = useThemeStore()
    store.init()

    expect(store.mode).toBe('system')
    expect(store.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
