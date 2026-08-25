/**
 * WPX 冷启动模板库
 *
 * 【为什么需要这个文件？】
 * 之前 EmptyState 只展示"我的智能模板"（来自 userHabits.saves 统计），
 * 但新用户从未保存过文档 → saves 为空 → SmartTemplate 整个不渲染，
 * 用户看不到任何模板入口。
 *
 * 本文件提供内置模板，作为"冷启动"兜底：
 *   - 始终可见，与保存历史无关
 *   - 覆盖 Markdown / 表格 / PPT / 教案 / 周报 / 纪要 / 讲义 / 笔记等常见格式
 *   - 当用户保存过 3 次以上同类文档时，userHabits 自动覆盖为"我的常用"，
 *     本文件仅作为兜底。
 *
 * 字段说明：
 *   - id              唯一标识（用于 userHabits documentType）
 *   - name            显示名（卡片标题）
 *   - description     一句话说明
 *   - icon            lucide 图标名（前端按需 import）
 *   - category        分类（document / table / presentation / lesson / note）
 *   - documentType    用于 setSessionDocumentType 与 userHabits 追踪
 *   - format          套用排版（applyFormat 接受 {font,fontSize,lineHeight,heading}）
 *   - content         Markdown 内容，写入编辑器（loadMarkdown）
 *
 * 使用方式：
 *   import { COLD_START_TEMPLATES, getColdStartTemplate } from '@/data/cold-start-templates'
 *   const tpl = getColdStartTemplate('weekly-report')
 */

/**
 * @typedef {object} ColdStartTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon
 * @property {'document'|'table'|'presentation'|'lesson'|'note'} category
 * @property {string} documentType
 * @property {object} format
 * @property {string} content
 */

/** 通用：默认文档（与"新建 Markdown 文档"按钮等价，但走模板通道便于追踪 documentType） */
const BLANK_DOC = `# 新文档

在这里开始你的创作…

`

/** 工作日志（日报） */
const DAILY_JOURNAL = `# 工作日志

> 日期：__ 年 __ 月 __ 日（周__）
> 天气：
> 心情：

## 一、今日待办（Top 3）

1. 
2. 
3. 

## 二、工作记录

- 
- 
- 

## 三、产出与收获

- 文档：
- 代码：
- 沟通：

## 四、遇到的问题

| 问题 | 解决方案 | 状态 |
| ---- | -------- | ---- |
|      |          |      |
|      |          |      |

## 五、明日计划

- 
- 
`

/** 待办清单（带优先级） */
const TODO_LIST = `# 待办清单

> 截止：__ 年 __ 月 __ 日
> 分类：

## P0 · 紧急重要

- [ ] 
- [ ] 

## P1 · 重要不紧急

- [ ] 
- [ ] 

## P2 · 紧急不重要

- [ ] 

## P3 · 可选

- [ ] 

## 已完成

- [x] 
- [x] 
`

/** 读书笔记 */
const READING_NOTES = `# 读书笔记

> 书名：
> 作者：
> 译者：
> 阅读日期：__ 年 __ 月 __ 日

## 一、为什么读这本书

> 

## 二、全书结构

| 章节 | 核心内容 | 我的疑问 |
| ---- | -------- | -------- |
| 1    |          |          |
| 2    |          |          |
| 3    |          |          |

## 三、核心观点（5 条）

1. 
2. 
3. 
4. 
5. 

## 四、精彩摘录

> 
> 
> 

## 五、我的启发

- 
- 

## 六、行动建议

- [ ] 
- [ ] 

## 七、评分（1-5 ⭐）

可读性：⭐⭐⭐⭐⭐  
启发性：⭐⭐⭐⭐⭐  
实操性：⭐⭐⭐⭐⭐
`

