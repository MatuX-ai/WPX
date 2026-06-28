import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AiChatWindow from '../AiChatWindow.vue'

const isOffline = ref(false)
const posX = ref(100)
const posY = ref(120)
const windowW = ref(400)
const windowH = ref(500)

const mockClampToParent = vi.fn()
const mockUpdateConstraints = vi.fn()

vi.mock('vue3-draggable-resizable', () => ({
  default: {
    name: 'Vue3DraggableResizable',
    template: `
      <div
        class="mock-draggable"
        :data-draggable="draggable"
        :data-resizable="resizable"
        @mouseup="$emit('drag-end')"
        @mouseleave="$emit('resize-end')"
      >
        <slot />
      </div>
    `,
    props: {
      initW: Number,
      initH: Number,
      x: Number,
      y: Number,
      w: Number,
      h: Number,
      minW: Number,
      minH: Number,
      draggable: Boolean,
      resizable: Boolean,
      parent: Boolean,
      handles: Array,
    },
    emits: ['drag-end', 'resize-end', 'update:x', 'update:y', 'update:w', 'update:h'],
  },
  DraggableContainer: {
    name: 'DraggableContainer',
    template: '<div class="mock-draggable-container"><slot /></div>',
  },
}))

vi.mock('@/composables/useFloatingWindows', () => ({
  FLOATING_WINDOW_ID: { AI_CHAT: 'aiChat' },
  useFloatingWindowState: () => ({
    posX,
    posY,
    windowW,
    windowH,
    clampToParent: mockClampToParent,
    updateConstraints: mockUpdateConstraints,
  }),
}))

vi.mock('@/composables/useWindowSize', () => ({
  useWindowSize: () => ({
    width: ref(1200),
    height: ref(800),
    avatarSize: ref(56),
    chatWindowLayout: ref({
      defaultW: 400,
      defaultH: 500,
      minW: 300,
      minH: 300,
    }),
    chatWindowMinTop: ref(0),
  }),
}))

vi.mock('@/composables/useOnlineStatus', () => ({
  useOnlineStatus: () => ({
    isOffline,
    networkRequiredTooltip: '需要网络连接',
  }),
}))

vi.mock('@/composables/useEscapeKey', () => ({
  useEscapeKey: vi.fn(),
}))

vi.mock('@vueuse/integrations/useFocusTrap', () => ({
  useFocusTrap: () => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}))

vi.mock('@/utils/knowledgeApi', () => ({
  fetchKnowledgeList: vi.fn().mockResolvedValue([]),
  fetchKnowledgePreview: vi.fn().mockResolvedValue({ content: '' }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { path: '/' } },
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
    template: '<div class="mock-markdown">{{ content }}</div>',
  },
}))

vi.mock('@/components/ai/LocalCommandMessage.vue', () => ({
  default: {
    name: 'LocalCommandMessage',
    props: ['message', 'busy'],
    template: '<div class="mock-local-cmd">{{ message?.commandId || "empty" }}</div>',
  },
}))

function mountChatWindow(props = {}) {
  return mount(AiChatWindow, {
    props: {
      visible: true,
      pinned: false,
      messages: [],
      ...props,
    },
    attachTo: document.body,
  })
}

