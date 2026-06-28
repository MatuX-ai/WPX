<script setup>
import { computed, inject, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useSkillsStore } from '@/stores/skills'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/app'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
  useFloatingWindows,
} from '@/composables/useFloatingWindows'
import AiAvatar from '@/components/ai/AiAvatar.vue'
import AiChatWindow from '@/components/ai/AiChatWindow.vue'
import { getMessageText, useAiChat } from '@/composables/useAiChat'
import { useSkillExecutor } from '@/composables/useSkillExecutor'
import { useLocalCommands, getLocalCommandPlaceholders, countCleanableItems, runBatchClean, runBatchCleanAsync } from '@/composables/useLocalCommands'
import { getActiveEditor } from '@/composables/useEditorRegistry'
import { useOpenSettings } from '@/composables/useOpenSettings'
import { useRouter } from 'vue-router'
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
import {
  formatDocument,
  alignImages,
  getTemplateList,
  getTemplateById,
  hasImagesInDoc,
  getDefaultImageAlignMode,
} from '@/composables/useMarkdownFormatter'
import { useMarkdownFormatPromptStore } from '@/stores/markdownFormatPrompt'
import {
  formatHtmlDocument,
  hasHtmlImport,
  getHtmlImportMeta,
  restoreFromHtmlSource,
} from '@/composables/useHtmlFormatter'
import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'
import { useHtmlFormatStore } from '@/stores/htmlFormatBar'
import { useFocusModeFormatPrompt } from '@/composables/useFocusModeFormatPrompt'
import {
  getDefaultTemplate,
  setDefaultTemplate,
} from '@/utils/markdownFormatPreference'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const modelSettingsStore = useModelSettingsStore()
const skillsStore = useSkillsStore()
const userPreferencesStore = useUserPreferencesStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const appStore = useAppStore()
const { isGuest } = storeToRefs(authStore)
const floatingWindows = useFloatingWindows()
const aiChat = useFloatingWindowState(FLOATING_WINDOW_ID.AI_CHAT)
const { openSettings } = useOpenSettings()
const { processUserInput } = useLocalCommands()
const router = useRouter()
const formatPromptStore = useMarkdownFormatPromptStore()
const htmlPromptStore = useHtmlFormatPromptStore()
const { triggerFocusFormatPrompt } = useFocusModeFormatPrompt()
const htmlFormatBarStore = useHtmlFormatStore()

// ── Level 3: 提示气泡数据源 ────────────────────────────
// 统计当前编辑器中「可被批量清洗」的内容数量（链接/邮箱/手机号/Markdown/图片）。
// 该值为只读快照，供 AiChatWindow 提示气泡展示使用。节流刷新避免频繁扫描。
const CLEANABLE_DEFAULT = Object.freeze({
  links: 0,
  urls: 0,
  emails: 0,
  phones: 0,
  md: 0,
  images: 0,
  total: 0,
})
const cleanableCount = ref({ ...CLEANABLE_DEFAULT })
let cleanableScanTimer = null

function refreshCleanableCount() {
  const editor = getActiveEditor()
  if (!editor) {
    cleanableCount.value = { ...CLEANABLE_DEFAULT }
    return
  }
  try {
    const result = countCleanableItems(editor)
    cleanableCount.value = { ...result }
  } catch (err) {
    // 扫描失败（编辑器未挂载 / ProseMirror 异常）静默降级为 0
    cleanableCount.value = { ...CLEANABLE_DEFAULT }
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[AiAssistantPlaceholder] countCleanableItems failed:', err)
    }
  }
}

function scheduleCleanableScan(delay = 1500) {
  if (cleanableScanTimer) {
    clearTimeout(cleanableScanTimer)
  }
  cleanableScanTimer = setTimeout(() => {
    cleanableScanTimer = null
    refreshCleanableCount()
  }, delay)
}

/**
 * 把 runBatchClean 的结果对象格式化为可读的清洗摘要。
 * 例：{ links: 3, emails: 2, md: 5 } → "3 处链接 + 2 处邮箱 + 5 处 Markdown 标记"
 */
