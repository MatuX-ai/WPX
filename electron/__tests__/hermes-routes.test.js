/**
 * hermes-routes 单元测试（Phase 3 / M3，mock fetchImpl）
 *
 * 运行：npm --prefix wpx-app run test:zip -- hermes-routes
 */
import { describe, expect, it, vi } from 'vitest'
import { ReadableStream } from 'node:stream/web'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  buildChatMessages,
  buildGatewayUrl,
  createHermesHandlers,
} = require('../services/hermes-routes.js')

function jsonRes() {
  const res = {
    json: vi.fn(),
    status: vi.fn(() => res),
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    headersSent: false,
  }
  return res
}

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

// ═════════════════════════════════════════════════
// 1. 纯函数
// ═════════════════════════════════════════════════
describe('hermes-routes — 纯函数', () => {
  it('buildChatMessages：system + user 任务', () => {
    const messages = buildChatMessages({ task: '调研对比三款方案', params: { userMessage: 'x' } })
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1]).toEqual({ role: 'user', content: '调研对比三款方案' })
  })

  it('buildChatMessages：缺任务时给出兜底提示', () => {
    const messages = buildChatMessages({})
    expect(messages[1].content).toContain('你能做什么')
  })

  it('buildGatewayUrl：去尾部斜杠拼接', () => {
    expect(buildGatewayUrl('http://127.0.0.1:8642/', '/health')).toBe('http://127.0.0.1:8642/health')
    expect(buildGatewayUrl(undefined, '/v1/chat/completions')).toContain('127.0.0.1:8642')
  })
})

// ═════════════════════════════════════════════════
// 2. health
// ═════════════════════════════════════════════════
describe('hermes-routes — health', () => {
  it('网关健康 → gatewayUp:true', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe('http://127.0.0.1:8642/health')
      return jsonResponse({ status: 'ok' })
    })
    const { health } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await health({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, gatewayUp: true }))
  })

  it('网关不健康（HTTP 非 2xx）→ gatewayUp:false', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => null }))
    const { health } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await health({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ gatewayUp: false, status: 503 }))
  })

  it('fetch 抛错 → 透明降级 hermes_unavailable', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('connection refused') })
    const { health } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await health({}, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      fallbackReason: 'hermes_unavailable',
    }))
  })
})

// ═════════════════════════════════════════════════
// 3. run
// ═════════════════════════════════════════════════
describe('hermes-routes — run', () => {
  it('成功：转发到 OpenAI 兼容 chat 端点并透传响应', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe('http://127.0.0.1:8642/v1/chat/completions')
      const body = JSON.parse(options.body)
      expect(body.messages[1].content).toBe('帮我写周报')
      expect(body.stream).toBe(false)
      return jsonResponse({ choices: [{ message: { content: '好的' } }] })
    })
    const { run } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await run({ body: { task: '帮我写周报', sessionId: 's1' } }, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      engine: 'hermes',
      sessionId: 's1',
    }))
  })

  it('携带 Bearer 鉴权（gatewayKey）与 X-Hermes-Session-Id 会话延续头', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.headers.Authorization).toBe('Bearer sk-test')
      expect(options.headers['X-Hermes-Session-Id']).toBe('sess-42')
      return jsonResponse({ choices: [] })
    })
    const { run } = createHermesHandlers({ gatewayKey: 'sk-test', fetchImpl })
    const res = jsonRes()
    await run({ body: { task: 'x', sessionId: 'sess-42' } }, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }))
  })

  it('gatewayKey 可为函数（动态取 launcher 当前 key）', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.headers.Authorization).toBe('Bearer dynamic-key')
      return jsonResponse({ choices: [] })
    })
    const { run } = createHermesHandlers({ gatewayKey: () => 'dynamic-key', fetchImpl })
    const res = jsonRes()
    await run({ body: { task: 'x' } }, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }))
  })

  it('无 key 时不发送 Authorization 头', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.headers.Authorization).toBeUndefined()
      return jsonResponse({ choices: [] })
    })
    const { run } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await run({ body: { task: 'x' } }, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }))
  })

  it('网关 HTTP 错误 → hermes_http_error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => null }))
    const { run } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await run({ body: { task: 'x' } }, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      fallbackReason: 'hermes_http_error',
      status: 500,
    }))
  })

  it('fetch 抛错 → hermes_unavailable', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    const { run } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await run({ body: { task: 'x' } }, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ fallbackReason: 'hermes_unavailable' }))
  })
})

// ═════════════════════════════════════════════════
// 4. stream（SSE 透传）
// ═════════════════════════════════════════════════
describe('hermes-routes — stream', () => {
  it('上游非 2xx → 返回错误 JSON', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 502, body: null }))
    const { stream } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await stream({ body: { task: 'x' } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }))
  })

  it('上游 OK → 逐块透传 SSE 并结束', async () => {
    const body = ReadableStream.from(['data: {"a":1}\n\n', 'data: [DONE]\n\n'])
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, body }))
    const { stream } = createHermesHandlers({ fetchImpl })
    const res = jsonRes()
    await stream({ body: { task: 'x' } }, res)
    // 等待 pump 微任务完成
    await new Promise((r) => setTimeout(r, 20))
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8')
    expect(res.write).toHaveBeenCalledTimes(2)
    expect(res.end).toHaveBeenCalled()
  })
})
