<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Vue3DraggableResizable from 'vue3-draggable-resizable'
import { DraggableContainer } from 'vue3-draggable-resizable'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import AiMarkdownContent from '@/components/ai/AiMarkdownContent.vue'
import LocalCommandMessage from '@/components/ai/LocalCommandMessage.vue'
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
import { useToast } from '@/composables/useToast'
import { fetchKnowledgeList, fetchKnowledgePreview } from '@/utils/knowledgeApi'
import { usePPTWorkflow, PPT_STEP } from '@/composables/usePPTWorkflow'
import {
  downloadSlidesAsHtml,
  downloadSlidesAsPptx,
  downloadSlidesAsPdf,
} from '@/utils/slideExport'

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
  'insert-slide-deck',
  'local-command-select',
  'local-command-dismiss',
])

/**
 * 本地指令交互：用户选择某项（如模板、对齐模式）
 * @param {object} message 当前 message 实体
 * @param {{ kind: string, [k: string]: any }} payload
 */
function onLocalCommandSelect(message, payload) {
  if (!message || !payload) return
  emit('local-command-select', {
    commandId: message.commandId,
    payload,
  })
}

/**
 * 本地指令交互：用户主动关闭（如点击 ×）
 * @param {object} message 当前 message 实体
 */
function onLocalCommandDismiss(message) {
  if (!message) return
  emit('local-command-dismiss', {
    commandId: message.commandId,
  })
}

const router = useRouter()
// V1 完全免费模式：AI 助手不提供注册/登录入口，不再需要 login/register。
// 保留 useAuth 解构仅为兼容模板中可能被调用的 isLoggingIn 状态。
const { isLoggingIn } = useAuth()

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

/* ── 本地指令示例轮转 ── */
// 轮换 index：每 30 秒换一条示例，避免输入提示过于单一
const placeholderIndex = ref(0)
let placeholderTimer = null

function startPlaceholderRotation() {
  if (placeholderTimer) return
  if (!Array.isArray(props.localCommandPlaceholders) || props.localCommandPlaceholders.length <= 1) {
    return
  }
  placeholderTimer = setInterval(() => {
    const len = props.localCommandPlaceholders.length
    if (len > 0) {
      placeholderIndex.value = (placeholderIndex.value + 1) % len
    }
  }, 30000)
}

function stopPlaceholderRotation() {
  if (placeholderTimer) {
    clearInterval(placeholderTimer)
    placeholderTimer = null
  }
}

// 当占位符数组本身变化（如从空变为非空）时重启轮转
watch(
  () => props.localCommandPlaceholders,
  (next) => {
    stopPlaceholderRotation()
    placeholderIndex.value = 0
    if (Array.isArray(next) && next.length > 1) {
      startPlaceholderRotation()
    }
  },
  { immediate: true },
)

onMounted(() => {
  startPlaceholderRotation()
})
onBeforeUnmount(() => {
  stopPlaceholderRotation()
})

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

/* ── PPT 意图识别：决定是否启动 usePPTWorkflow ── */
// 匹配“生成 PPT”、“帮我做一份演示”、“写个幻灯片”、“帮我做一个 presentation”等表达。
// 中间的 (.*) 抓取主题，使用 lazy 限定以避免吞下后续句子。
const PPT_TRIGGER_PREFIX =
  '(?:帮我|帮我弄|请|麻烦|能|可以|能不能|想|要)?\\s*(?:生成|做|写|弄|画|设计|出|创建)'
const PPT_TYPE_WORDS =
  '(?:PPT|ppt|幻灯片|演示稿|演示文稿|演讲稿|讲稿|片子|slides?|deck|presentation)'
const PPT_INTENT_REGEX = new RegExp(
  `(?:${PPT_TRIGGER_PREFIX})\\s*(?:一份|一个|下|个|篇|a|an)?\\s*([\\s\\S]*?)\\s*(?:${PPT_TYPE_WORDS})`,
  'i',
)
// 仅在用户明确提到英文关键词 "presentation" 时（无中文动词）才走独立命中分支，
// 避免 "write a slides" 这类普通英文短句被误识别为 PPT 生成意图。
const PPT_PRESENTATION_ONLY_REGEX = new RegExp(
  `\\b(presentation)\\b`,
  'i',
)

