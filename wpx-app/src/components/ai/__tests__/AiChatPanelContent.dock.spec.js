/**
 * AiChatPanelContent — dock 切换按钮行为单元测试
 *
 * 覆盖场景：
 * - isDocked=false 时显示 dock 按钮，点击触发 dock-change(true)
 * - isDocked=true 时按钮 aria-pressed=true，点击触发 dock-change(false)
 * - docked 状态切换正确反映在 button class、title、aria-label
 * - dock 按钮不应触发 pin-change / close 事件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// ── 依赖 mock ──────────────────────────────────────────────
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: ref({ value: { path: '/' } }),
  }),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    isLoggingIn: ref(false),
    login: vi.fn(),
    logout: vi.fn(),
    currentUser: ref(null),
  }),
}))

vi.mock('@/composables/useWindowSize', () => ({
  useWindowSize: () => ({
    width: ref(1200),
    height: ref(800),
    avatarSize: ref(56),
    chatWindowLayout: ref({ defaultW: 400, defaultH: 500, minW: 300, minH: 300 }),
    chatWindowMinTop: ref(0),
    isCompactWidth: ref(false),
  }),
}))

vi.mock('@/composables/useOnlineStatus', () => ({
  useOnlineStatus: () => ({
    isOffline: ref(false),
    networkRequiredTooltip: '需要网络连接',
  }),
}))

vi.mock('@/composables/useEscapeKey', () => ({
  useEscapeKey: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    isDark: false,
  }),
}))

vi.mock('@/utils/knowledgeApi', () => ({
  fetchKnowledgeList: vi.fn().mockResolvedValue([]),
  fetchKnowledgePreview: vi.fn().mockResolvedValue({ content: '' }),
}))

vi.mock('@/utils/slideExport', () => ({
  downloadSlidesAsHtml: vi.fn(),
  downloadSlidesAsPptx: vi.fn(),
  downloadSlidesAsPdf: vi.fn(),
}))

vi.mock('@/composables/usePPTWorkflow', () => ({
  usePPTWorkflow: () => ({
    state: ref({
      step: 'STEP_OUTLINE',
      topic: '',
      outline: '',
      templateId: null,
      templateCustom: '',
      slides: [],
      lastError: '',
      lastMessage: '',
      busy: false,
      startedAt: null,
      completedAt: null,
    }),
    step: { OUTLINE: 'STEP_OUTLINE', TEMPLATE: 'STEP_TEMPLATE', GENERATE: 'STEP_GENERATE', EDITING: 'STEP_EDITING' },
    currentStep: ref('STEP_OUTLINE'),
    stepIndex: ref(0),
    isBusy: ref(false),
    progress: ref(0.25),
    hasOutline: ref(false),
    hasTemplate: ref(false),
    hasSlides: ref(false),
    startWorkflow: vi.fn(),
    confirmOutline: vi.fn(),
    selectTemplate: vi.fn(),
    onSlidesGenerated: vi.fn(),
    markBusy: vi.fn(),
    setError: vi.fn(),
    setMessage: vi.fn(),
    resetWorkflow: vi.fn(),
    getSystemPromptAddition: vi.fn(() => ''),
    onStepChange: vi.fn(() => () => {}),
  }),
  PPT_STEP: { OUTLINE: 'STEP_OUTLINE', TEMPLATE: 'STEP_TEMPLATE', GENERATE: 'STEP_GENERATE', EDITING: 'STEP_EDITING' },
}))

vi.mock('@/components/ai/AiMarkdownContent.vue', () => ({
  default: {
    name: 'AiMarkdownContent',
    props: ['content'],
    template: '<div class="mock-md">{{ content }}</div>',
  },
}))

vi.mock('@/components/ai/LocalCommandMessage.vue', () => ({
  default: {
    name: 'LocalCommandMessage',
    props: ['message', 'busy'],
    template: '<div class="mock-local-cmd">{{ message?.commandId || "empty" }}</div>',
  },
}))

import AiChatPanelContent from '@/components/ai/AiChatPanelContent.vue'

function mountPanelV(props = {}) {
  return mount(AiChatPanelContent, {
    props: {
      messages: [],
      modelName: 'DeepSeek-V3',
      localCommandPlaceholders: [],
      ...props,
    },
    attachTo: document.body,
  })
}

// ── 测试 ──────────────────────────────────────────────────
describe('AiChatPanelContent — dock 切换按钮', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('isDocked=false 时渲染 dock 按钮，title 提示贴边', () => {
    const wrapper = mountPanelV({ isDocked: false })

    const btn = wrapper.find('.ai-chat-panel__action--dock')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('title')).toContain('贴边到右侧')
    expect(btn.attributes('aria-label')).toBe('贴边到右侧')
    expect(btn.attributes('aria-pressed')).toBe('false')
    // 未激活时不应有 active class
    expect(btn.classes()).not.toContain('ai-chat-panel__action--active')
    wrapper.unmount()
  })

  it('isDocked=true 时 dock 按钮处于激活态', () => {
    const wrapper = mountPanelV({ isDocked: true })

    const btn = wrapper.find('.ai-chat-panel__action--dock')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('title')).toBe('恢复为浮窗')
    expect(btn.attributes('aria-label')).toBe('恢复为浮窗')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(btn.classes()).toContain('ai-chat-panel__action--active')
    wrapper.unmount()
  })

  it('点击 dock 按钮（isDocked=false）应触发 dock-change(true)', async () => {
    const wrapper = mountPanelV({ isDocked: false })

    await wrapper.find('.ai-chat-panel__action--dock').trigger('click')

    expect(wrapper.emitted('dock-change')).toBeDefined()
    expect(wrapper.emitted('dock-change')).toHaveLength(1)
    expect(wrapper.emitted('dock-change')[0]).toEqual([true])
    // 不应触发其它事件
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.emitted('pin-change')).toBeUndefined()
    wrapper.unmount()
  })

  it('点击 dock 按钮（isDocked=true）应触发 dock-change(false)', async () => {
    const wrapper = mountPanelV({ isDocked: true })

    await wrapper.find('.ai-chat-panel__action--dock').trigger('click')

    expect(wrapper.emitted('dock-change')).toBeDefined()
    expect(wrapper.emitted('dock-change')).toHaveLength(1)
    expect(wrapper.emitted('dock-change')[0]).toEqual([false])
    wrapper.unmount()
  })

  it('isDocked=true 时 header 应带 docked class（视觉状态）', () => {
    const wrapper = mountPanelV({ isDocked: true })

    const header = wrapper.find('.ai-chat-panel__header')
    expect(header.classes()).toContain('ai-chat-panel__header--docked')
    wrapper.unmount()
  })

  it('isDocked=false 时 header 不应带 docked class', () => {
    const wrapper = mountPanelV({ isDocked: false })

    const header = wrapper.find('.ai-chat-panel__header')
    expect(header.classes()).not.toContain('ai-chat-panel__header--docked')
    wrapper.unmount()
  })

  it('dock 按钮与 pin 按钮是相互独立的 action（独立触发）', async () => {
    const wrapper = mountPanelV({ isDocked: false, isPinned: false })

    await wrapper.find('.ai-chat-panel__action--dock').trigger('click')
    expect(wrapper.emitted('dock-change')).toHaveLength(1)
    expect(wrapper.emitted('pin-change')).toBeUndefined()

    // 单独触发 pin 不应影响 dock
    await wrapper.find('.ai-chat-panel__action--pin').trigger('click')
    expect(wrapper.emitted('pin-change')).toHaveLength(1)
    expect(wrapper.emitted('dock-change')).toHaveLength(1)
    wrapper.unmount()
  })
})