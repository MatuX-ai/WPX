/**
 * hermesRouter.spec.js —— Hermes 自动路由判定（M3-C+，使用真实 ai-router 模式）
 */
import { describe, it, expect } from 'vitest'
import { shouldAutoRouteHermes, buildHermesAssistantMessage } from '@/utils/hermesRouter'

describe('shouldAutoRouteHermes — 开关/就绪前置', () => {
  it('未启用或网关未就绪一律不路由', () => {
    expect(shouldAutoRouteHermes('用 Hermes 调研', { enabled: false, gatewayReady: true })).toBe(false)
    expect(shouldAutoRouteHermes('用 Hermes 调研', { enabled: true, gatewayReady: false })).toBe(false)
    expect(shouldAutoRouteHermes('用 Hermes 调研', {})).toBe(false)
  })

  it('空消息不路由', () => {
    expect(shouldAutoRouteHermes('', { enabled: true, gatewayReady: true })).toBe(false)
    expect(shouldAutoRouteHermes('   ', { enabled: true, gatewayReady: true })).toBe(false)
  })
})

describe('shouldAutoRouteHermes — 显式指令 / 关键词（无需开关）', () => {
  it('「用 Hermes …」与裸 hermes 命中', () => {
    expect(shouldAutoRouteHermes('用 Hermes 帮我调研三款产品', { enabled: true, gatewayReady: true })).toBe(true)
    expect(shouldAutoRouteHermes('hermes 对比三个方案', { enabled: true, gatewayReady: true })).toBe(true)
  })

  it('开放任务关键词命中', () => {
    expect(shouldAutoRouteHermes('自主完成一次全网调研', { enabled: true, gatewayReady: true })).toBe(true)
    expect(shouldAutoRouteHermes('对比这三个方案并给建议', { enabled: true, gatewayReady: true })).toBe(true)
  })
})

describe('shouldAutoRouteHermes — 自动路由开关 + 复杂任务', () => {
  it('开启 autoRoute 且超长任务命中；未开启不命中', () => {
    const long = 'x'.repeat(250)
    expect(shouldAutoRouteHermes(long, { enabled: true, gatewayReady: true, autoRoute: true })).toBe(true)
    expect(shouldAutoRouteHermes(long, { enabled: true, gatewayReady: true, autoRoute: false })).toBe(false)
  })

  it('短任务即使开启 autoRoute 也不命中（避免打扰）', () => {
    expect(shouldAutoRouteHermes('你好', { enabled: true, gatewayReady: true, autoRoute: true })).toBe(false)
  })
})

describe('buildHermesAssistantMessage', () => {
  it('生成 UIMessage 兼容的助手消息', () => {
    const m = buildHermesAssistantMessage('调研任务', '调研结论文本')
    expect(m.role).toBe('assistant')
    expect(m.hermesTask).toBe(true)
    expect(m.task).toBe('调研任务')
    expect(m.parts).toEqual([{ type: 'text', text: '调研结论文本' }])
    expect(m.id).toMatch(/^hermes-/)
  })
})
