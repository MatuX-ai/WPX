import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiChat, getMessageText } from '@/composables/useAiChat'
import { useModelSettingsStore } from '@/stores/modelSettings'

function buildSseBody(text) {
  const chunks = [
    `data: ${JSON.stringify({
      id: 'chatcmpl-e2e',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: 'chatcmpl-e2e',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: 'chatcmpl-e2e',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`,
    'data: [DONE]\n\n',
  ]
  return chunks.join('')
}

describe('useAiChat onChatFinish', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.setItem('wpx-model-secrets-web', JSON.stringify({ text: 'e2e-test-key' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(buildSseBody('MOCK_OK')))
            controller.close()
          },
        }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('onChatFinish fires after sendMessage and chat has assistant text', async () => {
    const finishCalls = []
    const modelSettingsStore = useModelSettingsStore()
    await modelSettingsStore.initFromLocalStorage()

    const { sendMessage, chatRef } = useAiChat('system', {
      onChatFinish: () => finishCalls.push('finish'),
    })

    await sendMessage({ text: '你好' })
    await vi.waitFor(() => {
      expect(finishCalls.length).toBeGreaterThan(0)
    })

    const assistant = chatRef.value.messages.filter((m) => m.role === 'assistant').pop()
    expect(assistant).toBeTruthy()
    expect(getMessageText(assistant)).toBe('MOCK_OK')
  })
})
