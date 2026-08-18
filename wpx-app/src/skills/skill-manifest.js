/**
 * SKILL.md 兼容层 —— 双向转换器（Phase 1 / M1）
 *
 * 将 WPX 的 TeacherSkillDefinition 与 Hermes Agent 风格的 SKILL.md
 * （YAML frontmatter + Markdown 正文）互相转换，供 SkillHub 订阅、导出与导入。
 *
 * 设计原则：
 * - 纯函数模块：不依赖 DOM / fetch / Electron 主进程，可在 Vitest 中直接测试。
 * - 零运行时依赖：YAML frontmatter 使用手写子集解析器（标量 / 引号 / 数组 / JSON）。
 * - 无损往返：WPX 独有字段（category / subcategory / icon / inputSchema）写入
 *   额外 frontmatter 键，Hermes 读取时会忽略未知键，互不干扰。
 * - 来源标注：导入的技能标记 source: 'skillhub' 与 license，满足 Apache-2.0 合规。
 */
import { BUILT_IN_SKILLS } from '@/data/built-in-skills'

// ── 常量 ──────────────────────────────────────

/** 匹配 {变量名} 与 {变量名:默认值} */
const VAR_PATTERN = /\{(\w+)(?::([^}]*))?\}/g

/** 导入技能默认分类（当 SKILL.md 未声明 category 时） */
export const DEFAULT_SKILL_CATEGORY = 'general'

/** 导入技能默认图标（Lucide 名） */
export const DEFAULT_SKILL_ICON = 'sparkles'

// ── 变量提取 ──────────────────────────────────

/**
 * 从 prompt 模板中提取变量名列表（含默认值）
 * @param {string} template
 * @returns {Array<{ name: string, default?: string }>}
 */
export function extractPromptVars (template) {
  const vars = []
  const seen = new Set()
  let match
  const text = String(template || '')
  while ((match = VAR_PATTERN.exec(text)) !== null) {
    if (seen.has(match[1])) continue
    seen.add(match[1])
    vars.push({
      name: match[1],
      default: match[2] !== undefined ? match[2] : undefined,
    })
  }
  return vars
}

// ── YAML frontmatter 子集解析 / 序列化 ─────────

/**
 * 解析 YAML 子集（仅支持本模块需要的字段形态）
 * - 键: 值（标量 / 引号字符串 / 数字 / 布尔）
 * - 数组：[a, b, c]
 * - JSON 对象：{...}（用于 input-schema 等嵌套结构）
 * - 注释：以 # 开头的行；行尾 # 注释
 * @param {string} text frontmatter 原始文本（不含 --- 分隔符）
 * @returns {Record<string, any>}
 */
export function parseYamlSubset (text) {
  const data = {}
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()

    // 1. 引号字符串（不剥离内部 #）
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      data[key] = value.slice(1, -1)
      continue
    }

    // 2. JSON 对象（input-schema 等）
    if (value.startsWith('{')) {
      try {
        data[key] = JSON.parse(value)
      } catch {
        data[key] = value
      }
      continue
    }

    // 3. 数组
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      data[key] = inner
        ? inner
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
        : []
      continue
    }

    // 4. 行尾注释剥离（仅对普通标量）
    value = value.replace(/\s+#.*$/, '').trim()

    // 5. 布尔 / 数字 / 普通字符串
    if (value === 'true' || value === 'false') {
      data[key] = value === 'true'
      continue
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      data[key] = Number(value)
      continue
    }
    data[key] = value
  }
  return data
}

/**
 * 序列化 frontmatter 为 YAML 子集文本
 * 对象 / 数组一律输出为 JSON 单行（避免手写嵌套 YAML 的复杂度）。
 * @param {Record<string, any>} data
 * @returns {string}
 */
