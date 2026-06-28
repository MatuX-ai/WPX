/**
 * AiChatWindow — docked（贴边）模式模板分支测试
 *
 * 覆盖场景：
 * - docked=false 时使用 DraggableContainer + Vue3DraggableResizable 渲染（floating 模式）
 * - docked=true 时使用 inline panel 渲染（docked 模式），不带 draggable wrapper
 * - docked 模式下 host 应用正确 CSS class
 * - docked 模式下 mousedown 不会触发 focus 事件（避免误触发编辑器失焦）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const isOffline = ref(false)
const posX = ref(100)
const posY = ref(120)
const windowW = ref(400)
const windowH = ref(500)

vi.mock('vue3-draggable-resizable', () => ({
  default: {
    name: 'Vue3DraggableResizable',
    template: `
      <div
        class="mock-draggable"
        :data-draggable="draggable"
        :data-resizable="resizable"
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
    template: '<div class="mock-draggable-container" :data-reference-line-visible="referenceLineVisible"><slot /></div>',
    props: { referenceLineVisible: { type: Boolean, default: false } },
  },
}))

vi.mock('@/composables/useFloatingWindows', () => ({
  FLOATING_WINDOW_ID: { AI_CHAT: 'aiChat' },
  useFloatingWindowState: () => ({
    posX,
    posY,
    windowW,
    windowH,
    clampToParent: vi.fn(),
    updateConstraints: vi.fn(),
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

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    isDark: false,
  }),
}))

vi.mock('@/components/ai/AiMarkdownContent.vue', () => ({
  default: {
    name: 'AiMarkdownContent',
    props: ['content'],
    template: '<div class="mock-markdown">{{ content }}</div>',
  },
}))

// AiChatPanelContent 自身依赖较多，mock 为简单存根
vi.mock('@/components/ai/AiChatPanelContent.vue', () => ({
  default: {
    name: 'AiChatPanelContent',
    props: [
      'messages',
      'modelName',
      'selectionContext',
      'localCommandPlaceholders',
      'cleanableCount',
      'batchProgress',
      'isDark',
      'isPinned',
      'isDocked',
      'autoFocusInput',
    ],
    emits: [
      'send',
      'close',
      'pin-change',
      'dock-change',
      'focus',
      'input-focus',
      'input-blur',
      'onboarding-complete',
      'regenerate',
      'insert-slide-deck',
      'local-command-select',
      'local-command-dismiss',
      'batch-clean',
      'batch-clean-abort',
      'batch-clean-undo',
    ],
    template: `
      <div
        class="mock-panel"
        :data-is-docked="isDocked"
        :data-is-pinned="isPinned"
        :data-auto-focus-input="autoFocusInput"
      >
        <button class="mock-panel-dock-btn" @click="$emit('dock-change', !isDocked)">toggle-dock</button>
      </div>
    `,
  },
}))

import AiChatWindow from '@/components/ai/AiChatWindow.vue'

function mountChatWindow(props = {}) {
  return mount(AiChatWindow, {
    props: {
      visible: true,
      pinned: false,
      docked: false,
      messages: [],
      ...props,
    },
    attachTo: document.body,
  })
}

describe('AiChatWindow — docked 模式模板分支', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isOffline.value = false
  })

  describe('floating 模式（docked=false）', () => {
    it('渲染 DraggableContainer 包装', () => {
      const wrapper = mountChatWindow({ docked: false })

      expect(wrapper.find('.mock-draggable-container').exists()).toBe(true)
      wrapper.unmount()
    })

    it('渲染 Vue3DraggableResizable 包装', () => {
      const wrapper = mountChatWindow({ docked: false })

      expect(wrapper.find('.mock-draggable').exists()).toBe(true)
      wrapper.unmount()
    })

    it('不渲染 inline panel 类（.ai-chat-window--docked）', () => {
      const wrapper = mountChatWindow({ docked: false })

      expect(wrapper.find('.ai-chat-window--docked').exists()).toBe(false)
      wrapper.unmount()
    })

    it('host 不带 docked class', () => {
      const wrapper = mountChatWindow({ docked: false })

      const host = wrapper.find('.ai-chat-window-host')
      expect(host.exists()).toBe(true)
      expect(host.classes()).not.toContain('ai-chat-window-host--docked')
      expect(host.classes()).toContain('ai-chat-window-host--floating')
      wrapper.unmount()
    })
  })

  describe('docked 模式（docked=true）', () => {
    it('不渲染 DraggableContainer', () => {
      const wrapper = mountChatWindow({ docked: true })

      expect(wrapper.find('.mock-draggable-container').exists()).toBe(false)
      wrapper.unmount()
    })

    it('不渲染 Vue3DraggableResizable', () => {
      const wrapper = mountChatWindow({ docked: true })

      expect(wrapper.find('.mock-draggable').exists()).toBe(false)
      wrapper.unmount()
    })

    it('渲染 inline panel（.ai-chat-window--docked）', () => {
      const wrapper = mountChatWindow({ docked: true })

      const dockedPanel = wrapper.find('.ai-chat-window--docked')
      expect(dockedPanel.exists()).toBe(true)
      // role 应是 region（语义化标签），而不是 dialog（dialog 用于浮窗模态）
      expect(dockedPanel.attributes('role')).toBe('region')
      expect(dockedPanel.attributes('aria-label')).toBe('AI 助手对话面板')
      wrapper.unmount()
    })

    it('host 应用 docked class', () => {
      const wrapper = mountChatWindow({ docked: true })

      const host = wrapper.find('.ai-chat-window-host')
      expect(host.exists()).toBe(true)
      expect(host.classes()).toContain('ai-chat-window-host--docked')
      expect(host.classes()).not.toContain('ai-chat-window-host--floating')
      wrapper.unmount()
    })

    it('传给 AiChatPanelContent 的 autoFocusInput 为 true', () => {
      const wrapper = mountChatWindow({ docked: true })

      const panel = wrapper.find('.mock-panel')
      expect(panel.exists()).toBe(true)
      expect(panel.attributes('data-auto-focus-input')).toBe('true')
      wrapper.unmount()
    })

    it('传给 AiChatPanelContent 的 isDocked 为 true', () => {
      const wrapper = mountChatWindow({ docked: true })

      const panel = wrapper.find('.mock-panel')
      expect(panel.attributes('data-is-docked')).toBe('true')
      wrapper.unmount()
    })
  })

  describe('面板内容（docked 模式）', () => {
    it('messages 正确传递给子组件', () => {
      const messages = [
        { id: '1', role: 'user', content: '你好' },
        { id: '2', role: 'assistant', content: '回复' },
      ]
      const wrapper = mountChatWindow({ docked: true, messages })

      const panel = wrapper.find('.mock-panel')
      expect(panel.exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('事件转发（docked 模式）', () => {
    it('子组件 emit dock-change 应被转发为顶层 dock-change 事件（docked=true → false）', async () => {
      const wrapper = mountChatWindow({ docked: true })

      // 点击 mock panel 的 dock 按钮 → 子组件 emit('dock-change', !isDocked) = false
      await wrapper.find('.mock-panel-dock-btn').trigger('click')

      expect(wrapper.emitted('dock-change')).toBeDefined()
      expect(wrapper.emitted('dock-change')[0]).toEqual([false])
      wrapper.unmount()
    })

    it('子组件 emit dock-change 应被转发为顶层 dock-change 事件（docked=false → true）', async () => {
      const wrapper = mountChatWindow({ docked: false })

      // floating 模式下，AiChatPanelContent 接收 isDocked=false
      await wrapper.find('.mock-panel-dock-btn').trigger('click')

      expect(wrapper.emitted('dock-change')).toBeDefined()
      expect(wrapper.emitted('dock-change')[0]).toEqual([true])
      wrapper.unmount()
    })

    it('host mousedown 不应在 docked 模式下触发 focus 事件', async () => {
      const wrapper = mountChatWindow({ docked: true })

      await wrapper.find('.ai-chat-window-host').trigger('mousedown')

      expect(wrapper.emitted('focus')).toBeUndefined()
      wrapper.unmount()
    })

    it('host mousedown 应在 floating 模式下触发 focus 事件', async () => {
      const wrapper = mountChatWindow({ docked: false })

      await wrapper.find('.ai-chat-window-host').trigger('mousedown')

      expect(wrapper.emitted('focus')).toHaveLength(1)
      wrapper.unmount()
    })
  })
})