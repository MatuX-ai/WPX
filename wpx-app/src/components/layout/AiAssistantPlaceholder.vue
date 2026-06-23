<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useSkillsStore } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { useAuthStore } from '@/stores/auth'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'
import AiAvatar from '@/components/ai/AiAvatar.vue'
import AiChatWindow from '@/components/ai/AiChatWindow.vue'
import { getMessageText, useAiChat } from '@/composables/useAiChat'
import { useSkillExecutor } from '@/composables/useSkillExecutor'
import SkillInputForm from '@/components/skills/SkillInputForm.vue'
import { MISSING_CUSTOM_API } from '@/constants/aiModelMessages'
import { FREE_QUOTA_EXHAUSTED } from '@/utils/freeQuota'
import {
  buildSelectionPrompt,
  extractReplacementText,
} from '@/utils/aiSelection'
import { buildEditorAiSystemPrompt } from '@/utils/buildAiSystemPrompt'
import {
  AI_ASSISTANT_DEFAULT_WELCOME,
  createAiOnboardingMessages,
  markAiAssistantOnboardingDone,
  shouldShowAiAssistantOnboarding,
} from '@/constants/aiAssistantOnboarding'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const modelSettingsStore = useModelSettingsStore()
const skillsStore = useSkillsStore()
const userPreferencesStore = useUserPreferencesStore()
const authStore = useAuthStore()
const { isGuest } = storeToRefs(authStore)
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
  skillsStore.allSkills.filter((skill) => !skillsStore.isSkillEnabled(skill.id)),
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

function buildWelcomeMessages() {
  if (
    shouldShowAiAssistantOnboarding({
      hasCustomTextApiKey: modelSettingsStore.hasStoredTextApiKey,
    })
  ) {
    return createAiOnboardingMessages({
      isGuest: isGuest.value,
      createMessageId,
    })
  }

  return [
    {
      id: createMessageId(),
      role: 'assistant',
      content: AI_ASSISTANT_DEFAULT_WELCOME,
    },
  ]
}

const displayMessages = ref(buildWelcomeMessages())

const skillExecutor = useSkillExecutor()

const activeSkillInvocation = ref(null)

const onSkillExecuting = (info) => {
  // 仅当没有 pendingReplace（无选中文本）时设为光标插入
  if (!editorStore.pendingReplace) {
    const pos = editorStore.activeSelection.from ?? null
    if (pos != null) {
      editorStore.setPendingReplace({ from: pos, to: pos })
    }
  }
  activeSkillInvocation.value = { ...info }
}

const { chat, isLoading, sendMessage, pendingSkill, submitSkillForm, cancelSkillForm, selectSkillCandidate, retrySkill, lastSkillInvocation } = useAiChat(systemPrompt, {
  skillExecutor,
  skillsStore,
  onSkillExecuting,
})

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

function finishOnboarding() {
  markAiAssistantOnboardingDone()
  displayMessages.value = [
    {
      id: createMessageId(),
      role: 'assistant',
      content: AI_ASSISTANT_DEFAULT_WELCOME,
    },
  ]
}

function handleOnboardingComplete() {
  finishOnboarding()
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

  if (!result?.ok && result?.code === MISSING_CUSTOM_API) {
    editorStore.clearPendingReplace()
    displayMessages.value.push({
      id: createMessageId(),
      role: 'assistant',
      content: result.message,
      needsModelConfig: true,
      isGuest: result.isGuest,
    })
    return
  }

  if (!result?.ok && result?.code === FREE_QUOTA_EXHAUSTED) {
    editorStore.clearPendingReplace()
    displayMessages.value.push({
      id: createMessageId(),
      role: 'assistant',
      content: result.message,
      quotaExhausted: true,
      suggestConfigure: Boolean(result.suggestConfigure),
      isGuest: result.isGuest,
    })
  }
}

function handleSkillResponse() {
  const skillInfo = { ...activeSkillInvocation.value }
  activeSkillInvocation.value = null

  // 获取 AI 返回的最后一个 assistant 消息
  const assistantMessages = chat.messages.filter((m) => m.role === 'assistant')
  const lastAssistant = assistantMessages[assistantMessages.length - 1]

  // 检查是否已同步，避免重复
  const lastDisplay = displayMessages.value[displayMessages.value.length - 1]

  if (lastAssistant) {
    const rawContent = getMessageText(lastAssistant)
    const content = extractReplacementText(rawContent)

    if (lastDisplay?.role === 'assistant' && lastDisplay.content === rawContent && !lastDisplay.skillResult) return

    if (content) {
      // 成功：插入编辑器
      if (editorStore.pendingReplace) {
        editorStore.requestReplace(content, editorStore.pendingReplace)
        editorStore.clearPendingReplace()
      }

      displayMessages.value.push({
        id: createMessageId(),
        role: 'assistant',
        skillResult: true,
        skillSuccess: true,
        skillName: skillInfo.skillName,
        skillId: skillInfo.skillId,
        skillParams: skillInfo.params,
        content: rawContent,
      })
      return
    }
  }

  // 失败：无返回内容或出错
  displayMessages.value.push({
    id: createMessageId(),
    role: 'assistant',
    skillResult: true,
    skillSuccess: false,
    skillError: 'AI 生成失败，请检查网络连接后重试。',
    skillName: skillInfo.skillName,
    skillId: skillInfo.skillId,
    skillParams: skillInfo.params,
  })
}

