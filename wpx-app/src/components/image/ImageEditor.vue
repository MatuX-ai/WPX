<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vue3DraggableResizable from 'vue3-draggable-resizable'
import { DraggableContainer } from 'vue3-draggable-resizable'
import ImageEditor from 'tui-image-editor'
import 'tui-image-editor/dist/tui-image-editor.css'
import { EDITOR_MENUS, editorLocale, editorTheme } from './imageEditorConfig.js'
import { removeImageBackground } from '@/utils/removeBackground'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import {
  FLOATING_WINDOW_ID,
  useFloatingWindowState,
} from '@/composables/useFloatingWindows'

const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['apply', 'cancel'])

const HEADER_H = 44
const FOOTER_H = 52

const imageState = useFloatingWindowState(FLOATING_WINDOW_ID.IMAGE_EDITOR)
const { posX, posY, windowW, windowH, minW, minH } = imageState

const editorContainerRef = ref(null)
const imageEditorPanelRef = ref(null)
const activeMenu = ref('crop')
const showFilterPanel = ref(false)
const showMosaicPanel = ref(false)

const brightness = ref(0)
const contrast = ref(0)
const saturation = ref(0)
const mosaicBlockSize = ref(8)
const isRemovingBg = ref(false)
const removeBgError = ref('')
const { isOffline, networkRequiredTooltip } = useOnlineStatus()

let editorInstance = null
let removeBgObjectUrl = null
let menuClickHandler = null
let resizeObserver = null

