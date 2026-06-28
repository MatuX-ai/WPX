import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LocalCommandMessage from '@/components/ai/LocalCommandMessage.vue'

const sampleTemplates = [
  { id: 'article', label: '通用文章', description: '日常写作' },
  { id: 'report', label: '正式报告', description: '商务汇报' },
  { id: 'lesson-plan', label: '教案模板', description: '教学' },
]

describe('LocalCommandMessage - status 模式（默认，向后兼容）', () => {
  it('成功状态应渲染绿色气泡 + ✅ 图标', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        success: true,
        message: '✅ 已加粗',
        commandId: 'bold',
        category: 'format',
      },
    })
    const root = wrapper.find('.local-command-message')
    expect(root.classes()).toContain('local-command-message--success')
    expect(wrapper.text()).toContain('已加粗')
    expect(wrapper.text()).toContain('格式 · 本地指令')
  })

  it('失败状态应渲染黄色气泡 + ⚠️ 图标', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        success: false,
        message: '⚠️ 请先选中文字',
        commandId: 'bold',
        category: 'format',
      },
    })
    const root = wrapper.find('.local-command-message')
    expect(root.classes()).toContain('local-command-message--warning')
    expect(wrapper.text()).toContain('⚠️')
  })

  it('未知 category 应回退为"本地指令"', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { commandId: 'some-id', category: 'mystery-cat' },
    })
    expect(wrapper.text()).toContain('本地指令')
  })
})

describe('LocalCommandMessage - selector 模式', () => {
  it('应渲染模板芯片（按通用文章 → 正式报告 → 教案 排序）', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'selector',
        message: '需要排版吗？',
        commandId: 'format-md',
        category: 'format',
        templates: sampleTemplates,
      },
    })
    const chips = wrapper.findAll('.local-command-message__chip')
    expect(chips.length).toBe(sampleTemplates.length)
    expect(chips[0].text()).toBe('通用文章')
    expect(chips[1].text()).toBe('正式报告')
    expect(chips[2].text()).toBe('教案模板')
    const root = wrapper.find('.local-command-message')
    expect(root.classes()).toContain('local-command-message--interactive')
  })

  it('点击模板应 emit select 事件，payload.kind=template', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'selector',
        commandId: 'format-md',
        templates: sampleTemplates,
      },
    })
    const firstChip = wrapper.findAll('.local-command-message__chip')[0]
    await firstChip.trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0][0]).toEqual({
      kind: 'template',
      templateId: 'article',
    })
  })

  it('showKeepOriginal=true 时应额外渲染"保持原样"芯片', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'selector',
        commandId: 'format-md',
        templates: sampleTemplates,
        showKeepOriginal: true,
      },
    })
    const chips = wrapper.findAll('.local-command-message__chip')
    expect(chips.length).toBe(sampleTemplates.length + 1)
    expect(chips[chips.length - 1].text()).toBe('保持原样')
  })

  it('点击关闭按钮应 emit dismiss 事件', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'selector',
        commandId: 'format-md',
        templates: sampleTemplates,
      },
    })
    const closeBtn = wrapper.find('.local-command-message__close')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('重复点击应只触发一次（防重复）', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'selector',
        commandId: 'format-md',
        templates: sampleTemplates,
      },
    })
    const chip = wrapper.findAll('.local-command-message__chip')[0]
    await chip.trigger('click')
    await chip.trigger('click')
    expect(wrapper.emitted('select').length).toBe(1)
    expect(wrapper.text()).toContain('已选择 ✓')
  })
})

describe('LocalCommandMessage - image-align 模式', () => {
  it('应渲染三个对齐芯片', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'image-align',
        commandId: 'align-md-images',
      },
    })
    const chips = wrapper.findAll('.local-command-message__chip')
    expect(chips.length).toBe(3)
    expect(chips[0].text()).toBe('等比例撑满宽度')
    expect(chips[1].text()).toBe('窄边距居中')
    expect(chips[2].text()).toBe('跳过')
  })

  it('点击"等比例撑满宽度"应 emit imageAlign/fill', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { mode: 'image-align', commandId: 'align-md-images' },
    })
    const fillChip = wrapper.findAll('.local-command-message__chip')[0]
    await fillChip.trigger('click')
    expect(wrapper.emitted('select')[0][0]).toEqual({
      kind: 'imageAlign',
      mode: 'fill',
    })
  })

  it('imageAlignAllowKeep=false 时不渲染"跳过"按钮', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: {
        mode: 'image-align',
        commandId: 'align-md-images',
        imageAlignAllowKeep: false,
      },
    })
    const chips = wrapper.findAll('.local-command-message__chip')
    expect(chips.length).toBe(2)
    expect(wrapper.find('.local-command-message__close').exists()).toBe(false)
  })
})

describe('LocalCommandMessage - preference 模式', () => {
  it('应渲染"是的，记下来"与"不用了"按钮', () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { mode: 'preference', commandId: 'format-md' },
    })
    const chips = wrapper.findAll('.local-command-message__chip')
    expect(chips.length).toBe(2)
    expect(chips[0].text()).toBe('是的，记下来')
    expect(chips[1].text()).toBe('不用了')
  })

  it('点击"是的，记下来"应 emit preference-confirm 事件', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { mode: 'preference', commandId: 'format-md', preferenceKey: 'template' },
    })
    await wrapper.findAll('.local-command-message__chip')[0].trigger('click')
    expect(wrapper.emitted('preference-confirm')).toBeTruthy()
    expect(wrapper.emitted('preference-confirm')[0][0]).toEqual({ key: 'template' })
  })

  it('点击"不用了"应 emit preference-skip 事件', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { mode: 'preference', commandId: 'format-md' },
    })
    await wrapper.findAll('.local-command-message__chip')[1].trigger('click')
    expect(wrapper.emitted('preference-skip')).toBeTruthy()
  })

  // 回归：以前 confirmPreference / skipPreference 会同时 emit 'select' 与 'preference-confirm' / 'preference-skip'，
  // AiChatWindow 中两个事件都转发到 onLocalCommandSelect，导致 handleLocalCommandSelect 被调用两次，
  // 最终在 AiAssistantPlaceholder 里 push 两条相同的回复。现在只 emit 语义事件，避免重复。
  it('点击"是的，记下来"不应再重复触发 select 事件', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { mode: 'preference', commandId: 'format-md', preferenceKey: 'template' },
    })
    await wrapper.findAll('.local-command-message__chip')[0].trigger('click')
    expect(wrapper.emitted('select')).toBeFalsy()
    expect(wrapper.emitted('preference-confirm')).toBeTruthy()
    expect(wrapper.emitted('preference-confirm').length).toBe(1)
  })

  it('点击"不用了"不应再重复触发 select 事件', async () => {
    const wrapper = mount(LocalCommandMessage, {
      props: { mode: 'preference', commandId: 'format-md', preferenceKey: 'template' },
    })
    await wrapper.findAll('.local-command-message__chip')[1].trigger('click')
    expect(wrapper.emitted('select')).toBeFalsy()
    expect(wrapper.emitted('preference-skip')).toBeTruthy()
    expect(wrapper.emitted('preference-skip').length).toBe(1)
  })
})