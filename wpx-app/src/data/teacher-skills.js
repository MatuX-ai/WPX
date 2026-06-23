/**
 * WPX 教师专用 Skills 元数据
 *
 * @typedef {Object} TeacherSkillDefinition
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

/** @type {TeacherSkillDefinition[]} */
export const TEACHER_SKILLS = [
  // ═══════════════════════════════════════════════
  //  教学准备类
  // ═══════════════════════════════════════════════
  {
    id: 'lesson-plan-generator',
    name: '教案生成器',
    description: '根据课题和教材版本，自动生成包含教学目标、重难点、教学过程、板书设计、课后作业的结构化教案',
    icon: 'book-open',
    category: 'education',
    subcategory: 'teaching-prep',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位经验丰富的{subject}教师。请根据以下信息生成一份详细的教案：

教材版本：{textbook_version}
课题：{topic}
课时：{duration}分钟
年级：{grade}

请按照以下结构生成教案：
1. 教学目标（知识与技能、过程与方法、情感态度与价值观）
2. 教学重点与难点
3. 教学准备（教具、多媒体资源）
4. 教学过程（导入-新授-巩固-小结，标注每个环节的时间分配）
5. 板书设计
6. 课后作业（基础题+拓展题）
7. 教学反思预留区

要求：语言简洁专业，环节时间分配合理，体现以学生为中心的教学理念。`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学、语文、英语' },
      textbook_version: { label: '教材版本', type: 'text', placeholder: '如：人教版、北师大版' },
      topic: { label: '课题', type: 'text', placeholder: '如：一元一次方程' },
      duration: { label: '课时（分钟）', type: 'number', default: 45 },
      grade: { label: '年级', type: 'text', placeholder: '如：七年级' }
    }
  },
  {
    id: 'courseware-outline',
    name: '课件大纲',
    description: '根据教案或课题，自动生成适配 PPT/Keynote 的课件大纲，包含每页标题、要点与配图建议',
    icon: 'presentation',
    category: 'education',
    subcategory: 'teaching-prep',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位擅长课件设计的{subject}教师。请根据以下内容生成课件大纲：

课题：{topic}
教材版本：{textbook_version}
年级：{grade}
教案要点：{lesson_highlights}

请生成共 {slide_count} 页的课件大纲，每页格式为：
- 第 X 页标题
- 核心要点（2-4 点）
- 配图 / 素材建议
- 交互环节建议（提问/小组讨论/小游戏）

要求：逻辑清晰、图文搭配合理、适当安排课堂互动环节。`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学、语文、英语' },
      topic: { label: '课题', type: 'text', placeholder: '如：一元一次方程' },
      textbook_version: { label: '教材版本', type: 'text', placeholder: '如：人教版' },
      grade: { label: '年级', type: 'text', placeholder: '如：七年级' },
      lesson_highlights: { label: '教案要点', type: 'textarea', placeholder: '粘贴已有教案或输入教学要点' },
      slide_count: { label: '课件页数', type: 'number', default: 15 }
    }
  },
  {
    id: 'knowledge-breakdown',
    name: '知识点拆解',
    description: '将复杂知识点拆解为层级化的知识图谱，帮助学生理解知识间的逻辑关系',
    icon: 'git-branch',
    category: 'education',
    subcategory: 'teaching-prep',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{subject}学科的资深教师。请对以下知识点进行拆解和梳理：

知识点：{knowledge_point}
年级：{grade}
教材版本：{textbook_version}

请输出：
1. 核心概念定义（用学生能理解的语言）
2. 前置知识（学习本知识点前需要掌握的内容）
3. 知识结构树（父级知识点 → 当前知识点 → 子级知识点）
4. 常见误解 / 易错点
5. 记忆口诀或类比案例
6. 配套练习题（由易到难 3 道）
7. 推荐的教学策略或活动

要求：层级清晰、由浅入深，重点标注易混淆点。`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学、物理' },
      knowledge_point: { label: '知识点', type: 'text', placeholder: '如：二次函数的图象与性质' },
      grade: { label: '年级', type: 'text', placeholder: '如：九年级' },
      textbook_version: { label: '教材版本', type: 'text', placeholder: '如：人教版' }
    }
  },
  {
    id: 'cross-subject-connection',
    name: '跨学科融合',
    description: '将本课知识点与其他学科建立联系，生成跨学科融合教学建议',
    icon: 'shuffle',
    category: 'education',
    subcategory: 'teaching-prep',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位跨学科课程设计专家。请围绕以下内容设计跨学科融合教学方案：

主学科：{primary_subject}
知识点：{knowledge_point}
年级：{grade}
融合学科：{target_subjects}

请按以下结构输出：
1. 跨学科连接点分析（各学科中哪些内容与本知识点相关）
2. 融合教学目标
3. 融合教学设计（列出各学科的切入角度与衔接方式）
4. 跨学科课堂活动建议（项目式学习/探究活动）
5. 评价方式建议
6. 参考资料与拓展资源

要求：自然融合，不牵强附会，体现学科间的有机联系。`,
    inputSchema: {
      primary_subject: { label: '主学科', type: 'text', placeholder: '如：语文' },
      knowledge_point: { label: '知识点', type: 'text', placeholder: '如：《滕王阁序》' },
      grade: { label: '年级', type: 'text', placeholder: '如：高一年级' },
      target_subjects: { label: '融合学科', type: 'text', placeholder: '如：历史、地理、美术' }
    }
  },

  // ═══════════════════════════════════════════════
  //  出题与测评类
  // ═══════════════════════════════════════════════
  {
    id: 'smart-quiz-generator',
    name: '智能组卷',
    description: '根据知识点、难度和题型要求，智能生成试卷，支持多种题型混合',
    icon: 'file-spreadsheet',
    category: 'education',
    subcategory: 'assessment',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{subject}学科命题专家。请根据以下要求命制一份试卷：

知识点范围：{topics}
年级：{grade}
教材版本：{textbook_version}
总分：{total_score} 分
难度系数：{difficulty}（1-5，1为最简单）

题型配置：
- 选择题：{choice_count} 道
- 填空题：{fill_count} 道
- 简答题：{short_count} 道
- 解答题/作文题：{essay_count} 道

要求：
1. 每道题附参考答案和评分标准
2. 题目按由易到难排列
3. 知识点覆盖全面，避免重复
4. 标注每题的预估用时和分值
5. 选择题选项设置合理，干扰项有迷惑性但不超纲`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学、英语' },
      topics: { label: '知识点范围', type: 'text', placeholder: '如：二次函数、概率初步' },
      grade: { label: '年级', type: 'text', placeholder: '如：九年级' },
      textbook_version: { label: '教材版本', type: 'text', placeholder: '如：人教版' },
      total_score: { label: '总分', type: 'number', default: 100 },
      difficulty: { label: '难度系数（1-5）', type: 'number', default: 3 },
      choice_count: { label: '选择题数量', type: 'number', default: 10 },
      fill_count: { label: '填空题数量', type: 'number', default: 5 },
      short_count: { label: '简答题数量', type: 'number', default: 3 },
      essay_count: { label: '解答题/作文题数量', type: 'number', default: 2 }
    }
  },
  {
    id: 'variant-question-generator',
    name: '变式题生成',
    description: '基于一道母题，自动衍生出多个变式题，训练学生的举一反三能力',
    icon: 'copy-plus',
    category: 'education',
    subcategory: 'assessment',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{subject}学科的命题专家。请基于以下母题生成变式题：

母题：{original_question}
学科：{subject}
年级：{grade}
变式数量：{variant_count} 道
难度变化方向：{difficulty_direction}

请输出：
1. 母题解析（考查知识点、解题思路）
2. 变式题清单（每题包含题干、参考答案、考查点说明）
   - 变式一（改变条件）
   - 变式二（改变问题角度）
   - 变式三（综合拓展）
   - ……
3. 命题意图分析（每道变式训练何种思维能力）

要求：变式要有层次感，从条件变换到问题翻转再到综合应用，逐步提升思维深度。`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学' },
      original_question: { label: '母题', type: 'textarea', placeholder: '粘贴母题题干' },
      grade: { label: '年级', type: 'text', placeholder: '如：八年级' },
      variant_count: { label: '变式数量', type: 'number', default: 4 },
      difficulty_direction: { label: '难度变化方向', type: 'text', placeholder: '如：由易到难、侧重逆向思维' }
    }
  },
  {
    id: 'exam-analyzer',
    name: '试卷分析',
    description: '上传试卷数据或答题统计，自动分析难度分布、知识点覆盖、区分度等指标',
    icon: 'bar-chart-3',
    category: 'education',
    subcategory: 'assessment',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位教育测量学专家。请根据以下试卷数据进行分析：

学科：{subject}
年级：{grade}
考试类型：{exam_type}
总分：{total_score}
参考人数：{student_count}
平均分：{average_score}
最高分：{max_score}
最低分：{min_score}
各分数段分布：{score_distribution}
各题得分率数据：{item_score_rates}

请输出：
1. 整体质量评估（信度、效度分析）
2. 难度分布分析（各题难度系数及整体难度评价）
3. 知识点覆盖情况（哪些知识点考查充分，哪些遗漏）
4. 区分度分析（哪些题区分度好/差）
5. 典型错误归类（根据得分率推断共性错误）
6. 教学改进建议（针对试卷反映的问题）
7. 个别学生关注建议（标注异常数据）`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学' },
      grade: { label: '年级', type: 'text', placeholder: '如：八年级' },
      exam_type: { label: '考试类型', type: 'text', placeholder: '如：期中考试、单元测试' },
      total_score: { label: '总分', type: 'number', default: 100 },
      student_count: { label: '参考人数', type: 'number' },
      average_score: { label: '平均分', type: 'number' },
      max_score: { label: '最高分', type: 'number' },
      min_score: { label: '最低分', type: 'number' },
      score_distribution: { label: '分数段分布', type: 'textarea', placeholder: '如：90-100:10人, 80-89:15人...' },
      item_score_rates: { label: '各题得分率', type: 'textarea', placeholder: '如：第1题85%, 第2题72%...' }
    }
  },
  {
    id: 'error-analysis',
    name: '错题分析',
    description: '根据学生错题记录，分析错误类型、知识薄弱点并生成针对性练习',
    icon: 'bug-off',
    category: 'education',
    subcategory: 'assessment',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{subject}学科诊断专家。请根据以下学生错题记录进行分析：

学科：{subject}
年级：{grade}
错题记录：
{wrong_questions}

请输出：
1. 错题分类汇总（按知识点归类）
2. 错误类型分析（概念不清 / 公式误用 / 审题失误 / 计算错误 / 思维定势）
3. 知识薄弱点清单（按优先级排序）
4. 归因诊断（深层原因分析）
5. 针对性巩固练习（每个薄弱点 2-3 道）
6. 复习策略建议（因人而异的查漏补缺方案）
7. 家校配合建议

要求：诊断精准、建议具体可操作，不泛泛而谈。`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学、物理' },
      grade: { label: '年级', type: 'text', placeholder: '如：七年级' },
      wrong_questions: { label: '错题记录', type: 'textarea', placeholder: '粘贴学生错题内容' }
    }
  },

  // ═══════════════════════════════════════════════
  //  批改与反馈类
  // ═══════════════════════════════════════════════
  {
    id: 'essay-grader',
    name: '作文批改',
    description: '智能批改学生作文，从内容、结构、语言、立意等多维度评分并给出评语',
    icon: 'check-square',
    category: 'education',
    subcategory: 'grading',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{grade}语文教师，正在批改学生作文。请对以下作文进行详细批改：

作文题目：{title}
年级：{grade}
学生作文全文：
{essay_content}

请从以下维度批改：
1. 综合评分（满分 100 分，分项后汇总）
2. 分项评分：
   - 内容与立意（30 分）：主题是否突出、立意是否深刻
   - 结构与逻辑（25 分）：层次是否清晰、过渡是否自然
   - 语言表达（25 分）：用词是否准确、句式是否丰富
   - 卷面与格式（10 分）：书写格式、段落划分
   - 创新与亮点（10 分）：是否有独特视角或亮点
3. 逐段点评（指出每段优点与改进建议）
4. 标点与字词纠错（标注具体位置）
5. 升格示范（选取一段进行改写示范）
6. 总体评语（鼓励为主，指出 1-2 个最需改进的方向）

要求：评分标准清晰，评语具体有建设性，多鼓励少批评。`,
    inputSchema: {
      title: { label: '作文题目', type: 'text', placeholder: '如：我的暑假生活' },
      grade: { label: '年级', type: 'text', placeholder: '如：六年级' },
      essay_content: { label: '作文全文', type: 'textarea', placeholder: '粘贴学生作文内容' }
    }
  },
  {
    id: 'comment-generator',
    name: '评语生成器',
    description: '根据学生表现数据，生成个性化、鼓励性的学期评语或作业评语',
    icon: 'message-square-plus',
    category: 'education',
    subcategory: 'grading',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{grade}的班主任/任课教师。请为以下学生撰写评语：

学生姓名：{student_name}
年级班级：{grade}
学科（若为学科评语）：{subject}
评语类型：{comment_type}（学期评语 / 作业评语 / 活动评语）
学生表现描述：{performance}
需提及的亮点：{strengths}
需鼓励改进的方面：{improvements}
字数要求：{word_count} 字以内
风格偏好：{style}（温暖鼓励 / 中肯客观 / 简练有力）

请输出评语正文：
（直接输出评语内容，无需额外说明）

要求：语气亲切自然，客观描述表现，用"建议"代替"批评"，体现对学生的关注与期待。`,
    inputSchema: {
      student_name: { label: '学生姓名', type: 'text', placeholder: '如：张三' },
      grade: { label: '年级班级', type: 'text', placeholder: '如：三年级二班' },
      subject: { label: '学科（可留空）', type: 'text', placeholder: '如：数学，学期评语可不填' },
      comment_type: { label: '评语类型', type: 'text', placeholder: '学期评语 / 作业评语 / 活动评语' },
      performance: { label: '学生表现描述', type: 'textarea', placeholder: '描述学生本学期的综合表现' },
      strengths: { label: '需提及的亮点', type: 'text', placeholder: '如：课堂活跃、作业认真' },
      improvements: { label: '需改进的方面', type: 'text', placeholder: '如：书写工整度、举手发言' },
      word_count: { label: '字数要求', type: 'number', default: 150 },
      style: { label: '风格偏好', type: 'text', placeholder: '温暖鼓励 / 中肯客观 / 简练有力' }
    }
  },
  {
    id: 'feedback-polisher',
    name: '反馈润色',
    description: '将教师写的批改草稿进行润色，使语气更温和、建议更具体、表述更专业',
    icon: 'sparkles',
    category: 'education',
    subcategory: 'grading',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位教育沟通专家。请对以下教师批改/反馈草稿进行润色：

原始草稿：
{draft}

学生年级：{grade}
反馈场景：{scenario}（作业反馈 / 课堂表现 / 行为引导）
当前语气：{current_tone}
期望语气：{target_tone}（温和鼓励 / 严肃引导 / 专业建议）

请输出润色后的版本，并附上润色说明：
1. 润色后的反馈文本
2. 主要修改点说明（改了哪些表述、为什么）
3. 加分建议（可额外添加的鼓励性话语或具体建议）

要求：保持原意的同时让反馈更具建设性，避免负面标签化语言。`,
    inputSchema: {
      draft: { label: '原始草稿', type: 'textarea', placeholder: '粘贴您写的批改草稿' },
      grade: { label: '学生年级', type: 'text', placeholder: '如：四年级' },
      scenario: { label: '反馈场景', type: 'text', placeholder: '作业反馈 / 课堂表现 / 行为引导' },
      current_tone: { label: '当前语气', type: 'text', placeholder: '如：严厉、直白' },
      target_tone: { label: '期望语气', type: 'text', placeholder: '温和鼓励 / 严肃引导 / 专业建议' }
    }
  },

  // ═══════════════════════════════════════════════
  //  沟通与管理类
  // ═══════════════════════════════════════════════
  {
    id: 'parent-meeting-speech',
    name: '家长会发言稿',
    description: '根据班级情况自动生成家长会发言稿，涵盖学情汇报、问题分析与家校配合建议',
    icon: 'users',
    category: 'education',
    subcategory: 'communication',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位有经验的班主任。请根据以下信息生成家长会发言稿：

年级班级：{grade}
会议主题：{meeting_theme}
时间：{duration} 分钟
班级整体情况：{class_summary}
期中/末考试成绩概况：{exam_summary}
学生共性亮点：{highlights}
需要家长关注的问题：{concerns}
需要家长配合的事项：{cooperation}
优秀学生代表：{model_students}
进步明显学生：{improved_students}

请按以下结构生成发言稿：
1. 开场致辞（欢迎与感谢）
2. 班级整体情况汇报（学风、纪律、活动开展）
3. 学情分析（成绩概况、进退步分析）
4. 各科学习建议（分学科简要说明）
5. 安全教育与心理健康提醒
6. 家庭教育建议（具体可操作）
7. 需要家长配合的事项
8. 自由交流环节引导语
9. 结束语

要求：语气亲切真诚，既报喜也报忧但以建设性方式呈现，控制总时长在 {duration} 分钟内。`,
    inputSchema: {
      grade: { label: '年级班级', type: 'text', placeholder: '如：五年级三班' },
      meeting_theme: { label: '会议主题', type: 'text', placeholder: '如：期中考试总结家长会' },
      duration: { label: '发言时长（分钟）', type: 'number', default: 15 },
      class_summary: { label: '班级整体情况', type: 'textarea', placeholder: '描述班级总体表现' },
      exam_summary: { label: '考试概况', type: 'textarea', placeholder: '各科平均分、优秀率等' },
      highlights: { label: '学生共性亮点', type: 'text', placeholder: '如：课堂参与度高、作业完成好' },
      concerns: { label: '需关注问题', type: 'text', placeholder: '如：书写潦草、计算粗心' },
      cooperation: { label: '需家长配合事项', type: 'text', placeholder: '如：监督阅读打卡' },
      model_students: { label: '优秀学生代表', type: 'text', placeholder: '可选，列出学生姓名' },
      improved_students: { label: '进步明显学生', type: 'text', placeholder: '可选，列出学生姓名' }
    }
  },
  {
    id: 'notice-generator',
    name: '通知公告',
    description: '快速生成给家长或学生的通知公告，支持正式通知、温馨提示、活动邀请等多种场景',
    icon: 'megaphone',
    category: 'education',
    subcategory: 'communication',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位班主任/学校行政人员。请根据以下信息撰写通知：

通知类型：{notice_type}（家长通知 / 学生通知 / 同事通知）
主题：{topic}
发送对象：{target_audience}
具体内容要点：{key_points}
截止时间 / 活动时间：{deadline}
需要回执：{require_receipt}（是/否）
语气风格：{tone}（正式 / 亲切 / 紧急）
字数限制：{word_count} 字以内

请输出：
1. 通知标题
2. 正文
3. 注意事项（如有）
4. 回执模板（如需）

要求：关键信息突出、时间地点明确、用语得体。`,
    inputSchema: {
      notice_type: { label: '通知类型', type: 'text', placeholder: '家长通知 / 学生通知 / 同事通知' },
      topic: { label: '主题', type: 'text', placeholder: '如：秋游活动安排' },
      target_audience: { label: '发送对象', type: 'text', placeholder: '如：全体家长' },
      key_points: { label: '内容要点', type: 'textarea', placeholder: '列举通知中需要包含的要点' },
      deadline: { label: '截止/活动时间', type: 'text', placeholder: '如：9月30日下午5点前' },
      require_receipt: { label: '是否需要回执', type: 'text', placeholder: '是 / 否' },
      tone: { label: '语气风格', type: 'text', placeholder: '正式 / 亲切 / 紧急' },
      word_count: { label: '字数限制', type: 'number', default: 300 }
    }
  },
  {
    id: 'learning-report',
    name: '学情报告',
    description: '汇总学生阶段性学习数据，生成图文并茂的学情分析报告，支持导出给家长或学校',
    icon: 'file-bar-chart',
    category: 'education',
    subcategory: 'communication',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位{subject}学科教师。请根据以下学情数据生成阶段性学情报告：

报告周期：{report_period}
年级班级：{grade}
学科：{subject}
学生人数：{student_count}
平均分：{average_score}
优秀率（{excellent_threshold}分以上）：{excellent_rate}%
及格率：{pass_rate}%
分数段分布：{score_distribution}
高频错题：{common_errors}
共性问题：{common_issues}
个别突出问题：{individual_issues}

请输出：
1. 报告摘要（一句话概括本阶段学情）
2. 数据概览（关键指标列表）
3. 学情分析
   - 整体表现评价
   - 知识点掌握热力图（哪些掌握好、哪些薄弱）
   - 进步与退步趋势
4. 典型错题归因
5. 分层教学建议（学优生 / 中等生 / 待进生）
6. 家长建议（如何在家配合）
7. 下阶段教学计划调整建议

要求：数据可视化描述清晰，建议分层分类，便于家长理解。`,
    inputSchema: {
      subject: { label: '学科', type: 'text', placeholder: '如：数学' },
      report_period: { label: '报告周期', type: 'text', placeholder: '如：2026年3月-4月' },
      grade: { label: '年级班级', type: 'text', placeholder: '如：五年级三班' },
      student_count: { label: '学生人数', type: 'number' },
      average_score: { label: '平均分', type: 'number' },
      excellent_threshold: { label: '优秀分数线', type: 'number', default: 90 },
      excellent_rate: { label: '优秀率（%）', type: 'number' },
      pass_rate: { label: '及格率（%）', type: 'number' },
      score_distribution: { label: '分数段分布', type: 'textarea', placeholder: '如：90+:10人, 80-89:15人...' },
      common_errors: { label: '高频错题', type: 'textarea', placeholder: '列出错误率高的题目' },
      common_issues: { label: '共性问题', type: 'textarea', placeholder: '学生普遍存在的问题' },
      individual_issues: { label: '个别突出问题', type: 'textarea', placeholder: '个别学生的特殊情况' }
    }
  },

  // ═══════════════════════════════════════════════
  //  个人成长类
  // ═══════════════════════════════════════════════
  {
    id: 'teaching-reflection',
    name: '教学反思',
    description: '根据课堂记录或教学日志，生成结构化教学反思，帮助教师持续改进教学',
    icon: 'rotate-ccw',
    category: 'education',
    subcategory: 'professional-growth',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位教育教研专家。请根据以下课堂记录帮助教师进行教学反思：

课题：{topic}
年级：{grade}
学科：{subject}
课堂记录 / 教学日志：{teaching_log}
学生反馈 / 课堂反应：{student_feedback}
教师的自我评价：{self_assessment}

请按照以下结构输出教学反思报告：
1. 教学达成度评价（教学目标是否实现，证据是什么）
2. 课堂亮点（哪些环节效果好，为什么）
3. 不足与归因（哪些环节需要改进，深层原因分析）
4. 学生视角分析（学生的学习体验和收获）
5. 改进策略（下一次教同一个内容时如何优化）
6. 专业成长方向（基于此反思的后续学习建议）
7. 一句话总结

要求：反思深刻、不流于形式，改进策略具体可执行。`,
    inputSchema: {
      topic: { label: '课题', type: 'text', placeholder: '如：分数的意义' },
      grade: { label: '年级', type: 'text', placeholder: '如：五年级' },
      subject: { label: '学科', type: 'text', placeholder: '如：数学' },
      teaching_log: { label: '课堂记录', type: 'textarea', placeholder: '描述课堂教学过程和关键环节' },
      student_feedback: { label: '学生反馈', type: 'textarea', placeholder: '学生的反应、提问、作业表现等' },
      self_assessment: { label: '教师自评', type: 'textarea', placeholder: '您自己对这节课的评价' }
    }
  },
  {
    id: 'research-proposal-helper',
    name: '课题申报助手',
    description: '辅助教师撰写教育科研课题申报书，包含选题论证、研究目标、方法设计、预期成果等',
    icon: 'microscope',
    category: 'education',
    subcategory: 'professional-growth',
    requiresAuth: false,
    builtIn: true,
    promptTemplate: `你是一位教育科研专家。请帮助教师撰写课题申报书：

拟申报课题名称：{topic}
研究领域：{field}（课程改革 / 教学设计 / 评价改革 / 班级管理 / 信息技术等）
申报级别：{level}（校级 / 区级 / 市级 / 省级 / 国家级）
研究背景与动机：{background}
个人/团队已有基础：{prior_work}
预计研究周期：{duration} 个月

请按以下结构生成申报书草稿：
1. 问题的提出（研究背景、现状问题、研究意义）
2. 国内外研究现状述评
3. 研究目标与内容（核心目标、具体研究内容）
4. 研究方法（行动研究法 / 案例研究法 / 实验对比法等）
5. 技术路线与实施步骤（分阶段安排）
6. 预期成果（论文 / 案例集 / 校本教材 / 软件等）
7. 创新点（理论创新 / 实践创新）
8. 研究条件与保障
9. 参考文献格式示例

要求：学术表述规范，逻辑严谨，研究方法可行，创新点突出。`,
    inputSchema: {
      topic: { label: '拟申报课题名称', type: 'text', placeholder: '如：核心素养视域下小学数学项目式学习实践研究' },
      field: { label: '研究领域', type: 'text', placeholder: '课程改革 / 教学设计 / 评价改革等' },
      level: { label: '申报级别', type: 'text', placeholder: '校级 / 区级 / 市级 / 省级 / 国家级' },
      background: { label: '研究背景与动机', type: 'textarea', placeholder: '为什么想做这个课题' },
      prior_work: { label: '已有基础', type: 'textarea', placeholder: '已有的研究或实践经验' },
      duration: { label: '研究周期（月）', type: 'number', default: 12 }
    }
  }
]

export default TEACHER_SKILLS
