import { test, expect } from '@playwright/test'
import { BUILT_IN_FONT_LICENSES } from '../src/constants/builtInFontLicenses.js'
import { openEditor, seedE2eSettings, typeInEditor } from './helpers/editor.js'
import {
  applyFontToEditorSelection,
  openFontDropdown,
  setupFontE2eMocks,
} from './helpers/font-mocks.js'

test.describe('字体与导出 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupFontE2eMocks(page)
    await openEditor(page)
  })

  test('1. 字体下拉框包含 8 款内置免费字体', async ({ page }) => {
    await openFontDropdown(page)

    for (const font of BUILT_IN_FONT_LICENSES) {
      await expect(page.getByRole('option', { name: font.name, exact: true })).toBeVisible()
    }

    expect(BUILT_IN_FONT_LICENSES).toHaveLength(8)
  })

  test('2. 在线免费字体下载完成后出现在已安装分组', async ({ page }) => {
    await openFontDropdown(page)
    const downloadOption = page.getByRole('option', { name: /站酷快乐体/ })
    await expect(downloadOption).toBeVisible()
    await expect(downloadOption).toContainText('↓')

    await downloadOption.click()
    await expect(page.getByText('站酷快乐体 下载完成')).toBeVisible({ timeout: 10_000 })

    await openFontDropdown(page)
    const installedOption = page.getByRole('option', { name: '站酷快乐体' })
    await expect(installedOption).toBeVisible()
    await expect(installedOption).not.toContainText('↓')

    await page.reload()
    await openEditor(page)
    await openFontDropdown(page)
    await expect(page.getByRole('option', { name: '站酷快乐体' })).toBeVisible()
  })

  test('3. 商业字体 ⚡ 可选择且编辑器应用 font-family 样式', async ({ page }) => {
    await typeInEditor(page, '商业字体预览')
    await applyFontToEditorSelection(page, '方正兰亭黑')

    const styledSpan = page.locator('.ProseMirror span[style*="font-family"]')
    await expect(styledSpan).toBeVisible()
    await expect(styledSpan).toHaveAttribute('style', /WPX-founder-lanting-hei/)
  })

  // 用例 4、7（导出扣费确认 / 余额不足）见 Vitest：
  // - src/components/fonts/__tests__/ExportFontConfirm.spec.js
  // - src/utils/__tests__/exportFontAnalysis.spec.js
})