export function serializeFrontmatter (data) {
  const lines = []
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'string') {
      const needsQuote = /[:#\[\]{}]/.test(value) || value.startsWith('"') || value.startsWith("'")
      lines.push(`${key}: ${needsQuote ? JSON.stringify(value) : value}`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  return lines.join('\n')
}

/**
 * 解析带 frontmatter 的 SKILL.md 文本
 * @param {string} markdown
 * @returns {{ ok: boolean, data: Record<string, any>, body: string, errors: string[] }}
 */
export function parseFrontmatter (markdown) {
  if (typeof markdown !== 'string') {
    return { ok: false, data: {}, body: '', errors: ['输入不是字符串'] }
  }
  const text = markdown.replace(/^\uFEFF/, '')
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!match) {
    return {
      ok: false,
      data: {},
      body: text,
      errors: ['缺少 YAML frontmatter（需以 --- 包裹）'],
    }
  }

  const data = parseYamlSubset(match[1])
  const body = text.slice(match[0].length)
  const errors = []

  const name = data.name
  if (typeof name !== 'string' || !name.trim()) {
    errors.push('frontmatter 缺少 name（技能 ID）')
  }
  const description = data.description
  if (typeof description !== 'string' || !description.trim()) {
    errors.push('frontmatter 缺少 description')
  }
  if (!String(body).trim()) {
    errors.push('缺少技能正文（指令内容为空）')
  }

  return { ok: errors.length === 0, data, body, errors }
}

// ── 工具函数 ──────────────────────────────────

/**
 * 将技能名称规范化为 kebab-case ID
 * 保留中文字符（WPX 内置 ID 虽为 ASCII，但导入的 Hermes 技能可能含中文名）。
 * @param {string} name
 * @returns {string}
 */
export function normalizeSkillId (name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 从正文提取首个一级标题作为展示名 */
function headingName (body) {
  const match = String(body || '').match(/^#\s+(.+?)\s*$/m)
  return match ? match[1].trim() : ''
}

/** 去除正文开头的 `# 标题` 与首尾空行 */
export function cleanPromptBody (body) {
  const cleaned = String(body || '')
    .replace(/^#\s+.*$/m, '') // 首个一级标题
    .replace(/^\s+|\s+$/g, '')
  return cleaned
}

/** 从变量列表自动生成默认 inputSchema */
export function autoSchemaFromVars (vars) {
  const schema = {}
  for (const v of vars || []) {
    schema[v.name] = {
      label: v.name,
      type: 'text',
      placeholder: v.name,
      ...(v.default !== undefined ? { default: v.default } : {}),
    }
  }
  return schema
}

/** 解析 input-schema frontmatter 值（可能是 JSON 字符串或已解析对象） */
function resolveInputSchema (raw) {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      // 兼容双重转义（如经字符串分支序列化的 \" 形式）
      try {
        value = JSON.parse(value.replace(/\\"/g, '"'))
      } catch {
        return null
      }
    }
  }
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  ) {
    return value
  }
  return null
}

// ── 双向转换 ──────────────────────────────────

/**
 * TeacherSkillDefinition → SKILL.md 文本
 * @param {import('@/data/built-in-skills').TeacherSkillDefinition} skill
 * @returns {string}
 */
export function skillToSkillMd (skill) {
  const id = skill.id || normalizeSkillId(skill.name)
  const fm = {
    name: id,
    description: String(skill.description || '').trim(),
  }
  if (skill.category) fm.category = skill.category
  if (skill.subcategory) fm.subcategory = skill.subcategory
  if (skill.icon) fm.icon = skill.icon
  if (skill.license) fm.license = skill.license
  if (
    skill.inputSchema &&
    typeof skill.inputSchema === 'object' &&
    Object.keys(skill.inputSchema).length > 0
  ) {
    // 保持对象形态交给 serializeFrontmatter（对象分支输出为 JSON 单行），
    // 避免先字符串化再被字符串分支二次转义导致无法解析。
    fm['input-schema'] = skill.inputSchema
  }

  const displayName = String(skill.name || id)
  const body = String(skill.promptTemplate || '').trim()
  return `---\n${serializeFrontmatter(fm)}\n---\n\n# ${displayName}\n\n${body}\n`
}

/**
 * SKILL.md 文本 → TeacherSkillDefinition
 * @param {string} skillMd
 * @returns {{ ok: boolean, skill?: import('@/data/built-in-skills').TeacherSkillDefinition, errors?: string[] }}
 */
export function skillMdToSkill (skillMd) {
  const { ok, data, body, errors } = parseFrontmatter(skillMd)
  if (!ok) {
    return { ok: false, errors }
  }

  const promptTemplate = cleanPromptBody(body)
  const vars = extractPromptVars(promptTemplate)

  let inputSchema = resolveInputSchema(data['input-schema'])
  if (!inputSchema) {
    inputSchema = autoSchemaFromVars(vars)
  }

  const id = normalizeSkillId(data.name)
  const skill = {
    id,
    name: headingName(body) || String(data.name || id),
    description: String(data.description || '').trim(),
    icon: typeof data.icon === 'string' && data.icon ? data.icon : DEFAULT_SKILL_ICON,
    category: typeof data.category === 'string' && data.category ? data.category : DEFAULT_SKILL_CATEGORY,
    subcategory: typeof data.subcategory === 'string' ? data.subcategory : '',
    requiresAuth: false,
    builtIn: false,
    source: 'skillhub',
    license: typeof data.license === 'string' && data.license ? data.license : null,
    promptTemplate,
    inputSchema,
  }
  return { ok: true, skill }
}

// ── 批量导出 / 目录解析 ────────────────────────

/**
 * 将 WPX 全部内置 Skills（教师 + 大学生）导出为 SKILL.md 文件清单
 * @returns {Array<{ id: string, name: string, category: string, subcategory: string, content: string }>}
 */
export function exportAllSkillsToSkillMd () {
  return BUILT_IN_SKILLS.map((skill) => ({
    id: skill.id,
    name: skill.name,
    category: skill.category,
    subcategory: skill.subcategory || '',
    content: skillToSkillMd(skill),
  }))
}

/**
 * 解析技能库文件清单（含目录路径）为技能数组
 *
 * 目录约定（兼容 Hermes skills/ 布局）：
 * - skills/<category>/<subcategory>/<id>/SKILL.md
 * - skills/<category>/<id>/SKILL.md
 * - <任意>/SKILL.md（category 取 frontmatter 或 'general'）
 *
 * @param {Array<{ path: string, content: string }>} files
 * @returns {{ skills: import('@/data/built-in-skills').TeacherSkillDefinition[], errors: Array<{ path: string, errors: string[] }> }}
 */
export function skillMdDirectoryToSkills (files) {
  const skills = []
  const errors = []
  const seen = new Set()

  for (const file of files || []) {
    const path = String(file.path || '')
    const base = path.split('/').pop() || ''
    if (base !== 'SKILL.md') continue

    const segments = path.split('/').filter(Boolean)
    const skillsIdx = segments.indexOf('skills')
    const after = skillsIdx >= 0 ? segments.slice(skillsIdx + 1) : segments.slice(0, -1)

    let category = ''
    let subcategory = ''
    if (after.length >= 3) {
      category = after[0]
      subcategory = after[1]
    } else if (after.length === 2) {
      category = after[0]
    }

    const result = skillMdToSkill(file.content)
    if (!result.ok) {
      errors.push({ path, errors: result.errors })
      continue
    }

    const skill = result.skill
    if (seen.has(skill.id)) continue // 同 ID 取首个
    seen.add(skill.id)
    skills.push({
      ...skill,
      category: skill.category === DEFAULT_SKILL_CATEGORY && category ? category : skill.category,
      subcategory: skill.subcategory || subcategory,
    })
  }

  return { skills, errors }
}

export default {
  extractPromptVars,
  parseYamlSubset,
  serializeFrontmatter,
  parseFrontmatter,
  normalizeSkillId,
  cleanPromptBody,
  autoSchemaFromVars,
  skillToSkillMd,
  skillMdToSkill,
  exportAllSkillsToSkillMd,
  skillMdDirectoryToSkills,
}
