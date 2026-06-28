<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useAutoSave } from '@/composables/useAutoSave'
import EditorCore from '@/components/editor/EditorCore.vue'
import ExportMenu from '@/components/export/ExportMenu.vue'
import { extractTitleFromMarkdown } from '@/utils/libraryApi'

const appStore = useAppStore()
const editorRef = ref(null)
const editorOutput = ref({ html: '', json: null, markdown: '' })
const saveNotice = ref('')

const { scheduleAutoSave } = useAutoSave(() => ({
  content: getMarkdown(),
  title: getDefaultTitle(),
}))

function onEditorChange(payload) {
  editorOutput.value = payload
  appStore.setDocumentTitle(getDefaultTitle())
  scheduleAutoSave()
}

function getMarkdown() {
  return editorRef.value?.getMarkdown() || editorOutput.value.markdown || ''
}

/**
 * 导出/保存到文库专用：使用净化版 JSON（剥离 htmlSource 等内部 attrs）。
 * 注意：自动保存继续使用 getMarkdown()，因为 tiptapJsonToMarkdown 本身不会输出 doc.attrs。
 */
function getMarkdownForExport() {
  if (typeof editorRef.value?.getMarkdownForExport === 'function') {
    return editorRef.value.getMarkdownForExport()
  }
  return getMarkdown()
}

function getFormatSnapshot() {
  return editorRef.value?.getFormatSnapshot?.() || null
}

function getDefaultTitle() {
  return extractTitleFromMarkdown(getMarkdown())
}

function openSaveDialog() {
  saveNotice.value = ''
  appStore.openSaveDialog({
    content: getMarkdownForExport(),
    defaultTitle: getDefaultTitle(),
  })
}

function handleSaved(item) {
  saveNotice.value = `已保存到文库：${item.path}/${item.title}`
}

watch(
  () => appStore.lastSavedDocument,
  (item) => {
    if (item) handleSaved(item)
  },
)

function onGlobalKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    openSaveDialog()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">AI 智能文档编辑器</h1>
        <p class="mt-2 text-sm text-slate-500">
          所见即所得 Markdown 编辑器，支持工具栏操作与 Markdown 快捷键。按 Ctrl+S 保存到文库。
        </p>
        <p v-if="saveNotice" class="mt-2 text-sm text-brand-700">{{ saveNotice }}</p>
      </div>
      <ExportMenu
        :get-markdown="getMarkdownForExport"
        :get-format-snapshot="getFormatSnapshot"
        :get-editor="() => editorRef.value?.getEditor?.()"
        :get-document-title="getDefaultTitle"
        filename="document"
      />
    </div>

    <EditorCore ref="editorRef" @change="onEditorChange" />

    <details v-if="editorOutput.json" class="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <summary class="cursor-pointer text-sm font-medium text-slate-700">查看输出（HTML / JSON）</summary>
      <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{{
        JSON.stringify(editorOutput, null, 2)
      }}</pre>
    </details>
  </section>
</template>
