<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vue3DraggableResizable from 'vue3-draggable-resizable'
import { DraggableContainer } from 'vue3-draggable-resizable'
import {
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Loader2,
  Palette,
  Sparkles,
} from '@lucide/vue'
import ImageEditor from 'tui-image-editor'
import 'tui-image-editor/dist/tui-image-editor.css'
import {
  EDITOR_MENUS,
  IMAGE_EDITOR_FOOTER_H,
  IMAGE_EDITOR_HEADER_BASE_H,
  editorLocale,
  editorTheme,
} from './imageEditorConfig.js'
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

const HEADER_H_BASE = IMAGE_EDITOR_HEADER_BASE_H
const FOOTER_H = IMAGE_EDITOR_FOOTER_H

const imageState = useFloatingWindowState(FLOATING_WINDOW_ID.IMAGE_EDITOR)
const { posX, posY, windowW, windowH, minW, minH } = imageState

const editorContainerRef = ref(null)
const imageEditorPanelRef = ref(null)
const tuiMenuMountRef = ref(null)
const tuiHelpMountRef = ref(null)
const tuiSubmenuMountRef = ref(null)
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
let menuElRef = null
let submenuClassObserver = null
let resizeObserver = null

const SUBMENU_MENU_CLASS_PREFIX = 'tui-image-editor-menu-'

function syncSubmenuMenuClass() {
  const main = editorContainerRef.value?.querySelector('.tui-image-editor-main')
  const mount = tuiSubmenuMountRef.value
  if (!main || !mount) return

  Array.from(mount.classList)
    .filter((className) => className.startsWith(SUBMENU_MENU_CLASS_PREFIX))
    .forEach((className) => mount.classList.remove(className))

  Array.from(main.classList)
    .filter((className) => className.startsWith(SUBMENU_MENU_CLASS_PREFIX))
    .forEach((className) => mount.classList.add(className))
}

function observeSubmenuMenuClass() {
  const main = editorContainerRef.value?.querySelector('.tui-image-editor-main')
  if (!main || typeof MutationObserver === 'undefined') return

  submenuClassObserver?.disconnect()
  submenuClassObserver = new MutationObserver(syncSubmenuMenuClass)
  submenuClassObserver.observe(main, { attributes: true, attributeFilter: ['class'] })
  syncSubmenuMenuClass()
}

function getCurrentHeaderHeight() {
  const headerEl = imageEditorPanelRef.value?.querySelector('.image-editor-window__header')
  if (headerEl) {
    return headerEl.getBoundingClientRect().height
  }
  return HEADER_H_BASE
}

