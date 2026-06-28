# WPX — AI 智能文档编辑器

> **完全免费 · 数据自主 · AI 原生** 的桌面 + Web 一体化文档工作站。
> Markdown / Tiptap 多窗口编辑器 · 浮动 AI 助手 · 本地指令系统 · Skills 体系 · 智能排版 · 虚拟纸张 · 内置 7za · 内置 8 款免费开源字体。

[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](#许可证)
[![Electron](https://img.shields.io/badge/Electron-42-47848F.svg)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42B883.svg)](https://vuejs.org/)
[![Tiptap](https://img.shields.io/badge/Tiptap-3.27-blue.svg)](https://tiptap.dev/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#贡献指南)

---

## 📑 目录

- [项目简介](#-项目简介)
- [核心理念与理论基础](#-核心理念与理论基础)
- [关键特性矩阵](#-关键特性矩阵)
- [快速开始](#-快速开始)
- [整体架构](#-整体架构)
- [子项目结构与职责](#-子项目结构与职责)
- [技术栈一览](#-技术栈一览)
- [配置说明](#-配置说明)
- [开发指南](#-开发指南)
- [构建与发布](#-构建与发布)
- [测试与质量保障](#-测试与质量保障)
- [部署与运维](#-部署与运维)
- [贡献指南](#-贡献指南)
- [内置字体与版权](#-内置字体与版权)
- [路线图与版本记录](#-路线图与版本记录)
- [许可证](#-许可证)
- [相关文档](#-相关文档)

---

## 🚀 项目简介

**WPX** 是一款基于 **Electron + Vue 3 + Tiptap** 的 AI 智能文档编辑器，主打「**完全免费、数据自主、AI 原生**」。编辑器在 V1.1 起转为**完全免费模式**：平台不再内置任何大模型 API、不再经营商业字体 / Token 售卖业务，工具本体永久免费，AI 能力与商业字体由用户自行接入（自备 Key / 自购授权）。

WPX 不是一个单纯的 Markdown 编辑器，而是一个「**AI 原生文档工作站**」：

- **多窗口独立编辑器**：每个文档拥有独立窗口与编辑上下文，全局共享资料库 / 模板 / 偏好（[架构设计](docs/WPX%20多窗口独立编辑器架构设计.md) · 73 项验收 100% 通过）。
- **浮动 AI 助手 + 56 条本地指令**：右下角头像一键唤起，"删除 / 加粗 / 用思源黑体" 等确定性操作毫秒级本地执行，复杂任务交给云端大模型。
- **Skills 生态**：内置 16+ 教师专用 Skills、16+ 大学生专用 Skills、通用写作 Skills；支持在线 skillhub 追加。
- **AI 智能排版引擎**：粘贴 Markdown 文本后自动识别，提供 5 种模板（一键排版）。
- **虚拟纸张 + 导出母版**：编辑时无界，导出时按 A4 / Letter / 16 开 / 手机长图自动分页排版。
- **演示文稿生成器**：四步法对话生成 HTML5 幻灯片 → 导出 PPTX / PDF / 独立网页。
- **PDF / DOCX / Markdown 互转**：基于 Pandoc 的本地导出引擎，开箱即用。
- **7za 内置压缩 / 解压**：开箱即用 7z / zip / tar / gzip，跨平台一致体验。
- **jcode 高性能 AI 引擎**（可选外挂）：复杂任务本地推理，因需唤醒、空闲休眠、自动降级。
- **8 款免费开源字体内置**：思源黑体 / 思源宋体 / 霞鹜文楷 / 阿里巴巴普惠体 / HarmonyOS Sans / JetBrains Mono / Noto Color Emoji 等，永久免费可商用。
- **资料库 RAG**：上传 PDF / Word / 网页链接，写作时 @ 引用作为上下文。
- **记忆与智能模板**：学习用户习惯，自动生成专属模板（如「标准周报」「期末评语」）。
- **自托管用户系统**（V2.1）：邮箱 + 密码 + JWT，跨设备同步偏好与 Skills 状态，文档永远本地。

> **📦 当前版本**：v1.1 · **业务模式**：完全免费
> **🪟 目标平台**：Windows / macOS / Linux

---

## 💡 核心理念与理论基础

WPX 的设计建立在五条产品哲学之上，每一条都对应到具体的实现机制与代码组织。

### 1. 数据主权：你的文档永远是你的

- **本地优先**：所有文档、资料库、记忆库、AI 对话历史默认存于 Electron `userData` 目录；不上传任何服务器。
- **格式开放**：编辑格式为标准 Markdown（底层 Tiptap JSON → MD 双向同步），随时导出，**不**被锁定。
- **API Key 隐私**：第三方大模型 API Key 使用 **Electron safeStorage / AES-256 加密**存储在本地，**从不**联网同步。
- **第三方调用透明**：推理请求直连用户配置的服务商，WPX 不代理、不缓存、不留存任何对话内容。

### 2. AI 原生：自然语言驱动的创作

- **选区改写闭环**：选中文字 → 输入指令 → AI 响应 → **自动替换**原选区（E-01 ~ E-06）。
- **流式响应**：基于 `@ai-sdk/vue` Chat + `DirectChatTransport`，首字延迟 < 2s。
- **对话 + 工具混合**：AI 助手可调用本地命令、Skills、PPT 生成、字体切换、导出等 20+ 类能力。
- **多模型并存**：用户可同时配置 DeepSeek、智谱 GLM、通义千问、Claude、Ollama 等多个模型，对话窗顶部下拉切换。

### 3. 两层 AI 架构：本地优先 + 云端兜底

WPX 不把所有操作都丢给大模型，而是**先本地、后云端**：

```
┌───────────────────────────────────────────────┐
│  第一层 · 本地指令层（Local Commands）          │
│  - 56 条正则匹配，毫秒级响应                    │
│  - 零 Token 消耗、零网络、离线可用              │
│  - 删除 / 加粗 / 字体切换 / 撤销 / 导出等       │
│  - 失败 / 条件不满足时回退到第二层              │
└────────────────────┬──────────────────────────┘
                     │ 未命中
                     ▼
┌───────────────────────────────────────────────┐
│  第二层 · AI 模型层（LLM）                      │
│  - 自由对话、Skills 调用、复杂创作              │
│  - 简单任务 → 用户配置的云端 API（DeepSeek 等） │
│  - 复杂任务 → 可选 jcode 本地引擎（PPT/教案等）│
└───────────────────────────────────────────────┘
```

这套架构的理论基础：确定性操作**不需要**语言模型推理能力，用正则匹配 + 上下文判断既快又省；只有真正需要"理解 + 推理"的指令才进 LLM。

### 4. 多窗口独立 + 全局共享

每个文档窗口是**独立编辑上下文**（独立的撤销栈、AI 对话历史、选区），但**用户身份 / 偏好 / 知识资产全局唯一**：

- 资料库、智能模板、用户偏好在主进程统一管理（`electron/knowledge-service.js` / `memory-service.js` / `user-data-service.js`）。
- 任意窗口变更 → 主进程写入存储 → 广播 `data:knowledge:updated` / `data:templates:updated` → 所有窗口实时同步。
- 窗口数限制 8 个（`WindowManager.MAX_WINDOWS`），避免内存爆炸。
- 平台行为：macOS 最后一个窗口关闭不退出，Windows 默认退出（可设置最小化到托盘）。

### 5. 完全免费的商业模式

V1.1 起，WPX 调整业务模式：

- **不收任何平台服务费 / Token 费 / 授权中转费**。
- AI 大模型调用费用由用户与服务商结算（国产大模型新用户通常有数百万 Token 免费额度）。
- 商业字体由用户自行采购合法授权后通过"导入本地字体"使用，**不**嵌入 PDF/DOCX（避免未授权分发）。
- 8 款免费开源字体**永久内置**；9 款在线免费字体按需下载。

---

## ✨ 关键特性矩阵

| 模块 | 能力 | 状态 | 文档 |
|:---|:---|:---:|:---|
| **多窗口独立编辑器** | 多文档并行、跨窗口数据共享、平台一致行为 | ✅ 73/73 验收 | [设计](docs/WPX%20多窗口独立编辑器架构设计.md) · [验收](docs/多窗口架构验收报告.md) |
| **浮动 AI 助手** | 选区改写 / 自由对话 / 多模型切换 / 未配置引导 | ✅ MVP | [AI 助手 V1](docs/AI助手-V1-需求文档.md) |
| **AI 本地指令系统** | 56 条本地指令 + 0 Token 离线执行 | ✅ | [本地指令需求](docs/WPX%20AI%20本地指令系统需求文档.md) |
| **MD 智能排版引擎** | 5 模板一键排版（通用/报告/公文/教案/论文） | ✅ | [排版引擎](docs/WPX%20MD%20智能排版引擎需求文档.md) |
| **虚拟纸张 + 导出母版** | 焦点模式 / A4/Letter/16开/手机长图 / AI 自动分页 | ✅ | [虚拟纸张](docs/WPX%20虚拟纸张与导出母版需求文档.md) |
| **AI 演示文稿生成器** | 四步法生成 HTML5 幻灯片 → 导出 PPTX/PDF/网页 | ✅ | [PPT 生成](docs/WPX%20AI%20演示文稿生成器需求文档.md) |
| **PDF / DOCX / MD 互转** | Pandoc 本地导出引擎 | ✅ | — |
| **7za 压缩 / 解压** | 7z / zip / tar / gzip / bzip2 / xz / wim | ✅ | [压缩解压](docs/WPX%20文件压缩解压缩功能需求文档.md) |
| **字体库** | 8 内置 + 9 在线免费字体 + 本地导入 | ✅ | [字体库](docs/WPX%20字体库需求文档.md) |
| **jcode 可选 AI 引擎** | 因需唤醒 / 空闲休眠 / 自动降级 | ✅ | [jcode 集成](docs/WPX%20集成%20jcode%20高性能%20AI%20引擎需求文档.md) |
| **用户中心 / 设置** | 模型配置 / 偏好 / Skills / 主题 | ✅ | [用户中心](docs/WPX%20用户中心（设置）需求文档.md) |
| **教师专用 Skills（16）** | 教案 / 出题 / 批改 / 评语 / 家长会 | ✅ | [教师 Skills](docs/WPX%20内置教师专用%20Skills%20需求文档.md) |
| **大学生专用 Skills（16）** | 论文大纲 / 错题 / 复习卡片 / 演讲稿 | ✅ | [大学生 Skills](docs/WPX%20内置大学生专用%20Skills%20需求文档.md) |
| **资料库 RAG** | PDF/Word/MD/网页解析 + @ 引用写作 | ✅ MVP | [PRD](docs/WPX-AI智能文档编辑器%20-%20产品需求文档%20(PRD).md) |
| **记忆 + 智能模板** | 习惯学习 / 自动生成模板 / 一键套用 | ✅ | [PRD](docs/WPX-AI智能文档编辑器%20-%20产品需求文档%20(PRD).md) |
| **CopilotKit Runtime** | 多 Agent / A2UI 协议 | ✅ v1.61.1 | — |
| **自托管用户系统** | prowpx.com 邮箱 + 密码 + JWT | ✅ V2.1 | [账户系统](docs/WPX%20用户注册与账户系统需求文档.md) |
| **管理后台** | 仪表盘 / 公告 / 版本 / 字体管理 / 模型配置 / 订单 / 角色 | ✅ | [管理后台](docs/WPX%20管理后台需求文档.md) |
| **营销官网** | Hero / 痛点对比 / Skills 展示 / 彩蛋 | ✅ | [营销网站](docs/WPX%20营销网站需求文档（有趣版）.md) |

---

## 🏁 快速开始

### 环境要求

| 工具 | 版本 | 说明 |
|:---|:---|:---|
| Node.js | **>= 18.0.0** | 推荐 20 LTS |
| npm | **>= 9** | 或 pnpm / yarn |
| Git | 任意 | 克隆仓库 |
| ~~Pandoc~~ | 已内置 | PDF / DOCX 导出无需额外安装（`resources/bin/pandoc/pandoc.exe`） |
| Windows | Win10+ / Server 2019+ | 构建需配置 ELECTRON_MIRROR（国内） |
| macOS | 10.15+ | Apple Silicon / Intel 均支持 |
| Linux | x64 | 需 glibc 2.31+ |

> 💡 Pandoc 3.x 已随安装包内置，docx / html 导出开箱即用；**仅** PDF 导出依赖 LaTeX 引擎（MiKTeX / TeX Live），因体积过大未集成，需用户按需安装。

### 1. 克隆仓库

```bash
git clone https://github.com/wpx-team/wpx.git
cd wpx
```

### 2. 安装依赖

WPX 是一个 monorepo，主目录 + 4 个子项目（`wpx-app` / `electron` / `admin` / `landing`） + 1 个独立服务（`server`）。

```bash
# 安装主项目（含 electron / electron-builder / sharp）
npm install --legacy-peer-deps

# 安装子项目
npm --prefix wpx-app install --legacy-peer-deps
npm --prefix admin  install --legacy-peer-deps
npm --prefix landing install --legacy-peer-deps

# 后端服务（可选，用于登录/账户/管理后台数据）
npm --prefix server install --legacy-peer-deps
```

> ⚠️ 必须使用 `--legacy-peer-deps` 处理 peer 依赖冲突（CopilotKit / Vite 8 / Tiptap 3 等较新版本存在 peer 约束）。

### 3. 启动桌面端开发

```bash
npm run electron:dev
```

该命令会同时启动：

- **Vite dev server**（`wpx-app`，端口 `5173`）
- **Electron 主进程**（等 Vite 就绪后自动启动，支持热更新）

访问 `http://localhost:5173` 可同时打开 Web 版进行调试。

> **多窗口调试**：`npm run electron:dev:multi` 启动时自动开 2 个窗口，方便验证跨窗口同步。

### 4. 启动子项目开发

```bash
# 营销官网（独立 Vite 端口 5174）
npm --prefix landing run dev

# 管理后台（独立 Vite 端口 5175）
npm --prefix admin run dev

# 后端服务（Node + Express，默认 3000）
npm --prefix server run dev
```

### 5. 首次使用引导

1. 启动后点击右下角 AI 头像 → 弹出"未配置模型"引导卡片。
2. 进入「设置 → 我的模型 → + 添加模型」。
3. 选择服务商（推荐 **DeepSeek**，注册送免费额度）或「自定义 OpenAI 兼容」。
4. 填入 API Endpoint / API Key / 模型名称 → 「测试连接」→ ✓ 保存。
5. 回到 AI 对话窗即可使用；详细国产大模型接入教程见 [`docs/WPX AI 助手帮助文档（国产大模型接入教程）.md`](docs/WPX%20AI%20助手帮助文档（国产大模型接入教程）.md)。

### 6. 下载可选字体

8 款内置字体随安装包提供（首次启动需从 `resources/fonts/built-in/` 读取）；9 款在线免费字体（站酷快乐体 / 得意黑 / 思源柔黑等）可在编辑器字体下拉框中按需下载。详见「[内置字体与版权](#-内置字体与版权)」章节。

---

## 🧭 整体架构

### 高层架构图

```
                              ┌──────────────────────────────────┐
                              │       WPX 桌面端 (Electron)        │
                              │                                   │
  ┌────────────┐  IPC + CSP  │  ┌─────────────────────────────┐   │
  │   Web 前端 │ ◄──────────►│  │  Vue 3 + Tiptap + Pinia     │   │
  │ (Vite SPA) │             │  │  - 编辑器 / 表格 / 图片      │   │
  └────────────┘             │  │  - 浮动 AI 助手             │   │
                              │  │  - 56 条本地指令             │   │
                              │  │  - Skills 系统              │   │
                              │  │  - 虚拟纸张 / 焦点模式       │   │
                              │  └────────────┬────────────────┘   │
                              │               │ IPC                │
                              │  ┌────────────▼────────────────┐   │
                              │  │  Electron 主进程 (Node)      │   │
                              │  │  - WindowManager (多窗口池)  │   │
                              │  │  - user-data / preferences   │   │
                              │  │  - knowledge / memory        │   │
                              │  │  - model / jcode IPC         │   │
                              │  │  - zip / font / export IPC   │   │
                              │  │  - 7za 内置二进制            │   │
                              │  └────────────┬────────────────┘   │
                              │               │                    │
                              │  ┌────────────▼────────────────┐   │
                              │  │  本地服务 (loopback)          │   │
                              │  │  - export-service (Pandoc)   │   │
                              │  │  - copilotkit-runtime        │   │
                              │  │  - ai-proxy-service          │   │
                              │  │  - remove-bg / knowledge    │   │
                              │  └─────────────────────────────┘   │
                              └──────────┬───────────────────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                │                        │                        │
        ┌───────▼────────┐      ┌────────▼────────┐      ┌───────▼────────┐
        │  用户配置的 LLM │      │   jcode (可选)   │      │  prowpx.com    │
        │ (DeepSeek/GLM/ │      │  本地高性能引擎  │      │  自托管账户    │
        │  Qwen/Claude/  │      │  (Rust + Swarm) │      │  + 认证 + 同步 │
        │  Ollama/...)   │      │  因需唤醒/休眠   │      │                │
        └────────────────┘      └─────────────────┘      └────────────────┘

        ┌──────────────────────────────────────────────────────────────┐
        │                     静态前端 + 服务端                          │
        │                                                              │
        │  landing/ (Vite + Vue3, 部署到 Vercel)  →  prowpx.com         │
        │  admin/   (Vite + Vue3, 部署到 Vercel)  →  prowpx.com/admin  │
        │  api/     (Vercel Function proxy.js)     →  API 反代           │
        │  server/  (Node + Express + PostgreSQL)  →  账户 / 业务 API    │
        └──────────────────────────────────────────────────────────────┘
```

### 桌面端多窗口架构

```
┌──────────────────────────────────────────────────────────────┐
│                  Electron 主进程                              │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  WindowManager   │  │  KnowledgeSvc    │  │ MemorySvc  │  │
│  │  (Map<id, BW>)   │  │  (lowdb 资料库)  │  │ (lowdb)    │  │
│  │  MAX_WINDOWS=8   │  │  IPC CRUD        │  │ 模板/习惯  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └─────┬──────┘  │
│           │                     │                   │         │
│           │  IPC 通信          │                   │         │
│           ▼                     ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │   Renderer A (windowId=1)  ──  [文档A.md]               │ │
│  │   Renderer B (windowId=2)  ──  [文档B.md]               │ │
│  │   Renderer C (windowId=3)  ──  [空白文档]               │ │
│  └─────────────────────────────────────────────────────────┘ │
│           │                     │                   │         │
│           └─────────────────────┴───────────────────┘         │
│                    广播: data:knowledge:updated                │
│                          data:templates:updated                │
│                          data:preferences:changed              │
└──────────────────────────────────────────────────────────────┘
```

完整设计参见 [`docs/WPX 多窗口独立编辑器架构设计.md`](docs/WPX%20多窗口独立编辑器架构设计.md)；73 项验收已 100% 通过，详见 [`docs/多窗口架构验收报告.md`](docs/多窗口架构验收报告.md)。

### 数据流：选区改写

```
用户选中文字 → editor.js.setSelection(text, from, to)
       ↓
点击 AI 头像 → AiChatWindow visible
       ↓
聚焦输入框 → editor.js.setChatInputActive(true) + frozenSelection 冻结选区
       ↓
用户输入「精简到3个要点」→ handleSubmit()
       ↓
先过本地指令层（useLocalCommands）→ 命中则本地执行 / 未命中进 LLM
       ↓
未命中 → useAiChat.sendMessage()
       ↓
读取本地 LLM 配置（preferences.modelConfig，API Key AES 解密）
       ↓
@ai-sdk/vue Chat → DirectChatTransport → 用户配置的 Endpoint
       ↓
流式响应 → handleStream 累积 → onFinish
       ↓
extractReplacementText 清洗（去除 markdown 包裹等）
       ↓
editor.js.setReplaceRequest({text, from, to})
       ↓
EditorCore 监听 replaceRequest → Tiptap insertContent
       ↓
选区被新内容替换 ✅
```

### 部署架构

```
                         ┌─────────────────────┐
                         │  prowpx.com (Vercel) │
                         └──────────┬──────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐    ┌─────────▼─────────┐    ┌───────▼───────┐
   │  /  (landing)   │    │  /admin           │    │  /api/*       │
   │  营销官网        │    │  管理后台           │    │  Vercel Fns   │
   │  (landing/dist) │    │  (admin/dist)     │    │  → server/    │
   └─────────────────┘    └───────────────────┘    └───────┬───────┘
                                                           │
                                                    ┌──────▼──────┐
                                                    │  server/    │
                                                    │  Express    │
                                                    │  + PG + Redis│
                                                    └──────┬──────┘
                                                           │
                                                    ┌──────▼──────┐
                                                    │  腾讯云 SES  │
                                                    │  (邮件)      │
                                                    └─────────────┘
```

---

## 📂 子项目结构与职责

```
WPX/
├── wpx-app/                # 桌面端主前端 (Vue 3 + Tiptap + Pinia + Vite 8)
│   ├── src/
│   │   ├── components/     # ai/ editor/ image/ library/ knowledge/ ...
│   │   ├── views/          # HomeView / LibraryView / MaterialsView / Settings / auth
│   │   ├── stores/         # Pinia: editor / preferences / skills / slides / ...
│   │   ├── composables/    # useAiChat / useLocalCommands / useGlobalShortcuts
│   │   ├── router/         # Vue Router
│   │   ├── copilot/        # CopilotKit 集成
│   │   ├── electron/       # Electron 渲染进程胶水
│   │   ├── server/         # 本地服务（export / copilotkit / ai-proxy / knowledge）
│   │   ├── storybook/      # Storybook 配置
│   │   └── __tests__/      # 单元测试
│   ├── public/             # 图标 / 静态资源
│   ├── e2e/                # Playwright 端到端
│   └── package.json
│
├── electron/               # Electron 主进程 + 服务
│   ├── main.js             # 入口：窗口 / 托盘 / IPC / 协议 / 快捷键
│   ├── preload.js          # contextBridge 暴露 IPC
│   ├── window-manager.js   # 多窗口池 (Map<windowId, BrowserWindow>)
│   ├── user-data-service.js   # 用户偏好 / 模型配置 (electron-store)
│   ├── knowledge-service.js   # 资料库 CRUD + 广播
│   ├── memory-service.js      # 习惯 / 智能模板
│   ├── model-ipc.js           # 模型配置 / 测试连接
│   ├── jcode-ipc.js           # jcode 引擎生命周期
│   ├── zip-service.js         # 7za 封装
│   ├── font-service.js        # 字体扫描 / 子集化
│   ├── export-service.js      # 导出引擎入口
│   ├── local-server.js        # 本地 loopback 服务管理
│   ├── auth-store.js          # JWT 加密存储
│   ├── services/              # export-routes / font / remove-bg / jcode / token
│   └── __tests__/             # 单元测试
│
├── admin/                  # 管理后台 (Vue 3 + Element + ECharts)
│   ├── src/views/          # dashboard / models / fonts / skills / orders / users / ...
│   └── package.json
│
├── landing/                # 营销官网 (Vue 3 + GSAP + SSG)
│   ├── src/views/          # Home / About / Blog / Skills / Fonts / Docs / Changelog
│   ├── scripts/            # prerender.mjs (SSG)
│   └── package.json
│
├── server/                 # 自托管后端 (Node + Express + PostgreSQL + Redis)
│   ├── routes/             # auth / admin / user / health
│   ├── controllers/
│   ├── models/             # PG 模型
│   ├── middleware/         # JWT / CORS / 限流
│   ├── sql/                # 数据库 schema / migration
│   ├── services/           # 邮件 (腾讯云 SES) 等
│   ├── nginx/              # 反向代理配置
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── ecosystem.config.cjs  # PM2 部署
│
├── api/                    # Vercel Serverless Function
│   └── proxy.js            # API 反代到后端
│
├── docs/                   # 完整需求文档库（中文）
│   ├── WPX-AI智能文档编辑器 - 产品需求文档 (PRD).md
│   ├── AI助手-V1-需求文档.md
│   ├── WPX AI 本地指令系统需求文档.md
│   ├── WPX MD 智能排版引擎需求文档.md
│   ├── WPX 虚拟纸张与导出母版需求文档.md
│   ├── WPX 集成 jcode 高性能 AI 引擎需求文档.md
│   ├── WPX 字体库需求文档.md
│   ├── WPX 文件压缩解压缩功能需求文档.md
│   ├── WPX AI 演示文稿生成器需求文档.md
│   ├── WPX 多窗口独立编辑器架构设计.md
│   ├── 多窗口架构验收报告.md
│   ├── WPX 内置教师专用 Skills 需求文档.md
│   ├── WPX 内置大学生专用 Skills 需求文档.md
│   ├── WPX 用户中心（设置）需求文档.md
│   ├── WPX 用户注册与账户系统需求文档.md
│   ├── 用户认证与模型配额需求.md          (V2.0 配额机制已废弃)
│   ├── WPX 管理后台需求文档.md
│   ├── WPX 营销网站需求文档（有趣版）.md
│   ├── WPX桌面端 UIUX 设计规范 V1.0.md
│   └── WPX AI 助手帮助文档（国产大模型接入教程）.md
│
├── resources/              # 桌面端资源
│   ├── bin/                # 7za.exe / subset_font.py
│   └── fonts/built-in/     # 内置字体（需自行下载，详见下节）
│
├── public/                 # Vercel 部署根目录
│   ├── index.html          # 落地页聚合入口
│   ├── admin/              # 部署后 admin 静态资源
│   ├── assets/             # 部署后 landing 静态资源
│   ├── fonts/              # 部署后字体资源
│   ├── skills/ blog/ changelog/ docs/ legal/ about/ api/
│   └── admin.html          # 部署后 admin 入口
│
├── scripts/                # 构建 / 工具脚本
│   ├── build-frontend.js
│   ├── bump-pack-version.mjs
│   ├── smoke-prod-electron.mjs
│   └── ...
│
├── .vercelignore
├── vercel.json             # Vercel 部署配置
├── electron-builder 配置 → package.json#build
└── package.json            # monorepo 根，含 electron-builder
```

---

## 🛠️ 技术栈一览

| 层级 | 技术 | 用途 |
|:---|:---|:---|
| **桌面端框架** | Electron 42 | 跨平台桌面运行时 |
| **前端框架** | Vue 3.5 + Composition API + `<script setup>` | UI |
| **构建工具** | Vite 8 + vite-plugin-vue | HMR / 生产构建 |
| **状态管理** | Pinia 3 | 多 store 模块化 |
| **编辑器** | Tiptap 3 (ProseMirror) | WYSIWYG + JSON 可序列化 |
| **AI SDK** | Vercel AI SDK (`@ai-sdk/vue` + `@ai-sdk/openai-compatible`) | 流式对话 |
| **AI 引擎** | CopilotKit Runtime 1.61.1 (multi-route) | Agent / A2UI / Skills 调度 |
| **可选 AI** | jcode (Rust, 本地 Swarm 多智能体) | 复杂任务本地推理 |
| **样式** | Tailwind CSS 4 + CSS 变量 + shadcn-style 组件 | UI |
| **UI 图标** | Lucide Vue | 图标库 |
| **图表** | ECharts 5 | PPT 图表 / 后台统计 |
| **演示文稿** | PptxGenJS + reveal.js | PPT 生成 / 翻页 |
| **图像处理** | tui-image-editor + @imgly/background-removal | 裁剪 / 去背景 |
| **文档转换** | Pandoc 3 | PDF / DOCX 互转 |
| **PDF 解析** | pdf-parse + pdfjs-dist | PDF 读取 |
| **DOCX 解析** | mammoth | Word → HTML |
| **OCR** | tesseract.js 5.1.1 | 扫描件识别 |
| **字体子集化** | fontkit + subset-font | 减小字体包体积 |
| **压缩** | 7za (内置二进制) | 7z / zip / tar / gzip |
| **测试** | Vitest 4 (单元) + Playwright 1.61 (E2E) | 测试 |
| **组件文档** | Storybook 8 | 组件预览 |
| **后端** | Node.js + Express 4 + PostgreSQL + Redis | 自托管账户 |
| **邮件** | 腾讯云 SES (SMTP) | 验证 / 重置 |
| **部署** | Vercel (前端) + Docker (后端) | CI/CD |
| **CI 镜像** | npmmirror ELECTRON_MIRROR | 国内构建加速 |

---

## ⚙️ 配置说明

### 主项目 `package.json` scripts

| 命令 | 说明 |
|:---|:---|
| `npm run dev` | 仅启动 wpx-app Vite dev server（端口 5173） |
| `npm run build` | 构建 wpx-app 静态产物到 `wpx-app/dist` |
| `npm run electron:dev` | **开发桌面端**：并发跑 Vite + Electron 主进程，热更新 |
| `npm run electron:dev:multi` | 开发桌面端，启动时开 2 个窗口（用于调试跨窗口同步） |
| `npm run electron:build` | 跨平台构建桌面安装包（当前平台） |
| `npm run electron:build:win` | 构建 Windows NSIS 安装包 |
| `npm run electron:build:mac` | 构建 macOS DMG |
| `npm run electron:build:linux` | 构建 Linux AppImage |
| `npm run electron:pack:win` | Windows 打包 + 自动 bump pack 版本号 |
| `npm run smoke:prod` | 烟测已打包的桌面端（验证安装包可启动） |

### Electron 打包配置（`package.json#build`）

| 字段 | 当前值 | 说明 |
|:---|:---|:---|
| `appId` | `com.wpx.editor` | 包标识 |
| `productName` | `WPX` | 安装包显示名 |
| `directories.output` | `release` | 安装包输出目录 |
| `extraResources` | `resources/fonts → fonts` | 字体作为额外资源打包 |
| `asarUnpack` | `electron/preload.js` | preload 保留为可读文件 |
| `fileAssociations` | md / txt / wpx / 7z / zip | 双击关联 |
| `protocols` | `wpx://` | 自定义协议（认证回调） |
| `win.target` | `nsis` | Windows NSIS 安装器 |
| `nsis.perMachine` | `true` | 全机安装（需管理员） |
| `mac.target` | `dmg` | macOS DMG |
| `linux.target` | `AppImage` | Linux AppImage |

### 环境变量（主项目）

| 变量 | 默认 | 说明 |
|:---|:---|:---|
| `ELECTRON_MIRROR` | `https://npmmirror.com/mirrors/electron/` | 国内构建加速（已硬编码） |
| `ELECTRON_BUILDER_BINARIES_MIRROR` | `https://npmmirror.com/mirrors/electron-builder-binaries/` | electron-builder 二进制国内镜像（已硬编码） |
| `NODE_ENV` | `development` / `production` | Vite 模式（自动设置） |

> 国内构建已默认配置镜像；如需海外环境，请移除 `cross-env` 前缀。

### Vercel 部署 (`vercel.json`)

| 字段 | 值 | 说明 |
|:---|:---|:---|
| `installCommand` | `npm install --prefix landing --no-audit --no-fund && npm install --prefix admin --no-audit --no-fund` | 仅安装需要的子项目 |
| `buildCommand` | `node scripts/build-frontend.js` | 聚合构建 landing + admin → `public/` |
| `outputDirectory` | `public` | 输出静态根 |
| `regions` | `["hkg1"]` | 香港节点（Vercel Hobby 单区域） |
| `rewrites` | `/api/* → /api/proxy?path=*`、`/* → /index.html` | SPA + API 反代 |
| `headers` | 多组：HTML 不缓存、assets 1 年 immutable、HSTS | 缓存与安全 |

> ⚠️ 重要：Vercel `outputDirectory` 与 Serverless Functions **互斥**。本项目将 API 入口改为单一 `api/proxy.js`（Serverless Function），通过 rewrite 把 `/api/*` 转发到它；前端 SPA 写入 `public/`。Vercel Dashboard 的 `outputDirectory` 设置会**持久覆盖** `vercel.json`，部署后请在 Dashboard 中确认仍为 `public`。
>
> ⚠️ `.vercelignore` 不要误排除 `landing/node_modules` / `admin/node_modules` / `wpx-app` / `scripts/`，否则 `installCommand` 失败。
>
> ⚠️ `vercel.json` 不支持注释字段（`"//"` 形式的注释会触发严格 Schema 报错），也不要使用 Netlify 专有的 `_redirects` / `_headers`（Vercel 已支持同名 `headers`，但 `_redirects` 会被忽略）。

### 后端服务 (`server/`)

| 字段 | 值 | 说明 |
|:---|:---|:---|
| `port` | `3000` | Express 监听端口 |
| `DB` | PostgreSQL 14+ | `pg` 驱动 |
| `Cache` | Redis 6+ | 会话 / 限流 |
| `Mail` | 腾讯云 SES SMTP | 验证邮件 / 重置邮件 |
| `JWT` | access 2h + refresh 30d | 认证 Token |

部署方式：

- **Docker**：`docker compose up -d`（参考 `server/docker-compose.yml`）。
- **PM2**：`pm2 start ecosystem.config.cjs`。
- **Nginx**：参考 `server/nginx/wpx.conf` 反代 443。

### 大模型配置（运行时）

> ⚠️ **V1.0 环境变量注入方式已废弃**（`VITE_DEEPSEEK_API_KEY` 等不再生效）。所有模型 API Key 必须在桌面客户端「设置 → 我的模型」中本地配置，**AES 加密**存储在 Electron `userData`。

| 服务商 | Endpoint 示例 | 推荐模型 |
|:---|:---|:---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/` | `glm-4-flash`（免费） |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` / `qwen-plus` |
| 文心一言 | `https://qianfan.baidubce.com/v2` | `ernie-speed`（免费） |
| 字节豆包 | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-lite-32k` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`（128k 长文） |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-standard` |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama | `http://localhost:11434/v1` | `qwen2.5:7b`（本地） |
| LM Studio | `http://localhost:1234/v1` | 任意本地模型 |

> 完整接入教程：[`docs/WPX AI 助手帮助文档（国产大模型接入教程）.md`](docs/WPX%20AI%20助手帮助文档（国产大模型接入教程）.md)

---

## 🧑‍💻 开发指南

### 开发工作流

1. **拉取最新代码**：`git pull` → 同步主分支。
2. **同步依赖**：根目录 + 各子项目 `npm install --legacy-peer-deps`。
3. **创建特性分支**：`git checkout -b feat/xxx`（命名见下「分支策略」）。
4. **桌面端开发**：`npm run electron:dev`，Vite 5173 + Electron 主进程热更新。
5. **单元测试**：`npm --prefix wpx-app test` / `npm --prefix wpx-app test:zip`。
6. **端到端测试**：`npm --prefix wpx-app test:e2e`（Playwright）。
7. **Storybook**：`npm --prefix wpx-app run storybook:dev`（端口 6006）。
8. **代码检查**：ESLint / Vue Tsc（按子项目 `package.json`）。
9. **提交**：`git commit`（格式见下「提交规范」）。
10. **推送 & 提 PR**：`git push -u origin feat/xxx` → GitHub 发起 Pull Request。

### 分支策略（Git Flow 简化版）

| 分支 | 用途 |
|:---|:---|
| `main` | 稳定发布分支，**只接受 PR merge**，禁止直推 |
| `develop` | 日常开发集成分支 |
| `feat/*` | 新功能（如 `feat/ai-ppt-export`） |
| `fix/*` | Bug 修复（如 `fix/multi-window-close-guard`） |
| `docs/*` | 文档 / 注释（如 `docs/update-readme`） |
| `chore/*` | 构建 / 工具链（如 `chore/bump-electron`） |
| `release/*` | 发布准备（如 `release/v1.2.0`） |
| `hotfix/*` | 生产紧急修复（从 main 拉出） |

### 提交规范（Conventional Commits）

```bash
feat(ai): 新增 jcode 引擎自动降级提示
fix(multi-window): 修复最后一个窗口关闭时未触发保存检查
docs(readme): 补充 Vercel 部署注意事项
style(editor): 统一 Tiptap 节点样式
refactor(zip): 重构 7za 进度解析为独立模块
perf(ai-chat): 流式响应首字延迟优化到 800ms
test(window-manager): 补充 MAX_WINDOWS 边界测试
chore(deps): 升级 Vite 到 8.0.10
```

格式：`<type>(<scope>): <subject>`，scope 取 `electron` / `wpx-app` / `server` / `landing` / `admin` / `docs` / `ai` / `editor` / `multi-window` / `skills` / `fonts` / `zip` / `ppt` 等。

### 关键目录的开发约束

- `electron/`：所有 Node 模块使用 CommonJS（与主进程一致），避免 ESM 异步加载。
- `wpx-app/src/`：所有 Vue 组件使用 `<script setup>` + TypeScript 可选；Store 必须 `defineStore` 命名导出。
- `wpx-app/src/copilot/`：仅在 multi-route 模式下使用（CopilotKit 1.61.1 约束）。
- `wpx-app/src/server/`：本地服务（loopback），不要绑定到 `0.0.0.0`。
- `admin/` & `landing/`：纯前端，避免引入需要 Node 端 `fs` / 进程控制的库。
- **不要**修改 `electron/preload.js` 暴露面外的 IPC 通道，必须先在主进程注册。
- **不要**直接 `fs.readFileSync` 用户文档，必须经 `file:read-document` IPC 走主进程。

### 调试技巧

| 场景 | 工具 |
|:---|:---|
| 渲染进程 UI / Vue | Chrome DevTools（`Ctrl+Shift+I`） |
| 主进程 / IPC 日志 | `electron/dev-logger.js` + `dev-config.json` 启用 `logToFile` |
| 多窗口独立调试 | `npm run electron:dev:multi` + 不同窗口的 DevTools |
| Storybook 组件预览 | `npm --prefix wpx-app run storybook:dev` |
| Vite 构建分析 | `npm --prefix wpx-app run build -- --mode analyze` |
| 端到端失败回放 | `npm --prefix wpx-app run test:e2e:ui` / `test:e2e:report` |
| Electron 远程调试 | `electron/run-dev.js` 已配置 `--remote-debugging-port`，可附加 Chrome |

### 常见开发陷阱（来自历史教训）

> 这些都是项目实测踩过的坑，新人请务必阅读。

1. **npm 必须 `--legacy-peer-deps`**：CopilotKit / Vite 8 / Tiptap 3 之间的 peer 约束未对齐。
2. **动态 `import()` 浏览器原生不支持裸模块**（如 `import('echarts')`），必须在 `package.json` 显式声明依赖，并用 Vite 静态 `import`。
3. **Vite 8 + CJS 包 shim 必须完全内联**到 `vite.config.js`，不要依赖 `alias` / `optimizeDeps` 单独修复。
4. **CJS 包 ESM shim**：参考 `wpx-app/src/utils/cjs-shim.js` 规范。
5. **动态 import 依赖必须在 `package.json` 中声明**（如 `echarts` 显式声明）。
6. **Path.resolve 多级上溯在 Windows 可能返回盘符根**，请用 `path.join(__dirname, '...')` 相对路径。
7. **沙箱环境不支持 `electron-builder`**：CI / 沙箱中跳过 `electron:build`，先在本地构建。

---

## 📦 构建与发布

### 桌面端构建

```bash
# 1. 拉取最新代码并同步依赖
git pull
npm install --legacy-peer-deps
npm --prefix wpx-app install --legacy-peer-deps

# 2. 构建前端静态资源
npm run build

# 3. 打包当前平台
npm run electron:build

# 或单独打包
npm run electron:build:win
npm run electron:build:mac
npm run electron:build:linux

# 完整发布流程（Windows，自动 bump pack 版本号）
npm run electron:pack:win
```

> 产物输出至 `release/`：`WPX-Setup-x.y.z.exe`（Windows NSIS）/ `WPX-x.y.z.dmg`（macOS）/ `WPX-x.y.z.AppImage`（Linux）。

### 烟测已打包的安装包

```bash
npm run smoke:prod
```

该脚本会启动安装好的 WPX，检测主进程能否正常 ready、所有 IPC 通道能否注册、关键窗口能否创建。

### 前端 + 后端部署

**前端（Vercel）**：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 首次部署
vercel link   # 关联项目
vercel        # 预览环境
vercel --prod # 生产环境（→ prowpx.com）
```

**后端（Docker / 腾讯云轻量）**：

```bash
cd server
docker compose up -d
# 初始化数据库
docker compose exec api node scripts/migrate.js
```

详细部署文档：
- [server/DEPLOY.md](server/DEPLOY.md)
- [admin/DEPLOY.md](admin/DEPLOY.md)
- Vercel 治理：[Vercel 部署配置](vercel.json) · `.vercelignore`

### 自动版本号

- **应用版本** (`wpx` 根 `package.json#version`)：手动维护，遵循 SemVer。
- **打包版本** (`scripts/bump-pack-version.mjs`)：每次 `electron:pack:win` 自动 bump，写入 `release/manifest`。

---

## ✅ 测试与质量保障

### 测试矩阵

| 层级 | 框架 | 位置 | 范围 |
|:---|:---|:---|:---|
| 单元测试 - 渲染 | Vitest 4 + @vue/test-utils + jsdom | `wpx-app/src/**/__tests__/` | 组件 / composables / utils |
| 单元测试 - 主进程 | Vitest 4 | `electron/__tests__/` | IPC handlers / 7za 封装 / jcode 检测 / token store |
| 端到端 | Playwright 1.61 | `wpx-app/e2e/` | 关键用户旅程（编辑器、压缩、字体、AI 对话） |
| 组件预览 | Storybook 8 | `wpx-app/src/**/*.stories.js` | 视觉回归 / 设计师走查 |
| 生产烟测 | `scripts/smoke-prod-electron.mjs` | 仓库根 | 已打包安装包可用性 |

### 运行测试

```bash
# 单元测试
npm --prefix wpx-app test                    # 全部
npm --prefix wpx-app test -- --run vue        # 单个 spec
npm --prefix wpx-app test:watch               # watch 模式

# 主进程单元测试
npm --prefix wpx-app test:zip                 # electron/zip-service 套件

# 端到端
npm --prefix wpx-app run test:e2e             # headless
npm --prefix wpx-app run test:e2e:headed      # 有头调试
npm --prefix wpx-app run test:e2e:ui          # Playwright UI
npm --prefix wpx-app run test:e2e:report      # 查看历史报告

# Storybook
npm --prefix wpx-app run storybook:dev        # 端口 6006
npm --prefix wpx-app run storybook:build      # 静态构建
```

### 验收标准

- **功能验收**：参见各 `docs/*需求文档.md` 中的"验收标准"小节（多带 ✅ 勾）。
- **架构验收**：参见 [`docs/多窗口架构验收报告.md`](docs/多窗口架构验收报告.md)（73/100% 通过）。
- **CI 准入**：PR 必须通过所有 Vitest 单元测试 + Playwright E2E + ESLint + TypeScript 编译。

---

## 🌐 部署与运维

### 生产环境

| 组件 | 平台 | 域名 | 备注 |
|:---|:---|:---|:---|
| 营销官网 | Vercel | `prowpx.com` | SSG 预渲染，CDN 加速 |
| 管理后台 | Vercel | `prowpx.com/admin` | SPA，Vercel 静态托管 |
| 桌面端登录回调 | Vercel | `prowpx.com/auth/*` | 自定义协议 `wpx://` 回调 |
| 后端 API | Docker | `api.prowpx.com` | 腾讯云轻量 + Nginx + PM2 |
| 静态资源 | Vercel + 公共 CDN | `fonts.loli.net` | 字体子集 / 生僻字补全 |
| 邮件 | 腾讯云 SES | — | 验证 / 重置邮件 |
| 数据库 | 腾讯云 PostgreSQL | 内网 | 主从 + 自动备份 |
| 缓存 | 腾讯云 Redis | 内网 | 会话 + 限流 |

### 监控与日志

- Vercel：内置 Web Analytics + Function Logs。
- Docker 后端：PM2 logs + 腾讯云 CLS 日志服务。
- 桌面端：`electron/dev-logger.js` 开发期日志；生产仅记录 ERROR 级别到 `app.getPath('logs')`。

### 灾备

- 数据库每日自动快照，保留 7 天。
- `userData` 目录对用户至关重要，**不要**在 `before-quit` 中清理；卸载时由 NSIS / DMG 默认行为决定。
- Vercel 部署保留所有历史版本，可一键回滚。

---

## 🤝 贡献指南

我们欢迎所有形式的贡献：代码、文档、测试、Issue 反馈、设计建议。

### 行为准则

- 友善、尊重、建设性。
- 假设对方是出于善意的提问者 / 贡献者。
- 不接受任何形式的性别歧视、种族歧视、人身攻击。
- 一切以"让 WPX 更好"为出发点。

### 提 Issue

在 [GitHub Issues](https://github.com/wpx-team/wpx/issues) 提交前，请先：

1. 搜索是否已有相同 / 相似 Issue。
2. 选择合适的模板：**Bug Report** / **Feature Request** / **Question** / **Docs**。
3. 提供完整复现步骤、预期行为、实际行为、桌面端版本（`关于 → 复制版本信息`）、操作系统。

### 提 Pull Request

1. **Fork 仓库** → 在你账号下创建 `feat/your-feature` 分支。
2. **遵循提交规范**（见上「提交规范」）。
3. **保持小而专一**：一个 PR 只解决一个问题 / 实现一个功能。
4. **补全测试**：新功能必须有 Vitest 单测，关键流程有 Playwright E2E。
5. **更新文档**：修改用户可见行为必须同步更新 `docs/`。
6. **CI 全绿**：Lint + 单测 + E2E + 构建通过。
7. **描述清楚**：PR 描述包含「动机 / 改动 / 测试 / 截图 / 关联 Issue」。

### 评审流程

| 角色 | 职责 |
|:---|:---|
| Author | 提交 PR、响应评审、修复 CI |
| Reviewer | 至少 1 名 maintainer approve；架构变更需 2 名 |
| Maintainer | 合并 PR、管理 milestone、版本号管理 |
| Release Manager | 打 tag、发版、撰写 changelog |

### 角色 / 权限约定

- `server/routes/admin.routes.js` 中按角色（`admin` / `editor` / `operator`）控制访问。
- 前端 `admin/src/utils/roles.js` 与后端 RBAC 必须**双向一致**。
- 新增权限点必须先更新 `docs/WPX 管理后台需求文档.md` 再提交代码。

### 开发约定（节选）

- **TypeScript 优先**：新代码默认 `.ts` / `.vue` + `<script setup lang="ts">`。
- **避免魔法字符串**：常量集中在 `src/constants/`。
- **错误处理**：主进程 IPC 必须捕获并返回 `{ ok: false, error }`，**不**直接抛异常穿透。
- **本地化**：所有用户可见文案使用 `i18n` key，不允许硬编码中英文字符串。
- **样式**：Tailwind class 优先；复杂动效用 `vueuse/motion` 或 `gsap`。
- **可访问性 (a11y)**：所有交互元素必须有 `aria-*` 与键盘焦点支持。
- **CSP 友好**：避免 `innerHTML` / `eval` / `new Function`；必须时用 DOMPurify。

### 重大变更（Breaking Change）流程

1. 在 `docs/` 新建 `BREAKING-CHANGE-vX.Y.md` 详细描述。
2. 在主进程 + 渲染进程做 **特性开关**（feature flag），默认启用旧行为。
3. 灰度 1 个 minor 版本后再默认切换。
4. 至少提前 1 个 minor 版本在「设置 → 关于」中提示用户。

---

## 🔤 内置字体与版权

WPX 内置 8 款免费商用字体，安装包需从官方渠道下载后放入 `resources/fonts/built-in/`。**字体文件体积较大，不纳入 Git 仓库**；克隆项目后请按下方说明自行下载，打包前确保目录内已有字体文件（`electron-builder` 会将 `resources/fonts/` 一并打入安装包）。

### 下载方式

| 字体 | 官方下载 | 建议放置路径 |
|:---|:---|:---|
| 思源黑体 (Source Han Sans) | <https://github.com/adobe-fonts/source-han-sans/releases> | `resources/fonts/built-in/source-han-sans/` |
| 思源宋体 (Source Han Serif) | <https://github.com/adobe-fonts/source-han-serif/releases> | `resources/fonts/built-in/source-han-serif/` |
| 霞鹜文楷 (LXGW WenKai) | <https://github.com/lxgw/LxgwWenKai/releases> | `resources/fonts/built-in/lxgw-wenkai/` |
| 霞鹜文楷等宽 (LXGW WenKai Mono) | <https://github.com/lxgw/LxgwWenKaiMono/releases> | `resources/fonts/built-in/lxgw-wenkai-mono/` |
| 阿里巴巴普惠体 | <https://www.alibabafonts.com/> | `resources/fonts/built-in/alibaba-puhuiti/` |
| HarmonyOS Sans | <https://developer.harmonyos.com/en/design/resource/> | `resources/fonts/built-in/harmonyos-sans/` |
| JetBrains Mono | <https://www.jetbrains.com/lp/mono/> | `resources/fonts/built-in/jetbrains-mono/` |
| Noto Color Emoji | <https://github.com/googlefonts/noto-emoji> | `resources/fonts/built-in/noto-color-emoji/` |

**简要步骤：**

1. 从上表链接下载对应字体包（通常为 `.zip` 或 `.7z`）。
2. 解压后将 `.ttf` / `.otf` / `.woff2` 等字体文件放入建议子目录（可按需子集化，见 [`docs/WPX 字体库需求文档.md`](docs/WPX%20字体库需求文档.md)）。
3. 运行 `npm run electron:build` 前确认 `resources/fonts/built-in/` 下已有文件；空目录不会报错，但应用内将无法使用内置字体。

### 字体版权声明

以下字体随 WPX 分发（由开发者本地下载并打包），均为免费可商用授权。各字体版权归原作者所有。

| 字体名称 | 作者 / 版权方 | 开源 / 授权协议 |
|:---|:---|:---|
| 思源黑体 (Source Han Sans) | Adobe、Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 思源宋体 (Source Han Serif) | Adobe、Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 霞鹜文楷 (LXGW WenKai) | 落霞孤鹜 (lxgw) | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 霞鹜文楷等宽 (LXGW WenKai Mono) | 落霞孤鹜 (lxgw) | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 阿里巴巴普惠体 (Alibaba PuHuiTi) | 阿里巴巴 | [阿里巴巴字体免费商用授权](https://www.alibabafonts.com/) |
| HarmonyOS Sans | 华为 (Huawei) | [HarmonyOS Sans 字体许可](https://developer.huawei.com/consumer/cn/doc/design-guides/font-0000001773938985)（免费可商用） |
| JetBrains Mono | JetBrains | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| Noto Color Emoji | Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |

使用或再分发上述字体时，请遵守各自许可条款（通常需保留版权声明与许可全文）。WPX 应用内可在「关于」或设置中展示本表摘要。

### 7-Zip 许可证

WPX 内置 `7za.exe`（7-Zip 独立命令行版）以提供开箱即用的压缩 / 解压能力。7-Zip 采用 **LGPL** 许可证，版权归 Igor Pavlov 所有；完整许可文本随安装包提供（`resources/bin/7-Zip-LICENSE.txt`），可在「关于」页面查看。

---

## 🗺️ 路线图与版本记录

### 路线图

| 版本 | 主题 | 计划时间 | 状态 |
|:---|:---|:---|:---|
| **v1.1** | 完全免费模式 + 国产大模型全面接入 + 多窗口 73 项验收 | 2026 Q2 | ✅ 已发布 |
| **v1.2** | 资料库 RAG 完善 + 全文搜索 + 习惯学习 | 2026 Q3 | 🚧 进行中 |
| **v1.3** | 智能文库 + Wiki 式浏览 + 跨设备偏好同步 | 2026 Q4 | 📋 规划中 |
| **v2.0** | 协作编辑 + 团队空间 + 云端文库（自托管） | 2027 Q1 | 🔮 远期 |

### 版本记录

| 版本 | 日期 | 关键变更 |
|:---|:---|:---|
| **v1.1.0** | 2026-06-25 | 业务模式变更为**完全免费**；取消内置大模型与商业字体服务；多窗口架构 100% 验收通过；jcode 集成；56 条本地指令；MD 智能排版；虚拟纸张；AI 演示文稿生成器；7za 内置；自托管用户系统迁移到 `prowpx.com` |
| v1.0.0 | 2026-05 | 首个对外公开版本（已废弃，转完全免费模式） |
| v0.1.x | 2026-Q1 | MVP：单窗口 Tiptap 编辑器 + 浮动 AI 对话窗 + PDF/MD 导出 |

---

## 📄 许可证

本项目源码采用 **UNLICENSED**（仅作者保留权利），暂不开放源码许可。

第三方依赖遵循各自协议（详见 `package.json` / `LICENSE-*`）。字体遵循上述版权表。7-Zip 遵循 LGPL。

如需在自有产品中集成 WPX 的部分模块（如多窗口管理器、PDF 导出引擎），请通过 [hi@wpx.app](mailto:hi@wpx.app) 联系商务合作。

---

## 📚 相关文档

完整的项目需求、设计、验收文档位于 [`docs/`](docs/)，按主题归类如下：

### 产品 / 架构

- [产品需求文档 (PRD)](docs/WPX-AI智能文档编辑器%20-%20产品需求文档%20(PRD).md)
- [UI/UX 设计规范 V1.0](docs/WPX桌面端%20UIUX%20设计规范%20V1.0.md)
- [多窗口独立编辑器架构设计](docs/WPX%20多窗口独立编辑器架构设计.md)
- [多窗口架构验收报告（73/100%）](docs/多窗口架构验收报告.md)

### AI 能力

- [AI 助手 V1 需求文档](docs/AI助手-V1-需求文档.md)
- [AI 本地指令系统（56 条指令）](docs/WPX%20AI%20本地指令系统需求文档.md)
- [MD 智能排版引擎](docs/WPX%20MD%20智能排版引擎需求文档.md)
- [AI 演示文稿生成器](docs/WPX%20AI%20演示文稿生成器需求文档.md)
- [集成 jcode 高性能 AI 引擎](docs/WPX%20集成%20jcode%20高性能%20AI%20引擎需求文档.md)
- [国产大模型接入教程](docs/WPX%20AI%20助手帮助文档（国产大模型接入教程）.md)

### 用户系统 / 设置

- [用户注册与账户系统（V2.1）](docs/WPX%20用户注册与账户系统需求文档.md)
- [用户中心（设置）需求文档](docs/WPX%20用户中心（设置）需求文档.md)
- [用户认证与模型配额（V2.0 已废弃）](docs/用户认证与模型配额需求.md)

### Skills

- [内置教师专用 Skills（16 款）](docs/WPX%20内置教师专用%20Skills%20需求文档.md)
- [内置大学生专用 Skills（16 款）](docs/WPX%20内置大学生专用%20Skills%20需求文档.md)

### 编辑 / 导出 / 字体

- [虚拟纸张与导出母版](docs/WPX%20虚拟纸张与导出母版需求文档.md)
- [字体库需求文档](docs/WPX%20字体库需求文档.md)
- [文件压缩 / 解压缩（内置 7za）](docs/WPX%20文件压缩解压缩功能需求文档.md)

### 业务 / 运营

- [管理后台需求文档](docs/WPX%20管理后台需求文档.md)
- [营销网站需求文档（有趣版）](docs/WPX%20营销网站需求文档（有趣版）.md)

---

## 💬 联系我们

- **官网**：[prowpx.com](https://prowpx.com)
- **文档**：[prowpx.com/docs](https://prowpx.com/docs)
- **邮箱**：[hi@wpx.app](mailto:hi@wpx.app)
- **GitHub**：[github.com/wpx-team/wpx](https://github.com/wpx-team/wpx)
- **Issues**：[github.com/wpx-team/wpx/issues](https://github.com/wpx-team/wpx/issues)
- **讨论**：[github.com/wpx-team/wpx/discussions](https://github.com/wpx-team/wpx/discussions)

---

> Made with ❤️ and a lot of midnight snacks.
> 别再为 WPS 交税了。WPX，新一代 AI 文档编辑器。
# WPX

AI 智能文档编辑器，基于 Electron + Vue3 的多窗口应用。

## 开发

```bash
npm run electron:dev
```

完整说明见 `docs/` 与 `.cursor/skills/wpx-development/SKILL.md`。

## 内置字体

WPX 内置 8 款免费商用字体，安装包需从官方渠道下载后放入 `resources/fonts/built-in/`。**字体文件体积较大，不纳入 Git 仓库**；克隆项目后请按下方说明自行下载，打包前确保目录内已有字体文件（`electron-builder` 会将 `resources/fonts/` 一并打入安装包）。

### 下载方式

| 字体 | 官方下载 | 建议放置路径 |
|:---|:---|:---|
| 思源黑体 (Source Han Sans) | https://github.com/adobe-fonts/source-han-sans/releases | `resources/fonts/built-in/source-han-sans/` |
| 思源宋体 (Source Han Serif) | https://github.com/adobe-fonts/source-han-serif/releases | `resources/fonts/built-in/source-han-serif/` |
| 霞鹜文楷 (LXGW WenKai) | https://github.com/lxgw/LxgwWenKai/releases | `resources/fonts/built-in/lxgw-wenkai/` |
| 霞鹜文楷等宽 (LXGW WenKai Mono) | https://github.com/lxgw/LxgwWenKaiMono/releases | `resources/fonts/built-in/lxgw-wenkai-mono/` |
| 阿里巴巴普惠体 | https://www.alibabafonts.com/ | `resources/fonts/built-in/alibaba-puhuiti/` |
| HarmonyOS Sans | https://developer.harmonyos.com/en/design/resource/ | `resources/fonts/built-in/harmonyos-sans/` |
| JetBrains Mono | https://www.jetbrains.com/lp/mono/ | `resources/fonts/built-in/jetbrains-mono/` |
| Noto Color Emoji | https://github.com/googlefonts/noto-emoji | `resources/fonts/built-in/noto-color-emoji/` |

**简要步骤：**

1. 从上表链接下载对应字体包（通常为 `.zip` 或 `.7z`）。
2. 解压后将 `.ttf` / `.otf` / `.woff2` 等字体文件放入建议子目录（可按需子集化，见 `WPX 字体库需求文档.md`）。
3. 运行 `npm run electron:build` 前确认 `resources/fonts/built-in/` 下已有文件；空目录不会报错，但应用内将无法使用内置字体。

## 字体版权声明

以下字体随 WPX 分发（由开发者本地下载并打包），均为免费可商用授权。各字体版权归原作者所有。

| 字体名称 | 作者 / 版权方 | 开源 / 授权协议 |
|:---|:---|:---|
| 思源黑体 (Source Han Sans) | Adobe、Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 思源宋体 (Source Han Serif) | Adobe、Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 霞鹜文楷 (LXGW WenKai) | 落霞孤鹜 (lxgw) | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 霞鹜文楷等宽 (LXGW WenKai Mono) | 落霞孤鹜 (lxgw) | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 阿里巴巴普惠体 (Alibaba PuHuiTi) | 阿里巴巴 | [阿里巴巴字体免费商用授权](https://www.alibabafonts.com/) |
| HarmonyOS Sans | 华为 (Huawei) | [HarmonyOS Sans 字体许可](https://developer.huawei.com/consumer/cn/doc/design-guides/font-0000001773938985)（免费可商用） |
| JetBrains Mono | JetBrains | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| Noto Color Emoji | Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |

使用或再分发上述字体时，请遵守各自许可条款（通常需保留版权声明与许可全文）。WPX 应用内可在「关于」或设置中展示本表摘要。
