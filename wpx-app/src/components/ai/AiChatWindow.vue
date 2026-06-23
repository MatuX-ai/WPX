<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Vue3DraggableResizable from 'vue3-draggable-resizable'
import { DraggableContainer } from 'vue3-draggable-resizable'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import AiMarkdownContent from '@/components/ai/AiMarkdownContent.vue'
import { useAuth } from '@/composables/useAuth'
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
import { useEscapeKey } from '@/composables/useEscapeKey'
import { useThemeStore } from '@/stores/theme'
import { fetchKnowledgeList, fetchKnowledgePreview } from '@/utils/knowledgeApi'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  zIndex: {
    type: Number,
    default: undefined,
  },
  modelName: {
    type: String,
    default: 'DeepSeek-V3',
  },
  messages: {
    type: Array,
    default: () => [],
  },
  selectionContext: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'pin-change',
  'send',
  'close',
  'focus',
  'input-focus',
  'input-blur',
  'onboarding-complete',
  'regenerate',
])

const router = useRouter()
const { login, register, isLoggingIn } = useAuth()

const {
  resizeHandles: RESIZE_HANDLES,
  borderRadius: WINDOW_RADIUS,
  shadow: WINDOW_SHADOW,
} = AI_CHAT_WINDOW

const windowSize = useWindowSize()
const { isOffline, networkRequiredTooltip } = useOnlineStatus()
const chatState = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)

const chatLayout = computed(() => windowSize.chatWindowLayout.value)

const effectiveAvatarConfig = computed(() => ({
  ...AI_AVATAR,
  size: windowSize.avatarSize.value,
}))

const { posX, posY, windowW, windowH } = chatState

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

const typeLabels = {
  pdf: 'PDF',
  word: 'Word',
  markdown: 'Markdown',
  text: 'TXT',
  web: '网页',
}

const themeStore = useThemeStore()

const isPinned = computed(() => props.pinned)
const isDark = computed(() => themeStore.isDark)
const inputValue = ref('')
const messageListRef = ref(null)
const textareaRef = ref(null)
const chatPanelRef = ref(null)

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
  const avatar = effectiveAvatarConfig.value
  const avatarCenterX = bounds.width - avatar.marginRight - avatar.size / 2
  const avatarCenterY = bounds.height - avatar.marginBottom - avatar.size / 2
  const winRight = posX.value + windowW.value
  const winBottom = posY.value + windowH.value

  return {
    '--pop-translate-x': `${avatarCenterX - winRight}px`,
    '--pop-translate-y': `${avatarCenterY - winBottom}px`,
  }
})

const referencedItems = ref([])
const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionItems = ref([])
const mentionLoading = ref(false)
const mentionHighlightIndex = ref(0)
const knowledgeCache = ref([])

const filteredMentionItems = computed(() => {
  const query = mentionQuery.value.trim().toLowerCase()
  if (!query) return mentionItems.value
  return mentionItems.value.filter((item) =>
    item.filename.toLowerCase().includes(query),
  )
})

function typeLabel(type) {
  return typeLabels[type] || type || '未知'
}

function scrollToBottom() {
  nextTick(() => {
    const ref = messageListRef.value
    const el = ref?.$el ?? ref
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    })
  })
}

async function loadKnowledgeList() {
  mentionLoading.value = true
  try {
    const items = await fetchKnowledgeList()
    knowledgeCache.value = items
    mentionItems.value = items
  } catch {
    mentionItems.value = []
  } finally {
    mentionLoading.value = false
  }
}

function togglePin() {
  emit('pin-change', !props.pinned)
}

function handleClose() {
  emit('close')
}

function handleEscapeClose() {
  if (mentionOpen.value) {
    closeMentionPicker()
    removeMentionQueryFromInput()
    return
  }

  handleClose()
}

useEscapeKey(() => props.visible, handleEscapeClose)

function syncFocusTrap(active) {
  if (!active || props.pinned) {
    deactivateFocusTrap()
    return
  }

  nextTick(() => {
    activateFocusTrap()
    textareaRef.value?.focus()
  })
}

function removeReferencedItem(id) {
  referencedItems.value = referencedItems.value.filter((item) => item.id !== id)
}