function getEditorBodySize() {
  return {
    width: Math.max(320, windowW.value - 2),
    height: Math.max(240, windowH.value - getCurrentHeaderHeight() - FOOTER_H - 2),
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
  scheduleEditorResize()
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

function resolveMenuName(menuItem) {
  return EDITOR_MENUS.find((name) => menuItem.classList.contains(`tie-btn-${name}`))
}

function exitActiveSubmenuForCustomPanel() {
  const current = editorInstance?.ui?.submenu
  if (!current || current === 'rotate') return
  editorInstance.ui.changeMenu('rotate', false, true)
}

function closeMosaicPanel() {
  if (!showMosaicPanel.value) return
  showMosaicPanel.value = false
  editorInstance?.stopDrawingMode()
}

function toggleFilterPanel() {
  if (showFilterPanel.value) {
    showFilterPanel.value = false
    return
  }

  closeMosaicPanel()
  exitActiveSubmenuForCustomPanel()
  showFilterPanel.value = true
  activeMenu.value = 'filter'
  nextTick(() => resizeEditorCanvas())
}

function toggleMosaicPanel() {
  if (showMosaicPanel.value) {
    closeMosaicPanel()
    return
  }

  exitActiveSubmenuForCustomPanel()
  showFilterPanel.value = false
  showMosaicPanel.value = true
  activeMenu.value = 'mask'
  activateMosaicDrawing()
  nextTick(() => resizeEditorCanvas())
}

function handleMenuClick(event) {
  const menuItem = event.target.closest('.tui-image-editor-item')
  if (!menuItem) return

  const menuName = resolveMenuName(menuItem)
  if (!menuName) return

  activeMenu.value = menuName
  showFilterPanel.value = false
  closeMosaicPanel()
}

function setupMenuListener() {
  const menuEl = editorContainerRef.value?.querySelector('.tui-image-editor-menu')
  if (!menuEl) return
  menuClickHandler = handleMenuClick
  menuElRef = menuEl
  menuEl.addEventListener('click', menuClickHandler)
}

async function mountTuiToolbars() {
  await nextTick()
  const container = editorContainerRef.value
  const menuMount = tuiMenuMountRef.value
  const helpMount = tuiHelpMountRef.value
  if (!container || !menuMount || !helpMount) return

  const controls = container.querySelector('.tui-image-editor-controls')
  const helpMenu = container.querySelector('.tui-image-editor-help-menu')

  if (controls && controls.parentElement !== menuMount) {
    menuMount.appendChild(controls)
  }
  if (helpMenu && helpMenu.parentElement !== helpMount) {
    helpMenu.classList.remove('bottom', 'top', 'left', 'right')
    helpMount.appendChild(helpMenu)
  }

  const submenu = container.querySelector('.tui-image-editor-submenu')
  if (submenu && tuiSubmenuMountRef.value && submenu.parentElement !== tuiSubmenuMountRef.value) {
    tuiSubmenuMountRef.value.appendChild(submenu)
  }

  observeSubmenuMenuClass()
  resizeEditorCanvas()
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
  mountTuiToolbars()
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
  if (menuClickHandler && menuElRef) {
    menuElRef.removeEventListener('click', menuClickHandler)
    menuClickHandler = null
    menuElRef = null
  }
  submenuClassObserver?.disconnect()
  submenuClassObserver = null
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

let lastObservedBodySize = null

function scheduleEditorResize() {
  if (!editorInstance) return
  const { width, height } = getEditorBodySize()
  if (lastObservedBodySize && lastObservedBodySize.width === width && lastObservedBodySize.height === height) {
    return
  }
  lastObservedBodySize = { width, height }
  editorInstance.ui.resizeEditor({
    uiSize: {
      width: `${width}px`,
      height: `${height}px`,
    },
  })
}

onMounted(async () => {
  await nextTick()
  initEditor()
  window.addEventListener('keydown', handleImageEditorKeydown)

  if (imageEditorPanelRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleEditorResize()
    })
    resizeObserver.observe(imageEditorPanelRef.value)
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

watch(
  () => removeBgError.value,
  () => {
    if (editorInstance) {
      nextTick(() => resizeEditorCanvas())
    }
  },
)
</script>

<template>
  <div class="image-editor-host floating-host">
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
            <div class="image-editor-window__header-top">
              <span id="image-editor-title" class="image-editor-window__title">图片编辑</span>
            </div>
            <div class="image-editor-window__toolbar" @mousedown.stop>
              <div ref="tuiMenuMountRef" class="image-editor-window__toolbar-group" />

              <div class="image-editor-window__toolbar-divider" aria-hidden="true" />

              <div class="image-editor-window__toolbar-custom">
                <button
                  type="button"
                  class="image-editor-toolbar-btn"
                  :class="{ 'image-editor-toolbar-btn--active': showFilterPanel }"
                  title="调色"
                  aria-label="调色"
                  :aria-pressed="showFilterPanel ? 'true' : 'false'"
                  :disabled="isRemovingBg"
                  @click="toggleFilterPanel"
                >
                  <Palette :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="image-editor-toolbar-btn"
                  :class="{ 'image-editor-toolbar-btn--active': showMosaicPanel }"
                  title="马赛克"
                  aria-label="马赛克"
                  :aria-pressed="showMosaicPanel ? 'true' : 'false'"
                  :disabled="isRemovingBg"
                  @click="toggleMosaicPanel"
                >
                  <Grid3x3 :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="image-editor-toolbar-btn image-editor-toolbar-btn--ai"
                  :title="isOffline ? networkRequiredTooltip : 'AI 去除背景'"
                  :aria-label="isOffline ? networkRequiredTooltip : 'AI 去除背景'"
                  :disabled="isRemovingBg || isOffline"
                  @click="handleRemoveBg"
                >
                  <Loader2
                    v-if="isRemovingBg"
                    :size="18"
                    class="image-editor-toolbar-btn__spin animate-editor-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <Sparkles v-else :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="image-editor-toolbar-btn"
                  title="水平翻转"
                  aria-label="水平翻转图片"
                  :disabled="isRemovingBg"
                  @click="handleFlipX"
                >
                  <FlipHorizontal2 :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="image-editor-toolbar-btn"
                  title="垂直翻转"
                  aria-label="垂直翻转图片"
                  :disabled="isRemovingBg"
                  @click="handleFlipY"
                >
                  <FlipVertical2 :size="18" aria-hidden="true" />
                </button>
              </div>

              <div class="image-editor-window__toolbar-divider" aria-hidden="true" />

              <div ref="tuiHelpMountRef" class="image-editor-window__toolbar-group" />
            </div>
            <div ref="tuiSubmenuMountRef" class="image-editor-window__submenu-bar" @mousedown.stop />
          </header>

          <p v-if="removeBgError" class="image-editor-window__error" @mousedown.stop>{{ removeBgError }}</p>

          <div
            class="image-editor-window__body"
            :class="{
              'image-editor-window__body--filter-panel': showFilterPanel,
              'image-editor-window__body--mosaic-panel': showMosaicPanel,
            }"
          >
            <div ref="editorContainerRef" class="image-editor-window__canvas" @mousedown.stop />

            <div
              v-if="showFilterPanel"
              class="image-editor-panel image-editor-panel--filter"
              @mousedown.stop
              @pointerdown.stop
            >
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

            <div
              v-if="showMosaicPanel"
              class="image-editor-panel image-editor-panel--mosaic"
              @mousedown.stop
              @pointerdown.stop
            >
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

          <footer class="image-editor-window__footer" @mousedown.stop>
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
  /* 顶栏 / 底栏局部尺寸（与 imageEditorConfig.js 中的 BASE 常量保持同源） */
  --editor-header-top-h: 36px;
  --editor-toolbar-h: 40px;
  --editor-submenu-h: 48px;
  --editor-footer-h: 52px;
  --editor-panel-gap: 12px;

  position: fixed;
  inset: 0;
  pointer-events: none;
}

.image-editor-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

/* vdr-container/vdr-handle 公共基类见 src/styles/floating-window.css */

.image-editor-host :deep(.vdr-container) {
  /* 浮窗自身特性：阴影 / 圆角 / 背景 */
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.22);
  border-radius: 16px;
  background: var(--theme-surface);
}

.image-editor-window {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--theme-surface);
}

