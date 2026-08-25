import { Extension } from '@tiptap/core'

/**
 * 自定义列表扩展（CustomList）
 *
 * 背景：
 *   Tiptap StarterKit 自带的 bulletList / orderedList 仅支持默认样式：
 *     - ul: list-style-type: disc
 *     - ol: list-style-type: decimal
 *   并且不支持列表起始编号、行首符号图标等扩展能力。
 *
 *   本扩展通过 addGlobalAttributes 向 bulletList / orderedList 注入三个新 attrs：
 *     - listStyleType: CSS list-style-type 值（如 decimal / lower-alpha / upper-roman）
 *     - listStyleImage: list-style-image url()（用于 emoji / 自定义图标）
 *     - listStart: ol 起始编号（HTML <ol start="N">）
 *
 *   同时暴露 setListStyle / setListIcon / setListStart / unsetListStyle 四个命令，
 *   方便工具栏 / BubbleMenu / AI 本地指令调用。
 *
 * 注意：
 *   - attrs 全部 keepOnSplit=false：列表项拆分时不会复制样式到分裂出来的新列表节点。
 *   - listStyleImage 接受已编码的 URL（CSS 端可直接使用）。
 *   - emoji 字符不直接放入 listStyleImage（CSS 规定 url() 形式），
 *     调用方需先用辅助函数 emojiToImageUrl() 转成 SVG data URL。
 */

/**
 * 把 emoji 字符或文本符号转成 SVG data URL，作为 list-style-image 的取值。
 *
 * 实现说明：
 *   CSS list-style-image 仅接受 url() 形式，直接传 emoji 字符无效。
 *   这里把 emoji 嵌入 SVG 中并以 utf8 data URL 形式返回，浏览器原生支持。
 *
 * @param {string} glyph 单个 emoji 或文字符号（如 '✓' / '★' / '⏵'）
 * @returns {string} url('data:image/svg+xml;utf8,...') 形式
 */
export function emojiToImageUrl(glyph) {
  if (!glyph) return ''
  // 防御性转义：避免 SVG/XML 解析错误
  const safe = String(glyph)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">${safe}</text></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

/**
 * 预设的编号样式（list-style-type 取值）。
 * 浏览器原生支持，无需额外 CSS。
 */
export const ORDERED_STYLES = [
  { value: 'decimal', label: '1 2 3', sample: '1.' },
  { value: 'decimal-leading-zero', label: '01 02 03', sample: '01.' },
  { value: 'lower-alpha', label: 'a b c', sample: 'a.' },
  { value: 'upper-alpha', label: 'A B C', sample: 'A.' },
  { value: 'lower-roman', label: 'i ii iii', sample: 'i.' },
  { value: 'upper-roman', label: 'I II III', sample: 'I.' },
  { value: 'lower-greek', label: 'α β γ', sample: 'α.' },
]

/**
 * 预设的无序符号样式（list-style-type 取值）。
 */
export const UNORDERED_STYLES = [
  { value: 'disc', label: '实心圆 ●', sample: '●' },
  { value: 'circle', label: '空心圆 ○', sample: '○' },
  { value: 'square', label: '实心方块 ■', sample: '■' },
  { value: 'none', label: '无符号', sample: '·' },
]

/**
 * 预设的 emoji 行首符号（用作 list-style-image）。
 */
export const EMOJI_GLYPHS = [
  '✓', '✗', '★', '☆', '♥', '♦', '♣', '♠',
  '📌', '📎', '🔖', '📝', '💡', '⚡', '🔥', '🎯',
  '➡', '⬅', '⬆', '⬇', '🔹', '🔸', '🟢', '🔴',
]

/**
 * 把 attr 序列化成 inline style 字符串。
 * @param {object} attrs
 * @returns {string}
 */
function attrsToStyle(attrs) {
  const parts = []
  if (attrs.listStyleType) {
    parts.push(`list-style-type: ${attrs.listStyleType}`)
  }
  if (attrs.listStyleImage) {
    parts.push(`list-style-image: ${attrs.listStyleImage}`)
  }
  return parts.join('; ')
}

export const CustomList = Extension.create({
  name: 'customList',

  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          listStyleType: {
            default: null,
            parseHTML: (element) => element.style.listStyleType || null,
            renderHTML: (attributes) => {
              if (!attributes.listStyleType) return {}
              // 同步写出 inline style，以确保 getHTML() 输出可被还原
              const style = attrsToStyle(attributes)
              return style ? { style } : {}
            },
          },
          listStyleImage: {
            default: null,
            parseHTML: (element) => element.style.listStyleImage || null,
            renderHTML: (attributes) => {
              if (!attributes.listStyleImage) return {}
              const style = attrsToStyle(attributes)
              return style ? { style } : {}
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      /**
       * 通用 setListStyle：同时设置 listStyleType / listStyleImage（可选）以及
       * orderedList 的 start（起始编号）。
       *
       * 使用 'in' 检测传入的 key 是否被显式覆盖，避免 ?? 对 null/空字符串处理
       * 与预期不一致。
       *
       * 传入命令示例：
       *   ed.chain().focus().setListStyle({ listStyleType: 'upper-alpha' })
       *   ed.chain().focus().setListStyle({ listStyleImage: null })  // 清除
       *   ed.chain().focus().setListStyle({ listStart: 5 })           // ol 起始
       */
      setListStyle:
        (attrs = {}) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const { from, to } = selection
          let applied = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name !== 'bulletList' && node.type.name !== 'orderedList') return
            const next = {
              listStyleType: 'listStyleType' in attrs
                ? attrs.listStyleType
                : node.attrs.listStyleType ?? null,
              listStyleImage: 'listStyleImage' in attrs
                ? attrs.listStyleImage
                : node.attrs.listStyleImage ?? null,
            }
            // orderedList 才有 start（HTML <ol start="N">）；
            // 复用 starterKit 内置的 start attr，避免冲突。
            if (node.type.name === 'orderedList' && 'listStart' in attrs) {
              next.start = attrs.listStart
            }
            if (dispatch) {
              tr.setNodeMarkup(pos, undefined, next)
            }
            applied = true
          })

          return applied
        },

      /**
       * 单独设置编号样式（list-style-type），不影响图标。
       */
      setListStyleType:
        (listStyleType) =>
        ({ chain }) =>
          chain().focus().setListStyle({ listStyleType }).run(),

      /**
       * 单独设置行首符号（list-style-image）。
       * 接受 emoji 字符或已编码的 url()；emoji 字符会自动转成 SVG data URL。
       * 传入空字符串 / null 会清除。
       */
      setListIcon:
        (glyph) =>
        ({ chain }) => {
          const image = glyph ? emojiToImageUrl(glyph) : null
          return chain().focus().setListStyle({ listStyleImage: image }).run()
        },

      /**
       * 单独设置 ol 起始编号；传入 null 清除（恢复默认 1）。
       */
      setListStart:
        (start) =>
        ({ chain }) =>
          chain().focus().setListStyle({ listStart: start }).run(),

      /**
       * 清除所有自定义样式（回到默认 disc / decimal / start=1）。
       */
      unsetListStyle:
        () =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection
          let applied = false
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name !== 'bulletList' && node.type.name !== 'orderedList') return
            const next = {
              listStyleType: null,
              listStyleImage: null,
            }
            if (node.type.name === 'orderedList') {
              next.start = 1
            }
            if (dispatch) {
              tr.setNodeMarkup(pos, undefined, next)
            }
            applied = true
          })
          return applied
        },
    }
  },
})
