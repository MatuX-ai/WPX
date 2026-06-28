import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 单元测试：MD 智能排版引擎
 *
 * - detectMarkdown / extractMarkdownSnippet：直接函数测试
 * - getTemplateList / getTemplateById：模板元数据测试
 * - formatDocument / alignImages：通过 mock editor 验证 tr 调用
 * - getDocumentHasMarkdown / hasImagesInDoc / getDefaultImageAlignMode：通过 descendants mock 测试
 */

import {
  detectMarkdown,
  detectMarkdownMarkers,
  extractMarkdownSnippet,
} from '@/utils/markdownDetector'
import {
  MARKDOWN_TEMPLATES,
  formatDocument,
  alignImages,
  getTemplateList,
  getTemplateById,
  getDocumentHasMarkdown,
  hasImagesInDoc,
  getDefaultImageAlignMode,
} from '@/composables/useMarkdownFormatter'

/* ───────────── detectMarkdown ───────────── */
describe('detectMarkdown', () => {
  it('空字符串与非字符串返回 false', () => {
    expect(detectMarkdown('')).toBe(false)
    expect(detectMarkdown(null)).toBe(false)
    expect(detectMarkdown(undefined)).toBe(false)
    expect(detectMarkdown(123)).toBe(false)
  })

  it('短文本（< 2 字符）返回 false', () => {
    expect(detectMarkdown('a')).toBe(false)
  })

  it('纯文本不含 MD 标记返回 false', () => {
    expect(detectMarkdown('这是一段普通的纯文本内容，没有任何 Markdown 标记')).toBe(false)
    expect(detectMarkdown('hello world')).toBe(false)
  })

  it('识别 # 标题', () => {
    expect(detectMarkdown('# 一级标题')).toBe(true)
    expect(detectMarkdown('## 二级标题')).toBe(true)
    expect(detectMarkdown('### 三级')).toBe(true)
  })

  it('识别无序列表 - 与 *', () => {
    expect(detectMarkdown('- 项目一')).toBe(true)
    expect(detectMarkdown('* 项目一')).toBe(true)
    expect(detectMarkdown('+ 项目一')).toBe(true)
  })

  it('识别有序列表 1.', () => {
    expect(detectMarkdown('1. 第一项')).toBe(true)
    expect(detectMarkdown('2. 第二项')).toBe(true)
  })

  it('识别引用 >', () => {
    expect(detectMarkdown('> 引用内容')).toBe(true)
  })

  it('识别表格 |', () => {
    expect(detectMarkdown('| 列1 | 列2 |\n| --- | --- |')).toBe(true)
  })

  it('识别图片与链接', () => {
    expect(detectMarkdown('![alt](https://example.com/a.jpg)')).toBe(true)
    expect(detectMarkdown('[文字](https://example.com)')).toBe(true)
  })

  it('识别加粗与斜体', () => {
    expect(detectMarkdown('**加粗**')).toBe(true)
    expect(detectMarkdown('__加粗__')).toBe(true)
    expect(detectMarkdown('*斜体*')).toBe(true)
  })

  it('识别分隔线 --- ***', () => {
    expect(detectMarkdown('---')).toBe(true)
    expect(detectMarkdown('***')).toBe(true)
  })

  it('代码块内的 # 不被识别（避免误报）', () => {
    expect(detectMarkdown('```js\n# 这不是标题\nconsole.log(1)\n```')).toBe(false)
  })
})

describe('detectMarkdownMarkers', () => {
  it('返回排序后的命中标记数组', () => {
    const markers = detectMarkdownMarkers('# 标题\n- 列表\n| 表格 |')
    expect(Array.isArray(markers)).toBe(true)
    expect(markers.length).toBeGreaterThan(0)
    expect(markers).toContain('#')
    expect(markers).toContain('-')
  })

  it('纯文本返回空数组', () => {
    expect(detectMarkdownMarkers('普通文本')).toEqual([])
  })
})

