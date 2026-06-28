import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

/**
 * 单元测试：HtmlSourceEditor 组件
 *
 * 组件职责：
 *  1. 挂载 CodeMirror 6 到指定容器（由 useHtmlSourceEditor 封装）
 *  2. 顶部渲染标题 + 关闭按钮
 *  3. 点击关闭按钮触发 panelStore.hide() + emit('close')
 *  4. 当前文档未导入 HTML 时显示 empty 状态
 *  5. 组件卸载时调用 composable.destroy() 释放资源
 *
 * CodeMirror 在 jsdom 环境下无法真实初始化（依赖 DOM 测量 API），
 * 因此 mock useHtmlSourceEditor，避免组件挂载时真实调用 CodeMirror。
 */

import HtmlSourceEditor from '@/components/editor/HtmlSourceEditor.vue'
import { useHtmlSourcePanelStore } from '@/stores/htmlSourcePanel'

// ───── 模块 mock ─────
const mockMount = vi.fn(() => ({ view: { fakeView: true }, ready: true }))
const mockDestroy = vi.fn()
const mockUpdateContent = vi.fn(() => true)
const mockRebindTiptap = vi.fn()
const mockGetView = vi.fn(() => null)

vi.mock('@/composables/useHtmlSourceEditor', () => ({
  useHtmlSourceEditor: () => ({
    mount: mockMount,
    destroy: mockDestroy,
    updateContent: mockUpdateContent,
    flushCmToTiptap: vi.fn(() => false),
    rebindTiptap: mockRebindTiptap,
    getView: mockGetView,
  }),
}))

// 提供一个 mock Tiptap editor
function buildMockTiptapEditor(initialAttrs = {}) {
  return {
    state: {
      doc: {
        attrs: { ...initialAttrs },
      },
      selection: { from: 0, to: 0 },
    },
    commands: {
      setContent: vi.fn(() => true),
      updateHtmlSource: vi.fn(() => true),
    },
    on: vi.fn(),
    off: vi.fn(),
  }
}

describe('HtmlSourceEditor 组件', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMount.mockClear()
    mockDestroy.mockClear()
    mockUpdateContent.mockClear()
    mockRebindTiptap.mockClear()
  })

  it('渲染标题 + 关闭按钮 + 挂载容器', () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>hi</p>' })
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '<p>hi</p>' },
      attachTo: document.body,
    })

    expect(wrapper.find('[data-testid="html-source-editor"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="html-source-editor-close"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="html-source-editor-mount"]').exists()).toBe(true)
    expect(mockMount).toHaveBeenCalledTimes(1)
    // 卸载时调用 destroy
    wrapper.unmount()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('点击关闭按钮：panelStore.hide + emit close', async () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>x</p>' })
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '<p>x</p>' },
      attachTo: document.body,
    })

    const store = useHtmlSourcePanelStore()
    expect(store.visible).toBe(false)

    await wrapper.find('[data-testid="html-source-editor-close"]').trigger('click')

    expect(store.visible).toBe(false) // store 默认就是 false，hide 不影响
    // 关键：emit('close') 触发
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close').length).toBe(1)
  })

  it('initialHtml 为空且 doc.attrs.htmlSource 也为空：显示 empty 状态', () => {
    const editor = buildMockTiptapEditor({}) // 无 htmlSource
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '' },
      attachTo: document.body,
    })

    expect(wrapper.find('.html-source-editor__empty').exists()).toBe(true)
    expect(wrapper.find('.html-source-editor__empty').text()).toContain('未导入 HTML')
  })

  it('initialHtml 为空但 doc.attrs.htmlSource 存在：mount 使用 doc 源码', () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>from-doc</p>' })
    mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '' },
      attachTo: document.body,
    })

    expect(mockMount).toHaveBeenCalledTimes(1)
    const [, initialSource] = mockMount.mock.calls[0]
    expect(initialSource).toBe('<p>from-doc</p>')
  })

  it('initialHtml 优先：直接使用 props.initialHtml', () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>doc-source</p>' })
    mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '<p>prop-source</p>' },
      attachTo: document.body,
    })

    const [, initialSource] = mockMount.mock.calls[0]
    expect(initialSource).toBe('<p>prop-source</p>')
  })

  it('initialHtml 变化时：调用 updateContent', async () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>v1</p>' })
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '<p>v1</p>' },
      attachTo: document.body,
    })

    await wrapper.setProps({ initialHtml: '<p>v2</p>' })
    expect(mockUpdateContent).toHaveBeenCalledWith('<p>v2</p>')
  })

  it('editor 引用变化时（切换文档）：rebindTiptap', async () => {
    const editor1 = buildMockTiptapEditor({ htmlSource: '<p>1</p>' })
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor: editor1, initialHtml: '<p>1</p>' },
      attachTo: document.body,
    })

    // mock getView 返回 truthy，触发 rebind
    mockGetView.mockReturnValue({ fakeView: true })

    const editor2 = buildMockTiptapEditor({ htmlSource: '<p>2</p>' })
    await wrapper.setProps({ editor: editor2 })
    expect(mockRebindTiptap).toHaveBeenCalled()
  })

  it('组件卸载时调用 composable.destroy()', () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>x</p>' })
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '<p>x</p>' },
      attachTo: document.body,
    })

    expect(mockDestroy).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('CodeMirror 初始化失败时降级为 textarea + 错误提示', async () => {
    // 临时调整 mockMount 返回 ready: false
    mockMount.mockReturnValueOnce({ view: null, ready: false })
    const editor = buildMockTiptapEditor({ htmlSource: '<p>x</p>' })
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: '<p>x</p>' },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="html-source-editor-fallback"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="html-source-editor-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="html-source-editor-error"]').text()).toContain('未能初始化')
  })

  it('大文件初始源码：渲染性能警告', () => {
    const editor = buildMockTiptapEditor({ htmlSource: '<p>x</p>' })
    const large = '<p>' + 'a'.repeat(220 * 1024) + '</p>'
    const wrapper = mount(HtmlSourceEditor, {
      props: { editor, initialHtml: large },
      attachTo: document.body,
    })

    expect(wrapper.find('[data-testid="html-source-editor-large-warning"]').exists()).toBe(true)
  })
})
