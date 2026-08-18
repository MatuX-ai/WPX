import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  shouldUseJcode,
  shouldUseHermes,
  routeTask,
  COMPLEX_PATTERN_LIST,
  SIMPLE_PATTERN_LIST,
  HERMES_PATTERN_LIST,
} from '@/server/ai-router'

describe('ai-router — shouldUseJcode 路由决策', () => {
  it('空消息默认不走 jcode', () => {
    expect(shouldUseJcode('')).toBe(false)
    expect(shouldUseJcode('   ')).toBe(false)
    expect(shouldUseJcode(null)).toBe(false)
    expect(shouldUseJcode(undefined)).toBe(false)
  })

  it('简单指令(润色/改写/翻译/总结等)不走 jcode', () => {
    expect(shouldUseJcode('把这段话润色一下')).toBe(false)
    expect(shouldUseJcode('翻译成英文')).toBe(false)
    expect(shouldUseJcode('帮我总结一下要点')).toBe(false)
    expect(shouldUseJcode('缩写为 200 字')).toBe(false)
    expect(shouldUseJcode('改字体为黑体')).toBe(false)
    expect(shouldUseJcode('换颜色为蓝色')).toBe(false)
    expect(shouldUseJcode('把第三段加粗')).toBe(false)
  })

  it('复杂指令(PPT/论文/教案/文献综述)走 jcode', () => {
    expect(shouldUseJcode('帮我生成一份 8 页的 PPT')).toBe(true)
    expect(shouldUseJcode('做一份演示文稿,主题是新能源')).toBe(true)
    expect(shouldUseJcode('写一篇关于深度学习的论文')).toBe(true)
    expect(shouldUseJcode('出一份开题报告')).toBe(true)
    expect(shouldUseJcode('生成一份文献综述')).toBe(true)
    expect(shouldUseJcode('根据课程标准出一份教案')).toBe(true)
    expect(shouldUseJcode('用高性能模式写一篇论文')).toBe(true)
  })

  it('"分析资料库 / 文档" 类指令走 jcode', () => {
    expect(shouldUseJcode('分析我的资料库')).toBe(true)
    expect(shouldUseJcode('分析一下项目中的文档')).toBe(true)
  })

  it('多步骤指令(包含"然后")走 jcode', () => {
    expect(shouldUseJcode('先把大纲列出来,然后根据大纲生成 PPT')).toBe(true)
  })

  it('长度超过 200 字且无简单模式命中时走 jcode', () => {
    // 用 'a' 填充,确保不命中「润色/改写/翻译」等简单模式
    const longText = 'a'.repeat(250)
    expect(shouldUseJcode(longText)).toBe(true)
  })

  it('自定义 lengthThreshold 生效', () => {
    const text = 'a'.repeat(120)
    expect(shouldUseJcode(text, { lengthThreshold: 100 })).toBe(true)
    expect(shouldUseJcode(text, { lengthThreshold: 200 })).toBe(false)
  })

  it('forceJcode 强制覆盖:简单指令也走 jcode', () => {
    expect(shouldUseJcode('润色一下', { forceJcode: true })).toBe(true)
    expect(shouldUseJcode('翻译成英文', { forceJcode: true })).toBe(true)
  })

  it('simpleOverrides 强制覆盖:复杂指令也不走 jcode', () => {
    expect(shouldUseJcode('帮我生成 PPT', { simpleOverrides: true })).toBe(false)
    expect(shouldUseJcode('写一篇论文', { simpleOverrides: true })).toBe(false)
  })

  it('复杂与简单规则冲突时,简单规则优先(命中即返回 false)', () => {
    // 这是一个实际场景:用户先说"翻译"再要求"长篇"
    expect(shouldUseJcode('翻译这篇长篇论文')).toBe(false)
  })

  it('导出正则列表常量', () => {
    expect(COMPLEX_PATTERN_LIST).toBeInstanceOf(Array)
    expect(COMPLEX_PATTERN_LIST.length).toBeGreaterThan(0)
    expect(SIMPLE_PATTERN_LIST).toBeInstanceOf(Array)
    expect(SIMPLE_PATTERN_LIST.length).toBeGreaterThan(0)
    // 正则都能编译
    COMPLEX_PATTERN_LIST.forEach((p) => expect(p).toBeInstanceOf(RegExp))
    SIMPLE_PATTERN_LIST.forEach((p) => expect(p).toBeInstanceOf(RegExp))
  })
})