function formatBatchCleanSummary(r) {
  const parts = []
  if (r.links) parts.push(`${r.links} 处链接`)
  if (r.urls) parts.push(`${r.urls} 处 URL`)
  if (r.emails) parts.push(`${r.emails} 处邮箱`)
  if (r.phones) parts.push(`${r.phones} 处手机号`)
  if (r.md) parts.push(`${r.md} 处 Markdown 标记`)
  if (r.images) parts.push(`${r.images} 张图片`)
  return parts.length ? parts.join(' + ') : `${r.total} 项`
}

// ── 批量清洗异步进度 + 中断 + 一键撤销 ─────────────────

/** 当前 batch-clean 进度消息 ID，用于就地更新内容 */
let batchProgressMessageId = null
/** 当前 batch-clean 的 AbortController，用于中断 */
let batchAbortController = null
/** 当前 batch-clean 的可读状态，供 AiChatWindow 判断是否显示「中断 / 撤销」按钮 */
const batchProgress = ref({ active: false, step: 0, totalSteps: 6, label: '', counts: null, finished: false })

const canUndoBatchClean = computed(
  () => !batchProgress.value.active && batchProgress.value.finished,
)

/**
 * 处理 AiChatWindow 提示气泡发出的「一键清洗」请求。
 * 使用 runBatchCleanAsync 支持进度可视与中断；完成后可一键 Ctrl+Z 撤销整个批量。
 */
async function handleBatchClean() {
  const editor = getActiveEditor()
  if (!editor) return
  if (batchProgress.value.active) {
    // 已有清洗任务进行中，忽略重复触发
    return
  }

  // 推送用户消息
  displayMessages.value.push({
    id: createMessageId(),
    role: 'user',
    content: '🧹 一键清洗',
  })

  // 推送进度消息（就地更新）
  batchProgressMessageId = createMessageId()
  displayMessages.value.push({
    id: batchProgressMessageId,
    role: 'local',
    content: '⏳ 准备清洗…',
    commandId: 'batch-clean',
    category: 'text',
    localCommandProgress: true,
    batchCleanProgress: { active: true, step: 0, totalSteps: 6, label: '准备中', count: 0 },
  })

  batchProgress.value = { active: true, step: 0, totalSteps: 6, label: '准备中', counts: null, finished: false }
  batchAbortController = new AbortController()

  let result
  try {
    result = await runBatchCleanAsync(editor, {
      signal: batchAbortController.signal,
      onProgress: (info) => {
        // 就地更新进度消息内容
        batchProgress.value = {
          active: !info.done,
          step: info.step,
          totalSteps: info.totalSteps,
          label: info.label,
          counts: batchProgress.value.counts,
          finished: info.done,
        }
        const target = displayMessages.value.find((m) => m.id === batchProgressMessageId)
        if (target) {
          if (info.done) {
            target.content = '✅ 清洗完成'
            target.batchCleanProgress = { active: false, step: info.totalSteps, totalSteps: info.totalSteps, label: '完成', count: 0 }
          } else {
            target.content = `🧹 清洗中（${info.step}/${info.totalSteps}）：${info.label}${info.count ? ` · ${info.count} 处` : ''}`
            target.batchCleanProgress = {
              active: true,
              step: info.step,
              totalSteps: info.totalSteps,
              label: info.label,
              count: info.count,
            }
          }
        }
      },
    })
  } catch (err) {
    result = {
      links: 0, urls: 0, emails: 0, phones: 0, md: 0, images: 0, total: 0,
      errors: [err?.message || String(err)], aborted: false,
    }
  }

  // 用最终结果替换进度消息内容
  const target = displayMessages.value.find((m) => m.id === batchProgressMessageId)
  if (target) {
    target.localCommandProgress = false
    if (result.aborted) {
      target.content = '⏹ 已中断'
      target.localCommandSuccess = false
      target.batchCleanProgress = { active: false, step: 0, totalSteps: 6, label: '已中断', count: 0, aborted: true }
    } else if (result.total === 0) {
      target.content = '✨ 文档已经很干净，没有可清洗的内容'
      target.localCommandSuccess = false
      target.batchCleanProgress = { active: false, step: 6, totalSteps: 6, label: '完成', count: 0, empty: true }
    } else {
      target.content = `✅ 已批量清洗：${formatBatchCleanSummary(result)}${
        result.errors.length ? '（部分步骤出错：' + result.errors.join('；') + '）' : ''
      }`
      target.localCommandSuccess = true
      target.batchCleanResult = result
      target.batchCleanProgress = { active: false, step: 6, totalSteps: 6, label: '完成', count: result.total, finished: true }
    }
  }

  batchProgress.value = {
    active: false,
    step: result.aborted ? 0 : 6,
    totalSteps: 6,
    label: result.aborted ? '已中断' : '完成',
    counts: result,
    finished: !result.aborted && result.total > 0,
  }
  batchAbortController = null
  scheduleCleanableScan(0)
}

