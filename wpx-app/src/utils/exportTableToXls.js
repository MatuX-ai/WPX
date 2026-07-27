import * as XLSX from 'xlsx'

function findTableNode(editor) {
  const { state } = editor
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'table') continue
    return node
  }

  return null
}

function extractTableData(tableNode) {
  const rows = []

  tableNode.forEach((row) => {
    if (row.type.name !== 'tableRow') return
    const cells = []

    row.forEach((cell) => {
      if (cell.type.name !== 'tableCell') return
      let text = ''
      cell.forEach((node) => {
        if (node.isText) {
          text += node.text
        }
      })
      cells.push(text)
    })

    rows.push(cells)
  })

  return rows
}

export function exportTableToXls(editor, filename = 'table') {
  const tableNode = findTableNode(editor)
  if (!tableNode) {
    throw new Error('未找到可导出的表格')
  }

  const data = extractTableData(tableNode)
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  XLSX.writeFile(workbook, `${filename}.xls`, { bookType: 'xls' })
}

export function exportTableToXlsx(editor, filename = 'table') {
  const tableNode = findTableNode(editor)
  if (!tableNode) {
    throw new Error('未找到可导出的表格')
  }

  const data = extractTableData(tableNode)
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export function exportTableByExtension(editor, filename = 'table', extension = '.xlsx') {
  const tableNode = findTableNode(editor)
  if (!tableNode) {
    throw new Error('未找到可导出的表格')
  }

  const data = extractTableData(tableNode)
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  const ext = extension.toLowerCase()
  if (ext === '.xls') {
    XLSX.writeFile(workbook, `${filename}.xls`, { bookType: 'xls' })
  } else {
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  }
}
