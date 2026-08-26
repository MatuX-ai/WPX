/**
 * electronModelFetch —— 渲染进程侧主进程 fetch 适配
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  canUseElectronModelFetch,
  createElectronModelFetch,
} from '@/utils/electronModelFetch'

vi.mock('@/utils/electron', () => ({
  getElectronAPI: vi.fn(),
}))

import { getElectronAPI } from '@/utils/electron'

describe('canUseElectronModelFetch', () => {
  beforeEach(() => {
    vi.mocked(getElectronAPI).mockReset()
  })

  it('缺少 API 时返回 false', () => {
    vi.mocked(getElectronAPI).mockReturnValue(null)
    expect(canUseElectronModelFetch()).toBe(false)
  })

  it('具备 startFetch + onFetchEvent 时返回 true', () => {
    vi.mocked(getElectronAPI).mockReturnValue({
      models: {
        startFetch: vi.fn(),
        onFetchEvent: vi.fn(),
      },
    })
    expect(canUseElectronModelFetch()).toBe(true)
  })
})

describe('createElectronModelFetch', () => {
  beforeEach(() => {
    vi.mocked(getElectronAPI).mockReset()
  })

  it('组装 Response 并消费流式 chunk', async () => {
    /** @type {((event: any) => void) | null} */
    let listener = null
    const startFetch = vi.fn((payload) => {
      queueMicrotask(() => {
        listener?.({
          requestId: payload.requestId,
          type: 'meta',
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
        })
        listener?.({
          requestId: payload.requestId,
          type: 'chunk',
          chunk: Buffer.from('hi-from-main', 'utf8').toString('base64'),
        })
        listener?.({
          requestId: payload.requestId,
          type: 'end',
        })
      })
    })

    vi.mocked(getElectronAPI).mockReturnValue({
      models: {
        startFetch,
        abortFetch: vi.fn(),
        onFetchEvent: (cb) => {
          listener = cb
          return () => {
            listener = null
          }
        },
      },
    })

    const fetchImpl = createElectronModelFetch()
    const response = await fetchImpl('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer sk' },
      body: '{"x":1}',
    })

    expect(response.status).toBe(200)
    expect(startFetch).toHaveBeenCalledOnce()
    expect(startFetch.mock.calls[0][0].url).toBe(
      'https://api.example.com/v1/chat/completions',
    )
    expect(await response.text()).toBe('hi-from-main')
  })

  it('上游错误在 meta 前到达时抛出', async () => {
    /** @type {((event: any) => void) | null} */
    let listener = null
    vi.mocked(getElectronAPI).mockReturnValue({
      models: {
        startFetch: vi.fn((payload) => {
          queueMicrotask(() => {
            listener?.({
              requestId: payload.requestId,
              type: 'error',
              message: 'getaddrinfo ENOTFOUND',
            })
          })
        }),
        abortFetch: vi.fn(),
        onFetchEvent: (cb) => {
          listener = cb
          return () => {
            listener = null
          }
        },
      },
    })

    const fetchImpl = createElectronModelFetch()
    await expect(
      fetchImpl('https://api.example.com/v1/chat/completions', { method: 'POST' }),
    ).rejects.toThrow(/ENOTFOUND/)
  })
})
