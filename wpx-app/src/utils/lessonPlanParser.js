/**
 * 教案结构解析器（LessonPlanParser）
 *
 * 职责：
 *  1. 接收 Markdown 全文，识别章节标题（H1 / H2 / H3）
 *  2. 与内置教案模板关键词匹配，输出标准化大纲 JSON
 *  3. 给出每个章节的页面类型建议
 *  4. 给出解析置信度（0 ~ 1）
 *
 * 与大模型无关：纯正则 + 关键词匹配，**离线可用**。
 *
 * 用法：
 *   import { parseLessonPlan } from '@/utils/lessonPlanParser'
 *   const { outline, confidence, warnings } = parseLessonPlan(markdown, {
 *     subject: 'math', stage: 'junior'
 *   })
 */

/* ───────── 章节 → 页面类型映射规则 ───────── */

/**
 * 章节标题关键词 → 推荐的幻灯片组件名
 * 优先级：先匹配关键词，再匹配 H1 通用规则
 */
const KEYWORD_TYPE_RULES = [
  // ── 课题 / 标题 ──
  { keywords: ['课题', '课程名称', '题目'], type: 'CoverSlide', dimension: 'topic' },

  // ── 教学目标 ──
  { keywords: ['教学目标', '学习目标', '三维目标', '目标要求'], type: 'OutlineSlide', dimension: 'objectives' },

  // ── 教学重点 / 难点 ──
  { keywords: ['教学重点', '教学难点', '重点与难点', '重点和难点', '重难点'], type: 'KeyPointsSlide', dimension: 'keypoints' },

  // ── 教学过程 子章节 ──
  { keywords: ['导入', '复习导入', '情境导入', '问题导入', '新课引入', '引入'], type: 'LeadInSlide', dimension: 'leadIn' },
  { keywords: ['新知讲授', '新授课', '讲授新知', '知识讲解', '概念讲解', '新知'], type: 'ConceptSlide', dimension: 'concept' },
  { keywords: ['例题讲解', '例题', '典型例题', '例题分析'], type: 'ExampleSlide', dimension: 'example' },
  { keywords: ['课堂练习', '随堂练习', '练习', '巩固练习', '达标练习'], type: 'PracticeSlide', dimension: 'practice' },
  { keywords: ['课堂小结', '小结', '总结', '课堂总结', '归纳小结'], type: 'SummarySlide', dimension: 'summary' },

  // ── 板书 / 反思 / 作业 ──
  { keywords: ['板书设计', '板书'], type: 'BlackboardSlide', dimension: 'blackboard' },
  { keywords: ['作业', '作业布置', '课后作业', '布置作业', '家庭作业'], type: 'HomeworkSlide', dimension: 'homework' },
  { keywords: ['教学反思', '课后反思', '教后记', '反思'], type: 'ReflectionSlide', dimension: 'reflection' },
]

/** H1 默认类型（兜底） */
const H1_DEFAULT_TYPE = 'CoverSlide'
/** H2 默认类型（兜底） */
const H2_DEFAULT_TYPE = 'TextSlide'
/** H3 默认类型（兜底） */
const H3_DEFAULT_TYPE = 'TextSlide'

/* ───────── 主流教案模板识别 ───────── */

/**
 * 标准模板章节签名（按出现顺序匹配）
 * 命中任何一个则置信度 +0.3
 */
const STANDARD_TEMPLATES = [
  {
    name: 'WPX 官方',
    signatures: ['教学目标', '教学重难点', '教学过程'],
    weight: 0.5,
  },
  {
    name: '人教版',
    signatures: ['教学目标', '教学重点', '教学难点', '教学过程'],
    weight: 0.45,
  },
  {
    name: '北师大版',
    signatures: ['教学目标', '教学重点和难点', '教学过程', '板书设计'],
    weight: 0.45,
  },
]

/* ───────── 工具：行是否为标题 ───────── */

