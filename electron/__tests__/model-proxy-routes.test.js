/**
 * model-proxy-routes —— 上游 URL 拼接与代理转发
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Module from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const { buildUpstreamUrl } = require('../services/model-proxy-routes')

describe('buildUpstreamUrl', () => {
  it('拼接 upstream base 与 /api/model-proxy 后缀', () => {
    expect(
      buildUpstreamUrl('https://api.deepseek.com/v1', '/api/model-proxy/chat/completions'),
    ).toBe('https://api.deepseek.com/v1/chat/completions')
  })

  it('保留 query', () => {
    expect(
      buildUpstreamUrl('https://api.deepseek.com/v1', '/api/model-proxy/models?foo=1'),
    ).toBe('https://api.deepseek.com/v1/models?foo=1')
  })

  it('缺少 upstream 时返回空', () => {
    expect(buildUpstreamUrl('', '/api/model-proxy/chat/completions')).toBe('')
  })
})

describe('registerModelProxyRoutes', () => {
  /** @type {import('http').Server} */
  let server
  /** @type {string} */
  let baseUrl
  /** @type {typeof Module._load} */
  const originalLoad = Module._load

  beforeEach(async () => {
    Module._load = function loadElectronMock(request, parent, isMain) {
      if (request === 'electron') {
        return {
          app: {
            getPath: () => path.join(__dirname, '..', '..'),
            getName: () => 'wpx-test',
          },
        }
      }
      if (request.endsWith('model-secrets-store') || request.includes('model-secrets-store')) {
        return {
          getDecryptedApiKey: () => 'sk-from-store',
        }
      }
      return originalLoad.call(this, request, parent, isMain)
    }

    vi.resetModules()
    const { registerModelProxyRoutes } = require('../services/model-proxy-routes')

    const app = express()
    app.use(express.json({ limit: '1mb' }))

    const fetchImpl = vi.fn(async (url, options) => {
      expect(String(url)).toBe('https://api.deepseek.com/v1/chat/completions')
      expect(options.headers.Authorization).toBe('Bearer sk-test')
      const body = JSON.parse(options.body)
      expect(body.model).toBe('deepseek-chat')
      return new Response(JSON.stringify({ ok: true, echo: body }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    registerModelProxyRoutes(app, { fetchImpl })

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        baseUrl = `http://127.0.0.1:${addr.port}`
        resolve()
      })
    })
  })

  afterEach(async () => {
    Module._load = originalLoad
    if (server) {
      await new Promise((resolve) => server.close(resolve))
      server = null
    }
  })

  it('转发请求到上游并回传 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/model-proxy/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test',
        'X-WPX-Upstream-Base': 'https://api.deepseek.com/v1',
      },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.echo.model).toBe('deepseek-chat')
  })
})
