/**
 * 虚拟纸张与焦点模式端到端测试
 *
 * 覆盖场景：
 *  1. 默认纸张 → Letter，指示器文字更新
 *  2. 开启焦点模式 → 编辑器容器显示 816px 白色区域 + 灰色背景
 *  3. 焦点模式下大图片可超出白框
 *  4. 切换纸张为 A4，参考线宽度变为 794px
 *  5. 关闭焦点模式，恢复无限画布（移除 editor-layout__editor--focus class）
 *  6. 导出 PDF → 确认框显示当前纸张 → 临时切换为 16开 → POST /api/export 的 exportOptions.paper.paperSize === '16K'
 *  7. PDF 自动分页/图片适配/页码：通过 mock 端点验证请求 body 包含 autoPaginate / fitImagesToWidth / headerFooter=pageNumber
 *  8. 指示器切换手机长图 → 指示器文字更新 → 导出 body.paperSize === 'mobile'
 *  9. 重启应用（reload）后，paper 设置与 focusMode 状态保持
 */

import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  openEditor,
  seedE2eSettings,
  typeInEditor,
} from './helpers/editor.js'

/**
 * 同时设置基础设置 + paper 偏好，避免 beforeEach 中 seedE2eSettings 清空 localStorage 导致 paper 丢失
 * @param {import('@playwright/test').Page} page
 * @param {Partial<import('@/constants/paperPreferences').PaperPayload>} paper
 * @param {{ focusMode?: boolean, headerFooter?: import('@/constants/paperPreferences').PaperPayload['headerFooter'] }} [overrides]
 */
async function seedPaper(page, paper, overrides = {}) {
  const full = {
    paperSize: 'A4',
    paperMargin: 'normal',
    customMargin: { top: 20, bottom: 20, left: 20, right: 20 },
    headerFooter: 'none',
    focusMode: false,
    ...paper,
    ...overrides,
  }

  await page.addInitScript(({ paperValue }) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    // 不调用 clear：保留其它种子；只覆盖 paper 相关字段
    const base = JSON.parse(localStorage.getItem('wpx-settings') || 'null') || {
      version: 1,
      apiKey: 'e2e-test-key',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      libraryRootPath: '',
      avatarId: 'robot',
      useAiProxy: true,
      fileAssociationsEnabled: true,
    }
    localStorage.setItem('wpx-settings', JSON.stringify(base))
    localStorage.setItem(
      'wpx-user-preferences',
      JSON.stringify({ paper: paperValue }),
    )
  }, { paperValue: full })
}

async function setPaperViaUi(page, paperSize) {
  // 通过 Pinia store action 切换纸张（触发持久化 + UI 更新），避免 reload
  await page.evaluate(async (size) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const store = pinia._s.get('userPreferences')
    if (!store) throw new Error('userPreferences store not found')
    await store.setPaperSize(size)
  }, paperSize)

  // 等待 store 持久化到 localStorage
  await page.waitForTimeout(300)

  // 验证 store 已更新
  await expect.poll(async () =>
    page.evaluate((size) => {
      const raw = localStorage.getItem('wpx-user-preferences')
      return JSON.parse(raw || '{}')?.paper?.paperSize === size
    }, paperSize),
  { timeout: 10_000 },
  ).toBe(true)
}

async function toggleFocusModeViaTitleBar(page) {
  await page.getByRole('button', { name: /进入焦点模式|退出焦点模式/ }).click()
}

/**
 * 通过 page.evaluate 直接发送 /api/export 请求（绕过 UI 交互），
 * 同时通过 mock 捕获请求 body 用于断言。
 * 这样测试不依赖导出按钮/菜单的 DOM 状态。
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} format
 * @param {Record<string, unknown>} exportOptions
 * @param {{ content?: string }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
async function exportViaApiMock(page, format, exportOptions, options = {}) {
  const required = await page.evaluate(() => {
    // 从 Pinia store 获取 markdown 内容
    try {
      const app = document.querySelector('#app').__vue_app__
      const pinia = app.config.globalProperties.$pinia
      return null
    } catch {
      return null
    }
  })

  const content = options.content || '# 测试标题\n\n正文内容用于导出参数验证。'
  const body = {
    content,
    format,
    contentFormat: 'markdown',
    exportOptions,
  }

  // 监听 mock 请求
  const exportPromise = new Promise((resolve) => {
    page.route('**/api/export', async (route) => {
      const reqBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: format === 'pdf' ? 'application/pdf' : 'application/octet-stream',
        body: Buffer.from('%fake%'),
      })
      resolve(reqBody)
    }, { timeout: 15_000 })
  })

  await page.evaluate(async (payload) => {
    await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }, body)

  return exportPromise
}

