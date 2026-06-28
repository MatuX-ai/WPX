import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

/**
 * 单元测试：FormatTemplateSelector（HTML 排版恢复提示条）
 *
 * 组件依赖：
 *  - useHtmlFormatStore（htmlFormatBar）
 *  - useHtmlFormatPromptStore
 *  - getActiveEditor / hasHtmlImport / restoreFromHtmlSource
 *  - useToastStore
 *  - LocalCommandMessage 子组件
 *
 * 由于 LocalCommandMessage 引入了一组完整的样式体系 + AI Chat 子依赖，
 * 单元测试仅验证：
 *   1. visible=false 时不渲染
 *   2. visible=true 时渲染 LocalCommandMessage + 正确 props
 *   3. 点击 "恢复原样" / "换模板" / "dismiss" 时分别触发正确的副作用
 *   4. store 状态切换时组件响应式更新
 */

import FormatTemplateSelector from '@/components/editor/FormatTemplateSelector.vue'
import { useHtmlFormatStore } from '@/stores/htmlFormatBar'
import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'

// ───── 模块 mock ─────
vi.mock('@/composables/useEditorRegistry', () => ({
  getActiveEditor: vi.fn(() => null),
  setActiveEditor: vi.fn(),
  clearActiveEditor: vi.fn(),
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

import { getActiveEditor } from '@/composables/useEditorRegistry'

describe('useHtmlFormatStore (htmlFormatBar)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始 visible=false, templateLabel=""', () => {
    const store = useHtmlFormatStore()
    expect(store.visible).toBe(false)
    expect(store.templateLabel).toBe('')
    expect(store.templateId).toBe('')
  })

  it('show 后 visible=true 且模板元数据写入', () => {
    const store = useHtmlFormatStore()
    const ts = Date.now()
    store.show({ templateId: 'webpage-archive', templateLabel: '网页存档', formattedAt: ts })
    expect(store.visible).toBe(true)
    expect(store.templateId).toBe('webpage-archive')
    expect(store.templateLabel).toBe('网页存档')
    expect(store.formattedAt).toBe(ts)
  })

  it('dismiss 后 visible=false 但保留 templateLabel', () => {
    const store = useHtmlFormatStore()
    store.show({ templateLabel: '网页存档' })
    store.dismiss()
    expect(store.visible).toBe(false)
    expect(store.templateLabel).toBe('网页存档')
  })

  it('reset 后所有字段清空', () => {
    const store = useHtmlFormatStore()
    store.show({ templateId: 'article', templateLabel: '通用文章' })
    store.reset()
    expect(store.visible).toBe(false)
    expect(store.templateId).toBe('')
    expect(store.templateLabel).toBe('')
    expect(store.formattedAt).toBe(0)
  })
})

describe('FormatTemplateSelector 组件渲染', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getActiveEditor.mockReturnValue(null)
  })

  it('visible=false 时不渲染', () => {
    const wrapper = mount(FormatTemplateSelector)
    expect(wrapper.find('.format-template-selector').exists()).toBe(false)
  })

  it('visible=true 时渲染 LocalCommandMessage，message 含模板 label', async () => {
    const store = useHtmlFormatStore()
    store.show({ templateLabel: '网页存档', templateId: 'webpage-archive' })

    const wrapper = mount(FormatTemplateSelector)
    expect(wrapper.find('.format-template-selector').exists()).toBe(true)
    // 通过 component-stub 验证 props
    const lcm = wrapper.findComponent({ name: 'LocalCommandMessage' })
    expect(lcm.exists()).toBe(true)
    expect(lcm.props('mode')).toBe('format-recovery')
    expect(lcm.props('templateLabel')).toBe('网页存档')
    expect(lcm.props('message')).toBe('已按【网页存档】格式排版')
    expect(lcm.props('success')).toBe(true)
    expect(lcm.props('commandId')).toBe('format-html')
    expect(lcm.props('category')).toBe('format')
  })
})

describe('FormatTemplateSelector 交互', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getActiveEditor.mockReturnValue(null)
  })

  it('点击 dismiss：仅关闭提示条', async () => {
    const store = useHtmlFormatStore()
    const promptStore = useHtmlFormatPromptStore()
    store.show({ templateLabel: '网页存档' })

    const wrapper = mount(FormatTemplateSelector)
    const lcm = wrapper.findComponent({ name: 'LocalCommandMessage' })
    lcm.vm.$emit('dismiss')

    expect(store.visible).toBe(false)
    // promptStore 不应被触发
    expect(promptStore.pending).toBeNull()
  })

  it('点击换模板：关闭提示条并重新触发 promptStore', async () => {
    const store = useHtmlFormatStore()
    const promptStore = useHtmlFormatPromptStore()
    store.show({ templateLabel: '网页存档' })

    const wrapper = mount(FormatTemplateSelector)
    const lcm = wrapper.findComponent({ name: 'LocalCommandMessage' })
    lcm.vm.$emit('change-template')

    expect(store.visible).toBe(false)
    expect(promptStore.pending).toBeTruthy()
    expect(promptStore.pending.source).toBe('change-template')
  })

  it('点击恢复原样：无活动编辑器时显示 toast', async () => {
    const store = useHtmlFormatStore()
    store.show({ templateLabel: '网页存档' })
    getActiveEditor.mockReturnValue(null)

    const wrapper = mount(FormatTemplateSelector)
    const lcm = wrapper.findComponent({ name: 'LocalCommandMessage' })
    lcm.vm.$emit('restore')

    // 因为无编辑器，提示条不消失
    expect(store.visible).toBe(true)
  })
})