/** 周报 */
const WEEKLY_REPORT = `# 本周工作周报

> 周期：2026 年第 __ 周（__ 月 __ 日 — __ 月 __ 日）

## 一、本周重点完成

- 
- 
- 

## 二、关键数据

| 指标 | 目标 | 实际 | 备注 |
| ---- | ---- | ---- | ---- |
|      |      |      |      |
|      |      |      |      |

## 三、未完成 / 下周计划

1. 
2. 
3. 

## 四、风险与需要的支持

- 
`

/** 会议纪要 */
const MEETING_NOTES = `# 会议纪要

> 时间：__ 年 __ 月 __ 日 __:__ — __:__
> 地点：
> 主持人：
> 与会者：

## 一、议题与结论

### 议题 1：
- 结论：
- 决策：

### 议题 2：
- 结论：
- 决策：

## 二、行动项

| 编号 | 任务 | 负责人 | 截止日期 | 状态 |
| ---- | ---- | ------ | -------- | ---- |
| #1 |      |        |          | 待办 |
| #2 |      |        |          | 待办 |
| #3 |      |        |          | 待办 |

## 三、下次会议

- 时间：
- 议题：
`

/** 项目跟踪表（带进度条 + 风险） */
const PROJECT_TRACKER = `# 项目跟踪表

> 项目名称：
> 负责人：
> 启动日期：__ 年 __ 月 __ 日
> 计划交付：__ 年 __ 月 __ 日

## 一、里程碑

| 里程碑 | 计划日期 | 实际日期 | 状态 | 负责人 |
| ------ | -------- | -------- | ---- | ------ |
| M1     |          |          | ⏳    |        |
| M2     |          |          | ⏳    |        |
| M3     |          |          | ⏳    |        |

## 二、任务看板

| 任务 | 优先级 | 负责人 | 截止 | 进度 | 状态 |
| ---- | ------ | ------ | ---- | ---- | ---- |
| T1   | P0     |        |      | 0%   | 待启动 |
| T2   | P1     |        |      | 0%   | 待启动 |
| T3   | P2     |        |      | 0%   | 待启动 |

## 三、风险与依赖

| 风险 | 影响 | 缓解措施 | 责任人 |
| ---- | ---- | -------- | ------ |
|      |      |          |        |
|      |      |          |        |

## 四、本周聚焦

- 
- 
`

/** 看板（Kanban 三列） */
const KANBAN = `# 看板

> 团队：
> 周期：

## 待办（Backlog）

- [ ] 
- [ ] 
- [ ] 

## 进行中（Doing）

- [ ] 
- [ ] 

## 已完成（Done）

- [x] 
- [x] 

## 卡住 / 阻塞

| 任务 | 阻塞原因 | 解锁条件 | 负责人 |
| ---- | -------- | -------- | ------ |
|      |          |          |        |
`

/** Markdown 表格：周计划 */
const WEEKLY_PLAN_TABLE = `# 本周计划

| 时间段 | 周一 | 周二 | 周三 | 周四 | 周五 |
| ------ | ---- | ---- | ---- | ---- | ---- |
| 上午   |      |      |      |      |      |
| 下午   |      |      |      |      |      |
| 晚上   |      |      |      |      |      |

## 关键里程碑

| 里程碑 | 计划日期 | 实际日期 | 状态 |
| ------ | -------- | -------- | ---- |
| M1     |          |          | ⏳    |
| M2     |          |          | ⏳    |
| M3     |          |          | ⏳    |
`

/** 课程讲义 */
const LESSON_LECTURE = `# 课程讲义

> 课程：
> 主讲：
> 对象：

## 一、教学目标

1. 知识目标：
2. 能力目标：
3. 素养目标：

## 二、教学重点与难点

- **重点**：
- **难点**：

## 三、教学过程

### 3.1 新课导入（__ 分钟）

### 3.2 知识讲解（__ 分钟）

### 3.3 例题示范（__ 分钟）

### 3.4 课堂练习（__ 分钟）

### 3.5 课堂小结（__ 分钟）

## 四、作业布置

1. 
2. 

## 五、板书设计

| 板块 | 内容 |
| ---- | ---- |
|      |      |
`

