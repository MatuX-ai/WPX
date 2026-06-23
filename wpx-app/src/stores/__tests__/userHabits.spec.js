import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserHabitsStore } from '@/stores/userHabits'

describe('userHabits — 记忆数据与智能模板', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('清除记忆数据后智能模板恢复为空', () => {
    const store = useUserHabitsStore()

    for (let index = 0; index < 3; index += 1) {
      store.recordSave('周报', { font: 'Arial', fontSize: '16px' })
    }

    expect(store.getSmartTemplates().length).toBeGreaterThan(0)

    store.resetHabits()

    expect(store.getSmartTemplates()).toEqual([])
    expect(store.getRecentDocumentTypes()).toEqual([])
    expect(store.data.saves).toEqual([])
  })
})