/**
 * 中断当前 batch-clean。已应用的修改会被丢弃（共享 transaction 不会被 dispatch）。
 */
function abortBatchClean() {
  if (batchAbortController && !batchAbortController.signal.aborted) {
    batchAbortController.abort()
  }
}

/**
 * 一键撤销 batch-clean（Ctrl+Z 的可视化入口）。
 * 依赖 Tiptap undo history —— 由于 batch-clean 是单个 undo step，一次 undo 即可恢复。
 */
function undoBatchClean() {
  const editor = getActiveEditor()
  if (!editor) return
  if (editor.commands.undo) {
    editor.chain().focus().undo().run()
  }
  batchProgress.value = { active: false, step: 0, totalSteps: 6, label: '已撤销', counts: null, finished: false }
  scheduleCleanableScan(0)
}

const aiChatWindowVisible = computed(() => aiChat.visible.value)
const aiChatWindowPinned = computed(() => aiChat.pinned.value)
const aiChatWindowZIndex = computed(() => aiChat.zIndex.value)
/** 是否贴边（docked）。当 docked 时，A: AiAvatar 隐藏；B: AiChatWindow 作为 inline panel 渲染。 */
const aiChatWindowDocked = computed(() => aiChat.isDocked.value)

/**
 * 贴边（docked）模式的挂载点。
 * EditorLayout 在右栏提供了 aiChatDockTarget ref；
 * docked 模式下，A:AssistantPlaceholder 会使用 Teleport 把 AiChatWindow 传送到这个节点。
 * 默认提供 null（独立使用场景）。
 */
const aiChatDockTarget = inject('aiChatDockTarget', ref(null))

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

/**
 * 本地指令示例占位符（提供代表性示例输入给 AI 窗的 textarea）。
 * AiChatWindow 每 30 秒轮转一次，避免提示单调。
 */
const localCommandPlaceholders = computed(() => getLocalCommandPlaceholders())

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

/**
 * 尝试以本地指令方式处理用户输入。
 * 返回 true 表示已处理（无需再走 AI 流程），false 表示需要走 AI。
 *
 * @param {string} text 原始用户输入
 * @param {object} activeSelection 当前选区快照 { from, to, hasSelection, text }
 * @returns {boolean} true = 已处理，false = 未命中本地指令
 */
