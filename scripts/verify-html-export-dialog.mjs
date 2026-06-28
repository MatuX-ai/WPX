// HTML 导出弹窗 E2E 验证脚本
// 运行：cd wpx-app && node ../scripts/verify-html-export-dialog.mjs
import { createRequire } from 'node:module'
const require = createRequire('i:/WPX/wpx-app/package.json')
const { chromium } = require('playwright')

const BASE_URL = 'http://127.0.0.1:5173'
const SCREENSHOT_PATH = 'i:/WPX/fix-html-export-dialog.png'

async function main() {
  // 使用系统 Chrome，避免 Playwright 下载缺失
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--host-resolver-rules=MAP localhost 127.0.0.1',
    ],
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('[browser console error]', msg.text())
    }
  })
  page.on('pageerror', (err) => console.log('[page error]', err.message))
  page.on('requestfailed', (req) => console.log('[request failed]', req.url(), req.failure()?.errorText))

  console.log('1. 打开编辑器页面 …')
  try {
    await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log('   goto 返回成功')
  } catch (e) {
    console.log('   goto 失败:', e.message)
    // 尝试用 localhost
    console.log('   改用 localhost 重试 …')
    await page.goto(`http://localhost:5173/editor`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  // 等待编辑器加载完成（导出按钮存在）
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {})
  // 等待 vue 渲染
  await page.waitForTimeout(2000)

  // 如果是空状态，点击「新建 Markdown 文档」按钮创建文档，触发 EditorCore 渲染
  const newDocBtn = page.locator('button:has-text("新建 Markdown 文档")')
  if (await newDocBtn.count()) {
    console.log('   检测到空状态，点击「新建 Markdown 文档」…')
    await newDocBtn.first().click()
    await page.waitForTimeout(2000)
  }

  // 在编辑器中输入内容（避免「文档内容为空」提前 return）
  console.log('   在编辑器中输入内容 …')
  // Tiptap 编辑器是 contenteditable，找到 .ProseMirror
  const editor = page.locator('.ProseMirror').first()
  if (await editor.count()) {
    await editor.click()
    await page.keyboard.type('# 测试标题 1\n\n## 测试标题 2\n\n这是一段用于触发 HTML 导出弹窗的示例文本，包含三个标题。\n\n## 测试标题 3\n\n继续输入内容确保编辑器有 markdown。', { delay: 10 })
    await page.waitForTimeout(1500)
  } else {
    console.log('   未找到 .ProseMirror，尝试直接操作 contentEditable')
  }

  await page.screenshot({ path: 'i:/WPX/e2e-debug.png', fullPage: false })
  console.log('   截图保存到 i:/WPX/e2e-debug.png')
  // 先 dump 一下页面 DOM 结构，帮助定位
  const exportBtnCandidates = await page.locator('button').all()
  console.log(`   共发现 ${exportBtnCandidates.length} 个按钮，开始筛选"导出"相关按钮 …`)
  for (const btn of exportBtnCandidates) {
    const text = (await btn.textContent())?.trim().slice(0, 30) || ''
    const ariaLabel = (await btn.getAttribute('aria-label')) || ''
    const title = (await btn.getAttribute('title')) || ''
    if (
      ariaLabel.includes('导出') ||
      title.includes('导出') ||
      text.includes('导出')
    ) {
      console.log(`     候选按钮: text="${text}" aria-label="${ariaLabel}" title="${title}"`)
    }
  }
  const exportBtn = page.locator('button[aria-label*="导出"], button[title*="导出"]').first()
  await exportBtn.waitFor({ state: 'visible', timeout: 15000 })
  console.log('2. 点击「导出文档」 …')
  await exportBtn.click()

  // 等待下拉菜单出现，定位「导出 HTML」选项
  const htmlMenuItem = page.locator('button:has-text("导出 HTML")')
  await htmlMenuItem.waitFor({ state: 'visible', timeout: 5000 })
  console.log('3. 点击「导出 HTML」 …')
  await htmlMenuItem.click()

  // 等待弹窗出现
  const dialog = page.locator('[role="dialog"]')
  await dialog.waitFor({ state: 'visible', timeout: 5000 })

  // 验证弹窗标题是「HTML 导出选项」，不是「导出选项确认」
  const title = await dialog.locator('h2').first().textContent()
  console.log('4. 弹窗标题:', JSON.stringify(title?.trim()))

  if (title?.trim() !== 'HTML 导出选项') {
    console.error('FAIL: 期望标题为「HTML 导出选项」，实际为', JSON.stringify(title))
    process.exitCode = 1
  } else {
    console.log('✅ 弹窗标题正确：HTML 导出选项（不是 A4 纸张选项）')
  }

  // 验证字段集合（HTML 专属）
  const expectedSections = [
    { heading: '导出形式', required: true },
    { heading: '适配与排版', required: true },
    { heading: '导航辅助', required: true },
  ]
  for (const { heading } of expectedSections) {
    const count = await dialog.locator(`h3:has-text("${heading}")`).count()
    if (count === 0) {
      console.error(`FAIL: 缺少分区「${heading}」`)
      process.exitCode = 1
    } else {
      console.log(`✅ 找到分区「${heading}」`)
    }
  }

  // 验证不应该出现的 A4 字段
  const a4Hints = ['纸张尺寸', '页边距', '页眉页脚']
  for (const label of a4Hints) {
    const exists = await dialog.locator(`label:has-text("${label}")`).count()
    if (exists > 0) {
      console.error(`FAIL: HTML 弹窗不应包含「${label}」字段`)
      process.exitCode = 1
    } else {
      console.log(`✅ HTML 弹窗正确不包含「${label}」字段`)
    }
  }

  // 验证应该有：导出形式 / 完整 HTML 文档 / HTML 片段 / 打印纸张 / 目录
  const requiredTexts = [
    '完整 HTML 文档',
    'HTML 片段',
    '图片与表格自适应容器宽度',
    '启用打印分页',
    '生成目录',
  ]
  for (const text of requiredTexts) {
    const exists = await dialog.getByText(text, { exact: false }).count()
    if (exists === 0) {
      console.error(`FAIL: 缺少字段「${text}」`)
      process.exitCode = 1
    } else {
      console.log(`✅ 找到字段「${text}」`)
    }
  }

  // 验证打印纸张下拉选项是 A4 / Letter / B5 / 不设置（而不是 16K / mobile）
  const select = dialog.locator('select#export-html-print-paper')
  const selectCount = await select.count()
  if (selectCount === 0) {
    console.error('FAIL: 缺少打印纸张下拉框')
    process.exitCode = 1
  } else {
    const optionTexts = await select.locator('option').allTextContents()
    console.log('打印纸张选项:', optionTexts)
    const expected = ['A4', 'Letter', 'B5', '不设置']
    for (const expectedText of expected) {
      if (!optionTexts.some((t) => t.includes(expectedText))) {
        console.error(`FAIL: 打印纸张缺少「${expectedText}」`)
        process.exitCode = 1
      }
    }
    if (optionTexts.some((t) => t.includes('16 开') || t.includes('手机长图'))) {
      console.error('FAIL: HTML 弹窗不应展示 16K / 手机长图（CSS @page 不支持）')
      process.exitCode = 1
    } else {
      console.log('✅ 打印纸张选项正确：仅展示 CSS @page 支持的尺寸')
    }
  }

  // 截图存档
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false })
  console.log(`截图保存到：${SCREENSHOT_PATH}`)

  // 测试切换 documentMode：选「HTML 片段」
  console.log('5. 切换导出形式为 HTML 片段 …')
  await dialog.locator('input[name="export-html-document-mode"][value="fragment"]').click()
  const fragmentChecked = await dialog
    .locator('input[name="export-html-document-mode"][value="fragment"]')
    .isChecked()
  console.log('HTML 片段单选是否选中:', fragmentChecked)

  // 测试打印纸张切换为 Letter
  console.log('6. 切换打印纸张为 Letter …')
  await select.selectOption('Letter')

  await page.screenshot({ path: 'i:/WPX/fix-html-export-dialog-changed.png', fullPage: false })

  // 7. 拦截 /api/export 请求，捕获实际 fetch payload
  console.log('7. 监听 /api/export 请求 …')
  let capturedPayload = null
  await page.route('**/api/export', async (route) => {
    const req = route.request()
    try {
      capturedPayload = JSON.parse(req.postData() || '{}')
    } catch (e) {
      capturedPayload = { raw: req.postData() }
    }
    // 不实际发送，避免 local-server 未启动导致脚本卡住
    await route.abort('failed')
  })

  // 8. 点击「确认导出」
  console.log('8. 点击「确认导出」 …')
  const confirmBtn = dialog.locator('button:has-text("确认导出")')
  await confirmBtn.click()
  await page.waitForTimeout(2000)

  if (capturedPayload) {
    console.log('\n--- 实际 fetch payload ---')
    console.log(JSON.stringify(capturedPayload, null, 2))
    const exp = capturedPayload.exportOptions || {}
    console.log('\n--- 字段检查 ---')
    console.log(`  format = ${capturedPayload.format} ${capturedPayload.format === 'html' ? '✅' : '❌ 应为 html'}`)
    console.log(`  contentFormat = ${capturedPayload.contentFormat || '(未传)'} ${capturedPayload.contentFormat === 'html' ? '✅' : '❌ 嵌入字体时为 html'}`)
    console.log(`  exportOptions.printPaper = ${exp.printPaper} ${exp.printPaper === 'Letter' ? '✅' : '❌ 应为 Letter（用户选择）'}`)
    console.log(`  exportOptions.documentMode = ${exp.documentMode} ${exp.documentMode === 'fragment' ? '✅' : '❌ 应为 fragment'}`)
    console.log(`  exportOptions.autoPaginate = ${exp.autoPaginate} ${exp.autoPaginate === true ? '✅' : '❌'}`)
    console.log(`  exportOptions.fitImagesToWidth = ${exp.fitImagesToWidth} ${exp.fitImagesToWidth === true ? '✅' : '❌'}`)
    console.log(`  exportOptions.generateToc = ${exp.generateToc} ${exp.generateToc === false ? '✅' : '❌'}`)
    console.log(`  exportOptions.paper = ${exp.paper} ${exp.paper === undefined ? '✅' : '❌ HTML 不应包含 paper 字段'}`)
  } else {
    console.log('❌ 未捕获到 /api/export 请求')
    process.exitCode = 1
  }

  await browser.close()

  if (process.exitCode && process.exitCode !== 0) {
    console.log('\n❌ E2E 验证失败')
  } else {
    console.log('\n✅ E2E 验证全部通过')
  }
}

main().catch((err) => {
  console.error('脚本异常：', err)
  process.exit(1)
})
