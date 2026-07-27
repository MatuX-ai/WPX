/**
 * excel-import.js - Excel (.xlsx / .xlsm / .xls) 文件 → Markdown 表格 解析器
 *
 * 走 ExcelJS 流式读取（xlsx/xlsm），避免大文件加载到内存。
 * .xls 格式使用 xlsx（SheetJS）库读取。
 * 每个工作表输出为一个 Markdown 表格，多个 sheet 之间用 ## 标题分隔。
 *
 * 设计要点：
 *  - 保留原始数据：字符串 / 数字 / 日期 / 布尔全部保留
 *  - 空单元格：保留空白，避免被压缩破坏列对齐
 *  - Markdown 表格语法防御：转义 `|` `\` 和换行（HTML 转义由下游 markdownToHtml 负责）
 *  - 超大表格保护：单 sheet 超过 maxRows 时给出友好提示，不爆栈
 *
 * @module excel-import
 */
const path = require('node:path')
const ExcelJS = require('exceljs')

/** 单 sheet 最大行数；超出后导出前 maxRows 提示，避免 Markdown 渲染卡死 */
const DEFAULT_MAX_ROWS_PER_SHEET = 5000

/** 单行最大列数；超出后导出前 maxCols 提示 */
const DEFAULT_MAX_COLS = 200

/** Markdown 表格对齐分隔符：左对齐，保持和编辑器中表格一致 */
const ALIGN_SEP = '---'

/** 支持的扩展名 */
const SUPPORTED_EXTS = new Set(['.xlsx', '.xlsm', '.xls'])

/**
 * 转义 Markdown 表格单元格中的特殊字符
 *  - `|` 需要转义为 `\|`
 *  - 换行需要替换为 `<br>`，否则破坏表格行结构
 *  - 反斜杠需要双重转义，保证下游 Markdown 解析器识别为字面量
 *
 * 注意：本函数不做 HTML 转义。输出 Markdown 后，下游 markdownToHtml 会
 * 走 applyInlineMarkdown → escapeHtml 统一处理，避免双重转义。
 */
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  let s
  if (value instanceof Date) {
    s = formatDate(value)
  } else if (typeof value === 'object') {
    try {
      s = JSON.stringify(value)
    } catch {
      s = String(value)
    }
  } else {
    s = String(value)
  }
  if (s === 'true') s = '✓'
  else if (s === 'false') s = '✗'

  return s
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim()
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD HH:mm:ss（保留秒，编辑器内对齐友好）
 */
function formatDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

/**
 * 从 sheet 中取一行的所有单元格（稀疏数组 → 密集数组）
 * 保留空位以维持列对齐
 */
function readRow(row) {
  const values = row.values
  if (!values) return []
  const out = []
  for (let i = 1; i < values.length; i++) {
    out.push(values[i])
  }
  return out
}

/**
 * 把单 sheet 转 Markdown 表格（ExcelJS Worksheet）
 * @param {ExcelJS.Worksheet} worksheet
 * @param {{ maxRows?: number, maxCols?: number, sheetTitle?: string }} [opts]
 */
function worksheetToMarkdown(worksheet, opts = {}) {
  const { maxRows = DEFAULT_MAX_ROWS_PER_SHEET, maxCols = DEFAULT_MAX_COLS, sheetTitle } = opts

  const rawRows = []
  const truncated = { rows: false, cols: false }

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > maxRows) {
      truncated.rows = true
      return false
    }
    const values = readRow(row)
    if (values.length > maxCols) {
      truncated.cols = true
      values.length = maxCols
    }
    rawRows.push(values)
  })

  return rawRowsToMarkdown(rawRows, { maxRows, maxCols, sheetTitle, truncated })
}

/**
 * 将原始行数据转换为 Markdown 表格
 */
