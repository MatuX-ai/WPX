<script setup>
/**
 * ListBubbleMenu：列表气泡菜单
 *
 * 功能：
 *   - 切换无序 / 有序列表
 *   - 切换编号样式（数字 / 字母 / 罗马 / 希腊）
 *   - 切换无序符号（实心圆 / 空心圆 / 方块 / 无）
 *   - 用 emoji 作行首符号（24 个预设）
 *   - 设置 ol 起始编号
 *   - 清除全部自定义样式
 *
 * 显示条件：光标位于 bulletList / orderedList / listItem 节点内。
 */
import { computed, ref } from 'vue'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import {
  ORDERED_STYLES,
  UNORDERED_STYLES,
  EMOJI_GLYPHS,
  emojiToImageUrl,
} from '@/extensions/CustomList'

const props = defineProps({
  editor: {
    type: Object,
    default: null,
  },
})

const orderedTabOpen = ref(false)
const unorderedTabOpen = ref(false)
const emojiTabOpen = ref(false)
const startInput = ref('')

function shouldShow({ editor: ed }) {
  if (!ed) return false
  // 兼容两种情况：
  // 1. 光标直接在 bulletList/orderedList 节点内（isActive 检测）
  // 2. 光标在 listItem 内（Tiptap StarterKit 的 isActive 对 listItem 也返回 true）
  return (
    ed.isActive('bulletList') ||
    ed.isActive('orderedList') ||
    ed.isActive('listItem')
  )
}

const activeListType = computed(() => {
  if (!props.editor) return null
  if (props.editor.isActive('orderedList')) return 'orderedList'
  if (props.editor.isActive('bulletList')) return 'bulletList'
  return null
})

const currentStyleType = computed(() => {
  if (!props.editor) return null
  return (
    props.editor.getAttributes('bulletList').listStyleType ||
    props.editor.getAttributes('orderedList').listStyleType ||
    null
  )
})

const currentStyleImage = computed(() => {
  if (!props.editor) return null
  return (
    props.editor.getAttributes('bulletList').listStyleImage ||
    props.editor.getAttributes('orderedList').listStyleImage ||
    null
  )
})

const currentStart = computed(() => {
  if (!props.editor) return null
  // orderedList 使用 starterKit 内置的 start 属性（不是 listStart）
  const v = props.editor.getAttributes('orderedList').start
  return v == null || v === 1 ? null : Number(v)
})

function toggleList(type) {
  if (!props.editor) return
  if (type === 'orderedList') {
    props.editor.chain().focus().toggleOrderedList().run()
  } else {
    props.editor.chain().focus().toggleBulletList().run()
  }
  closeAllTabs()
}

function applyOrderedStyle(style) {
  props.editor?.chain().focus().setListStyleType(style).run()
  orderedTabOpen.value = false
}

function applyUnorderedStyle(style) {
  props.editor?.chain().focus().setListStyleType(style).run()
  unorderedTabOpen.value = false
}

function applyEmoji(glyph) {
  props.editor?.chain().focus().setListIcon(glyph).run()
  emojiTabOpen.value = false
}

function applyStart() {
  const n = Number(startInput.value)
  if (!Number.isFinite(n) || n < 1) {
    props.editor?.chain().focus().setListStart(null).run()
    return
  }
  props.editor?.chain().focus().setListStart(Math.floor(n)).run()
}

function clearAll() {
  props.editor?.chain().focus().unsetListStyle().run()
  closeAllTabs()
}

function closeAllTabs() {
  orderedTabOpen.value = false
  unorderedTabOpen.value = false
  emojiTabOpen.value = false
}

function stopProp(event) {
  event.stopPropagation()
}
</script>

