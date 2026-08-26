import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import {
  exportTableByExtension,
  hasMarkdownTable,
  parseMarkdownTables,
  markdownToSpreadsheetBytes,
  defaultFormatFromSourceExtension,
  isSpreadsheetExtension,
} from '@/utils/exportTableToXls'

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn((rows) => ({ __rows: rows })),
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    book_append_sheet: vi.fn((wb, sheet, name) => {
      wb.SheetNames.push(name)
      wb.Sheets[name] = sheet
    }),
    sheet_to_csv: vi.fn(() => 'a,b\n1,2\n'),
  },
  writeFile: vi.fn(),
  write: vi.fn(() => new Uint8Array([1, 2, 3])),
}))

function createMockEditor(tableNode) {
  return {
    state: {
      selection: {
        $from: {
          depth: tableNode ? 2 : 0,
          node: (depth) => {
            if (depth === 2 && tableNode) return tableNode
            return null
          },
        },
      },
    },
  }
}

function createMockTableNode(rows) {
  const nodes = []
  rows.forEach((rowCells) => {
    const cells = rowCells.map((text) => ({
      type: { name: 'tableCell' },
      forEach: (fn) => {
        fn({ type: { name: 'text' }, isText: true, text })
      },
    }))
    nodes.push({
      type: { name: 'tableRow' },
      forEach: (fn) => {
        cells.forEach(fn)
      },
    })
  })
  return {
    type: { name: 'table' },
    forEach: (fn) => {
      nodes.forEach(fn)
    },
  }
}

describe('exportTableToXls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exportTableByExtension 导出 XLS 格式', () => {
    const tableNode = createMockTableNode([
      ['Name', 'Age'],
      ['Alice', '30'],
    ])
    const editor = createMockEditor(tableNode)

    exportTableByExtension(editor, 'test', '.xls')

    expect(XLSX.writeFile).toHaveBeenCalledWith(
      expect.any(Object),
      'test.xls',
      { bookType: 'xls' },
    )
  })

  it('exportTableByExtension 导出 XLSX 格式', () => {
    const tableNode = createMockTableNode([
      ['Name', 'Age'],
      ['Bob', '25'],
    ])
    const editor = createMockEditor(tableNode)

    exportTableByExtension(editor, 'test', '.xlsx')

    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'test.xlsx')
  })

  it('exportTableByExtension 未指定扩展名时默认导出 XLSX', () => {
    const tableNode = createMockTableNode([['Data']])
    const editor = createMockEditor(tableNode)

    exportTableByExtension(editor, 'test', '')

    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'test.xlsx')
  })

  it('exportTableByExtension XLSM 扩展名导出为 XLSX', () => {
    const tableNode = createMockTableNode([['Macro', 'Data']])
    const editor = createMockEditor(tableNode)

    exportTableByExtension(editor, 'test', '.xlsm')

    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'test.xlsx')
  })

  it('exportTableByExtension 找不到表格时抛出错误', () => {
    const editor = createMockEditor(null)

    expect(() => exportTableByExtension(editor, 'test', '.xlsx')).toThrow(
      '未找到可导出的表格',
    )
  })
})

describe('markdown ↔ spreadsheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hasMarkdownTable 识别 GFM 表格', () => {
    expect(hasMarkdownTable('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(true)
    expect(hasMarkdownTable('# 标题\n\n普通段落')).toBe(false)
  })

  it('parseMarkdownTables 按 ## 拆成多工作表', () => {
    const md = [
      '## 成绩',
      '',
      '| 姓名 | 分数 |',
      '| --- | --- |',
      '| 甲 | 90 |',
      '',
      '## 名单',
      '',
      '| 姓名 |',
      '| --- |',
      '| 乙 |',
    ].join('\n')

    const tables = parseMarkdownTables(md)
    expect(tables).toHaveLength(2)
    expect(tables[0].name).toBe('成绩')
    expect(tables[0].rows).toEqual([
      ['姓名', '分数'],
      ['甲', '90'],
    ])
    expect(tables[1].name).toBe('名单')
  })

  it('markdownToSpreadsheetBytes 无表格时抛错', () => {
    expect(() => markdownToSpreadsheetBytes('没有表格', 'xlsx')).toThrow(
      '文档中未找到可导出的表格',
    )
  })

  it('markdownToSpreadsheetBytes 生成 xlsx 字节', () => {
    const bytes = markdownToSpreadsheetBytes(
      '| a | b |\n| --- | --- |\n| 1 | 2 |',
      'xlsx',
    )
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(XLSX.write).toHaveBeenCalled()
  })

  it('markdownToSpreadsheetBytes 单列表格可导出', () => {
    expect(() =>
      markdownToSpreadsheetBytes('| 姓名 |\n| --- |\n| 甲 |', 'xlsx'),
    ).not.toThrow()
  })

  it('markdownToSpreadsheetBytes csv 多表拼接', () => {
    XLSX.utils.sheet_to_csv
      .mockReturnValueOnce('a\n1\n')
      .mockReturnValueOnce('b\n2\n')

    const md = [
      '## S1',
      '',
      '| a |',
      '| --- |',
      '| 1 |',
      '',
      '## S2',
      '',
      '| b |',
      '| --- |',
      '| 2 |',
    ].join('\n')

    const text = new TextDecoder().decode(markdownToSpreadsheetBytes(md, 'csv'))
    expect(text).toContain('# S1')
    expect(text).toContain('# S2')
    expect(XLSX.utils.sheet_to_csv).toHaveBeenCalledTimes(2)
  })

  it('defaultFormatFromSourceExtension 映射 Excel 来源', () => {
    expect(defaultFormatFromSourceExtension('.xlsx')).toBe('xlsx')
    expect(defaultFormatFromSourceExtension('.xlsm')).toBe('xlsx')
    expect(defaultFormatFromSourceExtension('.xls')).toBe('xls')
    expect(defaultFormatFromSourceExtension('.csv')).toBe('csv')
    expect(defaultFormatFromSourceExtension('.md')).toBe('md')
  })

  it('isSpreadsheetExtension 识别表格扩展名', () => {
    expect(isSpreadsheetExtension('.xlsx')).toBe(true)
    expect(isSpreadsheetExtension('.docx')).toBe(false)
  })
})
