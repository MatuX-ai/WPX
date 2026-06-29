/**
 * Skill 执行器
 *
 * 管理内置 Skills 和外部 SkillHub 的统一调度，
 * 提供 Prompt 组装、表单获取、意图匹配等能力。
 */
import { getSkillById, BUILT_IN_SKILLS } from '@/data/built-in-skills'

// ── 变量名提取 ──────────────────────────────────

/** 正则匹配 {变量名} 或 {变量名:默认值} */
const VAR_PATTERN = /\{(\w+)(?::([^}]*))?\}/g

/**
 * 从 promptTemplate 中提取所有变量名列表
 * @param {string} template
 * @returns {string[]}
 */
function extractVars (template) {
  const vars = []
  let match
  while ((match = VAR_PATTERN.exec(template)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1])
  }
  return vars
}

// ── 匹配评分 ────────────────────────────────────

/**
 * 计算一个字符串与关键词列表的匹配分数
 *
 * 评分规则：
 * - 关键词完整包含 +1
 * - 关键词被文本以独立词形式包含 +1
 * - 关键词位于文本开头 +0.5 额外加分（常见于「论文大纲」「考试计划」等意图清晰场景）
 * - 最终归一化到 0-1
 *
 * @param {string} text 用户原始文本
 * @param {string[]} keywords 关键词列表
 * @param {string} fullKeywordName 完整 Skill 名称（用于检测独立词命中）
 * @returns {number} 0-1 的匹配分
 */
function scoreMatch (text, keywords, fullKeywordName) {
  const lower = text.toLowerCase()
  let score = 0
  let matchCount = 0
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      matchCount++
      score += 1
    }
  }
  if (matchCount === 0) return 0
  // 独立词形式命中：关键词在文本中作为完整词出现（而非偶然包含），额外加分
  if (fullKeywordName && isStandaloneWord(text, fullKeywordName)) {
    score += 0.5
  }
  // 文本开头包含关键词：额外加分（说明用户将 skill 名称作为主语）
  if (fullKeywordName && text.trim().startsWith(fullKeywordName)) {
    score += 0.3
  }
  // 归一化：按关键词总数与总加权上限进行缩放
  // 上限 = 关键词数 + 0.5 + 0.3 = 1.8
  const maxScore = keywords.length + 0.8
  return Math.min(1, score / maxScore)
}

/**
 * 判断关键词在文本中是否作为独立词出现
 * 避免「作文批改」误中「复习复习大纲」这种偶然包含的情况
 * @param {string} text
 * @param {string} keyword
 * @returns {boolean}
 */
