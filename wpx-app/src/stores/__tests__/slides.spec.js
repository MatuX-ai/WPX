import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { SLIDE_TEMPLATES, useSlidesStore } from '@/stores/slides'

describe('slides - 幻灯片 Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态为空', () => {
    const store = useSlidesStore()
    expect(store.outline).toBe('')
    expect(store.slides).toEqual([])
    expect(store.theme).toBe('light')
    expect(store.selectedTemplate).toBeNull()
    expect(store.totalPages).toBe(0)
  })

  it('设置大纲与幻灯片', () => {
    const store = useSlidesStore()
    store.setOutline('# 主标题\n- 要点 1\n- 要点 2')
    expect(store.outline).toContain('# 主标题')

    const next = [
      { component: 'CoverSlide', props: { title: 'A' } },
      { component: 'TextSlide', props: { title: 'B', bulletPoints: ['x'] } },
    ]
    store.setSlides(next)
    expect(store.slides).toHaveLength(2)
    expect(store.totalPages).toBe(2)
  })

  it('addSlide 不可变追加到末尾', () => {
    const store = useSlidesStore()
    store.setSlides([{ component: 'TextSlide', props: { title: 'p1' } }])
    const before = store.slides
    store.addSlide(1, { component: 'TextSlide', props: { title: 'p2' } })
    // 不可变校验：原数组未被修改
    expect(before).toHaveLength(1)
    expect(store.slides).toHaveLength(2)
    expect(store.slides[1].props.title).toBe('p2')
  })

  it('removeSlide 越界返回 false', () => {
    const store = useSlidesStore()
    store.setSlides([
      { component: 'TextSlide', props: { title: 'a' } },
      { component: 'TextSlide', props: { title: 'b' } },
    ])
    const ok = store.removeSlide(5)
    expect(ok).toBe(false)
    expect(store.slides).toHaveLength(2)
  })

  it('modifySlide 合并 changes', () => {
    const store = useSlidesStore()
    store.setSlides([
      { component: 'TextSlide', props: { title: 'orig', bulletPoints: ['x'] } },
    ])
    store.modifySlide(0, { title: 'updated' })
    expect(store.slides[0].props.title).toBe('updated')
    expect(store.slides[0].props.bulletPoints).toEqual(['x'])
  })

  it('selectTemplate 切换主题色', () => {
    const store = useSlidesStore()
    const tpl = store.setTemplate({ templateId: 'tech' })
    expect(tpl).toBeTruthy()
    expect(tpl.label).toBe('科技感风')
    expect(store.theme).toBe('dark')
  })

  it('selectTemplate custom 接收描述', () => {
    const store = useSlidesStore()
    const tpl = store.setTemplate({ templateId: 'custom', custom: '特斯拉发布会极简风' })
    expect(tpl.customNote).toContain('特斯拉')
  })

  it('SLIDE_TEMPLATES 至少包含四种模板', () => {
    const ids = SLIDE_TEMPLATES.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['business', 'tech', 'fresh', 'custom']))
  })

  it('reset 清空所有状态', () => {
    const store = useSlidesStore()
    store.setOutline('# x')
    store.setSlides([{ component: 'TextSlide', props: { title: 'a' } }])
    store.reset()
    expect(store.outline).toBe('')
    expect(store.slides).toEqual([])
  })
})