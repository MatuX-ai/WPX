import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

/**
 * 单元测试：useGlobalShortcuts
 *
 * 主要验证：
 *  1. Ctrl+Shift+H 触发 onToggleHtmlSourcePanel
 *  2. 普通 keydown 不触发 handler
 *  3. modifier 缺失时跳过
 */

import {
  useGlobalShortcuts,
  getShortcutLabel,
  GLOBAL_SHORTCUTS,
} from '@/composables/useGlobalShortcuts'

// 让 isEditorRoute 默认返回 true：通过把当前路由设置为 /editor
vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'editor' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/utils/windowContext', () => ({
  isEditorRoute: () => true,
}))

function dispatchKey(opts) {
  const event = new KeyboardEvent('keydown', {
    key: opts.key,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    shiftKey: opts.shift ?? false,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
  return event
}

describe('useGlobalShortcuts - toggleHtmlSourcePanel 快捷键', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function mountWithHandlers(handlers) {
    const Probe = defineComponent({
      setup() {
        useGlobalShortcuts(handlers)
        return () => h('div')
      },
    })
    return mount(Probe, { attachTo: document.body })
  }

  it('Ctrl+Shift+H 触发 onToggleHtmlSourcePanel', async () => {
    const handler = vi.fn()
    const wrapper = mountWithHandlers({ onToggleHtmlSourcePanel: handler })

    dispatchKey({ key: 'h', ctrl: true, shift: true })

    expect(handler).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('仅按 H 不带 modifier：不触发', () => {
    const handler = vi.fn()
    const wrapper = mountWithHandlers({ onToggleHtmlSourcePanel: handler })

    dispatchKey({ key: 'h', shift: false })

    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('仅 Ctrl+H（不带 shift）：不触发', () => {
    const handler = vi.fn()
    const wrapper = mountWithHandlers({ onToggleHtmlSourcePanel: handler })

    dispatchKey({ key: 'h', ctrl: true })

    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('其它快捷键不会误触 toggleHtmlSourcePanel', () => {
    const handler = vi.fn()
    const wrapper = mountWithHandlers({ onToggleHtmlSourcePanel: handler })

    dispatchKey({ key: 's', ctrl: true })
    dispatchKey({ key: 'w', ctrl: true, shift: true })
    dispatchKey({ key: 'i', ctrl: true, shift: true })

    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('GLOBAL_SHORTCUTS 注册了 toggleHtmlSourcePanel', () => {
    expect(GLOBAL_SHORTCUTS.toggleHtmlSourcePanel).toBeDefined()
    expect(GLOBAL_SHORTCUTS.toggleHtmlSourcePanel.win).toBe('Ctrl+Shift+H')
  })

  it('getShortcutLabel 返回平台对应的快捷键字符串', () => {
    const label = getShortcutLabel('toggleHtmlSourcePanel')
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })
})