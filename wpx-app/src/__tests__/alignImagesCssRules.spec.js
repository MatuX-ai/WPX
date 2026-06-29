import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * CSS 静态扫描测试：保证引入 EditorCore.vue / EditorLayout.vue 后，
 * AI「对齐图片」本地指令依赖的 CSS 选择器仍然存在。
 *
 * 这些断言是一次性快照——若有人删除/重命名相关 CSS 规则，会立即失败，
 * 提醒检查视觉层是否仍能「等比例撑满宽度」。
 */
describe('图片对齐相关 CSS 静态检查', () => {
  function read(file) {
    return readFileSync(resolve(__dirname, '..', file), 'utf-8')
  }

  it('EditorCore.vue 包含 fill/narrow/keep 三档 CSS 规则', () => {
    const css = read('components/editor/EditorCore.vue')
    expect(css).toContain('.editor-image[data-float=\'none\']')
    expect(css).toMatch(/\.editor-image\[data-float='none'\][^{]*\{[^}]*width:\s*100%/)
    expect(css).toContain('.editor-image[data-float=\'none\'][data-fill=\'narrow\']')
    expect(css).toContain('.editor-image[data-float=\'none\'][data-fill=\'keep\']')
  })

  it('EditorLayout.vue 焦点模式同样支持三档 CSS', () => {
    const css = read('layouts/EditorLayout.vue')
    expect(css).toContain('editor-layout__editor--focus')
    expect(css).toContain('data-fill=\'fill\'')
    expect(css).toContain('data-fill=\'narrow\'')
    expect(css).toContain('data-fill=\'keep\'')
  })

  it('html-source-panel.css 不再设置 overflow: hidden（避免阻断滚动）', () => {
    const css = read('styles/html-source-panel.css')
    // 抽取 .editor-layout__main 块
    const block = css.match(/\.editor-layout__main\s*\{[^}]*\}/)
    expect(block, 'expected .editor-layout__main rule block').toBeTruthy()
    // 关键：不能存在直接的 overflow: hidden（在我们的新设计里改成 overflow-x: hidden）
    expect(block[0]).not.toMatch(/(^|\s)overflow:\s*hidden\s*;/)
    expect(block[0]).toMatch(/overflow-x:\s*hidden/)
  })
})
