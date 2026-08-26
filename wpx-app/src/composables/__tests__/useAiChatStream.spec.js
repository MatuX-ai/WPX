import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getMessageText } from '@/composables/useAiChat'

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

describe('DirectChatTransport + OpenAI mock SSE', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(buildSseBody('MOCK_OK')))
          controller.close()
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('produces assistant text parts after stream', async () => {
    const provider = createOpenAICompatible({
      name: 'deepseek',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com/v1',
    })

    const agent = new ToolLoopAgent({ model: provider('deepseek-chat') })
    const syncTick = { value: 0 }
    const chat = new Chat({
      transport: new DirectChatTransport({ agent }),
      onData: () => {
        syncTick.value += 1
      },
      onFinish: () => {
        syncTick.value += 1
      },
    })

    await chat.sendMessage({ text: '你好' })

    expect(fetchMock).toHaveBeenCalled()
    const assistant = chat.messages.filter((m) => m.role === 'assistant').pop()
    expect(getMessageText(assistant)).toBe('MOCK_OK')
    expect(chat.status).toBe('ready')
  })
})
