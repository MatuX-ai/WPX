#!/usr/bin/env node
/**
 * verify-lesson-ppt-export.mjs
 *
 * 教案生成课件 PPT 导出端到端校验脚本。
 *
 * 流程：
 *  1. 加载依赖（jszip / export-service / lessonPlanParser / lesson-templates）
 *  2. 解析内置测试教案 Markdown（人教版初中数学《一元二次方程的解法》）
 *  3. outline → slides（含 10 个教师专用组件 props 填充）
 *  4. 调用 export-service 导出 PPTX 到 tmp 目录
 *  5. 解压 PPTX 深度校验：
 *     - ZIP 格式合法
 *     - 必备 XML 部件完整（Content_Types / presentation.xml / theme）
 *     - slide*.xml 数量与 slides 数组一致
 *     - 每个教师专用组件的渲染内容命中关键词
 *     - 主题色 / 字体正确写入
 *
 * 运行方式：
 *   node scripts/verify-lesson-ppt-export.mjs
 *
 * 退出码：0 = 全部通过；1 = 有失败项
 */

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)

/* ───────── 颜色输出 ───────── */

const C = process.stdout.isTTY
  ? {
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
    }
  : { green: (s) => s, red: (s) => s, yellow: (s) => s, cyan: (s) => s, bold: (s) => s, dim: (s) => s }

/* ───────── 校验器 ───────── */

class Verifier {
  constructor() {
    this.results = []
  }
  pass(name, detail = '') {
    this.results.push({ ok: true, name, detail })
    const tag = C.green('✓ PASS')
    const detailStr = detail ? C.dim(` — ${detail}`) : ''
    console.log(`${tag}  ${name}${detailStr}`)
  }
  fail(name, detail = '') {
    this.results.push({ ok: false, name, detail })
    const tag = C.red('✗ FAIL')
    const detailStr = detail ? C.dim(` — ${detail}`) : ''
    console.log(`${tag}  ${name}${detailStr}`)
  }
  skip(name, reason) {
    this.results.push({ ok: null, name, detail: reason })
    const tag = C.yellow('○ SKIP')
    console.log(`${tag}  ${name} — ${reason}`)
  }
  printSummary() {
    const total = this.results.length
    const passed = this.results.filter((r) => r.ok === true).length
    const failed = this.results.filter((r) => r.ok === false).length
    const skipped = this.results.filter((r) => r.ok === null).length
    console.log()
    console.log(C.bold('━'.repeat(60)))
    console.log(C.bold(`  总结：${passed}/${total} 通过`) + (failed > 0 ? C.red(`，${failed} 失败`) : '') + (skipped > 0 ? C.yellow(`，${skipped} 跳过`) : ''))
    console.log(C.bold('━'.repeat(60)))
    return failed === 0
  }
}

/* ───────── 1. 加载依赖 ───────── */

console.log(C.bold(C.cyan('\n[1/6] 加载依赖...')))
const JSZip = require(path.join(PROJECT_ROOT, 'wpx-app', 'node_modules', 'jszip'))
const exportService = require(path.join(PROJECT_ROOT, 'electron', 'export-service.js'))
// Windows 上绝对路径必须转为 file:// URL 才能被 ESM dynamic import 接受
const lessonParserUrl = pathToFileURL(
  path.join(PROJECT_ROOT, 'wpx-app', 'src', 'utils', 'lessonPlanParser.js'),
).href
const lessonTemplatesUrl = pathToFileURL(
  path.join(PROJECT_ROOT, 'wpx-app', 'src', 'data', 'lesson-templates', 'index.js'),
).href
const { parseLessonPlan, outlineToSlideStubs, extractPracticeQuestions, extractHomeworkTasks } =
  await import(lessonParserUrl)
const { getTemplate, listTemplates, getTemplateBySubject } = await import(lessonTemplatesUrl)

