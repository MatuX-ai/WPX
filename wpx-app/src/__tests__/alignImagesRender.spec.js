import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorImage } from '@/extensions/EditorImage'
import { alignImages } from '@/composables/useMarkdownFormatter'

// Use jsdom environment
// Tiptap's DOMParser requires a real-ish DOM environment

function buildEditor() {
  const el = document.createElement('div')
  document.body.appendChild(el)

  const editor = new Editor({
    element: el,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      EditorImage.configure({ allowBase64: true, HTMLAttributes: { class: 'editor-image' } }),
    ],
    content: '<p>before</p><img src="https://example.com/a.jpg" alt="a" /><p>after</p>',
  })
  return { editor, el }
}

describe('alignImages 实际渲染验证', () => {
  it('fill 模式：setNodeMarkup 后渲染 HTML 含 width="100%"', () => {
    const { editor, el } = buildEditor()
    try {
      const before = editor.getHTML()
      console.log('[BEFORE]', before)
      // inject a couple of images
      editor.commands.setContent(
        '<p>start</p>' +
          '<img src="https://example.com/a.jpg" width="300" alt="a" />' +
          '<img src="https://example.com/b.jpg" alt="b" />' +
          '<p>end</p>',
        { emitUpdate: false },
      )
      const r = alignImages(editor, 'fill')
      expect(r.ok).toBe(true)
      expect(r.count).toBe(2)

      const html = editor.getHTML()
      console.log('[AFTER FILL]', html)

      // 验证 HTML 含 width="100%"
      expect(html).toContain('width="100%"')
    } finally {
      editor.destroy()
      el.remove()
    }
  })

  it('narrow 模式：渲染 HTML 含 width="65%"', () => {
    const { editor, el } = buildEditor()
    try {
      editor.commands.setContent(
        '<img src="https://example.com/a.jpg" />' +
          '<img src="https://example.com/b.jpg" />',
        { emitUpdate: false },
      )
      const r = alignImages(editor, 'narrow')
      expect(r.count).toBe(2)

      const html = editor.getHTML()
      console.log('[AFTER NARROW]', html)
      expect(html).toContain('width="65%"')
    } finally {
      editor.destroy()
      el.remove()
    }
  })

  it('HTML 导入：粘贴带 width 的图片后 alignImages 应能撑满宽度', () => {
    const { editor, el } = buildEditor()
    try {
      // 模拟 HTML 导入：原始 HTML 中含固定宽度图片
      const importedHtml =
        '<p>原始网页段落</p>' +
        '<img src="https://example.com/photo1.jpg" width="600" height="400" alt="图1" />' +
        '<img src="https://example.com/photo2.jpg" width="800" alt="图2" />' +
        '<img src="https://example.com/photo3.jpg" alt="图3" />'
      editor.commands.setContent(importedHtml, { emitUpdate: false })
      const r = alignImages(editor, 'fill')
      expect(r.count).toBe(3)

      const finalHtml = editor.getHTML()
      console.log('[FINAL]', finalHtml)

      // 验证：所有图片的 width 都是 "100%"，并且 height 被删除
      const imgMatches = [...finalHtml.matchAll(/<img[^>]*>/g)]
      expect(imgMatches.length).toBe(3)
      imgMatches.forEach((m) => {
        expect(m[0]).toContain('width="100%"')
        expect(m[0]).toContain('data-fill="fill"')
        expect(m[0]).toContain('data-align="center"')
        expect(m[0]).toContain('data-float="none"')
        expect(m[0]).not.toContain('height=')
      })
    } finally {
      editor.destroy()
      el.remove()
    }
  })

  it('narrow 模式：渲染 HTML 含 data-fill="narrow"、width="65%"', () => {
    const { editor, el } = buildEditor()
    try {
      editor.commands.setContent(
        '<img src="https://example.com/x.jpg" width="400" />',
        { emitUpdate: false },
      )
      const r = alignImages(editor, 'narrow')
      expect(r.count).toBe(1)
      const html = editor.getHTML()
      expect(html).toContain('width="65%"')
      expect(html).toContain('data-fill="narrow"')
      expect(html).toContain('data-align="center"')
      expect(html).toContain('data-float="none"')
    } finally {
      editor.destroy()
      el.remove()
    }
  })

  it('keep 模式：渲染 HTML 含 data-fill="keep"', () => {
    const { editor, el } = buildEditor()
    try {
      editor.commands.setContent(
        '<img src="https://example.com/x.jpg" />',
        { emitUpdate: false },
      )
      const r = alignImages(editor, 'keep')
      expect(r.count).toBe(1)
      const html = editor.getHTML()
      expect(html).toContain('data-fill="keep"')
      expect(html).toContain('data-float="none"')
    } finally {
      editor.destroy()
      el.remove()
    }
  })

  it('fill 模式：与现状一致则不入队、count=0，避免无谓 ProseMirror 渲染', () => {
    const { editor, el } = buildEditor()
    try {
      editor.commands.setContent(
        '<img src="https://example.com/x.jpg" width="100%" data-float="none" data-align="center" data-fill="fill" />',
        { emitUpdate: false },
      )
      // eslint-disable-next-line no-console
      console.log('[DEBUG attrs]', JSON.stringify(editor.state.doc.firstChild?.attrs))
      const before = editor.getJSON()
      const r = alignImages(editor, 'fill')
      expect(r.count).toBe(0)
      expect(JSON.stringify(editor.getJSON())).toBe(JSON.stringify(before))
    } finally {
      editor.destroy()
      el.remove()
    }
  })
})