describe('ai-router — routeTask 路由执行', () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.WPX_LOCAL_SERVER_URL
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('简单指令(应走云端)直接返回 skippedJcode,不发请求', async () => {
    const fetchMock = vi.fn()
    global.fetch = fetchMock

    const result = await routeTask({
      task: 'polish_text',
      params: { userMessage: '把这段话润色一下' },
    })

    expect(result.ok).toBe(true)
    expect(result.engine).toBe('cloud')
    expect(result.skippedJcode).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('复杂指令但未提供 localServerUrl 时降级到云端', async () => {
    const result = await routeTask({
      task: 'generate_ppt',
      params: { userMessage: '帮我生成一份 8 页的 PPT' },
    })

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('local_server_unavailable')
    expect(result.message).toMatch(/jcode 适配层未启动|云端 AI/)
  })

  it('forceJcode=true 时即使简单指令也尝试 jcode', async () => {
    let captured = null
    const fetchMock = vi.fn(async (url, init) => {
      captured = { url, init }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, data: { result: 'mocked' } }),
      }
    })

    const result = await routeTask(
      { task: 'polish', params: { userMessage: '润色' } },
      { forceJcode: true, localServerUrl: 'http://127.0.0.1:1111', fetchImpl: fetchMock },
    )

    expect(result.ok).toBe(true)
    expect(result.engine).toBe('jcode')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(captured.url).toBe('http://127.0.0.1:1111/api/jcode/swarm')
    const body = JSON.parse(captured.init.body)
    expect(body.task).toBe('polish')
  })

  it('复杂指令 + 适配层返回 ok=false 时透明降级', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ ok: false, fallbackReason: 'jcode_disabled', message: 'jcode 未启用' }),
    }))

    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写一篇论文' } },
      { localServerUrl: 'http://127.0.0.1:2222', fetchImpl: fetchMock },
    )

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('jcode_disabled')
    expect(result.message).toContain('jcode 未启用')
  })

  it('复杂指令 + 适配层 HTTP 500 时返回 http_error', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }))

    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写一篇论文' } },
      { localServerUrl: 'http://127.0.0.1:3333', fetchImpl: fetchMock },
    )

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('http_error')
    expect(result.status).toBe(500)
  })

  it('fetch 抛错时返回 jcode_error 并保留原始 message', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:8765')
    })

    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写一篇论文' } },
      { localServerUrl: 'http://127.0.0.1:4444', fetchImpl: fetchMock },
    )

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('jcode_error')
    expect(result.message).toMatch(/ECONNREFUSED/)
  })

  it('AbortError 触发时返回 jcode_timeout', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      // 模拟超时:signal 上抛 AbortError
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })
    })

    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写一篇论文' } },
      { localServerUrl: 'http://127.0.0.1:5555', fetchImpl: fetchMock, timeoutMs: 50 },
    )

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('jcode_timeout')
  })

  it('传入 payload.context.forceJcode=true 时也走 jcode', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, data: { x: 1 } }),
    }))

    const result = await routeTask(
      {
        task: 'polish',
        params: { userMessage: '润色' },
        context: { forceJcode: true },
      },
      { localServerUrl: 'http://127.0.0.1:6666', fetchImpl: fetchMock },
    )

    expect(result.ok).toBe(true)
    expect(result.engine).toBe('jcode')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('localServerUrl 带尾斜杠时正确归一化', async () => {
    let captured = null
    const fetchMock = vi.fn(async (url, init) => {
      captured = { url, init }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      }
    })

    await routeTask(
      { task: 'paper', params: { userMessage: '写论文' } },
      { localServerUrl: 'http://127.0.0.1:7777/', fetchImpl: fetchMock },
    )

    expect(captured.url).toBe('http://127.0.0.1:7777/api/jcode/swarm')
  })

  it('未提供 fetchImpl 且无全局 fetch 时返回 fetch_unavailable', async () => {
    const originalGlobalFetch = global.fetch
    // @ts-ignore
    delete global.fetch

    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写论文' } },
      { localServerUrl: 'http://127.0.0.1:8888' },
    )

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('fetch_unavailable')

    global.fetch = originalGlobalFetch
  })

  it('支持 options.signal 外部中断', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 30)

    const fetchMock = vi.fn(async (_url, init) => {
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })
    })

    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写论文' } },
      { localServerUrl: 'http://127.0.0.1:9999', fetchImpl: fetchMock, signal: controller.signal },
    )

    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('jcode_timeout')
  })
})

