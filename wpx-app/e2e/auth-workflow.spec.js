import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  getSimulatedLoginUrl,
  loginThroughTitleBar,
  logoutThroughTitleBar,
  setupAuthE2eMocks,
  simulateAuthCallback,
  clickTitleBarLogin,
} from './helpers/auth-mocks.js'
import {
  applyFontToEditorSelection,
  confirmCommercialFontExport,
  expectCommercialFontApplied,
  openCommercialFontExportDialog,
  setupFontE2eMocks,
} from './helpers/font-mocks.js'
import {
  openEditor,
  openSettings,
  openAiChat,
  sendAiInstruction,
  seedE2eSettings,
  typeInEditor,
} from './helpers/editor.js'

const FREE_QUOTA_MESSAGE = '今日免费次数已用完，请明天再试或登录获取更多次数'
const GUEST_MODEL_LABEL = 'WPX 免费模型（由 ai.proclaw.cc 提供）'

test.describe('认证与访客工作流', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page, { aiReply: 'E2E AI 回复' })
    await setupAuthE2eMocks(page)
  })

  test('1. 首次启动为访客，TitleBar 显示「登录」按钮', async ({ page }) => {
    await openEditor(page)

    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /账户菜单$/ })).toHaveCount(0)
  })

  test('2. 访客可使用编辑器，模型设置可见免费模型与剩余次数', async ({ page }) => {
    await openEditor(page)
    await typeInEditor(page, '访客编辑测试')
    await expect(page.locator('.ProseMirror')).toContainText('访客编辑测试')

    await openSettings(page)
    await page.getByRole('link', { name: '模型配置' }).click()

    await expect(page.getByRole('button', { name: '登录后解锁' })).toBeVisible()
    await expect(page.getByText(GUEST_MODEL_LABEL)).toBeAttached()
    await expect.poll(async () => page.getByText(/剩余 .+\/50 次/).count()).toBeGreaterThan(0)
  })

  test('3. 免费次数用尽后，AI 返回提示', async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page, { aiReply: 'E2E AI 回复' })
    await setupAuthE2eMocks(page, { quotaExhausted: true })

    await openEditor(page)
    await typeInEditor(page, '测试免费额度')
    await openAiChat(page)
    await sendAiInstruction(page, '你好')

    await expect(page.getByText(FREE_QUOTA_MESSAGE)).toBeVisible({ timeout: 15_000 })
  })

  test('4. 点击登录跳转 account.proclaw.cc（模拟）且回调后变为已登录', async ({ page }) => {
    await openEditor(page)

    await clickTitleBarLogin(page)

    await expect.poll(() => getSimulatedLoginUrl(page)).toContain('https://account.proclaw.cc/login')
    await simulateAuthCallback(page)

    await expect(page.getByRole('button', { name: 'E2E 测试用户 账户菜单' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('.title-bar').getByRole('button', { name: '登录', exact: true })).toHaveCount(0)
  })

  test('5. 登录后 TitleBar 显示头像和昵称，点击可退出', async ({ page }) => {
    await openEditor(page)
    await loginThroughTitleBar(page)

    await expect(page.getByRole('button', { name: 'E2E 测试用户 账户菜单' })).toBeVisible()
    await logoutThroughTitleBar(page)
    await expect(page.locator('.title-bar').getByRole('button', { name: '登录', exact: true })).toBeVisible()
  })

  test('6. 登录后可添加自定义 API Key 并测试连接', async ({ page }) => {
    await openEditor(page)
    await loginThroughTitleBar(page)

    await openSettings(page)
    await page.getByRole('link', { name: '模型配置' }).click()
    await expect(page.getByRole('button', { name: '登录后解锁' })).toHaveCount(0)

    await page.getByRole('radio', { name: '使用自定义模型' }).first().check()
    await page.getByLabel('API 地址（Endpoint）').fill('https://api.deepseek.com/v1')
    await page.getByLabel('API Key').fill('sk-e2e-test-key')
    await page.getByLabel('模型名称').fill('deepseek-chat')
    await page.getByRole('button', { name: '测试连接' }).first().click()

    await expect(page.getByText('连接成功，模型服务可用')).toBeVisible({ timeout: 10_000 })
  })

  test('8. 退出登录后恢复访客状态，受限设置被遮罩', async ({ page }) => {
    await openEditor(page)
    await loginThroughTitleBar(page)
    await logoutThroughTitleBar(page)

    await openSettings(page)
    await page.getByRole('link', { name: '模型配置' }).click()
    await expect(page.getByRole('button', { name: '登录后解锁' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '使用自定义模型' })).toHaveCount(0)

    await page.getByRole('link', { name: '字体与 Token' }).click()
    await expect(page.getByRole('button', { name: '登录后解锁' })).toBeVisible()
    await expect(page.getByRole('link', { name: '充值' })).toHaveCount(0)
  })
})

test.describe('认证会话持久化', () => {
  test('9. 应用重启后，已登录状态保持（JWT 未过期）', async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page)
    await setupAuthE2eMocks(page, { refreshValid: true })

    await openEditor(page)
    await loginThroughTitleBar(page)

    await page.reload()
    await expect(page.getByText('正在加载…')).toBeHidden({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'E2E 测试用户 账户菜单' })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('10. JWT 刷新失败后恢复访客模式', async ({ page }) => {
    await seedE2eSettings(page)

    await page.addInitScript(() => {
      sessionStorage.setItem(
        'wpx-e2e-auth-credentials',
        JSON.stringify({
          token: 'expired-access-token',
          refreshToken: 'expired-refresh-token',
        }),
      )
    })

    await setupE2eMocks(page)
    await setupAuthE2eMocks(page, { refreshValid: false })

    await page.goto('/editor')

    await expect(page.getByText('正在加载…')).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.title-bar').getByRole('button', { name: '登录', exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: /账户菜单$/ })).toHaveCount(0)
  })
})

test.describe('登录后 Token 与商业字体导出', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page)
    await setupFontE2eMocks(page, { tokenBalance: 500 })
    await setupAuthE2eMocks(page, { withFonts: true })
  })

  test('7. 登录后可充值 Token 并使用商业字体导出', async ({ page }) => {
    await openEditor(page)
    await loginThroughTitleBar(page)

    await typeInEditor(page, '商业字体导出')
    await applyFontToEditorSelection(page, '方正兰亭黑')
    await expectCommercialFontApplied(page)

    const exportDialog = await openCommercialFontExportDialog(page)
    await expect(exportDialog.getByText('方正兰亭黑')).toBeVisible()
    await confirmCommercialFontExport(page, exportDialog)

    await openSettings(page)
    await page.getByRole('link', { name: '字体与 Token' }).click()
    await expect(page.getByRole('button', { name: '登录后解锁' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '充值' })).toBeVisible()

    await page.getByRole('link', { name: '充值' }).click()
    await expect(page).toHaveURL(/token\/recharge/)
    await expect(page.getByRole('heading', { name: 'Token 充值', level: 1 })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('请先登录以充值和使用商业字体')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '立即充值' })).toBeVisible()
  })
})
