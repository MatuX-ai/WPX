import Image from '@tiptap/extension-image'

/** @typedef {'left' | 'right' | 'none'} ImageFloat */
/** @typedef {'fill' | 'narrow' | 'keep' | null} ImageFill */

/**
 * Image 扩展在 Tiptap 默认 src/alt/title/width/height 之外，额外提供三个排版属性：
 *  - align: 'left' | 'right' | 'center'   文本对齐偏好
 *  - float: 'left' | 'right' | 'none'    CSS float 布局
 *  - fill : 'fill' | 'narrow' | 'keep' | null  AI「对齐图片」本地指令最后一次应用的模式
 *
 * `fill` 是为了使 CSS 可以根据模式额外覆写 width（因为 HTML5 <img width="100%">
 * 会被浏览器当作 100 像素而非百分比），详见 EditorCore.vue / EditorLayout.vue 中的
 * `.editor-image[data-float='none'][data-fill='...']` 规则。
 */
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
      fill: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-fill')
          return raw === 'fill' || raw === 'narrow' || raw === 'keep' ? raw : null
        },
        renderHTML: (attributes) => {
          const value = attributes.fill
          if (value !== 'fill' && value !== 'narrow' && value !== 'keep') return {}
          return { 'data-fill': value }
        },
      },
    }
  },
})
