/**
 * constants/floatingWindow.js — AI_CHAT_DOCKED 常量单元测试
 *
 * 验证 AI 助手贴边（docked）模式参数结构的合理性：
 * - 默认宽度、紧凑宽度、最小宽度等数值合理
 * - 保持与 AI_CHAT_WINDOW.defaultW 一致或合理的对应关系
 * - 极窄屏阈值有效约束 docked 可用性
 */
import { describe, it, expect } from 'vitest'
import { AI_CHAT_DOCKED, AI_CHAT_WINDOW } from '@/constants/floatingWindow'

describe('AI_CHAT_DOCKED 常量', () => {
  it('导出预期的字段', () => {
    expect(AI_CHAT_DOCKED).toBeTypeOf('object')
    expect(AI_CHAT_DOCKED).toHaveProperty('defaultW')
    expect(AI_CHAT_DOCKED).toHaveProperty('compactW')
    expect(AI_CHAT_DOCKED).toHaveProperty('minW')
    expect(AI_CHAT_DOCKED).toHaveProperty('minViewportWidth')
  })

  it('所有宽度字段均为有限正数', () => {
    expect(Number.isFinite(AI_CHAT_DOCKED.defaultW)).toBe(true)
    expect(Number.isFinite(AI_CHAT_DOCKED.compactW)).toBe(true)
    expect(Number.isFinite(AI_CHAT_DOCKED.minW)).toBe(true)
    expect(Number.isFinite(AI_CHAT_DOCKED.minViewportWidth)).toBe(true)
    expect(AI_CHAT_DOCKED.defaultW).toBeGreaterThan(0)
    expect(AI_CHAT_DOCKED.compactW).toBeGreaterThan(0)
    expect(AI_CHAT_DOCKED.minW).toBeGreaterThan(0)
    expect(AI_CHAT_DOCKED.minViewportWidth).toBeGreaterThan(0)
  })

  it('紧凑宽度 <= 默认宽度', () => {
    expect(AI_CHAT_DOCKED.compactW).toBeLessThanOrEqual(AI_CHAT_DOCKED.defaultW)
  })

  it('最小宽度 <= 紧凑宽度（保证窄屏可用）', () => {
    expect(AI_CHAT_DOCKED.minW).toBeLessThanOrEqual(AI_CHAT_DOCKED.compactW)
  })

  it('最小宽度具有实际可用尺寸（>= 200px）', () => {
    // 过窄的右栏会显著影响 AI 对话体验，应保证最小可用尺寸
    expect(AI_CHAT_DOCKED.minW).toBeGreaterThanOrEqual(200)
  })

  it('极窄屏阈值高于最小宽度（避免右栏占据全部视口）', () => {
    // 极窄屏下 docked 不应启用，因为右栏会挤掉编辑器
    expect(AI_CHAT_DOCKED.minViewportWidth).toBeGreaterThan(AI_CHAT_DOCKED.minW)
  })

  it('极窄屏阈值典型合理范围（600px ~ 1024px）', () => {
    // 既能覆盖常见桌面分辨率，也不至于大屏禁止 docked
    expect(AI_CHAT_DOCKED.minViewportWidth).toBeGreaterThanOrEqual(600)
    expect(AI_CHAT_DOCKED.minViewportWidth).toBeLessThanOrEqual(1024)
  })

  it('默认宽度与浮窗 defaultW 保持一致或合理对应', () => {
    // 贴边模式下右栏的视觉重量应与浮窗相当
    expect(Math.abs(AI_CHAT_DOCKED.defaultW - AI_CHAT_WINDOW.defaultW)).toBeLessThanOrEqual(120)
  })
})