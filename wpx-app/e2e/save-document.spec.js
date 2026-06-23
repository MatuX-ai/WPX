import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  openEditor,
  openSaveDialog,
  seedE2eSettings,
  typeInEditor,
} from './helpers/editor.js'

const SUGGESTED_PATH = '工作/周报'
const SUGGESTED_TITLE = 'E2E 测试文档'
const SUGGESTED_TAGS = ['e2e', '自动化']

test.describe('保存文档流程', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page, {
      analyzeResult: {
        title: SUGGESTED_TITLE,
        path: SUGGESTED_PATH,
        tags: SUGGESTED_TAGS,
        summary: 'Playwright 端到端测试自动生成的文档摘要。',
      },
    })
    await openEditor(page)
  })

  test('保存文档 → 验证 AI 建议路径 → 确认保存', async ({ page }) => {
    await typeInEditor(page, '# E2E 测试文档\n\n这是用于保存流程验证的工作周报内容。')

    await openSaveDialog(page)

    // Verify AI-suggested title
    const titleInput = page.locator('.save-dialog__field').filter({ hasText: '文档标题' }).locator('input')
    await expect(titleInput).toHaveValue(SUGGESTED_TITLE, { timeout: 20_000 })

    // Verify AI-suggested path
    const pathInput = page.locator('.save-dialog__field').filter({ hasText: '分类路径' }).locator('input')
    await expect(pathInput).toHaveValue(SUGGESTED_PATH, { timeout: 20_000 })

    const suggestion = page.locator('.save-dialog__hint code')
    await expect(suggestion).toHaveText(SUGGESTED_PATH)
    await expect(page.getByText('AI 建议：')).toBeVisible()

    // Verify AI-suggested tags are populated
    const tags = page.locator('.save-dialog__tag')
    await expect(tags).toHaveCount(SUGGESTED_TAGS.length)
    for (const tagText of SUGGESTED_TAGS) {
      await expect(tags.filter({ hasText: tagText })).toBeVisible()
    }

    await page.getByRole('button', { name: '确认保存' }).click()
    await expect(page.getByRole('dialog', { name: /保存到文库/ })).toBeHidden({ timeout: 15_000 })
  })
})
