<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  anchorX: {
    type: Number,
    default: 0,
  },
  anchorY: {
    type: Number,
    default: 0,
  },
  editor: {
    type: Object,
    default: null,
  },
  hasSelection: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'insert-table', 'insert-image', 'ai-rewrite', 'lesson-to-ppt'])

const themeStore = useThemeStore()
const menuRef = ref(null)
const isPositioned = ref(false)

const isDark = computed(() => themeStore.isDark)

function close() {
  emit('close')
}

function getSelectedText() {
  const ed = props.editor
  if (!ed) return ''
  const { from, to } = ed.state.selection
  if (from === to) return ''
  return ed.state.doc.textBetween(from, to, '\n')
}

async function handleCut() {
  const ed = props.editor
  const text = getSelectedText()
  if (!ed || !text) return

  try {
    await navigator.clipboard.writeText(text)
    ed.chain().focus().deleteSelection().run()
  } catch {
    document.execCommand('cut')
  }
  close()
}

async function handleCopy() {
  const text = getSelectedText()
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    document.execCommand('copy')
  }
  close()
}

async function handlePaste() {
  const ed = props.editor
  if (!ed) return

  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      ed.chain().focus().insertContent(text).run()
    }
  } catch {
    document.execCommand('paste')
  }
  close()
}

function handleSelectAll() {
  props.editor?.chain().focus().selectAll().run()
  close()
}

function handleAiRewrite() {
  emit('ai-rewrite')
  close()
}

function handleInsertTable() {
  emit('insert-table')
  close()
}

function handleInsertImage() {
  emit('insert-image')
  close()
}

function handleInsertSlideDeck() {
  const ed = props.editor
  if (!ed) return
  ed.chain().focus().insertSlideDeck().run()
  close()
}

function handleLessonToPpt() {
  emit('lesson-to-ppt')
  close()
}

const menuItems = computed(() => {
  const items = [
    { key: 'cut', label: '剪切', disabled: !props.hasSelection, action: handleCut },
    { key: 'copy', label: '复制', disabled: !props.hasSelection, action: handleCopy },
    { key: 'paste', label: '粘贴', disabled: false, action: handlePaste },
    { key: 'selectAll', label: '全选', disabled: false, action: handleSelectAll },
    { key: 'divider-1', type: 'divider' },
  ]

  if (props.hasSelection) {
    items.push({
      key: 'ai-rewrite',
      label: '用AI改写选中内容',
      disabled: false,
      action: handleAiRewrite,
      accent: true,
    })
  }

  items.push(
    { key: 'insert-table', label: '插入表格', disabled: false, action: handleInsertTable },
    { key: 'insert-image', label: '插入图片', disabled: false, action: handleInsertImage },
    { key: 'insert-slide-deck', label: '插入演示文稿', disabled: false, action: handleInsertSlideDeck },
  )

  // 教师专用：把当前文档生成课件（教案 → PPT 课件）
  items.push({ key: 'divider-2', type: 'divider' })
  items.push({
    key: 'lesson-to-ppt',
    label: '把这篇教案生成课件',
    disabled: false,
    action: handleLessonToPpt,
    accent: true,
  })

  return items
})

function createVirtualAnchor() {
  const x = props.anchorX
  const y = props.anchorY

  return {
    getBoundingClientRect() {
      return {
        width: 0,
        height: 0,
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
      }
    },
  }
}

async function updatePosition() {
  const menuEl = menuRef.value
  if (!menuEl || !props.open) return

  const { x, y } = await computePosition(createVirtualAnchor(), menuEl, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
    ],
  })

  menuEl.style.left = `${x}px`
  menuEl.style.top = `${y}px`
  isPositioned.value = true
}

function handleDocumentPointerDown(event) {
  if (!props.open) return
  if (menuRef.value?.contains(event.target)) return
  close()
}

function handleDocumentKeydown(event) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

watch(
  () => [props.open, props.anchorX, props.anchorY],
  ([open]) => {
    if (open) {
      isPositioned.value = false
      nextTick(updatePosition)
      return
    }
    isPositioned.value = false
  },
)

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuRef"
      class="editor-context-menu"
      :class="{
        'editor-context-menu--dark': isDark,
        'editor-context-menu--ready': isPositioned,
      }"
      :style="{ left: `${anchorX}px`, top: `${anchorY}px` }"
      role="menu"
      aria-label="编辑器上下文菜单"
      @contextmenu.prevent
    >
      <template v-for="item in menuItems" :key="item.key">
        <div
          v-if="item.type === 'divider'"
          class="editor-context-menu__divider"
          role="separator"
        />
        <button
          v-else
          type="button"
          class="editor-context-menu__item"
          :class="{ 'editor-context-menu__item--accent': item.accent }"
          role="menuitem"
          :disabled="item.disabled"
          @click="item.action"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.editor-context-menu {
  position: fixed;
  z-index: 10050;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #ffffff);
  color: var(--theme-fg, #1a1a1a);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  opacity: 0;
  pointer-events: none;
}

.editor-context-menu--ready {
  opacity: 1;
  pointer-events: auto;
}

.editor-context-menu--dark {
  border-color: var(--theme-border, #404040);
  background: var(--theme-surface, #252525);
  color: var(--theme-fg, #e0e0e0);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.55));
}

.editor-context-menu__item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  font-size: 13px;
  line-height: 1.4;
  color: inherit;
  cursor: pointer;
  transition: background 0.12s ease;
}

.editor-context-menu__item:hover:not(:disabled) {
  background: var(--theme-bg-muted, #f1f5f9);
}

.editor-context-menu--dark .editor-context-menu__item:hover:not(:disabled) {
  background: var(--theme-bg-muted, #2d2d2d);
}

.editor-context-menu__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.editor-context-menu__item--accent {
  color: var(--theme-accent, #2563eb);
  font-weight: 500;
}

.editor-context-menu__divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--theme-border, #e2e8f0);
}
</style>
