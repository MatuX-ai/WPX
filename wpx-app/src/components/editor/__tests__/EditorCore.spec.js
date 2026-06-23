import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import EditorCore from '../EditorCore.vue'
import { useEditorStore } from '@/stores/editor'

vi.mock('@/utils/electron', () => ({
  isElectron: () => false,
  getElectronAPI: () => null,
}))

vi.mock('@/composables/useUserHabits', () => ({
  useUserHabits: () => ({
    bindEditor: vi.fn(),
    unbindEditor: vi.fn(),
    applyFormat: vi.fn(),
  }),
  extractFormatFromEditor: vi.fn(() => ({})),
}))

vi.mock('@/composables/useDragDrop', () => ({
  editorDragOutProps: { handleDOMEvents: {} },
  useDragDrop: () => ({
    isDragOver: false,
    dropZoneHandlers: {
      dragenter: vi.fn(),
      dragover: vi.fn(),
      dragleave: vi.fn(),
      drop: vi.fn(),
    },
  }),
}))

vi.mock('@/composables/useGlobalShortcuts', () => ({
  shortcutTooltip: (label) => label,
}))

vi.mock('@/composables/useWindowSize', () => ({
  useWindowSize: () => ({
    isToolbarIconOnly: { value: false },
    breakpoint: { value: 'lg' },
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/composables/useEditorOverlay', () => ({
  useEditorOverlayOptional: () => null,
}))

vi.mock('@/components/editor/TableBubbleMenu.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('@/components/editor/ImageBubbleMenu.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('@/components/context/EditorContextMenu.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('@/components/editor/FindReplaceDialog.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('@/components/editor/ImageUrlDialog.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('@/components/editor/FontFamilySelect.vue', () => ({
  default: { template: '<div />' },
}))

async function mountEditor(props = {}) {
  const wrapper = mount(EditorCore, {
    props: {
      content: '<p>Hello world</p>',
      ...props,
    },
    attachTo: document.body,
  })

  await flushPromises()
  await nextTick()
  await nextTick()

  return wrapper
}

async function destroyEditor(wrapper) {
  const editor = wrapper.vm.getEditor?.()
  editor?.destroy()
  wrapper.unmount()
  await nextTick()
}

async function getEditorInstance(wrapper) {
  const editor = wrapper.vm.getEditor?.()
  if (!editor) {
    throw new Error('Editor instance is not ready')
  }
  return editor
}

async function clickDialogButton(wrapper, label) {
  const button = wrapper
    .findAll('button')
    .find((node) => node.text().includes(label))

  if (!button) {
    throw new Error(`Button containing "${label}" not found`)
  }

  await button.trigger('click')
}

describe('EditorCore.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('正常渲染', () => {
    it('应渲染工具栏与编辑器内容区', async () => {
      const wrapper = await mountEditor()

      expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
      expect(wrapper.find('.editor-content').exists()).toBe(true)
      expect(wrapper.find('.ProseMirror').text()).toContain('Hello world')

      await destroyEditor(wrapper)
    })

    it('应渲染插入表格按钮', async () => {
      const wrapper = await mountEditor()

      expect(wrapper.find('[aria-label="插入表格"]').exists()).toBe(true)

      await destroyEditor(wrapper)
    })
  })

  describe('文本选中', () => {
    it('选中文本应同步到 editorStore 并显示选中提示', async () => {
      const wrapper = await mountEditor()
      const editor = await getEditorInstance(wrapper)
      const editorStore = useEditorStore()

      editor.commands.setTextSelection({ from: 1, to: 6 })
      await nextTick()

      expect(editorStore.selection.hasSelection).toBe(true)
      expect(editorStore.selection.text).toBe('Hello')
      expect(wrapper.text()).toContain('已选中 5 字')

      await destroyEditor(wrapper)
    })

    it('无选区时不应显示选中提示', async () => {
      const wrapper = await mountEditor()
      const editor = await getEditorInstance(wrapper)

      editor.commands.setTextSelection({ from: 1, to: 1 })
      await nextTick()

      expect(wrapper.text()).not.toContain('已选中')

      await destroyEditor(wrapper)
    })
  })

  describe('AI 替换', () => {
    it('收到 replaceRequest 时应替换选区文本', async () => {
      const wrapper = await mountEditor({ content: '<p>原始文本</p>' })
      const editor = await getEditorInstance(wrapper)
      const editorStore = useEditorStore()

      editor.commands.setTextSelection({ from: 1, to: 5 })
      await nextTick()

      editorStore.requestReplace('优化后', { from: 1, to: 5 })
      await nextTick()
      await flushPromises()

      expect(editor.getText()).toContain('优化后')
      expect(editor.getText()).not.toContain('原始')
      expect(editorStore.replaceRequest).toBeNull()

      await destroyEditor(wrapper)
    })

    it('替换后应触发 change 事件', async () => {
      const wrapper = await mountEditor({ content: '<p>待替换</p>' })
      const editor = await getEditorInstance(wrapper)
      const editorStore = useEditorStore()

      editor.commands.setTextSelection({ from: 1, to: 4 })
      await nextTick()

      editorStore.requestReplace('新内容', { from: 1, to: 4 })
      await nextTick()
      await flushPromises()

      const changeEvents = wrapper.emitted('change')
      expect(changeEvents?.length).toBeGreaterThan(0)
      expect(changeEvents.at(-1)[0]).toMatchObject({
        html: expect.any(String),
        json: expect.any(Object),
        markdown: expect.any(String),
      })

      await destroyEditor(wrapper)
    })
  })

  describe('表格插入', () => {
    it('确认插入表格后应在文档中生成 table 节点', async () => {
      const wrapper = await mountEditor()
      const editor = await getEditorInstance(wrapper)

      await wrapper.get('[aria-label="插入表格"]').trigger('click')
      await nextTick()

      expect(wrapper.find('#table-dialog-title').exists()).toBe(true)

      await clickDialogButton(wrapper, '插入')
      await nextTick()

      expect(editor.getHTML()).toContain('<table')
      expect(editor.getHTML()).toContain('<th')

      await destroyEditor(wrapper)
    })

    it('取消插入表格时不应添加 table 节点', async () => {
      const wrapper = await mountEditor()
      const editor = await getEditorInstance(wrapper)
      const htmlBefore = editor.getHTML()

      await wrapper.get('[aria-label="插入表格"]').trigger('click')
      await nextTick()
      await clickDialogButton(wrapper, '取消')
      await nextTick()

      expect(editor.getHTML()).toBe(htmlBefore)
      expect(wrapper.find('#table-dialog-title').exists()).toBe(false)

      await destroyEditor(wrapper)
    })
  })

  describe('边界条件', () => {
    it('replaceRequest 为空时不应修改文档', async () => {
      const wrapper = await mountEditor({ content: '<p>保持不变</p>' })
      const editor = await getEditorInstance(wrapper)
      const htmlBefore = editor.getHTML()

      await nextTick()

      expect(editor.getHTML()).toBe(htmlBefore)

      await destroyEditor(wrapper)
    })

    it('多行替换内容应插入多个段落', async () => {
      const wrapper = await mountEditor({ content: '<p>段落</p>' })
      const editor = await getEditorInstance(wrapper)
      const editorStore = useEditorStore()

      editor.commands.setTextSelection({ from: 1, to: 3 })
      await nextTick()

      editorStore.requestReplace('第一行\n第二行', { from: 1, to: 3 })
      await nextTick()
      await flushPromises()

      const json = editor.getJSON()
      const paragraphCount = json.content?.filter((node) => node.type === 'paragraph').length
      expect(paragraphCount).toBeGreaterThanOrEqual(2)

      await destroyEditor(wrapper)
    })

    it('空内容初始化时应渲染可编辑区域', async () => {
      const wrapper = await mountEditor({ content: '' })

      expect(wrapper.find('.ProseMirror').exists()).toBe(true)

      await destroyEditor(wrapper)
    })
  })
})