function getEditorBodySize() {
  return {
    width: Math.max(320, windowW.value - 2),
    height: Math.max(240, windowH.value - HEADER_H - FOOTER_H - 2),
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function resizeEditorCanvas() {
  if (!editorInstance?.ui) return
  const { width, height } = getEditorBodySize()
  editorInstance.ui.resizeEditor({
    uiSize: {
      width: `${width}px`,
      height: `${height}px`,
    },
  })
}

function applyColorFilter(type, value) {
  if (!editorInstance) return
  if (value === 0) {
    if (editorInstance.hasFilter(type)) {
      editorInstance.removeFilter(type)
    }
    return
  }
  editorInstance.applyFilter(type, { [type]: value }, true)
}

function handleBrightnessInput(event) {
  brightness.value = Number(event.target.value)
  applyColorFilter('brightness', brightness.value)
}

function handleContrastInput(event) {
  contrast.value = Number(event.target.value)
  applyColorFilter('contrast', contrast.value)
}

function handleSaturationInput(event) {
  saturation.value = Number(event.target.value)
  applyColorFilter('saturation', saturation.value)
}

function activateMosaicDrawing() {
  if (!editorInstance) return
  editorInstance.stopDrawingMode()
  editorInstance.setDrawingShape('rect', {
    fill: {
      type: 'filter',
      filter: [{ pixelate: mosaicBlockSize.value }],
    },
    stroke: 'transparent',
    strokeWidth: 0,
  })
  editorInstance.startDrawingMode('SHAPE')
}

function handleMosaicBlockSizeInput(event) {
  mosaicBlockSize.value = Number(event.target.value)
  activateMosaicDrawing()
}

function handleMenuClick(event) {
  const menuItem = event.target.closest('.tui-image-editor-item')
  if (!menuItem) return

  const menuName = EDITOR_MENUS.find((name) => menuItem.classList.contains(name))
  if (!menuName) return

  activeMenu.value = menuName
  showFilterPanel.value = menuName === 'filter'
  showMosaicPanel.value = menuName === 'mask'

  if (menuName === 'mask') {
    activateMosaicDrawing()
  }
}

function setupMenuListener() {
  const menuEl = editorContainerRef.value?.querySelector('.tui-image-editor-menu')
  if (!menuEl) return
  menuClickHandler = handleMenuClick
  menuEl.addEventListener('click', menuClickHandler)
}

function initEditor() {
  if (!editorContainerRef.value || !props.imageUrl) return

  const { width, height } = getEditorBodySize()

  editorInstance = new ImageEditor(editorContainerRef.value, {
    includeUI: {
      loadImage: {
        path: props.imageUrl,
        name: 'Image',
      },
      theme: editorTheme,
      locale: editorLocale,
      menu: EDITOR_MENUS,
      initMenu: 'crop',
      menuBarPosition: 'top',
      usageStatistics: false,
      uiSize: {
        width: `${width}px`,
        height: `${height}px`,
      },
    },
    cssMaxWidth: width,
    cssMaxHeight: height,
    usageStatistics: false,
    selectionStyle: {
      cornerSize: 16,
      rotatingPointOffset: 56,
    },
  })

  setupMenuListener()
  resizeEditorCanvas()
}

async function reloadImage(url) {
  if (!editorInstance || !url) return
  await editorInstance.loadImageFromURL(url, 'Image')
  brightness.value = 0
  contrast.value = 0
  saturation.value = 0
  mosaicBlockSize.value = 8
}

function destroyEditor() {
  if (menuClickHandler && editorContainerRef.value) {
    const menuEl = editorContainerRef.value.querySelector('.tui-image-editor-menu')
    menuEl?.removeEventListener('click', menuClickHandler)
    menuClickHandler = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  editorInstance?.destroy()
  editorInstance = null
}

async function handleFlipX() {
  await editorInstance?.flipX()
}

async function handleFlipY() {
  await editorInstance?.flipY()
}

function revokeRemoveBgObjectUrl() {
  if (removeBgObjectUrl) {
    URL.revokeObjectURL(removeBgObjectUrl)
    removeBgObjectUrl = null
  }
}

async function handleRemoveBg() {
  if (!editorInstance || isRemovingBg.value || isOffline.value) return

  isRemovingBg.value = true
  removeBgError.value = ''

  try {
    const dataUrl = editorInstance.toDataURL({ format: 'png', quality: 1 })
    const blob = dataUrlToBlob(dataUrl)
    const resultBlob = await removeImageBackground(blob)
    revokeRemoveBgObjectUrl()
    removeBgObjectUrl = URL.createObjectURL(resultBlob)

    await editorInstance.loadImageFromURL(removeBgObjectUrl, 'Image')

    brightness.value = 0
    contrast.value = 0
    saturation.value = 0
  } catch (err) {
    removeBgError.value = err?.message || '去背景失败'
  } finally {
    isRemovingBg.value = false
  }
}

function handleApply() {
  if (!editorInstance) return
  const dataUrl = editorInstance.toDataURL({ format: 'png', quality: 1 })
  emit('apply', dataUrlToBlob(dataUrl))
}

function handleCancel() {
  emit('cancel')
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function handleImageEditorKeydown(event) {
  if (isEditableTarget(event.target) && event.key !== 'Escape') return

  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
    return
  }

  if (event.key === 'Enter' && !event.shiftKey && !isRemovingBg.value) {
    event.preventDefault()
    handleApply()
  }
}

function handleDragEnd() {
  imageState.clampToParent({ snap: true })
}

function handleResizeEnd() {
  imageState.clampToParent({ snap: true })
  resizeEditorCanvas()
}

onMounted(async () => {
  await nextTick()
  initEditor()
  window.addEventListener('keydown', handleImageEditorKeydown)

  if (editorContainerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      resizeEditorCanvas()
    })
    resizeObserver.observe(editorContainerRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleImageEditorKeydown)
  revokeRemoveBgObjectUrl()
  destroyEditor()
})

watch(
  () => props.imageUrl,
  (url) => {
    reloadImage(url)
  },
)

watch([windowW, windowH], () => {
  resizeEditorCanvas()
})
</script>

<template>
  <div class="image-editor-host">
    <DraggableContainer :reference-line-visible="false" class="image-editor-container">
      <Vue3DraggableResizable
        v-model:x="posX"
        v-model:y="posY"
        v-model:w="windowW"
        v-model:h="windowH"
        :init-w="windowW"
        :init-h="windowH"
        :min-w="minW"
        :min-h="minH"
        :draggable="true"
        :resizable="true"
        :parent="true"
        :handles="['mr', 'br', 'bm']"
        class-name-handle="image-editor-handle"
        @drag-end="handleDragEnd"
        @resize-end="handleResizeEnd"
      >
        <div
          ref="imageEditorPanelRef"
          class="image-editor-window"
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-editor-title"
        >
          <header class="image-editor-window__header">
            <span id="image-editor-title" class="image-editor-window__title">图片编辑</span>
            <div class="image-editor-window__header-actions">
              <button
                type="button"
                class="image-editor-window__action-btn image-editor-window__action-btn--ai"
                :title="isOffline ? networkRequiredTooltip : 'AI 去除背景'"
                :aria-label="isOffline ? networkRequiredTooltip : 'AI 去除背景'"
                :disabled="isRemovingBg || isOffline"
                @mousedown.stop
                @click="handleRemoveBg"
              >
                {{ isRemovingBg ? '处理中...' : 'AI去背景' }}
              </button>
              <button
                type="button"
                class="image-editor-window__action-btn"
                title="水平翻转"
                aria-label="水平翻转图片"
                :disabled="isRemovingBg"
                @mousedown.stop
                @click="handleFlipX"
              >
                水平翻转
              </button>
              <button
                type="button"
                class="image-editor-window__action-btn"
                title="垂直翻转"
                aria-label="垂直翻转图片"
                :disabled="isRemovingBg"
                @mousedown.stop
                @click="handleFlipY"
              >
                垂直翻转
              </button>
            </div>
          </header>

          <p v-if="removeBgError" class="image-editor-window__error">{{ removeBgError }}</p>

          <div class="image-editor-window__body">
            <div ref="editorContainerRef" class="image-editor-window__canvas" @mousedown.stop />

            <div v-if="showFilterPanel" class="image-editor-panel image-editor-panel--filter">
              <div class="image-editor-panel__row">
                <label class="image-editor-panel__label">亮度</label>
                <input
                  class="image-editor-panel__range"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  :value="brightness"
                  @input="handleBrightnessInput"
                />
              </div>
              <div class="image-editor-panel__row">
                <label class="image-editor-panel__label">对比度</label>
                <input
                  class="image-editor-panel__range"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  :value="contrast"
                  @input="handleContrastInput"
                />
              </div>
              <div class="image-editor-panel__row">
                <label class="image-editor-panel__label">饱和度</label>
                <input
                  class="image-editor-panel__range"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  :value="saturation"
                  @input="handleSaturationInput"
                />
              </div>
            </div>

            <div v-if="showMosaicPanel" class="image-editor-panel image-editor-panel--mosaic">
              <p class="image-editor-panel__hint">在图片上拖拽绘制马赛克区域</p>
              <div class="image-editor-panel__row">
                <label class="image-editor-panel__label">颗粒大小</label>
                <input
                  class="image-editor-panel__range"
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  :value="mosaicBlockSize"
                  @input="handleMosaicBlockSizeInput"
                />
              </div>
            </div>
          </div>

          <footer class="image-editor-window__footer">
            <button
              type="button"
              class="image-editor-window__btn image-editor-window__btn--ghost"
              aria-label="取消图片编辑"
              @mousedown.stop
              @click="handleCancel"
            >
              取消
            </button>
            <button
              type="button"
              class="image-editor-window__btn image-editor-window__btn--primary"
              aria-label="应用图片编辑"
              @mousedown.stop
              @click="handleApply"
            >
              应用
            </button>
          </footer>
        </div>
      </Vue3DraggableResizable>
    </DraggableContainer>
  </div>
</template>

<style scoped>
.image-editor-host {
  position: fixed;
  inset: 0;
  z-index: var(--z-image-editor);
  pointer-events: none;
}

.image-editor-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.image-editor-host :deep(.vdr-container) {
  pointer-events: auto;
  border: none;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.22);
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.image-editor-host :deep(.vdr-handle) {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-editor-host :deep(.vdr-container:hover .vdr-handle),
.image-editor-host :deep(.vdr-container.active .vdr-handle) {
  opacity: 1;
}

.image-editor-window {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
}

.image-editor-window__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.image-editor-window__title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.image-editor-window__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.image-editor-window__action-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.image-editor-window__action-btn:hover:not(:disabled) {
  border-color: #c4b5fd;
  color: #6d28d9;
  background: #f5f3ff;
}

.image-editor-window__action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.image-editor-window__action-btn--ai {
  border-color: #ddd6fe;
  color: #6d28d9;
  background: #f5f3ff;
}

.image-editor-window__action-btn--ai:hover:not(:disabled) {
  border-color: #a78bfa;
  background: #ede9fe;
}

.image-editor-window__error {
  margin: 0;
  padding: 6px 16px;
  border-bottom: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}

.image-editor-window__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #f8fafc;
}

.image-editor-window__canvas {
  width: 100%;
  height: 100%;
}

.image-editor-panel {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 8px;
  z-index: 2;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
}

.image-editor-panel__hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #64748b;
}

.image-editor-panel__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.image-editor-panel__row + .image-editor-panel__row {
  margin-top: 8px;
}

.image-editor-panel__label {
  flex: 0 0 48px;
  font-size: 12px;
  color: #475569;
}

.image-editor-panel__range {
  flex: 1;
  accent-color: #7c3aed;
}

.image-editor-window__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 52px;
  padding: 0 12px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
}

