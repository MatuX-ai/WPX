import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { setupE2eMocks } from './helpers/mocks.js'
import { openEditor, openSettings, seedE2eSettings } from './helpers/editor.js'

test.describe('设置工作流', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page)
    await openEditor(page)
  })

  test('TitleBar 设置按钮进入设置页', async ({ page }) => {
    await openSettings(page)
    await expect(page.getByRole('heading', { name: 'Agent 设置' })).toBeVisible()
  })

  test('切换主题为深色后立即生效', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('link', { name: '通用设置' }).click()
    await page.getByRole('radio', { name: '深色' }).check()

    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-theme')),
    ).toBe('dark')
  })

  test('禁用翻译 Skill 后保存到 localStorage', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('link', { name: 'Skills 管理' }).click()

    const translateCard = page.locator('.skill-card', {
      has: page.getByRole('heading', { name: '翻译' }),
    })
    await translateCard.locator('label.skill-card__switch').click()

    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-skills-enabled')
        if (!raw) return false
        const parsed = JSON.parse(raw)
        return parsed.translate === false
      }),
    ).toBe(true)
  })

  test('修改 Agent 名称并保存', async ({ page }) => {
    await openSettings(page)

    const nameInput = page.getByLabel('助手名称')
    await nameInput.fill('E2E 测试助手')
    await page.getByRole('button', { name: '保存' }).click()

    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-user-preferences')
        if (!raw) return ''
        return JSON.parse(raw)?.agent?.assistantName ?? ''
      }),
    ).toBe('E2E 测试助手')
  })

  test('导出设置 JSON 不含完整 API Key', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('link', { name: '数据与隐私' }).click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出所有设置' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^wpx-settings-.*\.json$/)

    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const content = await fs.readFile(filePath, 'utf8')
    const payload = JSON.parse(content)
    expect(payload.preferences?.ai?.apiKey).toBe('')
  })
})
