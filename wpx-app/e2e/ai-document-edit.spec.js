import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  openEditor,
  openAiChat,
  seedConfiguredTextApiKey,
  seedE2eSettings,
  sendAiInstruction,
  typeInEditor,
  editorLocator,
} from './helpers/editor.js'

test.describe('AI 画布内文档修订（V0.1）', () => {
  test('无选区：邮箱填写指令 → 画布更新 + summary，且不重复写入', async ({ page }) => {
    const aiReply = JSON.stringify({
      type: 'document_edit',
      edits: [{ anchor: '邮箱', text: '1055603323@qq.com', strategy: 'fill_label' }],
      summary: '已在「邮箱」处填入 1055603323@qq.com',
    })

    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, { aiReply })
    await openEditor(page)

    await typeInEditor(page, '姓名：\n邮箱：')
    await openAiChat(page)
    await sendAiInstruction(page, '邮箱那里写 1055603323@qq.com')

    const editor = editorLocator(page)
    await expect(editor).toContainText('1055603323@qq.com', { timeout: 30_000 })
    await expect(page.getByText('已在「邮箱」处填入 1055603323@qq.com')).toBeVisible()

    const emailCount = await editor.evaluate(() => {
      const text = document.querySelector('.ProseMirror')?.textContent || ''
      return (text.match(/1055603323@qq.com/g) || []).length
    })
    expect(emailCount).toBe(1)
  })
})
