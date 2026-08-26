import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app'

describe('appStore — browsingTitle / displayDocumentTitle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('预览标题优先于文档标题显示', () => {
    const store = useAppStore()
    store.setDocumentTitle('未命名文档')
    store.setBrowsingTitle('预览：招聘启事')
    expect(store.displayDocumentTitle).toBe('预览：招聘启事')
  })

  it('关闭资料库时清除浏览标题', () => {
    const store = useAppStore()
    store.knowledgePanelOpen = true
    store.setBrowsingTitle('预览：A')
    store.closeKnowledgePanel()
    expect(store.knowledgePanelOpen).toBe(false)
    expect(store.browsingTitle).toBe(null)
    expect(store.displayDocumentTitle).toBe('未命名文档')
  })

  it('setDocumentTitleIfPresent 不覆盖空/未命名', () => {
    const store = useAppStore()
    store.setDocumentTitle('聘：AI 编程调试员')
    store.setDocumentTitleIfPresent('未命名文档')
    store.setDocumentTitleIfPresent('')
    expect(store.documentTitle).toBe('聘：AI 编程调试员')
    store.setDocumentTitleIfPresent('正文标题')
    expect(store.documentTitle).toBe('正文标题')
  })
})
