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

function isSeparatorRow(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed.includes('|')) return false
  // GFM 对齐行：| --- | :---: | ---: |
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.length > 0 && cells.every((cell) => /^[\t :\-]+$/.test(cell.trim()) && /-+/.test(cell))
}

function parseTableRow(line) {
  let raw = String(line || '').trim()
  if (raw.startsWith('|')) raw = raw.slice(1)
  if (raw.endsWith('|')) raw = raw.slice(0, -1)
  return raw.split('|').map((cell) =>
    cell
      .trim()
      .replace(/\\\|/g, '|')
      .replace(/\\\\/g, '\\')
      .replace(/<br\s*\/?>/gi, '\n'),
  )
}

/**
 * 文档是否包含 Markdown 表格（至少含表头 + 分隔行）。
 * @param {string} markdown
 */
export function hasMarkdownTable(markdown) {
  const lines = String(markdown || '').split(/\r?\n/)
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (lines[i].includes('|') && isSeparatorRow(lines[i + 1])) return true
  }
  return false
}

/**
 * 从 Markdown 解析表格；`## 标题` 作为工作表名（与 Excel 导入互逆）。
 * @param {string} markdown
 * @returns {Array<{ name: string, rows: string[][] }>}
 */
export function parseMarkdownTables(markdown) {
  const lines = String(markdown || '').split(/\r?\n/)
  /** @type {Array<{ name: string, rows: string[][] }>} */
  const tables = []
  let pendingName = ''
  let sheetIndex = 1
  let i = 0

  while (i < lines.length) {
    const heading = lines[i].match(/^##\s+(.+)$/)
    if (heading) {
      pendingName = heading[1].trim()
      i += 1
      continue
    }

    if (lines[i].includes('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const rows = [parseTableRow(lines[i])]
      i += 2 // skip header + separator
      while (i < lines.length && lines[i].includes('|') && !isSeparatorRow(lines[i])) {
        // 空行或非表格行结束
        if (!/\|/.test(lines[i]) || /^#{1,6}\s/.test(lines[i].trim())) break
        if (!lines[i].trim()) break
        rows.push(parseTableRow(lines[i]))
        i += 1
      }
      const name = (pendingName || `Sheet${sheetIndex}`).slice(0, 31) || `Sheet${sheetIndex}`
      tables.push({ name, rows })
      pendingName = ''
      sheetIndex += 1
      continue
    }

    i += 1
  }

  return tables
}

/**
 * Markdown 表格 → SheetJS workbook
 * @param {string} markdown
 */
export function markdownToWorkbook(markdown) {
  const tables = parseMarkdownTables(markdown)
  if (tables.length === 0) {
    throw new Error('文档中未找到可导出的表格')
  }

  const workbook = XLSX.utils.book_new()
  const usedNames = new Set()

  for (const table of tables) {
    let name = table.name || 'Sheet1'
    let suffix = 1
    while (usedNames.has(name)) {
      const base = (table.name || 'Sheet').slice(0, 28)
      name = `${base}${suffix}`
      suffix += 1
    }
    usedNames.add(name)
    const worksheet = XLSX.utils.aoa_to_sheet(table.rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, name)
  }

  return workbook
}

/**
 * 将 Markdown 表格转为电子表格二进制（或 CSV 文本的 UTF-8 字节）。
 * @param {string} markdown
 * @param {'xlsx' | 'xls' | 'csv'} format
 * @returns {Uint8Array}
 */
export function markdownToSpreadsheetBytes(markdown, format = 'xlsx') {
  const workbook = markdownToWorkbook(markdown)
  const normalized = String(format || 'xlsx').toLowerCase()

  if (normalized === 'csv') {
    // CSV 无多 sheet 标准：用空行分隔，并在每段前加工作表名注释行
    const chunks = []
    for (const sheetName of workbook.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
      if (workbook.SheetNames.length > 1) {
        chunks.push(`# ${sheetName}\n${csv}`)
      } else {
        chunks.push(csv)
      }
    }
    return new TextEncoder().encode(chunks.join('\n'))
  }

  const bookType = normalized === 'xls' ? 'xls' : 'xlsx'
  const buffer = XLSX.write(workbook, { bookType, type: 'array' })
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

/**
 * @param {Uint8Array} bytes
 */
export function bytesToBase64(bytes) {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * 来源扩展名是否属于 Excel / 表格文件。
 * @param {string} extension
 */
export function isSpreadsheetExtension(extension) {
  const ext = String(extension || '').toLowerCase()
  return ext === '.xlsx' || ext === '.xls' || ext === '.xlsm' || ext === '.csv'
}

/**
 * 根据来源扩展名给出默认保存格式。
 * @param {string} extension
 * @returns {'xlsx' | 'xls' | 'csv' | 'md'}
 */
export function defaultFormatFromSourceExtension(extension) {
  const ext = String(extension || '').toLowerCase()
  if (ext === '.xls') return 'xls'
  if (ext === '.csv') return 'csv'
  if (ext === '.xlsx' || ext === '.xlsm') return 'xlsx'
  return 'md'
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

/**
 * 将 Markdown 表格直接下载为本地电子表格文件。
 * @param {string} markdown
 * @param {string} filename
 * @param {'xlsx' | 'xls' | 'csv'} format
 */
export function downloadMarkdownAsSpreadsheet(markdown, filename = 'table', format = 'xlsx') {
  const workbook = markdownToWorkbook(markdown)
  const normalized = String(format || 'xlsx').toLowerCase()
  const safeName = String(filename || 'table').replace(/\.[^.]+$/, '')

  if (normalized === 'csv') {
    XLSX.writeFile(workbook, `${safeName}.csv`, { bookType: 'csv' })
    return
  }
  if (normalized === 'xls') {
    XLSX.writeFile(workbook, `${safeName}.xls`, { bookType: 'xls' })
    return
  }
  XLSX.writeFile(workbook, `${safeName}.xlsx`)
}