function closeMentionPicker() {
  mentionOpen.value = false
  mentionQuery.value = ''
  mentionHighlightIndex.value = 0
}

function detectMention() {
  const el = textareaRef.value
  if (!el) return

  const cursor = el.selectionStart ?? inputValue.value.length
  const textBeforeCursor = inputValue.value.slice(0, cursor)
  const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)

  if (atMatch) {
    mentionOpen.value = true
    mentionQuery.value = atMatch[1]
    mentionHighlightIndex.value = 0
    if (!mentionItems.value.length && !mentionLoading.value) {
      loadKnowledgeList()
    }
    return
  }

  closeMentionPicker()
}

function handleInput() {
  detectMention()
}

async function selectMentionItem(item) {
  if (!item || referencedItems.value.some((ref) => ref.id === item.id)) {
    closeMentionPicker()
    removeMentionQueryFromInput()
    return
  }

  let content = ''
  try {
    const preview = await fetchKnowledgePreview(item.id)
    content = preview.content || ''
  } catch {
    content = ''
  }

  referencedItems.value.push({
    id: item.id,
    filename: item.filename,
    type: item.type,
    content,
  })

  removeMentionQueryFromInput()
  closeMentionPicker()
  textareaRef.value?.focus()
}

function removeMentionQueryFromInput() {
  const el = textareaRef.value
  if (!el) return

  const cursor = el.selectionStart ?? inputValue.value.length
  const textBeforeCursor = inputValue.value.slice(0, cursor)
  const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)

  if (!atMatch) return

  const start = cursor - atMatch[0].length
  inputValue.value = inputValue.value.slice(0, start) + inputValue.value.slice(cursor)

  nextTick(() => {
    el.selectionStart = start
    el.selectionEnd = start
  })
}

function handleSend() {
  if (isOffline.value || mentionOpen.value) return

  const message = inputValue.value.trim()
  const hasReferences = referencedItems.value.length > 0
  if (!message && !hasReferences) return

  emit('send', {
    text: message,
    references: referencedItems.value.map((item) => ({
      id: item.id,
      filename: item.filename,
      type: item.type,
      content: item.content,
    })),
  })

  inputValue.value = ''
  referencedItems.value = []
  closeMentionPicker()
}

function handleInputKeydown(event) {
  if (mentionOpen.value && filteredMentionItems.value.length) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      mentionHighlightIndex.value =
        (mentionHighlightIndex.value + 1) % filteredMentionItems.value.length
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const len = filteredMentionItems.value.length
      mentionHighlightIndex.value = (mentionHighlightIndex.value - 1 + len) % len
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const item = filteredMentionItems.value[mentionHighlightIndex.value]
      if (item) selectMentionItem(item)
      return
    }
  }

  if (event.key === '@') {
    nextTick(() => detectMention())
  }

  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  handleSend()
}

function handleInputFocus() {
  emit('input-focus')
}

function handleInputBlur() {
  window.setTimeout(() => {
    closeMentionPicker()
  }, 150)
  emit('input-blur')
}

async function handleQuotaLogin() {
  await login()
}

function handleQuotaRecharge() {
  void router.push({ name: 'token-recharge' })
}

function handleGoToModelSettings() {
  void router.push({ name: 'settings-models' })
}

function completeOnboarding() {
  emit('onboarding-complete')
}

async function handleOnboardingSetup() {
  completeOnboarding()
  handleGoToModelSettings()
}

async function handleOnboardingRegister() {
  completeOnboarding()
  try {
    await register()
  } catch (error) {
    console.warn('[AiChatWindow] register failed:', error)
  }
}

async function handleOnboardingLogin() {
  completeOnboarding()
  try {
    await login()
  } catch (error) {
    console.warn('[AiChatWindow] login failed:', error)
  }
}

watch(
  () => windowH.value,
  () => scrollToBottom(),
)

watch(
  () => props.messages.length,
  () => scrollToBottom(),
)

watch(
  () => props.messages.map((message) => message.content).join('\n'),
  () => scrollToBottom(),
)

watch(
  () => props.visible,
  (visible) => {
    syncFocusTrap(visible)
    if (visible) {
      scrollToBottom()
      loadKnowledgeList()
    }
  },
)