function rawRowsToMarkdown(rawRows, opts = {}) {
  const { maxRows = DEFAULT_MAX_ROWS_PER_SHEET, maxCols = DEFAULT_MAX_COLS, sheetTitle, truncated = { rows: false, cols: false } } = opts

  if (rawRows.length === 0) {
    return { markdown: `*（工作表 ${sheetTitle || ''} 为空）*\n`, truncated }
  }

  const colCount = rawRows.reduce((m, r) => Math.max(m, r.length), 0)
  for (const row of rawRows) {
    while (row.length < colCount) row.push('')
  }

  let headerIdx = 0
  while (headerIdx < rawRows.length && rawRows[headerIdx].every((c) => escapeCell(c) === '')) {
    headerIdx += 1
  }
  if (headerIdx >= rawRows.length) {
    return { markdown: `*（工作表 ${sheetTitle || ''} 无有效数据）*\n`, truncated }
  }

  const header = rawRows[headerIdx]
  const body = rawRows.slice(headerIdx + 1)

  const lines = []
  if (sheetTitle) lines.push(`## ${sheetTitle}`, '')

  lines.push(`| ${header.map(escapeCell).join(' | ')} |`)
  lines.push(`| ${new Array(colCount).fill(ALIGN_SEP).join(' | ')} |`)

  for (const row of body) {
    lines.push(`| ${row.map(escapeCell).join(' | ')} |`)
  }

  const tips = []
  if (truncated.rows) tips.push(`行数超过 ${maxRows}，已截断`)
  if (truncated.cols) tips.push(`列数超过 ${maxCols}，已截断`)

  if (tips.length) {
    lines.push('', `> ⚠️ ${tips.join('；')}`)
  }

  return { markdown: lines.join('\n') + '\n', truncated }
}

/**
 * 将 Excel 文件路径转换为 Markdown 内容
 * @param {string} filePath - .xlsx / .xlsm / .xls 文件绝对路径
 * @param {{ maxRows?: number, maxCols?: number }} [opts]
 * @returns {Promise<{ markdown: string, sheetNames: string[], sheetCount: number, warnings: string[] }>}
 */
async function excelFileToMarkdown(filePath, opts = {}) {
  const ext = path.extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new Error(`不支持的 Excel 格式：${ext}（仅支持 .xlsx / .xlsm / .xls）`)
  }

  const sheetNames = []
  const sections = []
  const warnings = []

  if (ext === '.xls') {
    const XLSX = require('xlsx')
    const workbook = XLSX.readFile(filePath)

    for (let i = 0; i < workbook.SheetNames.length; i++) {
      const sheetName = workbook.SheetNames[i]
      const worksheet = workbook.Sheets[sheetName]

      const rawRows = []
      const range = XLSX.utils.decode_range(worksheet['!ref'] || '')
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row = []
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c })]
          row.push(cell ? cell.v : '')
        }
        rawRows.push(row)
      }

      const { markdown, truncated } = rawRowsToMarkdown(rawRows, { ...opts, sheetTitle: sheetName })
      sheetNames.push(sheetName)
      sections.push(markdown)
      if (truncated.rows || truncated.cols) {
        warnings.push(`工作表「${sheetName}」已截断（${truncated.rows ? '行' : ''}${truncated.cols ? '列' : ''}）`)
      }
    }
  } else {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)

    workbook.eachSheet((worksheet, sheetId) => {
      const title = worksheet.name || `Sheet${sheetId}`
      sheetNames.push(title)
      const { markdown, truncated } = worksheetToMarkdown(worksheet, { ...opts, sheetTitle: title })
      sections.push(markdown)
      if (truncated.rows || truncated.cols) {
        warnings.push(`工作表「${title}」已截断（${truncated.rows ? '行' : ''}${truncated.cols ? '列' : ''}）`)
      }
    })
  }

  if (sheetNames.length === 0) {
    return {
      markdown: '*（Excel 文件不包含任何工作表）*\n',
      sheetNames: [],
      sheetCount: 0,
      warnings: ['文件不包含任何工作表'],
    }
  }

  const header = [
    `# ${path.basename(filePath)}`,
    '',
    `> 共 ${sheetNames.length} 个工作表：${sheetNames.map((n) => `「${n}」`).join('、')}`,
    '',
  ].join('\n')

  return {
    markdown: header + sections.join('\n'),
    sheetNames,
    sheetCount: sheetNames.length,
    warnings,
  }
}

module.exports = {
  excelFileToMarkdown,
  escapeCell,
  formatDate,
  SUPPORTED_EXTS,
  _worksheetToMarkdown: worksheetToMarkdown,
  _rawRowsToMarkdown: rawRowsToMarkdown,
}