function extractPptIntent(message) {
  if (!message || typeof message !== 'string') return { matched: false, topic: '' }
  const match = message.match(PPT_INTENT_REGEX)
  if (match) {
    const raw = (match[1] || '').trim()
    // 清洗残留标点与残留量词
    const topic = raw
      .replace(/^(?:一份|一个|下|个|篇|a|an)\s*/, '')
      .replace(/^(?:about|on|regarding|of|for)\s+/i, '')
      .replace(/^[\s，,。:：！!？?]+/, '')
      .replace(/[\s，,。:：！!？?]+$/, '')
      .trim()
    return { matched: true, topic: topic || message.trim() }
  }
  // 后备：只要消息里出现 "presentation" 关键词（用户明确列出的英文关键词），也视为 PPT 意图
  if (PPT_PRESENTATION_ONLY_REGEX.test(message)) {
    return { matched: true, topic: message.trim() }
  }
  return { matched: false, topic: '' }
}

defineExpose({
  workflow: () => usePPTWorkflow(),
  pptSteps: PPT_STEP,
})

function handleSend() {
  // 注意：本地指令需要离线可用，因此不再在发送入口拦截 isOffline。
  // isOffline 时的处理交给父组件（AiAssistantPlaceholder.handleSend）判断：
  //   - 命中本地指令 → 直接执行（不需要网络）
  //   - 未命中本地指令 → 调用 AI 时会失败，由 useAiChat 内部处理
  if (mentionOpen.value) return

  const message = inputValue.value.trim()
  const hasReferences = referencedItems.value.length > 0
  if (!message && !hasReferences) return

  // ── PPT 工作流钩入：检测用户是否表达了“生成 PPT”意图 ──
  const pptWorkflow = usePPTWorkflow()
  const pptIntent = extractPptIntent(message)
  if (pptIntent.topic) {
    pptWorkflow.startWorkflow(pptIntent.topic)
  }

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

function handleQuotaRecharge() {
  // V1.1 完全免费模式：不再提供平台 Token 充值。
  // 跳转到“设置 → 我的模型”，提示用户自行接入大模型。
  void router.push({ name: 'settings-models' })
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

/* ───────── PPT 工作流面板（按步骤展示不同 UI） ───────── */
const toast = useToast()
const pptWorkflow = usePPTWorkflow()

// 是否处于活动工作流（topic 非空视为已启动）
const wfIsActive = computed(() => Boolean(pptWorkflow.state.topic))
const wfTopic = computed(() => pptWorkflow.state.topic || '')
const wfStep = computed(() => pptWorkflow.currentStep.value)
const wfStepIndex = computed(() => pptWorkflow.stepIndex.value)
const wfProgress = computed(() => pptWorkflow.progress.value)
const wfOutline = computed(() => pptWorkflow.state.outline || '')
const wfSlidesCount = computed(() => (Array.isArray(pptWorkflow.state.slides) ? pptWorkflow.state.slides.length : 0))
const wfHasSlides = computed(() => pptWorkflow.hasSlides.value)
const wfLastMessage = computed(() => pptWorkflow.state.lastMessage || '')
const wfLastError = computed(() => pptWorkflow.state.lastError || '')

// 步骤定义，供模板渲染进度条
const WF_STEP_DEFS = [
  { key: PPT_STEP.OUTLINE, label: '生成大纲' },
  { key: PPT_STEP.TEMPLATE, label: '选择模板' },
  { key: PPT_STEP.GENERATE, label: '生成幻灯片' },
  { key: PPT_STEP.EDITING, label: '编辑中' },
]

// 模板选项（与 slides store SLIDE_TEMPLATES 对齐）
const TEMPLATE_OPTIONS = [
  { id: 'business', label: '商务简约风', desc: '白底蓝调，适合正式场合', theme: 'light' },
  { id: 'tech', label: '科技感风', desc: '深色背景，发光元素，适合发布会', theme: 'dark' },
  { id: 'fresh', label: '清新自然风', desc: '浅绿配色，适合教育/公益', theme: 'light' },
  { id: 'custom', label: '自定义', desc: '请描述你想要的风格', theme: 'light' },
]

const customTemplateDesc = ref('')
const outlineEdit = ref('')

/**
 * 进入 STEP_EDITING 时，自动把生成的 slides 派发给编辑器插入。
 * 仅在 GENERATE → EDITING 这一跳时触发；后续若被业务流反复来回，
 * 仍会触发（设计上视为一次新工作流结果），如果不要重复插入可在 AiAssistantPlaceholder 侧去重。
 */
function emitSlideDeckInsert() {
  if (!wfHasSlides.value) return
  const slides = pptWorkflow.state.slides || []
  const theme = wfTheme.value
  const title = deriveWorkflowTitle()
  emit('insert-slide-deck', { slides, theme, title })
}

const wfTheme = computed(() => {
  // 模板可携带 theme（business/fresh→light, tech→dark），优先用 workflow 状态
  const tplId = pptWorkflow.state.templateId
  if (tplId === 'tech') return 'dark'
  return 'light'
})

function deriveWorkflowTitle() {
  const outline = pptWorkflow.state.outline || ''
  if (outline) {
    const firstHeading = outline.split(/\r?\n/).find((line) => /^#\s+/.test(line))
    if (firstHeading) return firstHeading.replace(/^#\s+/, '').trim()
  }
  return pptWorkflow.state.topic || 'WPX 演示文稿'
}

// 同步：每进入 STEP_EDITING 都触发自动插入
pptWorkflow.onStepChange((next, prev) => {
  if (next === PPT_STEP.EDITING && prev !== PPT_STEP.EDITING) {
    // 等 nextTick 让状态完全落定
    nextTick(() => emitSlideDeckInsert())
  }
})

function handleConfirmOutline() {
  const draft = outlineEdit.value.trim() || wfOutline.value
  const topic = pptWorkflow.state.topic || ''
  const fallback = `# ${topic}\n- 要点一\n- 要点二\n- 要点三`
  const ok = pptWorkflow.confirmOutline(draft || fallback)
  if (ok) {
    toast.success('大纲已确认')
  } else {
    toast.error('确认大纲失败：' + (pptWorkflow.state.lastError || ''))
  }
}

function handleModifyOutline() {
  const topic = pptWorkflow.state.topic || ''
  emit('send', {
    text: `请帮我修改大纲：${wfOutline.value || '（暂无）'}\n（主题：${topic}）`,
    references: [],
  })
}

function handleSelectTemplate(tplId) {
  if (tplId === 'custom' && !customTemplateDesc.value.trim()) {
    toast.warning('请先描述自定义模板风格')
    return
  }
  const ok = pptWorkflow.selectTemplate(tplId, tplId === 'custom' ? customTemplateDesc.value : '')
  if (ok) {
    toast.success('模板已选择')
    customTemplateDesc.value = ''
  } else {
    toast.error('选择模板失败：' + (pptWorkflow.state.lastError || ''))
  }
}

function handleExportHtml() {
  if (!wfHasSlides.value) {
    toast.warning('当前没有可导出的幻灯片')
    return
  }
  try {
    const result = downloadSlidesAsHtml(pptWorkflow.state.slides, {
      theme: wfTheme.value,
      title: deriveWorkflowTitle(),
    })
    if (result?.ok) {
      toast.success(`已导出网页：${result.filename}`)
    }
  } catch (e) {
    console.error('[AiChatWindow] 导出网页失败：', e)
    toast.error('导出网页失败：' + (e?.message || String(e)))
  }
}

async function handleExportPptx() {
  if (!wfHasSlides.value) {
    toast.warning('当前没有可导出的幻灯片')
    return
  }
  try {
    const result = await downloadSlidesAsPptx(pptWorkflow.state.slides, {
      theme: wfTheme.value,
      title: deriveWorkflowTitle(),
    })
    if (result?.ok) {
      toast.success(`已导出 PPTX：${result.filename}`)
    }
  } catch (e) {
    console.error('[AiChatWindow] 导出 PPTX 失败：', e)
    toast.error('导出 PPTX 失败：' + (e?.message || String(e)))
  }
}

function handleExportPdf() {
  if (!wfHasSlides.value) {
    toast.warning('当前没有可导出的幻灯片')
    return
  }
  try {
    const result = downloadSlidesAsPdf(pptWorkflow.state.slides, {
      theme: wfTheme.value,
      title: deriveWorkflowTitle(),
    })
    if (result?.ok) {
      if (result.method === 'browser-print') {
        toast.success(`已弹出打印对话框，请选择"另存为 PDF"：${result.filename}`)
      } else {
        toast.success(`已生成可打印 HTML：${result.filename}`)
      }
    } else {
      toast.error('导出 PDF 失败：' + (result?.error || '未知错误'))
    }
  } catch (e) {
    console.error('[AiChatWindow] 导出 PDF 失败：', e)
    toast.error('导出 PDF 失败：' + (e?.message || String(e)))
  }
}

function handleContinueEdit() {
  pptWorkflow.resetWorkflow()
  toast.info('已重置工作流，可继续修改')
}

// 当大纲进入 workflow state 时，把内容同步到本地编辑框（避免覆盖用户已输入内容）
watch(
  () => pptWorkflow.state.outline,
  (next) => {
    if (next && !outlineEdit.value) {
      outlineEdit.value = next
    }
  },
  { immediate: true },
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
                <!-- V1 完全免费模式：移除「注册/登录」账户引导分支（onboardingKind === 'account'） -->
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
                  <!-- V1 完全免费模式：不再提供访客「注册 / 登录」跳转按钮 -->
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
                    去配置大模型
                  </button>
                </div>
                <!-- 本地指令结果：在用户消息之后、Skill/AI 之前优先展示 -->
                <LocalCommandMessage
                  v-else-if="message.role === 'local'"
                  :success="message.localCommandSuccess !== false"
                  :message="message.content"
                  :command-id="message.commandId"
                  :category="message.category"
                  :icon="message.icon"
                  :mode="message.localCommandMode || 'status'"
                  :templates="message.localCommandTemplates"
                  :show-keep-original="Boolean(message.localCommandShowKeepOriginal)"
                  :preview-text="message.localCommandPreview"
                  :payload="message.localCommandPayload || {}"
                  @select="onLocalCommandSelect(message, $event)"
                  @dismiss="onLocalCommandDismiss(message)"
                  @preference-confirm="onLocalCommandSelect(message, { kind: 'preference-confirm', ...$event })"
                  @preference-skip="onLocalCommandSelect(message, { kind: 'preference-skip', ...$event })"
                />
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

          <!-- ── PPT 工作流面板：按 step 展示不同 UI ── -->
          <section
            v-if="wfIsActive"
            class="ai-chat-window__workflow"
            data-testid="ai-chat-workflow-panel"
            :data-step="wfStep"
            @mousedown.stop
          >
            <header class="ai-chat-window__workflow-header">
              <span class="ai-chat-window__workflow-title">PPT 工作流</span>
              <span class="ai-chat-window__workflow-progress">
                第 {{ wfStepIndex + 1 }} 步 / 共 4 步
              </span>
              <button
                type="button"
                class="ai-chat-window__workflow-close"
                title="重置并关闭工作流面板"
                aria-label="重置工作流"
                @click="handleContinueEdit"
              >
                ↺
              </button>
            </header>

            <!-- 步骤进度 -->
            <ol class="ai-chat-window__workflow-steps">
              <li
                v-for="(stepDef, idx) in WF_STEP_DEFS"
                :key="stepDef.key"
                class="ai-chat-window__workflow-step"
                :class="{
                  'is-active': stepDef.key === wfStep,
                  'is-done': wfStepIndex > idx,
                }"
              >
                <span class="ai-chat-window__workflow-step-dot" />
                <span class="ai-chat-window__workflow-step-label">{{ stepDef.label }}</span>
              </li>
            </ol>

            <p v-if="wfLastMessage" class="ai-chat-window__workflow-message">
              {{ wfLastMessage }}
            </p>
            <p v-if="wfLastError" class="ai-chat-window__workflow-error" role="alert">
              {{ wfLastError }}
            </p>

            <!-- STEP_OUTLINE：展示大纲，底部“确认/修改”按钮 -->
            <div
              v-if="wfStep === PPT_STEP.OUTLINE"
              class="ai-chat-window__workflow-body"
            >
              <p class="ai-chat-window__workflow-topic">
                <span class="ai-chat-window__workflow-topic-label">主题：</span>
                <strong>{{ wfTopic }}</strong>
              </p>
              <textarea
                v-model="outlineEdit"
                class="ai-chat-window__workflow-outline"
                rows="6"
                placeholder="AI 生成大纲后将自动填入此处；你也可以手动编辑，或直接点击“确认大纲”使用主题作为骨架。"
              />
              <div class="ai-chat-window__workflow-actions">
                <button
                  type="button"
                  class="ai-chat-window__workflow-btn ai-chat-window__workflow-btn--primary wpx-btn"
                  @click="handleConfirmOutline"
                >
                  确认大纲
                </button>
                <button
                  type="button"
                  class="ai-chat-window__workflow-btn wpx-btn"
                  @click="handleModifyOutline"
                >
                  修改大纲
                </button>
              </div>
            </div>

            <!-- STEP_TEMPLATE：展示模板卡片选择器 -->
            <div
              v-else-if="wfStep === PPT_STEP.TEMPLATE"
              class="ai-chat-window__workflow-body"
            >
              <p class="ai-chat-window__workflow-topic">
                请选择演示文稿模板：
              </p>
              <div class="ai-chat-window__template-grid">
                <button
                  v-for="tpl in TEMPLATE_OPTIONS"
                  :key="tpl.id"
                  type="button"
                  class="ai-chat-window__template-card"
                  :class="{ 'is-dark': tpl.theme === 'dark' }"
                  :data-theme="tpl.theme"
                  :title="tpl.desc"
                  @click="handleSelectTemplate(tpl.id)"
                >
                  <span class="ai-chat-window__template-card-label">{{ tpl.label }}</span>
                  <span class="ai-chat-window__template-card-desc">{{ tpl.desc }}</span>
                </button>
              </div>
              <textarea
                v-if="true"
                v-model="customTemplateDesc"
                class="ai-chat-window__custom-desc"
                rows="2"
                placeholder="选中「自定义」时，请先在此描述你想要的风格（如：莫兰迪配色，圆润字体，公众号风格）"
              />
            </div>

            <!-- STEP_GENERATE：展示进度条 -->
            <div
              v-else-if="wfStep === PPT_STEP.GENERATE"
              class="ai-chat-window__workflow-body"
            >
              <p class="ai-chat-window__workflow-topic">
                正在生成幻灯片…
              </p>
              <div
                class="ai-chat-window__progress"
                role="progressbar"
                :aria-valuenow="Math.round(wfProgress * 100)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="ai-chat-window__progress-fill"
                  :style="{ width: `${Math.round(wfProgress * 100)}%` }"
                />
              </div>
              <p class="ai-chat-window__progress-tip">
                AI 正在根据大纲与模板生成每张幻灯片内容，完成后将自动插入编辑器。
              </p>
            </div>

            <!-- STEP_EDITING：展示“导出网页/PPTX/继续修改”按钮 -->
            <div
              v-else-if="wfStep === PPT_STEP.EDITING"
              class="ai-chat-window__workflow-body"
            >
              <p class="ai-chat-window__workflow-topic">
                已生成
                <strong>{{ wfSlidesCount }}</strong>
                页幻灯片，并自动插入编辑器。
              </p>
              <div class="ai-chat-window__workflow-actions">
                <button
                  type="button"
                  class="ai-chat-window__workflow-btn wpx-btn"
                  @click="handleExportHtml"
                >
                  导出网页
                </button>
                <button
                  type="button"
                  class="ai-chat-window__workflow-btn wpx-btn"
                  @click="handleExportPptx"
                >
                  导出 PPTX
                </button>
                <button
                  type="button"
                  class="ai-chat-window__workflow-btn wpx-btn"
                  @click="handleExportPdf"
                >
                  导出 PDF
                </button>
                <button
                  type="button"
                  class="ai-chat-window__workflow-btn ai-chat-window__workflow-btn--primary wpx-btn"
                  @click="handleContinueEdit"
                >
                  继续修改
                </button>
              </div>
              <p class="ai-chat-window__progress-tip">
                插入后可在编辑器选中 SlideDeck 节点进行翻页、全屏、复制或删除；
                也可继续在下方对话要求 AI 添加 / 修改 / 删除某一页。
              </p>
            </div>
          </section>

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
                      ? `${localCommandPlaceholders[placeholderIndex] || '输入修改指令，Enter 发送（输入 @ 引用资料）'}`
                      : `${localCommandPlaceholders[placeholderIndex] || '输入消息，Enter 发送，Shift+Enter 换行，输入 @ 引用资料'}`
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
  /* pointer-events: auto 必须保留：祖先 .floating-host 通常为 none，否则点击穿透到底层编辑器会误触发关闭逻辑 */
  pointer-events: auto;
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

.ai-chat-window__message--local {
  /* 本地指令结果：无背景、左对齐、跟随内嵌 LocalCommandMessage 自身的样式 */
  align-self: flex-start;
  background: transparent;
  padding: 0;
  max-width: 100%;
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

/* ── PPT 工作流面板 ── */
.ai-chat-window__workflow {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent, #7c3aed) 6%, transparent), transparent 60%), var(--theme-bg, #ffffff);
}

.ai-chat-window-host--dark .ai-chat-window__workflow {
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent, #7c3aed) 12%, transparent), transparent 60%), var(--theme-bg, #1a1a1a);
}

.ai-chat-window__workflow-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-chat-window__workflow-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-accent, #7c3aed);
}

.ai-chat-window__workflow-progress {
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  font-variant-numeric: tabular-nums;
}

.ai-chat-window__workflow-close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--theme-fg-muted, #64748b);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
}
.ai-chat-window__workflow-close:hover {
  background: var(--theme-bg-muted, #e2e8f0);
  color: var(--theme-fg, #0f172a);
}

.ai-chat-window__workflow-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
}

.ai-chat-window__workflow-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.ai-chat-window__workflow-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--theme-border, #e2e8f0);
  flex-shrink: 0;
}

.ai-chat-window__workflow-step.is-done .ai-chat-window__workflow-step-dot {
  background: var(--theme-accent, #7c3aed);
}
.ai-chat-window__workflow-step.is-active .ai-chat-window__workflow-step-dot {
  background: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent, #7c3aed) 22%, transparent);
}
.ai-chat-window__workflow-step.is-active .ai-chat-window__workflow-step-label {
  color: var(--theme-fg, #0f172a);
  font-weight: 600;
}

.ai-chat-window__workflow-step-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-window__workflow-message {
  margin: 0;
  font-size: 11px;
  color: var(--theme-fg-muted, #475569);
  line-height: 1.5;
}

.ai-chat-window__workflow-error {
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 11px;
  line-height: 1.4;
}
.ai-chat-window-host--dark .ai-chat-window__workflow-error {
  background: rgba(239, 68, 68, 0.15);
  color: #fecaca;
}

.ai-chat-window__workflow-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-chat-window__workflow-topic {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg, #1a1a1a);
}

.ai-chat-window__workflow-topic-label {
  color: var(--theme-fg-muted, #64748b);
}

.ai-chat-window__workflow-outline,
.ai-chat-window__custom-desc {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  background: var(--theme-bg, #ffffff);
  color: var(--theme-fg, #1a1a1a);
  box-sizing: border-box;
}

.ai-chat-window-host--dark .ai-chat-window__workflow-outline,
.ai-chat-window-host--dark .ai-chat-window__custom-desc {
  background: #2a2a2a;
  border-color: #444;
}

.ai-chat-window__workflow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-chat-window__workflow-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: var(--theme-bg, #ffffff);
  color: var(--theme-fg, #1a1a1a);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.ai-chat-window__workflow-btn:hover {
  background: var(--theme-bg-muted, #f1f5f9);
  border-color: var(--theme-accent, #7c3aed);
  color: var(--theme-accent, #7c3aed);
}
.ai-chat-window__workflow-btn--primary {
  background: var(--theme-accent, #7c3aed);
  border-color: var(--theme-accent, #7c3aed);
  color: #ffffff;
}
.ai-chat-window__workflow-btn--primary:hover {
  background: color-mix(in srgb, var(--theme-accent, #7c3aed) 88%, #000 12%);
  border-color: transparent;
  color: #ffffff;
}

/* ── 模板卡片选择器 ── */
.ai-chat-window__template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ai-chat-window__template-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 10px;
  background: var(--theme-bg, #ffffff);
  color: var(--theme-fg, #1a1a1a);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
}
.ai-chat-window__template-card:hover {
  border-color: var(--theme-accent, #7c3aed);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #7c3aed) 20%, transparent);
  transform: translateY(-1px);
}
.ai-chat-window__template-card[data-theme="dark"] {
  background: #0f172a;
  color: #f1f5f9;
  border-color: #1e293b;
}
.ai-chat-window__template-card[data-theme="dark"]:hover {
  border-color: var(--theme-accent, #7c3aed);
}
.ai-chat-window__template-card-label {
  font-size: 12px;
  font-weight: 600;
}
.ai-chat-window__template-card-desc {
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  line-height: 1.45;
}
.ai-chat-window__template-card[data-theme="dark"] .ai-chat-window__template-card-desc {
  color: #94a3b8;
}

/* ── 进度条 ── */
.ai-chat-window__progress {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--theme-bg-muted, #e2e8f0);
  overflow: hidden;
}
.ai-chat-window__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--theme-accent, #7c3aed), #ec4899);
  border-radius: inherit;
  transition: width 0.3s ease;
}
.ai-chat-window__progress-tip {
  margin: 0;
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  line-height: 1.5;
}
</style>
