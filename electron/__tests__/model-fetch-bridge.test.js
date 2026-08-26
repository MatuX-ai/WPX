/**
 * model-fetch-bridge —— 主进程流式转发
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ReadableStream } from 'node:stream/web'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const {
  handleFetchStream,
  normalizeHeaders,
} = require('../services/model-fetch-bridge')

describe('normalizeHeaders', () => {
  it('过滤空值并转为字符串', () => {
    expect(
      normalizeHeaders({
        Authorization: 'Bearer sk',
        Accept: '',
        'X-Test': 1,
      }),
    ).toEqual({
      Authorization: 'Bearer sk',
      'X-Test': '1',
    })
  })
})

describe('handleFetchStream', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('将上游响应以 meta/chunk/end 事件回传', async () => {
    const sent = []
    const event = {
      sender: {
        isDestroyed: () => false,
        send: (_channel, payload) => {
          sent.push(payload)
        },
      },
    }

    const fetchImpl = vi.fn(async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('hello'))
          controller.close()
        },
      })
      return new Response(body, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      })
    })

    await handleFetchStream(
      event,
      {
        requestId: 'req-1',
        url: 'https://api.example.com/v1/chat/completions',
        method: 'POST',
        headers: { Authorization: 'Bearer sk' },
        body: '{"model":"x"}',
      },
      fetchImpl,
    )

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://api.example.com/v1/chat/completions',
    )
    expect(sent[0]).toMatchObject({
      requestId: 'req-1',
      type: 'meta',
      status: 200,
    })
    expect(sent.some((e) => e.type === 'chunk')).toBe(true)
    expect(sent.at(-1)).toMatchObject({ requestId: 'req-1', type: 'end' })

    const chunkEvent = sent.find((e) => e.type === 'chunk')
    expect(Buffer.from(chunkEvent.chunk, 'base64').toString('utf8')).toBe('hello')
  })

  it('拒绝非 http(s) URL', async () => {
    const sent = []
    const event = {
      sender: {
        isDestroyed: () => false,
        send: (_channel, payload) => {
          sent.push(payload)
        },
      },
    }

    await handleFetchStream(event, {
      requestId: 'req-2',
      url: 'file:///tmp/x',
    })

    expect(sent).toEqual([
      {
        requestId: 'req-2',
        type: 'error',
        message: '仅支持 http(s) 模型接口',
      },
    ])
  })
})
