<script setup>
import { ref } from 'vue'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { blobToDataUrl, srcToBlob } from '@/utils/imageUtils'
import { removeImageBackground } from '@/utils/removeBackground'
import { shortcutTooltip } from '@/composables/useGlobalShortcuts'
import { useOnlineStatus } from '@/composables/useOnlineStatus'

const props = defineProps({
  editor: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['edit-image'])

const editImageTitle = shortcutTooltip('编辑图片', 'openImageEditor')
const { isOffline, networkRequiredTooltip } = useOnlineStatus()

const isRemovingBg = ref(false)
const actionError = ref('')

function shouldShow({ editor: ed }) {
  return ed.isActive('image')
}

function clearError() {
  actionError.value = ''
}

function handleEditImage() {
  clearError()
  emit('edit-image')
}

function setFloat(floatValue) {
  clearError()
  props.editor.chain().focus().updateAttributes('image', { float: floatValue }).run()
}

async function handleRemoveBg() {
  if (isOffline.value || isRemovingBg.value) return

  const src = props.editor.getAttributes('image').src
  if (!src) return

  isRemovingBg.value = true
  actionError.value = ''

  try {
    const inputBlob = await srcToBlob(src)
    const resultBlob = await removeImageBackground(inputBlob)
    const dataUrl = await blobToDataUrl(resultBlob)
    props.editor.chain().focus().updateAttributes('image', { src: dataUrl }).run()
  } catch (error) {
    actionError.value = error?.message || '去背景失败'
  } finally {
    isRemovingBg.value = false
  }
}
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
          type="button"
          :title="editImageTitle"
          :aria-label="editImageTitle"
          class="rounded px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          @click="handleEditImage"
        >
          编辑图片
        </button>

        <button
          type="button"
          :title="isOffline ? networkRequiredTooltip : 'AI 去除背景'"
          :aria-label="isOffline ? networkRequiredTooltip : 'AI 去除背景'"
          :disabled="isRemovingBg || isOffline"
          class="rounded px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleRemoveBg"
        >
          {{ isRemovingBg ? '处理中...' : 'AI去背景' }}
        </button>

        <span class="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          title="左环绕：图片在左，文字在右环绕"
          aria-label="左环绕"
          class="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          :class="editor.isActive('image', { float: 'left' }) ? 'bg-brand-50 text-brand-700' : ''"
          @click="setFloat('left')"
        >
          🡄 左环绕
        </button>
        <button
          type="button"
          title="右环绕：图片在右，文字在左环绕"
          aria-label="右环绕"
          class="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          :class="editor.isActive('image', { float: 'right' }) ? 'bg-brand-50 text-brand-700' : ''"
          @click="setFloat('right')"
        >
          🡆 右环绕
        </button>
        <button
          type="button"
          title="独占行：图片独占一行，不环绕"
          aria-label="独占行"
          class="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          :class="editor.isActive('image', { float: 'none' }) ? 'bg-brand-50 text-brand-700' : ''"
          @click="setFloat('none')"
        >
          ⬍ 独占行
        </button>
      </div>
      <p v-if="actionError" class="text-xs text-red-600">{{ actionError }}</p>
    </div>
  </BubbleMenu>
</template>
