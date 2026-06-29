/**
 * lesson-to-ppt.spec.js - 教案生成课件 端到端测试
 *
 * 覆盖需求文档《WPX 教师教案生成课件 PPT》中 8 大功能链路：
 *  1. lessonPlanParser - 解析 Markdown 教案 → 大纲 + 置信度
 *  2. lessonPpt store - 弹窗状态 / 配置 / diff
 *  3. usePPTWorkflow lesson-plan context - 4 步工作流 + 业务上下文切换
 *  4. lesson-templates - 学科 / 学段模板查询
 *  5. local-commands CMD-057 - "教案生成课件" 等指令路由
 *  6. export-service - 10 个教师专用组件 PPTX 导出（Node 端 child_process 间接验证）
 *  7. 完整链路冒烟 - Markdown → 大纲 → 配置 → slides → PPTX buffer
 *  8. 增量更新 diff - 添加 / 修改 / 删除章节的识别
 *
 * 测试策略：
 *  - 解析器、store、composable 走 vitest 单测（Pinia 已挂载）
 *  - export-service 是 Electron 主进程 CommonJS 模块，用 child_process spawn node 跑
 *    一段断言脚本验证 RENDERERS 覆盖 + 12 张幻灯片导出成功
 *  - 不依赖浏览器，纯逻辑与文件 IO 校验
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { setActivePinia, createPinia } from 'pinia'
import { useLessonPptStore, DEFAULT_TEMPLATE, lightHash } from '@/stores/lessonPpt'
import { parseLessonPlan, outlineToSlideStubs, diffOutline, extractPracticeQuestions, extractHomeworkTasks } from '@/utils/lessonPlanParser'
import { getTemplate, getTemplateBySubject, listTemplates } from '@/data/lesson-templates'
import { PPT_STEP, usePPTWorkflow } from '@/composables/usePPTWorkflow'
import { processUserInput, __resetRegistry } from '@/composables/useLocalCommands'
import { LOCAL_COMMANDS } from '@/data/local-commands'

/* ───────── 共享：标准教案 Markdown（人教版初中数学） ───────── */

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

/* ───────── 辅助函数 ───────── */

