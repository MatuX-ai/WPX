<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { Archive } from '@lucide/vue'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { getDocPathFromUrl } from '@/utils/windowContext'

const props = defineProps({
  getMarkdown: {
    type: Function,
    required: true,
  },
  getDocumentPath: {
    type: Function,
    default: null,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['pack'])

const toast = useToast()
const appStore = useAppStore()

const PACK_OPTIONS = [
  { key: '7z', label: '打包当前文档为 .7z', format: '7z' },
  { key: 'zip', label: '打包当前文档为 .zip', format: 'zip' },
]

const menuRef = ref(null)
const isOpen = ref(false)

function resolveDocumentPath() {
  if (typeof props.getDocumentPath === 'function') {
    return props.getDocumentPath() || ''
  }
  return appStore.documentSourcePath || getDocPathFromUrl()
}

function toggleMenu(event) {
  event.stopPropagation()
  if (props.loading) return
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    closeMenu()
  }
}

function handlePack(option) {
  closeMenu()

  const markdown = props.getMarkdown()
  if (!markdown?.trim()) {
    toast.warning('文档内容为空，无法打包')
    return
  }

  const documentPath = resolveDocumentPath()
  if (!documentPath) {
    toast.warning('请先保存文档到本地路径后再打包')
    return
  }

  emit('pack', {
    documentPath,
    markdown,
    format: option.format,
  })
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="menuRef" class="relative inline-block text-left">
    <button
      type="button"
      class="wpx-btn inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      :class="iconOnly ? 'p-1.5' : 'px-3 py-1.5'"
      :disabled="loading"
      :title="iconOnly ? (loading ? '打包中…' : '打包') : '打包当前文档'"
      :aria-label="loading ? '打包中' : '打包当前文档'"
      :aria-expanded="isOpen"
      @click="toggleMenu"
    >
      <svg
        v-if="loading"
        class="h-4 w-4 animate-spin text-brand-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <template v-else-if="iconOnly">
        <Archive :size="16" aria-hidden="true" />
      </template>
      <template v-else>
        <span>{{ loading ? '打包中…' : '打包' }}</span>
        <svg
          class="h-4 w-4 text-slate-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </template>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 z-50 mt-1 w-56 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      role="menu"
    >
      <button
        v-for="option in PACK_OPTIONS"
        :key="option.key"
        type="button"
        class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        role="menuitem"
        @click="handlePack(option)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
