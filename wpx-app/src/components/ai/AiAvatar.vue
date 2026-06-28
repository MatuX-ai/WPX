<script setup>
import { computed } from 'vue'
import {
  AI_AVATAR_PRESET_IDS,
  DEFAULT_AVATAR_ID,
  getAvatarUrlById,
} from '@/constants/aiAvatars'
import { shortcutTooltip } from '@/composables/useGlobalShortcuts'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useWindowSize } from '@/composables/useWindowSize'
import { useWindowStore } from '@/stores/window'
import { useJcodeSettingsStore } from '@/stores/jcodeSettings'
import JcodeStatusIndicator from '@/components/ai/JcodeStatusIndicator.vue'

const props = defineProps({
  preset: {
    type: String,
    default: DEFAULT_AVATAR_ID,
    validator: (value) => AI_AVATAR_PRESET_IDS.includes(value),
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle'])

const displayUrl = computed(() => props.avatarUrl || getAvatarUrlById(props.preset))
const avatarTitle = shortcutTooltip('AI 写作助手', 'toggleAiChat')
const avatarAriaLabel = computed(() =>
  isOffline.value ? 'AI 写作助手（离线模式）' : '打开 AI 写作助手对话窗',
)

const windowSize = useWindowSize()
const windowStore = useWindowStore()
const jcodeStore = useJcodeSettingsStore()
const { isOffline } = useOnlineStatus()
const isBreathing = computed(
  () => !props.loading && windowStore.isWindowFocused && !isOffline.value,
)
const avatarSize = computed(() => windowSize.avatarSize.value)
const avatarHostStyle = computed(() => ({
  width: `${avatarSize.value}px`,
  height: `${avatarSize.value}px`,
}))
const avatarButtonStyle = computed(() => ({
  width: `${avatarSize.value}px`,
  height: `${avatarSize.value}px`,
}))

// jcode 状态：合并 settings + runtime 为单一 status 对象供指示器使用
const jcodeStatus = computed(() => {
  const s = jcodeStore.settings || {}
  const r = jcodeStore.runtime || {}
  return {
    installed: r.installed === true,
    enabled: s.enabled === true,
    state: r.state || (r.installed ? 'stopped' : 'not_installed'),
    version: r.version || s.lastDetectedVersion || '',
    lastError: r.lastError || '',
  }
})

function handleToggle() {
  emit('toggle')
}

function handleKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleToggle()
  }
}
</script>

<template>
  <div
    class="ai-avatar-host pointer-events-auto fixed bottom-5 right-5 z-[var(--z-ai-avatar)]"
    :class="{ 'ai-avatar-host--offline': isOffline }"
    :style="avatarHostStyle"
  >
    <span
      v-if="loading"
      class="pointer-events-none absolute -inset-[5px] z-[2] rounded-full border-2 border-transparent border-t-accent border-r-accent/45 animate-ai-ring motion-reduce:animate-none motion-reduce:border-r-accent motion-reduce:opacity-65"
      aria-hidden="true"
    />

    <button
      type="button"
      class="ai-avatar-btn relative z-[1] cursor-pointer overflow-hidden rounded-full border-none bg-accent p-0 shadow-md transition-transform duration-200 ease-out hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent motion-reduce:animate-none motion-reduce:transition-none"
      :class="[
        isBreathing ? 'animate-[pulse-shadow_2s_ease-in-out_infinite]' : '',
        { 'ai-avatar-btn--offline': isOffline },
      ]"
      :style="avatarButtonStyle"
      :title="isOffline ? '当前离线，AI 功能不可用' : avatarTitle"
      :aria-label="avatarAriaLabel"
      :aria-busy="loading"
      @click="handleToggle"
      @keydown="handleKeydown"
    >
      <img
        :src="displayUrl"
        alt=""
        class="ai-avatar-btn__image block h-full w-full object-cover"
      />
    </button>

    <span
      v-if="isOffline"
      class="ai-avatar-host__offline-dot"
      aria-hidden="true"
    />

    <JcodeStatusIndicator
      v-if="jcodeStatus.installed"
      :status="jcodeStatus"
    />
  </div>
</template>

<style scoped>
.ai-avatar-btn--offline {
  filter: grayscale(1);
  opacity: 0.72;
}

.ai-avatar-btn--offline:hover {
  transform: none;
}

.ai-avatar-host__offline-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 3;
  width: 10px;
  height: 10px;
  border: 2px solid var(--theme-bg, #fff);
  border-radius: 9999px;
  background: #ef4444;
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.35);
}

@media (prefers-reduced-motion: reduce) {
  .ai-avatar-btn {
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  }
}
</style>
