import { expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures')
export const TEST_IMAGE_PATH = path.join(FIXTURES_DIR, 'test-image.png')

/**
 * @param {import('@playwright/test').Page} page
 */
export async function seedE2eSettings(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    localStorage.clear()
    localStorage.setItem(
      'wpx-settings',
      JSON.stringify({
        version: 1,
        apiKey: 'e2e-test-key',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        libraryRootPath: '',
        avatarId: 'robot',
        useAiProxy: true,
        fileAssociationsEnabled: true,
      }),
    )
  })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openSettings(page) {
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '用户中心' })).toBeVisible({ timeout: 15_000 })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openEditor(page) {
  await page.goto('/editor')
  await page.getByRole('button', { name: '新建 Markdown 文档' }).first().click()
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30_000 })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function editorLocator(page) {
  return page.locator('.ProseMirror')
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
export async function typeInEditor(page, text) {
  const editor = editorLocator(page)
  await editor.click()
  await page.keyboard.type(text)
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function selectAllEditorText(page) {
  const editor = editorLocator(page)
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openAiChat(page) {
  await page.locator('button.ai-avatar-btn').click()
  await expect(page.locator('#ai-chat-window-title')).toBeVisible({ timeout: 15_000 })
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} instruction
 */
export async function sendAiInstruction(page, instruction) {
  const textarea = page.locator('.ai-chat-window__input')
  await textarea.click()
  await textarea.fill(instruction)
  await textarea.press('Enter')
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} rows
 * @param {number} cols
 * @param {{ viaContextMenu?: boolean }} [options]
 */
export async function insertTable(page, rows = 3, cols = 3, options = {}) {
  if (options.viaContextMenu) {
    await openEditorContextMenu(page)
    await page.getByRole('menuitem', { name: '插入表格' }).click()
  } else {
    await page.getByRole('button', { name: '插入表格' }).click()
  }
  await expect(page.locator('#table-dialog-title')).toBeVisible()

  const dialog = page.locator('[role="dialog"]').filter({ has: page.locator('#table-dialog-title') })

  const rowsInput = dialog.locator('label:has-text("行数") input')
  const colsInput = dialog.locator('label:has-text("列数") input')

  if (rows !== 3) {
    await rowsInput.fill(String(rows))
  }
  if (cols !== 3) {
    await colsInput.fill(String(cols))
  }

  // Button label re-renders on each input change; use stable dialog-scoped primary button.
  await dialog.locator('button.bg-brand-600').click()
  await expect(page.locator('.ProseMirror table')).toBeVisible()
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openEditorContextMenu(page) {
  const editor = editorLocator(page)
  await editor.click({ button: 'right' })
  await expect(page.getByRole('menu', { name: '编辑器上下文菜单' })).toBeVisible()
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function uploadImageToEditor(page) {
  const fileInput = page.locator('input[type="file"][accept*="image"]')
  await page.getByRole('button', { name: '插入图片', exact: true }).click()
  await fileInput.setInputFiles(TEST_IMAGE_PATH)
  await expect(page.locator('.ProseMirror img.editor-image')).toBeVisible()
}

/**
 * Wait for the table BubbleMenu to be visible (cursor must be inside a table cell).
 * @param {import('@playwright/test').Page} page
 */
export async function waitForTableBubbleMenu(page) {
  await expect(page.getByRole('button', { name: '↓ 行' })).toBeVisible({ timeout: 10_000 })
}

/**
 * Execute a crop operation inside the TUI Image Editor (crop menu is default on open).
 * @param {import('@playwright/test').Page} page
 */
export async function performCropInImageEditor(page) {
  // TUI Image Editor opens in crop mode by default.
  // Click the "Apply" button inside the crop sub-menu to apply the default crop region.
  const cropApply = page.locator('.tui-image-editor-button.apply').first()
  await expect(cropApply).toBeVisible({ timeout: 15_000 })
  await cropApply.click()
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openSaveDialog(page) {
  await page.getByRole('button', { name: /保存/ }).click()
  await expect(page.getByRole('dialog', { name: /保存到文库/ })).toBeVisible()
}