function isStandaloneWord (text, keyword) {
  if (!text || !keyword) return false
  // 1. 完全相等肯定命中
  if (text === keyword) return true
  // 2. 以关键词开头或结尾：检查前/后是否为句子分隔符或文本边界
  //    （句首/句末的关键词是明显的意图表达）
  if (text.startsWith(keyword)) {
    const after = text.charAt(keyword.length)
    if (!after || /[\s\u3000.,;:!?。，；：！？、]/.test(after)) return true
  }
  if (text.endsWith(keyword)) {
    const before = text.charAt(text.length - keyword.length - 1)
    if (!before || /[\s\u3000.,;:!?。，；；：！？、]/.test(before)) return true
  }
  // 3. 中间出现：前后是句子分隔符或边界
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(?:^|[\\s\u3000.,;:!?。，；；：！？、])${escaped}(?:$|[\\s\u3000.,;:!?。，；；：！？、])`)
  return regex.test(text)
}

// ── 显式触发前缀（按优先级排序）────────────────

const EXPLICIT_TRIGGERS = [
  { prefix: '帮我用', prefixLen: 3 },
  { prefix: '使用', prefixLen: 2 },
  { prefix: '用', prefixLen: 1 },
  { prefix: '@', prefixLen: 1 },
]

// ── 可选的 SkillHub 外部注册表 ──────────────────

/** @type {import('@/data/built-in-skills').TeacherSkillDefinition[]} */
let externalSkills = []

/**
 * 注册在线 SkillHub 的 Skills
 * @param {import('@/data/built-in-skills').TeacherSkillDefinition[]} skills
 */
export function registerExternalSkills (skills) {
  if (Array.isArray(skills)) {
    externalSkills = skills
  }
}

// ── 合并查找（内置 + 外部）─────────────────────

/**
 * 从内置 Skills 和外部注册表中查找 Skill
 * @param {string} skillId
 * @returns {import('@/data/built-in-skills').TeacherSkillDefinition | undefined}
 */
function findSkill (skillId) {
  return getSkillById(skillId) || externalSkills.find((s) => s.id === skillId)
}

/**
 * 获取所有可用 Skills（内置 + 外部）
 * @returns {import('@/data/built-in-skills').TeacherSkillDefinition[]}
 */
export function getAllSkills () {
  return [...BUILT_IN_SKILLS, ...externalSkills]
}

// ── 手动指定解析 ────────────────────────────────

/**
 * 解析用户手动指定的 Skill 命令
 *
 * 支持格式：
 * - "用XX，参数1, 参数2"
 * - "使用XX技能"
 * - "@XX 参数1 参数2"
 * - "帮我用XX"
 *
 * @param {string} text - 用户原始消息
 * @returns {{ matched: boolean, candidates: Array<{skillId:string, name:string, description:string}>, skillKeyword: string, paramText: string }}
 */
function parseSkillCommand (text) {
  const result = { matched: false, candidates: [], skillKeyword: '', paramText: '' }
  if (!text || typeof text !== 'string') return result

  const msg = text.trim()
  if (!msg) return result

  // 1. 检测显式触发前缀
  let matchedTrigger = null
  let rest = msg

  for (const trigger of EXPLICIT_TRIGGERS) {
    const idx = rest.indexOf(trigger.prefix)
    if (idx >= 0) {
      matchedTrigger = trigger
      rest = rest.substring(idx + trigger.prefixLen)
      break
    }
  }

  if (!matchedTrigger) return result

  // 2. 提取 Skill 名称关键词（遇到标点/空格停止）
  const keywordMatch = rest.match(/^(.+?)(?:[，,、。；;：:\s]|$)/)
  if (!keywordMatch) return result

  const skillKeyword = keywordMatch[1].trim()
  let paramText = rest.substring(skillKeyword.length).trim()

  // 去掉末尾的 "技能" 后缀
  const cleanKeyword = skillKeyword.replace(/技能$/, '')

  // 3. 查找匹配的 Skills
  const allSkills = getAllSkills()
  const seen = new Set()
  const candidates = []

  // 3a. 精确 ID 匹配
  for (const s of allSkills) {
    if (s.id === cleanKeyword) {
      candidates.push({ skillId: s.id, name: s.name, description: s.description })
      seen.add(s.id)
      break
    }
  }

  // 3b. 名称包含匹配
  if (candidates.length === 0) {
    for (const s of allSkills) {
      if (seen.has(s.id)) continue
      if (s.name.includes(cleanKeyword) || cleanKeyword.includes(s.name)) {
        candidates.push({ skillId: s.id, name: s.name, description: s.description })
        seen.add(s.id)
      }
    }
  }

  // 3c. 分词模糊匹配（当名称包含匹配无结果时）
  if (candidates.length === 0) {
    const keywordWords = cleanKeyword.split(/[,，。；;、\s]+/).filter(w => w.length >= 2)
    for (const s of allSkills) {
      if (seen.has(s.id)) continue
      const nameWords = s.name.split(/[,，。；;、\s]+/).filter(w => w.length >= 2)
      for (const kw of keywordWords) {
        if (nameWords.some(nw => nw.includes(kw) || kw.includes(nw))) {
          candidates.push({ skillId: s.id, name: s.name, description: s.description })
          seen.add(s.id)
          break
        }
      }
    }
  }

  return {
    matched: candidates.length > 0,
    candidates,
    skillKeyword: cleanKeyword,
    paramText,
  }
}

// ── 参数提取 ────────────────────────────────────

/**
 * 从纯文本中按 inputSchema 提取参数键值对
 *
 * 策略：
 * 1. 键值对提取："{label}是{value}"、"{label}：{value}"、"{label}:{value}"
 * 2. 按顺序填充：剩余文本按分隔符拆分，按字段顺序逐一填入
 *
 * @param {string} text - 参数字符串（去除 Skill 名称后的部分）
 * @param {Record<string, any> | null} inputSchema - Skill 的 inputSchema
 * @returns {Record<string, string>}
 */
function extractParamsFromText (text, inputSchema) {
  const params = {}
  if (!text || !inputSchema) return params

  const fields = Object.entries(inputSchema)
  let remaining = text

  // Step 1: 键值对提取
  for (const [key, field] of fields) {
    const label = field.label || key
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 匹配 "label是value"、"label：value"、"label:value"（到标点或结尾）
    const regex = new RegExp(`${escapedLabel}(?:是|：|:|\\s+)(.+?)(?:[，,。；;]|$)`)
    const match = remaining.match(regex)
    if (match) {
      params[key] = match[1].trim()
      remaining = remaining.replace(match[0], '').trim()
    }
  }

  // Step 2: 剩余文本按顺序填入未赋值的字段
  if (remaining) {
    const parts = remaining.split(/[，,、。.；;：:\s]+/).filter(p => p.trim())
    let idx = 0
    for (const [key] of fields) {
      if (params[key] === undefined && idx < parts.length) {
        params[key] = parts[idx].trim()
        idx++
      }
    }
  }

  return params
}

// ── 宽松执行 ────────────────────────────────────

/**
 * 宽松执行 Skill：缺失变量保留原占位符，不要求全部填满
 *
 * @param {string} skillId
 * @param {Record<string, any>} userInput
 * @returns {{ prompt: string }}
 */
function executeSkillLenient (skillId, userInput) {
  const skill = findSkill(skillId)
  if (!skill) {
    return { prompt: `[Skill "${skillId}" 不存在]` }
  }

  const template = skill.promptTemplate
  const input = userInput || {}

  const prompt = template.replace(VAR_PATTERN, (match, varName, defaultVal) => {
    const val = input[varName]
    if (val !== undefined && val !== null && val !== '') {
      return String(val)
    }
    if (defaultVal !== undefined) {
      return defaultVal
    }
    // 缺失变量 —— 保留原始占位符
    return match
  })

  return { prompt }
}

// ── 导出 composable ─────────────────────────────

/**
 * Skill 执行器 Composable
 *
 * @returns {{
 *   executeSkill: (skillId: string, userInput: Record<string, any>) => { prompt?: string, missingFields?: string[] },
 *   getSkillInputForm: (skillId: string) => Record<string, any> | null,
 *   matchSkillByIntent: (userMessage: string) => string | null,
 *   parseSkillCommand: (text: string) => { matched: boolean, candidates: Array<{skillId:string, name:string, description:string}>, skillKeyword: string, paramText: string },
 *   extractParamsFromText: (text: string, inputSchema: Record<string, any> | null) => Record<string, string>,
 *   executeSkillLenient: (skillId: string, userInput: Record<string, any>) => { prompt: string },
 *   registerExternalSkills: (skills: import('@/data/built-in-skills').TeacherSkillDefinition[]) => void,
 *   getAllSkills: () => import('@/data/built-in-skills').TeacherSkillDefinition[],
 *   findSkill: (skillId: string) => import('@/data/built-in-skills').TeacherSkillDefinition | undefined,
 * }}
 */
export function useSkillExecutor () {
  /**
   * 执行 Skill：组装完整 Prompt
   *
   * 将 promptTemplate 中的 {变量名} 替换为 userInput 中的值。
   * 支持 {变量名:默认值} 语法 —— 未传值时使用默认值。
   * 无默认值且未提供的变量会被收集到 missingFields 中返回。
   *
   * @param {string} skillId
   * @param {Record<string, any>} userInput - 用户输入的字段值
   * @returns {{ prompt?: string, missingFields?: string[] }}
   */
  function executeSkill (skillId, userInput) {
    const skill = findSkill(skillId)
    if (!skill) {
      return { missingFields: [`Skill "${skillId}" 不存在`] }
    }

    const template = skill.promptTemplate
    const input = userInput || {}
    const missingFields = []

    const prompt = template.replace(VAR_PATTERN, (match, varName, defaultVal) => {
      const val = input[varName]
      if (val !== undefined && val !== null && val !== '') {
        return String(val)
      }
      if (defaultVal !== undefined) {
        return defaultVal
      }
      // 变量缺失 —— 记录并保留占位符
      if (!missingFields.includes(varName)) {
        missingFields.push(varName)
      }
      return match
    })

    if (missingFields.length > 0) {
      return { missingFields }
    }

    return { prompt }
  }

  /**
   * 获取 Skill 的 inputSchema（用于动态生成前端表单）
   *
   * @param {string} skillId
   * @returns {Record<string, any> | null} inputSchema 对象，或 null（未找到）
   */
  function getSkillInputForm (skillId) {
    const skill = findSkill(skillId)
    return skill?.inputSchema ?? null
  }

  /**
   * 简易意图匹配 —— 根据用户消息匹配最合适的 Skill
   *
   * 匹配策略：
   * - 如果消息中明确包含 "用{skillName}" 或 "{skillName}" 且精确匹配某个 Skill 名称，直接返回
   * - 否则扫描 BUILT_IN_SKILLS 和外部 Skills，计算 name + description 的关键词匹配分数
   * - 超过阈值（0.3）返回最高分 Skill；否则返回 null
   *
   * @param {string} userMessage - 用户原始消息
   * @returns {string | null} 匹配到的 Skill ID，或 null
   */
  function matchSkillByIntent (userMessage) {
    if (!userMessage || typeof userMessage !== 'string') return null

    const msg = userMessage.trim()
    if (!msg) return null

    // 1. 精确名称匹配 —— 用户明确说出 Skill 名称
    const allSkills = getAllSkills()
    for (const skill of allSkills) {
      // 匹配 "用{name}"、"帮我{name}"、直接说名称等
      if (
        msg.includes(skill.name) ||
        msg.includes(`用${skill.name}`) ||
        msg.includes(`使用${skill.name}`)
      ) {
        return skill.id
      }
    }

    // 2. 关键词模糊匹配
    let bestScore = 0
    /** @type {string | null} */
    let bestId = null

    for (const skill of allSkills) {
      // 从 name 和 description 中提取有意义的词作为关键词
      const nameWords = skill.name.split(/[,，。；;、\s]+/).filter((w) => w.length >= 2)
      const descWords = skill.description.split(/[,，。；;、\s]+/).filter((w) => w.length >= 2)
      const keywords = [...nameWords, ...descWords]
      const score = scoreMatch(msg, keywords, skill.name)
      if (score > bestScore) {
        bestScore = score
        bestId = skill.id
      }
    }

    // 提高阈值到 0.45，避免偶然包含造成误匹配
    // （例如「复习大纲」误中「演示文稿大纲」的场景）
    const THRESHOLD = 0.45
    return bestScore >= THRESHOLD ? bestId : null
  }

  return {
    executeSkill,
    executeSkillLenient,
    getSkillInputForm,
    matchSkillByIntent,
    parseSkillCommand,
    extractParamsFromText,
    registerExternalSkills,
    getAllSkills,
    findSkill,
  }
}

export default useSkillExecutor