// ═════════════════════════════════════════════════
// M3：shouldUseHermes 路由决策
// ═════════════════════════════════════════════════
describe('ai-router — shouldUseHermes 路由决策', () => {
  it('空消息不走 Hermes', () => {
    expect(shouldUseHermes('')).toBe(false)
    expect(shouldUseHermes(null)).toBe(false)
  })

  it('显式指令（用 Hermes / hermes）命中', () => {
    expect(shouldUseHermes('用 Hermes 帮我调研')).toBe(true)
    expect(shouldUseHermes('hermes 对比三个方案')).toBe(true)
  })

  it('开放式自主任务关键词命中', () => {
    expect(shouldUseHermes('自主完成一次全网调研')).toBe(true)
    expect(shouldUseHermes('对比这三个方案并给出建议')).toBe(true)
  })

  it('默认不按长度自动路由；开启 autoRouteEnabled 且超长才命中', () => {
    const longText = 'x'.repeat(250)
    expect(shouldUseHermes(longText)).toBe(false)
    expect(shouldUseHermes(longText, { autoRouteEnabled: true })).toBe(true)
    expect(shouldUseHermes('短文', { autoRouteEnabled: true })).toBe(false)
  })

  it('forceHermes 强制命中', () => {
    expect(shouldUseHermes('随便说点什么', { forceHermes: true })).toBe(true)
  })

  it('HERMES_PATTERN_LIST 已导出', () => {
    expect(Array.isArray(HERMES_PATTERN_LIST)).toBe(true)
    expect(HERMES_PATTERN_LIST.length).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════
// M3：routeTask engine:'hermes'
// ═════════════════════════════════════════════════
describe('ai-router — routeTask hermes 引擎', () => {
  it('engine:"hermes" 时请求 /api/hermes/run 并返回 engine:"hermes"', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(url).toBe('http://127.0.0.1:8888/api/hermes/run')
      expect(JSON.parse(init.body).task).toBe('调研')
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, engine: 'hermes', data: { answer: '结论' } }),
      }
    })
    const result = await routeTask(
      { task: '调研', params: { userMessage: '调研三款产品' } },
      { localServerUrl: 'http://127.0.0.1:8888', fetchImpl: fetchMock, engine: 'hermes' },
    )
    expect(result.ok).toBe(true)
    expect(result.engine).toBe('hermes')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forceHermes 上下文同样走 hermes 端点', async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    }))
    const result = await routeTask(
      { task: 'x', context: { forceHermes: true } },
      { localServerUrl: 'http://127.0.0.1:8888', fetchImpl: fetchMock },
    )
    expect(fetchMock.mock.calls[0][0]).toContain('/api/hermes/run')
    expect(result.engine).toBe('hermes')
  })

  it('hermes 适配层返回 ok:false 时透传降级原因', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: false, fallbackReason: 'hermes_unavailable', message: '网关未启动' }),
    }))
    const result = await routeTask(
      { task: 'x' },
      { localServerUrl: 'http://127.0.0.1:8888', fetchImpl: fetchMock, engine: 'hermes' },
    )
    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('hermes_unavailable')
    expect(result.message).toContain('网关未启动')
  })

  it('hermes 调用超时 → hermes_timeout（jcode 端点为 /api/jcode/swarm 不受影响）', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })
    })
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)
    const result = await routeTask(
      { task: 'x' },
      {
        localServerUrl: 'http://127.0.0.1:8888',
        fetchImpl: fetchMock,
        engine: 'hermes',
        signal: controller.signal,
      },
    )
    expect(result.ok).toBe(false)
    expect(result.fallbackReason).toBe('hermes_timeout')
  })

  it('默认 jcode 路由仍走 /api/jcode/swarm（不回归）', async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    }))
    const result = await routeTask(
      { task: 'paper', params: { userMessage: '写论文' } },
      { localServerUrl: 'http://127.0.0.1:8888', fetchImpl: fetchMock },
    )
    expect(fetchMock.mock.calls[0][0]).toContain('/api/jcode/swarm')
    expect(result.engine).toBe('jcode')
  })
})