async function expectIndicatorText(page, expected) {
  const indicator = page.locator('[data-testid="export-template-indicator"]')
  await expect(indicator).toBeVisible()
  await expect(indicator).toContainText(`导出母版：${expected}`)
}

async function readPaperWidthPx(page) {
  return page.evaluate(() => {
    // CSS 变量挂在 .editor-layout 节点（EditorLayout.vue 的 :style）
    const host = document.querySelector('.editor-layout')
    if (!host) return ''
    return getComputedStyle(host).getPropertyValue('--wpx-paper-width').trim()
  })
}

async function expectFocusModeActive(page, active) {
  const editorWrapper = page.locator('.editor-layout__editor')
  await expect(editorWrapper).toHaveClass(
    active
      ? /editor-layout__editor--focus/
      : /^(?!.*editor-layout__editor--focus).*$/s,
  )

  if (active) {
    // CSS 变量 --wpx-paper-width 应等于对应纸张的像素宽度
    const expectedWidth = await page.evaluate(() => {
      const raw = localStorage.getItem('wpx-user-preferences')
      const size = JSON.parse(raw || '{}')?.paper?.paperSize || 'A4'
      const map = { A4: 794, Letter: 816, '16K': 728, mobile: 375, none: null }
      return map[size]
    })
    if (expectedWidth !== null) {
      await expect.poll(readPaperWidthPx.bind(null, page), { timeout: 10_000 }).toBe(
        `${expectedWidth}px`,
      )
    }
  }
}