/** 路演 / 商业计划（Pitch Deck） */
const PITCH_DECK = `# 路演 PPT

> 公司 / 项目：
> 目标融资：
> 演讲时长：__ 分钟

## 封面

- 一句话定位：

## 问题（Problem）

- 市场痛点 1：
- 市场痛点 2：
- 痛点量化（数字）：

## 方案（Solution）

- 核心产品：
- 关键能力：
- 与现有方案的差异：

## 市场（Market）

| 细分市场 | TAM | SAM | SOM | 优先级 |
| -------- | --- | --- | --- | ------ |
|          |     |     |     |        |

## 商业模式

- 收入来源：
- 单价 / ARPU：
- 获客成本 / 复购率：

## 进展（Traction）

| 指标 | 现状 | 同比 |
| ---- | ---- | ---- |
| 用户 |      |      |
| 收入 |      |      |
| 留存 |      |      |

## 团队（Team）

| 成员 | 角色 | 背景 |
| ---- | ---- | ---- |
|      |      |      |

## 融资需求（Ask）

- 融资金额：
- 资金用途（比例）：
- 里程碑：

## 愿景（Vision）

> 三年后，我们希望成为____。
`

/** 产品介绍 PPT */
const PRODUCT_INTRO = `# 产品介绍

> 产品名称：
> 版本：
> 受众：内部 / 客户 / 合作伙伴

## 一、产品定位

- 一句话描述：
- 目标用户：
- 核心价值：

## 二、核心功能

| 功能 | 价值 | 使用场景 |
| ---- | ---- | -------- |
| F1   |      |          |
| F2   |      |          |
| F3   |      |          |

## 三、对比优势

| 维度 | 我方 | 竞品 A | 竞品 B |
| ---- | ---- | ------ | ------ |
|      |      |        |        |

## 四、用户旅程

1. 发现 → 2. 注册 → 3. 试用 → 4. 付费 → 5. 续费

## 五、定价

| 套餐 | 价格 | 包含 | 适合 |
| ---- | ---- | ---- | ---- |
| 免费 | ¥0   |      |      |
| 专业 |      |      |      |
| 企业 |      |      |      |

## 六、行动号召

- 立即体验：
- 联系销售：
- 申请试用：
`

/** PPT 课件大纲（与教案生成课件工作流配合） */
const PPT_OUTLINE = `# 课件大纲

> 主题：
> 学段：
> 学科：
> 课时：

## 封面页

- 主标题：
- 副标题：

## 目录页

1. 
2. 
3. 

## 第一部分：

- 要点 1：
- 要点 2：
- 要点 3：

## 第二部分：

- 要点 1：
- 要点 2：
- 要点 3：

## 第三部分：

- 要点 1：
- 要点 2：
- 要点 3：

## 课堂练习

| 题号 | 类型 | 难度 | 分值 |
| ---- | ---- | ---- | ---- |
| 1    | 选择 | ★    |      |
| 2    | 填空 | ★★   |      |
| 3    | 解答 | ★★★  |      |

## 课堂小结

- 
- 
`

/** 试卷模板（教师专用） */
const EXAM_PAPER = `# __ 试卷

> 学科：
> 年级 / 班级：
> 考试时间：__ 分钟　总分：__ 分

## 一、填空题（每空 __ 分，共 __ 分）

1. 
2. 
3. 
4. 
5. 

## 二、选择题（每题 __ 分，共 __ 分）

1. （ ）　A.　　B.　　C.　　D.
2. （ ）　A.　　B.　　C.　　D.
3. （ ）　A.　　B.　　C.　　D.

## 三、判断题（每题 __ 分，共 __ 分）

1. （ ）
2. （ ）
3. （ ）

## 四、简答题（每题 __ 分，共 __ 分）

1. 
2. 
3. 

## 五、应用题（每题 __ 分，共 __ 分）

1. 
2. 

## 参考答案（独立卷）

- 选择：
- 填空：
- 应用：

## 命题说明

- 考查范围：
- 难度分布：易 __ %　中 __ %　难 __ %
- 区分度预估：
`

