<script setup>
/**
 * <SlideDeckNodeView> - Tiptap NodeView
 *
 * 由 SlideDeckNode 扩展通过 VueNodeViewRenderer 创建。
 *
 * 职责：
 *   - 渲染 SlideDeck 组件（v-model:currentIndex 受控翻页）
 *   - 选中时（selected=true）显示浮动工具栏：
 *       翻页（prev/next） / 全屏 / 导出 / 复制 / 删除
 *   - 选中时高亮节点轮廓
 *   - 不在 NodeView 内部管理键盘翻页（避免与编辑器全局快捷键冲突）
 *
 * Props 来自 @tiptap/vue-3 的 NodeViewProps：
 *   - node: 当前 ProseMirror 节点
 *   - updateAttributes(attrs): 写入节点属性
 *   - selected: 节点是否被选中
 *   - editor: 编辑器实例
 *   - getPos(): 返回节点在文档中的位置
 *   - deleteNode(): 删除当前节点
 */
import { computed, ref } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Maximize2,
  Trash2,
  X,
} from '@lucide/vue'
import { useToast } from '@/composables/useToast'
import SlideDeck from '@/components/slides/SlideDeck.vue'

const props = defineProps({
  node: { type: Object, required: true },
  updateAttributes: { type: Function, required: true },
  selected: { type: Boolean, default: false },
  editor: { type: Object, required: true },
  getPos: { type: Function, required: true },
  deleteNode: { type: Function, required: true },
})

const toast = useToast()

