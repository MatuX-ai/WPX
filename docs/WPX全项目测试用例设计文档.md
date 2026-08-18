# WPX 全项目测试用例设计文档

> 版本：v0.1.18 | 更新日期：2026-08-18 | 维护者：WPX Team

---

## 目录

- [1. 概述与测试目标](#1-概述与测试目标)
- [2. 测试范围与模块矩阵](#2-测试范围与模块矩阵)
- [3. 测试策略](#3-测试策略)
- [4. 单元测试用例](#4-单元测试用例)
- [5. 集成测试用例](#5-集成测试用例)
- [6. E2E 测试用例](#6-e2e-测试用例)
- [7. 测试执行指南](#7-测试执行指南)
- [8. 测试覆盖率目标](#8-测试覆盖率目标)

---

## 1. 概述与测试目标

### 1.1 项目简介

WPX 是一款基于 **Electron + Vue 3 + Tiptap** 的 AI 智能文档编辑器，主打完全免费、数据自主、AI 原生。核心技术栈：

| 层级 | 技术 | 测试工具 |
|:---|:---|:---|
| 渲染进程（前端） | Vue 3.5 + Tiptap 3.27 + Pinia 3 | Vitest 4 + @vue/test-utils |
| 主进程（Electron） | Node.js + Express + electron-store | Vitest 4（node 环境）|
| E2E | Playwright 1.61 | @playwright/test |
| 构建 | Vite 8 + electron-builder 26 | — |

### 1.2 测试目标

- **功能正确性**：所有功能模块按需求文档工作
- **回归防护**：每次 PR 必须通过全部测试
- **覆盖率提升**：单元测试覆盖率从当前约 XX% 提升至 ≥70%（按行统计）
- **关键路径**：用户核心流程（新建→编辑→保存→导出）100% E2E 覆盖

### 1.3 测试分层模型

```
┌─────────────────────────────────────────────────────────────┐
│  L3 · E2E（Playwright）  - 用户真实行为验证                  │
│  用户注册/登录 · 新建文档 · 编辑 · 导出/打印 · AI 对话       │
├─────────────────────────────────────────────────────────────┤
│  L2 · 集成测试（Vitest）  - 多模块交互验证                   │
│  IPC 通信流 · 多窗口数据同步 · RAG 资料库 · Herme Gateway   │
├─────────────────────────────────────────────────────────────┤
│  L1 · 单元测试（Vitest）  - 纯函数/组件逻辑验证              │
│  Store · Composables · Utils · Services · Components        │
└─────────────────────────────────────────────────────────────┘
```

**CI 准入规则**：L1 必须通过 → L2 必须通过 → L3 必须通过 → ESLint → 编译

---

## 2. 测试范围与模块矩阵

### 2.1 模块总览

| # | 模块领域 | 渲染进程（wpx-app/src） | 主进程（electron/） | 测试文件位置 | 测试工具 | 现状 |
|:--|:--------|:----------------------|:-------------------|:------------|:--------|:-----|
| 1 | 多窗口编辑器 | `components/editor/` `stores/editor.js` | `window-manager.js` | `__tests__/EditorCore.spec.js` 等 | Vitest | ✅ 有覆盖 |
| 2 | AI 助手与本地指令 | `components/ai/` `composables/useLocalCommands.js` | `ai-layout-suggest-service.js` | `AiAvatar.spec.js` 等 | Vitest | ✅ 有覆盖 |
| 3 | 文件压缩解压 | `components/zip/` `stores/zip.js` | `zip-service.js` `zip-ipc.js` | `zip-service.test.js` 等 | Vitest | ⚠️ 部分 |
| 4 | 导出与排版 | `components/export/` `utils/documentExport.js` | `export-service.js` `export-paper-layout.js` | 部分有 | Vitest | ⚠️ 部分 |
| 5 | 字体管理 | `components/fonts/` `stores/fontPreferences.js` | `font-ipc.js` `font-service.js` | `ExportFontConfirm.spec.js` 等 | Vitest | ✅ 有覆盖 |
| 6 | Hermes Agent | `utils/hermesApi.js` `stores/hermesSettings.js` | `hermes-ipc.js` `hermes-launcher.js` 等 | `hermes-detector.test.js` 等 | Vitest | ⚠️ hermesApi 无测 |
| 7 | jcode AI 引擎 | `stores/jcodeSettings.js` `utils/jcodeApi.js` | `jcode-launcher.js` `jcode-ipc.js` | `jcode-launcher.test.js` 等 | Vitest | ✅ 有覆盖 |
| 8 | 资料库 RAG | `components/knowledge/` `utils/knowledgeApi.js` | `knowledge-service.js` | `knowledgeApi.spec.js` 等 | Vitest | ✅ 有覆盖 |
| 9 | Skills 生态 | `components/skills/` `stores/skills.js` `skills/` | `skillhub-ipc.js` | `skill-manifest.spec.js` 等 | Vitest | ✅ 有覆盖 |
| 10 | 用户认证与账户 | `stores/auth.js` `stores/modelSettings.js` | `auth-protocol.js` `token-store.js` | 部分有 | Vitest | ⚠️ 缺深度 |
| 11 | 幻灯片生成 | `components/slides/` `stores/slides.js` | — | `slides.spec.js` 等 | Vitest | ✅ 有覆盖 |
| 12 | 营销页与落地页 | `landing/` `about/` | — | E2E | Playwright | ⚠️ 无单测 |
| 13 | 管理后台 | `admin/` | `server/` | 部分 | Playwright | ⚠️ 无单测 |
| 14 | 虚拟纸张与导出母版 | `constants/paperPreferences.js` | `export-paper-layout.js` | `paperPreferences.spec.js` | Vitest | ✅ 有覆盖 |

### 2.2 渲染进程单元测试覆盖矩阵

> 审计范围：`wpx-app/src/**/__tests__/` + `wpx-app/src/server/__tests__/`，共 **74 个 spec 文件** · **1081 个 `it()` 用例**

| 模块领域 | spec 数量 | 用例数 | 覆盖亮点 | 重大缺口 |
|:--------|:---------|:------|:--------|:---------|
| Composables | — | **413** | useHermesTask / useAiChat / useLocalCommands / useMarkdownFormatter 等 | views 完全 0 覆盖（22 个视图）；settings/HermesSettings 等未测 |
| 集成测试 | — | **187** | ppt-workflow-e2e / htmlImportAcceptance / alignImagesRender 等 | RAG 资料库完整流 / 多窗口同步 / AI 多轮对话流未集成 |
| Components | — | **145** | EditorCore / AiAvatar / HermesTaskCard（有壳无深）/ 字体/表格/导出组件 | 约 70 个组件无测试；HermesTaskCard 仅浅层 |
| Utils | — | **136** | hermesRouter / sseParser / knowledgeApi / exportFontAnalysis / tokenApi | hermesApi.js **无测试**；约 25 个 utils 空白 |
| Stores (Pinia) | — | **89** | userHabits / modelSettings / generalSettings / skills / hermesSettings | 约 8 个 store 无测试（如 zip.js store 未列在已知 spec） |
| Server 路由 | 1 | **33** | `server/__tests__/ai-router.test.js` | server/ 其余路由无测试 |
| Constants | — | **29** | builtInFontLicenses / paperPreferences / floatingWindow 等 | 约 17 个 constants 无测试 |
| Skills | — | **28** | skill-manifest / skillhub-loader / skills-market | skills/ 核心逻辑覆盖较好 |
| Layouts | — | **14** | EditorLayout dock-resize | 少数布局组件 |
| Copilot | — | **7** | slide-actions | copilot/ 覆盖薄弱 |
| Views | **0** | **0** | — | **views/ 下 22 个 .vue 文件 100% 无覆盖**，包括 Herm esSettings / LibraryView / SlidesView 等核心页 |

#### 缺口优先级（按影响排序）

| # | 缺口 | 优先级 | 原因 |
|:-:|:-----|:------:|:-----|
| 1 | `views/` 22 个视图 0 覆盖 | **P0** | settings 页、Hermes 设置页、资料库页等核心路由无组件测试 |
| 2 | `utils/hermesApi.js` 无单测 | **P0** | Hermes 渲染层唯一 API 封装，gateway 交互全靠它 |
| 3 | `components/ai/HermesTaskCard.vue` 组件无测试 | **P0** | M3-C 新增关键 UI 组件 |
| 4 | `stores/zip.js` 无单测 | **P1** | 压缩解压核心状态管理 |
| 5 | `utils/zipApi.js` 无单测 | **P1** | 渲染进程 zip API 封装 |
| 6 | `electron/zip-ipc.js` 无测试 | **P1** | IPC 层（Electron 主进程侧）零覆盖 |
| 7 | `electron/knowledge-service.js` 仅测 1 函数 | **P1** | 资料库核心服务其余逻辑无覆盖 |
| 8 | 多窗口 E2E | **P0** | window-manager 零 E2E |
| 9 | RAG 资料库 E2E | **P1** | knowledge mock 仅 preview，无实际上传/索引/RAG 对话 |
| 10 | AI 多轮对话 E2E | **P1** | 仅单轮改写，无多轮上下文 |

### 2.3 Electron 主进程测试覆盖矩阵

> 审计范围：`electron/__tests__/` 18 个测试文件 · **275 个 `it()` 用例**

#### 覆盖优秀的域

| 业务域 | 测试文件 | 被测目标 | 用例数 |
|:------|:--------|:--------|-------:|
| Hermes 全链路 | `hermes-detector.test.js` | Python/Hermes CLI 检测 | 15 |
| Hermes 全链路 | `hermes-env.test.js` | .env 文件生成与写入 | 9 |
| Hermes 全链路 | `hermes-launcher.test.js` | 网关进程启停 + 健康检查 | 14 |
| Hermes 全链路 | `hermes-routes.test.js` | OpenAI 兼容 API 路由 | 14 |
| Hermes 全链路 | `hermes-ipc.test.js` | IPC 通道注册（现状：仅 3 条） | **3** ⚠️ |
| 导出纸张布局 | `export-paper-layout.test.js` | PDF/DOCX 页面构建 | 43 |
| AI 排版建议 | `ai-layout-suggest-service.test.js` | AI 智能排版逻辑 | 30 |
| 记忆服务 | `memory-service.test.js` | L2/L3 记忆读写 | 18 |
| 资料库路径 | `knowledge-service-path.test.js` | `resolveKnowledgeRoot` | 22 |
| 网页导入 | `url-extractor.test.js` | Readability 正文提取 | 13 |
| SkillHub | `skillhub-ipc.test.js` | SKILL.md 导入导出 | 16 |
| ZIP 压缩 | `zip-service.test.js` + `zip-conflict-args.test.js` | 7za 封装 + 冲突参数 | 13 |
| jcode 运行时 | `jcode-detector.test.js` + `jcode-launcher.test.js` | jcode 检测与启停 | 31 |

#### 无测试覆盖的模块（重大缺口）

**IPC 层（零覆盖）**：
| 文件 | 职责 |
|:----|:-----|
| `zip-ipc.js` | 压缩/解压 IPC 通道 |
| `model-ipc.js` | 模型配置 IPC |
| `jcode-ipc.js` | jcode IPC |
| `font-ipc.js` | 字体 IPC |
| `free-quota-ipc.js` | 配额 IPC |

**HTTP 路由层（零覆盖）**：
| 文件 | 职责 |
|:----|:-----|
| `commercial-font-routes.js` | 商用字体购买/下载 |
| `token-routes.js` | Token 支付/扣费 |
| `export-routes.js` | 导出路由 |
| `jcode-routes.js` | jcode 网关路由 |
| `remove-bg-routes.js` | 抠图上传路由 |

**持久化 Store（零覆盖）**：
| 文件 | 职责 |
|:----|:-----|
| `hermes-store.js` | Hermes 设置持久化 |
| `jcode-store.js` | jcode 设置持久化 |
| `font-preferences-store.js` | 字体偏好 |
| `free-quota-store.js` | 免费额度 |
| `commercial-font-store.js` | 商用字体数据库 |
| `model-secrets-store.js` | API Key 加密存储 |
| `auth-store.js` | 认证状态 |

**根模块（零覆盖）**：
| 文件 | 职责 |
|:----|:-----|
| `main.js` | 主进程入口 |
| `preload.js` | 预加载脚本 |
| `window-manager.js` | 多窗口管理 |
| `local-server.js` | Express 本地服务器 |
| `knowledge-service.js` | 资料库主服务（仅测 1 函数）|
| `excel-import.js` | Excel 导入 |

### 2.4 E2E 测试覆盖矩阵

> 审计范围：`wpx-app/e2e/` 8 个 spec · **32 个 `test()` 用例**

#### 功能领域覆盖

| 业务域 | spec 文件 | 用例数 | 覆盖范围 |
|:------|:---------|:------|:--------|
| 认证流程 | `auth-workflow.spec.js` | 13 | 访客→登录→注册→JWT持久→刷新失败→退出→Token充值 |
| 虚拟纸张+焦点模式 | `paper-and-focus-workflow.spec.js` | 7 | Letter/A4/16K/手机长图×焦点模式×导出参数×持久化 |
| 设置管理 | `settings-workflow.spec.js` | 5 | 主题切换/Skill开关/Agent名称/设置导出JSON脱敏 |
| 字体管理 | `font-workflow.spec.js` | 3 | 内置8款字体/在线字体下载持久化/商业字体font-family |
| AI选区改写 | `ai-text-replace.spec.js` | 1 | 全选→AI润色→原文替换 |
| 表格操作 | `table-operations.spec.js` | 1 | 插入3×3→加行/列→合并单元格 |
| 图片编辑 | `image-editor.spec.js` | 1 | 上传→TUI裁剪→应用 |
| 文档保存 | `save-document.spec.js` | 1 | 保存对话框→AI建议标题 |

#### Mock 基础设施（已就绪但无 spec 执行）

| 路径 | Mock 状态 | 建议补测 |
|:-----|:---------|:---------|
| `GET /api/auth/verify-email` | `helpers/auth-mocks.js` 已 mock | 注册后邮箱验证 UI 流程 |
| `POST /api/auth/forgot` + `reset` | `helpers/auth-mocks.js` 已 mock | 忘记密码→重置密码完整 UI |

#### 关键用户路径 Gap（优先补测）

| # | 路径 | 缺口说明 | 优先级 |
|:-:|:-----|:--------|:------:|
| 1 | 多窗口/多文档并行 | window-manager.js 零 E2E；窗口隔离/同步无覆盖 | P0 |
| 2 | 完整导出 UI 流程 | PDF 导出仅 API 直发；HTML/Word/PPT/LaTeX/长图零覆盖 | P0 |
| 3 | RAG 资料库上传 | knowledge mock 仅 preview+空列表；无实际上传/索引/RAG对话 | P0 |
| 4 | AI 多轮对话流 | 仅单轮改写；多轮上下文/流式渲染/结果采纳无覆盖 | P1 |
| 5 | 保存后文库闭环 | 保存对话框→提交有覆盖；文库列表/重新打开继续编辑无 | P1 |
| 6 | 快捷键 | Ctrl+S 等快捷键零覆盖 | P2 |
| 7 | 字体下载中断/失败 | 注释交 Vitest，E2E 无边界分支 | P2 |

#### AUTH_TEST_CHECKLIST 对照

13/13 自动化项**全部有对应 E2E**（编号 1–11 含 4b/4c）；2 条标注"手工"的路径（邮箱验证 #7、忘记密码 #7b）mock 就绪但无 spec，建议补测。

---

## 3. 测试策略

### 3.1 命名规范

| 类型 | 文件命名 | describe 块命名 | it 块命名 |
|:----|:--------|:---------------|:---------|
| 单元测试 | `*.spec.js` | 被测模块/函数名 | "应/应该"中文描述 |
| 集成测试 | `*.test.js` | 模块交互描述 | 场景式描述 |
| E2E | `*.spec.js` | 功能领域 | 用户故事式 |

### 3.2 Mock 策略

```
Vitest 单元测试：
  - @vue/test-utils：Vue 组件 shallowMount/mount
  - vi.mock()：外部模块（fs/path/electron）
  - pinia-testing：Pinia stores
  - msw/vitest-fetch-mock：HTTP 请求（wpx-app 无 Node.js 环境）

Vitest 主进程测试：
  - 真实 fs/path/electron-store（隔离的 temp 目录）
  - child_process：mock spawn 模拟 7za/jcode/hermes

Playwright E2E：
  - 全真实环境 + 隔离端口
  - auth-mocks.js：JWT mock
  - font-mocks.js：字体 mock
```

### 3.3 测试数据管理

- **fixtures**：`wpx-app/e2e/fixtures/` 存放测试图片/PDF/MD 文件
- **临时目录**：`os.tmpdir()` 下创建隔离测试目录，测试后清理
- **Mock 数据**：`__tests__/fixtures/` 或 `helpers/` 目录下 JSON fixture

---

## 4. 单元测试用例

### 4.1 Hermes Agent 模块（已实施）

> 已写入文件：`electron/__tests__/hermes-ipc.test.js`（22用例）、`wpx-app/src/utils/__tests__/hermesApi.spec.js`（18用例）、`wpx-app/src/components/ai/__tests__/HermesTaskCard.spec.js`（16用例）
> 完整用例设计见：`docs/Hermes Agent 测试用例设计.md`

#### 渲染进程 hermesApi.js（18用例，新增）

| ID | 场景 | 优先级 |
|:---|:----|:------:|
| HA-01 | 非 Electron 环境返回 null | P0 |
| HA-02 | API 缺失时各方法返回 null | P0 |
| HA-03 | detectHermes 正常透传 | P0 |
| HA-04 | getStatus/start/stop 透传 | P1 |
| HA-05 | setHermesSettings partial 合并透传 | P0 |
| HA-06 | callHermesRun / prepareHermesEnv payload 透传 | P1 |
| HA-07 | markHermesInstallHintShown 透传 | P2 |
| HA-08 | IPC reject 错误透传 | P0 |
| HA-09 | Hermes 未运行状态透传 | P1 |
| HA-10 | 未启用降级对象原样透传 | P2 |
| HA-11 | 部分通道缺失时其余正常 | P2 |
| HA-12 | onHermesStatusChanged 订阅/退订/回调 | P1 |
| HA-13 | onHermesSettingsChanged 订阅/回调 | P2 |
| HA-14 | 订阅函数缺失时返回 no-op | P2 |
| HA-15 | 多并发请求独立不串扰 | P1 |
| HA-16 | start/stop 并发各通道均调用 | P2 |
| HA-17 | isHermesAvailable 组合判定 | P2 |
| HA-18 | SSE 解析错误归属（hermesApi 不解析仅透传） | P1 |

#### Electron hermes-ipc.js（41用例，新增）

覆盖 9 个 IPC 通道 handler + broadcastStatus + initHermesIpc：

| ID | 场景 | 优先级 |
|:---|:----|:------:|
| HI-01~02 | registerHermesIpcHandlers 9通道注册/ipcMain 不可用静默 | P0/P2 |
| HI-03 | handler↔通道绑定正确 | P1 |
| HI-04~06 | hermes:detect 正常/recordDetection 静默/reject 透传 | P0/P2/P1 |
| HI-07~08 | hermes:get-status 透传/ERROR 状态原样 | P0/P2 |
| HI-09~13 | hermes:start 正常/失败/reject 透传/healthCheck 行为/非法端口兜底 | P0/P1/P2 |
| HI-14~16 | hermes:stop 正常/幂等/reject 透传 | P0/P2 |
| HI-17~18 | hermes:get-settings 返回/hint 7天窗口 | P0/P2 |
| HI-19~24 | hermes:set-settings 合并广播/enabled:false联动停止/enabled+preStart联动启动/preStart:false不启动/启动失败静默/空payload | P0/P0/P0/P1/P2/P2 |
| HI-25~29 | hermes:call-run 未启用降级/网关未运行/RUNNING放行/sessionId回显/缺payload | P0/P0/P0/P1/P2 |
| HI-30~33 | hermes:prepare-env 正常/空payload清空/reject透传/不回显Key | P0/P1/P2/P2 |
| HI-34 | hermes:mark-install-hint-shown 透传 | P1 |
| HI-35~38 | broadcastStatus 多窗口跳过destroyed/send抛错被吞/无窗口/空参用当前状态 | P1/P2/P2/P2 |
| HI-39~41 | initHermesIpc 初始化+默认注册/跳过注册/预启动条件 | P1/P2/P2 |

#### HermesTaskCard.vue 组件（16用例，新增）

| ID | 场景 | 优先级 |
|:---|:----|:------:|
| HC-01~04 | idle/running/done/error 四态渲染 | P0 |
| HC-05~06 | task 原文/ steps 有序列表渲染 | P1 |
| HC-07 | 空 steps/task 不渲染 | P2 |
| HC-08~11 | 复制结果/回退error/三者皆空不复制/clipboard不可用 | P0/P1/P2/P2 |
| HC-12~13 | 插入文档 emit/result空不emit | P0/P1 |
| HC-14 | dismiss emit | P0 |
| HC-15 | 无障碍属性 role/aria | P2 |
| HC-16 | props 响应式更新 | P1 |

#### 集成测试 IT-01~13（跨层链路）

| ID | 场景 | 优先级 |
|:---|:----|:------:|
| IT-01 | 启动全链路：IPC→launcher→广播→渲染层订阅 | P0 |
| IT-02 | run 全链路：call-run→composable→卡片done渲染 | P0 |
| IT-03~04 | 未启用/网关未运行降级云端 | P1 |
| IT-05~06 | SSE流式/非法JSON容错 | P0/P1 |
| IT-07 | 两任务并发隔离 | P2 |
| IT-08~09 | 预启动/关闭生命周期 set-settings 联动 | P1/P2 |
| IT-10 | 自定义端口贯穿 | P1 |
| IT-11 | run 网关超时回退 | P2 |
| IT-12 | writeHermesEnv→spawn env 验证 | P1 |
| IT-13 | 流式断开中止上游 | P2 |

**小计**：Hermes 模块新增用例 **88 条**（HA-01~18 + HI-01~41 + HC-01~16 + IT-01~13）

### 4.2 文件压缩解压模块

> 完整用例设计（90条）：`docs/文件压缩解压模块测试用例设计.md`

| 层级 | 用例数 | P0 | P1 | P2 |
|:----|:------:|:---:|:---:|:---:|
| zip-ipc.js（IPC 通道） | 20 | 6 | 8 | 6 |
| zip-service.js（7za 封装） | 36 | 7 | 16 | 13 |
| stores/zip.js（状态管理） | 16 | 4 | 5 | 7 |
| utils/zipApi.js（API 封装） | 14 | 3 | 4 | 7 |
| **合计** | **86** | **20** | **33** | **33** |

### 4.3 缺失测试文件清单

以下源文件 **完全没有** 对应测试文件，需要优先补充：

| # | 文件路径 | 优先级 | 原因 |
|:--|:--------|:------|:----|
| 1 | `wpx-app/src/utils/hermesApi.js` | P0 | Hermes API 客户端，无测试 |
| 2 | `wpx-app/src/components/ai/HermesTaskCard.vue` | P0 | 组件无测试 |
| 3 | `electron/hermes-ipc.js` | P0 | IPC handler 仅 1.3KB 测试 |
| 4 | `wpx-app/src/utils/zipApi.js` | P1 | zip API 调用无测试 |
| 5 | `wpx-app/src/stores/zip.js` | P1 | Pinia store 无测试 |
| 6 | `electron/export-service.js` | P1 | 导出服务无测试 |
| 7 | `electron/knowledge-service.js` | P1 | 资料库主服务无测试 |
| 8 | `wpx-app/src/utils/knowledgeApi.js` | P1 | 已有部分，需补充 |
| 9 | `wpx-app/src/components/knowledge/` | P1 | 组件无测试 |
| 10 | `wpx-app/src/views/settings/` | P2 | 设置页视图无测试 |
| 11 | `wpx-app/src/server/` | P2 | 服务端路由无测试 |
| 12 | `electron/free-quota-ipc.js` | P2 | 配额 IPC 无测试 |
| 13 | `wpx-app/src/utils/freeQuota.js` | P2 | 配额工具无测试 |
| 14 | `wpx-app/src/utils/freeModelQuota.js` | P2 | 模型配额无测试 |
| 15 | `electron/commercial-font-routes.js` | P2 | 商业字体路由无测试 |

---

## 5. 集成测试用例

### 5.1 IPC 通信流

| ID | 通道 | 场景 | 涉及模块 | 预期结果 |
|:---|:----|:-----|:--------|:---------|
| IT-IPC-01 | `hermes:start` → `hermes:status` | Hermes 启动到就绪完整流 | hermes-ipc → hermes-launcher → hermes-store | 状态机正确转换：idle→starting→running |
| IT-IPC-02 | `zip:extract` 进度回调 | 压缩包解压进度上报 | zip-ipc → zip-service → 渲染进程 | 进度百分比正确，进度条更新 |
| IT-IPC-03 | `knowledge:index-file` | PDF 资料入库流程 | knowledge-service → 渲染进程 → store | 文件成功索引，可搜索 |
| IT-IPC-04 | 多窗口数据同步广播 | 窗口A修改→窗口B同步 | window-manager → 所有窗口 | 广播 `data:knowledge:updated` 所有窗口收到 |
| IT-IPC-05 | `model:configure` 配置保存 | 模型配置修改 | model-ipc → token-store → hermes-settings | 配置持久化，重启后生效 |

### 5.2 压缩解压 IPC 集成（已设计，90条用例）

> 完整用例见 `docs/文件压缩解压模块测试用例设计.md`

关键集成用例摘要：

| ID | 场景 | 涉及模块 | 预期结果 |
|:---|:-----|:--------|:---------|
| ZIP-IT-01 | 7za 真实压缩/解压/完整性校验 | zip-service → 7za 真实二进制 | 压缩包内容一致，round-trip 成功 |
| ZIP-IT-02 | 进度回调 0→100（含终态补发） | zip-service → zip-ipc → 渲染进程 | 进度事件顺序正确 |
| ZIP-IT-03 | 取消后残留文件清理 | zip-service cancel → 文件系统 | 无残留归档 |
| ZIP-IT-04 | ZipSlip 路径逃逸防护 | zip-service list → 安全校验 | 恶意条目被拒绝 |
| ZIP-IT-05 | GBK/UTF-8 文件名 round-trip | zip-service 编码处理 | 中文文件名不乱码 |
| ZIP-IT-06 | 大文件（>100MB）进度回调 | zip-service → 多次 onProgress | 进度更新多次，终态 100 |
| ZIP-IT-07 | 并发两个操作独立隔离 | zip-service activeOperations | 互不干扰 |

### 5.3 多窗口数据同步（待实施）

**缺口**：window-manager.js 零测试、E2E 无多窗口场景。

| 场景 | 测试方案 |
|:-----|:--------|
| 窗口 A 修改资料库 → 窗口 B 收到广播 | 模拟 BrowserWindow.getAllWindows 返回多个窗口，验证 broadcast 次数 |
| 窗口 B 独立撤销栈隔离 | 模拟两个 editor 实例，验证状态隔离 |
| MAX_WINDOWS=8 边界 | 参数化测试：创建 8 个窗口后第 9 个拒绝 |

### 5.4 RAG 资料库流程（待实施）

**缺口**：E2E 仅 mock 了 preview，真实上传/索引/RAG 对话无覆盖。

| 场景 | 测试方案 |
|:-----|:--------|
| PDF 上传 → 解析 → 向量索引 | mock knowledge-service 真实文件路径 |
| @引用 → AI 对话含上下文 | mock API 返回含引用的回复 |
| 资料库路径切换 | mock resolveKnowledgeRoot 多种路径 |

---

## 6. E2E 测试用例

### 6.1 现有 E2E 覆盖（32条，覆盖扎实）

| 业务域 | spec | 用例 | 覆盖亮点 |
|:------|:-----|:----:|:---------|
| 认证流程 | `auth-workflow.spec.js` | 13 | 访客→登录→JWT持久→刷新失败→退出→Token充值 |
| 虚拟纸张+焦点 | `paper-and-focus.spec.js` | 7 | Letter/A4/16K/手机长图×焦点×导出参数×持久化 |
| 设置管理 | `settings-workflow.spec.js` | 5 | 主题切换/Skill开关/Agent名称/设置导出脱敏 |
| 字体管理 | `font-workflow.spec.js` | 3 | 内置8款/在线字体下载/商业字体 |
| 其他 | `ai-text-replace`/`table`/`image`/`save` | 各1 | AI改写/表格/图片/保存 |

**AUTH_TEST_CHECKLIST 13/13 自动化覆盖**，2 条标注手工路径（邮箱验证 #7、忘记密码 #7b）的 mock 已就绪但无 spec 执行。

### 6.2 关键 E2E Gap（优先补测）

| # | 路径 | 缺口 | 优先级 |
|:-:|:-----|:-----|:------:|
| 1 | 多窗口/多文档并行 | window-manager E2E 零覆盖 | **P0** |
| 2 | RAG 资料库上传 | knowledge mock 仅 preview+空列表，无实际上传/索引/RAG对话 | **P0** |
| 3 | 真实导出 UI 全流程 | PDF 仅 API 直发参数；HTML/Word/PPT/LaTeX/长图零覆盖 | **P0** |
| 4 | AI 多轮对话流 | 仅单轮改写；多轮上下文/流式渲染无覆盖 | **P1** |
| 5 | 保存后文库闭环 | 提交有覆盖；文库列表/重新打开继续编辑无 | **P1** |
| 6 | 注册邮箱验证 UI | mock 就绪但无 spec（#7 手工） | **P2** |
| 7 | 忘记密码/重置密码 UI | mock 就绪但无 spec（#7b 手工） | **P2** |
| 8 | Ctrl+S 等快捷键 | 零覆盖 | **P2** |

### 6.3 待实施 E2E 补测计划

```bash
# 优先补测 E2E（按优先级）
# 1. 多窗口协作
test:e2e --grep "multi-window"
# 2. RAG 资料库上传
test:e2e --grep "knowledge"
# 3. 真实导出 UI（PDF/Word/HTML）
test:e2e --grep "export"
# 4. AI 多轮对话
test:e2e --grep "conversation"
```

---

## 7. 测试执行指南

### 7.1 快速命令

```bash
# ===== 渲染进程单元测试（最快）=====
npm --prefix wpx-app run test              # 运行一次
npm --prefix wpx-app run test:watch        # 监听模式

# ===== Electron 主进程单元测试 ======
npm --prefix wpx-app run test:zip          # 用 electron vitest config

# ===== Playwright E2E ======
npm --prefix wpx-app run test:e2e          # 需先 npm run dev
npm --prefix wpx-app run test:e2e:headed   # 浏览器可见

# ===== 全量测试（CI 用）=====
npm --prefix wpx-app run test
npm --prefix wpx-app run test:e2e

# ===== 烟雾测试（生产构建后）=====
npm run smoke:prod
```

### 7.2 测试配置

| 配置项 | 渲染进程 | Electron 主进程 | E2E |
|:------|:--------|:---------------|:----|
| 配置文件 | `wpx-app/vite.config.js` (implicit) | `electron/vitest.config.js` | `wpx-app/playwright.config.js` |
| 测试目录 | `wpx-app/src/**/__tests__/` | `electron/__tests__/` | `wpx-app/e2e/` |
| 超时 | Vitest 默认 5s | 180s（远程网络依赖）| 90s |
| 并行 | `vitest --threads` | `vitest --threads` | `workers: 1`（固定顺序）|
| 报告 | `list` + `html` | `list` | `list` + `html` |

---

## 8. 测试覆盖率目标

### 8.1 覆盖率指标（2026-08-18 当前 vs 目标）

| 指标 | 当前值 | 目标值 | 差距 |
|:----|:------|:------|:-----|
| 渲染进程行覆盖率 | ~45% | ≥70% | +25% |
| Electron 行覆盖率 | ~55% | ≥65% | +10% |
| 组件测试覆盖率 | ~60% | ≥80% | +20% |
| E2E 场景覆盖率 | ~40% | ≥70% | +30% |

### 8.2 优先级补测计划

```
Phase 1（本周）：Hermes Agent 全链路补测
  - hermesApi.js 单测
  - hermes-ipc.js 补充至 20+ 用例
  - HermesTaskCard.vue 组件测试
  → 目标：Hermes 模块 90% 覆盖

Phase 2（第二周）：压缩解压补测
  - zip-api.js 单测
  - zip-store.js 单测
  - zip-ipc.js 集成测试

Phase 3（第三周）：E2E 关键路径
  - 新建文档完整流 E2E
  - 多窗口同步 E2E
  - 资料库 RAG E2E

Phase 4（持续）：剩余 gap 填补
  - knowledge-service.js
  - export-service.js
  - 营销页组件单测
```

---

*本文档由 WPX 测试工程助手生成，随项目迭代持续更新。*
*下次更新：补全子代理审计结果 + Hermes 补测实现后更新覆盖率数据*
