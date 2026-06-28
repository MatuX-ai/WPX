<script setup>
/**
 * WPX HTML 源码编辑器组件
 *
 * 职责：
 *  1. 承载 CodeMirror 6 实例，渲染用户导入的 HTML 源码
 *  2. 通过 useHtmlSourceEditor composable 维护双向同步（CodeMirror ↔ Tiptap）
 *  3. 顶部展示标题 + 关闭按钮，点击关闭触发 htmlSourcePanelStore.hide()
 *  4. 销毁时清理 EditorView、事件监听、Tiptap 反向同步
 *
 * 数据流：
 *   CodeMirror 改源码 → debounce 300ms → editor.commands.updateHtmlSource + setContent
 *   Tiptap 反向更新 → CodeMirror dispatch（带 syncDirection 标志防循环）
 *
 * Props：
 *   - editor: Tiptap editor 实例（必填）
 *   - initialHtml: 初始源码（可选，默认从 doc.attrs.htmlSource 读取）
 *
 * Emits：
 *   - close: 关闭面板事件（可选）
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X, AlertTriangle } from '@lucide/vue'
import { useHtmlSourcePanelStore } from '@/stores/htmlSourcePanel'
import { useHtmlSourceEditor } from '@/composables/useHtmlSourceEditor'
import { hasHtmlImport } from '@/composables/useHtmlImporter'

/** 大文件阈值：超过该字符数的源码同步会提示性能风险 */
const LARGE_SOURCE_THRESHOLD = 200 * 1024 // 200KB

const props = defineProps({
  editor: {
    type: Object,
    default: null,
  },
  initialHtml: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close'])

const panelStore = useHtmlSourcePanelStore()

const mountRef = ref(null)
const fallbackRef = ref(null)
const fallbackValue = ref('')
const editorCtl = useHtmlSourceEditor({
  getEditor: () => props.editor,
  debounceMs: 300,
  onError: (err) => {
    console.error('[HtmlSourceEditor] CodeMirror 错误：', err)
    errorMessage.value = err?.message || '未知错误'
    fallbackMode.value = true
  },
})

const errorMessage = ref('')
const fallbackMode = ref(false)
const showLargeFileWarning = computed(
  () => (props.initialHtml?.length || 0) > LARGE_SOURCE_THRESHOLD,
)

const isReady = computed(() => !fallbackMode.value && editorCtl.getView() !== null)
const showEmptyState = computed(
  () => props.editor && !hasHtmlImport(props.editor) && !props.initialHtml,
)

/**
 * 关闭面板
 */
function handleClose() {
  panelStore.hide()
  emit('close')
}

/**
 * 降级模式下的 textarea 防抖同步
 */
let fallbackTimer = null
function onFallbackInput(event) {
  fallbackValue.value = event.target.value
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = setTimeout(() => {
    const editor = props.editor
    if (!editor) return
    try {
      if (typeof editor.commands?.updateHtmlSource === 'function') {
        editor.commands.updateHtmlSource(fallbackValue.value)
      }
      editor.commands.setContent(fallbackValue.value, { emitUpdate: false })
    } catch (err) {
      console.error('[HtmlSourceEditor] 降级同步失败：', err)
    }
  }, 300)
}

onMounted(() => {
  // 初始 HTML：优先用 props.initialHtml，否则读 doc.attrs.htmlSource
  let initialSource = props.initialHtml || ''
  if (!initialSource && props.editor?.state?.doc?.attrs?.htmlSource) {
    initialSource = props.editor.state.doc.attrs.htmlSource
  }
  fallbackValue.value = initialSource
  try {
    const result = editorCtl.mount(mountRef.value, initialSource)
    if (!result?.ready) {
      fallbackMode.value = true
      errorMessage.value = 'CodeMirror 未能初始化'
    }
  } catch (err) {
    console.error('[HtmlSourceEditor] mount 失败，降级到 textarea：', err)
    errorMessage.value = err?.message || '初始化失败'
    fallbackMode.value = true
  }
})

/**
 * 当外部 initialHtml 变化时（例如切换文档）主动更新 CodeMirror 内容。
 */
watch(
  () => props.initialHtml,
  (next) => {
    if (typeof next === 'string') {
      fallbackValue.value = next
      if (!fallbackMode.value) {
        editorCtl.updateContent(next)
      }
    }
  },
)

/**
 * 监听 Tiptap editor 实例变化：切换文档或重新挂载时重新绑定反向同步。
 */
watch(
  () => props.editor,
  () => {
    if (isReady.value) {
      editorCtl.rebindTiptap()
    }
  },
)

onBeforeUnmount(() => {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
  editorCtl.destroy()
})
</script>

<template>
  <div
    class="html-source-editor editor-layout__source-panel"
    data-testid="html-source-editor"
  >
    <div class="html-source-editor__header">
      <div class="html-source-editor__title">
        <span class="html-source-editor__title-icon" aria-hidden="true">&lt;/&gt;</span>
        <span>HTML 源码</span>
        <span class="html-source-editor__hint">编辑后右侧自动同步</span>
      </div>
      <button
        type="button"
        class="html-source-editor__close"
        title="关闭源码面板"
        aria-label="关闭源码面板"
        data-testid="html-source-editor-close"
        @click="handleClose"
      >
        <X :size="14" aria-hidden="true" />
        <span>关闭</span>
      </button>
    </div>

    <div
      v-if="showLargeFileWarning"
      class="html-source-editor__warning"
      role="status"
      data-testid="html-source-editor-large-warning"
    >
      <AlertTriangle :size="14" aria-hidden="true" />
      <span>大文件源码编辑可能影响性能，建议在编辑器顶部排版后重导。</span>
    </div>

    <div
      v-show="!showEmptyState"
      ref="mountRef"
      class="html-source-editor__mount"
      data-testid="html-source-editor-mount"
    />

    <textarea
      v-if="fallbackMode && !showEmptyState"
      ref="fallbackRef"
      class="html-source-editor__fallback"
      data-testid="html-source-editor-fallback"
      :value="fallbackValue"
      spellcheck="false"
      aria-label="HTML 源码（降级模式）"
      @input="onFallbackInput"
    />

    <div
      v-if="fallbackMode && !showEmptyState"
      class="html-source-editor__error"
      role="alert"
      data-testid="html-source-editor-error"
    >
      <AlertTriangle :size="14" aria-hidden="true" />
      <span>代码高亮初始化失败，已降级为纯文本编辑器（{{ errorMessage || '未知原因' }}）。</span>
    </div>

    <div v-if="showEmptyState" class="html-source-editor__empty">
      当前文档未导入 HTML，无法编辑源码
    </div>
  </div>
</template>

<style scoped>
/* 局部样式覆盖：CodeMirror 主题在 useHtmlSourceEditor.js 内置定义 */
</style>
