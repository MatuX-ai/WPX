import { expect } from '@playwright/test'
import { BUILT_IN_FONT_LICENSES } from '../../src/constants/builtInFontLicenses.js'
import { ONLINE_FREE_FONTS } from '../../src/constants/onlineFonts.js'

export const LOGGED_IN_EXPORT_CONFIRM_TITLE = '本次导出包含商业字体'
export const GUEST_EXPORT_CONFIRM_TITLE = '商业字体导出'

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ apiBase?: string, tokenBalance?: number }} [options]
 */
export async function setupFontE2eMocks(page, options = {}) {
  const tokenBalance = options.tokenBalance ?? 500

  const builtInFonts = BUILT_IN_FONT_LICENSES.map((font) => ({
    id: `built-in:${font.id}`,
    fontId: font.id,
    name: font.name,
    family: font.name,
    path: `C:/WPX/fonts/built-in/${font.id}/regular.ttf`,
    source: 'built-in',
  }))

  await page.addInitScript(
    ({ builtInPayload, onlineFonts }) => {
      window.localStorage.setItem('wpx-user-id', 'e2e-font-user')

      const storedDownloads = JSON.parse(
        window.localStorage.getItem('wpx-e2e-downloaded-fonts') || '[]',
      )
      window.__WPX_E2E_DOWNLOADED_FONTS__ = new Set(
        Array.isArray(storedDownloads) ? storedDownloads : [],
      )

      function persistDownloadedFonts() {
        window.localStorage.setItem(
          'wpx-e2e-downloaded-fonts',
          JSON.stringify([...window.__WPX_E2E_DOWNLOADED_FONTS__]),
        )
      }

      const baseApi = window.electronAPI || {}

      window.electronAPI = {
        ...baseApi,
        processType: 'renderer',
        platform: 'win32',
        localServer: {
          getBaseUrl: () => Promise.resolve(window.location.origin),
          ...(baseApi.localServer || {}),
        },
        fonts: {
          ...(baseApi.fonts || {}),
          getAll: async () => ({
            ok: true,
            fonts: [
              ...builtInPayload,
              ...[...window.__WPX_E2E_DOWNLOADED_FONTS__].map((fontId) => {
                const online = onlineFonts.find((item) => item.id === fontId)
                return {
                  id: `free:${fontId}`,
                  fontId,
                  name: online?.name || fontId,
                  family: online?.name || fontId,
                  path: `C:/WPX/fonts/free/${fontId}.ttf`,
                  source: 'free',
                }
              }),
            ],
          }),
          getCommercialList: async () => ({
            ok: true,
            fonts: [
              {
                id: 'founder-lanting-hei',
                name: '方正兰亭黑',
                category: '黑体',
                vendor: '方正字库',
                price_per_char: 1,
              },
            ],
          }),
          getPreferences: async () => ({ ok: true, disabledFontIds: [] }),
          decryptPreview: async ({ fontId }) => ({
            ok: true,
            tempPath: `C:/WPX/temp/${fontId}.ttf`,
          }),
          download: async ({ fontId, downloadId }) => {
            window.__WPX_E2E_DOWNLOADED_FONTS__.add(fontId)
            persistDownloadedFonts()
            return {
              ok: true,
              downloadId,
              path: `C:/WPX/fonts/free/${fontId}.ttf`,
            }
          },
          onDownloadProgress: (callback) => {
            queueMicrotask(() => {
              callback?.({
                downloadId: 'zcool-kuaile',
                phase: 'complete',
                percent: 100,
              })
            })
            return () => {}
          },
        },
      }
    },
    {
      builtInPayload: builtInFonts,
      onlineFonts: ONLINE_FREE_FONTS,
    },
  )

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
  })

  await page.route('**/api/token/balance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ balance: tokenBalance }),
    })
  })

  await page.route('**/api/token/consume/preview', async (route) => {
    const payload = route.request().postDataJSON()
    const charCount = payload?.fonts?.[0]?.char_count ?? 0
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance: tokenBalance,
        total_consumed: charCount,
        sufficient: tokenBalance >= charCount,
        fonts: (payload.fonts || []).map((item) => ({
          font_id: item.font_id,
          font_name: '方正兰亭黑',
          char_count: item.char_count,
          token_used: item.char_count,
          deduplicated: false,
        })),
      }),
    })
  })

  await page.route('**/api/token/consume', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        balance_after: tokenBalance - 12,
        total_consumed: 12,
      }),
    })
  })

  await page.route('**/api/export', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="export.pdf"',
      },
      body: Buffer.from('%PDF-1.4 mock-export-with-embedded-fonts'),
    })
  })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openFontDropdown(page) {
  await page.getByRole('button', { name: '字体' }).click()
  await page.getByRole('listbox', { name: '字体列表' }).waitFor({ state: 'visible' })
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} fontName
 */
export async function selectFontOption(page, fontName) {
  await openFontDropdown(page)
  await page.getByRole('option', { name: new RegExp(fontName) }).click()
}

/**
 * 选中编辑器全文并应用指定字体（TipTap fontFamily mark 需有选区）。
 * @param {import('@playwright/test').Page} page
 * @param {string} fontName
 */
export async function applyFontToEditorSelection(page, fontName) {
  const { selectAllEditorText, editorLocator } = await import('./editor.js')
  await page.getByRole('button', { name: '字体' }).click()
  await page.getByRole('listbox', { name: '字体列表' }).waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await selectAllEditorText(page)
  await selectFontOption(page, fontName)
  await editorLocator(page).press('End')
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {RegExp | string} [fontIdPattern]
 */
export async function expectCommercialFontApplied(page, fontIdPattern = /WPX-founder-lanting-hei/) {
  const styledSpan = page.locator('.ProseMirror span[style*="font-family"]')
  await expect(styledSpan).toBeVisible({ timeout: 15_000 })
  await expect(styledSpan).toHaveAttribute('style', fontIdPattern)
}

/**
 * 打开导出 PDF 并等待商业字体扣费确认框。
 * @param {import('@playwright/test').Page} page
 * @param {{ guest?: boolean }} [options]
 */
export async function openCommercialFontExportDialog(page, options = {}) {
  const expectedTitle = options.guest ? GUEST_EXPORT_CONFIRM_TITLE : LOGGED_IN_EXPORT_CONFIRM_TITLE

  await page.getByRole('button', { name: '导出文档' }).click()
  const exportPdfButton = page.getByRole('button', { name: '导出 PDF' })
  await expect(exportPdfButton).toBeVisible({ timeout: 10_000 })
  await expect(exportPdfButton).toBeEnabled()
  await exportPdfButton.click()

  const title = page.locator('#export-font-confirm-title')
  await expect(title).toBeVisible({ timeout: 15_000 })
  await expect(title).toHaveText(expectedTitle)

  return page.getByRole('dialog').filter({ has: title })
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dialog
 */
export async function confirmCommercialFontExport(page, dialog) {
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '确认导出' }).click()
  await downloadPromise
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}
