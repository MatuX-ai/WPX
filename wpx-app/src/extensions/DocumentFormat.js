import { Mark, mergeAttributes } from '@tiptap/core'

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