function tryLocalCommand(text, activeSelection) {
  if (!text || typeof text !== 'string') return false
  // 仅有引用资料时（text 为空）也跳过本地指令
  if (!text.trim()) return false

  const editor = getActiveEditor()
  if (!editor) {
    // 即使没有 editor 也要让窗口/视图类指令（如「设置」「暗色模式」）能命中
  }

  const sel = activeSelection || { from: null, to: null, hasSelection: false, text: '' }
  const hasSelection = Boolean(sel.hasSelection)
  const hasCursor = Boolean(editor && sel.from != null)

  // 读取剪贴板（用于 paste 指令）。失败时降级为空串。
  let clipboardText = ''
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    navigator.clipboard
      .readText()
      .then((v) => {
        if (typeof v === 'string' && v) clipboardText = v
      })
      .catch(() => {})
  }

  // 文档摘要（用于 export-* 指令判断是否为空）
  const documentContent = editor
    ? (editor.state?.doc?.textContent || editor.getText?.() || '')
    : ''

  const isDocumentDirty = appStore.documentSaveStatus === 'unsaved'

  // 委托应用：把高频操作集中到一个对象里供 action 闭包使用
  const context = {
    editor,
    hasSelection,
    hasCursor,
    clipboardText,
    isDark: themeStore.isDark,
    focusMode: userPreferencesStore.paper?.focusMode || false,
    documentContent,
    isDocumentDirty,
    router: undefined, // 使用 openSettings / openFontMarket / openLibrary 委派
    themeStore,
    userPreferencesStore,
    appStore,

    // 路由委派
    openSettings: () => openSettings(),
    openFontMarket: () => router.push({ name: 'font-market' }),
    openLibrary: () => router.push({ name: 'library' }),
    openKnowledgePanel: () => appStore.toggleKnowledgePanel(),

    // 文件操作委派
    saveDocument: () => {
      const md = editor ? (editor.storage?.markdown?.content || documentContent) : ''
      appStore.openSaveDialog({ content: md, defaultTitle: appStore.documentTitle || '未命名文档' })
    },
    newDocument: () => {
      appStore.requestNewDocument()
    },
    insertImage: () => {
      // 复用 EditorCore 暴露的 openImageEditor
      const ev = new CustomEvent('wpx:local-command:insert-image', { detail: { source: 'ai-chat' } })
      window.dispatchEvent(ev)
    },

    // 视图切换
    toggleFocusMode: () => {
      const next = !userPreferencesStore.paper.focusMode
      userPreferencesStore.setFocusMode(next)
        .then(() => {
          // 进入 A4 阅读模式 → 根据文档内容类型主动提示 AI 助理排版
          if (!next) return
          triggerFocusFormatPrompt()
        })
        .catch((error) => {
          console.warn('[AiAssistantPlaceholder] toggleFocusMode failed:', error)
        })
      return next
    },
    toggleDarkMode: () => {
      themeStore.toggleLightDark()
      return themeStore.isDark
    },
  }

  const result = processUserInput(text, context)
  if (!result || result.type !== 'local') {
    return false
  }

  // 命中本地指令：先把用户消息推入，再推入指令结果消息
  displayMessages.value.push({
    id: createMessageId(),
    role: 'user',
    content: text,
  })

  // ── MD 智能排版引擎: 拦截特殊 prompt 标记 ──
  if (result.commandId === 'format-md' && result.message === '__MARKDOWN_FORMAT_PROMPT__') {
    pushMarkdownFormatPrompt({ source: 'manual' })
    return true
  }
  if (
    result.commandId === 'align-md-images' &&
    result.message === '__MARKDOWN_IMAGE_ALIGN_PROMPT__'
  ) {
    pushMarkdownImageAlignPrompt()
    return true
  }

  // ── HTML 智能排版引擎: 拦截「网页排版」本地指令 ──
  if (result.commandId === 'format-html' && result.message === '__HTML_FORMAT_PROMPT__') {
    pushHtmlFormatPrompt({ source: 'manual' })
    return true
  }

  displayMessages.value.push({
    id: createMessageId(),
    role: 'local',
    content: result.message || '',
    commandId: result.commandId,
    category: result.category,
    icon: result.icon,
    localCommandSuccess: result.success !== false,
  })

  return true
}

/**
 * 推送 Markdown 排版模板选择器消息。
 * 触发场景：用户输入“排版/格式化/美化”且文档含 Markdown 节点，
 * 或粘贴/导入检测到 Markdown。
 * 若已有默认模板偏好且来源非 manual，则自动应用并跳过选择器。
 * @param {{ source?: 'paste'|'import'|'manual'|'dragdrop', previewText?: string, hasImages?: boolean, token?: symbol|string }} [opts]
 */