const HEADING_REGEX = /^(#{1,6})\s+(.+?)\s*#*\s*$/

/** 解析单行是否为 Markdown 标题 */
function parseHeadingLine(line) {
  const m = line.match(HEADING_REGEX)
  if (!m) return null
  return {
    level: m[1].length,
    title: m[2].trim(),
  }
}

/** 计算两个字符串的"是否包含"匹配（去除标点 / 空白） */
function matchKeyword(title, keywords) {
  const normalized = title.replace(/[\s，,。:：\/\\\(\)（）【】\[\]]/g, '')
  return keywords.some((kw) => normalized.includes(kw.replace(/[\s，,。:：\/\\\(\)（）【】\[\]]/g, '')))
}

/**
 * 给定章节标题，推断页面类型
 * @param {string} title
 * @returns {{ type: string, dimension: string|null }}
 */
function inferType(title) {
  for (const rule of KEYWORD_TYPE_RULES) {
    if (matchKeyword(title, rule.keywords)) {
      return { type: rule.type, dimension: rule.dimension }
    }
  }
  return { type: 'TextSlide', dimension: null }
}

/**
 * 提取章节的"正文内容"（标题之后、下一标题之前）
 */
function extractBody(lines, startIdx, endIdx) {
  const body = []
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i]
    if (HEADING_REGEX.test(line)) continue
    const trimmed = line.trim()
    if (trimmed) body.push(trimmed)
  }
  return body.join('\n').trim()
}

/**
 * 把 Markdown 列表行转换为数组（处理 - / * / 数字. 开头）
 */
function extractBulletList(body) {
  if (!body) return []
  const lines = body.split(/\r?\n/)
  const items = []
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/)
    if (m) items.push(m[1].trim())
    else if (line.trim() && items.length === 0) items.push(line.trim())
  }
  // 如果没有任何列表标记但有内容，把段落按行拆分
  if (items.length === 0 && body.trim()) {
    return body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 12)
  }
  return items.slice(0, 20)
}

/* ───────── 主入口：parseLessonPlan ───────── */

/**
 * @typedef {Object} ParsedLessonSection
 * @property {string} id          - 唯一 id
 * @property {number} level       - 章节级别（1/2/3）
 * @property {string} title       - 章节标题
 * @property {string} type        - 推荐页面组件名
 * @property {string|null} dimension - 业务维度标识
 * @property {string} content     - 章节正文 Markdown
 * @property {number[]} sourceLineRange - [startLine, endLine] 1-based
 */

/**
 * @typedef {Object} LessonPlanParseResult
 * @property {ParsedLessonSection[]} outline
 * @property {number} confidence - 0 ~ 1
 * @property {string[]} warnings
 * @property {string} [matchedTemplate] - 命中的教案模板名
 */

/**
 * @param {string} markdown
 * @param {Object} [context]
 * @param {string} [context.subject]
 * @param {'primary'|'junior'|'senior'|'custom'} [context.stage]
 * @param {string} [context.textbookVersion]
 * @returns {LessonPlanParseResult}
 */
