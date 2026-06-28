<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AiMarkdownContent from '@/components/ai/AiMarkdownContent.vue'
import LocalCommandMessage from '@/components/ai/LocalCommandMessage.vue'
import { useAuth } from '@/composables/useAuth'
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
  messages: {
    type: Array,
    default: () => [],
  },
  modelName: {
    type: String,
    default: '未配置 · 请在「我的模型」中接入',
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
  isDark: {
    type: Boolean,
    default: false,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  isDocked: {
    type: Boolean,
    default: false,
  },
  /** 用于浮窗时聚焦输入框 */
  autoFocusInput: {
    type: Boolean,
    default: false,
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

const router = useRouter()
const { isLoggingIn } = useAuth()
const windowSize = useWindowSize()
const { isOffline, networkRequiredTooltip } = useOnlineStatus()
const themeStore = useThemeStore()

const shouldShowCleanableTip = computed(() => {
  const c = props.cleanableCount
  return c && typeof c.total === 'number' && c.total >= 3
})

const cleanableTipSummary = computed(() => {
  const c = props.cleanableCount || {}
  const parts = []
  if (c.links) parts.push(`${c.links} 处链接`)
  if (c.urls) parts.push(`${c.urls} 处 URL`)
  if (c.emails) parts.push(`${c.emails} 处邮箱`)
  if (c.phones) parts.push(`${c.phones} 处手机号`)
  if (c.md) parts.push(`${c.md} 处 Markdown 标记`)
  if (c.images) parts.push(`${c.images} 张图片`)
  return parts.length ? parts.join(' · ') : `${c.total || 0} 项`
})

const isBatchActive = computed(() => Boolean(props.batchProgress?.active))
const canUndoBatch = computed(() => Boolean(props.batchProgress?.finished))

function handleBatchCleanClick() {
  if (isBatchActive.value) return
  emit('batch-clean')
}

function handleBatchAbortClick() {
  emit('batch-clean-abort')
}

function handleBatchUndoClick() {
  emit('batch-clean-undo')
}

function onLocalCommandSelect(message, payload) {
  if (!message || !payload) return
  emit('local-command-select', {
    commandId: message.commandId,
    payload,
  })
}

function onLocalCommandDismiss(message) {
  if (!message) return
  emit('local-command-dismiss', {
    commandId: message.commandId,
  })
}

const typeLabels = {
  pdf: 'PDF',
  word: 'Word',
  markdown: 'Markdown',
  text: 'TXT',
  web: '网页',
}

const inputValue = ref('')
const messageListRef = ref(null)
const textareaRef = ref(null)

/* ── 本地指令示例轮转 ── */
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
  if (props.autoFocusInput) {
    nextTick(() => textareaRef.value?.focus())
  }
})

onBeforeUnmount(() => {
  stopPlaceholderRotation()
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
  emit('pin-change', !props.isPinned)
}

function handleDockToggle() {
  emit('dock-change', !props.isDocked)
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

useEscapeKey(() => props.isPinned === false, handleEscapeClose)

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

const PPT_TRIGGER_PREFIX =
  '(?:帮我|帮我弄|请|麻烦|能|可以|能不能|想|要)?\\s*(?:生成|做|写|弄|画|设计|出|创建)'
const PPT_TYPE_WORDS =
  '(?:PPT|ppt|幻灯片|演示稿|演示文稿|演讲稿|讲稿|片子|slides?|deck|presentation)'
const PPT_INTENT_REGEX = new RegExp(
  `(?:${PPT_TRIGGER_PREFIX})\\s*(?:一份|一个|下|个|篇|a|an)?\\s*([\\s\\S]*?)\\s*(?:${PPT_TYPE_WORDS})`,
  'i',
)
const PPT_PRESENTATION_ONLY_REGEX = new RegExp(
  `\\b(presentation)\\b`,
  'i',
)

function extractPptIntent(message) {
  if (!message || typeof message !== 'string') return { matched: false, topic: '' }
  const match = message.match(PPT_INTENT_REGEX)
  if (match) {
    const raw = (match[1] || '').trim()
    const topic = raw
      .replace(/^(?:一份|一个|下|个|篇|a|an)\s*/, '')
      .replace(/^(?:about|on|regarding|of|for)\s+/i, '')
      .replace(/^[\s，,。:：！!？?]+/, '')
      .replace(/[\s，,。:：！!？?]+$/, '')
      .trim()
    return { matched: true, topic: topic || message.trim() }
  }
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
  if (mentionOpen.value) return

  const message = inputValue.value.trim()
  const hasReferences = referencedItems.value.length > 0
  if (!message && !hasReferences) return

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

const WF_STEP_DEFS = [
  { key: PPT_STEP.OUTLINE, label: '生成大纲' },
  { key: PPT_STEP.TEMPLATE, label: '选择模板' },
  { key: PPT_STEP.GENERATE, label: '生成幻灯片' },
  { key: PPT_STEP.EDITING, label: '编辑中' },
]

const TEMPLATE_OPTIONS = [
  { id: 'business', label: '商务简约风', desc: '白底蓝调，适合正式场合', theme: 'light' },
  { id: 'tech', label: '科技感风', desc: '深色背景，发光元素，适合发布会', theme: 'dark' },
  { id: 'fresh', label: '清新自然风', desc: '浅绿配色，适合教育/公益', theme: 'light' },
  { id: 'custom', label: '自定义', desc: '请描述你想要的风格', theme: 'light' },
]

const customTemplateDesc = ref('')
const outlineEdit = ref('')

function emitSlideDeckInsert() {
  if (!wfHasSlides.value) return
  const slides = pptWorkflow.state.slides || []
  const theme = wfTheme.value
  const title = deriveWorkflowTitle()
  emit('insert-slide-deck', { slides, theme, title })
}

const wfTheme = computed(() => {
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

pptWorkflow.onStepChange((next, prev) => {
  if (next === PPT_STEP.EDITING && prev !== PPT_STEP.EDITING) {
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
    console.error('[AiChatPanelContent] 导出网页失败：', e)
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
    console.error('[AiChatPanelContent] 导出 PPTX 失败：', e)
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
    console.error('[AiChatPanelContent] 导出 PDF 失败：', e)
    toast.error('导出 PDF 失败：' + (e?.message || String(e)))
  }
}

function handleContinueEdit() {
  pptWorkflow.resetWorkflow()
  toast.info('已重置工作流，可继续修改')
}

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
  () => props.messages.length,
  () => scrollToBottom(),
)

watch(
  () => props.messages.map((message) => message.content).join('\n'),
  () => scrollToBottom(),
)

watch(
  () => props.autoFocusInput,
  (active) => {
    if (active) {
      nextTick(() => textareaRef.value?.focus())
    }
  },
)
</script>

<template>
  <div
    class="ai-chat-panel"
    :class="{ 'ai-chat-panel--dark': isDark }"
  >
    <header
      class="ai-chat-panel__header"
      :class="{ 'ai-chat-panel__header--pinned': isPinned, 'ai-chat-panel__header--docked': isDocked }"
    >
      <div class="ai-chat-panel__title-wrap">
        <span id="ai-chat-window-title" class="ai-chat-panel__title">AI 写作助手</span>
        <span v-if="modelName" class="ai-chat-panel__subtitle">{{ modelName }}</span>
      </div>
      <div class="ai-chat-panel__actions">
        <button
          type="button"
          class="ai-chat-panel__action ai-chat-panel__action--dock wpx-btn"
          :class="{ 'ai-chat-panel__action--active': isDocked }"
          :title="isDocked ? '恢复为浮窗' : '贴边到右侧 (IDE 效果)'"
          :aria-label="isDocked ? '恢复为浮窗' : '贴边到右侧'"
          :aria-pressed="isDocked"
          @mousedown.stop
          @click="handleDockToggle"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="ai-chat-panel__dock-icon"
            aria-hidden="true"
          >
            <rect
              x="3" y="4" width="18" height="16" rx="2"
              fill="none" stroke="currentColor" stroke-width="1.6"
            />
            <rect
              x="14" y="4" width="7" height="16" rx="1"
              :fill="isDocked ? 'currentColor' : 'none'"
              stroke="currentColor" stroke-width="1.6"
              :opacity="isDocked ? '0.25' : '1'"
            />
            <line
              x1="14" y1="4" x2="14" y2="20"
              stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="ai-chat-panel__action ai-chat-panel__action--pin wpx-btn"
          :class="{ 'ai-chat-panel__action--active': isPinned }"
          :title="isPinned ? '取消钉住' : '钉住'"
          aria-label="钉住窗口"
          @mousedown.stop
          @click="togglePin"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="ai-chat-panel__pin-icon"
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
          class="ai-chat-panel__action ai-chat-panel__action--close wpx-btn"
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
      class="ai-chat-panel__offline-banner"
      role="status"
    >
      当前处于离线模式，AI功能不可用
    </div>

    <div class="ai-chat-panel__messages-area">
      <TransitionGroup
        ref="messageListRef"
        name="ai-chat-message"
        tag="div"
        class="ai-chat-panel__messages"
        @mousedown.stop
      >
        <div
          v-for="(message, index) in messages"
          :key="message.id ?? `msg-${index}`"
          class="ai-chat-panel__message"
          :class="`ai-chat-panel__message--${message.role || 'assistant'}`"
        >
          <div
            v-if="message.references?.length"
            class="ai-chat-panel__message-refs"
          >
            <span
              v-for="refName in message.references"
              :key="refName"
              class="ai-chat-panel__message-ref"
            >
              @{{ refName }}
            </span>
          </div>
          <p
            v-if="message.role === 'user'"
            class="ai-chat-panel__message-text"
          >
            {{ message.content }}
          </p>
          <div
            v-else-if="message.onboardingKind === 'setup'"
            class="ai-chat-panel__onboarding"
          >
            <AiMarkdownContent
              class="ai-chat-panel__message-md ai-chat-panel__message-md--onboarding"
              :content="message.content"
            />
            <div class="ai-chat-panel__onboarding-actions">
              <button
                type="button"
                class="ai-chat-panel__quota-action wpx-btn"
                @click="handleOnboardingSetup"
              >
                好的
              </button>
            </div>
          </div>
          <div
            v-else-if="message.needsModelConfig"
            class="ai-chat-panel__quota-exhausted"
          >
            <p class="ai-chat-panel__message-text">{{ message.content }}</p>
            <button
              type="button"
              class="ai-chat-panel__quota-action wpx-btn"
              @click="handleGoToModelSettings"
            >
              去配置
            </button>
          </div>
          <div
            v-else-if="message.quotaExhausted"
            class="ai-chat-panel__quota-exhausted"
          >
            <p class="ai-chat-panel__message-text">{{ message.content }}</p>
            <button
              v-if="message.suggestConfigure"
              type="button"
              class="ai-chat-panel__quota-action wpx-btn"
              @click="handleGoToModelSettings"
            >
              去配置
            </button>
            <button
              v-else
              type="button"
              class="ai-chat-panel__quota-action wpx-btn"
              @click="handleQuotaRecharge"
            >
              去配置大模型
            </button>
          </div>
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
          <div v-else-if="message.skillResult" class="ai-chat-panel__skill-result">
            <div class="ai-chat-panel__skill-result-header">
              <span class="ai-chat-panel__skill-result-icon">
                {{ message.skillSuccess ? '✅' : '❌' }}
              </span>
              <span class="ai-chat-panel__skill-result-label">
                {{ message.skillSuccess ? 'Skill 执行完成' : 'Skill 执行失败' }}
              </span>
            </div>
            <p v-if="message.skillSuccess" class="ai-chat-panel__skill-result-text">
              已使用【{{ message.skillName }}】生成内容，已插入编辑器
            </p>
            <p v-else class="ai-chat-panel__skill-result-text ai-chat-panel__skill-result-text--error">
              {{ message.skillError }}
            </p>
            <div class="ai-chat-panel__skill-result-actions">
              <button
                type="button"
                class="ai-chat-panel__skill-retry-btn wpx-btn"
                :title="`重新调用 ${message.skillName}`"
                @click="emit('regenerate', { skillId: message.skillId, params: message.skillParams })"
              >
                重新生成
              </button>
            </div>
          </div>
          <AiMarkdownContent
            v-else
            class="ai-chat-panel__message-md"
            :content="message.content"
          />
        </div>
      </TransitionGroup>

      <p v-if="messages.length === 0" class="ai-chat-panel__empty">
        暂无消息，输入内容开始对话
      </p>
    </div>

    <!-- ── PPT 工作流面板：按 step 展示不同 UI ── -->
    <section
      v-if="wfIsActive"
      class="ai-chat-panel__workflow"
      data-testid="ai-chat-workflow-panel"
      :data-step="wfStep"
      @mousedown.stop
    >
      <header class="ai-chat-panel__workflow-header">
        <span class="ai-chat-panel__workflow-title">PPT 工作流</span>
        <span class="ai-chat-panel__workflow-progress">
          第 {{ wfStepIndex + 1 }} 步 / 共 4 步
        </span>
        <button
          type="button"
          class="ai-chat-panel__workflow-close"
          title="重置并关闭工作流面板"
          aria-label="重置工作流"
          @click="handleContinueEdit"
        >
          ↺
        </button>
      </header>

      <ol class="ai-chat-panel__workflow-steps">
        <li
          v-for="(stepDef, idx) in WF_STEP_DEFS"
          :key="stepDef.key"
          class="ai-chat-panel__workflow-step"
          :class="{
            'is-active': stepDef.key === wfStep,
            'is-done': wfStepIndex > idx,
          }"
        >
          <span class="ai-chat-panel__workflow-step-dot" />
          <span class="ai-chat-panel__workflow-step-label">{{ stepDef.label }}</span>
        </li>
      </ol>

      <p v-if="wfLastMessage" class="ai-chat-panel__workflow-message">
        {{ wfLastMessage }}
      </p>
      <p v-if="wfLastError" class="ai-chat-panel__workflow-error" role="alert">
        {{ wfLastError }}
      </p>

      <!-- STEP_OUTLINE -->
      <div
        v-if="wfStep === PPT_STEP.OUTLINE"
        class="ai-chat-panel__workflow-body"
      >
        <p class="ai-chat-panel__workflow-topic">
          <span class="ai-chat-panel__workflow-topic-label">主题：</span>
          <strong>{{ wfTopic }}</strong>
        </p>
        <textarea
          v-model="outlineEdit"
          class="ai-chat-panel__workflow-outline"
          rows="6"
          placeholder="AI 生成大纲后将自动填入此处；你也可以手动编辑，或直接点击『确认大纲』使用主题作为骨架。"
        />
        <div class="ai-chat-panel__workflow-actions">
          <button
            type="button"
            class="ai-chat-panel__workflow-btn ai-chat-panel__workflow-btn--primary wpx-btn"
            @click="handleConfirmOutline"
          >
            确认大纲
          </button>
          <button
            type="button"
            class="ai-chat-panel__workflow-btn wpx-btn"
            @click="handleModifyOutline"
          >
            修改大纲
          </button>
        </div>
      </div>

      <!-- STEP_TEMPLATE -->
      <div
        v-else-if="wfStep === PPT_STEP.TEMPLATE"
        class="ai-chat-panel__workflow-body"
      >
        <p class="ai-chat-panel__workflow-topic">
          请选择演示文稿模板：
        </p>
        <div class="ai-chat-panel__template-grid">
          <button
            v-for="tpl in TEMPLATE_OPTIONS"
            :key="tpl.id"
            type="button"
            class="ai-chat-panel__template-card"
            :class="{ 'is-dark': tpl.theme === 'dark' }"
            :data-theme="tpl.theme"
            :title="tpl.desc"
            @click="handleSelectTemplate(tpl.id)"
          >
            <span class="ai-chat-panel__template-card-label">{{ tpl.label }}</span>
            <span class="ai-chat-panel__template-card-desc">{{ tpl.desc }}</span>
          </button>
        </div>
        <textarea
          v-if="true"
          v-model="customTemplateDesc"
          class="ai-chat-panel__custom-desc"
          rows="2"
          placeholder="选中「自定义」时，请先在此描述你想要的风格（如：莫兰迪配色，圆润字体，公众号风格）"
        />
      </div>

      <!-- STEP_GENERATE -->
      <div
        v-else-if="wfStep === PPT_STEP.GENERATE"
        class="ai-chat-panel__workflow-body"
      >
        <p class="ai-chat-panel__workflow-topic">
          正在生成幻灯片…
        </p>
        <div
          class="ai-chat-panel__progress"
          role="progressbar"
          :aria-valuenow="Math.round(wfProgress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="ai-chat-panel__progress-fill"
            :style="{ width: `${Math.round(wfProgress * 100)}%` }"
          />
        </div>
        <p class="ai-chat-panel__progress-tip">
          AI 正在根据大纲与模板生成每张幻灯片内容，完成后将自动插入编辑器。
        </p>
      </div>

      <!-- STEP_EDITING -->
      <div
        v-else-if="wfStep === PPT_STEP.EDITING"
        class="ai-chat-panel__workflow-body"
      >
        <p class="ai-chat-panel__workflow-topic">
          已生成
          <strong>{{ wfSlidesCount }}</strong>
          页幻灯片，并自动插入编辑器。
        </p>
        <div class="ai-chat-panel__workflow-actions">
          <button
            type="button"
            class="ai-chat-panel__workflow-btn wpx-btn"
            @click="handleExportHtml"
          >
            导出网页
          </button>
          <button
            type="button"
            class="ai-chat-panel__workflow-btn wpx-btn"
            @click="handleExportPptx"
          >
            导出 PPTX
          </button>
          <button
            type="button"
            class="ai-chat-panel__workflow-btn wpx-btn"
            @click="handleExportPdf"
          >
            导出 PDF
          </button>
          <button
            type="button"
            class="ai-chat-panel__workflow-btn ai-chat-panel__workflow-btn--primary wpx-btn"
            @click="handleContinueEdit"
          >
            继续修改
          </button>
        </div>
        <p class="ai-chat-panel__progress-tip">
          插入后可在编辑器选中 SlideDeck 节点进行翻页、全屏、复制或删除；
          也可继续在下方对话要求 AI 添加 / 修改 / 删除某一页。
        </p>
      </div>
    </section>

    <footer class="ai-chat-panel__footer" @mousedown.stop>
      <div v-if="selectionContext" class="ai-chat-panel__context">
        <p class="ai-chat-panel__context-label">选中文本将附加到消息</p>
        <p class="ai-chat-panel__context-text">{{ selectionContext }}</p>
      </div>

      <div
        v-if="shouldShowCleanableTip || isBatchActive || canUndoBatch"
        class="ai-chat-panel__cleanable-tip"
        :class="{
          'ai-chat-panel__cleanable-tip--active': isBatchActive,
          'ai-chat-panel__cleanable-tip--finished': canUndoBatch && !isBatchActive,
        }"
        role="status"
        aria-live="polite"
      >
        <span class="ai-chat-panel__cleanable-tip-icon" aria-hidden="true">🧹</span>
        <span class="ai-chat-panel__cleanable-tip-text">
          <template v-if="isBatchActive">
            清洗中（{{ batchProgress.step }}/{{ batchProgress.totalSteps }}）：
            <strong>{{ batchProgress.label || '处理中' }}</strong>
          </template>
          <template v-else-if="canUndoBatch">
            已完成清洗（{{ batchProgress.totalSteps }} 步），如需恢复可一键撤销
          </template>
          <template v-else>
            检测到 <strong>{{ cleanableCount.total }}</strong> 处可清洗内容（{{ cleanableTipSummary }}）
          </template>
        </span>
        <button
          v-if="isBatchActive"
          type="button"
          class="ai-chat-panel__cleanable-tip-btn ai-chat-panel__cleanable-tip-btn--abort wpx-btn"
          data-test="batch-clean-abort"
          @click="handleBatchAbortClick"
        >
          中断
        </button>
        <button
          v-else-if="canUndoBatch"
          type="button"
          class="ai-chat-panel__cleanable-tip-btn ai-chat-panel__cleanable-tip-btn--undo wpx-btn"
          data-test="batch-clean-undo"
          @click="handleBatchUndoClick"
        >
          撤销
        </button>
        <button
          v-else
          type="button"
          class="ai-chat-panel__cleanable-tip-btn wpx-btn"
          data-test="batch-clean-trigger"
          @click="handleBatchCleanClick"
        >
          一键清洗
        </button>
      </div>

      <div class="ai-chat-panel__input-wrap">
        <div
          v-if="referencedItems.length"
          class="ai-chat-panel__refs"
        >
          <span
            v-for="item in referencedItems"
            :key="item.id"
            class="ai-chat-panel__ref-tag"
          >
            <span class="ai-chat-panel__ref-tag-icon">@</span>
            <span class="ai-chat-panel__ref-tag-name" :title="item.filename">
              {{ item.filename }}
            </span>
            <button
              type="button"
              class="ai-chat-panel__ref-tag-remove"
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
          class="ai-chat-panel__mention-picker"
          @mousedown.prevent
        >
          <p class="ai-chat-panel__mention-title">引用资料</p>
          <p v-if="mentionLoading" class="ai-chat-panel__mention-empty">加载中…</p>
          <p v-else-if="!filteredMentionItems.length" class="ai-chat-panel__mention-empty">
            {{ mentionQuery ? '无匹配资料' : '暂无资料，请先在资料库上传' }}
          </p>
          <ul v-else class="ai-chat-panel__mention-list">
            <li
              v-for="(item, index) in filteredMentionItems"
              :key="item.id"
            >
              <button
                type="button"
                class="ai-chat-panel__mention-item"
                :class="{ 'ai-chat-panel__mention-item--active': index === mentionHighlightIndex }"
                @click="selectMentionItem(item)"
              >
                <span class="ai-chat-panel__mention-type">{{ typeLabel(item.type) }}</span>
                <span class="ai-chat-panel__mention-name">{{ item.filename }}</span>
              </button>
            </li>
          </ul>
        </div>

        <textarea
          ref="textareaRef"
          v-model="inputValue"
          class="ai-chat-panel__input wpx-input"
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
</template>

<style scoped>
/* 面板根容器：floating / docked 两种包装下都使用相同的内部结构 */
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #1a1a1a);
  border-radius: inherit;
}

/* ── Header ── */
.ai-chat-panel__header {
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

.ai-chat-panel__header--pinned {
  cursor: default;
}

.ai-chat-panel__header--docked {
  /* docked 模式下不允许拖动整个面板 */
  cursor: default;
}

.ai-chat-panel__offline-banner {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  color: #991b1b;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
}

.ai-chat-panel--dark .ai-chat-panel__offline-banner {
  color: #fecaca;
  background: #450a0a;
  border-bottom-color: #7f1d1d;
}

.ai-chat-panel__title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.ai-chat-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-panel__subtitle {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-fg-muted, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-panel__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ai-chat-panel__action {
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

.ai-chat-panel__action:hover {
  background: var(--theme-bg-muted, #e2e8f0);
  color: var(--theme-fg, #0f172a);
}

.ai-chat-panel__action--pin.ai-chat-panel__action--active {
  color: #2563eb;
}

.ai-chat-panel__action--close {
  font-size: 15px;
  font-weight: 500;
}

.ai-chat-panel__pin-icon {
  width: 16px;
  height: 16px;
}

/* ── Messages ── */
.ai-chat-panel__messages-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-chat-panel__messages {
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

.ai-chat-panel__empty {
  margin: auto 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

.ai-chat-panel__message {
  max-width: 88%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
}

.ai-chat-panel__message--user {
  align-self: flex-end;
  background: #7c3aed;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.ai-chat-panel__message--assistant {
  align-self: flex-start;
  background: #f1f5f9;
  color: #1a1a1a;
  border-bottom-left-radius: 4px;
}

.ai-chat-panel--dark .ai-chat-panel__message--assistant {
  background: #2d2d2d;
  color: #e0e0e0;
}

.ai-chat-panel__message--local {
  align-self: flex-start;
  background: transparent;
  padding: 0;
  max-width: 100%;
}

.ai-chat-panel__message-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.ai-chat-panel__message-ref {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  line-height: 1.4;
}

.ai-chat-panel__message-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat-panel__message-md {
  min-width: 0;
}

.ai-chat-panel__quota-exhausted {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-chat-panel__onboarding {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-chat-panel__onboarding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-chat-panel__message-md--onboarding :deep(p) {
  margin: 0 0 0.5em;
  line-height: 1.65;
  color: var(--theme-fg);
}

.ai-chat-panel__message-md--onboarding :deep(p:last-child) {
  margin-bottom: 0;
}

.ai-chat-panel__quota-action {
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

.ai-chat-panel__quota-action:hover:not(:disabled) {
  background: #6d28d9;
}

.ai-chat-panel__quota-action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ── Footer ── */
.ai-chat-panel__footer {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg, #fff);
}

.ai-chat-panel__context {
  margin-bottom: 8px;
  border: 1px solid #ddd6fe;
  border-radius: 10px;
  background: #f5f3ff;
  padding: 8px 10px;
}

.ai-chat-panel__context-label {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: #6d28d9;
}

.ai-chat-panel__context-text {
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

/* ── Cleanable tip ── */
.ai-chat-panel__cleanable-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  font-size: 12px;
  line-height: 1.5;
  color: #78350f;
  box-shadow: 0 1px 2px rgba(217, 119, 6, 0.08);
  animation: ai-chat-panel__tip-in 0.25s ease-out;
}

@keyframes ai-chat-panel__tip-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-chat-panel__cleanable-tip-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.ai-chat-panel__cleanable-tip-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-panel__cleanable-tip-text strong {
  color: #b45309;
  font-weight: 700;
}

.ai-chat-panel__cleanable-tip-btn {
  flex-shrink: 0;
  padding: 4px 10px !important;
  font-size: 12px !important;
  font-weight: 600;
  border-radius: 6px !important;
  background: #d97706 !important;
  color: #fff !important;
  border: none !important;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ai-chat-panel__cleanable-tip-btn:hover {
  background: #b45309 !important;
}

.ai-chat-panel__cleanable-tip--active {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  animation: ai-chat-panel__tip-pulse 1.5s ease-in-out infinite;
}

@keyframes ai-chat-panel__tip-pulse {
  0%, 100% {
    box-shadow: 0 1px 2px rgba(217, 119, 6, 0.08);
  }
  50% {
    box-shadow: 0 1px 8px rgba(217, 119, 6, 0.28);
  }
}

.ai-chat-panel__cleanable-tip-btn--abort {
  background: #6b7280 !important;
}

.ai-chat-panel__cleanable-tip-btn--abort:hover {
  background: #4b5563 !important;
}

.ai-chat-panel__cleanable-tip-btn--undo {
  background: #dc2626 !important;
}

.ai-chat-panel__cleanable-tip-btn--undo:hover {
  background: #b91c1c !important;
}

/* ── Input area ── */
.ai-chat-panel__input-wrap {
  position: relative;
}

.ai-chat-panel__refs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.ai-chat-panel__ref-tag {
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

.ai-chat-panel__ref-tag-icon {
  flex-shrink: 0;
  font-weight: 600;
}

.ai-chat-panel__ref-tag-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.ai-chat-panel__ref-tag-remove {
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

.ai-chat-panel__ref-tag-remove:hover {
  background: rgba(124, 58, 237, 0.15);
}

.ai-chat-panel__mention-picker {
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

.ai-chat-panel__mention-title {
  margin: 0;
  padding: 8px 10px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid #f1f5f9;
}

.ai-chat-panel__mention-empty {
  margin: 0;
  padding: 12px 10px;
  font-size: 12px;
  color: #94a3b8;
}

.ai-chat-panel__mention-list {
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
}

.ai-chat-panel__mention-item {
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

.ai-chat-panel__mention-item:hover,
.ai-chat-panel__mention-item--active {
  background: #f5f3ff;
}

.ai-chat-panel__mention-type {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 10px;
  font-weight: 600;
}

.ai-chat-panel__mention-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #334155;
}

.ai-chat-panel__input {
  width: 100%;
  resize: none;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
  box-sizing: border-box;
}

.ai-chat-panel__input::placeholder {
  color: #94a3b8;
}

/* ── Skill result ── */
.ai-chat-panel__skill-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-chat-panel__skill-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-chat-panel__skill-result-icon {
  font-size: 16px;
  line-height: 1;
}

.ai-chat-panel__skill-result-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-fg);
}

.ai-chat-panel__skill-result-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg, #1a1a1a);
}

.ai-chat-panel__skill-result-text--error {
  color: #dc2626;
}

.ai-chat-panel__skill-result-actions {
  display: flex;
  gap: 8px;
}

.ai-chat-panel__skill-retry-btn {
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

.ai-chat-panel__skill-retry-btn:hover {
  background: var(--theme-bg-subtle);
}

.ai-chat-panel--dark .ai-chat-panel__skill-retry-btn {
  border-color: #444;
  background: #2a2a2a;
  color: #e0e0e0;
}

.ai-chat-panel--dark .ai-chat-panel__skill-retry-btn:hover {
  background: #333;
}

/* ── PPT workflow ── */
.ai-chat-panel__workflow {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
  border-top: 1px solid var(--theme-border, #e2e8f0);
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent, #7c3aed) 6%, transparent), transparent 60%), var(--theme-bg, #ffffff);
}

.ai-chat-panel--dark .ai-chat-panel__workflow {
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent, #7c3aed) 12%, transparent), transparent 60%), var(--theme-bg, #1a1a1a);
}

.ai-chat-panel__workflow-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-chat-panel__workflow-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-accent, #7c3aed);
}

.ai-chat-panel__workflow-progress {
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  font-variant-numeric: tabular-nums;
}

.ai-chat-panel__workflow-close {
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

.ai-chat-panel__workflow-close:hover {
  background: var(--theme-bg-muted, #e2e8f0);
  color: var(--theme-fg, #0f172a);
}

.ai-chat-panel__workflow-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
}

.ai-chat-panel__workflow-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.ai-chat-panel__workflow-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--theme-border, #e2e8f0);
  flex-shrink: 0;
}

.ai-chat-panel__workflow-step.is-done .ai-chat-panel__workflow-step-dot {
  background: var(--theme-accent, #7c3aed);
}

.ai-chat-panel__workflow-step.is-active .ai-chat-panel__workflow-step-dot {
  background: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent, #7c3aed) 22%, transparent);
}

.ai-chat-panel__workflow-step.is-active .ai-chat-panel__workflow-step-label {
  color: var(--theme-fg, #0f172a);
  font-weight: 600;
}

.ai-chat-panel__workflow-step-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-panel__workflow-message {
  margin: 0;
  font-size: 11px;
  color: var(--theme-fg-muted, #475569);
  line-height: 1.5;
}

.ai-chat-panel__workflow-error {
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 11px;
  line-height: 1.4;
}

.ai-chat-panel--dark .ai-chat-panel__workflow-error {
  background: rgba(239, 68, 68, 0.15);
  color: #fecaca;
}

.ai-chat-panel__workflow-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-chat-panel__workflow-topic {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg, #1a1a1a);
}

.ai-chat-panel__workflow-topic-label {
  color: var(--theme-fg-muted, #64748b);
}

.ai-chat-panel__workflow-outline,
.ai-chat-panel__custom-desc {
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

.ai-chat-panel--dark .ai-chat-panel__workflow-outline,
.ai-chat-panel--dark .ai-chat-panel__custom-desc {
  background: #2a2a2a;
  border-color: #444;
}

.ai-chat-panel__workflow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-chat-panel__workflow-btn {
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

.ai-chat-panel__workflow-btn:hover {
  background: var(--theme-bg-muted, #f1f5f9);
  border-color: var(--theme-accent, #7c3aed);
  color: var(--theme-accent, #7c3aed);
}

.ai-chat-panel__workflow-btn--primary {
  background: var(--theme-accent, #7c3aed);
  border-color: var(--theme-accent, #7c3aed);
  color: #ffffff;
}

.ai-chat-panel__workflow-btn--primary:hover {
  background: color-mix(in srgb, var(--theme-accent, #7c3aed) 88%, #000 12%);
  border-color: transparent;
  color: #ffffff;
}

.ai-chat-panel__template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ai-chat-panel__template-card {
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

.ai-chat-panel__template-card:hover {
  border-color: var(--theme-accent, #7c3aed);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #7c3aed) 20%, transparent);
  transform: translateY(-1px);
}

.ai-chat-panel__template-card[data-theme="dark"] {
  background: #0f172a;
  color: #f1f5f9;
  border-color: #1e293b;
}

.ai-chat-panel__template-card[data-theme="dark"]:hover {
  border-color: var(--theme-accent, #7c3aed);
}

.ai-chat-panel__template-card-label {
  font-size: 12px;
  font-weight: 600;
}

.ai-chat-panel__template-card-desc {
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  line-height: 1.45;
}

.ai-chat-panel__template-card[data-theme="dark"] .ai-chat-panel__template-card-desc {
  color: #94a3b8;
}

.ai-chat-panel__progress {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--theme-bg-muted, #e2e8f0);
  overflow: hidden;
}

.ai-chat-panel__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--theme-accent, #7c3aed), #ec4899);
  border-radius: inherit;
  transition: width 0.3s ease;
}

.ai-chat-panel__progress-tip {
  margin: 0;
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  line-height: 1.5;
}
</style>