describe('extractMarkdownSnippet', () => {
  it('截取前若干字符并去除换行', () => {
    const text = '# 标题\n正文内容\n更多内容'
    const snippet = extractMarkdownSnippet(text, 10)
    expect(snippet.length).toBeLessThanOrEqual(10)
    expect(snippet).not.toContain('\n')
  })

  it('短文本不截断', () => {
    expect(extractMarkdownSnippet('# 标题', 80)).toBe('# 标题')
  })

  it('空文本返回空字符串', () => {
    expect(extractMarkdownSnippet('', 80)).toBe('')
  })
})

/* ───────────── 模板元数据 ───────────── */
describe('MARKDOWN_TEMPLATES / getTemplateList / getTemplateById', () => {
  it('定义了 6 个模板（含网页存档）', () => {
    expect(Object.keys(MARKDOWN_TEMPLATES)).toHaveLength(6)
  })

  it('包含全部 6 个 id', () => {
    const ids = Object.keys(MARKDOWN_TEMPLATES)
    expect(ids).toEqual(expect.arrayContaining(['article', 'report', 'official', 'lesson-plan', 'paper', 'webpage-archive']))
  })

  it('getTemplateList 返回 6 项元数据', () => {
    const list = getTemplateList()
    expect(list).toHaveLength(6)
    list.forEach((tpl) => {
      expect(tpl).toHaveProperty('id')
      expect(tpl).toHaveProperty('label')
      expect(tpl).toHaveProperty('description')
    })
  })

  it('getTemplateById 返回正确模板', () => {
    expect(getTemplateById('article')?.id).toBe('article')
    expect(getTemplateById('official')?.id).toBe('official')
  })

  it('getTemplateById 未知 id 返回 null', () => {
    expect(getTemplateById('not-exist')).toBeNull()
  })

  it('每个模板定义了 heading/paragraph/image 等规则', () => {
    Object.values(MARKDOWN_TEMPLATES).forEach((tpl) => {
      expect(tpl.heading).toBeTruthy()
      expect(tpl.paragraph).toBeTruthy()
      expect(tpl.image).toBeTruthy()
    })
  })

  it('webpage-archive 模板：图片宽度 100% 且标记 webpageHeader=true', () => {
    const tpl = getTemplateById('webpage-archive')
    expect(tpl).toBeTruthy()
    expect(tpl.id).toBe('webpage-archive')
    expect(tpl.label).toBe('网页存档')
    expect(tpl.image).toMatchObject({ align: 'center', float: 'none', width: '100%' })
    expect(tpl.webpageHeader).toBe(true)
  })
})

/* ───────────── 模拟 editor ───────────── */

/**
 * 构建一个最小的 mock editor 用于测试 formatDocument / alignImages。
 * - descendants 遍历给定节点
 * - commands.command 调用回调，捕获对 tr 的所有调用
 */
function buildMockEditor(nodes = []) {
  const trCalls = []
  const dispatchLog = []

  const tr = {
    setNodeMarkup: vi.fn((pos, type, attrs) => {
      trCalls.push({ method: 'setNodeMarkup', pos, attrs })
      return tr
    }),
    addMark: vi.fn((from, to, mark) => {
      trCalls.push({ method: 'addMark', from, to, mark: mark?.type?.name || mark?.toJSON?.() })
      return tr
    }),
    removeMark: vi.fn((from, to, type) => {
      trCalls.push({ method: 'removeMark', from, to })
      return tr
    }),
    setNodeAttribute: vi.fn((pos, key, value) => {
      trCalls.push({ method: 'setNodeAttribute', pos, key, value })
      return tr
    }),
  }

  const editor = {
    state: {
      doc: {
        descendants: (cb) => {
          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i]
            const shouldContinue = cb(node, i + 1) // 简化：pos 从 1 开始
            if (shouldContinue === false) break
          }
        },
        nodeAt: (pos) => nodes[pos - 1] || null,
        textContent: nodes.map((n) => n.text || '').join(' '),
      },
    },
    schema: {
      marks: {
        fontSize: { name: 'fontSize', create: (attrs) => ({ type: { name: 'fontSize' }, attrs }) },
        lineHeight: { name: 'lineHeight', create: (attrs) => ({ type: { name: 'lineHeight' }, attrs }) },
        fontFamily: { name: 'fontFamily', create: (attrs) => ({ type: { name: 'fontFamily' }, attrs }) },
      },
    },
    commands: {
      command: (cb) => {
        const dispatch = (t) => {
          dispatchLog.push(t)
          return t
        }
        return cb({ tr, dispatch })
      },
    },
  }

  return { editor, trCalls, dispatchLog }
}

