import { describe, expect, it } from 'vitest'
import {
  filterKnowledgeItems,
  knowledgeItemSearchText,
  matchesEverythingQuery,
  matchesKnowledgeItem,
  termToRegExp,
} from '@/utils/knowledgeEverythingSearch'

describe('knowledgeEverythingSearch', () => {
  it('空查询匹配全部', () => {
    expect(matchesEverythingQuery('教案.docx', '')).toBe(true)
    expect(matchesEverythingQuery('教案.docx', '   ')).toBe(true)
  })

  it('子串匹配（大小写不敏感）', () => {
    expect(matchesEverythingQuery('期中考试教案.docx', '教案')).toBe(true)
    expect(matchesEverythingQuery('期中考试教案.docx', 'JIAO')).toBe(false)
    expect(matchesEverythingQuery('Lesson Plan.PDF', 'plan')).toBe(true)
  })

  it('空格多词 AND', () => {
    expect(matchesEverythingQuery('高一数学期中试卷.pdf', '数学 期中')).toBe(true)
    expect(matchesEverythingQuery('高一数学期中试卷.pdf', '数学 英语')).toBe(false)
  })

  it('* 与 ? 通配符', () => {
    expect(matchesEverythingQuery('lesson-plan-v2.docx', 'lesson*.docx')).toBe(true)
    expect(matchesEverythingQuery('lesson-plan-v2.docx', 'lesson-????-v2.docx')).toBe(true)
    expect(matchesEverythingQuery('lesson-plan-v2.docx', 'lesson-?-v2.docx')).toBe(false)
  })

  it('termToRegExp 转义普通正则元字符', () => {
    expect(termToRegExp('a+b').test('a+b')).toBe(true)
    expect(termToRegExp('a+b').test('aab')).toBe(false)
  })

  it('含空格文件名的通配符仍按整名匹配', () => {
    const item = { id: '1', filename: '期中 考试.pdf', type: 'pdf' }
    expect(matchesKnowledgeItem(item, '*.pdf')).toBe(true)
    expect(matchesKnowledgeItem(item, '期中*')).toBe(true)
    expect(matchesKnowledgeItem(item, '*.docx')).toBe(false)
  })

  it('无通配符时可按类型字段命中', () => {
    const item = { id: '2', filename: 'notes.md', type: 'markdown' }
    expect(matchesKnowledgeItem(item, 'markdown')).toBe(true)
    expect(matchesKnowledgeItem(item, '*.md')).toBe(true)
  })

  it('filterKnowledgeItems 按文件名过滤', () => {
    const items = [
      { id: '1', filename: '语文教案.md', type: 'markdown' },
      { id: '2', filename: '数学试卷.pdf', type: 'pdf' },
      { id: '3', filename: '英语听力.txt', type: 'text' },
      { id: '4', filename: '期中 复习.pdf', type: 'pdf' },
    ]
    expect(filterKnowledgeItems(items, '教案').map((i) => i.id)).toEqual(['1'])
    expect(filterKnowledgeItems(items, '*.pdf').map((i) => i.id)).toEqual(['2', '4'])
    expect(filterKnowledgeItems(items, 'pdf').map((i) => i.id)).toEqual(['2', '4'])
    expect(filterKnowledgeItems(items, '').length).toBe(4)
  })

  it('knowledgeItemSearchText 拼接检索字段', () => {
    expect(
      knowledgeItemSearchText({
        filename: 'a.md',
        type: 'markdown',
        sourceUrl: 'https://example.com',
      }),
    ).toBe('a.md markdown https://example.com')
  })
})