.image-editor-window__header {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-bottom: 1px solid var(--theme-border);
  background: var(--theme-bg-subtle);
}

.image-editor-window__header-top {
  display: flex;
  align-items: center;
  height: var(--editor-header-top-h);
  padding: 0 16px;
  cursor: move;
  user-select: none;
}

.image-editor-window__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg);
}

.image-editor-window__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--editor-toolbar-h);
  padding: 0 10px 4px;
  overflow-x: auto;
}

.image-editor-window__toolbar-group {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.image-editor-window__toolbar-custom {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.image-editor-window__toolbar-divider {
  flex-shrink: 0;
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: var(--theme-border);
}

.image-editor-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-fg-subtle);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.image-editor-toolbar-btn:hover:not(:disabled) {
  background: var(--theme-bg-muted);
  color: var(--theme-accent-hover);
}

.image-editor-toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-editor-toolbar-btn--active {
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
}

.image-editor-toolbar-btn--ai {
  color: var(--theme-accent);
}

.image-editor-toolbar-btn--ai:hover:not(:disabled) {
  background: var(--theme-accent-muted);
}

.image-editor-toolbar-btn__spin {
  /* 动画通过 .animate-editor-spin 工具类提供（tailwind.config.js）
   * 配合 .motion-reduce:animate-none 在 prefers-reduced-motion 下静止 */
}

.image-editor-window__error {
  margin: 0;
  padding: 6px 16px;
  border-bottom: 1px solid var(--theme-danger-border);
  background: var(--theme-danger-bg);
  color: var(--theme-danger-fg);
  font-size: 12px;
  line-height: 1.5;
}

.image-editor-window__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--theme-bg-subtle);
}

.image-editor-window__canvas {
  width: 100%;
  height: 100%;
}

