import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { BUILT_IN_FONT_LICENSES } from '@/constants/builtInFontLicenses'

const mockGetAll = vi.fn()
const mockGetCommercialList = vi.fn()
const mockGetPreferences = vi.fn()

vi.mock('@/utils/electron', () => ({
  isElectron: () => true,
  getElectronAPI: () => ({
    fonts: {
      getAll: mockGetAll,
      getCommercialList: mockGetCommercialList,
      getPreferences: mockGetPreferences,
    },
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}))

function buildBuiltInFontPayload() {
  return BUILT_IN_FONT_LICENSES.map((font) => ({
    id: `built-in:${font.id}`,
    fontId: font.id,
    name: font.name,
    family: font.name,
    path: `/fonts/built-in/${font.id}/regular.ttf`,
    source: 'built-in',
  }))
}

describe('useEditorFonts 内置字体', () => {
  beforeEach(() => {
    mockGetAll.mockResolvedValue({
      ok: true,
      fonts: buildBuiltInFontPayload(),
    })
    mockGetCommercialList.mockResolvedValue({ ok: true, fonts: [] })
    mockGetPreferences.mockResolvedValue({ ok: true, disabledFontIds: [] })
  })

  it('1. 加载后字体下拉分组包含 8 款内置免费字体', async () => {
    const { useEditorFonts } = await import('@/composables/useEditorFonts')
    const { loadFonts, fontGroups } = useEditorFonts()

    await loadFonts()
    await flushPromises()

    const installed = fontGroups.value.find((group) => group.key === 'installed')
    expect(installed?.items).toHaveLength(8)
    expect(installed?.items.every((item) => item.kind === 'built-in')).toBe(true)
    expect(installed?.items.every((item) => item.badge === null)).toBe(true)
  })
})