/* ───────── 数据解析 ───────── */
const slides = computed(() => {
  const raw = props.node.attrs.slides
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

const theme = computed(() => props.node.attrs.theme || 'light')

const totalPages = computed(() => slides.value.length)

/* ───────── 翻页（受控） ───────── */
const currentIndex = ref(0)
const canPrev = computed(() => currentIndex.value > 0)
const canNext = computed(() => currentIndex.value < totalPages.value - 1)

function handlePageChange(idx) {
  // SlideDeck 通过 v-model:currentIndex 触发；这里只更新本地状态
  if (typeof idx === 'number' && idx >= 0 && idx < totalPages.value) {
    currentIndex.value = idx
  }
}

function prev() {
  if (canPrev.value) currentIndex.value -= 1
}

function next() {
  if (canNext.value) currentIndex.value += 1
}

/* ───────── 工具栏：全屏 / 复制 / 删除 / 导出 ───────── */
const nodeContainer = ref(null)
const isFullscreen = ref(false)

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await nodeContainer.value?.requestFullscreen?.()
    } else {
      await document.exitFullscreen?.()
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SlideDeckNodeView] 全屏切换失败：', err)
    toast.error('全屏切换失败')
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function handleCopy() {
  const ok = props.editor.commands.duplicateSlideDeck?.()
  if (ok) {
    toast.success('已复制幻灯片节点')
  } else {
    toast.error('复制失败：未选中节点')
  }
}

function handleDelete() {
  props.deleteNode()
  toast.success('已删除幻灯片节点')
}

function handleExport() {
  try {
    const data = {
      version: 1,
      type: 'slide-deck',
      theme,
      slides: slides.value,
      exportedAt: new Date().toISOString(),
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `slide-deck-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('已导出幻灯片 JSON')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SlideDeckNodeView] 导出失败：', err)
    toast.error('导出失败')
  }
}

/* ───────── 生命周期：监听全屏变化 ───────── */
import { onBeforeUnmount, onMounted } from 'vue'

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <NodeViewWrapper
    ref="nodeContainer"
    as="div"
    class="slide-deck-node"
    :class="{ 'slide-deck-node--selected': selected, 'slide-deck-node--fullscreen': isFullscreen }"
    :data-drag-handle="true"
    :data-type="'slide-deck-nodeview'"
  >
    <!-- 选中时浮动的工具栏 -->
    <div
      v-if="selected"
      class="slide-deck-node__toolbar"
      role="toolbar"
      aria-label="幻灯片节点工具栏"
      @mousedown.stop
      @click.stop
    >
      <button
        type="button"
        class="slide-deck-node__btn"
        :disabled="!canPrev"
        title="上一页（v-model 翻页）"
        aria-label="上一页"
        @click="prev"
      >
        <ChevronLeft :size="14" aria-hidden="true" />
      </button>
      <span class="slide-deck-node__page" aria-live="polite">
        {{ currentIndex + 1 }} / {{ totalPages }}
      </span>
      <button
        type="button"
        class="slide-deck-node__btn"
        :disabled="!canNext"
        title="下一页（v-model 翻页）"
        aria-label="下一页"
        @click="next"
      >
        <ChevronRight :size="14" aria-hidden="true" />
      </button>

      <span class="slide-deck-node__divider" aria-hidden="true" />

      <button
        type="button"
        class="slide-deck-node__btn"
        :title="isFullscreen ? '退出全屏' : '全屏演示'"
        :aria-label="isFullscreen ? '退出全屏' : '全屏演示'"
        @click="toggleFullscreen"
      >
        <Maximize2 v-if="!isFullscreen" :size="14" aria-hidden="true" />
        <X v-else :size="14" aria-hidden="true" />
        <span class="slide-deck-node__btn-label">{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
      </button>

      <button
        type="button"
        class="slide-deck-node__btn"
        title="导出为 JSON"
        aria-label="导出为 JSON"
        @click="handleExport"
      >
        <Download :size="14" aria-hidden="true" />
        <span class="slide-deck-node__btn-label">导出</span>
      </button>

      <span class="slide-deck-node__divider" aria-hidden="true" />

      <button
        type="button"
        class="slide-deck-node__btn"
        title="复制节点（Ctrl/Cmd+D）"
        aria-label="复制节点"
        @click="handleCopy"
      >
        <Copy :size="14" aria-hidden="true" />
      </button>

      <button
        type="button"
        class="slide-deck-node__btn slide-deck-node__btn--danger"
        title="删除节点（Backspace）"
        aria-label="删除节点"
        @click="handleDelete"
      >
        <Trash2 :size="14" aria-hidden="true" />
      </button>
    </div>

    <!-- 真正的 SlideDeck 组件（受控模式） -->
    <div class="slide-deck-node__deck" :data-theme="theme">
      <SlideDeck
        v-if="totalPages > 0"
        :slides="slides"
        :theme="theme"
        :show-thumbnails="false"
        :auto-play="false"
        :initial-index="currentIndex"
        :current-index="currentIndex"
        @update:current-index="handlePageChange"
      />
      <div v-else class="slide-deck-node__empty">
        <p>空演示文稿</p>
        <p class="slide-deck-node__empty-hint">请在节点属性中配置 slides 数据</p>
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.slide-deck-node {
  position: relative;
  margin: 1.25rem 0;
  border-radius: 14px;
  background: transparent;
  transition:
    outline-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  outline: 2px solid transparent;
  outline-offset: 4px;
}

.slide-deck-node--selected {
  outline-color: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent, #7c3aed) 14%, transparent);
}

.slide-deck-node--fullscreen {
  background: var(--theme-bg, #0f172a);
  width: 100vw;
  height: 100vh;
  margin: 0;
  border-radius: 0;
  outline: none;
}

.slide-deck-node--fullscreen .slide-deck-node__deck {
  height: 100%;
}

/* ───────── 工具栏 ───────── */
.slide-deck-node__toolbar {
  position: absolute;
  top: -42px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.375rem;
  border-radius: 999px;
  background: var(--theme-surface, #ffffff);
  border: 1px solid var(--theme-border, #e2e8f0);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.15);
  font-family: var(--theme-font-sans, Inter, system-ui, sans-serif);
  user-select: none;
}

.slide-deck-node__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 28px;
  padding: 0 0.5rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--theme-fg, #1a1a1a);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.slide-deck-node__btn:hover:not(:disabled) {
  background: var(--theme-accent, #7c3aed);
  color: #ffffff;
}

.slide-deck-node__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slide-deck-node__btn--danger:hover:not(:disabled) {
  background: #ef4444;
  color: #ffffff;
}

.slide-deck-node__btn:focus-visible {
  outline: 2px solid var(--theme-accent, #7c3aed);
  outline-offset: 2px;
}

.slide-deck-node__btn-label {
  line-height: 1;
}

.slide-deck-node__divider {
  width: 1px;
  height: 16px;
  background: var(--theme-border, #e2e8f0);
  margin: 0 0.125rem;
}

.slide-deck-node__page {
  min-width: 2.5rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--theme-fg-muted, #475569);
  padding: 0 0.25rem;
}

/* ───────── 内部 SlideDeck 容器 ───────── */
.slide-deck-node__deck {
  position: relative;
  width: 100%;
  /* 编辑器内的高度：固定 360px 保持紧凑；全屏时由父级 .slide-deck-node--fullscreen 撑开 */
  height: 360px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--theme-bg-subtle, #f8fafc);
}

.slide-deck-node--fullscreen .slide-deck-node__deck {
  height: 100%;
  border-radius: 0;
}

.slide-deck-node__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--theme-fg-muted, #475569);
  text-align: center;
  gap: 0.5rem;
}

.slide-deck-node__empty p {
  margin: 0;
}

.slide-deck-node__empty-hint {
  font-size: 0.8125rem;
  opacity: 0.7;
}
</style>
