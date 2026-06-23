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

vi.mock('@/components/ai/AiMarkdownContent.vue', () => ({
  default: {
    name: 'AiMarkdownContent',
    props: ['content'],
    template: '<div class="mock-markdown">{{ content }}</div>',
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

      expect(wrapper.find('.ai-chat-window__empty').text()).toContain('暂无消息')
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

      await wrapper.get('[aria-label="取消钉住窗口"]').trigger('click')

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

      expect(wrapper.get('.ai-chat-window__header').classes()).toContain(
        'ai-chat-window__header--pinned',
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

      expect(wrapper.find('.ai-chat-window__context-text').text()).toBe('需要润色的段落')
      wrapper.unmount()
    })
  })

  describe('边界条件', () => {
    it('离线时应显示横幅并禁用输入框', () => {
      isOffline.value = true
      const wrapper = mountChatWindow()

      expect(wrapper.find('.ai-chat-window__offline-banner').exists()).toBe(true)
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

    it('窗口从关闭变为打开时应预加载知识库列表', async () => {
      const { fetchKnowledgeList } = await import('@/utils/knowledgeApi')
      fetchKnowledgeList.mockClear()

      const wrapper = mount(AiChatWindow, {
        props: { visible: false },
        attachTo: document.body,
      })

      await wrapper.setProps({ visible: true })
      await flushPromises()

      expect(fetchKnowledgeList).toHaveBeenCalled()
      wrapper.unmount()
    })
  })
})
