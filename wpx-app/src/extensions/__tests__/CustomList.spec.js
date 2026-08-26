import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { CustomList, emojiToImageUrl, ORDERED_STYLES, UNORDERED_STYLES, EMOJI_GLYPHS } from '@/extensions/CustomList'

/**
 * 单元测试：CustomList 扩展
 *
 * 覆盖：
 *  1. emojiToImageUrl 纯函数（转义、返回 URL 形式）
 *  2. 预设列表条目的完整性
 *  3. setListStyleType / setListIcon / setListStart / unsetListStyle 命令
 *  4. parseHTML / renderHTML 双向序列化
 *  5. 列表起始编号对 MD 导出的影响
 */

function makeEditor() {
  return new Editor({
    extensions: [StarterKit, CustomList],
    content: '<ul><li><p>第一个</p></li><li><p>第二个</p></li></ul>',
  })
}

function makeOrderedEditor() {
  return new Editor({
    extensions: [StarterKit, CustomList],
    content: '<ol><li><p>第一个</p></li><li><p>第二个</p></li></ol>',
  })
}

describe('CustomList 辅助函数', () => {
  it('emojiToImageUrl：返回 url(data:image/svg+xml;utf8,...) 形式', () => {
    const url = emojiToImageUrl('✓')
    expect(url).toMatch(/^url\("data:image\/svg\+xml;utf8,/)
    expect(url).toContain('%E2%9C%93') // encodeURIComponent('✓') = %E2%9C%93
  })

  it('emojiToImageUrl：转义 < > & 以避免 SVG 解析错误', () => {
    // emojiToImageUrl 先 HTML escape 再 encodeURIComponent：
    // <  →  &lt;  →  %26lt%3B
    const url = emojiToImageUrl('<script>')
    expect(url).toContain('%26lt%3B') // &lt; 的 URL 编码
    expect(url).toContain('%26gt%3B') // &gt; 的 URL 编码
  })

  it('emojiToImageUrl：空字符串返回空字符串', () => {
    expect(emojiToImageUrl('')).toBe('')
  })

  it('ORDERED_STYLES 包含 7 种编号样式', () => {
    expect(ORDERED_STYLES).toHaveLength(7)
    const values = ORDERED_STYLES.map((s) => s.value)
    expect(values).toContain('decimal')
    expect(values).toContain('upper-alpha')
    expect(values).toContain('lower-roman')
  })

  it('UNORDERED_STYLES 包含 4 种无序符号', () => {
    expect(UNORDERED_STYLES).toHaveLength(4)
    const values = UNORDERED_STYLES.map((s) => s.value)
    expect(values).toEqual(['disc', 'circle', 'square', 'none'])
  })

  it('EMOJI_GLYPHS 包含至少 20 个预设符号', () => {
    expect(EMOJI_GLYPHS.length).toBeGreaterThanOrEqual(20)
  })
})

describe('CustomList 命令 - 编号样式', () => {
  it('setListStyleType("upper-alpha") 把 ul 节点加上 list-style-type: upper-alpha', () => {
    const editor = makeEditor()
    editor.commands.setListStyleType('upper-alpha')
    const html = editor.getHTML()
    expect(html).toMatch(/list-style-type:\s*upper-alpha/)
    editor.destroy()
  })

  it('setListStyle 命令可同时设置 listStyleType / listStyleImage / listStart', () => {
    const editor = makeOrderedEditor()
    const ok = editor.commands.setListStyle({
      listStyleType: 'lower-roman',
      listStart: 5,
    })
    expect(ok).toBe(true)
    const html = editor.getHTML()
    expect(html).toMatch(/list-style-type:\s*lower-roman/)
    expect(html).toMatch(/start="5"/)
    editor.destroy()
  })

  it('setListStart(5) 给 ol 加上 start="5"', () => {
    const editor = makeOrderedEditor()
    editor.commands.setListStart(5)
    expect(editor.getHTML()).toContain('start="5"')
    editor.destroy()
  })
})

describe('CustomList 命令 - 行首符号', () => {
  it('setListIcon("✓") 给 ul 节点加上 list-style-image 内联 SVG', () => {
    const editor = makeEditor()
    const ok = editor.commands.setListIcon('✓')
    expect(ok).toBe(true)
    const html = editor.getHTML()
    expect(html).toMatch(/list-style-image:/)
    expect(html).toContain('data:image/svg+xml;utf8')
    editor.destroy()
  })

  it('setListIcon("") 等价于清除 list-style-image', () => {
    const editor = makeEditor()
    editor.commands.setListIcon('✓')
    editor.commands.setListIcon('')
    const html = editor.getHTML()
    expect(html).not.toContain('list-style-image')
    editor.destroy()
  })
})

describe('CustomList 命令 - 清除', () => {
  it('unsetListStyle 清除所有自定义样式', () => {
    const editor = makeEditor()
    editor.commands.setListStyleType('lower-alpha')
    editor.commands.setListIcon('★')
    editor.commands.unsetListStyle()
    const html = editor.getHTML()
    expect(html).not.toContain('list-style-type')
    expect(html).not.toContain('list-style-image')
    editor.destroy()
  })
})

describe('CustomList round-trip 序列化', () => {
  it('setListStyleType 后 getJSON 再 setContent 能还原 attrs', () => {
    const editor = makeEditor()
    editor.commands.setListStyleType('upper-roman')
    const json = editor.getJSON()
    const type = json.content[0].type
    expect(type).toBe('bulletList')
    expect(json.content[0].attrs.listStyleType).toBe('upper-roman')

    // 重建编辑器并 setContent 还原
    const editor2 = new Editor({
      extensions: [StarterKit, CustomList],
      content: json,
    })
    const html = editor2.getHTML()
    expect(html).toMatch(/list-style-type:\s*upper-roman/)
    editor2.destroy()
  })

  it('listStyleImage 可通过 getHTML 持久化到 DOM，并在新编辑器中 parse 还原', () => {
    const editor = makeEditor()
    editor.commands.setListStyleType('decimal')
    editor.commands.setListIcon('🔥')
    const html = editor.getHTML()
    expect(html).toContain('list-style-image:')

    const editor2 = new Editor({
      extensions: [StarterKit, CustomList],
      content: html,
    })
    const attrs = editor2.getJSON().content[0].attrs
    expect(attrs.listStyleType).toBe('decimal')
    expect(attrs.listStyleImage).toContain('data:image/svg+xml;utf8')
    editor2.destroy()
  })
})