function pushMarkdownFormatPrompt(opts = {}) {
  const editor = getActiveEditor()
  if (!editor) {
    toast.info('没有可用的编辑器')
    return
  }
  const source = opts.source || 'manual'
  const previewText = opts.previewText || ''
  const hasImages = typeof opts.hasImages === 'boolean' ? opts.hasImages : hasImagesInDoc(editor)

  // 默认模板优先：非 manual 来源 → 自动应用 → 零延迟
  if (source !== 'manual') {
    const pref = getDefaultTemplate()
    if (pref && pref.templateId) {
      const result = formatDocument(editor, pref.templateId)
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result.ok ? result.message : result.message || '⚠️ 自动排版失败',
        commandId: 'format-md',
        category: 'format',
        icon: result.ok ? 'success' : 'warning',
        localCommandSuccess: result.ok,
      })
      if (result.ok && hasImages) {
        const imgMode = pref.imageAlignMode || getDefaultImageAlignMode(editor)
        const alignResult = alignImages(editor, imgMode)
        if (alignResult.ok && alignResult.count > 0) {
          displayMessages.value.push({
            id: createMessageId(),
            role: 'local',
            content: `✅ 已自动对齐 ${alignResult.count} 张图片`,
            commandId: 'align-md-images',
            category: 'format',
            icon: 'success',
            localCommandSuccess: true,
          })
        }
      }
      return
    }
  }

  displayMessages.value.push({
    id: createMessageId(),
    role: 'local',
    content:
      source === 'manual'
        ? '请选择排版模板：'
        : source === 'a4-focus-mode'
        ? '检测到 Markdown 内容，是否按模板排版？'
        : '检测到 Markdown 格式，需要我帮你排版吗？',
    commandId: 'format-md',
    category: 'format',
    icon: 'info',
    localCommandSuccess: true,
    localCommandMode: 'selector',
    localCommandTemplates: getTemplateList(),
    localCommandPreview: previewText,
    localCommandPayload: { source },
    localCommandShowKeepOriginal: true,
  })
}

/**
 * 推送图片对齐选择器消息。
 * 触发场景：用户输入“对齐图片/整理图片”且文档含图片。
 */
function pushMarkdownImageAlignPrompt() {
  displayMessages.value.push({
    id: createMessageId(),
    role: 'local',
    content: '文档中的图片需要自动对齐吗？',
    commandId: 'align-md-images',
    category: 'format',
    icon: 'info',
    localCommandSuccess: true,
    localCommandMode: 'image-align',
    localCommandPayload: {},
  })
}

/**
 * 推送 HTML 排版模板选择器消息。
 * 触发场景：
 *  - 用户输入“网页排版/HTML排版”手动指令
 *  - 焦点模式开启时文档含 htmlSource（pushHtmlFormatPrompt via store watch）
 *  - 点击顶部“换模板”按钮
 *
 * 要求：
 *  - 必须有活跃 editor 且 hasHtmlImport(editor) === true
 *  - 有默认偏好且 source !== 'manual' / 'change-template' 时自动应用并跳过弹窗
 *
 * @param {{ source?: 'a4-focus-mode'|'manual'|'change-template'|'paste'|'file' }} [opts]
 */
function pushHtmlFormatPrompt(opts = {}) {
  const editor = getActiveEditor()
  if (!editor) {
    toast.info('没有可用的编辑器')
    return
  }
  if (!hasHtmlImport(editor)) {
    toast.info('当前文档未含网页内容，无需 HTML 排版')
    return
  }

  const source = opts.source || 'manual'
  const meta = getHtmlImportMeta(editor) || {}

  // 默认偏好优先：source 为 a4-focus-mode / paste / file → 自动应用 → 零延迟
  if (source === 'a4-focus-mode' || source === 'paste' || source === 'file') {
    const pref = getDefaultHtmlTemplate()
    if (pref && pref.templateId) {
      const result = formatHtmlDocument(editor, pref.templateId)
      if (result.ok) {
        htmlFormatBarStore.show({
          templateId: result.templateId,
          templateLabel: result.templateLabel,
          formattedAt: Date.now(),
        })
        displayMessages.value.push({
          id: createMessageId(),
          role: 'local',
          content: result.message,
          commandId: 'format-html',
          category: 'format',
          icon: 'success',
          localCommandSuccess: true,
        })
        return
      }
      // 失败：降级为弹窗
    }
  }

  displayMessages.value.push({
    id: createMessageId(),
    role: 'local',
    content:
      source === 'manual' || source === 'change-template'
        ? '请选择排版模板：'
        : '检测到网页内容，是否按模板排版？',
    commandId: 'format-html',
    category: 'format',
    icon: 'info',
    localCommandSuccess: true,
    localCommandMode: 'html-format-selector',
    localCommandTemplates: getTemplateList(),
    localCommandPreview: meta.sourceUrl || '',
    localCommandShowKeepOriginal: true,
    localCommandWebpageMeta: meta,
    localCommandPayload: { source },
  })
}

