import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AiAvatar from '../AiAvatar.vue'
import { getAvatarUrlById } from '@/constants/aiAvatars'
import { useWindowStore } from '@/stores/window'

const isOffline = ref(false)
const avatarSize = ref(56)

vi.mock('@/composables/useOnlineStatus', () => ({
  useOnlineStatus: () => ({
    isOffline,
    networkRequiredTooltip: '需要网络连接',
  }),
}))

vi.mock('@/composables/useWindowSize', () => ({
  useWindowSize: () => ({
    avatarSize,
  }),
}))

vi.mock('@/composables/useGlobalShortcuts', () => ({
  shortcutTooltip: (label) => label,
}))

function mountAvatar(props = {}) {
  return mount(AiAvatar, {
    props: {
      preset: 'robot',
      ...props,
    },
  })
}

describe('AiAvatar.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isOffline.value = false
    avatarSize.value = 56
    useWindowStore().isWindowFocused = true
  })

  describe('正常渲染', () => {
    it('应渲染头像按钮与默认预设图片', () => {
      const wrapper = mountAvatar()

      const button = wrapper.get('button.ai-avatar-btn')
      const image = wrapper.get('img.ai-avatar-btn__image')

      expect(button.exists()).toBe(true)
      expect(image.attributes('src')).toBe(getAvatarUrlById('robot'))
      expect(button.attributes('aria-label')).toBe('打开 AI 写作助手对话窗')
    })

    it('应根据窗口尺寸设置头像容器大小', () => {
      avatarSize.value = 42
      const wrapper = mountAvatar()

      const host = wrapper.get('.ai-avatar-host')
      expect(host.attributes('style')).toContain('width: 42px')
      expect(host.attributes('style')).toContain('height: 42px')
    })
  })

  describe('事件触发', () => {
    it('点击按钮应触发 toggle 事件', async () => {
      const wrapper = mountAvatar()

      await wrapper.get('button.ai-avatar-btn').trigger('click')

      expect(wrapper.emitted('toggle')).toHaveLength(1)
    })

    it('按下 Enter 键应触发 toggle 事件', async () => {
      const wrapper = mountAvatar()

      await wrapper.get('button.ai-avatar-btn').trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('toggle')).toHaveLength(1)
    })

    it('按下其他按键不应触发 toggle 事件', async () => {
      const wrapper = mountAvatar()

      await wrapper.get('button.ai-avatar-btn').trigger('keydown', { key: 'Space' })

      expect(wrapper.emitted('toggle')).toBeUndefined()
    })
  })

  describe('loading 状态与头像切换', () => {
    it('loading 为 true 时应显示加载环并设置 aria-busy', () => {
      const wrapper = mountAvatar({ loading: true })

      expect(wrapper.find('.animate-ai-ring').exists()).toBe(true)
      expect(wrapper.get('button.ai-avatar-btn').attributes('aria-busy')).toBe('true')
    })

    it('loading 为 true 时不应启用呼吸动画', () => {
      const wrapper = mountAvatar({ loading: true })

      const button = wrapper.get('button.ai-avatar-btn')
      expect(button.classes().join(' ')).not.toMatch(/pulse-shadow/)
    })

    it('avatarUrl 应覆盖 preset 预设头像', () => {
      const customUrl = 'https://example.com/custom-avatar.png'
      const wrapper = mountAvatar({
        preset: 'cat',
        avatarUrl: customUrl,
      })

      expect(wrapper.get('img').attributes('src')).toBe(customUrl)
    })

    it('切换 preset 应更新头像地址', () => {
      const wrapper = mountAvatar({ preset: 'owl' })

      expect(wrapper.get('img').attributes('src')).toBe(getAvatarUrlById('owl'))
    })
  })

  describe('边界条件', () => {
    it('离线时应显示离线样式与提示', () => {
      isOffline.value = true
      const wrapper = mountAvatar()

      expect(wrapper.get('.ai-avatar-host').classes()).toContain('ai-avatar-host--offline')
      expect(wrapper.get('button.ai-avatar-btn').classes()).toContain('ai-avatar-btn--offline')
      expect(wrapper.find('.ai-avatar-host__offline-dot').exists()).toBe(true)
      expect(wrapper.get('button').attributes('title')).toBe('当前离线，AI 功能不可用')
      expect(wrapper.get('button').attributes('aria-label')).toBe('AI 写作助手（离线模式）')
    })

    it('窗口失焦时不应启用呼吸动画', () => {
      useWindowStore().isWindowFocused = false
      const wrapper = mountAvatar()

      const button = wrapper.get('button.ai-avatar-btn')
      expect(button.classes().join(' ')).not.toMatch(/pulse-shadow/)
    })

    it('未传 avatarUrl 时应回退到 preset 对应地址', () => {
      const wrapper = mountAvatar({ preset: 'pen', avatarUrl: '' })

      expect(wrapper.get('img').attributes('src')).toBe(getAvatarUrlById('pen'))
    })
  })
})
