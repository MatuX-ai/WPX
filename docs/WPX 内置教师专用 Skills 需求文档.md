# WPX 内置教师专用 Skills 需求文档

**版本**：V1.0  
**状态**：定稿  
**关联文档**：PRD、用户中心（设置）、Skill 服务集成

---

## 1. 概述

将 16 款教师专用 Skills 作为 WPX 内置功能，随应用安装即可使用，无需从 skillhub 下载。教师用户打开 WPX 即可在 Skills 管理页面看到并使用这些能力，覆盖备课、出题、批改、沟通、个人成长全流程。

**核心原则**：
- 内置 Skills 本地可用，不依赖网络。
- 与 skillhub 在线 Skills 统一管理，用户无感知差异。
- 内置 Skills 全部免费，无需登录。

---

## 2. 内置 Skills 清单

### 2.1 教学准备类

| ID | 名称 | 说明 |
|:---|:---|:---|
| `lesson-plan-generator` | 教案生成器 | 根据课题和教材版本生成结构化教案 |
| `courseware-outline` | 课件大纲提取 | 将教案提炼为PPT要点大纲 |
| `knowledge-breakdown` | 知识点拆解 | 将知识点拆解为递进式问题链 |
| `cross-subject-connection` | 跨学科关联 | 分析知识点在其他学科的应用 |

### 2.2 出题与测评类

| ID | 名称 | 说明 |
|:---|:---|:---|
| `smart-quiz-generator` | 智能出题 | 自动生成分层练习题，附解析和评分标准 |
| `variant-question-generator` | 变式题生成 | 基于原题生成变式训练题 |
| `exam-analyzer` | 试卷分析 | 分析考点分布、难度和区分度 |
| `error-analysis` | 错题归因 | 分析错题背后的知识盲点 |

### 2.3 批改与反馈类

| ID | 名称 | 说明 |
|:---|:---|:---|
| `essay-grader` | 作文批改 | 多维度批改作文，给出修改示范 |
| `comment-generator` | 评语生成器 | 生成个性化期末评语 |
| `feedback-polisher` | 作业批注润色 | 将直白批注转化为建设性反馈 |

### 2.4 沟通与管理类

| ID | 名称 | 说明 |
|:---|:---|:---|
| `parent-meeting-speech` | 家长会发言稿 | 生成结构完整的发言稿 |
| `notice-generator` | 通知/告家长书 | 快速生成规范通知文本 |
| `learning-report` | 学情报告 | 根据成绩数据生成分析报告 |

### 2.5 个人成长类

| ID | 名称 | 说明 |
|:---|:---|:---|
| `teaching-reflection` | 教学反思 | 将课堂口述整理为结构化反思 |
| `research-proposal-helper` | 课题申报书辅助 | 生成申报书章节框架 |

---

## 3. 与 skillhub 在线 Skills 的共存设计

### 3.1 Skills 来源架构

```
WPX Skills 系统
│
├── 内置 Skills（随应用打包）
│   ├── 通用 Skills（续写、改写、翻译等）
│   └── 教师专用 Skills（16款）
│
└── skillhub 在线 Skills（从 skillhub.proclaw.cc 获取）
    ├── 更多免费 Skills
    └── 未来社区贡献的 Skills
```

### 3.2 优先级与去重

- **内置优先**：若内置 Skill 与 skillhub 中某 Skill ID 相同，以内置版本为准（内置版本随应用更新而更新）。
- **在线补充**：skillhub 中的新 Skills 自动追加到列表，不覆盖内置。
- **禁用状态同步**：用户对内置 Skill 的启用/禁用状态本地存储，重启后保持。

### 3.3 Skills 数据文件结构

内置 Skills 数据存储在 `src/data/built-in-skills.js`，包含所有内置 Skills 的元数据和 Prompt 模板。应用启动时，先加载内置 Skills，再从 skillhub 获取在线 Skills 并合并。

每个 Skill 的数据格式：
```javascript
{
  id: 'lesson-plan-generator',           // 唯一ID
  name: '教案生成器',                     // 中文名称
  description: '根据课题和教材版本...',    // 简要描述
  icon: 'book-open',                     // 图标名称（lucide图标集）
  category: 'education',                 // 分类：education
  subcategory: 'teaching-prep',          // 子分类：teaching-prep / quiz / grading / communication / growth
  requiresAuth: false,                   // 是否需要登录
  builtIn: true,                         // 是否为内置Skill
  promptTemplate: '你是一位...',          // Prompt模板
  inputSchema: {                         // 用户输入字段定义
    subject: '学科',
    topic: '课题',
    ...
  }
}
```