export function parseLessonPlan(markdown, context = {}) {
  const warnings = []
  if (!markdown || typeof markdown !== 'string') {
    return { outline: [], confidence: 0, warnings: ['教案内容为空'] }
  }

  const lines = markdown.split(/\r?\n/)

  // 1) 提取所有标题行
  const headings = [] // { level, title, lineIdx (0-based) }
  for (let i = 0; i < lines.length; i++) {
    const h = parseHeadingLine(lines[i])
    if (h) headings.push({ ...h, lineIdx: i })
  }

  if (headings.length === 0) {
    warnings.push('未识别到任何标题，请检查教案是否使用了 H1/H2/H3 格式')
    return {
      outline: [],
      confidence: 0,
      warnings,
    }
  }

  // 2) 计算每个标题的范围
  let confidence = 0
  let matchedTemplate = null
  const allTitles = headings.map((h) => h.title)

  // 标准模板识别
  for (const tpl of STANDARD_TEMPLATES) {
    const hitCount = tpl.signatures.filter((sig) =>
      allTitles.some((t) => t.includes(sig)),
    ).length
    if (hitCount === tpl.signatures.length) {
      confidence += tpl.weight
      matchedTemplate = tpl.name
      break // 只取第一个完全命中的模板
    }
  }

  // 3) 构建大纲
  const outline = []
  let nextId = 1

  // 检查是否存在课题（H1）
  const topicH1 = headings.find((h) => h.level === 1)
  if (topicH1) {
    confidence += 0.2
  } else {
    warnings.push('未识别到一级标题（# 课题），建议为教案添加课题作为 H1')
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const startLine = h.lineIdx + 1 // 0-based → 1-based
    const endLine = i + 1 < headings.length ? headings[i + 1].lineIdx : lines.length
    const body = extractBody(lines, h.lineIdx + 1, endLine)

    // 决定页面类型
    let type
    let dimension = null
    if (h.level === 1 && i === 0 && topicH1) {
      // 第一个 H1 → 课题封面
      type = 'CoverSlide'
      dimension = 'topic'
    } else {
      const inferred = inferType(h.title)
      type = inferred.type
      dimension = inferred.dimension
      if (type !== 'TextSlide') confidence += 0.05
    }

    // H 级别兜底
    if (type === 'TextSlide' && h.level === 1) type = H1_DEFAULT_TYPE
    if (type === 'TextSlide' && h.level === 2) type = H2_DEFAULT_TYPE
    if (type === 'TextSlide' && h.level === 3) type = H3_DEFAULT_TYPE

    const section = {
      id: `sec-${nextId++}`,
      level: h.level,
      title: h.title,
      type,
      dimension,
      content: body,
      sourceLineRange: [startLine, endLine],
    }
    outline.push(section)
  }

  // 4) 置信度封顶 / 兜底
  confidence = Math.min(1, Math.max(0, confidence))

  if (confidence < 0.6) {
    warnings.push('解析置信度较低（<60%），建议在 Step 2 中手动调整页面类型')
  }

  return {
    outline,
    confidence: Number(confidence.toFixed(2)),
    warnings,
    matchedTemplate,
    context,
  }
}

/* ───────── 辅助：outline → slides 数组 ───────── */

/**
 * 把解析结果 outline 转换为 slides 数组（不含具体 props 填充，由调用方补充）。
 * @param {LessonPlanParseResult} parseResult
 * @returns {Array<{ type: string, title: string, content: string, dimension: string|null }>}
 */
export function outlineToSlideStubs(parseResult) {
  return parseResult.outline.map((s) => ({
    type: s.type,
    title: s.title,
    content: s.content,
    dimension: s.dimension,
    sectionId: s.id,
    sourceLineRange: s.sourceLineRange,
  }))
}

/* ───────── 辅助：outline diff（增量更新用） ───────── */

/**
 * 简易章节级 diff：识别新增 / 修改 / 删除章节。
 * 匹配规则：基于章节标题归一化后做相等比较。
 *
 * @param {ParsedLessonSection[]} prevOutline
 * @param {ParsedLessonSection[]} nextOutline
 * @returns {{
 *   added: ParsedLessonSection[],
 *   modified: { prev: ParsedLessonSection, next: ParsedLessonSection }[],
 *   removed: ParsedLessonSection[],
 *   unchanged: ParsedLessonSection[]
 * }}
 */
export function diffOutline(prevOutline = [], nextOutline = []) {
  const prevByTitle = new Map()
  for (const s of prevOutline) prevByTitle.set(s.title, s)
  const nextByTitle = new Map()
  for (const s of nextOutline) nextByTitle.set(s.title, s)

  const added = []
  const modified = []
  const removed = []
  const unchanged = []

  for (const next of nextOutline) {
    const prev = prevByTitle.get(next.title)
    if (!prev) {
      added.push(next)
    } else if (prev.content !== next.content || prev.type !== next.type) {
      modified.push({ prev, next })
    } else {
      unchanged.push(next)
    }
  }
  for (const prev of prevOutline) {
    if (!nextByTitle.has(prev.title)) removed.push(prev)
  }

  return { added, modified, removed, unchanged }
}

/* ───────── 辅助：提取题目列表（用于 PracticeSlide） ───────── */

