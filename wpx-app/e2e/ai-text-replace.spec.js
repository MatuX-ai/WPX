import { test, expect } from '@playwright/test'
import { setupE2eMocks } from './helpers/mocks.js'
import {
  openEditor,
  openAiChat,
  seedConfiguredTextApiKey,
  seedE2eSettings,
  selectAllEditorText,
  sendAiInstruction,
  typeInEditor,
  aiChatInput,
} from './helpers/editor.js'

test.describe('AI 选区改写流程', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSettings(page)
    await seedConfiguredTextApiKey(page)
    await setupE2eMocks(page, { aiReply: '润色后的精彩文字' })
    await openEditor(page)
  })

  test('输入文字 → 选中 → 打开 AI → 发送指令 → 替换选区', async ({ page }) => {
    const originalText = '这是一段需要润色的文字'

    await typeInEditor(page, originalText)
    await selectAllEditorText(page)
    await expect(page.getByText(/已选中\s+\d+\s+字/)).toBeVisible()

    await openAiChat(page)

    const chatInput = aiChatInput(page)
    await chatInput.focus()
    await expect(page.locator('.ai-chat-panel__context-text')).toContainText(originalText)

    await sendAiInstruction(page, '请润色这段话')

    await expect(page.locator('.ProseMirror')).toContainText('润色后的精彩文字', {
      timeout: 30_000,
    })
    await expect(page.locator('.ProseMirror')).not.toContainText('需要润色')
  })
})
