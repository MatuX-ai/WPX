import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * WPX HTML 源码编辑面板 Store
 *
 * 职责：
 *  - 集中维护源码面板的可见性、宽度等 UI 状态
 *  - 在 EditorCore（触发方）和 EditorLayout（消费方）之间共享
 *  - 提供 show / hide / toggle / setWidth / reset 等 API
 *
 * 设计要点：
 *  - 状态独立于 htmlFormatBar（排版完成提示条）——两者职责不同，避免互相干扰
 *  - visible 默认 false：保证普通文档"无扰"（即使被错误调用 hide 也不会留下副作用）
 *  - width 单位为 px，提供 snapPoints 用于拖拽吸附
 *  - 切换文档（loadMarkdown）时建议调用 reset()，但本 store 不主动 watch editor
 *    以避免循环依赖，由 EditorLayout 在 watch editor 时决定
 */

export const DEFAULT_HTML_SOURCE_PANEL_WIDTH = 420
export const MIN_HTML_SOURCE_PANEL_WIDTH = 240
export const MAX_HTML_SOURCE_PANEL_WIDTH = 720
export const HTML_SOURCE_PANEL_SNAP_POINTS = [320, 420, 520, 640]

export const useHtmlSourcePanelStore = defineStore('htmlSourcePanel', () => {
  /** 是否显示源码面板 */
  const visible = ref(false)

  /** 用户自定义的宽度（null = 使用默认） */
  const userWidth = ref(null)

  /** 默认宽度 */
  const defaultWidth = ref(DEFAULT_HTML_SOURCE_PANEL_WIDTH)

  /** 实际生效的宽度：用户未调整时用 defaultWidth，否则用 userWidth */
  const effectiveWidth = computed(() => {
    return userWidth.value == null ? defaultWidth.value : userWidth.value
  })

  /** 是否被用户自定义过宽度 */
  const isCustomized = computed(() => userWidth.value != null)

  /**
   * 显示源码面板
   */
  function show() {
    visible.value = true
  }

  /**
   * 隐藏源码面板（保留宽度记忆）
   */
  function hide() {
    visible.value = false
  }

  /**
   * 切换显示状态
   */
  function toggle() {
    visible.value = !visible.value
  }

  /**
   * 设置宽度（仅在范围内）
   * @param {number} width 像素
   */
  function setWidth(width) {
    if (typeof width !== 'number' || !Number.isFinite(width)) return
    const clamped = Math.max(
      MIN_HTML_SOURCE_PANEL_WIDTH,
      Math.min(MAX_HTML_SOURCE_PANEL_WIDTH, Math.round(width)),
    )
    userWidth.value = clamped
  }

  /**
   * 重置宽度为默认值
   */
  function resetWidth() {
    userWidth.value = null
  }

  /**
   * 完全重置（关闭面板 + 清空宽度）
   * 切换文档时建议调用
   */
  function reset() {
    visible.value = false
    userWidth.value = null
  }

  /**
   * 切换文档时由 EditorLayout 调用：仅在文档无 htmlSource 时关闭面板
   * 防止切换到普通文档后面板残留
   * @param {boolean} hasHtmlSource
   */
  function syncWithDocument(hasHtmlSource) {
    if (!hasHtmlSource) {
      visible.value = false
    }
  }

  return {
    // state
    visible,
    userWidth,
    defaultWidth,
    effectiveWidth,
    isCustomized,
    // actions
    show,
    hide,
    toggle,
    setWidth,
    resetWidth,
    reset,
    syncWithDocument,
  }
})

export default useHtmlSourcePanelStore