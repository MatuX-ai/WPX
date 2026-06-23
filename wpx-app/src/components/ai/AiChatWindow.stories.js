import AiChatWindow from './AiChatWindow.vue'
import { EMPTY_MESSAGES, SIMPLE_USER_ASSISTANT, RICH_MIXED } from '@/storybook/fixtures/chat-messages'

export default {
  title: 'AI/AiChatWindow',
  component: AiChatWindow,
  argTypes: {
    visible: { control: 'boolean' },
    pinned: { control: 'boolean' },
    modelName: { control: 'text' },
    selectionContext: { control: 'text' },
    zIndex: { control: 'number' },
  },
  args: {
    visible: true,
    pinned: false,
    modelName: 'DeepSeek-V3',
    zIndex: 1001,
    selectionContext: '',
  },
  parameters: {
    layout: 'fullscreen',
  },
}

export const LightEmpty = {
  args: {
    messages: EMPTY_MESSAGES,
  },
  parameters: {
    theme: 'light',
    mocks: { isOffline: false },
  },
}

export const LightWithMessages = {
  args: {
    messages: RICH_MIXED,
  },
  parameters: {
    theme: 'light',
    mocks: { isOffline: false },
  },
}

export const LightWithSelectionContext = {
  args: {
    messages: SIMPLE_USER_ASSISTANT,
    selectionContext: '需要润色的段落：Storybook 让组件开发更有信心。',
  },
  parameters: {
    theme: 'light',
    mocks: { isOffline: false },
  },
}

export const DarkEmpty = {
  args: {
    messages: EMPTY_MESSAGES,
  },
  parameters: {
    theme: 'dark',
    mocks: { isOffline: false },
  },
}

export const DarkWithMessages = {
  args: {
    messages: RICH_MIXED,
  },
  parameters: {
    theme: 'dark',
    mocks: { isOffline: false },
  },
}

export const Pinned = {
  args: {
    pinned: true,
    messages: RICH_MIXED,
  },
  parameters: {
    theme: 'light',
    mocks: { isOffline: false },
  },
}

export const Offline = {
  args: {
    messages: RICH_MIXED,
  },
  parameters: {
    theme: 'light',
    mocks: { isOffline: true },
  },
}
