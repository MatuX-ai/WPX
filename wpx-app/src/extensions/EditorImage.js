import Image from '@tiptap/extension-image'

/** @typedef {'left' | 'right' | 'none'} ImageFloat */

export const EditorImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') || 'left',
        renderHTML: (attributes) => ({
          'data-align': attributes.align || 'left',
        }),
      },
      float: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-float') || 'left',
        renderHTML: (attributes) => ({
          'data-float': attributes.float || 'left',
        }),
      },
    }
  },
})
