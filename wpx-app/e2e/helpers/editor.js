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
    localStorage.setItem('wpx-ai-assistant-onboarding-v1', 'done')
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
 * 为「需要真实走 AI 对话」的用例注入已配置的自定义文本模型 API Key。
 *
 * V1.1 起模型设置迁移到 `wpx-model-settings` + `wpx-model-secrets-web`，
 * `seedE2eSettings` 里的 `wpx-settings.apiKey` 不再被 useAiChat 读取。
 * 这里直接写入纯文本 Key（无 `enc:v1:` 前缀，decryptApiKey 会原样透传），
 * 让 modelSettings store 的 `resolveTextApiKey()` 能返回非空值。
 *
 * @param {import('@playwright/test').Page} page
 */
export async function seedConfiguredTextApiKey(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'wpx-model-secrets-web',
      JSON.stringify({ text: 'e2e-test-key', vision: '' }),
    )
  })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openEditor(page) {
  await page.goto('/editor')
  await page.waitForLoadState('networkidle')

  const hasEditor = await page.locator('.ProseMirror').isVisible().catch(() => false)
  if (hasEditor) {
    return
  }

  // EmptyState CTA：依赖 TitleBar overlay 的 pointer-events 穿透 + scroll-padding，勿用 force
  const newButton = page.getByRole('button', { name: '新建 Markdown 文档' }).first()
  await expect(newButton).toBeVisible({ timeout: 10_000 })
  await newButton.click()
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
  const title = page.locator('#ai-chat-window-title')
  if (await title.isVisible().catch(() => false)) {
    await expect(aiChatInput(page)).toBeVisible({ timeout: 5_000 })
    return
  }
  await page.locator('button.ai-avatar-btn').click()
  await expect(title).toBeVisible({ timeout: 15_000 })
  await expect(aiChatInput(page)).toBeVisible({ timeout: 15_000 })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function aiChatInput(page) {
  return page.locator('.ai-chat-window-host .ai-chat-panel__input').first()
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} instruction
 */
export async function sendAiInstruction(page, instruction) {
  const textarea = aiChatInput(page)
  await textarea.focus()
  await textarea.fill(instruction)
  await textarea.focus()
  await textarea.press('Enter')
  const avatarBtn = page.locator('button.ai-avatar-btn')
  try {
    await expect(avatarBtn).toHaveAttribute('aria-busy', 'true', { timeout: 3_000 })
  } catch {
    // 极快响应可能看不到 busy 态
  }
  await expect(avatarBtn).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
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

/**
 * 通过 AI 助理本地指令触发保存对话框（零 Token）。
 * @param {import('@playwright/test').Page} page
 * @param {string} [command]
 */
export async function saveViaAiAssistant(page, command = '保存') {
  await openAiChat(page)
  await sendAiInstruction(page, command)
  await expect(page.getByRole('dialog', { name: /保存到文库/ })).toBeVisible({
    timeout: 20_000,
  })
}

/**
 * 确认保存对话框中的「确认保存」，并等待关闭。
 * @param {import('@playwright/test').Page} page
 */
export async function confirmSaveDialog(page) {
  const dialog = page.getByRole('dialog', { name: /保存到文库/ })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '确认保存' }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

/**
 * 打开智能文库页（应用内路由；本地指令会离开编辑器，故不复用 sendAiInstruction 的头像 busy 等待）。
 * @param {import('@playwright/test').Page} page
 */
export async function openLibraryView(page) {
  await openAiChat(page)
  const textarea = aiChatInput(page)
  await textarea.focus()
  await textarea.fill('打开文库')
  await textarea.press('Enter')
  await expect(page.getByRole('heading', { name: '智能文库' })).toBeVisible({
    timeout: 15_000,
  })
}

/**
 * 在文库中按关键词搜索并打开第一篇匹配文档。
 * @param {import('@playwright/test').Page} page
 * @param {string} keyword
 * @param {string} [titleHint]
 */
export async function openLibraryDocumentBySearch(page, keyword, titleHint = keyword) {
  const search = page.getByPlaceholder('搜索标题、标签、正文…')
  await search.fill(keyword)
  const result = page.locator('.wiki-browser__result').filter({ hasText: titleHint }).first()
  await expect(result).toBeVisible({ timeout: 15_000 })
  await result.click()
  await expect(page.getByText(new RegExp(`当前文档：.*${titleHint}`))).toBeVisible({
    timeout: 15_000,
  })
}

/**
 * 通过已 mock 的文库 API 校验落盘内容（不依赖 UI 导航）。
 * @param {import('@playwright/test').Page} page
 * @param {string} relativePath
 */
export async function fetchLibraryDocumentViaPage(page, relativePath) {
  return page.evaluate(async (path) => {
    const res = await fetch(`/api/library/document?relativePath=${encodeURIComponent(path)}`)
    if (!res.ok) {
      throw new Error(`document fetch failed: ${res.status}`)
    }
    return res.json()
  }, relativePath)
}