describe('AiChatWindow.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isOffline.value = false
    posX.value = 100
    posY.value = 120
    windowW.value = 400
    windowH.value = 500
    mockClampToParent.mockClear()
    mockUpdateConstraints.mockClear()
  })

  describe('正常渲染', () => {
    it('visible 为 true 时应渲染对话窗主体', () => {
      const wrapper = mountChatWindow({ modelName: 'DeepSeek-V3' })

      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('AI 写作助手')
      expect(wrapper.text()).toContain('DeepSeek-V3')
      wrapper.unmount()
    })

    it('visible 为 false 时不应渲染对话窗', () => {
      const wrapper = mount(AiChatWindow, {
        props: { visible: false },
        attachTo: document.body,
      })

      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('应渲染用户与助手消息', () => {
      const wrapper = mountChatWindow({
        messages: [
          { id: '1', role: 'user', content: '你好' },
          { id: '2', role: 'assistant', content: '**回复**' },
        ],
      })

      expect(wrapper.text()).toContain('你好')
      expect(wrapper.find('.mock-markdown').text()).toBe('**回复**')
      wrapper.unmount()
    })

    it('无消息时应显示空状态提示', () => {
      const wrapper = mountChatWindow()

      expect(wrapper.find('.ai-chat-panel__empty').text()).toContain('暂无消息')
      wrapper.unmount()
    })
  })

  describe('事件触发', () => {
    it('点击关闭按钮应触发 close 事件', async () => {
      const wrapper = mountChatWindow()

      await wrapper.get('[aria-label="关闭对话窗"]').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
      wrapper.unmount()
    })

    it('点击钉住按钮应触发 pin-change 事件', async () => {
      const wrapper = mountChatWindow({ pinned: false })

      await wrapper.get('[aria-label="钉住窗口"]').trigger('click')

      expect(wrapper.emitted('pin-change')).toEqual([[true]])
      wrapper.unmount()
    })

    it('取消钉住时应触发 pin-change false', async () => {
      const wrapper = mountChatWindow({ pinned: true })

      // AiChatPanelContent 中钉住按钮的 aria-label 是固定的 "钉住窗口"，
      // 区分状态是通过 :title (取消钉住 / 钉住) 与 ai-chat-panel__action--active class。
      const pinBtn = wrapper.get('[aria-label="钉住窗口"]')
      expect(pinBtn.attributes('title')).toBe('取消钉住')
      expect(pinBtn.classes()).toContain('ai-chat-panel__action--active')
      await pinBtn.trigger('click')

      expect(wrapper.emitted('pin-change')).toEqual([[false]])
      wrapper.unmount()
    })

    it('输入消息后按 Enter 应触发 send 事件', async () => {
      const wrapper = mountChatWindow()
      const textarea = wrapper.get('textarea')

      await textarea.setValue('测试消息')
      await textarea.trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('send')).toHaveLength(1)
      expect(wrapper.emitted('send')[0][0]).toEqual({
        text: '测试消息',
        references: [],
      })
      wrapper.unmount()
    })

    it('mousedown 宿主区域应触发 focus 事件', async () => {
      const wrapper = mountChatWindow()

      await wrapper.get('.ai-chat-window-host').trigger('mousedown')

      expect(wrapper.emitted('focus')).toHaveLength(1)
      wrapper.unmount()
    })
  })

  describe('钉住、消息与拖拽缩放', () => {
    it('钉住时标题栏应显示 pinned 样式', () => {
      const wrapper = mountChatWindow({ pinned: true })

      expect(wrapper.get('.ai-chat-panel__header').classes()).toContain(
        'ai-chat-panel__header--pinned',
      )
      wrapper.unmount()
    })

    it('钉住时拖拽组件应禁用 draggable', () => {
      const wrapper = mountChatWindow({ pinned: true })

      expect(wrapper.get('.mock-draggable').attributes('data-draggable')).toBe('false')
      wrapper.unmount()
    })

    it('未钉住时应允许拖拽', () => {
      const wrapper = mountChatWindow({ pinned: false })

      expect(wrapper.get('.mock-draggable').attributes('data-draggable')).toBe('true')
      wrapper.unmount()
    })

    it('拖拽结束应约束窗口位置', async () => {
      const wrapper = mountChatWindow()

      await wrapper.get('.mock-draggable').trigger('mouseup')

      expect(mockClampToParent).toHaveBeenCalledWith({ snap: true })
      wrapper.unmount()
    })

    it('缩放结束应约束窗口位置', async () => {
      const wrapper = mountChatWindow()

      await wrapper.get('.mock-draggable').trigger('mouseleave')

      expect(mockClampToParent).toHaveBeenCalledWith({ snap: true })
      wrapper.unmount()
    })

    it('应渲染选中文本上下文', () => {
      const wrapper = mountChatWindow({ selectionContext: '需要润色的段落' })

      expect(wrapper.find('.ai-chat-panel__context-text').text()).toBe('需要润色的段落')
      wrapper.unmount()
    })
  })

  describe('边界条件', () => {
    it('离线时应显示横幅并禁用输入框', () => {
      isOffline.value = true
      const wrapper = mountChatWindow()

      expect(wrapper.find('.ai-chat-panel__offline-banner').exists()).toBe(true)
      expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('空消息且无可发送内容时不应触发 send', async () => {
      const wrapper = mountChatWindow()
      const textarea = wrapper.get('textarea')

      await textarea.setValue('   ')
      await textarea.trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('send')).toBeUndefined()
      wrapper.unmount()
    })

    it('Shift+Enter 不应触发 send', async () => {
      const wrapper = mountChatWindow()
      const textarea = wrapper.get('textarea')

      await textarea.setValue('换行测试')
      await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })

      expect(wrapper.emitted('send')).toBeUndefined()
      wrapper.unmount()
    })

    it('窗口打开时应正常渲染面板（fetchKnowledgeList 由 @ 提及触发，见 AiChatPanelContent 测试）', async () => {
      const { fetchKnowledgeList } = await import('@/utils/knowledgeApi')
      fetchKnowledgeList.mockClear()

      const wrapper = mount(AiChatWindow, {
        props: { visible: false },
        attachTo: document.body,
      })

      await wrapper.setProps({ visible: true })
      await flushPromises()

      // AiChatPanelContent 中 fetchKnowledgeList 是懒加载（@ 触发），不再在 visible 变化时预加载
      expect(fetchKnowledgeList).not.toHaveBeenCalled()
      // 面板仍能正常渲染
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('一键清洗提示气泡（Level 3）', () => {
    it('cleanableCount.total < 3 时不应显示提示气泡', () => {
      const wrapper = mountChatWindow({
        cleanableCount: { total: 2, links: 0, urls: 0, emails: 2, phones: 0, md: 0, images: 0 },
      })

      expect(wrapper.find('.ai-chat-panel__cleanable-tip').exists()).toBe(false)
      wrapper.unmount()
    })

    it('cleanableCount.total >= 3 时应显示提示气泡', () => {
      const wrapper = mountChatWindow({
        cleanableCount: { total: 5, links: 0, urls: 0, emails: 3, phones: 2, md: 0, images: 0 },
      })

      const tip = wrapper.find('.ai-chat-panel__cleanable-tip')
      expect(tip.exists()).toBe(true)
      expect(tip.text()).toContain('5')
      expect(tip.text()).toContain('邮箱')
      expect(tip.text()).toContain('手机号')
      wrapper.unmount()
    })

    it('点击"一键清洗"按钮应触发 batch-clean 事件', async () => {
      const wrapper = mountChatWindow({
        cleanableCount: { total: 6, links: 0, urls: 1, emails: 2, phones: 0, md: 3, images: 0 },
      })

      await wrapper.get('.ai-chat-panel__cleanable-tip-btn').trigger('click')

      expect(wrapper.emitted('batch-clean')).toHaveLength(1)
      wrapper.unmount()
    })

    it('cleanableCount 缺省时不应渲染提示气泡（保持向后兼容）', () => {
      const wrapper = mountChatWindow()
      expect(wrapper.find('.ai-chat-panel__cleanable-tip').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('一键清洗进度 / 中断 / 撤销（Level 4）', () => {
    it('batchProgress.active=true 时应显示进度文案与"中断"按钮', () => {
      const wrapper = mountChatWindow({
        batchProgress: { active: true, step: 3, totalSteps: 6, label: '邮箱', counts: null, finished: false },
      })

      const tip = wrapper.find('.ai-chat-panel__cleanable-tip')
      expect(tip.exists()).toBe(true)
      expect(tip.text()).toContain('3/6')
      expect(tip.text()).toContain('邮箱')
      const abortBtn = wrapper.find('[data-test="batch-clean-abort"]')
      expect(abortBtn.exists()).toBe(true)
      expect(abortBtn.text()).toContain('中断')
      wrapper.unmount()
    })

    it('batchProgress.finished=true 时应显示"撤销"按钮并触发 batch-clean-undo', async () => {
      const wrapper = mountChatWindow({
        batchProgress: { active: false, step: 6, totalSteps: 6, label: '完成', counts: {}, finished: true },
      })

      const undoBtn = wrapper.find('[data-test="batch-clean-undo"]')
      expect(undoBtn.exists()).toBe(true)
      await undoBtn.trigger('click')
      expect(wrapper.emitted('batch-clean-undo')).toHaveLength(1)
      wrapper.unmount()
    })

    it('batchProgress.active=true 时点击应不触发 batch-clean（避免重复触发）', async () => {
      const wrapper = mountChatWindow({
        batchProgress: { active: true, step: 2, totalSteps: 6, label: 'URL', counts: null, finished: false },
      })

      const tip = wrapper.find('.ai-chat-panel__cleanable-tip')
      expect(tip.find('[data-test="batch-clean-trigger"]').exists()).toBe(false)
      // 点击 tip 本身不会误触发 batch-clean
      await tip.trigger('click')
      expect(wrapper.emitted('batch-clean')).toBeUndefined()
      wrapper.unmount()
    })

    it('点击"中断"按钮应触发 batch-clean-abort 事件', async () => {
      const wrapper = mountChatWindow({
        batchProgress: { active: true, step: 1, totalSteps: 6, label: '链接', counts: null, finished: false },
      })

      await wrapper.get('[data-test="batch-clean-abort"]').trigger('click')

      expect(wrapper.emitted('batch-clean-abort')).toHaveLength(1)
      wrapper.unmount()
    })

    it('batchProgress 缺省时不应渲染进度 / 中断 / 撤销 按钮', () => {
      const wrapper = mountChatWindow()
      expect(wrapper.find('[data-test="batch-clean-abort"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="batch-clean-undo"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
