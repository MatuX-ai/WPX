import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  SLIDE_ACTIONS,
  parametersToZod,
  toFrontendToolConfig,
} from '@/copilot/actions/slide-actions'

describe('slide-actions - 8 个 Action 声明', () => {
  it('SLIDE_ACTIONS 包含 8 个且 name 唯一', () => {
    expect(SLIDE_ACTIONS).toHaveLength(8)
    const names = SLIDE_ACTIONS.map((a) => a.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each([
    'generateOutline',
    'selectTemplate',
    'generateSlides',
    'modifySlide',
    'addSlide',
    'removeSlide',
    'exportAsHTML',
    'exportAsPPTX',
  ])('%s 存在于 SLIDE_ACTIONS 中且具备完整字段', (name) => {
    const action = SLIDE_ACTIONS.find((a) => a.name === name)
    expect(action).toBeTruthy()
    expect(typeof action.description).toBe('string')
    expect(action.description.length).toBeGreaterThan(0)
    expect(action.parameters).toBeTypeOf('object')
    expect(typeof action.handler).toBe('function')
  })
})

describe('parametersToZod - JSON-Schema 简写编译', () => {
  it('编译 string + required', () => {
    const schema = parametersToZod({
      topic: { type: 'string', description: '主题', required: true },
    })
    expect(schema).toBeInstanceOf(z.ZodObject)
    const parsed = schema.parse({ topic: 'X' })
    expect(parsed.topic).toBe('X')
    // 缺失必填字段应抛错
    expect(() => schema.parse({})).toThrow()
  })

  it('编译 string + required=false + default', () => {
    const schema = parametersToZod({
      pageCount: { type: 'number', required: false, default: 8 },
    })
    const parsed = schema.parse({})
    expect(parsed.pageCount).toBe(8)
  })

  it('编译 enum', () => {
    const schema = parametersToZod({
      templateId: {
        type: 'enum',
        enum: ['business', 'tech', 'fresh', 'custom'],
        required: true,
      },
    })
    expect(() => schema.parse({ templateId: 'business' })).not.toThrow()
    expect(() => schema.parse({ templateId: 'invalid' })).toThrow()
  })

  it('编译 array 与 object（嵌套）', () => {
    const schema = parametersToZod({
      outline: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', required: true },
            points: {
              type: 'array',
              required: false,
              items: { type: 'string' },
            },
          },
        },
      },
    })
    const parsed = schema.parse({
      outline: [{ title: 'A', points: ['x', 'y'] }],
    })
    expect(parsed.outline[0].title).toBe('A')
    expect(parsed.outline[0].points).toEqual(['x', 'y'])
  })

  it('未知 type 退化为 z.any()', () => {
    const schema = parametersToZod({ x: { type: 'unknown-type' } })
    expect(() => schema.parse({ x: { anything: true } })).not.toThrow()
  })
})

describe('toFrontendToolConfig - 声明 → v2 Frontend Tool', () => {
  it('每个 Action 都能编译为 useFrontendTool 配置', () => {
    for (const action of SLIDE_ACTIONS) {
      const config = toFrontendToolConfig(action)
      expect(config.name).toBe(action.name)
      expect(config.description).toBe(action.description)
      expect(config.parameters).toBeInstanceOf(z.ZodObject)
      expect(typeof config.handler).toBe('function')
    }
  })
})