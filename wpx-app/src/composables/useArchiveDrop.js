import { onMounted, onUnmounted, ref } from 'vue'
import { isExternalFileDrag } from '@/composables/useDragDrop'
import { isElectron } from '@/utils/electron'
import {
  getArchivePathsFromDataTransfer,
  hasArchiveFilesInDataTransfer,
  zipFeatureAvailable,
} from '@/utils/zipApi'

/**
 * 主窗口级压缩包拖放：在捕获阶段拦截，避免编辑器 drop 区吞掉 archive 文件。
 * @param {{ onDropArchives: (paths: string[]) => void }} options
 */
export function useArchiveDrop({ onDropArchives } = {}) {
  const isArchiveDragOver = ref(false)

  function enabled() {
    return isElectron() && zipFeatureAvailable()
  }

  function resetDragState() {
    isArchiveDragOver.value = false
  }

  function handleDragEnterCapture(event) {
    if (!enabled() || !isExternalFileDrag(event.dataTransfer)) return
    if (!hasArchiveFilesInDataTransfer(event.dataTransfer)) return

    event.preventDefault()
    isArchiveDragOver.value = true
  }

  function handleDragOverCapture(event) {
    if (!enabled() || !isExternalFileDrag(event.dataTransfer)) return
    if (!hasArchiveFilesInDataTransfer(event.dataTransfer)) {
      isArchiveDragOver.value = false
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    isArchiveDragOver.value = true
  }

  function handleDragLeaveCapture(event) {
    const shell = event.currentTarget
    const related = event.relatedTarget
    if (related instanceof Node && shell.contains(related)) return
    resetDragState()
  }

  function handleDropCapture(event) {
    if (!enabled() || !isExternalFileDrag(event.dataTransfer)) return

    const paths = getArchivePathsFromDataTransfer(event.dataTransfer)
    resetDragState()
    if (!paths.length) return

    event.preventDefault()
    event.stopPropagation()
    onDropArchives?.(paths)
  }

  const captureHandlers = {
    dragenter: handleDragEnterCapture,
    dragover: handleDragOverCapture,
    dragleave: handleDragLeaveCapture,
    drop: handleDropCapture,
  }

  function attachArchiveDropTarget(element) {
    if (!element) return () => {}

    for (const [type, handler] of Object.entries(captureHandlers)) {
      element.addEventListener(type, handler, true)
    }

    return () => {
      for (const [type, handler] of Object.entries(captureHandlers)) {
        element.removeEventListener(type, handler, true)
      }
    }
  }

  return {
    isArchiveDragOver,
    captureHandlers,
    attachArchiveDropTarget,
    resetDragState,
  }
}

/**
 * 绑定到 DOM 元素的便捷封装
 * @param {() => HTMLElement | null | undefined} getHostElement
 * @param {(paths: string[]) => void} onDropArchives
 */
export function useArchiveDropTarget(getHostElement, onDropArchives) {
  const { isArchiveDragOver, attachArchiveDropTarget } = useArchiveDrop({ onDropArchives })
  let detach = null

  onMounted(() => {
    const element = typeof getHostElement === 'function' ? getHostElement() : getHostElement
    detach = attachArchiveDropTarget(element)
  })

  onUnmounted(() => {
    detach?.()
    detach = null
  })

  return { isArchiveDragOver }
}
