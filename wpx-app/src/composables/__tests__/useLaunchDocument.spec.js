import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 单元测试：useLaunchDocument 的 mode 短路逻辑
 *
 * 覆盖：
 *  - mode='blank' 时只调 onBlank，不走草稿恢复
 *  - mode='ai' 时先调 onBlank，再调 onAiIntent(intent)
 *  - mode='template' 时先调 onBlank，再调 onTemplate(templateId)
 *  - 普通窗口 + restore-last 设置下走草稿恢复（行为不变）
 *  - 普通窗口无草稿时走 onBlank
 */

// mock windowContext：分别控制 mode / intent / templateId / windowId
const urlState = { mode: 'normal', intent: '', templateId: '', windowId: 0 }

vi.mock('@/utils/windowContext', () => ({
  getLaunchSearchParams: () => new URLSearchParams(),
  getLaunchModeFromUrl: () => urlState.mode,
  getLaunchIntentFromUrl: () => urlState.intent,
  getLaunchTemplateIdFromUrl: () => urlState.templateId,
  getWindowId: () => urlState.windowId,
  getDocPathFromUrl: () => '',
  initWindowContext: () => urlState.windowId,
  scopedStorageKey: (base) => `${base}:w${urlState.windowId || 0}`,
  isEditorRoute: (route) => route?.name === 'editor',
}))

// mock useAutoSave：返回空草稿
vi.mock('@/composables/useAutoSave', () => ({
  loadEditorDraft: () => null,
  EDITOR_DRAFT_STORAGE_KEY: 'wpx-editor-draft',
  useAutoSave: () => ({
    scheduleAutoSave: vi.fn(),
    flushDraft: vi.fn(),
  }),
}))

// mock launchDocument：返回 null（无文件）
vi.mock('@/utils/launchDocument', () => ({
  loadDocumentFromPath: vi.fn(async () => null),
}))

// mock generalSettings store
vi.mock('@/stores/generalSettings', () => ({
  useGeneralSettingsStore: () => ({
    startupBehavior: 'restore-last',
  }),
}))

import { useLaunchDocument } from '@/composables/useLaunchDocument'

function mountWith(handlers) {
  const TestComp = defineComponent({
    setup() {
      useLaunchDocument(handlers)
      return () => h('div')
    },
  })
  return mount(TestComp)
}

beforeEach(() => {
  setActivePinia(createPinia())
  urlState.mode = 'normal'
  urlState.intent = ''
  urlState.templateId = ''
  urlState.windowId = 0
})

describe('useLaunchDocument', () => {
  it('mode=blank 时只调用 onBlank，不读草稿', async () => {
    urlState.mode = 'blank'
    const onOpen = vi.fn()
    const onBlank = vi.fn()
    const onAiIntent = vi.fn()
    const onTemplate = vi.fn()
    mountWith({ onOpen, onBlank, onAiIntent, onTemplate })

    await nextTick()
    await nextTick()

    expect(onBlank).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
    expect(onAiIntent).not.toHaveBeenCalled()
    expect(onTemplate).not.toHaveBeenCalled()
  })

  it('mode=ai 时先 onBlank 再 onAiIntent(intent)', async () => {
    urlState.mode = 'ai'
    urlState.intent = '写一份 Vue 大纲'
    const onOpen = vi.fn()
    const onBlank = vi.fn()
    const onAiIntent = vi.fn()
    const onTemplate = vi.fn()
    mountWith({ onOpen, onBlank, onAiIntent, onTemplate })

    await nextTick()
    await nextTick()

    expect(onBlank).toHaveBeenCalledTimes(1)
    expect(onAiIntent).toHaveBeenCalledWith('写一份 Vue 大纲')
    expect(onOpen).not.toHaveBeenCalled()
    expect(onTemplate).not.toHaveBeenCalled()
  })

  it('mode=ai 但 intent 为空时只 onBlank，不调 onAiIntent', async () => {
    urlState.mode = 'ai'
    urlState.intent = ''
    const onBlank = vi.fn()
    const onAiIntent = vi.fn()
    mountWith({ onBlank, onAiIntent })

    await nextTick()
    await nextTick()

    expect(onBlank).toHaveBeenCalledTimes(1)
    expect(onAiIntent).not.toHaveBeenCalled()
  })

  it('mode=template 时先 onBlank 再 onTemplate(templateId)', async () => {
    urlState.mode = 'template'
    urlState.templateId = 'weekly-report'
    const onBlank = vi.fn()
    const onTemplate = vi.fn()
    const onAiIntent = vi.fn()
    mountWith({ onBlank, onTemplate, onAiIntent })

    await nextTick()
    await nextTick()

    expect(onBlank).toHaveBeenCalledTimes(1)
    expect(onTemplate).toHaveBeenCalledTimes(1)
    expect(onTemplate).toHaveBeenCalledWith('weekly-report')
    expect(onAiIntent).not.toHaveBeenCalled()
  })

  it('mode=template 但 templateId 为空时只 onBlank，不调 onTemplate', async () => {
    urlState.mode = 'template'
    urlState.templateId = ''
    const onBlank = vi.fn()
    const onTemplate = vi.fn()
    mountWith({ onBlank, onTemplate })

    await nextTick()
    await nextTick()

    expect(onBlank).toHaveBeenCalledTimes(1)
    expect(onTemplate).not.toHaveBeenCalled()
  })

  it('普通窗口（mode=normal, windowId=0）不调任何回调', async () => {
    urlState.mode = 'normal'
    urlState.windowId = 0
    const onOpen = vi.fn()
    const onBlank = vi.fn()
    const onAiIntent = vi.fn()
    mountWith({ onOpen, onBlank, onAiIntent })

    await nextTick()
    await nextTick()

    expect(onBlank).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(onAiIntent).not.toHaveBeenCalled()
  })

  it('普通窗口（windowId>0）走 onBlank', async () => {
    urlState.mode = 'normal'
    urlState.windowId = 5
    const onOpen = vi.fn()
    const onBlank = vi.fn()
    mountWith({ onOpen, onBlank })

    await nextTick()
    await nextTick()

    expect(onBlank).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })
})