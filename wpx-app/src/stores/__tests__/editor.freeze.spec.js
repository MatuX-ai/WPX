import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'

describe('editor store selection freeze', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('freezeSelectionFromEditor 在失焦折叠后仍使用 lastNonEmptySelection', () => {
    const store = useEditorStore()
    store.setSelection({ text: '这是一段需要润色的文字', from: 1, to: 12, hasSelection: true })
    store.setSelection({ text: '', from: 1, to: 1, hasSelection: false })
    store.freezeSelectionFromEditor()
    expect(store.frozenSelection?.hasSelection).toBe(true)
    expect(store.frozenSelection?.text).toBe('这是一段需要润色的文字')
    expect(store.frozenSelection?.from).toBe(1)
    expect(store.frozenSelection?.to).toBe(12)
  })
})
