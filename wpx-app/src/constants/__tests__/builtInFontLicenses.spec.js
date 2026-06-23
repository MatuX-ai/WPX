import { describe, it, expect } from 'vitest'
import { BUILT_IN_FONT_LICENSES } from '@/constants/builtInFontLicenses'

describe('内置免费字体目录', () => {
  it('1. 包含 8 款内置免费字体', () => {
    expect(BUILT_IN_FONT_LICENSES).toHaveLength(8)

    const names = BUILT_IN_FONT_LICENSES.map((font) => font.name)
    expect(names).toContain('思源黑体 (Source Han Sans)')
    expect(names).toContain('JetBrains Mono')
    expect(names).toContain('Noto Color Emoji')
  })

  it('每款字体具备 id、作者与许可证类型', () => {
    for (const font of BUILT_IN_FONT_LICENSES) {
      expect(font.id).toBeTruthy()
      expect(font.author).toBeTruthy()
      expect(font.licenseType).toBeTruthy()
    }
  })
})
