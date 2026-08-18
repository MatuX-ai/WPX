# WPX Hermes Agent 技术集成设计文档

> **版本**：v0.11（Phase 1/2 + M3 + M4 打磨）
> **状态**：Phase 1（M1 + M1.5）+ Phase 2（M2 + M2.1）+ M3（A/B/C）+ **M4 打磨已落地**（SSE 流式任务执行、网关健康轮询就绪、流中断开中止、启动前自动注入 Key）；三平台验证（macOS/Linux）因本环境仅 Windows 记为遗留
> **变更记录**：v0.11 — M4 打磨完成（sseParser + runHermesTaskStream 流式执行与回退、hermes-launcher healthCheck 就绪轮询、hermes-routes stream 客户端断开中止上游、HermesSettings 启动前自动注入 Key）；v0.10 — Hermes 自动路由完成；v0.9 — M3-C 任务型 UI 完成；v0.8 — M3-B 实机验证完成；v0.7 — M3-A 代码骨架完成；v0.6 — M3 预研完成；v0.5 — M2.1 完成；v0.4 — M2 完成；v0.3 — M1.5 完成；v0.2 — M1 完成
> **关联文档**：[PRD](WPX-AI智能文档编辑器%20-%20产品需求文档%20(PRD).md) · [AI 助手 V1](AI助手-V1-需求文档.md) · [本地指令系统](WPX%20AI%20本地指令系统需求文档.md) · [jcode 集成](WPX%20集成%20jcode%20高性能%20AI%20引擎需求文档.md) · [多窗口架构设计](WPX%20多窗口独立编辑器架构设计.md) · [Gateway 预研报告](Hermes%20Agent%20Gateway%20预研报告.md)
> **外部参考**：[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)（Apache-2.0）

---

## 1. 背景与目标

### 1.1 背景

WPX 的 AI 助理目前是「**两层 AI 架构**」：本地指令层（56 条正则，毫秒级、零 Token）兜底，未命中时进入 LLM 层（`useAiChat.js` → 用户配置的 OpenAI 兼容模型），并以 **Skills 体系**（教师 16 + 大学生 16 + SkillHub 在线追加）、**CopilotKit Runtime**（PPT 四步法）、**jcode 本地引擎**（复杂任务）、**RAG 资料库**与 **lowdb 记忆**为扩展。