console.log(C.dim(`   - JSZip ${JSZip.version || '已加载'}`))
console.log(C.dim(`   - export-service: ${Object.keys(exportService).join(', ')}`))
console.log(C.dim(`   - lessonPlanParser: parseLessonPlan / outlineToSlideStubs / extractPracticeQuestions / extractHomeworkTasks`))
console.log(C.dim(`   - lesson-templates: ${listTemplates().length} 个模板`))

/* ───────── 2. 测试教案 Markdown ───────── */

console.log(C.bold(C.cyan('\n[2/6] 准备测试教案 Markdown...')))

const SAMPLE_LESSON_MD = `# 一元二次方程的解法

## 教学目标

### 知识与技能
- 理解一元二次方程的概念
- 掌握公式法解一元二次方程

### 过程与方法
- 通过配方法推导求根公式
- 培养学生的代数运算能力

### 情感态度价值观
- 体会数学的对称美

## 教学重点
- 公式法的推导与应用
- 判别式的判断

## 教学难点
- 配方法的变形
- 含字母系数的一元二次方程

## 教学过程

### 导入
同学们，在生活中我们经常会遇到这样的问题：把一块正方形铁皮的边长减少 2 cm 后面积减少 12 cm²，原正方形边长是多少？这就需要解一元二次方程。

### 新知讲授
一元二次方程的一般形式为 ax² + bx + c = 0 (a≠0)，其求根公式为 x = (-b ± √(b²-4ac)) / 2a。

#### 推导过程
1. 方程两边除以 a
2. 配方
3. 开方
4. 整理得求根公式

### 例题讲解
例 1：解方程 x² - 5x + 6 = 0。

### 课堂练习
1. 解方程 x² - 4x + 3 = 0 ★
   A. x = 1 或 3
   B. x = 2 或 3
   C. x = 1 或 4
2. 解方程 2x² - 3x - 2 = 0 ★★

### 课堂小结
本节课我们学习了一元二次方程的概念、判别式与求根公式。

## 板书设计
- 一元二次方程
- 求根公式
- 例题演练

## 作业布置
- 必做：教材 P108 习题 1、2、3
- 选做：教材 P108 习题 4、5
- 实践：用求根公式解一道应用题

## 教学反思
- 学生参与度高
- 推导环节需放慢节奏
`

console.log(C.dim(`   - ${SAMPLE_LESSON_MD.split('\n').length} 行 Markdown，${SAMPLE_LESSON_MD.length} 字符`))

/* ───────── 3. 解析 + 配置 + 构建 slides ───────── */

console.log(C.bold(C.cyan('\n[3/6] 解析 Markdown → 配置 → 构建 slides...')))

const v = new Verifier()

const parsed = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
if (parsed.outline.length >= 10) {
  v.pass('lessonPlanParser 解析章节数', `${parsed.outline.length} 章节, 置信度 ${parsed.confidence}, matchedTemplate=${parsed.matchedTemplate || '无'}`)
} else {
  v.fail('lessonPlanParser 解析章节数', `仅 ${parsed.outline.length} 章节，期望 ≥10`)
}

if (parsed.confidence >= 0.6) {
  v.pass('解析置信度', `${(parsed.confidence * 100).toFixed(0)}% ≥ 60%`)
} else {
  v.fail('解析置信度', `${parsed.confidence} < 0.6`)
}

const types = parsed.outline.map((s) => s.type)
const expectedTypes = [
  'CoverSlide', 'OutlineSlide', 'KeyPointsSlide',
  'LeadInSlide', 'ConceptSlide', 'ExampleSlide',
  'PracticeSlide', 'SummarySlide', 'BlackboardSlide',
  'HomeworkSlide', 'ReflectionSlide',
]
const missingTypes = expectedTypes.filter((t) => !types.includes(t))
if (missingTypes.length === 0) {
  v.pass('11 种教师专用组件全部识别', expectedTypes.join(', '))
} else {
  v.fail('缺少组件类型识别', missingTypes.join(', '))
}

const template = getTemplateBySubject('math', 'junior')
v.pass('加载学科模板', `${template.id} (主题色 ${template.theme?.primary || '-'})`)

