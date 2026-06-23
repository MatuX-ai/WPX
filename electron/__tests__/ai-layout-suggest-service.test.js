/**
 * AI 排版建议服务单元测试
 *
 * 运行：npx vitest run --config electron/vitest.config.js ai-layout-suggest-service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const mockHasApiKey = vi.fn()
const mockGetDecryptedApiKey = vi.fn()

require.cache[require.resolve('../services/model-secrets-store')] = {
  id: require.resolve('../services/model-secrets-store'),
  filename: require.resolve('../services/model-secrets-store'),
  loaded: true,
  exports: {
    hasApiKey: mockHasApiKey,
    getDecryptedApiKey: mockGetDecryptedApiKey,
  },
  children: [],
  paths: [],
}

const service = require('../services/ai-layout-suggest-service.js')
const {
  analyzeLayoutSuggestions,
  applyLayoutSuggestions,
  buildLocalFallbackSuggestions,
  isAvailable,
  parseSuggestionsFromText,
  sanitizeSuggestions,
} = service

describe('ai-layout-suggest-service — 可用性判断', () => {
  beforeEach(() => {
    delete process.env.WPX_EXPORT_AI_LAYOUT_ENABLED
    mockHasApiKey.mockReset()
    mockGetDecryptedApiKey.mockReset()
  })

  afterEach(() => {
    delete process.env.WPX_EXPORT_AI_LAYOUT_ENABLED
  })

  it('默认情况下 AI 排版不可用（无开关 + 无 key）', () => {
    mockHasApiKey.mockReturnValue(false)
    expect(isAvailable()).toBe(false)
  })

  it('WPX_EXPORT_AI_LAYOUT_ENABLED=true 且有 key 时可用', () => {
    process.env.WPX_EXPORT_AI_LAYOUT_ENABLED = 'true'
    mockHasApiKey.mockReturnValue(true)
    expect(isAvailable()).toBe(true)
  })

  it('显式关闭（false）时即使有 key 也不可用', () => {
    process.env.WPX_EXPORT_AI_LAYOUT_ENABLED = 'false'
    mockHasApiKey.mockReturnValue(true)
    expect(isAvailable()).toBe(false)
  })

  it('开关 true 但无 key 时仍不可用', () => {
    process.env.WPX_EXPORT_AI_LAYOUT_ENABLED = 'true'
    mockHasApiKey.mockReturnValue(false)
    expect(isAvailable()).toBe(false)
  })

  it('AI 不可用时 analyzeLayoutSuggestions 返回空数组', async () => {
    mockHasApiKey.mockReturnValue(false)
    const result = await analyzeLayoutSuggestions('# Hello', { paperSize: 'A4' })
    expect(result).toEqual([])
  })

  it('空 markdown 直接返回空数组', async () => {
    process.env.WPX_EXPORT_AI_LAYOUT_ENABLED = 'true'
    mockHasApiKey.mockReturnValue(true)
    mockGetDecryptedApiKey.mockReturnValue('sk-test')
    expect(await analyzeLayoutSuggestions('', { paperSize: 'A4' })).toEqual([])
    expect(await analyzeLayoutSuggestions(null, { paperSize: 'A4' })).toEqual([])
  })
})

describe('ai-layout-suggest-service — parseSuggestionsFromText', () => {
  it('解析纯 JSON 对象 { suggestions: [...] }', () => {
    const text = JSON.stringify({
      suggestions: [
        { type: 'pageBreakBefore', anchor: '介绍' },
      ],
    })
    const result = parseSuggestionsFromText(text)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('pageBreakBefore')
    expect(result[0].anchor).toBe('介绍')
  })

  it('解析纯 JSON 数组', () => {
    const text = JSON.stringify([
      { type: 'imageFloat', anchor: 'img1', float: 'left' },
    ])
    const result = parseSuggestionsFromText(text)
    expect(result).toHaveLength(1)
    expect(result[0].float).toBe('left')
  })

  it('支持 ```json ... ``` 包裹', () => {
    const text = '```json\n{"suggestions": [{"type": "pageBreakBefore", "anchor": "甲"}]}\n```'
    expect(parseSuggestionsFromText(text)).toEqual([
      { type: 'pageBreakBefore', anchor: '甲' },
    ])
  })

  it('非法 JSON 返回空数组', () => {
    expect(parseSuggestionsFromText('not json')).toEqual([])
    expect(parseSuggestionsFromText('{')).toEqual([])
  })

  it('未知类型 / 缺 anchor 的项会被过滤', () => {
    const text = JSON.stringify({
      suggestions: [
        { type: 'pageBreakBefore', anchor: 'valid' },
        { type: 'unknownType', anchor: 'x' },
        { type: 'pageBreakBefore' },
        { type: 'imageFloat', anchor: '' },
        null,
      ],
    })
    const result = parseSuggestionsFromText(text)
    expect(result).toHaveLength(1)
    expect(result[0].anchor).toBe('valid')
  })
})

describe('ai-layout-suggest-service — sanitizeSuggestions', () => {
  it('imageFloat.float 必须为合法值，否则丢弃字段', () => {
    const result = sanitizeSuggestions([
      { type: 'imageFloat', anchor: 'i1', float: 'left' },
      { type: 'imageFloat', anchor: 'i2', float: 'middle' },
    ])
    expect(result[0].float).toBe('left')
    expect(result[1].float).toBeUndefined()
  })

  it('figureAdjustment.action 必须为合法值', () => {
    const result = sanitizeSuggestions([
      { type: 'figureAdjustment', anchor: 'f1', action: 'center' },
      { type: 'figureAdjustment', anchor: 'f2', action: 'flip' },
    ])
    expect(result[0].action).toBe('center')
    expect(result[1].action).toBeUndefined()
  })

  it('anchor 超过 200 字符会被截断', () => {
    const longAnchor = 'x'.repeat(500)
    const result = sanitizeSuggestions([{ type: 'pageBreakBefore', anchor: longAnchor }])
    expect(result[0].anchor.length).toBe(200)
  })

  it('headingLevel 仅接受 1-6 整数', () => {
    const result = sanitizeSuggestions([
      { type: 'pageBreakBefore', anchor: 'h', headingLevel: 3 },
      { type: 'pageBreakBefore', anchor: 'h2', headingLevel: 0 },
      { type: 'pageBreakBefore', anchor: 'h3', headingLevel: 7 },
      { type: 'pageBreakBefore', anchor: 'h4', headingLevel: '2' },
    ])
    expect(result[0].headingLevel).toBe(3)
    expect(result.slice(1).every((item) => item.headingLevel === undefined)).toBe(true)
  })

  it('空数组或非对象项被过滤', () => {
    const result = sanitizeSuggestions([null, undefined, 0, 'string', {}])
    expect(result).toEqual([])
  })
})

describe('ai-layout-suggest-service — applyLayoutSuggestions', () => {
  it('无建议时返回原内容', () => {
    const md = '# Title\n\n段落'
    expect(applyLayoutSuggestions(md, [], 'pdf')).toBe(md)
    expect(applyLayoutSuggestions(md, null, 'pdf')).toBe(md)
  })

  it('PDF 在匹配锚点的标题前插入 \\newpage', () => {
    const md = [
      '# 第一章',
      '',
      '内容 1',
      '',
      '## 第二章',
      '',
      '内容 2',
    ].join('\n')
    const suggestions = [{ type: 'pageBreakBefore', anchor: '第二章' }]
    const result = applyLayoutSuggestions(md, suggestions, 'pdf')
    expect(result).toContain('\\newpage\n## 第二章')
    expect(result.split('\n').indexOf('\\newpage')).toBeGreaterThan(-1)
  })

  it('HTML 在匹配锚点的标题前插入 page-break-before div', () => {
    const md = '# Hello\n\n## World'
    const result = applyLayoutSuggestions(
      md,
      [{ type: 'pageBreakBefore', anchor: 'World' }],
      'html',
    )
    expect(result).toContain('<div style="page-break-before: always;"></div>')
    expect(result).toContain('## World')
  })

  it('docx 同样使用 \\newpage（Pandoc pagebreak lua filter）', () => {
    const md = '# A\n\n## B'
    const result = applyLayoutSuggestions(
      md,
      [{ type: 'pageBreakBefore', anchor: 'B' }],
      'docx',
    )
    expect(result).toContain('\\newpage\n## B')
  })

  it('未匹配锚点的建议不会修改内容', () => {
    const md = '# Alpha\n\n## Beta'
    const result = applyLayoutSuggestions(
      md,
      [{ type: 'pageBreakBefore', anchor: 'Gamma' }],
      'pdf',
    )
    expect(result).toBe(md)
  })

  it('非 pageBreakBefore 类型不会修改内容', () => {
    const md = '# Title'
    const result = applyLayoutSuggestions(
      md,
      [{ type: 'imageFloat', anchor: 'Title', float: 'left' }],
      'pdf',
    )
    expect(result).toBe(md)
  })

  it('正则元字符会被转义，不会误命中', () => {
    const md = '## 1. 介绍（重要）'
    const result = applyLayoutSuggestions(
      md,
      [{ type: 'pageBreakBefore', anchor: '1. 介绍（重要）' }],
      'pdf',
    )
    expect(result).toContain('\\newpage\n## 1. 介绍（重要）')
  })
})

describe('ai-layout-suggest-service — buildLocalFallbackSuggestions', () => {
  it('无 H1 标题时返回空数组', () => {
    expect(buildLocalFallbackSuggestions('## 二级\n段落')).toEqual([])
    expect(buildLocalFallbackSuggestions('')).toEqual([])
  })

  it('单个 H1 不产生建议', () => {
    const md = '# 标题\n段落一\n段落二\n段落三\n段落四\n段落五'
    expect(buildLocalFallbackSuggestions(md)).toEqual([])
  })

  it('两个相距较远的 H1 触发 pageBreakBefore', () => {
    const md = [
      '# 第一章',
      '',
      '内容 1',
      '',
      '内容 2',
      '',
      '内容 3',
      '',
      '内容 4',
      '',
      '内容 5',
      '',
      '内容 6',
      '',
      '# 第二章',
      '',
      '内容',
    ].join('\n')
    const suggestions = buildLocalFallbackSuggestions(md)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      type: 'pageBreakBefore',
      anchor: '第二章',
      headingLevel: 1,
    })
  })
})

describe('ai-layout-suggest-service — AI endpoint 调用（mock fetch）', () => {
  let fetchSpy

  beforeEach(() => {
    process.env.WPX_EXPORT_AI_LAYOUT_ENABLED = 'true'
    mockHasApiKey.mockReturnValue(true)
    mockGetDecryptedApiKey.mockReturnValue('sk-test')
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
  })

  afterEach(() => {
    delete process.env.WPX_EXPORT_AI_LAYOUT_ENABLED
    delete globalThis.fetch
  })

  it('fetch 成功且返回合法 JSON 时返回建议列表', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ suggestions: [
            { type: 'pageBreakBefore', anchor: '甲' },
            { type: 'imageFloat', anchor: 'i1', float: 'right' },
          ] }) } },
        ],
      }),
    })
    const result = await analyzeLayoutSuggestions('# Hello', { paperSize: 'A4' })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: 'pageBreakBefore', anchor: '甲' })
    expect(result[1]).toMatchObject({ type: 'imageFloat', anchor: 'i1', float: 'right' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer sk-test')
  })

  it('fetch 返回非 ok 时静默回退为空数组', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    expect(await analyzeLayoutSuggestions('# Hello')).toEqual([])
  })

  it('fetch 抛错时静默回退为空数组', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'))
    expect(await analyzeLayoutSuggestions('# Hello')).toEqual([])
  })

  it('fetch 返回非法 JSON 时静默回退为空数组', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    })
    expect(await analyzeLayoutSuggestions('# Hello')).toEqual([])
  })
})