.image-editor-panel {
  position: absolute;
  left: var(--editor-panel-gap);
  right: var(--editor-panel-gap);
  bottom: calc(var(--editor-footer-h) + var(--editor-panel-gap));
  z-index: 10;
  padding: 10px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface) 96%, transparent);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  touch-action: none;
}

.image-editor-panel__hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--theme-fg-subtle);
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
  color: var(--theme-fg-muted);
}

.image-editor-panel__range {
  flex: 1;
  accent-color: var(--theme-accent);
}

.image-editor-window__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: var(--editor-footer-h);
  padding: 0 12px;
  border-top: 1px solid var(--theme-border);
  background: var(--theme-surface);
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
  border: 1px solid var(--theme-border);
  background: var(--theme-surface);
  color: var(--theme-fg-muted);
}

.image-editor-window__btn--ghost:hover {
  border-color: var(--theme-fg-subtle);
  background: var(--theme-bg-subtle);
}

.image-editor-window__btn--primary {
  border: 1px solid var(--theme-accent);
  background: var(--theme-accent);
  color: #fff;
}

.image-editor-window__btn--primary:hover {
  background: var(--theme-accent-hover);
  border-color: var(--theme-accent-hover);
}

/* 隐藏 tui 内置加载/下载与 logo。
 * 使用 .image-editor-host.image-editor-host 双类名提升宿主权重到 0,2,0，
 * Vue scoped 加上属性选择器后总权重 0,5,0，能压过 tui-image-editor.css
 * 中 0,1,0 ~ 0,3,0 的内置规则，因此不再需要 !important。 */
.image-editor-host.image-editor-host :deep(.tui-image-editor-header),
.image-editor-host.image-editor-host :deep(.tui-image-editor-controls-logo),
.image-editor-host.image-editor-host :deep(.tui-image-editor-controls-buttons),
.image-editor-host.image-editor-host :deep(.tui-image-editor-header-buttons) {
  display: none;
}

/* 标注菜单隐藏三角形 */
.image-editor-host.image-editor-host :deep(.tie-shape-button .tui-image-editor-button.triangle) {
  display: none;
}

/* 覆盖 tui 容器默认深色背景 #282828 */
.image-editor-host.image-editor-host :deep(.tui-image-editor-container) {
  background-color: var(--theme-bg-subtle);
}

/* 让编辑器填满容器 */
.image-editor-host.image-editor-host :deep(.tui-image-editor-container),
.image-editor-host.image-editor-host :deep(.tui-image-editor-main-container) {
  width: 100%;
  height: 100%;
}

.image-editor-host.image-editor-host :deep(.tui-image-editor-container.top .tui-image-editor-main-container) {
  top: 0;
  bottom: 0;
}

.image-editor-host.image-editor-host :deep(.tui-image-editor-main) {
  display: flex;
  flex-direction: column;
  top: 0;
  height: 100%;
}

.image-editor-host.image-editor-host :deep(.tui-image-editor-wrap) {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: auto;
  bottom: auto;
  overflow: hidden;
  padding-bottom: 0;
  box-sizing: border-box;
}

.image-editor-host.image-editor-host :deep(.tui-image-editor) {
  top: 0;
  left: 0;
}

.image-editor-host :deep(.tui-image-editor-size-wrap),
.image-editor-host :deep(.tui-image-editor-align-wrap) {
  width: 100%;
  height: 100%;
}

/* 顶栏子菜单（裁剪比例、旋转滑块等） */
.image-editor-window__submenu-bar {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: var(--editor-submenu-h);
  padding: 6px 12px;
  background: var(--theme-surface);
  border-top: 1px solid var(--theme-border);
}

.image-editor-window__submenu-bar[class*='tui-image-editor-menu-'] {
  display: flex;
}

/* submenu 区域：宿主类双类名提升权重到 0,2,0，scoped 加上属性选择器后
 * 总权重 0,5,0，能压过 tui 内置 0,1,0 ~ 0,3,0 的规则，无需 !important。 */
.image-editor-window__submenu-bar.image-editor-window__submenu-bar :deep(.tui-image-editor-submenu) {
  position: static;
  display: block;
  width: 100%;
  height: auto;
  white-space: normal;
}

.image-editor-window__submenu-bar.image-editor-window__submenu-bar :deep(.tui-image-editor-submenu-style) {
  display: none;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-submenu > div) {
  display: none;
}