/**
 * 读取 HTML 默认模板偏好。与 MD 偏好独立存储（需求：HTML 排版是独立选择）。
 * 若用户从未设置过 HTML 偏好，默认推荐 webpage-archive。
 */
function getDefaultHtmlTemplate() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem('wpx-html-format-preference')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.templateId === 'string') {
      return { templateId: parsed.templateId }
    }
  } catch {
    /* noop */
  }
  return null
}

function setDefaultHtmlTemplate(templateId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(
      'wpx-html-format-preference',
      JSON.stringify({ templateId, savedAt: Date.now(), version: 1 }),
    )
  } catch {
    /* noop */
  }
}

/**
 * 处理来自 AiChatWindow 的 LocalCommandMessage 交互事件。
 * AiChatWindow 会发出 { commandId, payload }，payload.kind 区分 template / imageAlign / dismiss。
 * @param {{ commandId: string, payload: { kind: string, [k: string]: any } }} event
 */
function handleLocalCommandSelect(event) {
  if (!event || typeof event !== 'object') return
  const { commandId } = event
  const payload = event.payload || {}
  const { kind } = payload
  const editor = getActiveEditor()
  if (!editor) return

  if (commandId === 'format-md' && kind === 'template') {
    const result = formatDocument(editor, payload.templateId)
    if (result?.ok) {
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result.message,
        commandId: 'format-md',
        category: 'format',
        icon: 'success',
        localCommandSuccess: true,
      })
      // 模板应用成功后：含图片 → 推入图片对齐提示；不含图片 → 推入偏好提示
      if (result.hasImages) {
        displayMessages.value.push({
          id: createMessageId(),
          role: 'local',
          content: '文档中的图片需要自动对齐吗？',
          commandId: 'align-md-images',
          category: 'format',
          icon: 'info',
          localCommandSuccess: true,
          localCommandMode: 'image-align',
          localCommandPayload: { templateId: payload.templateId },
        })
      } else {
        const tplLabel = result.templateLabel || getTemplateById(payload.templateId)?.label || ''
        displayMessages.value.push({
          id: createMessageId(),
          role: 'local',
          content: `以后是不是都按【${tplLabel}】排版？`,
          commandId: 'format-md',
          category: 'format',
          icon: 'info',
          localCommandSuccess: true,
          localCommandMode: 'preference',
          localCommandPayload: { key: 'template', data: { templateId: payload.templateId } },
        })
      }
    } else {
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result?.message || '⚠️ 排版失败',
        commandId: 'format-md',
        category: 'format',
        icon: 'warning',
        localCommandSuccess: false,
      })
    }
    return
  }

  if (commandId === 'align-md-images' && kind === 'imageAlign') {
    const result = alignImages(editor, payload.mode)
    if (result?.ok) {
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result.message,
        commandId: 'align-md-images',
        category: 'format',
        icon: 'success',
        localCommandSuccess: true,
      })
      // 图片对齐完成后：推入偏好提示
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: '以后是不是都按此方式对齐图片？',
        commandId: 'align-md-images',
        category: 'format',
        icon: 'info',
        localCommandSuccess: true,
        localCommandMode: 'preference',
        localCommandPayload: { key: 'imageAlign', data: { imageAlignMode: payload.mode } },
      })
    } else {
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result?.message || '⚠️ 图片对齐失败',
        commandId: 'align-md-images',
        category: 'format',
        icon: 'warning',
        localCommandSuccess: false,
      })
    }
    return
  }

  // preference 模式：确认/跳过
  if (kind === 'preference-confirm') {
    const data = payload?.data || {}
    const key = payload?.key
    if (key === 'template' && data.templateId) {
      setDefaultTemplate(data.templateId, null)
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: '✅ 已记住：以后自动按此模板排版',
        commandId: 'format-md',
        category: 'format',
        icon: 'success',
        localCommandSuccess: true,
      })
    } else if (key === 'imageAlign' && data.imageAlignMode) {
      const pref = getDefaultTemplate()
      if (pref) {
        setDefaultTemplate(pref.templateId, data.imageAlignMode)
      }
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: '✅ 已记住：以后自动按此方式对齐图片',
        commandId: 'align-md-images',
        category: 'format',
        icon: 'success',
        localCommandSuccess: true,
      })
    }
    return
  }
  // preference-skip / keep-original / dismiss：静默处理
  // format-html 命令分支：模板选择
  if (commandId === 'format-html' && kind === 'template') {
    const result = formatHtmlDocument(editor, payload.templateId)
    if (result?.ok) {
      // 显示恢复提示条
      htmlFormatBarStore.show({
        templateId: result.templateId,
        templateLabel: result.templateLabel,
        formattedAt: Date.now(),
      })
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result.message,
        commandId: 'format-html',
        category: 'format',
        icon: 'success',
        localCommandSuccess: true,
      })
      // 偏好询问
      const tplLabel = result.templateLabel || getTemplateById(payload.templateId)?.label || ''
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: `以后是不是都按【${tplLabel}】排版网页？`,
        commandId: 'format-html',
        category: 'format',
        icon: 'info',
        localCommandSuccess: true,
        localCommandMode: 'preference',
        localCommandPayload: { key: 'htmlTemplate', data: { templateId: payload.templateId } },
      })
    } else {
      displayMessages.value.push({
        id: createMessageId(),
        role: 'local',
        content: result?.message || '⚠️ 网页排版失败',
        commandId: 'format-html',
        category: 'format',
        icon: 'warning',
        localCommandSuccess: false,
      })
    }
    return
  }

  // format-html + keep-original：静默
  if (commandId === 'format-html' && kind === 'keep-original') {
    return
  }

  // format-html + preference-confirm: htmlTemplate
  if (kind === 'preference-confirm' && payload?.key === 'htmlTemplate' && payload?.data?.templateId) {
    setDefaultHtmlTemplate(payload.data.templateId)
    displayMessages.value.push({
      id: createMessageId(),
      role: 'local',
      content: '✅ 已记住：以后自动按此模板排版网页',
      commandId: 'format-html',
      category: 'format',
      icon: 'success',
      localCommandSuccess: true,
    })
    return
  }
}