function retrySkillCall({ skillId, params }) {
  const skillName = skillExecutor.findSkill(skillId)?.name || skillId

  displayMessages.value.push({
    id: createMessageId(),
    role: 'user',
    content: `🔄 重新生成【${skillName}】`,
  })

  // 设置插入位置
  const sel = editorStore.activeSelection
  const pos = sel.from ?? sel.to ?? null
  if (pos != null) {
    editorStore.setPendingReplace({ from: pos, to: pos })
  }

  // 追踪新调用
  activeSkillInvocation.value = { skillId, skillName, params, ts: Date.now() }

  retrySkill(skillId, params)
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

watch(isLoading, (loading, wasLoading) => {
  if (loading) return

  // isLoading 从 true → false：AI 响应结束或出错
  if (activeSkillInvocation.value) {
    handleSkillResponse()
  } else {
    syncLatestAssistantMessage()
  }
})

watch(
  () => [modelSettingsStore.hydrated, modelSettingsStore.hasStoredTextApiKey, isGuest.value],
  ([hydrated, hasKey]) => {
    if (!hydrated) return

    if (hasKey && displayMessages.value.some((message) => message.onboardingKind)) {
      finishOnboarding()
    }
  },
)
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
    @onboarding-complete="handleOnboardingComplete"
    @regenerate="retrySkillCall"
  />

  <AiAvatar
    :preset="settingsStore.avatarId"
    :avatar-url="settingsStore.avatarUrl"
    :loading="isLoading"
    @toggle="handleAvatarToggle"
  />

  <!-- Skill 参数收集表单（浮层） -->
  <SkillInputForm
    v-if="pendingSkill?.mode === 'form'"
    :skill-id="pendingSkill.skillId"
    overlay
    @submit="submitSkillForm"
    @cancel="cancelSkillForm"
  />

  <!-- Skill 候选选择（浮层） -->
  <div
    v-else-if="pendingSkill?.mode === 'candidates'"
    class="skill-candidate-backdrop"
    @mousedown.self="cancelSkillForm"
  >
    <div class="skill-candidate-dialog" role="dialog" aria-modal="true">
      <header class="skill-candidate-dialog__header">
        <h3 class="skill-candidate-dialog__title">找到多个匹配的 Skill，请选择：</h3>
        <button
          type="button"
          class="skill-candidate-dialog__close"
          aria-label="关闭"
          @click="cancelSkillForm"
        >
          ✕
        </button>
      </header>
      <div class="skill-candidate-dialog__body">
        <div
          v-for="candidate in pendingSkill.candidates"
          :key="candidate.skillId"
          class="skill-candidate-item"
          @click="selectSkillCandidate(candidate.skillId)"
        >
          <strong class="skill-candidate-item__name">{{ candidate.name }}</strong>
          <p class="skill-candidate-item__desc">{{ candidate.description }}</p>
        </div>
      </div>
      <footer class="skill-candidate-dialog__footer">
        <button type="button" class="wpx-btn skill-form__btn" @click="cancelSkillForm">
          取消
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* ── Skill 候选选择浮层 ── */
.skill-candidate-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 16px 16px;
  background: rgba(15, 23, 42, 0.35);
}

.skill-candidate-dialog {
  width: min(100%, 480px);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg);
  color: var(--theme-fg);
  box-shadow: var(--theme-shadow-lg);
}

.skill-candidate-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--theme-border);
}

.skill-candidate-dialog__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.skill-candidate-dialog__close {
  border: none;
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: pointer;
  font-size: 16px;
}

.skill-candidate-dialog__body {
  padding: 8px 14px;
}

.skill-candidate-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.skill-candidate-item:hover {
  background: var(--theme-bg-hover, rgba(128, 128, 128, 0.08));
}

.skill-candidate-item__name {
  font-size: 13px;
  font-weight: 600;
}

.skill-candidate-item__desc {
  margin: 0;
  font-size: 12px;
  color: var(--theme-fg-muted);
  line-height: 1.4;
}

.skill-candidate-dialog__footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid var(--theme-border);
}
</style>