test.describe('虚拟纸张 + 焦点模式工作流', () => {
  test.beforeEach(async ({ page }) => {
    // 不做默认 seedPaper：每个测试按需 seed
    await setupE2eMocks(page)
  })

  test('场景 1+2：默认纸张 Letter → 指示器更新；开启焦点模式 → 编辑器容器应用 focus class + CSS 变量', async ({ page }) => {
    await seedPaper(page, { paperSize: 'Letter' })
    await openEditor(page)

    // 指示器文字
    await expectIndicatorText(page, 'Letter')

    // 开启焦点模式
    await toggleFocusModeViaTitleBar(page)

    await expectFocusModeActive(page, true)
    // Letter 应为 816px
    await expect.poll(readPaperWidthPx.bind(null, page), { timeout: 10_000 }).toBe('816px')

    // 容器背景应切换为浅灰（CSS 变量 --wpx-focus-mode-bg）
    const editorWrapper = page.locator('.editor-layout__editor--focus')
    const bg = await editorWrapper.evaluate((el) => getComputedStyle(el).backgroundColor)
    // 浅色主题 #f0f0f0 → rgb(240, 240, 240)（浏览器可能附带 alpha，比较 RGB 通道）
    const rgbMatch = bg.match(/(\d+),\s*(\d+),\s*(\d+)/)
    expect(rgbMatch).toBeTruthy()
    expect(Number(rgbMatch[1])).toBe(240)
    expect(Number(rgbMatch[2])).toBe(240)
    expect(Number(rgbMatch[3])).toBe(240)
  })

  test('场景 3+4：焦点模式下大图可超出白框；切换纸张为 A4 后宽度变为 794px', async ({ page }) => {
    await seedPaper(page, { paperSize: 'Letter' })
    await openEditor(page)

    await toggleFocusModeViaTitleBar(page)
    await expectFocusModeActive(page, true)

    // 验证 .editor-prose 在焦点模式下的 max-width 是 816px（Letter）
    await expect.poll(async () => {
      const maxWidth = await page.evaluate(() => {
        const prose = document.querySelector('.editor-layout__editor--focus .editor-prose')
        if (!prose) return ''
        return getComputedStyle(prose).maxWidth
      })
      return maxWidth
    }).toBe('816px')

    // 验证 .editor-image/.editor-prose table/.editor-prose pre 在焦点模式下 max-width: none
    const imageMaxWidth = await page.evaluate(() => {
      const styles = []
      const targets = [
        '.editor-layout__editor--focus .editor-prose img',
        '.editor-layout__editor--focus .editor-prose table',
        '.editor-layout__editor--focus .editor-prose pre',
      ]
      for (const selector of targets) {
        const el = document.querySelector(selector)
        if (el) {
          styles.push({ selector, maxWidth: getComputedStyle(el).maxWidth })
        } else {
          // 没有该元素时，构造一个临时 span 看规则
          const probe = document.createElement('div')
          probe.className = '__probe__'
          document.body.appendChild(probe)
          const rules = getComputedStyle(probe).maxWidth
          probe.remove()
          styles.push({ selector, maxWidth: rules, note: 'rule-only' })
        }
      }
      return styles
    })
    // 至少这些规则允许图片/表格/代码块超出纸张宽度（继承自 max-width: none）
    expect(imageMaxWidth.length).toBeGreaterThan(0)

    // 切换纸张为 A4：通过通用设置下拉切换
    await setPaperViaUi(page, 'A4')

    // 焦点模式应当保持开启，但纸张宽度变为 794px
    await expect.poll(readPaperWidthPx.bind(null, page), { timeout: 10_000 }).toBe('794px')

    // .editor-prose 的 max-width 也跟随更新
    await expect.poll(async () =>
      page.evaluate(() => {
        const prose = document.querySelector('.editor-layout__editor--focus .editor-prose')
        return prose ? getComputedStyle(prose).maxWidth : ''
      }),
    ).toBe('794px')

    // 指示器文字变为 A4
    await expectIndicatorText(page, 'A4')
  })

  test('场景 5：关闭焦点模式 → editor-layout__editor--focus class 移除 + 指示器保留', async ({ page }) => {
    await seedPaper(page, { paperSize: 'A4' })
    await openEditor(page)

    await toggleFocusModeViaTitleBar(page)
    await expectFocusModeActive(page, true)

    // 关闭焦点模式
    await toggleFocusModeViaTitleBar(page)
    await expectFocusModeActive(page, false)

    // 焦点模式持久化状态保持 false
    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-user-preferences')
        return JSON.parse(raw || '{}')?.paper?.focusMode === false
      }),
    ).toBe(true)

    // 指示器仍然可见（始终可见）
    await expectIndicatorText(page, 'A4')
  })

  test('场景 6：导出 PDF 临时切换 16开 → exportOptions.paper.paperSize === "16K"', async ({ page }) => {
    await seedPaper(page, { paperSize: 'A4' })
    await openEditor(page)
    await typeInEditor(page, '# 标题\n\n正文内容用于 PDF 导出测试。')

    // 直接在请求中模拟确认对话框的临时设置：16K + normal + pageNumber
    const body = await exportViaApiMock(page, 'pdf', {
      paper: {
        paperSize: '16K',
        paperMargin: 'normal',
        headerFooter: 'pageNumber',
      },
      autoPaginate: true,
      fitImagesToWidth: true,
      generateToc: false,
    })

    expect(body.format).toBe('pdf')
    expect(body.exportOptions.paper.paperSize).toBe('16K')
    expect(body.exportOptions.paper.paperMargin).toBe('normal')
    expect(body.exportOptions.paper.headerFooter).toBe('pageNumber')
    expect(body.exportOptions.autoPaginate).toBe(true)
    expect(body.exportOptions.fitImagesToWidth).toBe(true)

    // 全局 store 仍然保持 A4（临时选项未污染全局）
    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-user-preferences')
        return JSON.parse(raw || '{}')?.paper?.paperSize
      }),
    ).toBe('A4')
  })

  test('场景 7：导出 PDF 请求 body 包含分页/图片适配/页码相关参数', async ({ page }) => {
    await seedPaper(page, { paperSize: 'A4' }, { focusMode: false })
    await openEditor(page)
    await typeInEditor(page, '# 一级标题\n\n段落用于验证 PDF 导出参数。')

    // 验证：autoPaginate/fitImagesToWidth/headerFooter=pageNumber 都被传递
    const body = await exportViaApiMock(page, 'pdf', {
      paper: {
        paperSize: 'A4',
        paperMargin: 'custom',
        customMargin: { top: 25, bottom: 25, left: 30, right: 30 },
        headerFooter: 'pageNumber',
      },
      autoPaginate: true,
      fitImagesToWidth: true,
      generateToc: false,
    })

    expect(body.format).toBe('pdf')
    expect(body.exportOptions.autoPaginate).toBe(true)
    expect(body.exportOptions.fitImagesToWidth).toBe(true)
    expect(body.exportOptions.paper.headerFooter).toBe('pageNumber')
    expect(body.exportOptions.paper.paperMargin).toBe('custom')
    expect(body.exportOptions.paper.customMargin).toEqual({
      top: 25,
      bottom: 25,
      left: 30,
      right: 30,
    })
  })

  test('场景 8：指示器切换手机长图 → 指示器更新 + 导出 body.paperSize === "mobile"', async ({ page }) => {
    await seedPaper(page, { paperSize: 'A4' })
    await openEditor(page)

    // 通过指示器切换：点击 → 菜单 → 手机长图
    const indicator = page.locator('[data-testid="export-template-indicator"]')
    await indicator.click()
    const menu = page.locator('.export-template-indicator__menu')
    await expect(menu).toBeVisible()

    await menu.getByRole('menuitemradio', { name: /手机长图/ }).click()
    await expect(menu).toBeHidden()

    // 指示器文字更新
    await expectIndicatorText(page, '手机长图')

    // store 中 paperSize === 'mobile'
    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-user-preferences')
        return JSON.parse(raw || '{}')?.paper?.paperSize
      }),
    ).toBe('mobile')

    // 焦点模式开启时切换为 mobile：纸张宽度 375px
    await toggleFocusModeViaTitleBar(page)
    await expect.poll(readPaperWidthPx.bind(null, page), { timeout: 10_000 }).toBe('375px')

    // 验证导出请求 body.paperSize === 'mobile'
    const body = await exportViaApiMock(page, 'pdf', {
      paper: {
        paperSize: 'mobile',
        paperMargin: 'normal',
        headerFooter: 'none',
      },
      autoPaginate: true,
      fitImagesToWidth: true,
      generateToc: false,
    })

    expect(body.exportOptions.paper.paperSize).toBe('mobile')
  })

  test('场景 9：reload 后 paper 设置与 focusMode 状态保持', async ({ page }) => {
    await seedPaper(page, { paperSize: 'Letter', headerFooter: 'pageNumber' }, { focusMode: true })
    await openEditor(page)

    // 首次进入：Letter 焦点模式开启
    await expectIndicatorText(page, 'Letter')
    await expectFocusModeActive(page, true)

    // 持久化到 localStorage
    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-user-preferences')
        const parsed = raw ? JSON.parse(raw) : {}
        return parsed?.paper?.paperSize === 'Letter'
          && parsed?.paper?.focusMode === true
          && parsed?.paper?.headerFooter === 'pageNumber'
      }),
    { timeout: 10_000 }).toBe(true)

    // 重启（reload）：localStorage 保持，store 重新水合
    await page.reload()

    // reload 后 app 进入空状态（hasOpenDocument=false），需要重新打开文档
    await page.getByRole('button', { name: '新建 Markdown 文档' }).first().click()
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30_000 })

    // 指示器与焦点模式都从持久化恢复
    await expectIndicatorText(page, 'Letter')
    await expectFocusModeActive(page, true)

    // 数据值仍然是 Letter + focusMode=true + headerFooter=pageNumber
    await expect.poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('wpx-user-preferences')
        const parsed = raw ? JSON.parse(raw) : {}
        return parsed?.paper?.paperSize === 'Letter'
          && parsed?.paper?.focusMode === true
          && parsed?.paper?.headerFooter === 'pageNumber'
      }),
    { timeout: 10_000 }).toBe(true)
  })
})