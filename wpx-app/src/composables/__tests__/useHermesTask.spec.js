/**
 * useHermesTask.spec.js —— Hermes 任务型执行 composable（M3-C）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHermesTask, extractTaskResult } from '@/composables/useHermesTask'

beforeEach(() => {
  setActivePinia(createPinia())
})

// ═════════════════════════════════════════════════
// extractTaskResult（纯函数）
// ═════════════════════════════════════════════════
describe('useHermesTask — extractTaskResult', () => {
  it('抽取 choices[0].message.content', () => {
    expect(extractTaskResult({ choices: [{ message: { content: ' 结果 ' } }] })).toBe('结果')
  })

  it('兼容 choices[0].text 与空响应', () => {
    expect(extractTaskResult({ choices: [{ text: 'x' }] })).toBe('x')
    expect(extractTaskResult(null)).toBe('')
    expect(extractTaskResult({})).toBe('')
  })
})

// ═════════════════════════════════════════════════
// run（mock fetch）
// ═════════════════════════════════════════════════
describe('useHermesTask — run', () => {
  it('成功路径：idle → running → done，返回结果', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe('http://127.0.0.1:3000/api/hermes/run')
      expect(JSON.parse(options.body).task).toBe('调研三款方案')
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, engine: 'hermes', data: { choices: [{ message: { content: '结论：选 A' } }] } }),
      }
    })
    const task = useHermesTask()
    const result = await task.run('调研三款方案', { baseUrl: 'http://127.0.0.1:3000', fetchImpl, stream: false })

    expect(result.ok).toBe(true)
    expect(result.result).toBe('结论：选 A')
    expect(task.status.value).toBe('done')
    expect(task.isDone.value).toBe(true)
    expect(task.steps.value).toContain('完成')
  })

  it('适配层返回 ok:false → error 状态', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, message: 'Hermes 网关暂不可用，已切换至云端 AI' }),
    }))
    const task = useHermesTask()
    const result = await task.run('任务', { baseUrl: 'http://x', fetchImpl, stream: false })

    expect(result.ok).toBe(false)
    expect(task.status.value).toBe('error')
    expect(task.error.value).toContain('网关暂不可用')
  })

  it('网关无结果（未配置模型）→ 明确错误提示', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { choices: [] } }),
    }))
    const task = useHermesTask()
    const result = await task.run('任务', { baseUrl: 'http://x', fetchImpl, stream: false })

    expect(result.ok).toBe(false)
    expect(task.error.value).toContain('未配置模型')
  })

  it('fetch 抛错 → error 状态且不抛穿', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const task = useHermesTask()
    const result = await task.run('任务', { baseUrl: 'http://x', fetchImpl, stream: false })

    expect(result.ok).toBe(false)
    expect(task.status.value).toBe('error')
    expect(task.error.value).toContain('ECONNREFUSED')
  })

  it('空任务直接返回失败；执行中拒绝并发', async () => {
    const task = useHermesTask()
    const empty = await task.run('   ', { fetchImpl: vi.fn() })
    expect(empty.ok).toBe(false)
    expect(empty.error).toContain('为空')

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { choices: [{ message: { content: 'x' } }] } }),
    }))
    const p1 = task.run('任务A', { baseUrl: 'http://x', fetchImpl, stream: false })
    const p2 = await task.run('任务B', { baseUrl: 'http://x', fetchImpl, stream: false })
    expect(p2.ok).toBe(false)
    expect(p2.error).toContain('执行中')
    await p1
  })

  it('reset 清空状态', async () => {
    const task = useHermesTask()
    task.reset()
    expect(task.status.value).toBe('idle')
    expect(task.result.value).toBe('')
  })
})

// ═════════════════════════════════════════════════
// 流式执行（M4）
// ═════════════════════════════════════════════════
describe('useHermesTask — 流式执行（M4）', () => {
  function sseResponse(chunks) {
    const { ReadableStream } = require('node:stream/web')
    return {
      ok: true,
      status: 200,
      body: ReadableStream.from(chunks.map((c) => new TextEncoder().encode(c))),
    }
  }

  it('流式成功：逐块累积结果并实时 onChunk', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe('http://127.0.0.1:3000/api/hermes/stream')
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    })
    const chunks = []
    const task = useHermesTask()
    const result = await task.run('任务', {
      baseUrl: 'http://127.0.0.1:3000',
      fetchImpl,
      onChunk: (t) => chunks.push(t),
    })

    expect(result.ok).toBe(true)
    expect(result.result).toBe('你好')
    expect(chunks).toEqual(['你', '你好'])
    expect(task.status.value).toBe('done')
  })

  it('流式端点不可用（无 body）→ 自动回退非流式', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes('/stream')) {
        return { ok: true, status: 200, body: null }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { choices: [{ message: { content: '回退结果' } }] } }),
      }
    })
    const task = useHermesTask()
    const result = await task.run('任务', { baseUrl: 'http://x', fetchImpl })

    expect(result.ok).toBe(true)
    expect(result.result).toBe('回退结果')
    expect(task.steps.value.join()).toContain('回退非流式')
  })

  it('流式无内容且未收到 [DONE] → 回退非流式', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes('/stream')) {
        return sseResponse(['data: {"choices":[]}\n\n'])
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { choices: [{ message: { content: '兜底' } }] } }),
      }
    })
    const task = useHermesTask()
    const result = await task.run('任务', { baseUrl: 'http://x', fetchImpl })
    expect(result.ok).toBe(true)
    expect(result.result).toBe('兜底')
  })
})
