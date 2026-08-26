import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import {
  KNOWLEDGE_PANEL_DEFAULT_WIDTH,
  KNOWLEDGE_PANEL_WIDTH_KEY,
  useKnowledgePanelResize,
} from '@/composables/useKnowledgePanelResize'

describe('useKnowledgePanelResize', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('默认宽度为 420', () => {
    const scope = effectScope()
    const api = scope.run(() => useKnowledgePanelResize({ persist: false }))
    expect(api.effectiveWidth.value).toBe(KNOWLEDGE_PANEL_DEFAULT_WIDTH)
    scope.stop()
  })

  it('右拖变宽、左拖变窄', () => {
    const scope = effectScope()
    const api = scope.run(() => useKnowledgePanelResize({ persist: false }))
    api.startResize({ button: 0, clientX: 100, preventDefault() {}, stopPropagation() {} })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 160 }))
    expect(api.effectiveWidth.value).toBe(KNOWLEDGE_PANEL_DEFAULT_WIDTH + 60)
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 80 }))
    expect(api.effectiveWidth.value).toBe(KNOWLEDGE_PANEL_DEFAULT_WIDTH - 20)
    document.dispatchEvent(new MouseEvent('mouseup'))
    scope.stop()
  })

  it('持久化写入 localStorage', () => {
    const scope = effectScope()
    const api = scope.run(() => useKnowledgePanelResize({ persist: true }))
    api.setWidth(520)
    expect(localStorage.getItem(KNOWLEDGE_PANEL_WIDTH_KEY)).toBe('520')
    scope.stop()
  })
})
