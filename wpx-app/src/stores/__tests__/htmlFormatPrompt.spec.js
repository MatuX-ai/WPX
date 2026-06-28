import { describe, it, expect, beforeEach } from 'vitest'

/**
 * 单元测试：HTML 智能排版提示 Store
 *
 * - pending：默认值 / 触发后赋值
 * - trigger：payload 注入 + 自动分配 token
 * - clear：手动清空
 * - consume：读取但不消费
 */

import { setActivePinia, createPinia } from 'pinia'
import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'

describe('useHtmlFormatPromptStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始 pending 为 null', () => {
    const store = useHtmlFormatPromptStore()
    expect(store.pending).toBeNull()
  })

  it('trigger 后 pending 被赋值，且 payload 字段被保留', () => {
    const store = useHtmlFormatPromptStore()
    store.trigger({ source: 'a4-focus-mode' })
    expect(store.pending).toBeTruthy()
    expect(store.pending.source).toBe('a4-focus-mode')
    expect(store.pending.token).toBeTruthy()
    expect(typeof store.pending.consumedAt).toBe('number')
  })

  it('trigger 携带 templateId / autoApply 字段时保留', () => {
    const store = useHtmlFormatPromptStore()
    store.trigger({ source: 'change-template', templateId: 'webpage-archive' })
    expect(store.pending.source).toBe('change-template')
    expect(store.pending.templateId).toBe('webpage-archive')
  })

  it('多次 trigger 会生成不同 token（避免消费方误判）', () => {
    const store = useHtmlFormatPromptStore()
    store.trigger({ source: 'manual' })
    const first = store.pending.token
    store.trigger({ source: 'paste' })
    const second = store.pending.token
    expect(first).not.toBe(second)
  })

  it('clear 后 pending 恢复为 null', () => {
    const store = useHtmlFormatPromptStore()
    store.trigger({ source: 'manual' })
    expect(store.pending).toBeTruthy()
    store.clear()
    expect(store.pending).toBeNull()
  })

  it('consume 返回当前 pending 但不修改', () => {
    const store = useHtmlFormatPromptStore()
    expect(store.consume()).toBeNull()

    store.trigger({ source: 'file' })
    const snapshot = store.consume()
    expect(snapshot).toBeTruthy()
    expect(snapshot.source).toBe('file')
    expect(store.pending).toBe(snapshot) // 未被清空
  })

  it('trigger 非法参数静默处理（pending 不变）', () => {
    const store = useHtmlFormatPromptStore()
    store.trigger(null)
    store.trigger(undefined)
    store.trigger('not-object')
    expect(store.pending).toBeNull()
  })

  it('支持所有合法 source 类型', () => {
    const store = useHtmlFormatPromptStore()
    const sources = ['a4-focus-mode', 'manual', 'paste', 'file', 'change-template']
    sources.forEach((source) => {
      store.trigger({ source })
      expect(store.pending.source).toBe(source)
    })
  })
})
