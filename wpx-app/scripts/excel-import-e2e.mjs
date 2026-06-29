/**
 * excel-import-e2e.mjs - Excel 导入端到端测试
 *
 * 走真实代码路径：
 *  1) 用 ExcelJS 现场写一份包含：多 sheet / 数字 / 字符串 / 日期 / 布尔 / 空单元格 / 转义字符
 *  2) 加载 electron/excel-import.js 解析它
 *  3) 验证 Markdown 结构正确
 *  4) 输出落盘供人工对比
 *  5) 验证 markdownToHtml 能识别表格语法（表格渲染是否正确）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const outDir = path.join(projectRoot, '.test-output')
fs.mkdirSync(outDir, { recursive: true })

let pass = 0
let fail = 0
const logs = []
function ok(name) {
  pass++
  logs.push(`✅ ${name}`)
  console.log(`✅ ${name}`)
}
function ng(name, err) {
  fail++
  logs.push(`❌ ${name}：${err?.message || err}`)
  console.log(`❌ ${name}：${err?.message || err}`)
}

/* ───────── 1. 构造测试 xlsx ───────── */
const xlsxPath = path.join(outDir, 'test-input.xlsx')
try {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'WPX e2e'
  wb.created = new Date()

  // Sheet 1: 学生成绩（覆盖：数字 / 字符串 / 日期 / 布尔 / 空）
  const s1 = wb.addWorksheet('学生成绩')
  s1.columns = [
    { header: '姓名', key: 'name', width: 12 },
    { header: '语文', key: 'yuwen', width: 8 },
    { header: '数学', key: 'shuxue', width: 8 },
    { header: '英语', key: 'yingyu', width: 8 },
    { header: '备注', key: 'note', width: 20 },
  ]
  s1.addRow({ name: '张三', yuwen: 92, shuxue: 88, yingyu: 95, note: '优秀' })
  s1.addRow({ name: '李四', yuwen: 78, shuxue: 82, yingyu: 75, note: '' })
  s1.addRow({ name: '王五', yuwen: 65, shuxue: null, yingyu: 70, note: '数学缺考' })
  s1.addRow({ name: '赵六', yuwen: 100, shuxue: 100, yingyu: 100, note: '满分 | 转义测试' })
  s1.addRow({ name: '钱七', yuwen: 85, shuxue: 90, yingyu: 88, note: '良好\n多行' })

  // Sheet 2: 课程表（覆盖：日期 / 布尔 / 时间）
  const s2 = wb.addWorksheet('课程表')
  s2.columns = [
    { header: '日期', key: 'date', width: 12 },
    { header: '上午', key: 'morning', width: 12 },
    { header: '下午', key: 'afternoon', width: 12 },
    { header: '全天', key: 'fullday', width: 8 },
  ]
  s2.addRow({ date: new Date('2026-03-01'), morning: '语文', afternoon: '数学', fullday: false })
  s2.addRow({ date: new Date('2026-03-02'), morning: '英语', afternoon: '物理', fullday: false })
  s2.addRow({ date: new Date('2026-03-03'), morning: '体育', afternoon: '音乐', fullday: true })

  await wb.xlsx.writeFile(xlsxPath)
  ok(`构造测试 xlsx → ${xlsxPath} (${(fs.statSync(xlsxPath).size / 1024).toFixed(1)} KB)`)
} catch (e) {
  ng('构造测试 xlsx', e)
}