/* ───────────── formatDocument ───────────── */
describe('formatDocument', () => {
  function heading(level = 1, attrs = {}) {
    return {
      isBlock: true,
      type: { name: 'heading' },
      attrs: { level, textAlign: 'left', ...attrs },
      content: { size: 5 },
    }
  }
  function paragraph(attrs = {}) {
    return {
      isBlock: true,
      type: { name: 'paragraph' },
      attrs: { textAlign: 'left', ...attrs },
      content: { size: 6 },
    }
  }
  function image(attrs = {}) {
    return {
      isBlock: true,
      type: { name: 'image' },
      attrs: { width: 500, align: 'left', float: 'left', ...attrs },
      content: { size: 1 },
    }
  }

  it('editor 不可用返回错误', () => {
    const result = formatDocument(null, 'article')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('editor-unavailable')
  })

  it('未知模板 id 返回错误', () => {
    const { editor } = buildMockEditor([])
    const result = formatDocument(editor, 'not-exist')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('template-not-found')
  })

  it('article 模板：H1 节点 setNodeMarkup 被调用且 textAlign=center', () => {
    const { editor, trCalls } = buildMockEditor([heading(1)])
    const result = formatDocument(editor, 'article')
    expect(result.ok).toBe(true)
    expect(result.modified).toBeGreaterThanOrEqual(1)
    const headingCall = trCalls.find(
      (c) => c.method === 'setNodeMarkup' && c.attrs?.textAlign === 'center',
    )
    expect(headingCall).toBeTruthy()
    expect(headingCall.attrs.level).toBe(1)
  })

  it('official 模板：段落节点 dataIndent 应被设置', () => {
    const { editor, trCalls } = buildMockEditor([paragraph()])
    const result = formatDocument(editor, 'official')
    expect(result.ok).toBe(true)
    // ProseMirror schema 不接受带连字符的 attr 名，扩展中通过 dataIndent 驼峰命名注册；
    // Tiptap renderHTML 会把它输出为 HTML 的 data-indent 属性。
    const paraCall = trCalls.find(
      (c) => c.method === 'setNodeMarkup' && c.attrs?.dataIndent,
    )
    expect(paraCall).toBeTruthy()
    expect(paraCall.attrs.dataIndent).toBe('2em')
  })

  it('含图片节点：image 模板规则被应用', () => {
    const { editor, trCalls } = buildMockEditor([image({ width: 500 })])
    const result = formatDocument(editor, 'article')
    expect(result.ok).toBe(true)
    expect(result.hasImages).toBe(true)
    const imgCall = trCalls.find(
      (c) => c.method === 'setNodeMarkup' && c.attrs?.align === 'center' && c.attrs?.float === 'none',
    )
    expect(imgCall).toBeTruthy()
  })

  it('6 个模板 id 全部可调用', () => {
    const { editor } = buildMockEditor([paragraph()])
    const ids = ['article', 'report', 'official', 'lesson-plan', 'paper', 'webpage-archive']
    ids.forEach((id) => {
      const result = formatDocument(editor, id)
      expect(result.ok).toBe(true)
    })
  })

  it('空文档：modified=0 但 ok=true', () => {
    const { editor } = buildMockEditor([])
    const result = formatDocument(editor, 'article')
    expect(result.ok).toBe(true)
    expect(result.modified).toBe(0)
  })
})