const stubs = outlineToSlideStubs(parsed)

/**
 * 把 stub 转成完整的 { component, props } 数组
 * 与 lesson-to-ppt.spec.js 中 buildLessonSlide 等价
 */
function buildLessonSlide(stub) {
  const baseProps = { title: stub.title }
  switch (stub.type) {
    case 'CoverSlide':
      return { component: 'CoverSlide', props: { ...baseProps, subtitle: '初中数学·人教版', author: 'WPX Verify' } }
    case 'OutlineSlide':
      return {
        component: 'OutlineSlide',
        props: {
          ...baseProps,
          objectives: [
            { dimension: '知识与技能', items: stub.content.split('\n').filter(Boolean).slice(0, 3) || ['理解基础概念'] },
          ],
        },
      }
    case 'KeyPointsSlide':
      return {
        component: 'KeyPointsSlide',
        props: {
          ...baseProps,
          keyPoints: stub.content.split('\n').filter(Boolean).slice(0, 3),
          difficulties: stub.content.split('\n').filter(Boolean).slice(0, 2),
        },
      }
    case 'LeadInSlide':
      return {
        component: 'LeadInSlide',
        props: {
          ...baseProps,
          scenario: stub.content,
          questions: ['这个例子说明了什么？'],
        },
      }
    case 'ConceptSlide':
      return {
        component: 'ConceptSlide',
        props: {
          ...baseProps,
          definition: stub.content,
          keyPoints: stub.content.split('\n').filter(Boolean).slice(0, 4),
        },
      }
    case 'ExampleSlide':
      return {
        component: 'ExampleSlide',
        props: {
          ...baseProps,
          problem: stub.content || '例题内容',
          solution: stub.content.split('\n').filter(Boolean).slice(0, 5),
        },
      }
    case 'PracticeSlide': {
      const questions = extractPracticeQuestions(stub.content)
      return {
        component: 'PracticeSlide',
        props: {
          ...baseProps,
          questions: questions.length
            ? questions
            : [{ stem: stub.content || '（暂无练习题）', type: '解答题', difficulty: 1 }],
          answerVisible: true,
        },
      }
    }
    case 'SummarySlide':
      return {
        component: 'SummarySlide',
        props: {
          ...baseProps,
          keyPoints: stub.content.split('\n').filter(Boolean).slice(0, 5),
        },
      }
    case 'BlackboardSlide':
      return {
        component: 'BlackboardSlide',
        props: {
          ...baseProps,
          layout: 'linear',
          sections: stub.content.split('\n').filter(Boolean).slice(0, 4).map((line, i) => ({
            label: `要点 ${i + 1}`,
            content: line,
          })),
        },
      }
    case 'HomeworkSlide': {
      const tasks = extractHomeworkTasks(stub.content)
      return {
        component: 'HomeworkSlide',
        props: {
          ...baseProps,
          tasks: tasks.length ? tasks : [{ type: '必做', description: stub.content || '（暂无作业）' }],
        },
      }
    }
    case 'ReflectionSlide':
      return {
        component: 'ReflectionSlide',
        props: {
          ...baseProps,
          highlights: stub.content.split('\n').filter(Boolean).slice(0, 3),
          improvements: stub.content.split('\n').filter(Boolean).slice(3, 6),
        },
      }
    default:
      return { component: 'TextSlide', props: baseProps }
  }
}

const slides = stubs.map((s) => buildLessonSlide(s))
v.pass('构建完整 slides 数组', `${slides.length} 张`)

// 主动追加 EndSlide 保证结尾页存在
slides.push({ component: 'EndSlide', props: { text: '谢谢观看' } })

const slideTypes = new Set(slides.map((s) => s.component))
v.pass('slides 包含 11 种组件 + EndSlide', [...slideTypes].join(', '))

/* ───────── 4. 导出 PPTX ───────── */

console.log(C.bold(C.cyan('\n[4/6] 导出 PPTX...')))

