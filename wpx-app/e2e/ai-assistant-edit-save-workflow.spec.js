/**
 * AI 助理驱动的「编辑 → 保存 → 文库再打开」工作流 E2E
 *
 * 覆盖缺口（对照 docs/WPX全项目测试用例设计文档.md）：
 *   - AI 多轮改写后保存
 *   - 助理本地指令「保存」打开保存对话框
 *   - 保存后文库闭环（搜索 → 重新打开 → 内容一致）
 *   - 不同文档类型（周报 / 教案）的 AI 建议路径
 *   - 助理本地指令「加粗」编辑后再保存
 */
import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  aiChatInput,
  confirmSaveDialog,
  fetchLibraryDocumentViaPage,
  openAiChat,
  openEditor,
  openLibraryDocumentBySearch,
  openLibraryView,
  openSaveDialog,
  saveViaAiAssistant,
  seedConfiguredTextApiKey,
  seedE2eSettings,
  selectAllEditorText,
  sendAiInstruction,
  typeInEditor,
  editorLocator,
} from './helpers/editor.js'

test.describe('AI 助理编辑与保存工作流', () => {
  test('选区润色 → 工具栏保存 → 文库搜索再打开（Markdown 周报闭环）', async ({
    page,
  }) => {
    const rewritten = '本周完成了编辑器与文库保存闭环验收。'
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, {
      aiReply: rewritten,
      analyzeResult: {
        title: '周报验收稿',
        path: '工作/周报',
        tags: ['周报', '验收'],
        summary: '周报保存闭环摘要',
      },
    })
    await openEditor(page)

    await typeInEditor(page, '这是需要润色的周报草稿')
    await selectAllEditorText(page)
    await openAiChat(page)
    await sendAiInstruction(page, '请润色这段周报')

    await expect(editorLocator(page)).toContainText(rewritten, { timeout: 30_000 })

    const saveRequest = page.waitForRequest(
      (req) => req.url().includes('/api/library/save') && req.method() === 'POST',
    )
    await openSaveDialog(page)
    await expect(
      page.locator('.save-dialog__field').filter({ hasText: '文档标题' }).locator('input'),
    ).toHaveValue('周报验收稿', { timeout: 20_000 })
    await confirmSaveDialog(page)

    const request = await saveRequest
    const payload = request.postDataJSON()
    expect(payload.title).toBe('周报验收稿')
    expect(payload.path).toBe('工作/周报')
    expect(payload.content).toContain(rewritten)
    expect(payload.tags).toEqual(expect.arrayContaining(['周报', '验收']))

    const relativePath = payload.path + '/' + payload.title + '.md'
    const stored = await fetchLibraryDocumentViaPage(page, relativePath)
    expect(stored.content).toContain(rewritten)

    await openLibraryView(page)
    await openLibraryDocumentBySearch(page, '周报验收稿')
    await expect(editorLocator(page)).toContainText(rewritten, { timeout: 15_000 })
  })

  test('助理本地指令「保存」打开对话框并落盘', async ({ page }) => {
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, {
      analyzeResult: {
        title: '本地指令保存稿',
        path: '工作/笔记',
        tags: ['本地指令'],
        summary: '通过助理保存触发',
      },
    })
    await openEditor(page)

    await typeInEditor(page, '# 本地指令保存\n\n正文由用户手写，经助理触发保存。')

    const saveRequest = page.waitForRequest(
      (req) => req.url().includes('/api/library/save') && req.method() === 'POST',
    )
    await saveViaAiAssistant(page, '保存')

    await expect(page.getByText('✅ 正在保存文档…')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('.save-dialog__field').filter({ hasText: '分类路径' }).locator('input'),
    ).toHaveValue('工作/笔记', { timeout: 20_000 })

    await confirmSaveDialog(page)
    const payload = (await saveRequest).postDataJSON()
    expect(payload.title).toBe('本地指令保存稿')
    expect(payload.content).toContain('本地指令保存')
  })

  test('多轮选区改写后保存（第二轮覆盖第一轮）', async ({ page }) => {
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, {
      aiReplies: ['第一轮改写结果：初稿已整理。', '第二轮改写结果：终稿可提交。'],
      analyzeResult: {
        title: '多轮改写终稿',
        path: '工作/方案',
        tags: ['多轮'],
        summary: '多轮对话改写',
      },
    })
    await openEditor(page)

    await typeInEditor(page, '原始草稿内容')
    await selectAllEditorText(page)
    await openAiChat(page)
    await sendAiInstruction(page, '请整理这段文字')
    await expect(editorLocator(page)).toContainText('第一轮改写结果', { timeout: 30_000 })

    // 对话窗未钉住时会挡住编辑器；先关掉再选区，随后重新打开以冻结选区
    const chatTitle = page.locator('#ai-chat-window-title')
    if (await chatTitle.isVisible().catch(() => false)) {
      await page.locator('button.ai-avatar-btn').click()
      await expect(chatTitle).toBeHidden({ timeout: 10_000 })
    }
    await selectAllEditorText(page)
    await expect(page.getByText(/已选中\s+\d+\s+字/)).toBeVisible({ timeout: 10_000 })
    await openAiChat(page)
    await aiChatInput(page).focus()
    await expect(page.locator('.ai-chat-panel__context-text')).toContainText('第一轮改写结果', {
      timeout: 10_000,
    })
    await sendAiInstruction(page, '再精简成终稿')
    await expect(editorLocator(page)).toContainText('第二轮改写结果：终稿可提交。', {
      timeout: 30_000,
    })
    await expect(editorLocator(page)).not.toContainText('第一轮改写结果')

    const saveRequest = page.waitForRequest(
      (req) => req.url().includes('/api/library/save') && req.method() === 'POST',
    )
    await openSaveDialog(page)
    await confirmSaveDialog(page)

    const payload = (await saveRequest).postDataJSON()
    expect(payload.content).toContain('终稿可提交')
    expect(payload.content).not.toContain('原始草稿')

    const relativePath = `${payload.path}/${payload.title}.md`
    const stored = await fetchLibraryDocumentViaPage(page, relativePath)
    expect(stored.content).toContain('终稿可提交')
  })

  test('教案类文档：AI 建议路径不同，保存后可再打开', async ({ page }) => {
    const lessonBody = '教学目标：掌握一元一次方程的解法。'
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, {
      aiReply: lessonBody,
      analyzeResult: {
        title: '一元一次方程教案',
        path: '教学/教案',
        tags: ['教案', '数学'],
        summary: '初中数学教案',
      },
    })
    await openEditor(page)

    await typeInEditor(page, '教案草稿：方程')
    await selectAllEditorText(page)
    await openAiChat(page)
    await sendAiInstruction(page, '扩写成教案正文')
    await expect(editorLocator(page)).toContainText(lessonBody, { timeout: 30_000 })

    await openSaveDialog(page)
    await expect(
      page.locator('.save-dialog__field').filter({ hasText: '分类路径' }).locator('input'),
    ).toHaveValue('教学/教案', { timeout: 20_000 })
    await expect(page.locator('.save-dialog__tag').filter({ hasText: '教案' })).toBeVisible()
    await confirmSaveDialog(page)

    await openLibraryView(page)
    await openLibraryDocumentBySearch(page, '一元一次方程教案', '一元一次方程教案')
    await expect(editorLocator(page)).toContainText('一元一次方程')
  })

  test('助理本地指令「加粗」编辑选区后再保存', async ({ page }) => {
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, {
      analyzeResult: {
        title: '格式编辑保存稿',
        path: '工作/笔记',
        tags: ['格式'],
        summary: '本地指令加粗后保存',
      },
    })
    await openEditor(page)

    await typeInEditor(page, '需要加粗的标题行')
    await selectAllEditorText(page)
    await openAiChat(page)
    await sendAiInstruction(page, '加粗')

    await expect(page.getByText('✅ 已切换加粗')).toBeVisible({ timeout: 10_000 })
    await expect(editorLocator(page).locator('strong, b')).toContainText('需要加粗的标题行', {
      timeout: 10_000,
    })

    const saveRequest = page.waitForRequest(
      (req) => req.url().includes('/api/library/save') && req.method() === 'POST',
    )
    await saveViaAiAssistant(page, '保存文档')
    await confirmSaveDialog(page)

    const payload = (await saveRequest).postDataJSON()
    expect(payload.title).toBe('格式编辑保存稿')
    expect(payload.content).toContain('需要加粗的标题行')
  })

  test('助理「新建」本地指令可清空并继续编辑保存', async ({ page }) => {
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, {
      analyzeResult: {
        title: '新建后保存稿',
        path: '工作/笔记',
        tags: ['新建'],
        summary: '新建空白后再写',
      },
    })
    await openEditor(page)

    await typeInEditor(page, '旧文档内容应被新建清空')
    await openAiChat(page)
    await sendAiInstruction(page, '新建文档')
    await expect(page.getByText(/✅ 已新建空白文档/)).toBeVisible({ timeout: 15_000 })

    await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 })
    await expect(editorLocator(page)).not.toContainText('旧文档内容应被新建清空', {
      timeout: 10_000,
    })

    await typeInEditor(page, '新建后的正文内容')

    const saveRequest = page.waitForRequest(
      (req) => req.url().includes('/api/library/save') && req.method() === 'POST',
    )
    await openSaveDialog(page)
    await confirmSaveDialog(page)

    const payload = (await saveRequest).postDataJSON()
    expect(payload.content).toContain('新建后的正文内容')
    expect(payload.content).not.toContain('旧文档内容应被新建清空')

    const relativePath = `${payload.path}/${payload.title}.md`
    const stored = await fetchLibraryDocumentViaPage(page, relativePath)
    expect(stored.content).toContain('新建后的正文内容')
  })
})
