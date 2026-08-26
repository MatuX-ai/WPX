import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { CustomList } from '@/extensions/CustomList'
import ListBubbleMenu from '@/components/editor/ListBubbleMenu.vue'

/**
 * 单元测试：ListBubbleMenu
 *
 * 说明：
 *   Tiptap BubbleMenu 在 jsdom 下依赖 editor.view，渲染稳定性较差。
 *   本测试只验证：① 组件 props 接受 editor=null；② 组件导入了 ORDERED_STYLES /
 *   UNORDERED_STYLES / EMOJI_GLYPHS 预设数据并通过 emojiToImageUrl 转换；③ 不依赖
 *   BubbleMenu 内部 dom 渲染的纯函数路径。
 *
 *   完整的命令路径（setListStyleType / setListIcon / setListStart / unsetListStyle）
 *   由同目录下 CustomList.spec.js 覆盖；BubbleMenu 只是包装层。
 */

function makeEditor(content) {
  return new Editor({
    extensions: [StarterKit, CustomList],
    content,
  })
}

describe('ListBubbleMenu - props 合法性', () => {
  it('editor=null 时不抛出 prop 类型错误', () => {
    const wrapper = mount(ListBubbleMenu, {
      props: { editor: null },
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('editor 是合法 Tiptap 实例时组件正常挂载', () => {
    const editor = makeEditor('<ul><li><p>x</p></li></ul>')
    const wrapper = mount(ListBubbleMenu, {
      props: { editor },
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
    editor.destroy()
  })
})

describe('ListBubbleMenu - 预设数据完整性', () => {
  it('ORDERED_STYLES 含 7 种编号样式', async () => {
    const { ORDERED_STYLES } = await import('@/extensions/CustomList')
    expect(ORDERED_STYLES.length).toBe(7)
    const values = ORDERED_STYLES.map((s) => s.value)
    expect(values).toContain('upper-alpha')
    expect(values).toContain('lower-roman')
  })

  it('UNORDERED_STYLES 含 4 种无序符号', async () => {
    const { UNORDERED_STYLES } = await import('@/extensions/CustomList')
    expect(UNORDERED_STYLES.length).toBe(4)
    expect(UNORDERED_STYLES[0].value).toBe('disc')
  })

  it('EMOJI_GLYPHS 含至少 20 个符号', async () => {
    const { EMOJI_GLYPHS } = await import('@/extensions/CustomList')
    expect(EMOJI_GLYPHS.length).toBeGreaterThanOrEqual(20)
  })

  it('emojiToImageUrl 返回 url(...) 形式', async () => {
    const { emojiToImageUrl } = await import('@/extensions/CustomList')
    const url = emojiToImageUrl('✓')
    expect(url).toMatch(/^url\("data:image\/svg\+xml;utf8,/)
  })
})
