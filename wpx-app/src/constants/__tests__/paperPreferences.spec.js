import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CUSTOM_MARGIN,
  DEFAULT_PAPER_WIDTH_PX,
  HEADER_FOOTER_OPTIONS,
  PAPER_MARGIN_OPTIONS,
  PAPER_SIZE_OPTIONS,
  PAPER_SIZE_VALUES,
  PAPER_MARGIN_VALUES,
  HEADER_FOOTER_VALUES,
  PAPER_SIZE_WIDTH_PX,
  createDefaultPaperSettings,
  getPaperWidthPx,
  isFocusModeApplicable,
  mergePaperSettings,
  normalizeCustomMargin,
} from '@/constants/paperPreferences'

describe('paperPreferences', () => {
  it('提供默认纸张配置：A4 / normal / 20mm / none / 关闭焦点模式', () => {
    const defaults = createDefaultPaperSettings()
    expect(defaults.paperSize).toBe('A4')
    expect(defaults.paperMargin).toBe('normal')
    expect(defaults.customMargin).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })
    expect(defaults.headerFooter).toBe('none')
    expect(defaults.focusMode).toBe(false)
  })

  it('默认边距使用冻结对象作为参照', () => {
    expect(DEFAULT_CUSTOM_MARGIN).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })
  })

  it('枚举值覆盖所有允许档位', () => {
    expect(PAPER_SIZE_VALUES).toEqual(['A4', 'Letter', '16K', 'mobile', 'none'])
    expect(PAPER_MARGIN_VALUES).toEqual(['wide', 'normal', 'narrow', 'custom'])
    expect(HEADER_FOOTER_VALUES).toEqual(['none', 'pageNumber', 'custom'])
  })

  it('纸张尺寸 label 包含需求中的描述（手机长图、无）', () => {
    const mobileOption = PAPER_SIZE_OPTIONS.find((option) => option.value === 'mobile')
    const noneOption = PAPER_SIZE_OPTIONS.find((option) => option.value === 'none')
    expect(mobileOption?.label).toContain('手机长图')
    expect(noneOption?.label).toContain('无')
  })

  it('页边距 label 明确包含 25/20/15 mm', () => {
    const wide = PAPER_MARGIN_OPTIONS.find((option) => option.value === 'wide')
    const normal = PAPER_MARGIN_OPTIONS.find((option) => option.value === 'normal')
    const narrow = PAPER_MARGIN_OPTIONS.find((option) => option.value === 'narrow')
    expect(wide?.label).toContain('25')
    expect(normal?.label).toContain('20')
    expect(narrow?.label).toContain('15')
  })

  it('页眉页脚 label 展示「无 / 仅页码 / 自定义文字」', () => {
    expect(HEADER_FOOTER_OPTIONS.find((o) => o.value === 'none')?.label).toBe('无')
    expect(HEADER_FOOTER_OPTIONS.find((o) => o.value === 'pageNumber')?.label).toBe('仅页码')
    expect(HEADER_FOOTER_OPTIONS.find((o) => o.value === 'custom')?.label).toBe('自定义文字')
  })

  it('mergePaperSettings 会用 base 补全缺失字段', () => {
    const merged = mergePaperSettings(null, null)
    expect(merged).toEqual(createDefaultPaperSettings())
  })

  it('mergePaperSettings 允许更新每个字段并保持未指定字段不变', () => {
    const merged = mergePaperSettings({}, {
      paperSize: 'Letter',
      paperMargin: 'narrow',
      headerFooter: 'pageNumber',
      focusMode: true,
    })
    expect(merged.paperSize).toBe('Letter')
    expect(merged.paperMargin).toBe('narrow')
    expect(merged.headerFooter).toBe('pageNumber')
    expect(merged.focusMode).toBe(true)
    expect(merged.customMargin).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })
  })

  it('mergePaperSettings 会拒绝非法枚举值并回退到默认值', () => {
    const merged = mergePaperSettings({}, {
      paperSize: 'XXL',
      paperMargin: 'huge',
      headerFooter: 'bogus',
    })
    expect(merged.paperSize).toBe('A4')
    expect(merged.paperMargin).toBe('normal')
    expect(merged.headerFooter).toBe('none')
  })

  it('mergePaperSettings 会规范化自定义边距范围', () => {
    const merged = mergePaperSettings({}, {
      paperMargin: 'custom',
      customMargin: {
        top: -10,
        bottom: 500,
        left: 30,
        right: 'not-a-number',
      },
    })
    expect(merged.customMargin.top).toBe(0)
    expect(merged.customMargin.bottom).toBe(100)
    expect(merged.customMargin.left).toBe(30)
    expect(merged.customMargin.right).toBe(0)
    expect(merged.paperMargin).toBe('custom')
  })

  it('mergePaperSettings 会保留已有 customMargin 并合并新值', () => {
    const merged = mergePaperSettings(
      { customMargin: { top: 10, bottom: 10, left: 10, right: 10 } },
      { customMargin: { top: 25 } },
    )
    expect(merged.customMargin).toEqual({ top: 25, bottom: 10, left: 10, right: 10 })
  })

  it('normalizeCustomMargin 在输入为空时返回默认值', () => {
    expect(normalizeCustomMargin(null)).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })
    expect(normalizeCustomMargin(undefined)).toEqual({ top: 20, bottom: 20, left: 20, right: 20 })
  })

  it('纸张宽度映射与需求一致（A4=794, Letter=816, 16K=728, mobile=375）', () => {
    expect(PAPER_SIZE_WIDTH_PX.A4).toBe(794)
    expect(PAPER_SIZE_WIDTH_PX.Letter).toBe(816)
    expect(PAPER_SIZE_WIDTH_PX['16K']).toBe(728)
    expect(PAPER_SIZE_WIDTH_PX.mobile).toBe(375)
    expect(PAPER_SIZE_WIDTH_PX.none).toBeNull()
  })

  it('getPaperWidthPx 返回对应宽度，未知尺寸回退 A4', () => {
    expect(getPaperWidthPx('A4')).toBe(794)
    expect(getPaperWidthPx('Letter')).toBe(816)
    expect(getPaperWidthPx('16K')).toBe(728)
    expect(getPaperWidthPx('mobile')).toBe(375)
    expect(getPaperWidthPx('none')).toBe(DEFAULT_PAPER_WIDTH_PX)
    expect(getPaperWidthPx(undefined)).toBe(DEFAULT_PAPER_WIDTH_PX)
    expect(getPaperWidthPx('unknown')).toBe(DEFAULT_PAPER_WIDTH_PX)
  })

  it('isFocusModeApplicable 仅在 focusMode=true 且 paperSize!==none 时为 true', () => {
    expect(isFocusModeApplicable(false, 'A4')).toBe(false)
    expect(isFocusModeApplicable(true, 'none')).toBe(false)
    expect(isFocusModeApplicable(true, undefined)).toBe(true)
    expect(isFocusModeApplicable(true, 'A4')).toBe(true)
    expect(isFocusModeApplicable(true, 'mobile')).toBe(true)
    expect(isFocusModeApplicable(true, '16K')).toBe(true)
    expect(isFocusModeApplicable(true, 'Letter')).toBe(true)
  })
})