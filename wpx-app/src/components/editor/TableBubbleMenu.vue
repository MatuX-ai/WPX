<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { exportTableToXls } from '@/utils/exportTableToXls'

const props = defineProps({
  editor: {
    type: Object,
    required: true,
  },
})

const exportMenuOpen = ref(false)
const exportMenuRef = ref(null)
const exportError = ref('')

const rowColumnActions = [
  {
    key: 'addRowBefore',
    title: '上方插入行',
    label: '↑ 行',
    run: (ed) => ed.chain().focus().addRowBefore().run(),
    can: (ed) => ed.can().chain().focus().addRowBefore().run(),
  },
  {
    key: 'addRowAfter',
    title: '下方插入行',
    label: '↓ 行',
    run: (ed) => ed.chain().focus().addRowAfter().run(),
    can: (ed) => ed.can().chain().focus().addRowAfter().run(),
  },
  {
    key: 'addColumnBefore',
    title: '左侧插入列',
    label: '← 列',
    run: (ed) => ed.chain().focus().addColumnBefore().run(),
    can: (ed) => ed.can().chain().focus().addColumnBefore().run(),
  },
  {
    key: 'addColumnAfter',
    title: '右侧插入列',
    label: '→ 列',
    run: (ed) => ed.chain().focus().addColumnAfter().run(),
    can: (ed) => ed.can().chain().focus().addColumnAfter().run(),
  },
]

const cellActions = [
  {
    key: 'mergeCells',
    title: '合并单元格',
    label: '合并',
    run: (ed) => ed.chain().focus().mergeCells().run(),
    can: (ed) => ed.can().chain().focus().mergeCells().run(),
  },
  {
    key: 'splitCell',
    title: '拆分单元格',
    label: '拆分',
    run: (ed) => ed.chain().focus().splitCell().run(),
    can: (ed) => ed.can().chain().focus().splitCell().run(),
  },
]

function shouldShow({ editor: ed }) {
  return ed.isActive('table')
}

function runAction(action) {
  exportMenuOpen.value = false
  exportError.value = ''
  action.run(props.editor)
}

function deleteTable() {
  exportMenuOpen.value = false
  exportError.value = ''
  props.editor.chain().focus().deleteTable().run()
}

function toggleExportMenu(event) {
  event.stopPropagation()
  exportMenuOpen.value = !exportMenuOpen.value
  exportError.value = ''
}

function handleExportXls() {
  exportMenuOpen.value = false
  exportError.value = ''
  try {
    exportTableToXls(props.editor)
  } catch (error) {
    exportError.value = error?.message || '导出失败'
  }
}

function handleClickOutside(event) {
  if (exportMenuRef.value && !exportMenuRef.value.contains(event.target)) {
    exportMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <BubbleMenu
    v-if="editor"
    :editor="editor"
    :should-show="shouldShow"
    :options="{ placement: 'top' }"
  >
    <div class="flex flex-col gap-1">
      <div
        class="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-lg"
      >
        <button
          v-for="action in rowColumnActions"
          :key="action.key"
          type="button"
          :title="action.title"
          :disabled="!action.can(editor)"
          class="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          @click="runAction(action)"
        >
          {{ action.label }}
        </button>

        <span class="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          v-for="action in cellActions"
          :key="action.key"
          type="button"
          :title="action.title"
          :disabled="!action.can(editor)"
          class="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          @click="runAction(action)"
        >
          {{ action.label }}
        </button>

        <span class="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />

        <div ref="exportMenuRef" class="relative">
          <button
            type="button"
            title="导出表格"
            class="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            @click="toggleExportMenu"
          >
            导出
            <svg class="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <div
            v-if="exportMenuOpen"
            class="absolute bottom-full left-0 z-10 mb-1 min-w-[7rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          >
            <button
              type="button"
              class="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              @click="handleExportXls"
            >
              导出 XLS
            </button>
          </div>
        </div>

        <span class="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          title="删除表格"
          class="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
          @click="deleteTable"
        >
          删除表格
        </button>
      </div>
      <p v-if="exportError" class="text-xs text-red-600">{{ exportError }}</p>
    </div>
  </BubbleMenu>
</template>
