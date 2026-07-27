import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { exportTableByExtension } from '@/utils/exportTableToXls'

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
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
      { bookType: 'xls' }
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
      '未找到可导出的表格'
    )
  })
})