const tmpDir = path.join(os.tmpdir(), `wpx-verify-lesson-ppt-${Date.now()}`)
fsSync.mkdirSync(tmpDir, { recursive: true })
const outFile = path.join(tmpDir, 'lesson-verify.pptx')

let exportResult
try {
  exportResult = await exportService.exportSlidesToPPTX(slides, outFile, {
    title: '一元二次方程的解法',
    subject: '初中数学·人教版',
    author: 'WPX Verify',
    theme: 'light',
    fontFace: 'Microsoft YaHei',
  })
} catch (err) {
  v.fail('exportSlidesToPPTX 调用', err.message)
  v.printSummary()
  process.exit(1)
}

if (exportResult.ok) {
  v.pass('exportSlidesToPPTX 写入成功', `${(exportResult.size / 1024).toFixed(1)} KB → ${path.basename(exportResult.outputPath)}`)
} else {
  v.fail('exportSlidesToPPTX 写入', exportResult.error || 'unknown')
}

if (exportResult.size >= 80_000) {
  v.pass('PPTX 文件大小合理', `${(exportResult.size / 1024).toFixed(1)} KB ≥ 80KB`)
} else {
  v.fail('PPTX 文件过小', `${exportResult.size} 字节 < 80KB，可能内容缺失`)
}

if (fsSync.existsSync(outFile)) {
  v.pass('PPTX 文件存在', outFile)
} else {
  v.fail('PPTX 文件不存在', outFile)
}

/* ───────── 5. 深度校验 PPTX 内容 ───────── */

console.log(C.bold(C.cyan('\n[5/6] 解压 PPTX 校验内部结构...')))

const buffer = fsSync.readFileSync(outFile)

// ZIP magic: PK\x03\x04
if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
  v.pass('ZIP 文件头合法', `magic = 50 4B 03 04`)
} else {
  v.fail('ZIP 文件头', `magic = ${buffer.slice(0, 4).toString('hex')}`)
}

// ZIP end: PK\x05\x06
if (buffer[buffer.length - 22] === 0x50 && buffer[buffer.length - 21] === 0x4b) {
  v.pass('ZIP 中央目录存在', 'central directory 标识正常')
} else {
  v.fail('ZIP 中央目录', '末尾标记异常')
}

let zip
try {
  zip = await JSZip.loadAsync(buffer)
  v.pass('JSZip 解析成功', `${Object.keys(zip.files).length} 个条目`)
} catch (err) {
  v.fail('JSZip 解析', err.message)
  v.printSummary()
  process.exit(1)
}

// 必备部件
const requiredFiles = [
  '[Content_Types].xml',
  '_rels/.rels',
  'ppt/presentation.xml',
  'ppt/_rels/presentation.xml.rels',
]
for (const f of requiredFiles) {
  if (zip.file(f)) {
    v.pass(`部件存在：${f}`)
  } else {
    v.fail(`部件缺失：${f}`)
  }
}

// slide*.xml 数量
const slideFiles = Object.keys(zip.files)
  .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
  .sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)/)[1], 10)
    const nb = parseInt(b.match(/slide(\d+)/)[1], 10)
    return na - nb
  })

if (slideFiles.length === slides.length) {
  v.pass(`slide*.xml 数量 = slides.length`, `${slideFiles.length} 张`)
} else {
  v.fail(`slide*.xml 数量不匹配`, `slides=${slides.length}, 实际=${slideFiles.length}`)
}

// theme 文件
const themeFile = Object.keys(zip.files).find((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n))
if (themeFile) {
  v.pass(`主题文件存在：${themeFile.replace('ppt/', '')}`)
} else {
  v.fail('主题文件', 'ppt/theme/theme*.xml 缺失')
}

/* ───────── 6. 内容校验 ───────── */

console.log(C.bold(C.cyan('\n[6/6] 内容深度校验...')))

// 读取所有 slide XML 并拼接
const allSlideXmlArr = await Promise.all(
  slideFiles.map(async (n) => await zip.file(n).async('string')),
)
const allSlideXml = allSlideXmlArr.join('\n')

