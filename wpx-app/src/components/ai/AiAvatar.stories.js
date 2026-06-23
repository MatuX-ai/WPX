import AiAvatar from './AiAvatar.vue'
import { AI_AVATAR_PRESET_IDS } from '@/constants/aiAvatars'

export default {
  title: 'AI/AiAvatar',
  component: AiAvatar,
  argTypes: {
    preset: {
      control: 'select',
      options: AI_AVATAR_PRESET_IDS,
    },
    loading: { control: 'boolean' },
    avatarUrl: { control: 'text' },
  },
  args: {
    preset: 'robot',
    loading: false,
    avatarUrl: '',
  },
}

export const Default = {
  args: {},
}

export const Loading = {
  args: { loading: true },
}

export const RobotAvatar = {
  args: { preset: 'robot' },
}

export const CatAvatar = {
  args: { preset: 'cat' },
}

export const OwlAvatar = {
  args: { preset: 'owl' },
}

export const BookAvatar = {
  args: { preset: 'book' },
}

export const PenAvatar = {
  args: { preset: 'pen' },
}

export const CustomAvatarUrl = {
  args: {
    preset: 'robot',
    avatarUrl: 'https://placehold.co/96x96/7c3aed/white?text=WPX',
  },
}

export const Offline = {
  args: {},
  parameters: {
    mocks: {
      isOffline: true,
    },
  },
}

export const SmallWindow = {
  args: {},
  parameters: {
    mocks: {
      windowSize: { width: 800, height: 600 },
    },
  },
}
