/**
 * excel-import.js - Excel (.xlsx / .xlsm) 文件 → Markdown 表格 解析器
 *
 * 走 ExcelJS 流式读取，避免大文件加载到内存。
 * 每个工作表输出为一个 Markdown 表格，多个 sheet 之间用 ## 标题分隔。
 *
 * 设计要点：
 *  - 保留原始数据：字符串 / 数字 / 日期 / 布尔全部保留
 *  - 空单元格：保留空白，避免被压缩破坏列对齐
 *  - Markdown 表格语法防御：转义 `|` `\` 和换行（HTML 转义由下游 markdownToHtml 负责）
 *  - 超大表格保护：单 sheet 超过 maxRows 时给出友好提示，不爆栈
 *
 * 注意：仅支持 .xlsx / .xlsm（ExcelJS 4.x 基于 ZIP 容器）。
 * 旧版 .xls（BIFF 二进制）不在支持范围内，需在 Excel 中另存为 .xlsx。
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

/** ExcelJS 实际可解析的扩展名（ZIP 容器）；旧 BIFF 不在列 */
const SUPPORTED_EXTS = new Set(['.xlsx', '.xlsm'])

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
    // ExcelJS 富文本 / 公式结果等对象 → JSON 序列化兜底
    try {
      s = JSON.stringify(value)
    } catch {
      s = String(value)
    }
  } else {
    s = String(value)
  }
  // 处理布尔值：ExcelJS 会读到 true/false，输出成“是/否”更友好
  if (s === 'true') s = '✓'
  else if (s === 'false') s = '✗'

  return s
    .replace(/\\/g, '\\\\')     // 反斜杠 → 双反斜杠（避免被 Markdown 解析为转义符）
    .replace(/\|/g, '\\|')       // 表格列分隔符转义
    .replace(/\r?\n/g, '<br>')   // 单元格内换行 → <br>（Markdown 表格友好）
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
  // ExcelJS 用 1-based 索引：values[0] 是空，values[1]..values[N] 是单元格
  const out = []
  for (let i = 1; i < values.length; i++) {
    out.push(values[i])
  }
  return out
}

/**
 * 把单 sheet 转 Markdown 表格
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
      return false // 停止遍历
    }
    const values = readRow(row)
    if (values.length > maxCols) {
      truncated.cols = true
      values.length = maxCols
    }
    rawRows.push(values)
  })

  if (rawRows.length === 0) {
    return { markdown: `*（工作表 ${sheetTitle || ''} 为空）*\n`, truncated }
  }

  // 列数对齐：取所有行的最大列数，不足的补空字符串
  const colCount = rawRows.reduce((m, r) => Math.max(m, r.length), 0)
  for (const row of rawRows) {
    while (row.length < colCount) row.push('')
  }

  // 第一行作为表头（如果首行全空，下移直到找到非空行）
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
  // Sheet 标题
  if (sheetTitle) lines.push(`## ${sheetTitle}`, '')

  // 表头行
  lines.push(`| ${header.map(escapeCell).join(' | ')} |`)

  // 分隔行
  lines.push(`| ${new Array(colCount).fill(ALIGN_SEP).join(' | ')} |`)

  // 数据行
  for (const row of body) {
    lines.push(`| ${row.map(escapeCell).join(' | ')} |`)
  }

  // 截断提示
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
 * @param {string} filePath - .xlsx 或 .xlsm 文件绝对路径（不支持旧版 .xls）
 * @param {{ maxRows?: number, maxCols?: number }} [opts]
 * @returns {Promise<{ markdown: string, sheetNames: string[], sheetCount: number, warnings: string[] }>}
 */
async function excelFileToMarkdown(filePath, opts = {}) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.xls') {
    // 旧版 BIFF 二进制 ExcelJS 不支持；提示用户先另存为 .xlsx
    throw new Error(
      '旧版 .xls（Excel 97-2003 BIFF 二进制）暂不支持。请在 Microsoft Excel 中打开后“另存为 .xlsx”，再重新打开。',
    )
  }
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new Error(`不支持的 Excel 格式：${ext}（仅支持 .xlsx / .xlsm）`)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const sheetNames = []
  const sections = []
  const warnings = []

  workbook.eachSheet((worksheet, sheetId) => {
    const title = worksheet.name || `Sheet${sheetId}`
    sheetNames.push(title)
    const { markdown, truncated } = worksheetToMarkdown(worksheet, { ...opts, sheetTitle: title })
    sections.push(markdown)
    if (truncated.rows || truncated.cols) {
      warnings.push(`工作表「${title}」已截断（${truncated.rows ? '行' : ''}${truncated.cols ? '列' : ''}）`)
    }
  })

  if (sheetNames.length === 0) {
    return {
      markdown: '*（Excel 文件不包含任何工作表）*\n',
      sheetNames: [],
      sheetCount: 0,
      warnings: ['文件不包含任何工作表'],
    }
  }

  // 顶部摘要
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
  // 暴露给测试
  _worksheetToMarkdown: worksheetToMarkdown,
}