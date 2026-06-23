/**
 * WPX 内置 Skills 元数据
 *
 * @typedef {'writing' | 'editing' | 'knowledge'} SkillCategory
 *
 * @typedef {Object} SkillDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {SkillCategory} category
 * @property {string} icon Lucide 风格图标名（供 UI 映射）
 * @property {boolean} enabled
 */

/** @type {Record<SkillCategory, string>} */
export const SKILL_CATEGORY_LABELS = {
  writing: '写作',
  editing: '编辑',
  knowledge: '知识',
}

/** @type {SkillDefinition[]} */
export const BUILT_IN_SKILLS = [
  // ── 写作类 ──
  {
    id: 'continue-writing',
    name: '续写',
    description: '根据上文智能续写内容',
    category: 'writing',
    icon: 'pen-line',
    enabled: true,
  },
  {
    id: 'rewrite',
    name: '改写',
    description: '选中文本后改写，支持改变语气、风格',
    category: 'writing',
    icon: 'refresh-cw',
    enabled: true,
  },
  {
    id: 'expand',
    name: '扩写',
    description: '将简短内容扩展为详细段落',
    category: 'writing',
    icon: 'maximize-2',
    enabled: true,
  },
  {
    id: 'abbreviate',
    name: '缩写',
    description: '将长文精简为核心要点',
    category: 'writing',
    icon: 'minimize-2',
    enabled: true,
  },
  {
    id: 'translate',
    name: '翻译',
    description: '中英互译，保留原文格式',
    category: 'writing',
    icon: 'languages',
    enabled: true,
  },
  {
    id: 'summarize',
    name: '总结',
    description: '为全文或选中段落生成摘要',
    category: 'writing',
    icon: 'file-text',
    enabled: true,
  },
  {
    id: 'outline',
    name: '大纲生成',
    description: '根据主题生成结构化大纲',
    category: 'writing',
    icon: 'list-tree',
    enabled: true,
  },
  {
    id: 'title-generate',
    name: '标题生成',
    description: '为文章生成多个备选标题',
    category: 'writing',
    icon: 'heading',
    enabled: true,
  },
  // ── 编辑类 ──
  {
    id: 'format-beautify',
    name: '排版美化',
    description: '自动调整段落间距、缩进、标题层级',
    category: 'editing',
    icon: 'sparkles',
    enabled: true,
  },
  {
    id: 'format-convert',
    name: '格式转换',
    description: '列表与段落互转、表格与文本互转',
    category: 'editing',
    icon: 'repeat',
    enabled: true,
  },
  {
    id: 'image-process',
    name: '图片处理',
    description: '调用图片处理能力（去背景、裁剪、调色等）',
    category: 'editing',
    icon: 'image',
    enabled: true,
  },
  {
    id: 'table-ops',
    name: '表格操作',
    description: '智能生成表格、调整表格结构',
    category: 'editing',
    icon: 'table',
    enabled: true,
  },
  // ── 知识类 ──
  {
    id: 'qa',
    name: '问答',
    description: '基于资料库或通用知识回答问题',
    category: 'knowledge',
    icon: 'message-circle-question',
    enabled: true,
  },
  {
    id: 'code-explain',
    name: '代码解释',
    description: '解释选中的代码片段',
    category: 'knowledge',
    icon: 'code',
    enabled: true,
  },
  {
    id: 'data-insight',
    name: '数据洞察',
    description: '对选中的表格数据进行分析和总结',
    category: 'knowledge',
    icon: 'chart-bar',
    enabled: true,
  },
]

export default BUILT_IN_SKILLS
