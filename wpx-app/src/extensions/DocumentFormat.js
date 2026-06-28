import { Extension, Mark, mergeAttributes } from '@tiptap/core'

/**
 * 段落缩进（data-indent）全局属性扩展
 *
 * 背景：
 *   ProseMirror 的 node attrs 必须是 schema 中显式声明的字段；
 *   如果 schema 里没有 `data-indent`，调用 `tr.setNodeMarkup(pos, null, { 'data-indent': '2em' })`
 *   时该属性会被 PM 直接丢弃，HTML 渲染也就不会带上这个属性。
 *
 *   WPX MD 智能排版引擎（useMarkdownFormatter）通过 `data-indent` 给段落加首行缩进，
 *   再由 EditorCore 的 CSS 选择器 `[data-indent='2em'] { text-indent: 2em }` 真正渲染。
 *
 *   本扩展通过 `addGlobalAttributes` 把 `data-indent` 注入到 paragraph / heading 的 schema，
 *   这样 PM 就会保留这个属性，并在 `renderHTML` 时输出到 DOM 上。
 *
 * 注意：data-indent 是 CSS 层面的概念（text-indent），不要与 PM 原生的 indent 混淆。
 */
export const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          dataIndent: {
            default: null,
            // ProseMirror 不允许属性名带 `-`，但允许在 parseHTML/renderHTML 阶段
            // 与 DOM 真实属性互转时使用连字符。
            parseHTML: (element) => element.getAttribute('data-indent'),
            renderHTML: (attributes) => {
              if (!attributes.dataIndent) return {}
              return { 'data-indent': attributes.dataIndent }
            },
            // 段落拆分时（如回车换行）保留缩进设置
            keepOnSplit: true,
          },
        },
      },
    ]
  },
})

export const FontFamily = Mark.create({
  name: 'fontFamily',

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily?.replace(/['"]/g, '') || null,
        renderHTML: (attributes) => {
          if (!attributes.fontFamily) return {}
          return { style: `font-family: ${attributes.fontFamily}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[style*="font-family"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily) =>
        ({ chain }) => {
          if (!fontFamily) {
            return chain().focus().unsetMark(this.name).run()
          }
          return chain().focus().setMark(this.name, { fontFamily }).run()
        },
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain().focus().unsetMark(this.name).run(),
    }
  },
})

export const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {}
          return { style: `font-size: ${attributes.fontSize}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[style*="font-size"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})

export const LineHeight = Mark.create({
  name: 'lineHeight',

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      lineHeight: {
        default: null,
        parseHTML: (element) => element.style.lineHeight || null,
        renderHTML: (attributes) => {
          if (!attributes.lineHeight) return {}
          return { style: `line-height: ${attributes.lineHeight}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[style*="line-height"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})
