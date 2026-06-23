<script setup>
import { computed, ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useSkillsStore } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { BUILT_IN_SKILLS } from '@/data/skills'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'
import AiAvatar from '@/components/ai/AiAvatar.vue'
import AiChatWindow from '@/components/ai/AiChatWindow.vue'
import { getMessageText, useAiChat } from '@/composables/useAiChat'
import { FREE_QUOTA_EXHAUSTED } from '@/utils/freeQuota'
import {
  buildSelectionPrompt,
  extractReplacementText,
} from '@/utils/aiSelection'
import { buildEditorAiSystemPrompt } from '@/utils/buildAiSystemPrompt'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const modelSettingsStore = useModelSettingsStore()
const skillsStore = useSkillsStore()
const userPreferencesStore = useUserPreferencesStore()
const floatingWindows = useFloatingWindows()
const aiChat = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)

const aiChatWindowVisible = computed(() => aiChat.visible.value)
const aiChatWindowPinned = computed(() => aiChat.pinned.value)
const aiChatWindowZIndex = computed(() => aiChat.zIndex.value)

if (!skillsStore.hydrated) {
  skillsStore.initFromLocalStorage()
}

if (!userPreferencesStore.hydrated) {
  userPreferencesStore.initFromLocalStorage()
}

if (!modelSettingsStore.hydrated) {
  void modelSettingsStore.initFromLocalStorage()
}

const disabledSkills = computed(() =>
  BUILT_IN_SKILLS.filter((skill) => !skillsStore.isSkillEnabled(skill.id)),
)

const systemPrompt = computed(() =>
  buildEditorAiSystemPrompt({
    enabledSkills: skillsStore.enabledSkills,
    disabledSkills: disabledSkills.value,
    agentSettings: userPreferencesStore.agent,
  }),
)

let messageIdSeed = 0

function createMessageId() {
  messageIdSeed += 1
  return `msg-${messageIdSeed}-${Date.now()}`
}

const displayMessages = ref([
  {
    id: createMessageId(),
    role: 'assistant',
    content: '你好，我是 AI 写作助手。选中编辑器中的文字后，在这里输入修改指令即可自动替换选区。输入 @ 可引用资料库中的文档。',
  },
])

const { chat, isLoading, sendMessage } = useAiChat(systemPrompt)

const selectionPreview = computed(() => {
  if (!editorStore.chatInputActive) return ''
  return editorStore.activeSelection.hasSelection
    ? editorStore.activeSelection.text
    : ''
})

const modelName = computed(() => modelSettingsStore.effectiveTextConfig.displayName)

function handleInputFocus() {
  editorStore.setChatInputActive(true)
}

function handleInputBlur() {
  editorStore.setChatInputActive(false)
}

async function handleSend(payload) {
  const text = typeof payload === 'string' ? payload : payload.text
  const references = typeof payload === 'string' ? [] : payload.references || []
  const activeSelection = editorStore.activeSelection
  const context = references.map((item) => ({
    filename: item.filename,
    content: item.content,
  }))

  displayMessages.value.push({
    id: createMessageId(),
    role: 'user',
    content: text,
    references: references.map((item) => item.filename),
  })

  let result

  if (editorStore.chatInputActive && activeSelection.hasSelection) {
    editorStore.setPendingReplace({
      from: activeSelection.from,
      to: activeSelection.to,
    })
    result = await sendMessage({
      text: buildSelectionPrompt(text, activeSelection.text),
      context,
    })
  } else {
    editorStore.clearPendingReplace()
    result = await sendMessage({ text, context })
  }

  if (!result?.ok && result?.code === FREE_QUOTA_EXHAUSTED) {
    editorStore.clearPendingReplace()
    displayMessages.value.push({
      id: createMessageId(),
      role: 'assistant',
      content: result.message,
      quotaExhausted: true,
      isGuest: result.isGuest,
    })
  }
}

function handleClose() {
  aiChat.close()
  editorStore.setChatInputActive(false)
}

function handlePinChange() {
  aiChat.togglePin()
}

function handleAvatarToggle() {
  floatingWindows.toggleWindow(FLOATING_WINDOW_ID.AI_CHAT)
}

function handleChatFocus() {
  aiChat.focus()
}

function syncLatestAssistantMessage() {
  const assistantMessages = chat.messages.filter((message) => message.role === 'assistant')
  const lastAssistant = assistantMessages[assistantMessages.length - 1]
  if (!lastAssistant) return

  const content = extractReplacementText(getMessageText(lastAssistant))
  if (!content) return

  const lastDisplay = displayMessages.value[displayMessages.value.length - 1]
  if (lastDisplay?.role === 'assistant' && lastDisplay.content === content) return

  displayMessages.value.push({
    id: createMessageId(),
    role: 'assistant',
    content,
  })

  if (editorStore.pendingReplace) {
    editorStore.requestReplace(content, editorStore.pendingReplace)
  }
}

watch(isLoading, (loading) => {
  if (loading) return
  syncLatestAssistantMessage()
})
</script>

<template>
  <AiChatWindow
    :visible="aiChatWindowVisible"
    :pinned="aiChatWindowPinned"
    :z-index="aiChatWindowZIndex"
    :model-name="modelName"
    :messages="displayMessages"
    :selection-context="selectionPreview"
    @send="handleSend"
    @close="handleClose"
    @pin-change="handlePinChange"
    @focus="handleChatFocus"
    @input-focus="handleInputFocus"
    @input-blur="handleInputBlur"
  />

  <AiAvatar
    :preset="settingsStore.avatarId"
    :avatar-url="settingsStore.avatarUrl"
    :loading="isLoading"
    @toggle="handleAvatarToggle"
  />
</template>