[Hermes Agent](https://github.com/nousresearch/hermes-agent)（Nous Research，开源，Apache-2.0）是当前社区热门的「自进化」自主智能体：**SKILL.md 技能标准**、**四层记忆**、**学习循环**、**工具调用纪律**、**Python 库 / Gateway 两种嵌入形态**。其能力域（开放式自主任务）与 WPX 现有体系高度互补，且其技术模式可被 WPX 的 JS 体系直接借鉴。

本设计文档回答三个问题：

1. **借鉴什么**：把 Hermes 的哪些技术模式移植进 WPX 现有架构（低成本、零运行时依赖）。
2. **接入什么**：在什么条件下把 Hermes Agent 本体作为本地 sidecar 接入（中等成本、可选外挂）。
3. **不做什么**：为什么不把 Hermes 完整内嵌进 Electron 安装包。

### 1.2 目标

- **P0**：引入 `SKILL.md` 技能标准，打通「WPX 技能 ⇄ Hermes 技能」双向转换与订阅，直接复用现有 `useSkillExecutor` 调度。
- **P1**：按 Hermes 四层记忆设计重构 `electron/memory-service.js`，补齐情景记忆与学习循环。
- **P2**：以 jcode 范式实现 Hermes Gateway sidecar（`/api/hermes` 路由 + 因需唤醒 + 透明降级），桌面端可选启用。
- **贯穿**：所有新增能力必须保持 WPX 现有原则——本地优先、数据自主、透明降级、不破坏流式对话体验。

### 1.3 非目标

- ❌ 不把 Python 解释器 + Hermes 依赖打入默认安装包。
- ❌ 不替换现有 `@ai-sdk/vue` 流式对话链路作为默认通道。
- ❌ 不引入 Hermes 独有的模型（Hermes 4）作为硬性依赖（用户可自选接入）。
- ❌ 不在 Web 版（Vercel）启用 Hermes sidecar（仅桌面端本地能力）。

---

## 2. Hermes Agent 技术剖析（外部参考）

> 以下信息基于公开仓库与文档，集成实施前须锁定上游版本（建议 git tag 固定）并复核。

### 2.1 定位与许可

- 定位：**自进化单体智能体**（"The agent that grows with you"）——通过对话与工具执行积累经验，反哺记忆与技能。
- 许可：[Apache-2.0](https://github.com/NousResearch/Hermes-Agent/blob/main/LICENSE)，可自由商用（保留 NOTICE/版权声明即可），与 WPX 的 UNLICENSED 私有项目不冲突。
- 语言：Python（`pyproject.toml`，需 Python 3.10+，具体以锁定版本为准）。

### 2.2 核心机制

| 机制 | 说明 | 对 WPX 的借鉴价值 |
|:---|:---|:---|
| **SKILL.md 技能标准** | 技能即 Markdown 文件：YAML frontmatter（`name` / `description` / `allowed-tools` / `model` 等）+ 正文指令；仓库内已有 166 个技能（87 内置 + 79 可选）分 26+ 类，支持在线技能库订阅 | ⭐⭐⭐⭐⭐ 与 WPX 现有 Skills 高度同构 |
| **四层记忆** | 工作记忆 → 情景记忆 → 语义记忆（向量检索）→ 程序性记忆（技能/程序化知识），层层沉淀 | ⭐⭐⭐⭐ WPX 现有记忆只覆盖「习惯/模板」 |
| **学习循环** | 任务结束后评估 → 提炼可复用知识写入记忆/技能 → 后续任务自动调用 | ⭐⭐⭐⭐ 自进化核心 |
| **工具调用纪律** | 结构化输出、工具自恢复、失败归因（减少无效循环） | ⭐⭐⭐ 可落地为 ToolLoopAgent 的指令约束 |
| **Provider 插件** | 多模型 provider 插件化，支持 OpenAI 兼容端点（DeepSeek 等） | ⭐⭐⭐ 可复用 WPX 用户自备 Key |
| **Gateway** | `gateway/run.py` 本地服务形态，已有第三方桌面壳通过 OpenAI 兼容 HTTP API 接入 | ⭐⭐⭐ sidecar 接入点 |

### 2.3 运行形态（对 WPX 的影响）

| 形态 | 说明 | 对 WPX 的可行性 |
|:---|:---|:---|
| CLI（`run_agent.py`） | 终端交互 | 不适合直接嵌入 |
| **Python 库** | 官方文档支持 `import` 方式在宿主 Python 进程内创建/运行 Agent | 需要宿主 Python 进程 |
| **Gateway** | 本地 HTTP 服务，进程外接入 | ✅ 与 jcode 的「本地服务 + 路由 + 降级」范式完全一致 |

### 2.4 关键约束（集成前必须知晓）

1. **运行时错配**：Hermes 是 Python 生态；WPX 是 Node/Electron。桌面端附带 Python 运行时 ≈ 数百 MB，只能作为**可选外挂**（同 jcode），不能默认内置。
2. **模型要求**：Hermes 的自主循环需要较强推理模型（推荐 Hermes 4 或同级）；它支持 OpenAI 兼容端点，**可复用 WPX 用户已配置的 DeepSeek/GLM/Qwen/Ollama**。
3. **流式语义**：Hermes 多轮工具调用为「任务型」输出，非逐 token 对话流；接入时需区分「对话型（流式）」与「任务型（进度 + 结果）」两种 UI。
4. **与 jcode 定位重叠**：两者都面向「复杂/自主任务」，需明确分工（见 §9 分工矩阵）。

---

## 3. WPX 现有 AI 助理架构盘点（代码级）

### 3.1 链路总览

```
用户输入
  │
  ├─[第一层] useLocalCommands（56 条正则，离线，毫秒级）──命中→ 本地执行 ✅
  │
  ├─[第二层] useAiChat.sendMessage()
  │     ├─ jcode 路由探针（tryJcodeRoute，仅桌面端·复杂任务·不阻塞）
  │     ├─ Skills 显式/隐式匹配（parseSkillCommand / matchSkillByIntent）
  │     │     └─ 命中 → executeSkill 组装 promptTemplate → 进 LLM
  │     └─ 普通对话 → Chat.sendMessage → ToolLoopAgent → 用户配置的模型
  │
  └─[并行] CopilotKit Runtime（:3006 /api/ck，PPT 四步法 8 actions，AG-UI）
```

### 3.2 关键文件与职责

| 文件 | 职责 | 与本设计的关系 |
|:---|:---|:---|
| `wpx-app/src/composables/useAiChat.js` | `@ai-sdk/vue` Chat + `ToolLoopAgent` + `DirectChatTransport` 封装；Skill 调度；jcode 路由探针 | Hermes 接入的入口挂载点 |
| `wpx-app/src/composables/useLocalCommands.js` | 56 条本地指令 | 不变 |
| `wpx-app/src/composables/useSkillExecutor.js` | Skill 意图匹配（`scoreMatch`）、`{变量}` 提取、表单、外部 SkillHub 注册（`registerExternalSkills`） | Phase 1 核心改造点 |
| `wpx-app/src/data/built-in-skills.js` / `teacher-skills.js` / `college-skills.js` | `TeacherSkillDefinition`：`{ id, name, description, icon, category, subcategory, requiresAuth, builtIn, promptTemplate, inputSchema }` | Phase 1 转换源 |
| `wpx-app/src/server/copilotkit-runtime.js` | 本地 Express（:3006），`/api/ck` 多路由模式，`BuiltInAgent` 动态换模型（`x-wpx-llm-*` 头） | Phase 3 的兄弟服务（可共用一个 local-server） |
| `wpx-app/src/server/ai-router.js` | `shouldUseJcode`（模式+长度路由）、`routeTask`（jcode 调用 + 透明降级） | Phase 3 扩展点（新增 hermes 路由） |
| `electron/jcode-ipc.js` + `electron/services/jcode-{detector,launcher,store}.js` | jcode 生命周期：探测 → 启动 → 状态广播 → 停止 → 记忆备份 | Phase 3 的范式模板（hermes-ipc 仿写） |
| `electron/memory-service.js` | lowdb：按文档类型统计格式习惯、saves（上限 200）、自动模板 | Phase 2 改造对象 |
| `electron/preload.js` | `window.electronAPI.*` 命名空间，IPC 通道 `域:动作` | 新增 `hermes.*` / `memory` 扩展 |

### 3.3 现有扩展点（复用而非重造）

1. **SkillHub 外部注册**：`useSkillExecutor.registerExternalSkills()` 已支持在线追加技能 → Phase 1 只需把「Hermes 技能源」也走该通道。
2. **local-server 模式**：`copilotkit-runtime.js` / `ai-router.js` 已确立「本地 loopback HTTP + 前端 fetch + 失败透明降级」范式 → Phase 3 完全复用。
3. **jcode 生命周期**：探测/启动/停止/状态广播/记忆备份的 IPC 全套模式 → Phase 3 照搬为 `hermes:*`。
4. **动态换模型**：CopilotKit 通过 `x-wpx-llm-*` 请求头切换模型 → Phase 3 的 Hermes Gateway 采用同款机制。

---

## 4. 集成策略总览

### 4.1 三条路径

| 路径 | 内容 | 运行时依赖 | 成本 | 风险 | 推荐度 |
|:---|:---|:---|:---:|:---|:---:|
| **A. 借鉴技术模式** | 移植 SKILL.md 标准、四层记忆设计、学习循环、工具纪律到 WPX JS 体系 | 无 | 低 | 低 | ⭐⭐⭐⭐⭐ |
| **B. Hermes Gateway sidecar** | 照 jcode 范式，桌面端按需启动 Hermes Gateway（Python），`ai-router` 新增 `/api/hermes` 路由 | 需用户机器有 Python（可选） | 中 | 中（体积/跨平台/流式） | ⭐⭐⭐ |
| **C. 完整内嵌** | Python 运行时打入安装包，替换默认 AI 链路 | 打包进安装包 | 高 | 高 | ⭐（不推荐） |

### 4.2 总体架构演进图（目标态）

```
┌────────────────────────────── 桌面端 (Electron) ─────────────────────────────┐
│  渲染进程 (Vue 3)                                                            │
│    AiChatWindow ── useAiChat.js ───────────────────────────┐                │
│      ├─ useLocalCommands（56 条本地指令）                    │                │
│      ├─ useSkillExecutor（含 SKILL.md 兼容层 · Phase 1）     │                │
│      │     ├─ WPX 内置 Skills（TeacherSkillDefinition）      │                │
│      │     ├─ SkillHub 外部技能（含 Hermes 技能源）           │                │
│      │     └─ skill-manifest 转换器（双向）                  │                │
│      └─ Chat.sendMessage → ToolLoopAgent → 用户配置模型（流式）│                │
│              │                                              │                │
│  主进程 (Node)                                               │                │
│    memory-service.js（四层记忆 · Phase 2）                    │                │
│    hermes-ipc.js（Phase 3）◄─探测/启动/停止/状态广播            │                │
│    local-server（loopback）                                  │                │
│      ├─ :3006 copilotkit-runtime（/api/ck · 现状）            │                │
│      ├─ :3xxx ai-router 扩展（/api/hermes · Phase 3）         │                │
│      └─ :3xxx jcode 适配层（/api/jcode · 现状）               │                │
└──────────────┬───────────────────────────────────────────────┘               │
               │
     ┌─────────┴───────────┬──────────────────┬───────────────┐
     ▼                     ▼                  ▼               ▼
  用户配置的 LLM       jcode (Rust, 可选)   Hermes Gateway   CopilotKit
  (DeepSeek/GLM/...)    确定性工作流        (Python, 可选)   PPT 四步法
                                          开放式自主任务
```

---

## 5. Phase 1：SKILL.md 技能标准兼容（P0，推荐先行）

### 5.1 目标

- 让 WPX 的 Skills 体系可以**读、写、订阅** `SKILL.md` 标准技能，而无需运行任何 Python 代码。
- 用户可在「设置 → Skills」中一键订阅 Hermes 技能库（或任何 SKILL.md 仓库），技能经转换后进入现有调度链路。

### 5.2 SKILL.md 规范（采用子集）

以 [Hermes Agent 创建技能文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/creating-skills.md) 为准，WPX 兼容层支持以下 frontmatter 子集（实施时锁定上游版本）：

```markdown
---
name: lesson-plan-generator          # 技能 ID（kebab-case）
description: 根据课题和教材版本生成结构化教案
allowed-tools: []                    # 可选：允许的工具白名单（WPX 暂不强制）
model:                               # 可选：建议模型（WPX 忽略，沿用用户当前模型）
---

# 教案生成器

<正文：任务指令，可含 {变量} 占位符，与 WPX 现有 promptTemplate 语义一致>
```

> **注意**：上游 SKILL.md 的正文是「给 Agent 的指令」，而 WPX 的 `promptTemplate` 是「给 LLM 的系统提示」。转换器必须做语义映射：SKILL.md 正文 → WPX `promptTemplate`（保留 `{变量}` 语法，二者天然兼容）。

### 5.3 双向转换器设计

#### 5.3.1 WPX → SKILL.md（导出）

新增 `wpx-app/src/skills/skill-manifest.js`：

```js
/**
 * 将 TeacherSkillDefinition 序列化为 SKILL.md 文本
 * @param {import('@/data/teacher-skills').TeacherSkillDefinition} skill
 * @returns {string} SKILL.md 文本
 */
export function skillToSkillMd(skill) { /* ... */ }

/**
 * 批量导出：BUILT_IN_SKILLS → SKILL.md 文件（供发布到 SkillHub / 归档）
 * @returns {Array<{ id: string, content: string }>}
 */
export function exportAllSkillsToSkillMd() { /* ... */ }
```

字段映射：

| TeacherSkillDefinition | SKILL.md | 说明 |
|:---|:---|:---|
| `id` | `name` | kebab-case 直接复用 |
| `name` | 正文 `# 标题` | 展示名 |
| `description` | `description` | 用于意图匹配与索引 |
| `category` / `subcategory` | 目录结构 | 导出为 `skills/<category>/<subcategory>/<id>/SKILL.md` |
| `promptTemplate` | 正文 | 原样保留 `{变量}` |
| `inputSchema` | 正文附「参数说明」区块 | 转为 YAML 注释或附加 section（供双向还原） |

#### 5.3.2 SKILL.md → WPX（导入）

```js
/**
 * 解析 SKILL.md 文本 → TeacherSkillDefinition
 * @param {string} skillMd
 * @returns {import('@/data/teacher-skills').TeacherSkillDefinition}
 */
export function skillMdToSkill(skillMd) { /* ... */ }

/**
 * 解析技能库目录（含多级 SKILL.md）→ 注册到 useSkillExecutor
 * @param {string} baseUrl 或本地目录
 */
export async function loadSkillHubFromManifest(source) { /* ... */ }
```

关键点：

- frontmatter 解析用轻量 YAML 子集解析器（**不引入新依赖**，`gray-matter` 可评估；默认手写 30 行解析器即可，frontmatter 仅 4-6 个标量字段）。
- 正文中 `{变量}` 提取复用 `useSkillExecutor.extractVars` 的正则；`inputSchema` 若缺失，由变量列表自动生成默认表单（type: text）。
- **校验**：导入失败（缺 `name`/`description`/正文）→ 记入 `importErrors` 列表并在 UI 展示，不阻塞其余技能导入。

### 5.4 SkillHub 订阅 Hermes 技能库

沿用 `registerExternalSkills` 通道，新增一个**预置源**：

```js
export const HERMES_SKILL_SOURCES = [
  {
    id: 'hermes-official',
    name: 'Hermes Agent 官方技能库（166 技能）',
    kind: 'github',            // github | local | url
    ref: 'NousResearch/hermes-agent',
    path: 'skills/**/SKILL.md',// 递归匹配
    // 拉取策略：gh 目录树 API 或 raw 文件逐一下载（不引入 SDK，用 fetch）
  },
]
```

- **安装方式**：用户勾选订阅 → `loadSkillHubFromManifest` 拉取 → 转换 → `registerExternalSkills(skills)` → 走现有启用/禁用 UI。
- **失败降级**：网络不可用 / 仓库结构变更 → 保留上次成功缓存的快照（存 `userData/skillhub-cache/`），并 toast 提示。
- **许可标注**：来自 Hermes 的技能在卡片上标注「来源：Hermes（Apache-2.0）」，符合许可证要求。

### 5.5 数据模型

```js
// 转换器统一中间格式（两端桥接）
const SkillManifest = {
  id: string,            // kebab-case
  name: string,          // 展示名
  description: string,
  icon: string,          // Lucide 名（SKILL.md 无此字段时给默认值）
  category: string,      // education | college | general | hermes
  subcategory: string,
  builtIn: false,
  promptTemplate: string,
  inputSchema: Record<string, { label, type, placeholder?, default? }>,
  source: 'skillhub' | 'hermes',
  license: 'Apache-2.0' | null,
}
```

### 5.6 接口设计

> **M1.5 已实现（2026-04）**：`electron/skillhub-ipc.js` 注册 `skillhub:export` 与 `skillhub:import-file`
> 两个主进程通道，preload 暴露 `window.electronAPI.skillhub.*`；渲染进程 `useSkillHub` 在 Electron 下走 IPC
> （导出→保存对话框/选目录、导入→打开对话框），Web 下回退浏览器下载与文件输入。
> 缓存采用 localStorage（`wpx-skillhub-cache-<sourceId>`，Electron 分区存储即 userData 目录）。

IPC 通道（`electron/preload.js` 的 `window.electronAPI.skillhub.*`）：

| 通道 | 入参 | 出参 | 说明 |
|:---|:---|:---|:---|
| `skillhub:export` | `{ files: [{ id, name, category, subcategory, content }] }` | 单文件：`{ ok, path }`；多文件：`{ ok, dir, written, paths }`；取消：`{ ok:false, canceled:true }` | 单文件→保存对话框；多文件→选目录后按 `skills/<category>/<subcategory>/<id>/SKILL.md` 写入（片段净化防越界） |
| `skillhub:import-file` | — | `{ ok, path, name, content }` | 打开对话框选择本地 SKILL.md 并读取 |

### 5.7 UI 变更

- 「设置 → Skills」新增「技能市场 / SkillHub」Tab：列出预置源（含 Hermes 官方库），显示 已订阅 / 可用技能数 / 上次同步时间。
- 技能卡片新增来源徽标（WPX 内置 / SkillHub / Hermes）。
- 导入错误面板（可折叠），展示 `errors[]`。

### 5.8 验收标准（M1 实现状态）

- [x] 内置 32+ 教师/大学生技能可一键导出为标准 SKILL.md，且重新导入后行为等价（`promptTemplate`、`inputSchema`、意图匹配一致）——**全量 32 份往返无损，已测试**。
- [x] 订阅 Hermes 官方技能库后，技能可成功转换并出现在 Skills 列表，可启用、可通过 `parseSkillCommand` / `matchSkillByIntent` 触发——**转换器与加载器已测试；实网订阅需在应用内验证**。
- [x] 无 `inputSchema` 的 SKILL.md 能导入并自动生成默认表单——**已测试（含 `{变量:默认值}` 生成 default）**。
- [x] 断网时订阅失败 → 使用上次缓存，UI 有明确提示——**已测试（fromCache 路径）**。
- [x] 新增单元测试：`skill-manifest.spec.js`（17 用例）+ `skillhub-loader.spec.js`（11 用例）+ `skills-market.spec.js`（7 用例）——**35/35 通过；全量回归 1044/1048（4 个无关用例为并行负载偶发超时，单独重跑通过）**。
- [x] 不新增任何运行时依赖（纯手写 YAML 子集解析器 + fetch）。

> M1 交付文件：`wpx-app/src/skills/skill-manifest.js`（转换器）、`wpx-app/src/skills/skillhub-loader.js`（加载器 + 缓存）、
> `wpx-app/src/composables/useSkillHub.js`（composable）、`wpx-app/src/stores/skills.js`（`marketSkills` + `mergeExternalSkills`）、
> `wpx-app/src/views/settings/SkillsSettings.vue`（技能市场 Tab）。
>
> M1.5 交付文件：`electron/skillhub-ipc.js`（`skillhub:export` / `skillhub:import-file`）、`electron/__tests__/skillhub-ipc.test.js`（16 例）、
> `electron/preload.js`（`window.electronAPI.skillhub.*`）、`electron/main.js`（注册接线）、`useSkillHub` 新增 `exportToDisk` / `importSkillFile`。

---

## 6. Phase 2：四层记忆体系（P1）

### 6.1 目标

把 `electron/memory-service.js` 从「习惯统计 + 自动模板」升级为 Hermes 风格的四层记忆，并加入学习循环——**全部本地存储，不上传**。

### 6.2 四层模型（映射到 WPX）

| 层 | Hermes 概念 | WPX 落点 | 存储 |
|:---|:---|:---|:---|
| L1 工作记忆 | 当前对话上下文 | 现有 AI 对话历史（多窗口独立） | 内存 + `userData/chats/` |
| L2 情景记忆 | 可回溯的「发生过什么」 | 新增 `episodes`：任务摘要 + 结果 + 用户反馈 | `memory.json`（lowdb） |
| L3 语义记忆 | 可检索的事实/偏好 | 现有「资料库 RAG」（Chroma）+ 新增「偏好事实」条目 | Chroma + lowdb |
| L4 程序性记忆 | 会做某事的技能 | 现有 Skills 体系（Phase 1 后含 SKILL.md） | `skills/` + SkillHub 缓存 |

### 6.3 memory-service.js 改造

`createDefaultState()` 扩展（**M2 已实现**，v1 → v2 无损迁移：保留 saves/统计/模板，补齐新字段默认值）：

```js
function createDefaultState() {
  return {
    version: 2,                       // 从 1 迁移
    byDocumentType: { _default: createEmptyStats() },
    saves: [],
    templates: [],
    templatesUpdatedAt: null,
    // ── 新增（Phase 2，已实现） ──
    episodes: [],                     // L2 情景记忆，上限 500，LRU 淘汰
    facts: {},                        // L3 语义记忆（key → { value, scope, updatedAt }）
    learning: {
      enabled: true,
      minEpisodesBeforeLearn: 5,      // 学习循环触发阈值
      minIntervalHours: 24,           // 学习最小间隔
      lastLearnAt: null,
      learnedTemplates: [],           // 学习生成的模板 ID
    },
  }
}
```

> **实现偏差**：① `facts` 采用对象映射（设计稿为数组，映射便于 O(1) get/set）；
> ② 学习触发用 **15 分钟低频定时器 + 手动 IPC** 替代"空闲检测"（避免 powerMonitor 复杂度）；
> ③ 学习生成模板的文档类型最少出现次数放宽为 2（saves 路径仍为 3）。均已在本节与验收中标注。

新增 IPC（延续 `memory:` 前缀，**M2 已实现**并暴露到 preload `window.electronAPI.memory.*`）：

| 通道 | 入参 | 出参 |
|:---|:---|:---|
| `memory:episode:record` | `{ task, summary?, outcome?, feedback?, documentType?, format? }` | `{ success, episode }` |
| `memory:episode:list` | `{ limit?, offset? }` | `Episode[]`（最新在前） |
| `memory:fact:set` | `{ key, value, scope? }` | `{ success, key }` |
| `memory:fact:get` | `key` | `{ key, value, scope, updatedAt } \| null` |
| `memory:fact:list` | — | `Array<{ key, value, scope, updatedAt }>` |
| `memory:learn:run` | `{ force? }` | `{ ok, reason?, facts[], generated, templates }` |
| `memory:learn:settings` | `partial?`（有参=更新，无参=查询） | `LearningSettings` |
| `memory:learn:status` | — | `{ enabled, episodeCount, factCount, lastLearnAt, learnedTemplates, eligible, reason }` |

### 6.4 学习循环（借鉴 Hermes）

触发：每记录 `minEpisodesBeforeLearn` 条情景记忆，且距上次学习超过阈值（默认 24h），在**空闲时**（主进程 `powerMonitor` 空闲 / 窗口失焦）后台执行：

1. **归因**：汇总近期 episodes，提取「任务类型 × 成功/失败 × 用户反馈」分布。
2. **提炼**：对高频成功模式，把用户偏好（字体/结构/篇幅）沉淀为 `facts`。
3. **产出**：复用现有模板生成逻辑（`memory-service.js` 的模板代码），生成「专属模板」写入 `learnedTemplates`（沿用 `DEFAULT_TEMPLATE_LIMIT` 上限，用户可一键采纳/丢弃）。
4. **回写**：生成的模板立即进入 `templates` 并在「资料库 → 智能模板」展示，广播 `data:templates:updated`。

> **M2 已实现**：`runLearning()` 完成 归因（按 docType 聚合成功 episode）→ 提炼（`preferred-format[:docType]` facts，scope='learned'）→
> 产出（`buildLearnedTemplates`，文档类型出现 ≥2 次）→ 回写（`mergeTemplates` 同类型不覆盖、广播）。
> 触发方式为 **15 分钟低频定时器（`startLearningScheduler`）+ 手动 IPC `memory:learn:run`**（实现偏差：以定时器替代空闲检测）。
> 阈值 / 间隔 / 开关均通过 `memory:learn:settings` 可调；`force:true` 可跳过全部检查。

### 6.5 隐私边界（数据主权原则）

- 所有记忆数据仅存 `userData`（`memory.json` / `userData/chats/`），**不随账户同步、不上传**（与现有资料库策略一致）。
- 学习循环只分析**格式与结构偏好**（字体/标题/篇幅/模板骨架），**不读取文档正文内容**用于学习；正文仅在用户主动 @ 引用时进入对话上下文。
- 「设置 → 隐私」新增开关：记忆学习（默认开）、情景记忆记录（默认开）、一键清空全部记忆（复用 `memory:clear`）。
  > **M2.1 已实现**：设置页「数据与隐私」新增「AI 记忆」区块（仅桌面端显示）——
  > 「记录情景记忆（AI 对话后自动记录）」与「记忆学习（自动生成专属模板）」两个开关、
  > 「立即学习」按钮（`runLearning({ force:true })`）与记忆状态摘要（episode/fact/learnedTemplates 计数）。
  > `useAiChat` 在每次对话成功（onFinish）后自动记录 episode（task=用户输入、summary=助手回复、outcome=success），
  > 受 `recordEpisodes` 开关控制（设置读取带 30s 缓存），失败静默不影响对话。

### 6.6 验收标准（M2 实现状态）

- [x] 版本迁移：v1 → v2 无损（saves/统计保留，新字段默认值补齐）——**已测试（17 例主进程单测）**。
- [x] 四层各有独立存储与查询接口，L2/L3 有上限与淘汰策略（episodes ≤ 500）——**episodes LRU 上限 500 已测试**。
- [x] 学习循环可触发（定时器 + 手动 IPC）；产出模板可采纳/丢弃，采纳后进入现有模板链路——**runLearning 生成模板 + 合并 + 广播已测试**。
- [x] 学习循环不读取文档正文（只分析 episode 结构化字段）——**代码评审 + 设计约束，episode 仅含摘要/结果/反馈/格式**。
- [x] 单元测试：`memory-service.test.js` 覆盖 episode 记录、事实读写、学习触发阈值、间隔、force、LRU 淘汰、迁移——**17/17 通过**。
- [x] 顺带修复：`zip-service` 大文件压缩进度偶发不收敛（7za 终态 100% 竞态）→ `run7za` close 成功时补发终态 100%。

> M2 交付文件：`electron/memory-service.js`（四层记忆 + 学习循环 + v1→v2 迁移 + 12 个 IPC 通道）、
> `electron/__tests__/memory-service.test.js`（17 例）、`electron/preload.js`（`window.electronAPI.memory.*` 扩展）。
> 渲染进程侧「AI 对话完成后自动记录 episode」的接线可作为后续小迭代（M2.1）接入 `useAiChat`。

---

## 7. Phase 3：Hermes Gateway sidecar（P2，可选）

### 7.1 目标与定位

- **定位**：与 jcode 并列的「本地可选 AI 引擎」，面向**开放式自主任务**（多步调研、跨工具编排、需要 Hermes 技能库的复杂请求）。
- **启用条件**：桌面端检测到用户机器存在 Python 3.10+ 且用户显式启用（或一键安装脚本），**不预装、不进默认安装包**。
- **原则**：`routeTask` 现有「命中 → 调用 → 失败透明降级」语义完全复用，绝不阻塞默认对话。

### 7.2 架构

```
渲染进程 useAiChat.sendMessage()
  │  tryHermesRoute(text)          // 模式探针（仿 tryJcodeRoute，fire-and-forget）
  ▼
ai-router.routeTask({ engine: 'hermes', ... })
  ▼  fetch
local-server 新增路由 /api/hermes/*（hermes-routes.js）
  ▼
hermes-ipc.js（主进程）── 探测 Python/hermes 安装 ── 启动 gateway 子进程（gateway/run.py）
  ▼
Hermes Gateway（loopback，如 :3077，OpenAI 兼容 HTTP API）
  ▼
用户配置的模型（复用 x-wpx-llm-* 头 / 配置注入）
```

### 7.3 生命周期管理（照抄 jcode 范式）

| 能力 | jcode 现有实现 | hermes 仿写 |
|:---|:---|:---|
| 探测 | `jcode:detect`（jcode-detector.js） | `hermes:detect`（hermes-detector.js：查 `python --version`、`pip show hermes-agent` 或仓库路径） |
| 启动/停止 | `jcode:start` / `jcode:stop`（launcher） | `hermes:start` / `hermes:stop`（hermes-launcher.js，spawn `gateway/run.py`，端口 3077） |
| 状态广播 | `jcode:status-changed` | `hermes:status-changed` |
| 设置 | `jcode:get/set-settings` | `hermes:get/set-settings`（含「预启动」「启用路由」） |
| 记忆备份 | `jcode:clear/backup/restore-memory` | 可选：备份 Hermes 记忆目录 |
| 安装引导 | `jcode:mark-install-hint-shown` | `hermes:mark-install-hint-shown` |

新增文件（对齐 `electron/services/` 目录约定）：

- `electron/services/hermes-detector.js`
- `electron/services/hermes-launcher.js`
- `electron/hermes-ipc.js`
- `wpx-app/src/server/hermes-routes.js`（或并入 ai-router 的本地服务）

### 7.4 ai-router 扩展

`ai-router.js` 保持「纯函数 + 透明降级」设计，新增：

```js
const HERMES_PATTERNS = [
  /自主|多步|调研|整理.*全网|对比.*方案/,
  /用 Hermes|hermes/i,
]
// shouldUseHermes(message, options)  —— 与 shouldUseJcode 并列的纯函数
// routeTask(payload, { engine: 'hermes' }) —— 同签名，url 指向 /api/hermes/run
```

**优先级**：`force → hermes 显式指令 → jcode 复杂模式 → 长度阈值 → 云端`。默认 Hermes 路由关闭（`hermes:get-settings.enableRouting = false`），用户手动开启。

### 7.5 HTTP 接口契约（WPX 侧适配层，非 Hermes 原生协议）

| 端点 | 方法 | 请求 | 响应 |
|:---|:---|:---|:---|
| `/api/hermes/health` | GET | — | `{ ok, python, gatewayPort, model }` |
| `/api/hermes/run` | POST | `{ task, sessionId, params, context, model? }` | `{ ok, engine:'hermes', data: { result, steps? } }` |
| `/api/hermes/stream` | POST (SSE) | 同上 | 事件流：`step` / `tool` / `text` / `done` / `error` |

> 适配层内部把 WPX 的 `task/sessionId/params/context` 映射为 Hermes Gateway 的请求体；**映射细节在实施阶段以锁定版本的 gateway 协议为准**（文档记录待验证项：gateway 的请求/响应 schema、是否原生支持流式、模型如何注入）。

### 7.6 安全设计

- Gateway 只绑定 `127.0.0.1`（对齐「不要绑定 0.0.0.0」的开发约束）。
- 模型 API Key 不落盘到 Hermes 配置：每次请求由 WPX 主进程解密（复用 `models:api-key:get-decrypted`）后**经请求头/环境变量注入**，Hermes 侧不持久化。
- 请求校验：仅接受来自 WPX 进程的请求（校验 `localServerUrl` 来源 + 可选随机 token，对齐 jcode 现有做法）。

### 7.7 模型接入

- 复用用户「设置 → 我的模型」当前生效配置（`modelSettingsStore.effectiveTextConfig`），通过请求头 `x-wpx-llm-*` 透传（与 CopilotKit 同款机制）。
- 可选：在「我的模型」列表中允许把 **Hermes 4** 作为普通 OpenAI 兼容模型添加（若用户有对应 API），用于 Phase 3 之前先行体验 Hermes 系模型能力。

### 7.8 流式与 UI 适配

- AI 对话窗新增「任务型」消息形态（区别于流式文本）：显示 `steps[]` 步骤进度（如「① 检索资料 → ② 交叉验证 → ③ 生成结论」）、工具调用徽标、最终结果卡片；结果可一键「插入文档」。
- 触发方式：显式指令（「用 Hermes 调研…」）或用户开启自动路由；**默认对话仍是现有流式链路**。

### 7.9 验收标准（M3/M4 实现状态）

- [x] 在装有 Python 的机器上：`hermes:detect` → `hermes:start`（healthCheck 就绪轮询）→ `/api/hermes/health` 全通——**本环境 Python 3.12.7 + hermes-agent 0.19.0 实机验证通过**（预研报告 §5.1）；未装 Python 时状态 `missing_python`，UI 给出安装引导，不影响其他功能。
- [x] `shouldUseHermes` 纯函数单测覆盖：显式指令、复杂模式、长度、优先级、关闭开关——**ai-router 33 例含 hermes 用例；hermesRouter 13 例**。
- [x] 强制走 Hermes 的任务在 gateway 不可用时返回 `{ ok:false, fallbackReason:'hermes_unavailable' }`，前端透明回退云端——**useAiChat 自动路由 4 例 + hermes-routes 单测**。
- [x] SSE 流：`runHermesTaskStream` 逐块渲染任务卡片（打字机效果），失败自动回退非流式；中断/超时（60s 默认）不卡死——**sseParser 9 例 + useHermesTask 流式 3 例**。
- [x] API Key 不出主进程、不落 Hermes 配置——**hermes:prepare-env 仅写本地 HERMES_HOME/.env（白名单 + 原子写 + 不回显），hermes-env 9 例**。
- [x] 新增测试：`ai-router` hermes 路由单测 + `hermes-routes` 冒烟（mock gateway）——**electron 全量 285 + wpx-app 相关 47**。

---

## 8. 能力分工矩阵（目标态）

| 请求类型 | 归属 | 触发方式 | 响应形态 |
|:---|:---|:---|:---|
| 删除/加粗/字体切换等确定性操作 | 本地指令层（56 条） | 自动（正则） | 本地执行，毫秒级 |
| 润色/翻译/总结/自由对话 | LLM 层（流式） | 自动 | 流式文本 |
| 教案/出题/评语/论文大纲等结构化任务 | Skills 体系（含 SKILL.md） | 显式/意图匹配 | 表单 + Prompt → 流式 |
| PPT 四步法 | CopilotKit Runtime | 显式（PPT 助手） | 步骤 + 幻灯片 |
| 教案长文/多章节等确定性工作流 | jcode（Rust） | 模式/长度路由 | 结果文本 |
| 多步调研/开放式自主任务 | Hermes Gateway（可选） | 显式指令/用户开启路由 | 任务型步骤 + 结果卡片 |

> 分工铁律：**默认链路（本地指令 → 流式 LLM）永远可用**；jcode / Hermes 均为「因需唤醒、失败透明降级」的可选外挂。

---

## 9. 风险与合规

| 风险 | 等级 | 缓解 / 实测状态 |
|:---|:---:|:---|
| Python 运行时体积 | 中 | 可选外挂 + 安装引导，不进默认包；**实测 hermes-agent 0.19 依赖无 torch/transformers**（openai/httpx/pydantic/rich/aiohttp 等），体积可控 |
| Hermes 跨平台差异（Windows/macOS/Linux） | 中 | 检测器覆盖三平台（win `py -3` / unix `python3`）；**Windows 已实机验证**；macOS/Linux 留待多平台环境 |
| 流式体验降级 | 中 | **已实现 SSE 流式任务卡片**（打字机效果 + 失败回退非流式）；默认对话仍走云端流式 |
| Gateway 协议随版本变动 | 中 | **已锁定 0.19.0（PyPI）**；适配层隔离在 hermes-routes.js 单点（schema 集中校准） |
| 学习循环隐私争议 | 低 | 只学格式不读正文；默认关闭可一键清空 |
| Apache-2.0 合规 | 低 | 保留 NOTICE/版权；UI 标注技能来源 |
| 与 jcode 重复建设 | 低 | §8 分工矩阵 + 路由优先级（jcode=确定性工作流，Hermes=开放式自主任务） |

---

## 10. 里程碑与工作量估算

| 里程碑 | 内容 | 预估工作量 | 依赖 |
|:---|:---|:---:|:---|
| M1（Phase 1） | SKILL.md 双向转换器 + SkillHub 订阅 Hermes 库 + UI | ~~3-5 人日~~ ✅ 已完成 | 无 |
| M1.5 | Electron IPC（`skillhub:*` 通道、导出保存对话框、本地文件导入） | ~~1-2 人日~~ ✅ 已完成（16 主进程单测） | M1 |
| M2（Phase 2） | 四层记忆 + 学习循环 + 隐私设置 | ~~4-6 人日~~ ✅ 已完成（17 主进程单测；学习触发用定时器+手动 IPC 替代空闲检测） | M1 可选 |
| M2.1（可选） | AI 对话完成后自动记录 episode（useAiChat 接线）+ 隐私页开关 UI | ~~1-2 人日~~ ✅ 已完成（recordEpisodes 开关 + onFinish 钩子 + 隐私页「AI 记忆」区块） | M2 |
| M3 预研 | Gateway 协议预研（官方 OpenAI 兼容 API Server / 8642 / Sessions API / 鉴权 / Python 版本） | ~~1-2 人日~~ ✅ 已完成（见《Gateway 预研报告》§5 实机验证清单） | — |
| M3-A（代码骨架） | hermes-detector / launcher / store / routes（/api/hermes/*）/ ipc / ai-router `engine:'hermes'` / preload | ~~5-6 人日~~ ✅ 已完成（42 主进程单测 + ai-router 33；方式 A 直连经「自定义 Endpoint」即可用） | M3 预研 |
| M3-B（实机验证） | 安装 hermes-agent 并跑通网关（health/models/capabilities/chat/stream/sessions），校准 schema | ~~0.5-1 人日~~ ✅ 已完成（本环境 Python 3.12.7 + hermes-agent 0.19.0，启动配方见《Gateway 预研报告》§5.1；launcher 已固化 HERMES_HOME/API_SERVER_KEY/API_SERVER_PORT） | 有 Python+网络的环境 |
| M3-C（任务型 UI） | 对话窗任务型消息（步骤/结果卡片）+ Hermes 设置区块（启用/预启动/端口）+ Key 注入 HERMES_HOME/.env | ~~3-5 人日~~ ✅ 已完成（hermes:prepare-env IPC + HermesSettings + useHermesTask + HermesTaskCard + 「用 Hermes 执行」入口 + 结果插入文档） | M3-B ✅ |
| M4（打磨） | SSE 流式步骤、网关就绪确认、安全加固、三平台验证 | ~~5-8 人日~~ ✅ 主体完成（sseParser + 流式执行与回退、launcher healthCheck 就绪轮询、stream 断开中止、启动前自动注入 Key）；**三平台验证（macOS/Linux）留待多平台环境** | M3-C ✅ |

> M1/M2 与 M3 可并行；M3 的**技术预研（gateway 协议确认）应先行**，作为 M3 的 gate。

---

## 11. 附录 A：参考链接

- Hermes Agent 仓库：<https://github.com/NousResearch/hermes-agent>
- 许可（Apache-2.0）：<https://github.com/NousResearch/Hermes-Agent/blob/main/LICENSE>
- 作为 Python 库使用：<https://hermes-agent.nousresearch.com/docs/zh-Hans/guides/python-library>
- 程序化集成：<https://hermes-agent.nousresearch.com/docs/zh-Hans/developer-guide/programmatic-integration>
- 架构文档：<https://hermes-agent.nousresearch.com/docs/zh-Hans/developer-guide/architecture>
- 创建技能（SKILL.md 规范）：<https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/creating-skills.md>
- Skills 系统说明：<https://mintlify.wiki/NousResearch/hermes-agent/user-guide/features/skills>
- Gateway 入口：<https://github.com/NousResearch/hermes-agent/blob/main/gateway/run.py>
- Provider 接入（含 OpenAI 兼容）：<https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md>
- 记忆架构解析（第三方）：<https://vectorize.io/articles/hermes-agent-memory-explained>

## 附录 B：术语表

| 术语 | 含义 |
|:---|:---|
| SKILL.md | Hermes Agent 的技能文件标准（frontmatter + Markdown 指令正文） |
| 四层记忆 | 工作 / 情景 / 语义 / 程序性记忆的分层沉淀模型 |
| 学习循环 | 从任务结果中提炼可复用知识并回写记忆/技能的闭环 |
| Gateway | Hermes 的本地 HTTP 服务形态（`gateway/run.py`） |
| sidecar | 与主应用并行运行的辅助进程（本项目指 jcode / Hermes 本地引擎） |
| 透明降级 | 本地引擎不可用时静默回退到云端，用户无感知中断 |