async function handleSend(payload) {
  const text = typeof payload === 'string' ? payload : payload.text
  const references = typeof payload === 'string' ? [] : payload.references || []
  const activeSelection = editorStore.activeSelection
  const context = references.map((item) => ({
    filename: item.filename,
    content: item.content,
  }))

  // ── Step -1: 本地指令拦截层 ──
  // 在所有 AI 流程之前优先匹配确定性操作，毫秒级响应、零 Token 消耗、离线可用。
  const localResult = tryLocalCommand(text, activeSelection)
  if (localResult) {
    // 本地指令已处理：不需要走 AI 流程
    return
  }

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

/**
 * 接收来自 AiChatWindow 的 PPT 工作流最后一页插入请求，
 * 将幻灯片数据转发到 editorStore，EditorLayout 会监听并实际插入。
 * @param {{ slides: Array, theme?: 'light'|'dark', title?: string }} payload
 */
function handleInsertSlideDeck(payload) {
  if (!payload || !Array.isArray(payload.slides) || payload.slides.length === 0) return
  editorStore.requestSlideDeckInsert({
    slides: payload.slides,
    theme: payload.theme === 'dark' ? 'dark' : 'light',
    title: payload.title || '',
  })
}

function handleClose() {
  aiChat.close()
  editorStore.setChatInputActive(false)
}

function handlePinChange() {
  aiChat.togglePin()
}

/**
 * 处理来自 AiChatWindow 的 dock / undock 事件。
 * 通过 floatingWindows.dockWindow / undockWindow 同步 store 状态。
 */
function handleDockChange(nextDocked) {
  if (nextDocked) {
    floatingWindows.dockWindow(FLOATING_WINDOW_ID.AI_CHAT)
  } else {
    floatingWindows.undockWindow(FLOATING_WINDOW_ID.AI_CHAT)
  }
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

// 监听 MD 排版提示 Store：粘贴/拖拽/导入检测到 MD 时自动推入模板选择器
watch(
  () => formatPromptStore.pending,
  (pending) => {
    if (!pending) return
    pushMarkdownFormatPrompt({
      source: pending.source,
      previewText: pending.previewText,
      hasImages: pending.hasImages,
      token: pending.token,
    })
    formatPromptStore.clear()
  },
)

// 监听 HTML 排版提示 Store：进入 A4 模式且含 htmlSource 时自动推入模板选择器
watch(
  () => htmlPromptStore.pending,
  (pending) => {
    if (!pending) return
    pushHtmlFormatPrompt({
      source: pending.source,
      templateId: pending.templateId,
    })
    htmlPromptStore.clear()
  },
)

// 浮窗打开 / 选区变化时刷新可清洗统计
watch(
  () => aiChatWindowVisible.value,
  (visible) => {
    if (visible) scheduleCleanableScan(120)
  },
)
watch(
  () => editorStore.activeSelection,
  () => scheduleCleanableScan(800),
  { deep: true },
)

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
  <!--
    AiChatWindow 在两种模式下都由同一个组件提供内容。
    当 docked=true 时，Teleport 到 EditorLayout 提供的右栏容器 aiChatDockTarget 中。
    当 docked=false 时，Teleport disabled，正常以右下角浮窗渲染。
    同一个组件以单一事件总线提供所有用户交互。
  -->
  <Teleport
    v-if="aiChatDockTarget"
    :to="aiChatDockTarget"
    :disabled="!aiChatWindowDocked"
  >
    <AiChatWindow
      :visible="aiChatWindowVisible"
      :pinned="aiChatWindowPinned"
      :docked="aiChatWindowDocked"
      :z-index="aiChatWindowZIndex"
      :model-name="modelName"
      :messages="displayMessages"
      :selection-context="selectionPreview"
      :local-command-placeholders="localCommandPlaceholders"
      :cleanable-count="cleanableCount"
      :batch-progress="batchProgress"
      @send="handleSend"
      @close="handleClose"
      @pin-change="handlePinChange"
      @dock-change="handleDockChange"
      @focus="handleChatFocus"
      @input-focus="handleInputFocus"
      @input-blur="handleInputBlur"
      @onboarding-complete="handleOnboardingComplete"
      @regenerate="retrySkillCall"
      @insert-slide-deck="handleInsertSlideDeck"
      @local-command-select="handleLocalCommandSelect"
      @batch-clean="handleBatchClean"
      @batch-clean-abort="abortBatchClean"
      @batch-clean-undo="undoBatchClean"
    />
  </Teleport>
  <AiChatWindow
    v-else
    :visible="aiChatWindowVisible"
    :pinned="aiChatWindowPinned"
    :docked="aiChatWindowDocked"
    :z-index="aiChatWindowZIndex"
    :model-name="modelName"
    :messages="displayMessages"
    :selection-context="selectionPreview"
    :local-command-placeholders="localCommandPlaceholders"
    :cleanable-count="cleanableCount"
    :batch-progress="batchProgress"
    @send="handleSend"
    @close="handleClose"
    @pin-change="handlePinChange"
    @dock-change="handleDockChange"
    @focus="handleChatFocus"
    @input-focus="handleInputFocus"
    @input-blur="handleInputBlur"
    @onboarding-complete="handleOnboardingComplete"
    @regenerate="retrySkillCall"
    @insert-slide-deck="handleInsertSlideDeck"
    @local-command-select="handleLocalCommandSelect"
    @batch-clean="handleBatchClean"
    @batch-clean-abort="abortBatchClean"
    @batch-clean-undo="undoBatchClean"
  />

  <!--
    Avatar 在 docked 模式隐藏，让头像“收缩到导航”。
    点击 TitleBar 上的 docked-avatar 按钮可恢复为 floating 浮窗。
  -->
  <AiAvatar
    v-if="!aiChatWindowDocked"
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