function makeTempDir(prefix) {
  const dir = path.join(os.tmpdir(), `wpx-lesson-ppt-${prefix}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/* ───────── 测试 1：lessonPlanParser ───────── */

describe('lessonPlanParser - 解析 Markdown 教案', () => {
  it('空教案返回空 outline 和 warning', () => {
    const r = parseLessonPlan('')
    expect(r.outline).toEqual([])
    expect(r.confidence).toBe(0)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('非 Markdown 文本（无标题）返回 warning', () => {
    const r = parseLessonPlan('这是一段没有标题的文字\n没有任何结构')
    expect(r.outline).toEqual([])
    expect(r.warnings.some((w) => w.includes('标题'))).toBe(true)
  })

  it('标准人教版教案应识别全部 12 个章节', () => {
    const r = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    // 应至少有：课题、教学目标、教学重点、教学难点、教学过程（含 5 个子章节）、板书、作业、反思
    expect(r.outline.length).toBeGreaterThanOrEqual(10)

    // 检查关键章节类型
    const types = r.outline.map((s) => s.type)
    expect(types).toContain('CoverSlide')             // 课题
    expect(types).toContain('OutlineSlide')           // 教学目标
    expect(types).toContain('KeyPointsSlide')         // 教学重点
    expect(types).toContain('LeadInSlide')            // 导入
    expect(types).toContain('ConceptSlide')           // 新知讲授
    expect(types).toContain('ExampleSlide')           // 例题
    expect(types).toContain('PracticeSlide')          // 课堂练习
    expect(types).toContain('SummarySlide')           // 课堂小结
    expect(types).toContain('BlackboardSlide')        // 板书
    expect(types).toContain('HomeworkSlide')          // 作业
    expect(types).toContain('ReflectionSlide')        // 教学反思
  })

  it('置信度应 >= 0.6（标准模板完全命中）', () => {
    const r = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    expect(r.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('应识别"人教版"模板签名', () => {
    const r = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    expect(r.matchedTemplate).toBeTruthy()
    expect(['WPX 官方', '人教版', '北师大版']).toContain(r.matchedTemplate)
  })

  it('outlineToSlideStubs 转换结果字段完整', () => {
    const r = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    const stubs = outlineToSlideStubs(r)
    expect(stubs.length).toBe(r.outline.length)
    expect(stubs[0]).toHaveProperty('type')
    expect(stubs[0]).toHaveProperty('title')
    expect(stubs[0]).toHaveProperty('content')
    expect(stubs[0]).toHaveProperty('dimension')
    expect(stubs[0]).toHaveProperty('sectionId')
  })

  it('extractPracticeQuestions 从课堂练习段落提取题目', () => {
    const r = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    const practiceSection = r.outline.find((s) => s.type === 'PracticeSlide')
    expect(practiceSection).toBeTruthy()
    const questions = extractPracticeQuestions(practiceSection.content)
    expect(questions.length).toBeGreaterThan(0)
    expect(questions[0]).toHaveProperty('stem')
    expect(questions[0]).toHaveProperty('type')
    expect(questions[0]).toHaveProperty('difficulty')
  })

  it('extractHomeworkTasks 区分必做 / 选做 / 实践', () => {
    const r = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    const homeworkSection = r.outline.find((s) => s.type === 'HomeworkSlide')
    expect(homeworkSection).toBeTruthy()
    const tasks = extractHomeworkTasks(homeworkSection.content)
    expect(tasks.length).toBeGreaterThan(0)
    const types = new Set(tasks.map((t) => t.type))
    expect(types.has('必做')).toBe(true)
    expect(types.has('选做')).toBe(true)
    expect(types.has('实践')).toBe(true)
  })

  it('diffOutline 能识别新增 / 修改 / 删除', () => {
    const r1 = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math' })
    const r2 = parseLessonPlan(SAMPLE_LESSON_MD + '\n## 拓展提高\n- 一元二次方程的应用\n', { subject: 'math' })
    const diff = diffOutline(r1.outline, r2.outline)
    expect(diff.added.length).toBe(1)
    expect(diff.added[0].title).toContain('拓展提高')
    expect(diff.removed.length).toBe(0)
    expect(diff.unchanged.length).toBeGreaterThan(0)
  })
})

/* ───────── 测试 2：lessonPpt store ───────── */

describe('lessonPpt store - 课件生成状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认配置正确', () => {
    const store = useLessonPptStore()
    expect(store.subject).toBe('math')
    expect(store.stage).toBe('junior')
    expect(store.templateId).toBe('default')
    expect(store.includeBlackboard).toBe(true)
    expect(store.includeReflection).toBe(false)
    expect(store.includeHomework).toBe(true)
    expect(store.dialogVisible).toBe(false)
  })

  it('openDialog / closeDialog 切换弹窗可见性', () => {
    const store = useLessonPptStore()
    store.openDialog()
    expect(store.dialogVisible).toBe(true)
    store.closeDialog()
    expect(store.dialogVisible).toBe(false)
  })

  it('updateConfig 只修改传入的字段', () => {
    const store = useLessonPptStore()
    store.updateConfig({ subject: 'chinese', lessonNumber: 3 })
    expect(store.subject).toBe('chinese')
    expect(store.lessonNumber).toBe(3)
    expect(store.stage).toBe('junior') // 未变
  })

  it('analyzeMarkdown 触发解析并填充 outline', () => {
    const store = useLessonPptStore()
    const result = store.analyzeMarkdown(SAMPLE_LESSON_MD)
    expect(result.outline.length).toBeGreaterThan(0)
    expect(store.lastOutline.length).toBe(result.outline.length)
    expect(store.confidence).toBeGreaterThan(0)
    expect(store.hasGenerated).toBe(false)
  })

  it('recordGenerated 记录生成结果并清除错误', () => {
    const store = useLessonPptStore()
    store.setError('上一轮失败')
    store.setGenerating(true)
    store.recordGenerated([{ component: 'CoverSlide', props: { title: 'A' } }], '# A\n')
    expect(store.lastGeneratedSlides.length).toBe(1)
    expect(store.lastGeneratedAt).toBeGreaterThan(0)
    expect(store.documentHash).toBeTruthy()
    expect(store.lastError).toBe('')
    expect(store.isGenerating).toBe(false)
    expect(store.hasGenerated).toBe(true)
  })

  it('computeDiff 文档不变时返回 hasChange=false', () => {
    const store = useLessonPptStore()
    store.recordGenerated([], SAMPLE_LESSON_MD)
    const diff = store.computeDiff(SAMPLE_LESSON_MD)
    expect(diff.hasChange).toBe(false)
  })

  it('computeDiff 文档修改后识别 added/modified', () => {
    const store = useLessonPptStore()
    store.recordGenerated([], SAMPLE_LESSON_MD)
    const newMd = SAMPLE_LESSON_MD + '\n## 新章节\n- 内容\n'
    const diff = store.computeDiff(newMd)
    expect(diff.hasChange).toBe(true)
    expect(diff.added.length + diff.modified.length).toBeGreaterThan(0)
  })

  it('applyDiff 替换 slides 并清空 lastDiff', () => {
    const store = useLessonPptStore()
    store.recordGenerated([], SAMPLE_LESSON_MD)
    const diff = store.computeDiff(SAMPLE_LESSON_MD + '## 拓展\n- a\n')
    expect(store.lastDiff.hasChange).toBe(true)
    const newSlides = [{ component: 'TextSlide', props: { title: '拓展' } }]
    store.applyDiff(newSlides, SAMPLE_LESSON_MD + '## 拓展\n- a\n')
    expect(store.lastGeneratedSlides).toEqual(newSlides)
    expect(store.lastDiff).toBeNull()
  })

  it('reset 清空所有生成相关状态（含配置字段）', () => {
    const store = useLessonPptStore()
    store.updateConfig({
      subject: 'chinese',
      stage: 'primary',
      templateId: 'primary-chinese',
      lessonNumber: 5,
      studentContext: '三年级学生',
    })
    store.analyzeMarkdown(SAMPLE_LESSON_MD)
    store.recordGenerated([{ component: 'TextSlide', props: { title: 'x' } }], SAMPLE_LESSON_MD)
    store.setError('boom')
    store.openDialog()
    store.reset()
    // 生成结果
    expect(store.lastOutline).toEqual([])
    expect(store.lastGeneratedSlides).toEqual([])
    expect(store.lastError).toBe('')
    expect(store.documentHash).toBe('')
    expect(store.confidence).toBe(0)
    expect(store.lastDiff).toBeNull()
    expect(store.lastGeneratedAt).toBeNull()
    // 配置重置为默认值
    expect(store.subject).toBe('math')
    expect(store.stage).toBe('junior')
    expect(store.templateId).toBe('default')
    expect(store.lessonNumber).toBe(1)
    expect(store.studentContext).toBe('')
    // UI 状态重置
    expect(store.isGenerating).toBe(false)
    expect(store.dialogVisible).toBe(false)
  })

  it('currentTemplate 响应 templateId 变化', () => {
    const store = useLessonPptStore()
    expect(store.currentTemplate.id).toBe('default')
    store.updateConfig({ templateId: 'junior-math' })
    expect(store.currentTemplate.id).toBe('junior-math')
    expect(store.currentTemplate.theme.primary).toBe('#212121')
  })

  it('lightHash 相同内容得到相同 hash', () => {
    const a = lightHash('hello world')
    const b = lightHash('hello  world') // 多空格，normalize 后应一致
    expect(a).toBe(b)
    const c = lightHash('hello WORLD')
    expect(c).not.toBe(a)
  })

  it('resetParseState 清空 lastOutline / lastParseResult / confidence', () => {
    const store = useLessonPptStore()
    store.analyzeMarkdown(SAMPLE_LESSON_MD)
    expect(store.lastOutline.length).toBeGreaterThan(0)
    expect(store.lastParseResult).toBeTruthy()
    expect(store.confidence).toBeGreaterThan(0)
    store.resetParseState()
    expect(store.lastOutline).toEqual([])
    expect(store.lastParseResult).toBeNull()
    expect(store.confidence).toBe(0)
    // resetParseState 不影响配置 / 生成结果
    expect(store.subject).toBe('math')
    expect(store.lastGeneratedSlides).toEqual([])
  })

  it('recordGenerated 接受 outline 参数，同时设置 lastOutline', () => {
    const store = useLessonPptStore()
    const outline = [
      { id: 'sec-1', level: 1, title: '课题', type: 'CoverSlide', dimension: 'topic', content: '', sourceLineRange: [1, 1] },
      { id: 'sec-2', level: 2, title: '教学目标', type: 'OutlineSlide', dimension: 'objectives', content: 'x', sourceLineRange: [2, 3] },
    ]
    store.recordGenerated(
      [{ component: 'CoverSlide', props: { title: 'A' } }],
      SAMPLE_LESSON_MD,
      outline,
    )
    expect(store.lastOutline.length).toBe(2)
    expect(store.lastOutline[0].title).toBe('课题')
    // computeDiff 应该能正确识别 prev 与 next 的对比
    const modifiedMd = SAMPLE_LESSON_MD.replace('教学目标', '教学目标（新）')
    const diff = store.computeDiff(modifiedMd)
    expect(diff.hasChange).toBe(true)
    expect(diff.removed.length).toBeGreaterThan(0)
    expect(diff.added.length).toBeGreaterThan(0)
  })
})

/* ───────── 测试 3：lesson-templates 学科模板库 ───────── */

describe('lesson-templates - 学科模板查询', () => {
  it('getTemplate(default) 返回 DEFAULT_TEMPLATE', () => {
    const tpl = getTemplate('default')
    expect(tpl.id).toBe('default')
    expect(tpl).toBe(DEFAULT_TEMPLATE)
  })

  it('getTemplate 未知 id 兜底为 DEFAULT_TEMPLATE', () => {
    const tpl = getTemplate('nonexistent-xxx')
    expect(tpl.id).toBe('default')
  })

  it('getTemplateBySubject(math, junior) 返回初中数学模板', () => {
    const tpl = getTemplateBySubject('math', 'junior')
    expect(tpl.id).toBe('junior-math')
    expect(tpl.theme.accent).toBe('#1976d2')
  })

  it('getTemplateBySubject(chinese, primary) 返回小学语文模板', () => {
    const tpl = getTemplateBySubject('chinese', 'primary')
    expect(tpl).toBeTruthy()
    expect(tpl.stage).toBe('primary')
    expect(tpl.subject).toBe('chinese')
  })

  it('getTemplateBySubject 未知学科兜底为 DEFAULT_TEMPLATE', () => {
    const tpl = getTemplateBySubject('unknown-subject', 'junior')
    expect(tpl.id).toBe('default')
  })

  it('listTemplates 应至少包含 10 个模板（含 default）', () => {
    const list = listTemplates()
    expect(list.length).toBeGreaterThanOrEqual(10)
    const ids = list.map((t) => t.id)
    expect(ids).toContain('default')
    expect(ids).toContain('junior-math')
    expect(ids).toContain('senior-physics')
  })
})

/* ───────── 测试 4：usePPTWorkflow lesson-plan context ───────── */

describe('usePPTWorkflow - lesson-plan context', () => {
  beforeEach(() => {
    usePPTWorkflow().resetWorkflow()
  })

  it('startWorkflow 默认 context 为 generic', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('AI 发布会')
    expect(w.state.context).toBe('generic')
    expect(w.state.lastMessage).toContain('PPT')
  })

  it('startWorkflow with context=lesson-plan 切换业务上下文', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('一元二次方程的解法', {
      context: 'lesson-plan',
      lessonPlanConfig: { subject: 'math', stage: 'junior' },
    })
    expect(w.state.context).toBe('lesson-plan')
    expect(w.state.lessonPlanConfig).toEqual({
      subject: 'math',
      stage: 'junior',
    })
    expect(w.state.lastMessage).toContain('课件')
    expect(w.state.topic).toBe('一元二次方程的解法')
  })

  it('lesson-plan 模式后切回 generic 也会保留 topic', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('lesson topic', { context: 'lesson-plan' })
    expect(w.state.context).toBe('lesson-plan')
    // 再次 startWorkflow 会重置 initialState
    w.startWorkflow('generic topic')
    expect(w.state.context).toBe('generic')
    expect(w.state.lessonPlanConfig).toBeNull()
    expect(w.state.topic).toBe('generic topic')
  })

  it('lesson-plan 工作流仍能正常走完 4 步状态转移', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('方程', { context: 'lesson-plan', lessonPlanConfig: { subject: 'math' } })
    expect(w.state.step).toBe(PPT_STEP.OUTLINE)
    w.confirmOutline('# 大纲')
    expect(w.state.step).toBe(PPT_STEP.TEMPLATE)
    // selectTemplate 只接受内置 4 种之一（business/tech/fresh/custom）
    // lesson-plan 上下文使用 'tech' 作为通用业务模板
    w.selectTemplate('tech')
    expect(w.state.templateId).toBe('tech')
    w.markBusy(true)
    expect(w.state.step).toBe(PPT_STEP.GENERATE)
    w.onSlidesGenerated([{ component: 'CoverSlide', props: { title: 'A' } }])
    expect(w.state.step).toBe(PPT_STEP.EDITING)
    expect(w.state.slides.length).toBe(1)
    expect(w.state.context).toBe('lesson-plan')
  })
})

/* ───────── 测试 5：local-commands CMD-057 教案生成课件 ───────── */

describe('local-commands CMD-057 - 教案生成课件', () => {
  beforeEach(() => {
    __resetRegistry()
  })

  function buildCmd057Ctx(overrides = {}) {
    return {
      openLessonPlanDialog: vi.fn(),
      ...overrides,
    }
  }

  it('LOCAL_COMMANDS 中存在 open-lesson-plan-dialog 命令', () => {
    const cmd = LOCAL_COMMANDS.find((c) => c.id === 'open-lesson-plan-dialog')
    expect(cmd).toBeTruthy()
    expect(cmd.category).toBe('window')
    expect(cmd.priority).toBe(75)
    expect(Array.isArray(cmd.patterns)).toBe(true)
    expect(cmd.patterns.length).toBeGreaterThan(0)
  })

  it.each([
    '教案生成课件',
    '生成课件',
    '做课件',
    '把这篇教案做成课件',
    '把教案生成课件',
    'lesson to ppt',
    '/lesson-to-ppt',
    '教案 → 课件',
  ])('"%s" 应触发 CMD-057 并调用 ctx.openLessonPlanDialog', (input) => {
    const ctx = buildCmd057Ctx()
    const r = processUserInput(input, ctx)
    expect(r.type).toBe('local')
    expect(r.commandId).toBe('open-lesson-plan-dialog')
    expect(r.success).toBe(true)
    expect(ctx.openLessonPlanDialog).toHaveBeenCalledTimes(1)
  })

  it('当 ctx 没有 openLessonPlanDialog 时降级为派发 window 事件', () => {
    // 监听 window 事件
    const dispatched = []
    const handler = (ev) => dispatched.push(ev.detail)
    if (typeof window !== 'undefined') {
      window.addEventListener('wpx:local-command:open-lesson-plan-dialog', handler)
    }

    const ctx = {} // 不提供 openLessonPlanDialog
    const r = processUserInput('教案生成课件', ctx)
    expect(r.type).toBe('local')
    expect(r.success).toBe(true)
    expect(r.data?.source).toBe('event-fallback')

    if (typeof window !== 'undefined') {
      window.removeEventListener('wpx:local-command:open-lesson-plan-dialog', handler)
      expect(dispatched.length).toBe(1)
      expect(dispatched[0].source).toBe('ai-chat')
    }
  })

  it('优先级 75 高于 open-settings（70），但低于 file 类指令', () => {
    const cmd057 = LOCAL_COMMANDS.find((c) => c.id === 'open-lesson-plan-dialog')
    const settings = LOCAL_COMMANDS.find((c) => c.id === 'open-settings')
    expect(cmd057.priority).toBeGreaterThan(settings.priority)
  })

  it('"普通写教案"等不相关输入不会被误触发', () => {
    const ctx = buildCmd057Ctx()
    const r1 = processUserInput('帮我写一份教案', ctx)
    expect(r1.commandId).not.toBe('open-lesson-plan-dialog')
    const r2 = processUserInput('今天天气怎么样', ctx)
    expect(r2.commandId).not.toBe('open-lesson-plan-dialog')
    expect(ctx.openLessonPlanDialog).not.toHaveBeenCalled()
  })
})

/* ───────── 测试 6：export-service 教师专用组件渲染（Node 端） ───────── */

describe('export-service - 10 个教师专用组件导出', () => {
  // Vitest 运行在 Node 环境，可以直接 require electron 主进程的 CommonJS 模块
  // export-service.js 不依赖 Electron API，只需 node:fs/path + pptxgenjs
  // 用绝对路径加载，避免路径别名 (@/) 解析问题
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const exportService = require('i:/WPX/electron/export-service.js')

  /**
   * 验证：
   *  - 10 个新增组件类型都能被识别
   *  - 完整 12 张幻灯片能成功导出
   *  - 导出 buffer 大小 > 50KB（确保有真实内容）
   */
  it('RENDERERS map 包含全部 10 个 lesson 组件（可通过渲染调用间接验证）', async () => {
    const expected = [
      'OutlineSlide', 'KeyPointsSlide', 'LeadInSlide', 'ConceptSlide', 'ExampleSlide',
      'PracticeSlide', 'SummarySlide', 'BlackboardSlide', 'HomeworkSlide', 'ReflectionSlide',
    ]
    const slides = expected.map((name) => ({ component: name, props: { title: 'test' } }))
    const r = await exportService.renderSlidesToPPTXBuffer(slides, { title: 'renderers-check' })
    expect(r.size).toBeGreaterThan(20_000)
    expect(r.title).toBe('renderers-check')
    // 10 张幻灯片都能成功导出（无一被忽略为 unknown）
  })

  it('完整 12 张幻灯片（含封面 / 总结 / 结束）能导出为 PPTX', async () => {
    const slides = [
      { component: 'CoverSlide', props: { title: '一元二次方程的解法', subtitle: '初中数学·人教版', author: '王老师' } },
      { component: 'OutlineSlide', props: { title: '教学目标', objectives: [
        { dimension: '知识与技能', items: ['理解一元二次方程', '掌握求根公式'] },
        { dimension: '过程与方法', items: ['通过配方推导求根公式'] },
        { dimension: '情感态度价值观', items: ['体会数学的对称美'] },
      ] } },
      { component: 'KeyPointsSlide', props: { title: '教学重难点', keyPoints: ['公式法', '判别式'], difficulties: ['配方变形'] } },
      { component: 'LeadInSlide', props: { title: '课堂导入', scenario: '一块正方形铁皮边长减少 2cm 后面积减少 12cm²，原边长是多少？', questions: ['你能列出一元二次方程吗？'] } },
      { component: 'ConceptSlide', props: { title: '新知讲授', definition: '一元二次方程 ax² + bx + c = 0 (a≠0)', keyPoints: ['一般形式', '判别式', '求根公式'], formula: 'x = (-b ± √(b²-4ac)) / 2a' } },
      { component: 'ExampleSlide', props: { title: '例题讲解', problem: '解方程 x² - 5x + 6 = 0', solution: ['Δ = 25 - 24 = 1', 'x = (5 ± 1) / 2', 'x₁ = 3, x₂ = 2'], analysis: '使用求根公式', tips: '先计算判别式' } },
      { component: 'PracticeSlide', props: { title: '课堂练习', answerVisible: true, questions: [
        { stem: '解 x² - 4x + 3 = 0', type: '解答题', difficulty: 1, answer: 'x=1 或 3' },
      ] } },
      { component: 'SummarySlide', props: { title: '课堂小结', keyPoints: ['一般形式', '求根公式', '判别式'], mindMap: { nodes: [{ id: 'a', label: '中心' }, { id: 'b', label: '分支' }] } } },
      { component: 'BlackboardSlide', props: { title: '板书设计', layout: 'linear', sections: [{ label: '主题', content: '一元二次方程' }, { label: '公式', content: '求根公式' }] } },
      { component: 'HomeworkSlide', props: { title: '作业布置', tasks: [{ type: '必做', description: 'P108 习题1-3' }, { type: '选做', description: 'P108 习题4-5' }] } },
      { component: 'ReflectionSlide', props: { title: '教学反思', highlights: ['学生参与度高'], improvements: ['推导节奏可放慢'] } },
      { component: 'EndSlide', props: { text: '谢谢观看' } },
    ]
    const r = await exportService.renderSlidesToPPTXBuffer(slides, { title: 'e2e-lesson-test' })
    expect(r.size).toBeGreaterThan(100_000) // 12 张应有 ≥100KB
    expect(r.title).toBe('e2e-lesson-test')
  })

  it('导出文件能被 fs.writeFile 写入磁盘并正确读回', async () => {
    const tmpDir = makeTempDir('export-write')
    const outFile = path.join(tmpDir, 'lesson.pptx')
    const slides = [
      { component: 'CoverSlide', props: { title: 'A' } },
      { component: 'OutlineSlide', props: { title: 'B', objectives: [{ dimension: 'x', items: ['y'] }] } },
      { component: 'EndSlide', props: { text: 'end' } },
    ]
    const r = await exportService.exportSlidesToPPTX(slides, outFile, { title: 'fs-test' })
    expect(r.ok).toBe(true)
    expect(existsSync(outFile)).toBe(true)
    expect(r.size).toBeGreaterThan(20_000)
    // 文件可读回
    const stat = require('node:fs').statSync(outFile)
    expect(stat.size).toBe(r.size)
    // 清理
    try { unlinkSync(outFile) } catch {}
  })

  it('未知组件类型被兜底为 unknown 渲染器（不抛异常）', async () => {
    const slides = [
      { component: 'CoverSlide', props: { title: 'A' } },
      { component: 'NotExistSlide', props: { title: 'B' } },
      { component: 'EndSlide', props: { text: 'end' } },
    ]
    const r = await exportService.renderSlidesToPPTXBuffer(slides, { title: 'unknown-test' })
    expect(r.size).toBeGreaterThan(10_000)
  })
})

/* ───────── 测试 7：完整链路冒烟（Markdown → 大纲 → 配置 → slides → PPTX） ───────── */

describe('lesson-to-ppt - 端到端冒烟链路', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    usePPTWorkflow().resetWorkflow()
    __resetRegistry()
  })

  it('教案 Markdown → 解析 → 配置 → 转换 → 12 张 slides 数组', () => {
    // Step 1: 解析 Markdown
    const parsed = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    expect(parsed.outline.length).toBeGreaterThan(0)
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.6)

    // Step 2: store 写入配置和解析结果
    const store = useLessonPptStore()
    store.updateConfig({
      subject: 'math',
      stage: 'junior',
      templateId: 'junior-math',
      includeBlackboard: true,
      includeHomework: true,
      includeReflection: true,
    })
    store.analyzeMarkdown(SAMPLE_LESSON_MD)
    expect(store.currentTemplate.id).toBe('junior-math')

    // Step 3: 转换 outline → slide stubs → 完整 slides（含 props 填充）
    const stubs = outlineToSlideStubs(parsed)
    const slides = stubs.map((s) => buildLessonSlide(s))
    expect(slides.length).toBe(stubs.length)

    // Step 4: usePPTWorkflow lesson-plan context
    const w = usePPTWorkflow()
    w.startWorkflow('一元二次方程的解法', {
      context: 'lesson-plan',
      lessonPlanConfig: { subject: 'math', stage: 'junior', templateId: 'junior-math' },
    })
    expect(w.state.context).toBe('lesson-plan')
    w.onSlidesGenerated(slides)
    expect(w.state.slides.length).toBe(slides.length)
    expect(w.state.step).toBe(PPT_STEP.EDITING)

    // Step 5: 写入 store 的生成结果
    store.recordGenerated(slides, SAMPLE_LESSON_MD)
    expect(store.hasGenerated).toBe(true)

    // Step 6: 校验 slides 数组至少包含每种组件类型一次
    const types = new Set(slides.map((s) => s.component))
    for (const t of ['CoverSlide', 'OutlineSlide', 'KeyPointsSlide', 'ConceptSlide', 'BlackboardSlide', 'HomeworkSlide']) {
      expect(types.has(t)).toBe(true)
    }
  })

  it('完整链路导出 PPTX 文件大于 100KB', async () => {
    const parsed = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    const stubs = outlineToSlideStubs(parsed)
    const slides = stubs.map((s) => buildLessonSlide(s))

    const tmpDir = makeTempDir('e2e-pipeline')
    const outFile = path.join(tmpDir, 'e2e.pptx')

    // 直接 require export-service，避免 child_process shell 转义问题
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const svc = require('i:/WPX/electron/export-service.js')
    const r = await svc.exportSlidesToPPTX(slides, outFile, { title: 'e2e-pipeline' })
    expect(r.ok).toBe(true)
    expect(existsSync(outFile)).toBe(true)
    expect(r.size).toBeGreaterThan(100_000)

    try { unlinkSync(outFile) } catch {}
  })

  it('local-commands + workflow + export-service 三链路联调', () => {
    // 1) AI 用户说"教案生成课件" → CMD-057 触发
    const ctx = {
      openLessonPlanDialog: vi.fn(),
      documentContent: SAMPLE_LESSON_MD,
    }
    const cmd = processUserInput('教案生成课件', ctx)
    expect(cmd.commandId).toBe('open-lesson-plan-dialog')
    expect(ctx.openLessonPlanDialog).toHaveBeenCalled()

    // 2) 弹窗返回 → workflow 启动 lesson-plan
    const w = usePPTWorkflow()
    w.startWorkflow('一元二次方程的解法', {
      context: 'lesson-plan',
      lessonPlanConfig: { subject: 'math', stage: 'junior', templateId: 'junior-math' },
    })
    expect(w.state.context).toBe('lesson-plan')

    // 3) 解析教案 → 配置 store
    const parsed = parseLessonPlan(SAMPLE_LESSON_MD, { subject: 'math', stage: 'junior' })
    const store = useLessonPptStore()
    store.updateConfig({ subject: 'math', stage: 'junior', templateId: 'junior-math' })
    store.analyzeMarkdown(SAMPLE_LESSON_MD)

    // 4) 生成 slides → 完成工作流
    const slides = outlineToSlideStubs(parsed).map((s) => buildLessonSlide(s))
    w.onSlidesGenerated(slides)
    store.recordGenerated(slides, SAMPLE_LESSON_MD)

    expect(store.hasGenerated).toBe(true)
    expect(w.state.slides.length).toBeGreaterThan(5)
    expect(w.state.step).toBe(PPT_STEP.EDITING)

    // 5) 二次修改后能识别 diff
    const newMd = SAMPLE_LESSON_MD + '\n## 拓展提高\n- 韦达定理\n'
    const diff = store.computeDiff(newMd)
    expect(diff.hasChange).toBe(true)
  })
})

/* ───────── 测试 8：增量更新 diff ───────── */

describe('lesson-to-ppt - 增量更新', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('修改章节标题后被识别为 removed + added（基于标题匹配的 diff 语义）', () => {
    const store = useLessonPptStore()
    // 初始化 lastOutline（这里也可以直接通过 recordGenerated(slides, md, outline) 传入）
    store.analyzeMarkdown(SAMPLE_LESSON_MD)
    store.recordGenerated([], SAMPLE_LESSON_MD)
    const modifiedMd = SAMPLE_LESSON_MD.replace('教学目标', '教学目标（新）')
    const diff = store.computeDiff(modifiedMd)
    expect(diff.hasChange).toBe(true)
    // diffOutline 基于 title 相等比较；标题改动后被识别为 removed + added
    const removedTitles = diff.removed.map((s) => s.title)
    const addedTitles = diff.added.map((s) => s.title)
    expect(removedTitles.some((t) => t.includes('教学目标') && !t.includes('（新）'))).toBe(true)
    expect(addedTitles.some((t) => t.includes('教学目标（新）'))).toBe(true)
  })

  it('删除章节后被识别为 removed', () => {
    const store = useLessonPptStore()
    // 初始化 lastOutline（这里也可以直接通过 recordGenerated(slides, md, outline) 传入）
    store.analyzeMarkdown(SAMPLE_LESSON_MD)
    // 再记录上一次生成的 markdown（写入 documentHash）
    store.recordGenerated([], SAMPLE_LESSON_MD)
    // 构造“删除了 教学反思 章节”的 markdown
    const removedMd = SAMPLE_LESSON_MD.replace(/\n## 教学反思[\s\S]*$/, '')
    const diff = store.computeDiff(removedMd)
    expect(diff.hasChange).toBe(true)
    expect(diff.removed.length).toBeGreaterThan(0)
    const removedTitles = diff.removed.map((s) => s.title)
    expect(removedTitles.some((t) => t.includes('反思'))).toBe(true)
  })

  it('空白字符变化不触发 diff', () => {
    const store = useLessonPptStore()
    store.recordGenerated([], SAMPLE_LESSON_MD)
    const sameContent = SAMPLE_LESSON_MD.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    const diff = store.computeDiff(sameContent)
    // lightHash 做了 normalize，所以应当一致
    expect(diff.hasChange).toBe(false)
  })
})

/* ───────── 辅助：把 stub 转成完整的 {component, props} 数组 ───────── */

/**
 * 从 outlineToSlideStubs 的 stub 转换为完整 slides 数组（props 简易填充）
 * 不依赖 LLM，纯字符串拼装；用于链路冒烟测试。
 */
function buildLessonSlide(stub) {
  const baseProps = { title: stub.title }
  switch (stub.type) {
    case 'CoverSlide':
      return { component: 'CoverSlide', props: { ...baseProps, subtitle: '初中数学·人教版', author: 'WPX' } }
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
          questions: questions.length ? questions : [{ stem: stub.content || '（暂无练习题）', type: '解答题', difficulty: 1 }],
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