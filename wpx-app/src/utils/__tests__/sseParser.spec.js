/**
 * sseParser.spec.js —— OpenAI SSE 流解析（M4 打磨）
 */
import { describe, it, expect } from 'vitest'
import { decodeChunk, extractDeltaText, createSseParser } from '@/utils/sseParser'

describe('sseParser — decodeChunk', () => {
  it('字符串原样返回', () => {
    expect(decodeChunk('abc')).toBe('abc')
  })

  it('Uint8Array 解码为 UTF-8', () => {
    const bytes = new TextEncoder().encode('你好')
    expect(decodeChunk(bytes)).toBe('你好')
  })
})

describe('sseParser — extractDeltaText', () => {
  it('提取 choices[0].delta.content', () => {
    expect(extractDeltaText({ choices: [{ delta: { content: '增量' } }] })).toBe('增量')
  })

  it('空/无 delta 返回空串', () => {
    expect(extractDeltaText(null)).toBe('')
    expect(extractDeltaText({})).toBe('')
    expect(extractDeltaText({ choices: [] })).toBe('')
  })
})

describe('sseParser — createSseParser', () => {
  it('逐块解析 data 事件并累积', () => {
    const events = []
    const push = createSseParser((e) => events.push(e))
    push('data: {"choices":[{"delta":{"content":"你"}}]}\n\n')
    push('data: {"choices":[{"delta":{"content":"好"}}]}\n\n')
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('data')
    expect(events[0].data.choices[0].delta.content).toBe('你')
  })

  it('跨块拼接不完整行（chunk 在行中间切开）', () => {
    const events = []
    const push = createSseParser((e) => events.push(e))
    push('data: {"choices":[{"delta":{"content":"hello')
    push('"}}]}\n\ndata: [DONE]\n\n')
    expect(events).toHaveLength(2)
    expect(events[0].data.choices[0].delta.content).toBe('hello')
    expect(events[1].type).toBe('done')
  })

  it('[DONE] 结束标记触发 done 事件', () => {
    const events = []
    const push = createSseParser((e) => events.push(e))
    push('data: [DONE]\n\n')
    expect(events).toEqual([{ type: 'done' }])
  })

  it('非 data 行与坏 JSON 被跳过/报 error 不中断', () => {
    const events = []
    const push = createSseParser((e) => events.push(e))
    push('event: ping\n\n')
    push('data: not-json\n\n')
    push('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n')
    expect(events.some((e) => e.type === 'error')).toBe(true)
    expect(events.some((e) => e.type === 'data' && e.data.choices[0].delta.content === 'ok')).toBe(true)
  })

  it('CRLF 行尾可解析', () => {
    const events = []
    const push = createSseParser((e) => events.push(e))
    push('data: {"choices":[{"delta":{"content":"x"}}]}\r\n\r\n')
    expect(events).toHaveLength(1)
  })
})
