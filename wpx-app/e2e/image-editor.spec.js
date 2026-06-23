import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  openEditor,
  performCropInImageEditor,
  seedE2eSettings,
  uploadImageToEditor,
} from './helpers/editor.js'

test.describe('图片编辑流程', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page)
    await openEditor(page)
  })

  test('上传图片 → 打开编辑器 → 裁剪 → 应用 → 图片已更新', async ({ page }) => {
    await uploadImageToEditor(page)

    const image = page.locator('.ProseMirror img.editor-image')
    const originalSrc = await image.getAttribute('src')
    expect(originalSrc).toBeTruthy()

    await image.click()
    await page.getByRole('button', { name: /编辑图片/ }).click()

    await expect(page.getByLabel('应用图片编辑')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.tui-image-editor')).toBeVisible()

    // Execute the crop operation inside TUI Image Editor (opens in crop mode by default)
    await performCropInImageEditor(page)

    // Apply the edited image back to the editor
    await page.getByLabel('应用图片编辑').click()
    await expect(page.getByLabel('应用图片编辑')).toBeHidden({ timeout: 15_000 })

    const updatedSrc = await image.getAttribute('src')
    expect(updatedSrc).toBeTruthy()
    // Verify the image data actually changed after crop
    expect(updatedSrc).not.toBe(originalSrc)
    await expect(image).toBeVisible()
  })
})