/* ───────── 2. 解析 xlsx ───────── */
try {
  // 动态加载（用 file:// URL 兼容 Windows 路径）
  const url = new URL(`file:///${path.join(projectRoot, 'electron', 'excel-import.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)
  const result = await mod.excelFileToMarkdown(xlsxPath)

  // 基础字段验证
  if (!result.markdown) throw new Error('markdown 为空')
  if (result.sheetCount !== 2) throw new Error(`sheetCount 应为 2，实际 ${result.sheetCount}`)
  if (!result.sheetNames.includes('学生成绩')) throw new Error('缺少「学生成绩」sheet')
  if (!result.sheetNames.includes('课程表')) throw new Error('缺少「课程表」sheet')

  const md = result.markdown

  // 内容验证
  const checks = [
    { needle: '# test-input.xlsx', name: '含文件标题' },
    { needle: '共 2 个工作表', name: '含 sheet 摘要' },
    { needle: '## 学生成绩', name: '含 sheet1 标题' },
    { needle: '## 课程表', name: '含 sheet2 标题' },
    { needle: '| 姓名 |', name: '含 sheet1 表头' },
    { needle: '| 日期 |', name: '含 sheet2 表头' },
    { needle: '张三', name: '含学生姓名' },
    { needle: '92', name: '含数字成绩' },
    { needle: '优秀', name: '含备注文字' },
    { needle: '\\|', name: '转义管道符（|→\\|）' },
    { needle: '<br>', name: '换行→<br>' },
  ]
  for (const c of checks) {
    if (!md.includes(c.needle)) throw new Error(`Markdown 缺失：${c.name}（"${c.needle}"）`)
  }

  // 写入 Markdown 供人工检查
  const mdPath = path.join(outDir, 'excel-import-result.md')
  fs.writeFileSync(mdPath, md, 'utf8')
  ok(`解析 xlsx (${result.sheetCount} sheets, ${md.length} chars) → ${mdPath}`)
} catch (e) {
  ng('解析 xlsx', e)
}

/* ───────── 3. 错误处理（不存在的文件 / 不支持的扩展名） ───────── */
try {
  const url = new URL(`file:///${path.join(projectRoot, 'electron', 'excel-import.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  // 不支持扩展名
  try {
    await mod.excelFileToMarkdown('fake.docx')
    throw new Error('未拒绝不支持的扩展名')
  } catch (e) {
    if (!String(e.message).includes('不支持的 Excel 格式')) {
      throw new Error(`错误消息不匹配：${e.message}`)
    }
  }
  ok('拒绝不支持的扩展名')

  // 不存在的文件
  try {
    await mod.excelFileToMarkdown(path.join(outDir, 'no-such.xlsx'))
    throw new Error('未拒绝不存在的文件')
  } catch (e) {
    // ExcelJS 抛错是被允许的
    if (!e || !e.message) throw new Error('应抛出错误')
  }
  ok('拒绝不存在的文件')
} catch (e) {
  ng('错误处理', e)
}

/* ───────── 4. XLS 旧版格式（构造二进制 + 解析器兼容检查） ───────── */
// .xls 是 BIFF 二进制格式，ExcelJS 不直接支持 readFile .xls，但 .xls 仍可被解析
// 这里只验证扩展名识别和错误消息正确
try {
  const url = new URL(`file:///${path.join(projectRoot, 'electron', 'excel-import.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  // 写一个假的 .xls 文件
  const fakeXls = path.join(outDir, 'fake.xls')
  fs.writeFileSync(fakeXls, 'fake-binary-content', 'utf8')

  try {
    await mod.excelFileToMarkdown(fakeXls)
    // 如果 ExcelJS 拒绝，会抛错
  } catch (e) {
    // 预期错误（不是 unsupported extension）
    if (String(e.message).includes('不支持的 Excel 格式')) {
      throw new Error('不应用扩展名拒绝 .xls')
    }
    ok(`.xls 格式被正确路由到解析器（ExcelJS 拒绝二进制 BIFF 是预期的：${e.message.slice(0, 60)}）`)
  }
} catch (e) {
  ng('XLS 旧格式路由', e)
}

/* ───────── 5. fileAssociations 白名单验证 ───────── */
try {
  const url = new URL(`file:///${path.join(projectRoot, 'electron', 'file-associations.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  for (const ext of ['.xls', '.xlsx', '.xlsm']) {
    const testPath = `test${ext}`
    if (!mod.isAssociableFile(testPath)) {
      throw new Error(`${ext} 未在白名单`)
    }
  }
  ok('白名单覆盖 .xls / .xlsx / .xlsm')
} catch (e) {
  ng('白名单验证', e)
}

/* ───────── 6. .xls 友好错误消息（新增：避免静默失败） ───────── */
try {
  const url = new URL(`file:///${path.join(projectRoot, 'electron', 'excel-import.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  // 假 .xls 文件（被 excelFileToMarkdown 拒绝时返回友好消息）
  const fakeXls = path.join(outDir, 'fake.xls')
  fs.writeFileSync(fakeXls, 'fake-binary', 'utf8')

  let caught = null
  try {
    await mod.excelFileToMarkdown(fakeXls)
  } catch (e) {
    caught = e
  }
  if (!caught) throw new Error('未拒绝 .xls')
  if (!String(caught.message).includes('BIFF')) {
    throw new Error(`错误消息不含 BIFF 提示：${caught.message}`)
  }
  ok(`.xls 返回友好错误消息：${caught.message.slice(0, 40)}...`)
} catch (e) {
  ng('.xls 友好错误', e)
}

/* ───────── 7. SUPPORTED_EXTS 常量 ───────── */
try {
  const url = new URL(`file:///${path.join(projectRoot, 'electron', 'excel-import.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  if (!mod.SUPPORTED_EXTS) throw new Error('未导出 SUPPORTED_EXTS')
  if (!mod.SUPPORTED_EXTS.has('.xlsx')) throw new Error('SUPPORTED_EXTS 缺 .xlsx')
  if (!mod.SUPPORTED_EXTS.has('.xlsm')) throw new Error('SUPPORTED_EXTS 缺 .xlsm')
  if (mod.SUPPORTED_EXTS.has('.xls')) throw new Error('SUPPORTED_EXTS 不应含 .xls')
  ok('SUPPORTED_EXTS = {.xlsx, .xlsm}')
} catch (e) {
  ng('SUPPORTED_EXTS 常量', e)
}

/* ───────── 8. markdownToHtml 表格识别（Critical #1 验证） ───────── */
try {
  const url = new URL(`file:///${path.join(projectRoot, 'wpx-app', 'src', 'utils', 'markdownToEditor.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  const md = `# 测试
## 学生成绩
| 姓名 | 语文 | 数学 |
| --- | --- | --- |
| 张三 | 92 | 88 |
| 李四 | 78 | 82 |
`
  const html = mod.markdownToHtml(md)

  // 必须含 <table><thead><tr><th>...
  if (!html.includes('<table>')) throw new Error('未输出 <table> 标签')
  if (!html.includes('<thead>')) throw new Error('未输出 <thead> 标签')
  if (!html.includes('<th>')) throw new Error('未输出 <th> 标签')
  if (!html.includes('<tbody>')) throw new Error('未输出 <tbody> 标签')
  if (!html.includes('<td>')) throw new Error('未输出 <td> 标签')
  if (!html.includes('张三')) throw new Error('未包含数据行内容')
  if (!html.includes('92')) throw new Error('未包含数字单元格')

  // 写入供人工检查
  const tblPath = path.join(outDir, 'table-render-result.html')
  fs.writeFileSync(tblPath, html, 'utf8')
  ok(`markdownToHtml 表格识别（${html.length} chars） → ${tblPath}`)
} catch (e) {
  ng('markdownToHtml 表格识别', e)
}

/* ───────── 9. markdownToHtml 转义防御（防止 XSS） ───────── */
try {
  const url = new URL(`file:///${path.join(projectRoot, 'wpx-app', 'src', 'utils', 'markdownToEditor.js').replace(/\\/g, '/')}`)
  const mod = await import(url.href)

  const md = `| 单元格 | 描述 |
| --- | --- |
| a | <script>alert(1)</script> |
`
  const html = mod.markdownToHtml(md)
  if (html.includes('<script>')) {
    throw new Error('XSS：<script> 未被转义')
  }
  if (!html.includes('&lt;script&gt;')) {
    throw new Error('XSS：未观察到 escapeHtml 转义结果')
  }
  ok('markdownToHtml 转义 <script>')
} catch (e) {
  ng('XSS 转义防御', e)
}

/* ───────── 总结 ───────── */
console.log('\n' + '='.repeat(60))
console.log(`通过：${pass} / 失败：${fail} / 总计：${pass + fail}`)
console.log(`输出目录：${outDir}`)
console.log('='.repeat(60))

fs.writeFileSync(
  path.join(outDir, 'excel-import-summary.txt'),
  logs.join('\n') + `\n\n通过：${pass} / 失败：${fail}\n`,
  'utf8',
)

process.exit(fail > 0 ? 1 : 0)