---

## 4. Skills 管理页面适配

### 4.1 分类展示

在 Skills 设置页面（`SkillsSettings.vue`），筛选标签扩展为：

```
[全部] [写作] [编辑] [知识] [🎓 教师专用]
```

选择“教师专用”后，按子分类分组显示：
- 📚 教学准备（4个）
- 📝 出题与测评（4个）
- ✍️ 批改与反馈（3个）
- 💬 沟通与管理（3个）
- 🌱 个人成长（2个）

### 4.2 Skill 卡片增强

每个 Skill 卡片显示：
- 图标、名称、简介
- 来源标签：内置 Skill 显示“内置”徽章，在线 Skill 显示“skillhub”徽章
- 启用/禁用开关
- 点击卡片可展开查看 Prompt 模板预览和使用示例

---

## 5. AI 对话中的 Skill 调用

### 5.1 触发方式

教师在 AI 对话窗中：
- **直接说需求**：“帮我写一份人教版七年级数学第三章的教案”
  - AI 自动识别意图，匹配 `lesson-plan-generator` Skill，按 Prompt 模板生成内容。
- **手动指定 Skill**：“用教案生成器，课题是光合作用”
  - 如果用户明确说出 Skill 名称，优先匹配该 Skill。

### 5.2 上下文注入

调用内置 Skill 时，System Prompt 中自动注入：
- 当前选中的文本（如果有）
- 用户的自定义输入字段值（由前端从对话中解析或弹出简易表单收集）
- 教师的 Agent 偏好（语气、专业领域等）

### 5.3 结果处理

AI 返回内容后：
- 直接插入编辑器光标位置。
- 如果是教案、发言稿等长文档，自动用一级标题格式化。
- 如果是试题，自动识别题型并用表格或列表排版。

---

## 6. 本地化与离线能力

- 所有内置 Skills 的 Prompt 模板存储在本地 JS 文件中。
- Skills 调用完全在本地完成 Prompt 组装，仅在使用 AI 模型时才联网。
- 即使 skillhub 不可用，教师专用 Skills 仍然可用。
- 内置 Skills 随 WPX 版本更新而更新（新版本覆盖旧版本）。

---

## 7. 技术实现要点

### 7.1 内置 Skills 数据模块

- 创建 `src/data/built-in-skills.js`，导出包含所有内置 Skills 的数组。
- 与通用 Skills（`src/data/skills.js`）区分，或合并导出。
- Skills 加载逻辑：`[...builtInSkills, ...onlineSkills]`，根据 ID 去重。

### 7.2 Prompt 模板引擎

- 创建 `src/composables/useSkillExecutor.js`。
- 接收 Skill ID 和用户输入，返回组装好的完整 Prompt。
- 支持模板变量替换：`{subject}` → 用户输入的实际学科。

### 7.3 AI 对话中的 Skill 路由

- 在 `useAiChat.js` 中增加 Skill 匹配逻辑：
  - 用户消息先经过快速意图识别（关键词匹配 + 可选轻量分类器）。
  - 命中 Skill 后，从 Skill 库中取 Prompt 模板，填充变量，组装为完整消息发送给大模型。

### 7.4 简易表单收集参数

- 当 Skill 需要多个输入参数时（如“教案生成器”需要学科、课题、年级），AI 对话窗自动弹出简易表单。
- 表单字段由 Skill 的 `inputSchema` 定义动态生成。
- 用户填写后，表单关闭，参数注入 Prompt，发送请求。

---

## 8. 验收标准

1. 安装 WPX 后，Skills 管理页面默认包含 16 款教师专用 Skills，无需下载。 ✅
2. 每个教师 Skill 卡片显示“内置”徽章，与在线 Skills 区分。 ✅
3. 分类筛选“教师专用”，按子分类正确分组显示。 ✅
4. 教师可在 Skills 管理中启用/禁用任意内置 Skill。 ✅
5. 在 AI 对话中说“生成一份教案”，AI 自动匹配教案生成器并生成结构化教案。 ✅
6. 手动说“用智能出题”，AI 调用出题 Skill，弹出简易表单收集参数后生成试题。 ✅
7. 断网情况下，内置 Skills 仍可使用（前提是配置了可用的 AI 模型）。 ✅
8. 内置 Skill 的禁用状态重启后保持。 ✅

---