/**
 * 把 Markdown 中的练习题段落解析为结构化题目数组。
 * 简易规则：以数字. 或 (数字) 开头的行视为新题目。
 *
 * @param {string} content
 * @returns {Array<{ stem: string, type: string, difficulty: number }>}
 */
export function extractPracticeQuestions(content) {
  if (!content) return []
  const lines = content.split(/\r?\n/)
  const questions = []
  let current = null

  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[\.\、]|\(\d+\))\s*(.+)/)
    if (m) {
      if (current) questions.push(current)
      current = {
        stem: m[1].trim(),
        type: /[？?]$/.test(m[1]) ? '问答题' : '解答题',
        difficulty: countDifficultyStars(line) || 1,
      }
    } else if (current && line.trim()) {
      current.stem += ' ' + line.trim()
    }
  }
  if (current) questions.push(current)

  // 限制数量避免单页过长
  return questions.slice(0, 8)
}

function countDifficultyStars(line) {
  const m = line.match(/[★☆]+/)
  if (!m) return 1
  return Math.min(3, m[0].length)
}

/* ───────── 辅助：作业条目提取 ───────── */

/**
 * 把"作业布置"段落解析为作业条目数组。
 *
 * @param {string} content
 * @returns {Array<{ type: string, description: string, source?: string }>}
 */
export function extractHomeworkTasks(content) {
  if (!content) return []
  const lines = content.split(/\r?\n/)
  const tasks = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // 跳过列表标记
    const cleaned = trimmed.replace(/^[-*+\d+\.]\s*/, '').trim()
    if (!cleaned) continue

    let type = '必做'
    if (cleaned.startsWith('选做')) type = '选做'
    else if (cleaned.startsWith('实践') || cleaned.startsWith('实践作业')) type = '实践'

    const sourceMatch = cleaned.match(/（(.+?)）|\((.+?)\)/)
    const source = sourceMatch ? (sourceMatch[1] || sourceMatch[2]) : undefined

    tasks.push({ type, description: cleaned, source })
    if (tasks.length >= 12) break
  }

  return tasks
}

/* ───────── 辅助：目标要点提取 ───────── */

/**
 * 把"教学目标"段落解析为三维目标。
 * 识别"知识与技能"/"过程与方法"/"情感态度价值观"等维度。
 *
 * @param {string} content
 * @returns {Array<{ dimension: string, items: string[] }>}
 */
export function extractObjectives(content) {
  if (!content) return []
  const dimensions = [
    { name: '知识与技能', keys: ['知识与技能', '知识技能', '知识与技能目标'] },
    { name: '过程与方法', keys: ['过程与方法', '过程方法', '方法与过程'] },
    { name: '情感态度价值观', keys: ['情感态度价值观', '情感态度', '情感、态度与价值观'] },
  ]
  const result = []
  const lines = content.split(/\r?\n/)

  let currentDim = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // 匹配维度名
    let matched = null
    for (const d of dimensions) {
      if (d.keys.some((k) => trimmed.startsWith(k) || trimmed.includes(k))) {
        matched = d.name
        break
      }
    }
    if (matched) {
      currentDim = { dimension: matched, items: [] }
      result.push(currentDim)
      // 维度名后面的内容（如 "(1) xxx"）
      const rest = trimmed.replace(/^.+?[：:]\s*/, '').trim()
      if (rest) currentDim.items.push(rest)
    } else if (currentDim) {
      const cleaned = trimmed.replace(/^[-*+\d+\.]\s*/, '').trim()
      if (cleaned) currentDim.items.push(cleaned)
    } else {
      // 未匹配维度 → 兜底为"知识与技能"
      if (result.length === 0) result.push({ dimension: '知识与技能', items: [] })
      const cleaned = trimmed.replace(/^[-*+\d+\.]\s*/, '').trim()
      if (cleaned) result[result.length - 1].items.push(cleaned)
    }
  }

  // 兜底：如果完全没识别到维度，至少返回一个空维度
  if (result.length === 0) result.push({ dimension: '教学目标', items: [] })

  return result
}

export default parseLessonPlan