/* ───────────── alignImages ───────────── */
describe('alignImages', () => {
  it('editor 不可用返回错误', () => {
    const result = alignImages(null, 'fill')
    expect(result.ok).toBe(false)
    expect(result.count).toBe(0)
  })

  it('未知模式返回错误', () => {
    const { editor } = buildMockEditor([])
    const result = alignImages(editor, 'unknown')
    expect(result.ok).toBe(false)
    expect(result.count).toBe(0)
    expect(result.message).toContain('未知')
  })

  it('fill 模式：所有图片 align=center、float=none', () => {
    const img1 = { isBlock: true, type: { name: 'image' }, attrs: { width: 500 }, content: { size: 1 } }
    const img2 = { isBlock: true, type: { name: 'image' }, attrs: { width: 800 }, content: { size: 1 } }
    const { editor, trCalls } = buildMockEditor([img1, img2])
    const result = alignImages(editor, 'fill')
    expect(result.ok).toBe(true)
    expect(result.count).toBe(2)
    const imgCalls = trCalls.filter((c) => c.method === 'setNodeMarkup' && c.attrs?.align === 'center')
    expect(imgCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('narrow 模式：所有图片 width=65%', () => {
    const img = { isBlock: true, type: { name: 'image' }, attrs: { width: 500 }, content: { size: 1 } }
    const { editor, trCalls } = buildMockEditor([img])
    const result = alignImages(editor, 'narrow')
    expect(result.ok).toBe(true)
    const imgCall = trCalls.find((c) => c.method === 'setNodeMarkup' && c.attrs?.width === '65%')
    expect(imgCall).toBeTruthy()
  })

  it('无图片：count=0 但 ok=true', () => {
    const para = { isBlock: true, type: { name: 'paragraph' }, attrs: {}, content: { size: 1 } }
    const { editor } = buildMockEditor([para])
    const result = alignImages(editor, 'fill')
    expect(result.ok).toBe(true)
    expect(result.count).toBe(0)
  })
})

/* ───────────── 文档检测 ───────────── */
describe('getDocumentHasMarkdown / hasImagesInDoc / getDefaultImageAlignMode', () => {
  it('getDocumentHasMarkdown：含 heading 节点返回 true', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'heading' }, attrs: {}, content: { size: 1 } },
    ])
    expect(getDocumentHasMarkdown(editor)).toBe(true)
  })

  it('getDocumentHasMarkdown：纯 paragraph 返回 false', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'paragraph' }, attrs: {}, content: { size: 1 } },
    ])
    expect(getDocumentHasMarkdown(editor)).toBe(false)
  })

  it('getDocumentHasMarkdown：含 bulletList 返回 true', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'bulletList' }, attrs: {}, content: { size: 1 } },
    ])
    expect(getDocumentHasMarkdown(editor)).toBe(true)
  })

  it('getDocumentHasMarkdown：editor 不可用返回 false', () => {
    expect(getDocumentHasMarkdown(null)).toBe(false)
    expect(getDocumentHasMarkdown({})).toBe(false)
  })

  it('hasImagesInDoc：含 image 节点返回 true', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'image' }, attrs: {}, content: { size: 1 } },
    ])
    expect(hasImagesInDoc(editor)).toBe(true)
  })

  it('hasImagesInDoc：无 image 返回 false', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'paragraph' }, attrs: {}, content: { size: 1 } },
    ])
    expect(hasImagesInDoc(editor)).toBe(false)
  })

  it('getDefaultImageAlignMode：无图片默认 fill', () => {
    const { editor } = buildMockEditor([])
    expect(getDefaultImageAlignMode(editor)).toBe('fill')
  })

  it('getDefaultImageAlignMode：大图默认 fill', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'image' }, attrs: { width: 800 }, content: { size: 1 } },
    ])
    expect(getDefaultImageAlignMode(editor)).toBe('fill')
  })

  it('getDefaultImageAlignMode：小图推断 narrow', () => {
    const { editor } = buildMockEditor([
      { isBlock: true, type: { name: 'image' }, attrs: { width: 300 }, content: { size: 1 } },
    ])
    expect(getDefaultImageAlignMode(editor)).toBe('narrow')
  })
})