.image-editor-window__btn {
  min-width: 72px;
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.image-editor-window__btn--ghost {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}

.image-editor-window__btn--ghost:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.image-editor-window__btn--primary {
  border: 1px solid #7c3aed;
  background: #7c3aed;
  color: #fff;
}

.image-editor-window__btn--primary:hover {
  background: #6d28d9;
  border-color: #6d28d9;
}

/* 隐藏 tui 内置加载/下载与 logo */
.image-editor-host :deep(.tui-image-editor-header),
.image-editor-host :deep(.tui-image-editor-controls-logo),
.image-editor-host :deep(.tui-image-editor-controls-buttons),
.image-editor-host :deep(.tui-image-editor-header-buttons) {
  display: none !important;
}

/* 隐藏 filter 默认子菜单，使用自定义调色面板 */
.image-editor-host :deep(.tui-image-editor-menu-filter) {
  display: none !important;
}

/* 隐藏 mask 默认子菜单，使用自定义马赛克面板 */
.image-editor-host :deep(.tui-image-editor-menu-mask) {
  display: none !important;
}

/* 标注菜单隐藏三角形 */
.image-editor-host :deep(.tie-shape-button .tui-image-editor-button.triangle) {
  display: none !important;
}

/* 让编辑器填满容器 */
.image-editor-host :deep(.tui-image-editor-container),
.image-editor-host :deep(.tui-image-editor-main-container),
.image-editor-host :deep(.tui-image-editor-wrap),
.image-editor-host :deep(.tui-image-editor) {
  width: 100% !important;
  height: 100% !important;
}

.image-editor-host :deep(.tui-image-editor-main) {
  top: 64px !important;
  height: calc(100% - 64px) !important;
}

.image-editor-host :deep(.tui-image-editor-controls) {
  height: 64px !important;
}

.image-editor-host :deep(.tui-image-editor-menu) {
  display: flex;
  justify-content: center;
  gap: 4px;
}
</style>
