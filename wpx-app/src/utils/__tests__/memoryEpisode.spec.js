/**
 * memoryEpisode.spec.js —— AI 对话 → 情景记忆 纯函数测试（M2.1）
 */
import { describe, it, expect } from 'vitest'
import { buildChatEpisode, isEpisodeRecordingEnabled } from '@/utils/memoryEpisode'

describe('memoryEpisode — buildChatEpisode', () => {
  it('正常对话：task=用户输入、summary=助手文本、outcome=success', () => {
    const payload = buildChatEpisode({ text: ' 这是助手回复 ' }, '帮我总结周报')
    expect(payload).toEqual({
      task: '帮我总结周报',
      summary: '这是助手回复',
      outcome: 'success',
      feedback: null,
    })
  })

  it('用户输入为空 → null（不记录噪音）', () => {
    expect(buildChatEpisode({ text: '回复' }, '')).toBeNull()
    expect(buildChatEpisode({ text: '回复' }, '   ')).toBeNull()
  })

  it('助手无回复文本 → null', () => {
    expect(buildChatEpisode({ text: '' }, '用户问题')).toBeNull()
    expect(buildChatEpisode({}, '用户问题')).toBeNull()
    expect(buildChatEpisode({ text: '  ' }, '用户问题')).toBeNull()
  })

  it('超长文本被截断（对齐 memory-service 长度上限）', () => {
    const longUser = '问'.repeat(600)
    const longReply = '答'.repeat(2500)
    const payload = buildChatEpisode({ text: longReply }, longUser)
    expect(payload.task.length).toBe(500)
    expect(payload.summary.length).toBe(2000)
  })
})

describe('memoryEpisode — isEpisodeRecordingEnabled', () => {
  it('recordEpisodes 未显式关闭即开启（含空设置）', () => {
    expect(isEpisodeRecordingEnabled(null)).toBe(true)
    expect(isEpisodeRecordingEnabled(undefined)).toBe(true)
    expect(isEpisodeRecordingEnabled({})).toBe(true)
    expect(isEpisodeRecordingEnabled({ enabled: false })).toBe(true) // 只关学习不影响记录
  })

  it('recordEpisodes=false 时关闭', () => {
    expect(isEpisodeRecordingEnabled({ recordEpisodes: false })).toBe(false)
    expect(isEpisodeRecordingEnabled({ recordEpisodes: false, enabled: true })).toBe(false)
  })

  it('recordEpisodes=true 时开启', () => {
    expect(isEpisodeRecordingEnabled({ recordEpisodes: true })).toBe(true)
  })
})
