/**
 * WPX 大学生专用 Skills 元数据
 *
 * @typedef {Object} CollegeSkillDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon Lucide 风格图标名
 * @property {string} category
 * @property {string} subcategory
 * @property {boolean} requiresAuth
 * @property {boolean} builtIn
 * @property {string} promptTemplate
 * @property {Object} inputSchema
 */

/** @type {CollegeSkillDefinition[]} */
export const COLLEGE_SKILLS = [
  // ═══════════════════════════════════════════════
  //  学术写作类
  // ═══════════════════════════════════════════════
  {
    id: 'paper-outline',
    name: '论文大纲',
    description: '根据选题和学科方向，自动生成结构完整、逻辑清晰的学术论文大纲，快速搭建论文骨架',
    icon: 'list-tree',
    category: 'college',
    subcategory: 'academic-writing',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{field}领域的学术写作导师。请为以下论文选题生成一份详细大纲：

论文题目：{topic}
学科方向：{field}
论文类型：{paper_type}（课程论文 / 毕业论文 / 期刊论文 / 学位论文）
关键词：{keywords}
已收集的参考资料：{references}

请按以下结构生成大纲：
1. 题目建议（提供 1-2 个优化版本的题目）
2. 摘要指引（核心论点 + 研究方法 + 结论预览）
3. 一级目录与二级目录（标注每部分的功能定位）
4. 每节写作要点提示（需要回答的核心问题）
5. 建议参考文献类型与数量

要求：结构符合学术规范，章节之间有逻辑递进关系，标注哪些部分需要重点展开。`,
    inputSchema: {
      topic: { label: '论文选题', type: 'text', placeholder: '如：短视频对大学生注意力影响的实证研究' },
      field: { label: '学科方向', type: 'text', placeholder: '如：新闻传播、计算机科学' },
      paper_type: { label: '论文类型', type: 'text', placeholder: '课程论文 / 毕业论文 / 期刊论文' },
      keywords: { label: '关键词', type: 'text', placeholder: '3-5个关键词，用逗号分隔' },
      references: { label: '参考资料（可选）', type: 'textarea', placeholder: '已有的参考文献列表' }
    }
  },
  {
    id: 'literature-review',
    name: '文献综述',
    description: '根据研究主题和文献列表，自动生成文献综述框架与核心观点梳理',
    icon: 'book-marked',
    category: 'college',
    subcategory: 'academic-writing',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位学术研究导师。请根据以下信息生成文献综述：

研究主题：{topic}
学科领域：{field}
文献清单：{references}
综述侧重点：{focus}（发展脉络 / 主流观点 / 方法对比 / 争议焦点）
综述篇幅：{word_count} 字左右

请按以下结构输出：
1. 研究背景与意义（为什么这个话题值得综述）
2. 国内研究现状（按时间线或主题归类梳理）
3. 国外研究现状（同上）
4. 研究方法的演进（如有）
5. 现有研究的不足 / 争议点
6. 未来研究展望
7. 参考文献列表（按引用格式整理）

要求：客观归纳、不遗漏重要文献、突出不同观点的对话与交锋，标注各流派代表人物。`,
    inputSchema: {
      topic: { label: '研究主题', type: 'text', placeholder: '如：社交电商用户行为研究' },
      field: { label: '学科领域', type: 'text', placeholder: '如：电子商务、心理学' },
      references: { label: '文献清单', type: 'textarea', placeholder: '粘贴已收集的文献标题或摘要' },
      focus: { label: '综述侧重点', type: 'text', placeholder: '发展脉络 / 主流观点 / 争议焦点' },
      word_count: { label: '预期篇幅（字）', type: 'number', default: 3000 }
    }
  },
  {
    id: 'paraphrase-academic',
    name: '学术降重',
    description: '对选中段落进行学术化改写，降低重复率的同时保持原意和学术严谨性',
    icon: 'shrink',
    category: 'college',
    subcategory: 'academic-writing',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位学术写作编辑。请对以下段落进行学术化改写：

原文：
{original_text}
学科领域：{field}
改写目标：{goal}（降低重复率 / 提升学术性 / 优化表达逻辑）
改写强度：{intensity}（轻度润色 / 中度改写 / 深度重述）

要求：
1. 保留核心观点和关键术语
2. 调整句式结构，避免与原文雷同
3. 用更学术化的同义表达替换日常用语
4. 保持段落的逻辑连贯性
5. 输出改写版本后附简要的修改说明（改了哪些地方、为什么）

请输出改写后的段落及修改说明。`,
    inputSchema: {
      original_text: { label: '待改写段落', type: 'textarea', placeholder: '粘贴需要改写的原文' },
      field: { label: '学科领域', type: 'text', placeholder: '如：经济学、计算机科学' },
      goal: { label: '改写目标', type: 'text', placeholder: '降低重复率 / 提升学术性 / 优化表达' },
      intensity: { label: '改写强度', type: 'text', placeholder: '轻度润色 / 中度改写 / 深度重述' }
    }
  },
  {
    id: 'paper-formatter',
    name: '论文格式',
    description: '根据学校或期刊的格式要求，自动调整论文的标题层级、引用格式、页眉页脚等',
    icon: 'file-type',
    category: 'college',
    subcategory: 'academic-writing',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位学术排版专家。请根据以下信息检查和优化论文格式：

论文标题：{title}
格式标准：{format_standard}（如：GB/T 7714、APA 7th、MLA、学校论文模板）
需要处理的格式项：{format_items}（标题层级 / 参考文献格式 / 图表标注 / 页眉页脚 / 摘要格式）
已有内容片段（供格式参考）：{content_snippet}

请输出：
1. 格式规范清单（该标准的核心要求摘要）
2. 标题层级检查结果与修正建议
3. 参考文献格式示例（对照标准给出正确与错误的对比）
4. 图表 / 表格的标注规范
5. 常见格式错误预警
6. 分步调整操作指南

要求：针对具体标准给出可操作的修正建议，附正误对比示例。`,
    inputSchema: {
      title: { label: '论文标题', type: 'text', placeholder: '论文标题' },
      format_standard: { label: '格式标准', type: 'text', placeholder: 'GB/T 7714 / APA 7th / 学校模板' },
      format_items: { label: '需处理的格式项', type: 'text', placeholder: '如：参考文献、标题层级、图表标注' },
      content_snippet: { label: '内容片段（供参考）', type: 'textarea', placeholder: '粘贴部分论文内容以便定位格式问题' }
    }
  },
  {
    id: 'proposal-generator',
    name: '开题报告',
    description: '根据研究方向自动生成开题报告草案，包含选题背景、研究问题、方法设计、进度安排等',
    icon: 'clipboard-list',
    category: 'college',
    subcategory: 'academic-writing',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{field}领域的学术导师。请根据以下信息生成开题报告草案：

论文题目：{topic}
学科专业：{major}
研究背景与动机：{background}
拟解决的核心问题：{research_question}
初步想法或假设：{hypothesis}

请按以下结构生成开题报告：
1. 选题背景与研究意义
   - 现实背景 / 理论背景
   - 理论意义与实践价值
2. 国内外研究现状（简要综述）
3. 研究目标与内容
   - 核心研究问题
   - 具体研究内容分解
4. 研究方法与技术路线
   - 研究方法（实验 / 问卷 / 访谈 / 数据分析等）
   - 技术路线图（文字描述）
5. 创新点与难点
   - 可能的创新之处
   - 预期困难与应对措施
6. 研究进度安排（按月分阶段）
7. 参考文献（10-15 篇核心文献）

要求：逻辑完整、方法可行、进度合理，可直接作为开题报告初稿使用。`,
    inputSchema: {
      topic: { label: '论文题目', type: 'text', placeholder: '如：基于深度学习的医学图像分割方法研究' },
      major: { label: '学科专业', type: 'text', placeholder: '如：计算机科学与技术' },
      background: { label: '研究背景与动机', type: 'textarea', placeholder: '为什么选择这个题目' },
      research_question: { label: '核心研究问题', type: 'text', placeholder: '拟解决的关键问题是什么' },
      hypothesis: { label: '初步想法（可选）', type: 'textarea', placeholder: '已有的思路或假设' }
    }
  },

  // ═══════════════════════════════════════════════
  //  学习辅助类
  // ═══════════════════════════════════════════════
  {
    id: 'note-organizer',
    name: '笔记整理',
    description: '将课堂笔记或零散学习记录整理为结构清晰、重点突出的复习笔记',
    icon: 'notebook-pen',
    category: 'college',
    subcategory: 'study-aid',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位学习辅导助手。请将以下课堂笔记/学习记录整理为结构化的复习笔记：

课程名称：{course_name}
原始笔记内容：
{raw_notes}
笔记类型：{note_type}（课堂板书 / 课后整理 / 录音转文字 / 零散记录）
侧重方向：{focus}（考试重点 / 概念理解 / 案例分析 / 公式推导）

请按以下结构输出整理后的笔记：
1. 课程与章节标题
2. 核心概念定义（用通俗语言解释）
3. 知识框架图（层级化结构，markdown 列表形式）
4. 重点公式 / 原理（如有）
5. 典型案例 / 应用场景
6. 易混淆点辨析
7. 记忆口诀或速记技巧
8. 课后思考题（自测用）

要求：保留原始笔记中的所有关键信息，补充逻辑连接词，删除无关重复内容。`,
    inputSchema: {
      course_name: { label: '课程名称', type: 'text', placeholder: '如：数据结构与算法' },
      raw_notes: { label: '原始笔记', type: 'textarea', placeholder: '粘贴课堂笔记或学习记录' },
      note_type: { label: '笔记类型', type: 'text', placeholder: '课堂板书 / 录音转文字 / 零散记录' },
      focus: { label: '侧重方向', type: 'text', placeholder: '考试重点 / 概念理解 / 案例分析' }
    }
  },
  {
    id: 'concept-explainer',
    name: '概念秒懂',
    description: '用通俗易懂的语言、类比和案例解释复杂概念，适合预习和复习时快速理解',
    icon: 'lightbulb',
    category: 'college',
    subcategory: 'study-aid',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位擅长用简单语言讲透复杂概念的老师。请解释以下概念：

概念名称：{concept}
所属学科：{field}
学习者的基础：{background}（完全零基础 / 有基础概念 / 已学完基础知识）
希望理解的深度：{depth}（了解即可 / 理解原理 / 能做题应用 / 能论文引用）

请从以下角度解释：
1. 一句话概括（用最通俗的话说清楚它是什么）
2. 生活类比（用一个日常生活中的例子类比）
3. 核心原理（2-3 句话讲透原理）
4. 具体案例（一个实际应用场景）
5. 常见误解（同学们最容易搞错的地方）
6. 与其他概念的关联（它和哪些概念是亲戚关系）
7. 自测题（2 道，检验是否真的理解了）

要求：避免堆砌术语，类比要贴切，案例要贴近大学生活场景。`,
    inputSchema: {
      concept: { label: '概念名称', type: 'text', placeholder: '如：贝叶斯定理、机会成本' },
      field: { label: '所属学科', type: 'text', placeholder: '如：概率论、经济学' },
      background: { label: '基础水平', type: 'text', placeholder: '完全零基础 / 有基础概念 / 已学完基础' },
      depth: { label: '理解深度', type: 'text', placeholder: '了解即可 / 理解原理 / 能做题应用' }
    }
  },
  {
    id: 'mistake-review',
    name: '错题复盘',
    description: '根据作业或考试中的错题，分析错误原因并生成针对性巩固练习',
    icon: 'rotate-cw',
    category: 'college',
    subcategory: 'study-aid',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位大学课程辅导老师。请对以下错题进行复盘分析：

课程名称：{course_name}
错题内容：
{wrong_questions}
参考教材 / 课件：{textbook}

请输出：
1. 错题逐题分析
   - 考查的知识点
   - 错误原因（概念不清 / 公式记错 / 审题失误 / 计算错误 / 思路不对）
   - 正确解法（分步讲解）
2. 薄弱知识点汇总（按优先级排列）
3. 同类易错题型归纳
4. 针对性练习建议（推荐练习的题型或题目来源）
5. 复习路线图（从最薄弱的知识点开始 → 到掌握）

要求：分析具体到每道题的错误步骤，不泛泛说"基础不牢"。`,
    inputSchema: {
      course_name: { label: '课程名称', type: 'text', placeholder: '如：高等数学' },
      wrong_questions: { label: '错题内容', type: 'textarea', placeholder: '粘贴做错的题目和你的答案' },
      textbook: { label: '参考教材（可选）', type: 'text', placeholder: '如：同济版高数、学校自编教材' }
    }
  },
  {
    id: 'exam-cram-plan',
    name: '考前速救',
    description: '根据考试范围和剩余时间，生成高效的考前突击复习计划，划定优先级',
    icon: 'timer',
    category: 'college',
    subcategory: 'study-aid',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位大学考前冲刺教练。请制定高效的考前突击计划：

课程名称：{course_name}
考试范围：{scope}
距离考试：{days_left} 天
每天可用复习时间：{daily_hours} 小时
当前掌握程度：{mastery}（完全没学 / 学过一遍但没复习 / 大概七成懂 / 只差查漏补缺）
考试题型：{exam_format}（选择 / 填空 / 简答 / 计算 / 论述）

请输出突击计划：
1. 形势判断（时间紧不紧、重点抓什么）
2. 优先级排序（必考且分值高 → 常考 → 了解即可）
3. 每日复习计划（按天排期，标注每天的任务和预计用时）
4. 高效策略
   - 哪些内容可以放弃
   - 哪些必须吃透
   - 刷题 vs 看书的时间分配建议
5. 考前一天的冲刺建议
6. 考场时间分配策略

要求：策略务实，针对不同掌握程度给出差异化方案，不画大饼。`,
    inputSchema: {
      course_name: { label: '课程名称', type: 'text', placeholder: '如：概率论与数理统计' },
      scope: { label: '考试范围', type: 'textarea', placeholder: '教材章节或老师划的范围' },
      days_left: { label: '剩余天数', type: 'number', default: 3 },
      daily_hours: { label: '每天可用时间（小时）', type: 'number', default: 6 },
      mastery: { label: '当前掌握程度', type: 'text', placeholder: '完全没学 / 学过一遍 / 七成懂' }
    }
  },

  // ═══════════════════════════════════════════════
  //  知识管理类
  // ═══════════════════════════════════════════════
  {
    id: 'knowledge-builder',
    name: '知识图谱',
    description: '将课程所有知识点构建为可视化的知识图谱，理清概念间的层级与关联',
    icon: 'network',
    category: 'college',
    subcategory: 'knowledge-mgmt',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位课程知识管理专家。请为以下课程构建知识图谱：

课程名称：{course_name}
教材 / 参考书：{textbook}
核心章节 / 主题：{chapters}
已有知识基础：{background}

请输出知识图谱（markdown 层级结构，适合后续绘制思维导图）：
1. 课程知识总览图（一级分类：按模块 / 按章节）
2. 每个一级模块下的细分知识点（层级化展开）
3. 知识点之间的关联关系
   - A → B（A 是 B 的前置知识）
   - A ↔ B（A 与 B 相互关联）
   - A ⊂ B（A 是 B 的子集）
4. 核心概念索引（每个核心概念 + 一句话定义）
5. 学习路径建议（建议的学习顺序，标注先修关系）
6. 薄弱环节标记建议（哪些知识点通常较难，需要多花时间）

要求：层级不超过 5 层，关系标注清晰，便于导出为思维导图工具格式。`,
    inputSchema: {
      course_name: { label: '课程名称', type: 'text', placeholder: '如：计算机组成原理' },
      textbook: { label: '教材名称', type: 'text', placeholder: '如：计算机组成原理（唐朔飞）' },
      chapters: { label: '核心章节', type: 'text', placeholder: '如：第2-5章，或者输入具体章节标题' },
      background: { label: '已有基础', type: 'text', placeholder: '如：已学完数字逻辑与电路' }
    }
  },
  {
    id: 'flashcard-generator',
    name: '记忆卡片',
    description: '根据学习内容自动生成问答式记忆卡片，支持导入 Anki 等间隔重复软件',
    icon: 'layers',
    category: 'college',
    subcategory: 'knowledge-mgmt',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位记忆专家。请根据以下学习内容生成问答式记忆卡片：

学习内容：
{content}
所属课程：{course_name}
卡片数量：{card_count} 张
卡片类型：{card_type}（概念定义 / 公式原理 / 名词解释 / 简答题 / 混合）
难度层次：{difficulty}（基础 / 中等 / 挑战）
输出格式：{output_format}（纯文本 / Anki CSV / Markdown）

请生成记忆卡片，每张卡片格式如下：
---
Q: （问题 / 正面）
A: （答案 / 背面）
标签：{课程名}-{章节}
难度：{基础/中等/挑战}
---

要求：
1. 问题精准，答案简洁
2. 优先覆盖核心概念和易考点
3. 适当设置"对比卡片"（如：A和B的区别）
4. 同一知识点可以拆成多张卡片从不同角度考查
5. 避免模糊不清的提问，确保每张卡片有确定答案`,
    inputSchema: {
      content: { label: '学习内容', type: 'textarea', placeholder: '要制作卡片的课本笔记或课件内容' },
      course_name: { label: '课程名称', type: 'text', placeholder: '如：病理学' },
      card_count: { label: '卡片数量', type: 'number', default: 20 },
      card_type: { label: '卡片类型', type: 'text', placeholder: '概念定义 / 名词解释 / 混合' },
      output_format: { label: '输出格式', type: 'text', placeholder: '纯文本 / Markdown（默认纯文本）' }
    }
  },
  {
    id: 'reading-notes',
    name: '读书笔记',
    description: '根据阅读材料（论文、教材、专著）自动生成结构化的读书笔记，提取核心论点与论据',
    icon: 'book-open-text',
    category: 'college',
    subcategory: 'knowledge-mgmt',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位学术阅读助手。请根据以下阅读材料生成结构化读书笔记：

阅读材料标题：{title}
材料类型：{material_type}（学术论文 / 教材章节 / 专著 / 报告）
原文内容（或摘要、片段）：
{content}
阅读目的：{purpose}（课程预习 / 论文引用 / 考试复习 / 拓展视野）
笔记深度：{depth}（速读摘要 / 精读笔记 / 批判性阅读）

请输出：
1. 基本信息（标题、作者/来源、出版年份、关键词）
2. 核心论点（作者的核心主张，1-3 句话概括）
3. 论据与证据链（作者用了哪些论据来支持论点）
4. 论证结构图（前提 → 推理 → 结论）
5. 金句摘录（2-3 句最有价值的原文引用）
6. 思考与评价
   - 你同意的观点及理由
   - 你质疑的地方及理由
   - 可以进一步追问的问题
7. 与其他阅读材料的关联
8. 可引用片段（标注页码或章节，方便论文引用）

要求：区分"作者的看法"和"你自己的想法"，避免混淆。`,
    inputSchema: {
      title: { label: '材料标题', type: 'text', placeholder: '如：社会契约论' },
      content: { label: '阅读内容', type: 'textarea', placeholder: '粘贴原文、摘要或笔记' },
      material_type: { label: '材料类型', type: 'text', placeholder: '学术论文 / 教材章节 / 专著' },
      purpose: { label: '阅读目的', type: 'text', placeholder: '课程预习 / 论文引用 / 考试复习' },
      depth: { label: '笔记深度', type: 'text', placeholder: '速读摘要 / 精读笔记 / 批判性阅读' }
    }
  },

  // ═══════════════════════════════════════════════
  //  展示汇报类
  // ═══════════════════════════════════════════════
  {
    id: 'presentation-outline',
    name: '演示文稿大纲',
    description: '根据汇报主题生成 PPT/Keynote 大纲，包含每页标题、要点和配图建议',
    icon: 'presentation',
    category: 'college',
    subcategory: 'presentation',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位演讲设计导师。请为以下课堂汇报生成演示文稿大纲：

汇报主题：{topic}
学科 / 课程：{course}
汇报时长：{duration} 分钟
目标受众：{audience}（同班同学 / 老师 / 跨专业听众）
内容要点：{key_points}

请生成共 {slide_count} 页的演示文稿大纲，每页包含：
- 幻灯片标题
- 核心要点（3-4 个要点，用关键词而非长句）
- 配图 / 图表 / 数据可视化建议
- 演讲备注（说给演讲者的话：该页怎么讲、过渡语、互动点）

整体结构建议：
1. 封面页 + 目录页
2. 背景引入（为什么重要）
3. 核心内容（2-4 页，按逻辑递进）
4. 案例 / 数据展示
5. 总结页（核心结论）
6. Q&A 准备页（预判 2-3 个可能的问题）
7. 参考文献页

要求：每页信息量适中，避免文字堆砌，标注哪些页适合配图或动画。`,
    inputSchema: {
      topic: { label: '汇报主题', type: 'text', placeholder: '如：ChatGPT对高等教育的影响' },
      course: { label: '课程名称', type: 'text', placeholder: '如：教育技术学' },
      duration: { label: '汇报时长（分钟）', type: 'number', default: 10 },
      audience: { label: '目标受众', type: 'text', placeholder: '同班同学 / 老师 / 跨专业听众' },
      key_points: { label: '内容要点', type: 'textarea', placeholder: '希望包含的要点，用逗号或换行分隔' }
    }
  },
  {
    id: 'speech-writer',
    name: '演讲稿撰写',
    description: '根据主题和场景撰写口语化、有感染力的演讲稿，适用于课堂展示、答辩或竞选',
    icon: 'mic',
    category: 'college',
    subcategory: 'presentation',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位演讲撰稿人。请根据以下信息撰写演讲稿：

演讲主题：{topic}
演讲场景：{scenario}（课堂展示 / 论文答辩 / 学生竞选 / 社团发言 / 比赛演讲）
演讲时长：{duration} 分钟
目标听众：{audience}
核心信息 / 想表达的主要观点：{message}
风格偏好：{style}（幽默风趣 / 严谨理性 / 激情澎湃 / 真诚感人）

请输出演讲稿全文：
1. 开场（吸引注意力 + 点明主题 + 建立连接）
2. 正文（2-3 个核心论点，每个论点配案例或数据）
3. 结尾（总结升华 + 呼吁行动或留下思考）
4. 演讲备注（语气 / 停顿 / 手势 / 眼神交流建议）

要求：
- 口语化，读出来顺口、听起来不费劲
- 控制语速在每分钟 200-240 字
- 适当使用排比、反问、设问等修辞
- 标注情绪节点和语气变化`,
    inputSchema: {
      topic: { label: '演讲主题', type: 'text', placeholder: '如：为什么选择计算机科学' },
      scenario: { label: '演讲场景', type: 'text', placeholder: '课堂展示 / 论文答辩 / 学生竞选' },
      duration: { label: '演讲时长（分钟）', type: 'number', default: 5 },
      audience: { label: '目标听众', type: 'text', placeholder: '如：专业课老师 + 30名同学' },
      message: { label: '核心信息', type: 'text', placeholder: '用一句话概括你最想传达的观点' }
    }
  },

  // ═══════════════════════════════════════════════
  //  学业规划类
  // ═══════════════════════════════════════════════
  {
    id: 'academic-planner',
    name: '学业规划',
    description: '根据专业、年级和职业目标，制定学期选课建议、技能学习路线和 GPA 管理策略',
    icon: 'compass',
    category: 'college',
    subcategory: 'career-planning',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位大学学业规划导师。请根据以下信息制定学业规划：

专业：{major}
年级：{grade}
职业目标：{career_goal}
当前 GPA / 成绩水平：{gpa}
本学期已选 / 可选课程：{courses}
额外想提升的能力：{skills}

请输出：
1. 学期选课策略
   - 核心专业课优先级排序
   - 通识课的搭配建议
   - 推荐的选修课（与职业目标对齐）
2. 四/三年宏观规划
   - 各学年的重点任务
   - 关键时间节点（保研/考研/实习/论文）
   - 寒暑假利用建议
3. 技能成长路线图
   - 硬技能（专业相关工具/技术）
   - 软技能（沟通/协作/表达）
   - 证书 / 竞赛建议
4. GPA 管理策略
   - 学分权重分析
   - 如何平衡难度与高分
5. 学期行动清单（按月排期）

要求：根据 {major} 和 {career_goal} 量身定制，避免通用套话。`,
    inputSchema: {
      major: { label: '专业', type: 'text', placeholder: '如：软件工程、金融学' },
      grade: { label: '年级', type: 'text', placeholder: '如：大一 / 大二 / 大三 / 大四' },
      career_goal: { label: '职业目标', type: 'text', placeholder: '如：后端开发、投行分析师' },
      gpa: { label: '当前 GPA', type: 'text', placeholder: '如：3.5/4.0 或 85/100' },
      courses: { label: '可选课程', type: 'text', placeholder: '本学期可选的课程列表' }
    }
  },
  {
    id: 'internship-application',
    name: '实习申请',
    description: '辅助撰写实习简历、求职信和面试准备，针对目标岗位定制申请材料',
    icon: 'briefcase',
    category: 'college',
    subcategory: 'career-planning',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位大学生职业发展顾问。请根据以下信息辅助实习申请：

目标岗位：{target_position}
目标行业 / 公司：{industry}
个人教育背景：{education}
已有经历（项目 / 社团 / 实习 / 竞赛）：{experience}
核心技能：{skills}
个人优势 / 想突出的特点：{strengths}

请输出：
1. 简历优化建议
   - 针对该岗位的简历结构调整建议
   - 经历描述的 STAR 法则改写（每个经历给出改写前后的对比）
   - 关键词优化（HR 筛选时可能用的关键词）
2. 求职信 / 自荐信（300 字左右）
   - 开头（你是谁 + 为什么申请）
   - 正文（你的能力如何匹配岗位需求）
   - 结尾（表达诚意 + 期待面试）
3. 面试准备
   - 技术 / 专业问题预测（3-5 个）
   - 行为面试题预测（3-5 个，附 STAR 回答框架）
   - 反问面试官的问题建议
4. 投递策略建议（哪些渠道、时间节点、备选岗位）

要求：内容具体针对 {target_position} 岗位，避免泛泛的简历模板套话。`,
    inputSchema: {
      target_position: { label: '目标岗位', type: 'text', placeholder: '如：前端开发实习生、市场部实习生' },
      industry: { label: '目标行业', type: 'text', placeholder: '如：互联网、金融、咨询' },
      education: { label: '教育背景', type: 'text', placeholder: '如：XX大学 计算机科学 大三' },
      experience: { label: '已有经历', type: 'textarea', placeholder: '项目、实习、竞赛、社团等经历' },
      skills: { label: '核心技能', type: 'text', placeholder: '如：Python, Vue, 数据分析' }
    }
  }
]

export default COLLEGE_SKILLS
