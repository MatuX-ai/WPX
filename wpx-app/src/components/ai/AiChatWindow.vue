<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vue3DraggableResizable from 'vue3-draggable-resizable'
import { DraggableContainer } from 'vue3-draggable-resizable'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import AiChatPanelContent from '@/components/ai/AiChatPanelContent.vue'
import {
  AI_AVATAR,
  AI_CHAT_WINDOW,
} from '@/constants/floatingWindow'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
} from '@/composables/useFloatingWindows'
import { useWindowSize } from '@/composables/useWindowSize'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  /**
   * 贴边（docked）模式：true 时，窗口作为右栏 inline panel 渲染，
   * 拖拽、resize、贴边等浮窗行为被禁用。
   * 默认 false（floating 浮窗模式）。
   */
  docked: {
    type: Boolean,
    default: false,
  },
  zIndex: {
    type: Number,
    default: undefined,
  },
  modelName: {
    type: String,
    default: '未配置 · 请在「我的模型」中接入',
  },
  messages: {
    type: Array,
    default: () => [],
  },
  selectionContext: {
    type: String,
    default: '',
  },
  localCommandPlaceholders: {
    type: Array,
    default: () => [],
  },
  cleanableCount: {
    type: Object,
    default: () => ({ total: 0, links: 0, urls: 0, emails: 0, phones: 0, md: 0, images: 0 }),
  },
  batchProgress: {
    type: Object,
    default: () => ({ active: false, step: 0, totalSteps: 6, label: '', counts: null, finished: false }),
  },
})

const emit = defineEmits([
  'pin-change',
  'dock-change',
  'send',
  'close',
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
])

/* ── 浮窗 / 贴边 通用状态 ── */
const {
  resizeHandles: RESIZE_HANDLES,
  borderRadius: WINDOW_RADIUS,
  shadow: WINDOW_SHADOW,
} = AI_CHAT_WINDOW

const windowSize = useWindowSize()
const { isOffline, networkRequiredTooltip } = useOnlineStatus()
const chatState = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)
const chatLayout = computed(() => windowSize.chatWindowLayout.value)
const themeStore = useThemeStore()

const isPinned = computed(() => props.pinned)
const isDocked = computed(() => props.docked)
const isDark = computed(() => themeStore.isDark)

const { posX, posY, windowW, windowH } = chatState

const chatPanelRef = ref(null)

/* ── 浮窗特有逻辑：响应式布局约束 ── */
function applyResponsiveChatBounds() {
  const layout = chatLayout.value
  chatState.updateConstraints({
    minW: layout.minW,
    minH: layout.minH,
    w: Math.min(Math.max(windowW.value, layout.minW), windowSize.width.value),
    h: Math.min(Math.max(windowH.value, layout.minH), windowSize.height.value),
  })
}

function handleDragEnd() {
  chatState.clampToParent({ snap: true })
}

function handleResizeEnd() {
  chatState.clampToParent({ snap: true })
  scrollToBottom()
}

watch(
  () => [
    windowSize.width.value,
    windowSize.height.value,
    chatLayout.value.defaultW,
    chatLayout.value.defaultH,
    chatLayout.value.minW,
    chatLayout.value.minH,
    windowSize.chatWindowMinTop.value,
  ],
  () => {
    applyResponsiveChatBounds()
  },
)

/* ── 浮窗特有逻辑：focus trap ── */
const { activate: activateFocusTrap, deactivate: deactivateFocusTrap } =
  useFocusTrap(chatPanelRef, {
    immediate: false,
    escapeDeactivates: false,
    allowOutsideClick: true,
    fallbackFocus: chatPanelRef,
  })

const popAnimationStyle = computed(() => {
  const bounds = {
    width: windowSize.width.value,
    height: windowSize.height.value,
  }
  const avatar = { ...AI_AVATAR, size: windowSize.avatarSize.value }
  const avatarCenterX = bounds.width - avatar.marginRight - avatar.size / 2
  const avatarCenterY = bounds.height - avatar.marginBottom - avatar.size / 2
  const winRight = posX.value + windowW.value
  const winBottom = posY.value + windowH.value

  return {
    '--pop-translate-x': `${avatarCenterX - winRight}px`,
    '--pop-translate-y': `${avatarCenterY - winBottom}px`,
  }
})