/** 学生评语（教师专用） */
const STUDENT_EVALUATION = `# 学生综合评语

> 学生姓名：
> 班级：
> 学期：

## 一、思想品德

- 优点：
- 待提升：

## 二、学习态度

- 课堂表现：
- 作业完成：
- 自主学习：

## 三、学业成绩

| 学科 | 期初 | 期末 | 进步 |
| ---- | ---- | ---- | ---- |
|      |      |      |      |
|      |      |      |      |

## 四、学科能力

- 优势学科：
- 薄弱学科：
- 学习方法：

## 五、特长与兴趣

- 
- 

## 六、家校沟通建议

- 
- 

## 七、学期寄语

> 
`

/** 教案大纲（教师专用，可一键转 PPT） */
const LESSON_PLAN = `# 教案

> 课题：
> 课型：新授课 / 复习课 / 习题课
> 授课对象：
> 课时安排：第 __ 课时 / 共 __ 课时

## 一、教学目标

### 知识与技能

- 

### 过程与方法

- 

### 情感态度与价值观

- 

## 二、教学重难点

- **教学重点**：
- **教学难点**：
- **教学突破**：

## 三、教学方法

- 教法：
- 学法：
- 教学手段：

## 四、教学过程

### 4.1 导入新课（__ 分钟）

- 

### 4.2 讲授新课（__ 分钟）

- 

### 4.3 巩固练习（__ 分钟）

- 

### 4.4 课堂小结（__ 分钟）

- 

### 4.5 布置作业（__ 分钟）

- 

## 五、板书设计

\`\`\`
（板书草图）
\`\`\`

## 六、教学反思

- 成功之处：
- 不足之处：
- 改进措施：
`

/** 公众号文章 */
const WECHAT_ARTICLE = `# 文章标题

> 作者：
> 公众号：
> 预计阅读：__ 分钟

## 引子

（用一句话或一个小故事抓住读者注意力）

## 一、

（分论点 / 场景展开）

> 金句或重点强调

## 二、

（分论点 / 场景展开）

## 三、

（分论点 / 场景展开）

## 结尾

（升华主题 / 行动号召）

---

**延伸阅读**

- 
- 

**互动引导**

觉得有用？欢迎「在看」与「转发」。

#标签
`

/** 小说创作 */
const NOVEL_WRITING = `# 小说标题

> 类型：
> 视角：第一人称 / 第三人称
> 字数目标：__ 万字

## 故事梗概

（200 字内概括主线）

## 主要人物

| 角色 | 身份 | 性格 | 目标 |
| ---- | ---- | ---- | ---- |
|      |      |      |      |
|      |      |      |      |

## 世界观 / 背景设定

- 时间：
- 地点：
- 核心规则：

## 第一章

### 场景一


### 场景二


## 情节大纲（可选）

| 章节 | 情节要点 | 冲突 / 转折 | 状态 |
| ---- | -------- | ----------- | ---- |
| 第1章 |          |             | 草稿 |
| 第2章 |          |             | 待写 |
| 第3章 |          |             | 待写 |

## 写作笔记

- 
- 
`

/** 书评 / 影评 */
const BOOK_REVIEW = `# 书评

> 书名 / 作品名：
> 作者 / 导演：
> 体裁：书 / 电影 / 剧集
> 评分（1-10）：

## 一、概览

- 一句话总结：
- 类型 / 体裁：
- 适合谁读：

## 二、剧情 / 内容梗概（不剧透关键转折）

- 背景：
- 主线：
- 结局：

## 三、亮点

- 亮点 1：
- 亮点 2：
- 亮点 3：

## 四、不足

- 
- 

## 五、对比 / 同类作品

- 
- 

## 六、值得记住的句子 / 镜头

> 
> 
> 

## 七、我的推荐

- 推荐给：____
- 适合在 ____ 心情下读 / 看
- 是否会重读 / 重看：
`

