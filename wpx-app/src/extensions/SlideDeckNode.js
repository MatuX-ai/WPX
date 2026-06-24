import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import SlideDeckNodeView from '@/components/editor/SlideDeckNodeView.vue'

/**
 * 演示文稿的默认 slides 数据（用于首次插入）
 */
export const DEFAULT_SLIDE_DECK_SLIDES = [
  {
    component: 'CoverSlide',
    props: {
      title: '新演示文稿',
      subtitle: '点击此处编辑副标题',
      theme: 'light',
    },
  },
  {
    component: 'TocSlide',
    props: {
      title: '目录',
      items: ['第一章', '第二章', '第三章'],
      theme: 'light',
    },
  },
  {
    component: 'EndSlide',
    props: {
      text: '感谢观看',
      theme: 'light',
    },
  },
]

/**
 * <SlideDeckNode> - Tiptap 自定义节点：演示文稿
 *
 * 节点属性：
 *   slides: string   // JSON 序列化的幻灯片数组（[{ component, props }, ...]）
 *   theme:  'light' | 'dark'  // 节点整体主题
 *
 * 命令：
 *   - insertSlideDeck({ slides?, theme?, pos? })  插入一个 SlideDeck 节点
 *   - updateSlideDeckData(data)                   更新节点属性
 *   - duplicateSlideDeck()                        复制当前选中的节点
 *
 * 行为：
 *   - atom 节点，作为整体存在，不可在节点内编辑文本
 *   - selectable + draggable，支持键盘删除 / 复制
 *   - NodeView 通过 VueNodeViewRenderer 渲染为 SlideDeckNodeView
 *   - 选中时由 NodeView 自身显示工具栏（翻页 / 全屏 / 导出 / 删除 / 复制）
 */
export const SlideDeckNode = Node.create({
  name: 'slideDeck',

  group: 'block',

  // 作为整体节点（无子内容）
  atom: true,

  // 可被选中和拖拽
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        'data-type': 'slide-deck',
        class: 'slide-deck-node-wrapper',
      },
    }
  },

  addAttributes() {
    return {
      /**
       * 幻灯片数据（JSON 字符串）。
       * 之所以用字符串而不是对象数组，是因为 Tiptap attribute 必须可序列化，
       * 写入 / 读出时统一用 JSON.stringify / JSON.parse。
       */
      slides: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-slides')
          if (!raw) return null
          try {
            // 验证是否为合法 JSON
            JSON.parse(raw)
            return raw
          } catch {
            return null
          }
        },
        renderHTML: (attributes) => {
          const value = attributes.slides || JSON.stringify(DEFAULT_SLIDE_DECK_SLIDES)
          return { 'data-slides': value }
        },
      },
      theme: {
        default: 'light',
        parseHTML: (element) => element.getAttribute('data-theme') || 'light',
        renderHTML: (attributes) => ({
          'data-theme': attributes.theme || 'light',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="slide-deck"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(SlideDeckNodeView)
  },

  addCommands() {
    return {
      /**
       * 在当前光标位置插入一个 SlideDeck 节点。
       * 用法：editor.chain().focus().insertSlideDeck().run()
       *      editor.chain().focus().insertSlideDeck({ theme: 'dark' }).run()
       */
      insertSlideDeck:
        (options = {}) =>
        ({ chain, editor }) => {
          const attrs = {
            slides:
              options.slides ||
              (options.slidesJson && options.slidesJson) ||
              JSON.stringify(DEFAULT_SLIDE_DECK_SLIDES),
            theme: options.theme || 'light',
          }
          // 在文档末尾（如果当前选区在空段落中）插入节点时，
          // 通过 chain 把光标移出节点，避免插入后节点仍处于选中态
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run()
        },

      /**
       * 更新当前选中 SlideDeck 节点的属性。
       * 用法：editor.commands.updateSlideDeckData({ theme: 'dark' })
       */
      updateSlideDeckData:
        (data = {}) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, data)
        },

      /**
       * 复制当前选中的 SlideDeck 节点。
       * 用法：editor.commands.duplicateSlideDeck()
       *
       * 实现：读取当前节点 attrs，在其后插入一个相同 attrs 的新节点，
       * 然后把选区移到新节点上。
       */
      duplicateSlideDeck:
        () =>
        ({ state, dispatch, editor: ed }) => {
          const { selection } = state
          if (!selection.node || selection.node.type.name !== this.name) {
            return false
          }
          const pos = selection.from
          const nodeSize = selection.node.nodeSize
          const attrs = { ...selection.node.attrs }
          if (dispatch) {
            const tr = state.tr
            const newNode = state.schema.nodes[this.name].create(attrs)
            const insertAt = pos + nodeSize
            tr.insert(insertAt, newNode)
            // 选区移回插入的新节点（使用 NodeSelection.near）
            try {
              const NodeSelectionCls = selection.constructor
              tr.setSelection(NodeSelectionCls.near(tr.doc.resolve(insertAt + 1)))
            } catch (e) {
              // 兑底：不改选区
            }
            dispatch(tr)
          }
          return true
        },
    }
  },

  /**
   * 键盘快捷键：
   *   - Cmd/Ctrl + D：复制选中的 SlideDeck
   *   - Backspace / Delete：删除（由 Tiptap 默认行为处理）
   */
  addKeyboardShortcuts() {
    return {
      'Mod-d': () => {
        const { selection } = this.editor.state
        if (selection.node && selection.node.type.name === this.name) {
          return this.editor.commands.duplicateSlideDeck()
        }
        return false
      },
    }
  },
})

export default SlideDeckNode
