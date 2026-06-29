/**
 * WPX 教师学科模板库
 *
 * 为不同学段 / 学科提供差异化的 PPT 课件主题（颜色 / 字体 / 板式）。
 * 模板字段说明参见 docs/WPX 教师教案生成课件 PPT 需求文档 §6.2。
 *
 * 使用方式：
 *   import { listTemplates, getTemplateBySubject, getTemplate } from '@/data/lesson-templates'
 *   const t = getTemplateBySubject('math', 'junior')
 *
 * 任何学科 / 学段组合都至少有一个 fallback 模板（白底蓝调默认主题）。
 */

/**
 * @typedef {Object} LessonThemeColors
 * @property {string} primary       - 主色（强调色 / 标题色）
 * @property {string} secondary     - 次色
 * @property {string} accent        - 重点标记色
 * @property {string} background    - 幻灯片背景
 * @property {string} textColor     - 正文字色
 * @property {string} fontFamily    - 正文字体
 * @property {string} fontHeading   - 标题字体
 * @property {string} [boardColor]  - 板书页专用底色（可选）
 */

/**
 * @typedef {Object} LessonTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} subject
 * @property {'primary'|'junior'|'senior'|'custom'} stage
 * @property {string} [preview]
 * @property {LessonThemeColors} theme
 * @property {Object} pageDefaults
 */

/** 默认模板：白底蓝调，兼容所有学科未指定时的兜底 */
export const DEFAULT_TEMPLATE = {
  id: 'default',
  name: '默认·白底蓝调',
  subject: 'any',
  stage: 'custom',
  preview: '',
  theme: {
    primary: '#1976d2',
    secondary: '#42a5f5',
    accent: '#ff6f00',
    background: '#ffffff',
    textColor: '#212121',
    fontFamily: 'Source Han Sans CN',
    fontHeading: 'Source Han Sans CN Bold',
  },
  pageDefaults: {
    cover: { layout: 'centered', showLogo: false },
    concept: { showFormula: false, highlightColor: '#ff6f00' },
    practice: { showDifficulty: true, showAnswerToggle: true },
  },
}