watch(
  () => props.pinned,
  () => {
    syncFocusTrap(props.visible)
  },
)
</script>

<template>
  <Transition name="ai-chat-window-pop">
    <div
      v-if="visible"
      class="ai-chat-window-host floating-host"
      :class="{ 'ai-chat-window-host--dark': isDark }"
      :style="{
        ...(zIndex != null ? { zIndex } : {}),
        ...popAnimationStyle,
      }"
      @mousedown="emit('focus')"
    >
      <DraggableContainer :reference-line-visible="false" class="ai-chat-window-container">
        <Vue3DraggableResizable
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
            <header
              class="ai-chat-window__header"
              :class="{ 'ai-chat-window__header--pinned': isPinned }"
            >
              <div class="ai-chat-window__title-wrap">
                <span id="ai-chat-window-title" class="ai-chat-window__title">AI 写作助手</span>
                <span v-if="modelName" class="ai-chat-window__subtitle">{{ modelName }}</span>
              </div>
              <div class="ai-chat-window__actions">
                <button
                  type="button"
                  class="ai-chat-window__action ai-chat-window__action--pin wpx-btn"
                  :class="{ 'ai-chat-window__action--active': isPinned }"
                  :title="isPinned ? '取消钉住' : '钉住'"
                  :aria-label="isPinned ? '取消钉住窗口' : '钉住窗口'"
                  @mousedown.stop
                  @click="togglePin"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    class="ai-chat-window__pin-icon"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 17v5"
                      :fill="isPinned ? 'currentColor' : 'none'"
                      :stroke="isPinned ? 'none' : 'currentColor'"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                    <path
                      d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 0 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.76a2 2 0 0 0-1.11 1.79L5 15.24Z"
                      :fill="isPinned ? 'currentColor' : 'none'"
                      :stroke="isPinned ? 'none' : 'currentColor'"
                      stroke-width="2"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="ai-chat-window__action ai-chat-window__action--close wpx-btn"
                  title="关闭"
                  aria-label="关闭对话窗"
                  @mousedown.stop
                  @click="handleClose"
                >
                  ✕
                </button>
              </div>
            </header>

            <div
              v-if="isOffline"
              class="ai-chat-window__offline-banner"
              role="status"
            >
              当前处于离线模式，AI功能不可用
            </div>

          <div class="ai-chat-window__messages-area">
            <TransitionGroup
              ref="messageListRef"
              name="ai-chat-message"
              tag="div"
              class="ai-chat-window__messages"
              @mousedown.stop
            >
              <div
                v-for="(message, index) in messages"
                :key="message.id ?? `msg-${index}`"
                class="ai-chat-window__message"
                :class="`ai-chat-window__message--${message.role || 'assistant'}`"
              >
                <div
                  v-if="message.references?.length"
                  class="ai-chat-window__message-refs"
                >
                  <span
                    v-for="refName in message.references"
                    :key="refName"
                    class="ai-chat-window__message-ref"
                  >
                    @{{ refName }}
                  </span>
                </div>
                <p
                  v-if="message.role === 'user'"
                  class="ai-chat-window__message-text"
                >
                  {{ message.content }}
                </p>
                <div
                  v-else-if="message.onboardingKind === 'setup'"
                  class="ai-chat-window__onboarding"
                >
                  <AiMarkdownContent
                    class="ai-chat-window__message-md ai-chat-window__message-md--onboarding"
                    :content="message.content"
                  />
                  <div class="ai-chat-window__onboarding-actions">
                    <button
                      type="button"
                      class="ai-chat-window__quota-action wpx-btn"
                      @click="handleOnboardingSetup"
                    >
                      好的
                    </button>
                  </div>
                </div>
                <div
                  v-else-if="message.onboardingKind === 'account'"
                  class="ai-chat-window__onboarding"
                >
                  <AiMarkdownContent
                    class="ai-chat-window__message-md ai-chat-window__message-md--onboarding"
                    :content="message.content"
                  />
                  <div class="ai-chat-window__onboarding-actions">
                    <button
                      type="button"
                      class="ai-chat-window__quota-action ai-chat-window__quota-action--secondary wpx-btn"
                      :disabled="isLoggingIn"
                      @click="handleOnboardingRegister"
                    >
                      {{ isLoggingIn ? '跳转中…' : '注册' }}
                    </button>
                    <button
                      type="button"
                      class="ai-chat-window__quota-action wpx-btn"
                      :disabled="isLoggingIn"
                      @click="handleOnboardingLogin"
                    >
                      {{ isLoggingIn ? '跳转中…' : '登录' }}
                    </button>
                  </div>
                </div>
                <div
                  v-else-if="message.needsModelConfig"
                  class="ai-chat-window__quota-exhausted"
                >
                  <p class="ai-chat-window__message-text">{{ message.content }}</p>
                  <button
                    type="button"
                    class="ai-chat-window__quota-action wpx-btn"
                    @click="handleGoToModelSettings"
                  >
                    去配置
                  </button>
                  <button
                    v-if="message.isGuest"
                    type="button"
                    class="ai-chat-window__quota-action ai-chat-window__quota-action--secondary wpx-btn"
                    :disabled="isLoggingIn"
                    @click="handleQuotaLogin"
                  >
                    {{ isLoggingIn ? '登录中…' : '注册 / 登录' }}
                  </button>
                </div>
                <div
                  v-else-if="message.quotaExhausted"
                  class="ai-chat-window__quota-exhausted"
                >
                  <p class="ai-chat-window__message-text">{{ message.content }}</p>
                  <button
                    v-if="message.suggestConfigure"
                    type="button"
                    class="ai-chat-window__quota-action wpx-btn"
                    @click="handleGoToModelSettings"
                  >
                    去配置
                  </button>
                  <button
                    v-else
                    type="button"
                    class="ai-chat-window__quota-action wpx-btn"
                    @click="handleQuotaRecharge"
                  >
                    充值
                  </button>
                </div>
                <!-- Skill 调用结果 -->
                <div v-else-if="message.skillResult" class="ai-chat-window__skill-result">
                  <div class="ai-chat-window__skill-result-header">
                    <span class="ai-chat-window__skill-result-icon">
                      {{ message.skillSuccess ? '✅' : '❌' }}
                    </span>
                    <span class="ai-chat-window__skill-result-label">
                      {{ message.skillSuccess ? 'Skill 执行完成' : 'Skill 执行失败' }}
                    </span>
                  </div>
                  <p v-if="message.skillSuccess" class="ai-chat-window__skill-result-text">
                    已使用【{{ message.skillName }}】生成内容，已插入编辑器
                  </p>
                  <p v-else class="ai-chat-window__skill-result-text ai-chat-window__skill-result-text--error">
                    {{ message.skillError }}
                  </p>
                  <div class="ai-chat-window__skill-result-actions">
                    <button
                      type="button"
                      class="ai-chat-window__skill-retry-btn wpx-btn"
                      :title="`重新调用 ${message.skillName}`"
                      @click="emit('regenerate', { skillId: message.skillId, params: message.skillParams })"
                    >
                      重新生成
                    </button>
                  </div>
                </div>

                <AiMarkdownContent
                  v-else
                  class="ai-chat-window__message-md"
                  :content="message.content"
                />
              </div>
            </TransitionGroup>

            <p v-if="messages.length === 0" class="ai-chat-window__empty">
              暂无消息，输入内容开始对话
            </p>
          </div>

          <footer class="ai-chat-window__footer" @mousedown.stop>
            <div v-if="selectionContext" class="ai-chat-window__context">
              <p class="ai-chat-window__context-label">选中文本将附加到消息</p>
              <p class="ai-chat-window__context-text">{{ selectionContext }}</p>
            </div>

            <div class="ai-chat-window__input-wrap">
              <div
                v-if="referencedItems.length"
                class="ai-chat-window__refs"
              >
                <span
                  v-for="item in referencedItems"
                  :key="item.id"
                  class="ai-chat-window__ref-tag"
                >
                  <span class="ai-chat-window__ref-tag-icon">@</span>
                  <span class="ai-chat-window__ref-tag-name" :title="item.filename">
                    {{ item.filename }}
                  </span>
                  <button
                    type="button"
                    class="ai-chat-window__ref-tag-remove"
                    aria-label="移除引用"
                    @mousedown.prevent
                    @click="removeReferencedItem(item.id)"
                  >
                    ×
                  </button>
                </span>
              </div>

              <div
                v-if="mentionOpen"
                class="ai-chat-window__mention-picker"
                @mousedown.prevent
              >
                <p class="ai-chat-window__mention-title">引用资料</p>
                <p v-if="mentionLoading" class="ai-chat-window__mention-empty">加载中…</p>
                <p v-else-if="!filteredMentionItems.length" class="ai-chat-window__mention-empty">
                  {{ mentionQuery ? '无匹配资料' : '暂无资料，请先在资料库上传' }}
                </p>
                <ul v-else class="ai-chat-window__mention-list">
                  <li
                    v-for="(item, index) in filteredMentionItems"
                    :key="item.id"
                  >
                    <button
                      type="button"
                      class="ai-chat-window__mention-item"
                      :class="{ 'ai-chat-window__mention-item--active': index === mentionHighlightIndex }"
                      @click="selectMentionItem(item)"
                    >
                      <span class="ai-chat-window__mention-type">{{ typeLabel(item.type) }}</span>
                      <span class="ai-chat-window__mention-name">{{ item.filename }}</span>
                    </button>
                  </li>
                </ul>
              </div>

              <textarea
                ref="textareaRef"
                v-model="inputValue"
                class="ai-chat-window__input wpx-input"
                rows="3"
                :disabled="isOffline"
                :title="isOffline ? networkRequiredTooltip : undefined"
                :placeholder="
                  isOffline
                    ? '离线模式下无法使用 AI 对话'
                    : selectionContext
                      ? '输入修改指令，Enter 发送（输入 @ 引用资料）'
                      : '输入消息，Enter 发送，Shift+Enter 换行，输入 @ 引用资料'
                "
                @focus="handleInputFocus"
                @blur="handleInputBlur"
                @input="handleInput"
                @keydown="handleInputKeydown"
              />
            </div>
          </footer>
        </div>
        </Vue3DraggableResizable>
      </DraggableContainer>
    </div>
  </Transition>