.image-editor-window__submenu-bar.tui-image-editor-menu-crop.image-editor-window__submenu-bar :deep(.tui-image-editor-menu-crop),
.image-editor-window__submenu-bar.tui-image-editor-menu-rotate.image-editor-window__submenu-bar :deep(.tui-image-editor-menu-rotate),
.image-editor-window__submenu-bar.tui-image-editor-menu-shape.image-editor-window__submenu-bar :deep(.tui-image-editor-menu-shape),
.image-editor-window__submenu-bar.tui-image-editor-menu-text.image-editor-window__submenu-bar :deep(.tui-image-editor-menu-text) {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-submenu-item) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-submenu-item li) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-submenu-item .tui-image-editor-newline) {
  display: none;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-button) {
  margin: 0 2px;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-button.preset) {
  margin: 0 4px;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-button label),
.image-editor-window__submenu-bar :deep(.tui-image-editor-button label > span) {
  color: var(--theme-fg-muted);
  font-size: 11px;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-button.active label),
.image-editor-window__submenu-bar :deep(.tui-image-editor-button.active label > span),
.image-editor-window__submenu-bar :deep(.preset.active label),
.image-editor-window__submenu-bar :deep(.preset.active label > span) {
  color: var(--theme-accent);
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-partition > div) {
  height: 28px;
  border-left-color: var(--theme-border);
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-partition.only-left-right) {
  display: none;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-range-wrap) {
  display: flex;
  align-items: center;
  gap: 8px;
}

.image-editor-window__submenu-bar :deep(.tui-image-editor-range-wrap label) {
  color: var(--theme-fg-muted);
  font-size: 12px;
}

/* 顶部工具栏内的 tui 主菜单 */
.image-editor-window__toolbar :deep(.tui-image-editor-controls) {
  position: static;
  display: flex;
  align-items: center;
  width: auto;
  height: auto;
  background: transparent;
}

.image-editor-window__toolbar :deep(.tui-image-editor-menu) {
  display: flex;
  align-items: center;
  gap: 2px;
}

.image-editor-window__toolbar :deep(.tui-image-editor-menu > .tui-image-editor-item) {
  padding: 4px;
  margin: 0;
  border-radius: 6px;
}

.image-editor-window__toolbar :deep(.tui-image-editor-menu > .tui-image-editor-item.active) {
  background: var(--theme-accent-muted);
}

.image-editor-window__toolbar :deep(.tui-image-editor-menu > .tui-image-editor-item[tooltip-content]:hover::after),
.image-editor-window__toolbar :deep(.tui-image-editor-menu > .tui-image-editor-item[tooltip-content]:hover::before) {
  z-index: 20;
}

/* 顶部工具栏内的缩放/撤销等帮助按钮 */
.image-editor-window__toolbar :deep(.tui-image-editor-help-menu) {
  position: static;
  transform: none;
  display: flex;
  align-items: center;
  gap: 2px;
  width: auto;
  height: auto;
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  white-space: nowrap;
}

.image-editor-window__toolbar :deep(.tui-image-editor-help-menu > .tui-image-editor-item) {
  padding: 4px;
  margin: 0;
  border-radius: 6px;
}

.image-editor-window__toolbar :deep(.tui-image-editor-help-menu > .tui-image-editor-item:hover) {
  background: var(--theme-bg-muted);
}

.image-editor-window__toolbar :deep(.tui-image-editor-help-menu > .tui-image-editor-item[tooltip-content]:hover::after),
.image-editor-window__toolbar :deep(.tui-image-editor-help-menu > .tui-image-editor-item[tooltip-content]:hover::before) {
  z-index: 20;
}

.image-editor-window__toolbar :deep(.tui-image-editor-icpartition) {
  position: static;
  top: auto;
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: var(--theme-border);
}

.image-editor-window__toolbar :deep(.tui-image-editor-icpartition > div) {
  display: none;
}

.image-editor-window__toolbar :deep(.tie-panel-history) {
  z-index: 30;
}

.image-editor-window__body--filter-panel :deep(.tui-image-editor-wrap),
.image-editor-window__body--mosaic-panel :deep(.tui-image-editor-wrap) {
  padding-bottom: 132px;
}
</style>
