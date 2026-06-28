import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useHtmlSourcePanelStore,
  DEFAULT_HTML_SOURCE_PANEL_WIDTH,
  MIN_HTML_SOURCE_PANEL_WIDTH,
  MAX_HTML_SOURCE_PANEL_WIDTH,
} from '@/stores/htmlSourcePanel'

/**
 * 单元测试：HTML 源码面板 Store
 *
 * 覆盖：
 *  - 初始状态默认值
 *  - show / hide / toggle 切换
 *  - setWidth 范围夹紧
 *  - resetWidth / reset 行为
 *  - syncWithDocument 自动关闭语义
 */
describe('useHtmlSourcePanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态：visible=false, userWidth=null', () => {
    const store = useHtmlSourcePanelStore()
    expect(store.visible).toBe(false)
    expect(store.userWidth).toBeNull()
    expect(store.isCustomized).toBe(false)
  })

  it('effectiveWidth 默认等于 DEFAULT_HTML_SOURCE_PANEL_WIDTH', () => {
    const store = useHtmlSourcePanelStore()
    expect(store.effectiveWidth).toBe(DEFAULT_HTML_SOURCE_PANEL_WIDTH)
  })

  it('show / hide 切换可见性', () => {
    const store = useHtmlSourcePanelStore()
    store.show()
    expect(store.visible).toBe(true)
    store.hide()
    expect(store.visible).toBe(false)
  })

  it('toggle 翻转可见性', () => {
    const store = useHtmlSourcePanelStore()
    expect(store.visible).toBe(false)
    store.toggle()
    expect(store.visible).toBe(true)
    store.toggle()
    expect(store.visible).toBe(false)
  })

  it('setWidth 接受合法值', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500)
    expect(store.userWidth).toBe(500)
    expect(store.isCustomized).toBe(true)
    expect(store.effectiveWidth).toBe(500)
  })

  it('setWidth 超出上限夹紧到 MAX', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(MAX_HTML_SOURCE_PANEL_WIDTH + 500)
    expect(store.userWidth).toBe(MAX_HTML_SOURCE_PANEL_WIDTH)
  })

  it('setWidth 超出下限夹紧到 MIN', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(MIN_HTML_SOURCE_PANEL_WIDTH - 100)
    expect(store.userWidth).toBe(MIN_HTML_SOURCE_PANEL_WIDTH)
  })

  it('setWidth 忽略非数字值', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth('500') // 字符串
    expect(store.userWidth).toBeNull()
    store.setWidth(NaN)
    expect(store.userWidth).toBeNull()
    store.setWidth(Infinity)
    expect(store.userWidth).toBeNull()
  })

  it('setWidth 数值四舍五入', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500.4)
    expect(store.userWidth).toBe(500)
    store.setWidth(500.6)
    expect(store.userWidth).toBe(501)
  })

  it('resetWidth 清除用户宽度', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500)
    expect(store.isCustomized).toBe(true)
    store.resetWidth()
    expect(store.userWidth).toBeNull()
    expect(store.isCustomized).toBe(false)
  })

  it('reset 同时关闭面板与清空宽度', () => {
    const store = useHtmlSourcePanelStore()
    store.show()
    store.setWidth(500)
    store.reset()
    expect(store.visible).toBe(false)
    expect(store.userWidth).toBeNull()
  })

  it('syncWithDocument(false) 自动关闭面板', () => {
    const store = useHtmlSourcePanelStore()
    store.show()
    store.syncWithDocument(false)
    expect(store.visible).toBe(false)
  })

  it('syncWithDocument(true) 不影响面板状态', () => {
    const store = useHtmlSourcePanelStore()
    store.show()
    store.syncWithDocument(true)
    expect(store.visible).toBe(true)
  })

  it('hide 不清空宽度记忆', () => {
    const store = useHtmlSourcePanelStore()
    store.setWidth(500)
    store.hide()
    expect(store.userWidth).toBe(500)
    expect(store.isCustomized).toBe(true)
  })

  it('常量导出值稳定', () => {
    expect(DEFAULT_HTML_SOURCE_PANEL_WIDTH).toBe(420)
    expect(MIN_HTML_SOURCE_PANEL_WIDTH).toBe(240)
    expect(MAX_HTML_SOURCE_PANEL_WIDTH).toBe(720)
  })
})