/* ── 浮窗特有逻辑：消息列表滚动 ── */
function scrollToBottom() {
  nextTick(() => {
    const root = chatPanelRef.value
    if (!root) return
    const list = root.querySelector?.('.ai-chat-panel__messages')
    if (list && typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
    }
  })
}

function syncFocusTrap(active) {
  if (!active || props.pinned) {
    deactivateFocusTrap()
    return
  }

  nextTick(() => {
    activateFocusTrap()
    // 让 AiChatPanelContent 接管输入框聚焦
    const root = chatPanelRef.value
    const ta = root?.querySelector?.('.ai-chat-panel__input')
    if (ta) ta.focus()
  })
}

watch(
  () => props.visible,
  (visible) => {
    syncFocusTrap(visible)
    if (visible) {
      scrollToBottom()
    }
  },
)

watch(
  () => props.pinned,
  () => {
    syncFocusTrap(props.visible)
  },
)

watch(
  () => windowH.value,
  () => scrollToBottom(),
)

watch(
  () => props.messages.length,
  () => scrollToBottom(),
)

watch(
  () => props.messages.map((m) => m.content).join('\n'),
  () => scrollToBottom(),
)

onMounted(() => {
  applyResponsiveChatBounds()
  if (props.visible && !props.docked) {
    syncFocusTrap(true)
  }
})

onBeforeUnmount(() => {
  deactivateFocusTrap()
})

function handleHostMouseDown(event) {
  // 仅在 floating 模式下，host 的 mousedown 才触发 focus（避免 docked 模式下点击空白也触发）
  if (props.docked) return
  // 阻止点击 host 空白区域触发 focus trap 失焦
  if (event.target === event.currentTarget) {
    emit('focus')
  }
}
</script>