<template>
  <BubbleMenu
    v-if="editor"
    :editor="editor"
    :should-show="shouldShow"
    :options="{ placement: 'top' }"
  >
    <div
      class="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface px-1 py-1 shadow-lg"
      @mousedown="stopProp"
    >
      <!-- 列表类型切换 -->
      <button
        type="button"
        title="无序列表"
        :class="[
          'rounded px-2 py-1 text-xs font-medium transition',
          activeListType === 'bulletList'
            ? 'bg-accent text-white'
            : 'text-fg-muted hover:bg-bg-muted hover:text-fg',
        ]"
        @click="toggleList('bulletList')"
      >
        ● 列表
      </button>
      <button
        type="button"
        title="有序列表"
        :class="[
          'rounded px-2 py-1 text-xs font-medium transition',
          activeListType === 'orderedList'
            ? 'bg-accent text-white'
            : 'text-fg-muted hover:bg-bg-muted hover:text-fg',
        ]"
        @click="toggleList('orderedList')"
      >
        1. 列表
      </button>

      <span class="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

      <!-- 编号样式下拉 -->
      <div class="relative">
        <button
          type="button"
          title="编号样式"
          class="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          @click="orderedTabOpen = !orderedTabOpen; unorderedTabOpen = false; emojiTabOpen = false"
        >
          编号
          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <div
          v-if="orderedTabOpen"
          class="absolute bottom-full left-0 z-10 mb-1 min-w-[10rem] rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <button
            v-for="s in ORDERED_STYLES"
            :key="s.value"
            type="button"
            :class="[
              'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition hover:bg-bg-muted',
              currentStyleType === s.value ? 'bg-bg-muted text-fg' : 'text-fg-muted',
            ]"
            @click="applyOrderedStyle(s.value)"
          >
            <span>{{ s.label }}</span>
            <span class="ml-3 font-mono text-fg-subtle">{{ s.sample }}</span>
          </button>
        </div>
      </div>

      <!-- 无序符号下拉 -->
      <div class="relative">
        <button
          type="button"
          title="无序符号"
          class="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          @click="unorderedTabOpen = !unorderedTabOpen; orderedTabOpen = false; emojiTabOpen = false"
        >
          符号
          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <div
          v-if="unorderedTabOpen"
          class="absolute bottom-full left-0 z-10 mb-1 min-w-[8rem] rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <button
            v-for="s in UNORDERED_STYLES"
            :key="s.value"
            type="button"
            :class="[
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-bg-muted',
              currentStyleType === s.value ? 'bg-bg-muted text-fg' : 'text-fg-muted',
            ]"
            @click="applyUnorderedStyle(s.value)"
          >
            <span class="font-mono">{{ s.sample }}</span>
            <span>{{ s.label }}</span>
          </button>
        </div>
      </div>

      <!-- emoji 行首符号 -->
      <div class="relative">
        <button
          type="button"
          title="emoji 行首符号"
          class="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          @click="emojiTabOpen = !emojiTabOpen; orderedTabOpen = false; unorderedTabOpen = false"
        >
          表情
          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <div
          v-if="emojiTabOpen"
          class="absolute bottom-full left-0 z-10 mb-1 w-[12rem] rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          <div class="grid grid-cols-6 gap-1">
            <button
              v-for="g in EMOJI_GLYPHS"
              :key="g"
              type="button"
              :title="`使用 ${g} 作为行首符号`"
              :class="[
                'flex h-7 w-7 items-center justify-center rounded text-base transition hover:bg-bg-muted',
                currentStyleImage === emojiToImageUrl(g) ? 'bg-bg-muted' : '',
              ]"
              @click="applyEmoji(g)"
            >
              {{ g }}
            </button>
          </div>
        </div>
      </div>

      <span class="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

      <!-- 起始编号 -->
      <div class="flex items-center gap-1 px-1">
        <span class="text-xs text-fg-subtle">起始</span>
        <input
          v-model="startInput"
          type="number"
          min="1"
          placeholder="1"
          class="w-12 rounded border border-border bg-surface px-1 py-0.5 text-xs text-fg focus:border-accent focus:outline-none"
          @change="applyStart"
        />
      </div>

      <span class="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

      <button
        type="button"
        title="清除自定义样式"
        class="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
        @click="clearAll"
      >
        清除
      </button>
    </div>
  </BubbleMenu>
</template>
