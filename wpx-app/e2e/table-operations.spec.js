import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  insertTable,
  openEditor,
  openEditorContextMenu,
  seedE2eSettings,
  waitForTableBubbleMenu,
} from './helpers/editor.js'

test.describe('表格编辑流程', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await setupE2eMocks(page)
    await openEditor(page)
  })

  test('插入表格 → 右键菜单 → 添加行/列 → 合并单元格', async ({ page }) => {
    const COLS = 3
    const ROWS = 3

    // 1. 右键菜单插入表格
    await insertTable(page, ROWS, COLS, { viaContextMenu: true })

    const table = page.locator('.ProseMirror table')
    await expect(table.locator('tr')).toHaveCount(ROWS)
    await expect(table.locator('tr').first().locator('th, td')).toHaveCount(COLS)

    // 2. 在表格单元格内右键，验证上下文菜单可用
    const firstCell = table.locator('td').first()
    await firstCell.click()
    await firstCell.click({ button: 'right' })
    await expect(page.getByRole('menu', { name: '编辑器上下文菜单' })).toBeVisible()
    await page.keyboard.press('Escape')

    // 3. 通过表格气泡菜单添加行/列（行/列操作为气泡菜单，非右键项）
    await firstCell.click()
    await waitForTableBubbleMenu(page)
    await page.getByRole('button', { name: '↓ 行' }).click()
    await expect(table.locator('tr')).toHaveCount(ROWS + 1)

    await firstCell.click()
    await waitForTableBubbleMenu(page)
    await page.getByRole('button', { name: '→ 列' }).click()
    await expect(table.locator('tr').first().locator('th, td')).toHaveCount(COLS + 1)

    // 4. 选中相邻单元格并合并
    const cellA = table.locator('tr').nth(1).locator('td').nth(0)
    const cellB = table.locator('tr').nth(1).locator('td').nth(1)
    await cellA.click()
    await waitForTableBubbleMenu(page)
    await cellB.click({ modifiers: ['Shift'] })

    const mergeButton = page.getByRole('button', { name: '合并' })
    await expect(mergeButton).toBeEnabled()
    await mergeButton.click()

    await expect(table.locator('tr').nth(1).locator('td[colspan="2"]')).toHaveCount(1)
    await expect(table.locator('tr')).toHaveCount(ROWS + 1)
    await expect(table.locator('tr').first().locator('th, td')).toHaveCount(COLS + 1)
  })
})
