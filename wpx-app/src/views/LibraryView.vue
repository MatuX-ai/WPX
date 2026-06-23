<script setup>
import { ref } from 'vue'
import WikiBrowser from '@/components/library/WikiBrowser.vue'
import EditorCore from '@/components/editor/EditorCore.vue'
import { fetchLibraryDocument } from '@/utils/libraryApi'

const editorRef = ref(null)
const wikiRef = ref(null)
const activePath = ref('')
const activeTitle = ref('')
const loadingDoc = ref(false)
const openError = ref('')

async function handleOpenDocument(doc) {
  loadingDoc.value = true
  openError.value = ''
  activePath.value = doc.relativePath
  activeTitle.value = doc.title

  try {
    const data = await fetchLibraryDocument(doc.relativePath)
    editorRef.value?.loadMarkdown(data.content || '')
    activeTitle.value = data.title || doc.title
  } catch (err) {
    openError.value = err.message || '打开文档失败'
  } finally {
    loadingDoc.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-slate-900">智能文库</h1>
      <p class="mt-2 text-sm text-slate-500">
        浏览已保存文档，点击条目在下方编辑器中打开。
      </p>
      <p v-if="activeTitle" class="mt-2 text-sm text-brand-700">
        当前文档：{{ activeTitle }}
        <span v-if="loadingDoc" class="text-slate-400">（加载中…）</span>
      </p>
      <p v-if="openError" class="mt-2 text-sm text-red-600">{{ openError }}</p>
    </div>

    <WikiBrowser
      ref="wikiRef"
      :active-path="activePath"
      @open="handleOpenDocument"
    />

    <div class="mt-6">
      <h2 class="mb-3 text-sm font-semibold text-slate-700">文档预览 / 编辑</h2>
      <EditorCore ref="editorRef" />
    </div>
  </section>
</template>