/** 思维导图（大纲版） */
const MIND_MAP = `# 思维导图

> 主题：

## 中心主题

> 

## 分支一：____

- 论点：
  - 证据 1：
  - 证据 2：
- 反例：

## 分支二：____

- 论点：
  - 证据 1：
  - 证据 2：
- 反例：

## 分支三：____

- 论点：
  - 证据 1：
  - 证据 2：
- 反例：

## 分支四：____（可叠加）

- 
- 

## 结论

> 
`

/** 学习总结 / 复习提纲 */
const STUDY_SUMMARY = `# 学习总结

> 主题：
> 学习周期：__ 年 __ 月 __ 日 — __ 年 __ 月 __ 日
> 总时长：__ 小时

## 一、知识地图

- 章节 1：____
  - 关键概念：
- 章节 2：____
  - 关键概念：
- 章节 3：____
  - 关键概念：

## 二、必须掌握的核心概念

| 概念 | 一句话定义 | 我的理解 |
| ---- | ---------- | -------- |
|      |            |          |
|      |            |          |
|      |            |          |

## 三、易错点 & 难点

- 错点 1：
  - 出错原因：
  - 正确做法：
- 错点 2：

## 四、典型例题（举一反三）

1. 题目：
   - 解题思路：
   - 关键公式 / 步骤：

## 五、自测题（巩固）

- [ ] 
- [ ] 
- [ ] 

## 六、下一步

- 
`

/** 面试记录 */
const INTERVIEW_NOTES = `# 面试记录

> 候选人：
> 应聘岗位：
> 面试日期：__ 年 __ 月 __ 日 __:__
> 面试官：

## 一、基本信息

- 工作年限：
- 上一家公司：
- 期望薪资：

## 二、技术 / 专业能力

| 维度 | 评分（1-5） | 备注 |
| ---- | ----------- | ---- |
|      |             |      |

## 三、项目经历追问

- 项目 1：
  - 角色 / 贡献：
  - 难点 / 解决：
- 项目 2：
  - 角色 / 贡献：
  - 难点 / 解决：

## 四、综合素质

- 沟通表达：
- 抗压能力：
- 学习能力：
- 文化匹配：

## 五、提问环节（候选人反问）

- Q1：
- Q2：

## 六、综合评估

- 推荐度：强推 / 推荐 / 待定 / 不推荐
- 关键优势：
- 关键顾虑：

## 七、后续动作

- [ ] 反馈给 HR
- [ ] 安排下一轮
- [ ] 发 offer / 拒信
`

/** 知识卡片 / 笔记 */
const NOTE_CARD = `# 笔记标题

> 创建时间：__ 年 __ 月 __ 日
> 标签：# 

## 一、核心观点

> 

## 二、要点展开

- 要点 1：
  - 支撑 / 论据：
- 要点 2：
  - 支撑 / 论据：
- 要点 3：
  - 支撑 / 论据：

## 三、相关引用

> 

## 四、行动清单

- [ ] 
- [ ] 
- [ ] 

## 五、关联笔记

- 
- 
`

