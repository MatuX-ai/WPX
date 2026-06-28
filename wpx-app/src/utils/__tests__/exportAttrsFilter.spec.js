import { describe, it, expect, vi } from 'vitest'

/**
 * 单元测试：导出属性过滤（HTML 内部 attrs 不外泄）
 *
 * - INTERNAL_HTML_ATTRS：常量列表
 * - isInternalHtmlAttr：判断工具
 * - stripInternalAttrsFromJson：深拷贝并过滤 doc.attrs
 * - getSanitizedJson：包装 editor.getJSON() 调用
 */

import {
  INTERNAL_HTML_ATTRS,
  isInternalHtmlAttr,
  stripInternalAttrsFromJson,
  getSanitizedJson,
} from '@/utils/exportAttrsFilter'

describe('INTERNAL_HTML_ATTRS', () => {
  it('包含 6 个内部属性名', () => {
    expect(INTERNAL_HTML_ATTRS).toHaveLength(6)
    expect(INTERNAL_HTML_ATTRS).toEqual(
      expect.arrayContaining([
        'htmlSource',
        'sourceUrl',
        'importedAt',
        'importSource',
        'lastFormattedTemplate',
        'lastFormattedAt',
      ]),
    )
  })

  it('所有项都是字符串', () => {
    INTERNAL_HTML_ATTRS.forEach((k) => expect(typeof k).toBe('string'))
  })
})

describe('isInternalHtmlAttr', () => {
  it('内部属性返回 true', () => {
    INTERNAL_HTML_ATTRS.forEach((k) => expect(isInternalHtmlAttr(k)).toBe(true))
  })

  it('非内部属性返回 false', () => {
    expect(isInternalHtmlAttr('align')).toBe(false)
    expect(isInternalHtmlAttr('level')).toBe(false)
    expect(isInternalHtmlAttr('textAlign')).toBe(false)
    expect(isInternalHtmlAttr('dataIndent')).toBe(false)
  })

  it('空字符串返回 false', () => {
    expect(isInternalHtmlAttr('')).toBe(false)
  })
})

describe('stripInternalAttrsFromJson', () => {
  it('null/undefined/非对象 直接返回', () => {
    expect(stripInternalAttrsFromJson(null)).toBeNull()
    expect(stripInternalAttrsFromJson(undefined)).toBeUndefined()
    expect(stripInternalAttrsFromJson('not-object')).toBe('not-object')
    expect(stripInternalAttrsFromJson(42)).toBe(42)
  })

  it('非 doc 节点：原样返回（不深拷贝）', () => {
    const para = { type: 'paragraph', attrs: { htmlSource: 'leak' } }
    const result = stripInternalAttrsFromJson(para)
    expect(result).toBe(para) // 引用相同，未被修改
  })

  it('doc 节点：剥离所有内部 attrs，保留其他 attrs', () => {
    const doc = {
      type: 'doc',
      attrs: {
        htmlSource: '<html>secret</html>',
        sourceUrl: 'https://example.com',
        importedAt: '2024-01-01T00:00:00Z',
        importSource: 'paste',
        lastFormattedTemplate: 'article',
        lastFormattedAt: '2024-01-01T00:01:00Z',
        // 保留以下：
        // （ProseMirror 不允许 doc 上自定义非 schema attrs，这里只是示意）
      },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    }
    const result = stripInternalAttrsFromJson(doc)
    expect(result).not.toBe(doc) // 已被深拷贝
    expect(result.type).toBe('doc')
    expect(Object.keys(result.attrs)).toHaveLength(0)
    expect(result.attrs).not.toHaveProperty('htmlSource')
    expect(result.attrs).not.toHaveProperty('sourceUrl')
  })

  it('doc 节点无 attrs 时仍可正常处理', () => {
    const doc = { type: 'doc', content: [] }
    const result = stripInternalAttrsFromJson(doc)
    expect(result.type).toBe('doc')
    expect(result.attrs).toEqual({})
  })

  it('doc 节点已有 attrs 含其他字段时不被误删', () => {
    // 即使 schema 默认 attrs 为空，也保留键值（例如用户手动写入的非内部字段）
    const doc = {
      type: 'doc',
      attrs: {
        htmlSource: 'leak',
        customField: 'keep',
      },
    }
    const result = stripInternalAttrsFromJson(doc)
    expect(result.attrs).toEqual({ customField: 'keep' })
  })
})

describe('getSanitizedJson', () => {
  it('editor 为 null 时返回 null', () => {
    expect(getSanitizedJson(null)).toBeNull()
    expect(getSanitizedJson(undefined)).toBeNull()
  })

  it('editor.getJSON() 返回 null 时返回 null', () => {
    const editor = { getJSON: () => null }
    expect(getSanitizedJson(editor)).toBeNull()
  })

  it('editor.getJSON() 抛错时返回 null 并打印警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const editor = {
      getJSON: () => {
        throw new Error('boom')
      },
    }
    expect(getSanitizedJson(editor)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('正常 editor：剥离 doc.attrs 上的 htmlSource 等', () => {
    const editor = {
      getJSON: () => ({
        type: 'doc',
        attrs: {
          htmlSource: '<html>big</html>',
          sourceUrl: 'https://x',
        },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
      }),
    }
    const sanitized = getSanitizedJson(editor)
    expect(sanitized).not.toBeNull()
    expect(sanitized.type).toBe('doc')
    expect(sanitized.attrs).not.toHaveProperty('htmlSource')
    expect(sanitized.attrs).not.toHaveProperty('sourceUrl')
    expect(sanitized.content[0].type).toBe('paragraph')
  })
})
