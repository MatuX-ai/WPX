/**
 * AiChatPanelContent — 「使用该文档」按钮
 *
 * - 普通助理回复展示按钮，点击 emit insert-text
 * - 欢迎语 / 错误引导不展示
 * - Skill 成功且含内容时展示按钮
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

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
    step: {
      OUTLINE: 'STEP_OUTLINE',
      TEMPLATE: 'STEP_TEMPLATE',
      GENERATE: 'STEP_GENERATE',
      EDITING: 'STEP_EDITING',
    },
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
  PPT_STEP: {
    OUTLINE: 'STEP_OUTLINE',
    TEMPLATE: 'STEP_TEMPLATE',
    GENERATE: 'STEP_GENERATE',
    EDITING: 'STEP_EDITING',
  },
}))

vi.mock('@/stores/lessonPpt', () => ({
  useLessonPptStore: () => ({
    slides: [],
    theme: 'light',
    title: '',
  }),
}))

vi.mock('@/composables/useHermesTask', () => ({
  useHermesTask: () => ({
    task: ref(null),
    status: ref('idle'),
    steps: ref([]),
    result: ref(null),
    error: ref(null),
    isRunning: ref(false),
    run: vi.fn(),
    dismiss: vi.fn(),
  }),
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
    props: ['message'],
    template: '<div class="mock-local">{{ message?.content }}</div>',
  },
}))

vi.mock('@/components/ai/HermesTaskCard.vue', () => ({
  default: { name: 'HermesTaskCard', template: '<div class="mock-hermes" />' },
}))

import AiChatPanelContent from '@/components/ai/AiChatPanelContent.vue'

function mountPanel(props = {}) {
  return mount(AiChatPanelContent, {
    props: {
      messages: [],
      modelName: 'DeepSeek',
      ...props,
    },
    attachTo: document.body,
  })
}

describe('AiChatPanelContent — 使用该文档', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('普通助理回复应显示「使用该文档」，点击后 emit insert-text', async () => {
    const doc = '# 标题\n\n这是正文段落。'
    const wrapper = mountPanel({
      messages: [
        { id: 'u1', role: 'user', content: '写一篇短文' },
        { id: 'a1', role: 'assistant', content: doc },
      ],
    })

    const btn = wrapper.find('[data-testid="ai-chat-use-document"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('使用该文档')

    await btn.trigger('click')
    expect(wrapper.emitted('insert-text')).toBeTruthy()
    expect(wrapper.emitted('insert-text')[0][0]).toBe(doc)
    wrapper.unmount()
  })

  it('欢迎语不应显示「使用该文档」', () => {
    const wrapper = mountPanel({
      messages: [
        {
          id: 'w1',
          role: 'assistant',
          isWelcome: true,
          content: '你好，我是写作小助手。无需接入大模型即可使用本地命令，如「批量清洗」。',
        },
      ],
    })

    expect(wrapper.find('[data-testid="ai-chat-use-document"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('画布修订 summary 不应显示「使用该文档」', () => {
    const wrapper = mountPanel({
      messages: [
        {
          id: 'd1',
          role: 'assistant',
          content: '已在「邮箱」处填入 1055603323@qq.com',
          documentEditApplied: true,
        },
      ],
    })

    expect(wrapper.find('[data-testid="ai-chat-use-document"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Skill 成功且含内容时应显示「使用该文档」', async () => {
    const doc = '教案正文……'
    const wrapper = mountPanel({
      messages: [
        {
          id: 's1',
          role: 'assistant',
          skillResult: true,
          skillSuccess: true,
          skillName: '教案生成',
          skillId: 'lesson',
          skillParams: {},
          content: doc,
        },
      ],
    })

    const btn = wrapper.find('[data-testid="ai-chat-use-document"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('insert-text')[0][0]).toBe(doc)
    wrapper.unmount()
  })

  it('模型错误引导消息不应显示「使用该文档」', () => {
    const wrapper = mountPanel({
      messages: [
        {
          id: 'e1',
          role: 'assistant',
          content: '请先配置大模型',
          chatErrorMessage: '请先配置大模型',
          needsModelConfig: true,
        },
      ],
    })

    expect(wrapper.find('[data-testid="ai-chat-use-document"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