/** @type {ColdStartTemplate[]} */
export const COLD_START_TEMPLATES = [
  {
    id: 'blank',
    name: '空白 Markdown',
    description: '从零开始书写，最轻量',
    icon: 'FileText',
    category: 'document',
    documentType: '空白文档',
    format: {},
    content: BLANK_DOC,
  },
  {
    id: 'weekly-report',
    name: '工作周报',
    description: '重点 / 数据 / 下周计划 / 风险',
    icon: 'CalendarDays',
    category: 'document',
    documentType: '工作周报',
    format: { heading: 2, lineHeight: '1.7' },
    content: WEEKLY_REPORT,
  },
  {
    id: 'daily-journal',
    name: '工作日志',
    description: '今日待办 / 记录 / 产出 / 明日计划',
    icon: 'CalendarCheck',
    category: 'document',
    documentType: '工作日志',
    format: { lineHeight: '1.7' },
    content: DAILY_JOURNAL,
  },
  {
    id: 'todo-list',
    name: '待办清单',
    description: 'P0/P1/P2/P3 四象限优先级',
    icon: 'ListChecks',
    category: 'document',
    documentType: '待办清单',
    format: { lineHeight: '1.65' },
    content: TODO_LIST,
  },
  {
    id: 'reading-notes',
    name: '读书笔记',
    description: '结构 / 观点 / 摘录 / 启发 / 评分',
    icon: 'BookMarked',
    category: 'document',
    documentType: '读书笔记',
    format: { fontSize: '15px', lineHeight: '1.7' },
    content: READING_NOTES,
  },
  {
    id: 'wechat-article',
    name: '公众号文章',
    description: '引子 / 分节 / 金句 / 结尾 / 互动引导',
    icon: 'MessageSquareText',
    category: 'document',
    documentType: '公众号文章',
    format: { fontSize: '16px', lineHeight: '1.8' },
    content: WECHAT_ARTICLE,
  },
  {
    id: 'novel-writing',
    name: '写小说',
    description: '梗概 / 人物 / 世界观 / 章节 / 情节大纲',
    icon: 'PenLine',
    category: 'document',
    documentType: '小说创作',
    format: { fontSize: '16px', lineHeight: '1.85' },
    content: NOVEL_WRITING,
  },
  {
    id: 'meeting-notes',
    name: '会议纪要',
    description: '议题 / 结论 / 行动项 / 下次会议',
    icon: 'Users',
    category: 'note',
    documentType: '会议纪要',
    format: { heading: 2, lineHeight: '1.7' },
    content: MEETING_NOTES,
  },
  {
    id: 'interview-notes',
    name: '面试记录',
    description: '基本信息 / 能力 / 项目 / 评估 / 后续',
    icon: 'UserCheck',
    category: 'note',
    documentType: '面试记录',
    format: { lineHeight: '1.7' },
    content: INTERVIEW_NOTES,
  },
  {
    id: 'book-review',
    name: '书评 / 影评',
    description: '概览 / 亮点 / 不足 / 句子 / 推荐',
    icon: 'Star',
    category: 'note',
    documentType: '书评',
    format: { lineHeight: '1.7' },
    content: BOOK_REVIEW,
  },
  {
    id: 'mind-map',
    name: '思维导图大纲',
    description: '中心主题 / 多分支 / 证据 / 结论',
    icon: 'GitBranch',
    category: 'note',
    documentType: '思维导图',
    format: { lineHeight: '1.7' },
    content: MIND_MAP,
  },
  {
    id: 'note-card',
    name: '知识笔记',
    description: '核心观点 / 要点 / 引用 / 行动',
    icon: 'NotebookPen',
    category: 'note',
    documentType: '学习笔记',
    format: { fontSize: '15px', lineHeight: '1.7' },
    content: NOTE_CARD,
  },
  {
    id: 'study-summary',
    name: '学习总结',
    description: '知识地图 / 核心概念 / 易错 / 例题',
    icon: 'GraduationCap',
    category: 'note',
    documentType: '学习总结',
    format: { fontSize: '15px', lineHeight: '1.7' },
    content: STUDY_SUMMARY,
  },
  {
    id: 'weekly-plan',
    name: '周计划表格',
    description: '日程安排 + 里程碑跟踪',
    icon: 'Table',
    category: 'table',
    documentType: '周计划',
    format: { fontSize: '14px', lineHeight: '1.6' },
    content: WEEKLY_PLAN_TABLE,
  },
  {
    id: 'project-tracker',
    name: '项目跟踪表',
    description: '里程碑 / 任务 / 风险 / 聚焦',
    icon: 'KanbanSquare',
    category: 'table',
    documentType: '项目跟踪',
    format: { fontSize: '14px', lineHeight: '1.6' },
    content: PROJECT_TRACKER,
  },
  {
    id: 'kanban',
    name: '看板',
    description: '待办 / 进行中 / 已完成 / 阻塞',
    icon: 'Trello',
    category: 'table',
    documentType: '看板',
    format: { fontSize: '14px', lineHeight: '1.6' },
    content: KANBAN,
  },
  {
    id: 'ppt-outline',
    name: 'PPT 课件大纲',
    description: '封面 / 目录 / 章节 / 练习 / 小结',
    icon: 'Presentation',
    category: 'presentation',
    documentType: 'PPT 课件',
    format: { heading: 2, fontSize: '16px', lineHeight: '1.6' },
    content: PPT_OUTLINE,
  },
  {
    id: 'pitch-deck',
    name: '路演 PPT',
    description: '问题 / 方案 / 市场 / 进展 / 融资',
    icon: 'Rocket',
    category: 'presentation',
    documentType: '路演 PPT',
    format: { heading: 2, fontSize: '16px', lineHeight: '1.6' },
    content: PITCH_DECK,
  },
  {
    id: 'product-intro',
    name: '产品介绍 PPT',
    description: '定位 / 功能 / 对比 / 用户旅程 / 定价',
    icon: 'Package',
    category: 'presentation',
    documentType: '产品介绍',
    format: { heading: 2, fontSize: '16px', lineHeight: '1.6' },
    content: PRODUCT_INTRO,
  },
  {
    id: 'lesson-plan',
    name: '教案',
    description: '教学目标 / 重难点 / 过程 / 反思',
    icon: 'BookOpen',
    category: 'lesson',
    documentType: '教案',
    format: { heading: 2, lineHeight: '1.75' },
    content: LESSON_PLAN,
  },
  {
    id: 'lesson-lecture',
    name: '课程讲义',
    description: '教学目标 / 重点 / 过程 / 作业',
    icon: 'GraduationCap',
    category: 'lesson',
    documentType: '课程讲义',
    format: { heading: 2, lineHeight: '1.75' },
    content: LESSON_LECTURE,
  },
  {
    id: 'exam-paper',
    name: '试卷模板',
    description: '填空 / 选择 / 判断 / 简答 / 应用',
    icon: 'FileText',
    category: 'lesson',
    documentType: '试卷',
    format: { lineHeight: '1.75' },
    content: EXAM_PAPER,
  },
  {
    id: 'student-evaluation',
    name: '学生综合评语',
    description: '品德 / 态度 / 成绩 / 能力 / 寄语',
    icon: 'Award',
    category: 'lesson',
    documentType: '学生评语',
    format: { lineHeight: '1.75' },
    content: STUDENT_EVALUATION,
  },
]

/** 按分类分组，供 SmartTemplate 渲染分组 */
const _byCategory = (() => {
  /** @type {Record<string, ColdStartTemplate[]>} */
  const map = {}
  for (const t of COLD_START_TEMPLATES) {
    if (!map[t.category]) map[t.category] = []
    map[t.category].push(t)
  }
  return map
})()

export const CATEGORY_LABELS = {
  document: '通用文档',
  table: '表格',
  presentation: '演示文稿',
  lesson: '教学',
  note: '笔记',
}

export const CATEGORY_ORDER = ['document', 'table', 'presentation', 'lesson', 'note']

/** 按分类取出冷启动模板（已按 CATEGORY_ORDER 排序） */
export function getColdStartTemplatesByCategory() {
  return CATEGORY_ORDER.filter((cat) => _byCategory[cat]).map((category) => ({
    category,
    label: CATEGORY_LABELS[category] || category,
    templates: _byCategory[category],
  }))
}

/** 按 ID 取单个模板 */
export function getColdStartTemplate(id) {
  return COLD_START_TEMPLATES.find((t) => t.id === id) || null
}

export default COLD_START_TEMPLATES