</template>

<style scoped>
.ai-chat-window-host {
  position: fixed;
  inset: 0;
  z-index: var(--z-ai-chat);
  pointer-events: none;
}

.ai-chat-window-container {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 弹出动效见 src/styles/transitions.css */

/* vdr-container/vdr-handle 公共基类见 src/styles/floating-window.css */

.ai-chat-window-host :deep(.vdr-container) {
  /* 浮窗自身特性：阴影 / 圆角 / 背景 / 边框 */
  border: 1px solid #ddd;
  box-shadow: var(--fw-shadow, 0 12px 40px rgba(15, 23, 42, 0.18));
  border-radius: var(--fw-radius, 16px);
  background: var(--theme-bg, #fff);
}

.ai-chat-window-host--dark :deep(.vdr-container) {
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

.ai-chat-window__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 10px 0 16px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg-subtle, #f8fafc);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.ai-chat-window__header--pinned {
  cursor: default;
}

.ai-chat-window__offline-banner {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  color: #991b1b;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
}

.ai-chat-window-host--dark .ai-chat-window__offline-banner {
  color: #fecaca;
  background: #450a0a;
  border-bottom-color: #7f1d1d;
}

.ai-chat-window__title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.ai-chat-window__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-window__subtitle {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-fg-muted, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-window__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ai-chat-window__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ai-chat-window__action:hover {
  background: var(--theme-bg-muted, #e2e8f0);
  color: var(--theme-fg, #0f172a);
}

.ai-chat-window__action--pin.ai-chat-window__action--active {
  color: #2563eb;
}

.ai-chat-window__action--close {
  font-size: 15px;
  font-weight: 500;
}

.ai-chat-window__pin-icon {
  width: 16px;
  height: 16px;
}

.ai-chat-window__messages-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-chat-window__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-chat-message-enter-active {
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.ai-chat-message-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.ai-chat-window__empty {
  margin: auto 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

.ai-chat-window__message {
  max-width: 88%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
}

.ai-chat-window__message--user {
  align-self: flex-end;
  background: #7c3aed;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.ai-chat-window__message--assistant {
  align-self: flex-start;
  background: #f1f5f9;
  color: #1a1a1a;
  border-bottom-left-radius: 4px;
}

.ai-chat-window-host--dark .ai-chat-window__message--assistant {
  background: #2d2d2d;
  color: #e0e0e0;
}

.ai-chat-window__message-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.ai-chat-window__message-ref {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  line-height: 1.4;
}

.ai-chat-window__message-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat-window__message-md {
  min-width: 0;
}

.ai-chat-window__quota-exhausted {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-chat-window__onboarding {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-chat-window__onboarding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-chat-window__message-md--onboarding :deep(p) {
  margin: 0 0 0.5em;
  line-height: 1.65;
  color: var(--theme-fg);
}

.ai-chat-window__message-md--onboarding :deep(p:last-child) {
  margin-bottom: 0;
}

.ai-chat-window__quota-action {
  align-self: flex-start;
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: #7c3aed;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ai-chat-window__quota-action:hover:not(:disabled) {
  background: #6d28d9;
}

.ai-chat-window__quota-action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.ai-chat-window__quota-action--secondary {
  background: transparent;
  border: 1px solid var(--theme-border);
  color: var(--theme-fg-muted);
}

.ai-chat-window__quota-action--secondary:hover:not(:disabled) {
  background: var(--theme-bg-subtle);
  color: var(--theme-fg);
}

.ai-chat-window__footer {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
}

.ai-chat-window__context {
  margin-bottom: 8px;
  border: 1px solid #ddd6fe;
  border-radius: 10px;
  background: #f5f3ff;
  padding: 8px 10px;
}

.ai-chat-window__context-label {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: #6d28d9;
}

.ai-chat-window__context-text {
  margin: 0;
  max-height: 48px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ai-chat-window__input-wrap {
  position: relative;
}

.ai-chat-window__refs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.ai-chat-window__ref-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px 6px 2px 8px;
  border-radius: 999px;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 12px;
  line-height: 1.4;
}

.ai-chat-window__ref-tag-icon {
  flex-shrink: 0;
  font-weight: 600;
}

.ai-chat-window__ref-tag-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.ai-chat-window__ref-tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #7c3aed;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.ai-chat-window__ref-tag-remove:hover {
  background: rgba(124, 58, 237, 0.15);
}

.ai-chat-window__mention-picker {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 5;
  max-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.ai-chat-window__mention-title {
  margin: 0;
  padding: 8px 10px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid #f1f5f9;
}

.ai-chat-window__mention-empty {
  margin: 0;
  padding: 12px 10px;
  font-size: 12px;
  color: #94a3b8;
}

.ai-chat-window__mention-list {
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
}

.ai-chat-window__mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.ai-chat-window__mention-item:hover,
.ai-chat-window__mention-item--active {
  background: #f5f3ff;
}

.ai-chat-window__mention-type {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 10px;
  font-weight: 600;
}

.ai-chat-window__mention-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #334155;
}

.ai-chat-window__input {
  width: 100%;
  resize: none;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
  box-sizing: border-box;
}

.ai-chat-window__input::placeholder {
  color: #94a3b8;
}

/* ── Skill 调用结果 ── */
.ai-chat-window__skill-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-chat-window__skill-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-chat-window__skill-result-icon {
  font-size: 16px;
  line-height: 1;
}

.ai-chat-window__skill-result-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-fg);
}

.ai-chat-window__skill-result-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg, #1a1a1a);
}

.ai-chat-window__skill-result-text--error {
  color: #dc2626;
}

.ai-chat-window__skill-result-actions {
  display: flex;
  gap: 8px;
}

.ai-chat-window__skill-retry-btn {
  padding: 4px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  background: var(--theme-bg);
  color: var(--theme-fg);
  cursor: pointer;
  transition: background 0.15s ease;
}

.ai-chat-window__skill-retry-btn:hover {
  background: var(--theme-bg-subtle);
}

.ai-chat-window-host--dark .ai-chat-window__skill-retry-btn {
  border-color: #444;
  background: #2a2a2a;
  color: #e0e0e0;
}

.ai-chat-window-host--dark .ai-chat-window__skill-retry-btn:hover {
  background: #333;
}
</style>
