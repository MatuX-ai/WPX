import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useHtmlSourcePanelResize } from '@/composables/useHtmlSourcePanelResize'
import {
  useHtmlSourcePanelStore,
  MIN_HTML_SOURCE_PANEL_WIDTH,
  MAX_HTML_SOURCE_PANEL_WIDTH,
} from '@/stores/htmlSourcePanel'

/**
 * 单元测试：HTML 源码面板宽度拖拽 composable
 *
 * 覆盖：
 *  - effectiveWidth / isCustomized 反映 store 状态
 *  - startResize 启动拖拽会话
 *  - 鼠标移动事件调整宽度
 *  - 释放鼠标后吸附到 snapPoints
 *  - 键盘 ArrowRight / ArrowLeft / Home / End 行为
 *  - reset 重置宽度
 */

function buildMouseEvent(type, { clientX = 0, button = 0 } = {}) {
  const evt = new MouseEvent(type, { bubbles: true, cancelable: true, button })
  Object.defineProperty(evt, 'clientX', { value: clientX, writable: false })
  return evt
}

describe('useHtmlSourcePanelResize', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 重置 document.body 副作用
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  })

  it('effectiveWidth 与 store 同步', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()
    expect(resize.effectiveWidth.value).toBe(store.effectiveWidth)
  })

  it('isCustomized 反映 store.userWidth 是否设置', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()
    expect(resize.isCustomized.value).toBe(false)
    store.setWidth(500)
    expect(resize.isCustomized.value).toBe(true)
  })

  it('鼠标向右拖使宽度增大（方向与右栏相反）', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    // 起始位置
    resize.startResize(buildMouseEvent('mousedown', { clientX: 100, button: 0 }))
    expect(resize.isResizing.value).toBe(true)

    // 模拟 mousemove 向右拖 100px
    document.dispatchEvent(buildMouseEvent('mousemove', { clientX: 200 }))
    // 起始宽度默认 420 + delta(100) = 520
    expect(store.userWidth).toBe(520)
    expect(resize.isResizing.value).toBe(true)

    // 释放
    document.dispatchEvent(buildMouseEvent('mouseup'))
    expect(resize.isResizing.value).toBe(false)
  })

  it('鼠标向左拖使宽度减小', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500)
    const resize = useHtmlSourcePanelResize()

    resize.startResize(buildMouseEvent('mousedown', { clientX: 500 }))
    document.dispatchEvent(buildMouseEvent('mousemove', { clientX: 400 }))
    // 起始 500 + delta(-100) = 400
    expect(store.userWidth).toBe(400)
    document.dispatchEvent(buildMouseEvent('mouseup'))
  })

  it('拖拽超出上限夹紧到 MAX', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.startResize(buildMouseEvent('mousedown', { clientX: 100 }))
    document.dispatchEvent(buildMouseEvent('mousemove', { clientX: 1000 }))
    expect(store.userWidth).toBe(MAX_HTML_SOURCE_PANEL_WIDTH)
    document.dispatchEvent(buildMouseEvent('mouseup'))
  })

  it('拖拽超出下限夹紧到 MIN', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(300)
    const resize = useHtmlSourcePanelResize()

    resize.startResize(buildMouseEvent('mousedown', { clientX: 1000 }))
    document.dispatchEvent(buildMouseEvent('mousemove', { clientX: 0 }))
    expect(store.userWidth).toBe(MIN_HTML_SOURCE_PANEL_WIDTH)
    document.dispatchEvent(buildMouseEvent('mouseup'))
  })

  it('释放鼠标时按 snapPoints 吸附', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    // 直接设置接近 snap 点 520 但不精确
    store.setWidth(515)
    resize.startResize(buildMouseEvent('mousedown', { clientX: 100 }))
    document.dispatchEvent(buildMouseEvent('mouseup'))
    // 阈值 12，距离 5，应该吸附到 520
    expect(store.userWidth).toBe(520)
  })

  it('释放鼠标距离 snap 较远不吸附', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    store.setWidth(450) // 距离最近 snap 点 420 是 30
    resize.startResize(buildMouseEvent('mousedown', { clientX: 100 }))
    document.dispatchEvent(buildMouseEvent('mouseup'))
    expect(store.userWidth).toBe(450)
  })

  it('非左键点击不启动拖拽', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.startResize(buildMouseEvent('mousedown', { clientX: 100, button: 2 }))
    expect(resize.isResizing.value).toBe(false)
    expect(store.userWidth).toBeNull()
  })

  it('键盘 ArrowRight 增加宽度', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.handleKeydown({ key: 'ArrowRight', preventDefault: () => {} })
    expect(store.userWidth).toBe(420 + 16)
  })

  it('键盘 ArrowLeft 减少宽度', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.handleKeydown({ key: 'ArrowLeft', preventDefault: () => {} })
    expect(store.userWidth).toBe(420 - 16)
  })

  it('键盘 Shift + ArrowRight 步长 ×4', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.handleKeydown({ key: 'ArrowRight', shiftKey: true, preventDefault: () => {} })
    expect(store.userWidth).toBe(420 + 64)
  })

  it('键盘 Home 设为最大宽度', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.handleKeydown({ key: 'Home', preventDefault: () => {} })
    expect(store.userWidth).toBe(MAX_HTML_SOURCE_PANEL_WIDTH)
  })

  it('键盘 End 设为最小宽度', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.handleKeydown({ key: 'End', preventDefault: () => {} })
    expect(store.userWidth).toBe(MIN_HTML_SOURCE_PANEL_WIDTH)
  })

  it('键盘 Enter / Space 重置为默认宽度', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500)
    const resize = useHtmlSourcePanelResize()

    resize.handleKeydown({ key: 'Enter', preventDefault: () => {} })
    expect(store.userWidth).toBeNull()

    store.setWidth(500)
    resize.handleKeydown({ key: ' ', preventDefault: () => {} })
    expect(store.userWidth).toBeNull()
  })

  it('其他按键不改变宽度', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    const preventDefault = vi.fn()
    resize.handleKeydown({ key: 'a', preventDefault })
    expect(store.userWidth).toBeNull()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('progress 计算属性返回 0-1 比例', () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    // 默认宽度 420 在 [240, 720] 中的比例
    const expected = (420 - 240) / (720 - 240)
    expect(resize.progress.value).toBeCloseTo(expected, 5)

    store.setWidth(MIN_HTML_SOURCE_PANEL_WIDTH)
    expect(resize.progress.value).toBeCloseTo(0, 5)

    store.setWidth(MAX_HTML_SOURCE_PANEL_WIDTH)
    expect(resize.progress.value).toBeCloseTo(1, 5)
  })

  it('minWidth / maxWidth / snapPoints 常量正确导出', () => {
    const resize = useHtmlSourcePanelResize()
    expect(resize.minWidth).toBe(MIN_HTML_SOURCE_PANEL_WIDTH)
    expect(resize.maxWidth).toBe(MAX_HTML_SOURCE_PANEL_WIDTH)
    expect(Array.isArray(resize.snapPoints)).toBe(true)
    expect(resize.snapPoints.length).toBeGreaterThan(0)
  })

  it('reset 调用 store.resetWidth', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500)
    const resize = useHtmlSourcePanelResize()
    resize.reset()
    expect(store.userWidth).toBeNull()
  })

  it('拖拽结束后清理 document 副作用', async () => {
    const store = useHtmlSourcePanelStore()
    const resize = useHtmlSourcePanelResize()

    resize.startResize(buildMouseEvent('mousedown', { clientX: 100 }))
    expect(document.body.style.userSelect).toBe('none')
    expect(document.body.style.cursor).toBe('col-resize')

    document.dispatchEvent(buildMouseEvent('mouseup'))
    await nextTick()
    expect(document.body.style.userSelect).toBe('')
    expect(document.body.style.cursor).toBe('')
  })
})