<template>
  <Transition :name="docked ? 'ai-chat-window-dock' : 'ai-chat-window-pop'">
    <div
      v-if="visible"
      class="ai-chat-window-host"
      :class="{
        'ai-chat-window-host--dark': isDark,
        'floating-host': !docked,
        'ai-chat-window-host--docked': docked,
        'ai-chat-window-host--floating': !docked,
      }"
      :style="docked
        ? (zIndex != null ? { zIndex } : {})
        : {
            ...(zIndex != null ? { zIndex } : {}),
            ...popAnimationStyle,
          }"
      @mousedown="handleHostMouseDown"
    >
      <!--
        浮窗模式 (floating)：
          - 使用 vue3-draggable-resizable 包装，支持拖拽、resize、贴边。
        贴边模式 (docked)：
          - 直接 inline 渲染，无浮窗动画、无 draggable wrapper。
        两种模式共享同一份 AiChatPanelContent 内部 UI（header / messages / footer）。
      -->
      <DraggableContainer
        v-if="!docked"
        :reference-line-visible="false"
        class="ai-chat-window-container"
      >
        <Vue3DraggableResizable
          v-if="!docked"
          :init-w="windowW"
          :init-h="windowH"
          v-model:x="posX"
          v-model:y="posY"
          v-model:w="windowW"
          v-model:h="windowH"
          :min-w="chatLayout.minW"
          :min-h="chatLayout.minH"
          :draggable="!isPinned"
          :resizable="true"
          :parent="true"
          :handles="RESIZE_HANDLES"
          class-name-handle="ai-chat-window-handle"
          @drag-end="handleDragEnd"
          @resize-end="handleResizeEnd"
        >
          <div
            ref="chatPanelRef"
            class="ai-chat-window"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-window-title"
            :style="{ '--fw-radius': `${WINDOW_RADIUS}px`, '--fw-shadow': WINDOW_SHADOW }"
          >
            <AiChatPanelContent
              :messages="messages"
              :model-name="modelName"
              :selection-context="selectionContext"
              :local-command-placeholders="localCommandPlaceholders"
              :cleanable-count="cleanableCount"
              :batch-progress="batchProgress"
              :is-dark="isDark"
              :is-pinned="isPinned"
              :is-docked="isDocked"
              :auto-focus-input="false"
              @send="(payload) => emit('send', payload)"
              @close="emit('close')"
              @pin-change="(val) => emit('pin-change', val)"
              @dock-change="(val) => emit('dock-change', val)"
              @focus="emit('focus')"
              @input-focus="emit('input-focus')"
              @input-blur="emit('input-blur')"
              @onboarding-complete="emit('onboarding-complete')"
              @regenerate="(payload) => emit('regenerate', payload)"
              @insert-slide-deck="(payload) => emit('insert-slide-deck', payload)"
              @local-command-select="(payload) => emit('local-command-select', payload)"
              @local-command-dismiss="(payload) => emit('local-command-dismiss', payload)"
              @batch-clean="emit('batch-clean')"
              @batch-clean-abort="emit('batch-clean-abort')"
              @batch-clean-undo="emit('batch-clean-undo')"
            />
          </div>
        </Vue3DraggableResizable>
      </DraggableContainer>

      <!-- 贴边模式：直接渲染，无浮窗包装 -->
      <div
        v-else
        ref="chatPanelRef"
        class="ai-chat-window ai-chat-window--docked"
        role="region"
        aria-label="AI 助手对话面板"
      >
        <AiChatPanelContent
          :messages="messages"
          :model-name="modelName"
          :selection-context="selectionContext"
          :local-command-placeholders="localCommandPlaceholders"
          :cleanable-count="cleanableCount"
          :batch-progress="batchProgress"
          :is-dark="isDark"
          :is-pinned="isPinned"
          :is-docked="isDocked"
          :auto-focus-input="true"
          @send="(payload) => emit('send', payload)"
          @close="emit('close')"
          @pin-change="(val) => emit('pin-change', val)"
          @dock-change="(val) => emit('dock-change', val)"
          @focus="emit('focus')"
          @input-focus="emit('input-focus')"
          @input-blur="emit('input-blur')"
          @onboarding-complete="emit('onboarding-complete')"
          @regenerate="(payload) => emit('regenerate', payload)"
          @insert-slide-deck="(payload) => emit('insert-slide-deck', payload)"
          @local-command-select="(payload) => emit('local-command-select', payload)"
          @local-command-dismiss="(payload) => emit('local-command-dismiss', payload)"
          @batch-clean="emit('batch-clean')"
          @batch-clean-abort="emit('batch-clean-abort')"
          @batch-clean-undo="emit('batch-clean-undo')"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 默认基类：作为内容提供方，位置由外层决定（docked 时为 inline） */
.ai-chat-window-host {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

/* ── 浮窗模式：host 覆盖视口，供 DraggableContainer 作为 parentLimitation ── */
.ai-chat-window-host--floating {
  position: fixed;
  inset: 0;
  z-index: var(--z-ai-chat);
  pointer-events: none;
  width: auto;
  height: auto;
}

.ai-chat-window-container {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* vdr-container/vdr-handle 公共基类见 src/styles/floating-window.css */

.ai-chat-window-host--floating :deep(.vdr-container) {
  pointer-events: auto;
  border: 1px solid #ddd;
  box-shadow: var(--fw-shadow, 0 12px 40px rgba(15, 23, 42, 0.18));
  border-radius: var(--fw-radius, 16px);
  background: var(--theme-bg, #fff);
}

.ai-chat-window-host--floating.ai-chat-window-host--dark :deep(.vdr-container) {
  border-color: #333;
}

.ai-chat-window {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #1a1a1a);
}

/* ── 贴边模式（docked）：inline panel，由父容器决定尺寸 ── */
.ai-chat-window-host--docked {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

.ai-chat-window--docked {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #1a1a1a);
  border-left: 1px solid var(--theme-border, #e2e8f0);
  box-shadow: none;
}

/* 贴边模式的过渡 */
.ai-chat-window-dock-enter-active,
.ai-chat-window-dock-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.ai-chat-window-dock-enter-from {
  opacity: 0;
  transform: translateX(8px);
}

.ai-chat-window-dock-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>