/** 全部内置学科模板 */
export const LESSON_TEMPLATES = [
  DEFAULT_TEMPLATE,
  // ── 小学 ──
  {
    id: 'primary-chinese',
    name: '小学语文·暖米水墨',
    subject: 'chinese',
    stage: 'primary',
    theme: {
      primary: '#8d5524',
      secondary: '#c19a6b',
      accent: '#c0392b',
      background: '#faf7f0',
      textColor: '#2d2418',
      fontFamily: 'Source Han Serif CN',
      fontHeading: 'Source Han Serif CN Heavy',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },
  {
    id: 'primary-math',
    name: '小学数学·白底蓝调',
    subject: 'math',
    stage: 'primary',
    theme: {
      primary: '#1976d2',
      secondary: '#42a5f5',
      accent: '#ff6f00',
      background: '#ffffff',
      textColor: '#212121',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'primary-english',
    name: '小学英语·浅蓝圆体',
    subject: 'english',
    stage: 'primary',
    theme: {
      primary: '#0288d1',
      secondary: '#4fc3f7',
      accent: '#ff7043',
      background: '#e3f2fd',
      textColor: '#0d47a1',
      fontFamily: 'Comic Sans MS',
      fontHeading: 'Comic Sans MS Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },

  // ── 初中 ──
  {
    id: 'junior-chinese',
    name: '初中语文·米色宋体',
    subject: 'chinese',
    stage: 'junior',
    theme: {
      primary: '#5d4037',
      secondary: '#a1887f',
      accent: '#c0392b',
      background: '#f5f0e1',
      textColor: '#1a1a1a',
      fontFamily: 'Source Han Serif CN',
      fontHeading: 'Source Han Serif CN Heavy',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },
  {
    id: 'junior-math',
    name: '初中数学·白底黑体',
    subject: 'math',
    stage: 'junior',
    theme: {
      primary: '#212121',
      secondary: '#616161',
      accent: '#1976d2',
      background: '#ffffff',
      textColor: '#1a1a1a',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'junior-english',
    name: '初中英语·白底等线',
    subject: 'english',
    stage: 'junior',
    theme: {
      primary: '#1565c0',
      secondary: '#5e92f3',
      accent: '#f57c00',
      background: '#ffffff',
      textColor: '#1a1a1a',
      fontFamily: 'PingFang SC',
      fontHeading: 'PingFang SC Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },
  {
    id: 'junior-physics',
    name: '初中物理·深蓝实验',
    subject: 'physics',
    stage: 'junior',
    theme: {
      primary: '#0d1b2a',
      secondary: '#1976d2',
      accent: '#ff6f00',
      background: '#fafafa',
      textColor: '#212121',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'junior-chemistry',
    name: '初中化学·深紫实验',
    subject: 'chemistry',
    stage: 'junior',
    theme: {
      primary: '#1a0d2e',
      secondary: '#6a1b9a',
      accent: '#ffeb3b',
      background: '#fafafa',
      textColor: '#212121',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'junior-moral',
    name: '初中道德与法治·暖红',
    subject: 'moral',
    stage: 'junior',
    theme: {
      primary: '#c0392b',
      secondary: '#e57373',
      accent: '#fbc02d',
      background: '#fff8f0',
      textColor: '#1a1a1a',
      fontFamily: 'Source Han Serif CN',
      fontHeading: 'Source Han Serif CN Heavy',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },

  // ── 高中 ──
  {
    id: 'senior-math',
    name: '高中数学·白底 Cambria',
    subject: 'math',
    stage: 'senior',
    theme: {
      primary: '#1a1a1a',
      secondary: '#616161',
      accent: '#1976d2',
      background: '#ffffff',
      textColor: '#1a1a1a',
      fontFamily: 'Cambria Math',
      fontHeading: 'Cambria',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'senior-physics',
    name: '高中物理·深蓝矢量',
    subject: 'physics',
    stage: 'senior',
    theme: {
      primary: '#0a1929',
      secondary: '#1976d2',
      accent: '#ff6f00',
      background: '#fafafa',
      textColor: '#212121',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'senior-chemistry',
    name: '高中化学·深紫有机',
    subject: 'chemistry',
    stage: 'senior',
    theme: {
      primary: '#1a0d2e',
      secondary: '#6a1b9a',
      accent: '#ffeb3b',
      background: '#fafafa',
      textColor: '#212121',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: true } },
  },
  {
    id: 'senior-biology',
    name: '高中生物·深绿细胞',
    subject: 'biology',
    stage: 'senior',
    theme: {
      primary: '#1b3a2b',
      secondary: '#43a047',
      accent: '#ff9800',
      background: '#f5fbf5',
      textColor: '#212121',
      fontFamily: 'Source Han Serif CN',
      fontHeading: 'Source Han Serif CN Heavy',
      boardColor: '#1b3a2b',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },
  {
    id: 'senior-it',
    name: '高中信息技术·黑底 Mono',
    subject: 'it',
    stage: 'senior',
    theme: {
      primary: '#000000',
      secondary: '#03dac6',
      accent: '#bb86fc',
      background: '#0a0a0a',
      textColor: '#e0e0e0',
      fontFamily: 'JetBrains Mono',
      fontHeading: 'JetBrains Mono Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },

  // ── 通用 ──
  {
    id: 'custom',
    name: '自定义',
    subject: 'any',
    stage: 'custom',
    theme: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      accent: '#f59e0b',
      background: '#ffffff',
      textColor: '#1a1a1a',
      fontFamily: 'Source Han Sans CN',
      fontHeading: 'Source Han Sans CN Bold',
    },
    pageDefaults: { cover: { layout: 'centered' }, concept: { showFormula: false } },
  },
]

/** 按 ID 索引 */
const _byId = Object.create(null)
for (const t of LESSON_TEMPLATES) {
  _byId[t.id] = t
}

/** 列出全部模板 */
export function listTemplates() {
  return LESSON_TEMPLATES.slice()
}

/**
 * 按 ID 取模板，未命中返回默认模板。
 * @param {string} id
 * @returns {LessonTemplate}
 */
export function getTemplate(id) {
  return _byId[id] || DEFAULT_TEMPLATE
}

/**
 * 按学科 + 学段查找模板。
 * 命中优先级：精确学段 > 默认模板。
 * @param {string} subject   'math' | 'chinese' | 'english' | 'physics' | ...
 * @param {'primary'|'junior'|'senior'|'custom'} stage
 * @returns {LessonTemplate}
 */
export function getTemplateBySubject(subject, stage) {
  if (!subject) return DEFAULT_TEMPLATE
  const hit = LESSON_TEMPLATES.find(
    (t) => t.subject === subject && (t.stage === stage || stage === 'custom'),
  )
  return hit || DEFAULT_TEMPLATE
}

/** 学科中文标签 */
export const SUBJECT_LABELS = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  moral: '道德与法治',
  history: '历史',
  geography: '地理',
  it: '信息技术',
  any: '通用',
}

/** 学段中文标签 */
export const STAGE_LABELS = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  custom: '自定义',
}

/** 教材版本列表（兼容主流） */
export const TEXTBOOK_VERSIONS = [
  '人教版',
  '北师大版',
  '苏教版',
  '沪教版',
  '粤教版',
  '鲁教版',
  '外研版',
  '其他',
]

export default LESSON_TEMPLATES