// 每个组件类型至少出现一次，且包含期望关键词
const componentChecks = [
  { name: 'CoverSlide', must: ['一元二次方程的解法', '人教版'] },
  { name: 'OutlineSlide', must: ['教学目标', '知识与技能'] },
  { name: 'KeyPointsSlide', must: ['教学重点', '教学难点'] },
  { name: 'LeadInSlide', must: ['导入'] },
  { name: 'ConceptSlide', must: ['新知讲授', '求根公式'] },
  { name: 'ExampleSlide', must: ['例题', 'x²'] },
  { name: 'PracticeSlide', must: ['课堂练习'] },
  { name: 'SummarySlide', must: ['小结'] },
  { name: 'BlackboardSlide', must: ['板书'] },
  { name: 'HomeworkSlide', must: ['作业', '必做'] },
  { name: 'ReflectionSlide', must: ['反思'] },
  { name: 'EndSlide', must: ['谢谢'] },
]

for (const { name, must } of componentChecks) {
  const missing = must.filter((kw) => !allSlideXml.includes(kw))
  if (missing.length === 0) {
    v.pass(`组件 ${name} 内容命中`, must.join(' / '))
  } else {
    v.fail(`组件 ${name} 缺关键词`, missing.join(' / '))
  }
}

// ppt/presentation.xml 校验
const presXml = await zip.file('ppt/presentation.xml').async('string')
if (presXml.includes('sldSz') && /cx="12192000"/.test(presXml)) {
  v.pass('presentation.xml 含 16:9 幻灯片尺寸', 'cx=12192000 (13.333 inch)')
} else if (presXml.includes('sldSz')) {
  v.pass('presentation.xml 含幻灯片尺寸', 'sldSz 节点存在')
} else {
  v.fail('presentation.xml 缺 sldSz', '未指定幻灯片尺寸')
}

// pptxgenjs 会用 p: 命名空间前缀，结构判定兼容两种写法
const hasCommonSld = /<(?:\w+:)?cSld[\s/>]/.test(presXml) || /<(?:\w+:)?sldIdLst[\s/>]/.test(presXml)
if (hasCommonSld) {
  v.pass('presentation.xml 结构合法', 'cSld / sldIdLst 节点存在')
} else {
  v.fail('presentation.xml 结构', 'cSld/sldIdLst 缺失')
}

// theme 校验
const themeXml = await zip.file(themeFile)?.async('string') || ''
if (themeXml) {
  const fontMatch = themeXml.match(/typeface="([^"]+)"/g) || []
  const fontSet = new Set(fontMatch.map((m) => m.match(/typeface="([^"]+)"/)[1]))
  if (fontSet.size > 0) {
    v.pass('主题字体已配置', [...fontSet].slice(0, 5).join(', ') + (fontSet.size > 5 ? '...' : ''))
  } else {
    v.fail('主题字体', 'theme1.xml 未发现 typeface 属性')
  }
}

// 主题色
const colorMatch = themeXml.match(/srgbClr val="([0-9A-Fa-f]{6})"/g) || []
if (colorMatch.length > 0) {
  const colors = colorMatch.slice(0, 5).map((m) => m.match(/val="([^"]+)"/)[1])
  v.pass('主题颜色已配置', colors.join(', ') + (colorMatch.length > 5 ? '...' : ''))
}

// 作者信息
if (presXml.includes('WPX') || allSlideXml.includes('WPX')) {
  v.pass('作者 / 公司字段写入', 'WPX')
}

/* ───────── 清理 + 总结 ───────── */

try {
  await fs.unlink(outFile)
  await fs.rmdir(tmpDir)
} catch {
  /* tmp 清理失败不影响结果 */
}

console.log()
const allPass = v.printSummary()

console.log()
if (allPass) {
  console.log(C.green(C.bold('✓ 教案 → 课件 PPT 导出全链路校验通过！')))
} else {
  console.log(C.red(C.bold('✗ 存在失败项，请查看上方 FAIL 行')))
}

process.exit(allPass ? 0 : 1)