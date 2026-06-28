# WPX 技术架构总览 V2.0

**版本**：V2.0  
**状态**：正式版  
**最后更新**：2026-06-28  
**关联文档**：PRD、各模块需求文档、多窗口架构验收报告

---

## 1. 项目概要

WPX 是一款基于 Electron + Vue3 的 AI 原生桌面文档编辑器。以 Markdown 为核心编辑格式，AI 对话为主要交互方式，集成轻量表格、图片处理、PPT 生成、知识库 RAG、多窗口管理、压缩解压等能力，形成从创作、编辑到知识管理的完整闭环。

**商业模式**：工具本体永久免费，大模型与字体服务由用户自行接入第三方。

**产品版本**：V0.1.10（package.json）

---

## 2. 六层架构全景图

```
┌──────────────────────────────────────────────────────────────────┐
│                     Layer 6: 云端服务 (server/)                     │
│  Express API · PostgreSQL · Redis · JWT认证 · Admin后台            │
│  prowpx.com/api/auth/* · skillhub · CDN                           │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ HTTPS
┌────────────────────────────────┼─────────────────────────────────┐
│                     Layer 5: 子项目 (landing/admin/about)          │
│  landing/ — 营销官网 (Vue3+Vite)                                   │
│  admin/ — 管理后台 (Vue3+Vite, base=/admin/)                      │
│  about/ blog/ — 静态子页面                                         │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────┐
│                  Layer 4: 本地服务 (electron/local-server.js)       │
│  Express子服务集群（主进程管理）:                                    │
│  ├─ Export Service (Pandoc: MD↔DOCX/PDF/HTML)                    │
│  ├─ Remove-BG Service (Python rembg: AI去背景)                    │
│  ├─ Knowledge Service (Python: 文档解析/向量化)                    │
│  ├─ Library Service (Python: 智能文库)                             │
│  ├─ AI Proxy Service (Node.js: API转发)                           │
│  └─ CopilotKit Runtime (Node.js: Agent编排/A2UI)                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ IPC / HTTP localhost
┌────────────────────────────────┼─────────────────────────────────┐
│                  Layer 3: 前端应用 (wpx-app/)                       │
│  Vue3 + Vite + Pinia + Vue Router 5 + Tailwind CSS 4              │
│  ┌──────────────────────────────────────────────┐                 │
│  │  Tiptap 编辑器 (富文本/Markdown/表格/幻灯片)     │                 │
│  │  AI 助手 (浮动对话窗 + CopilotKit + Skills)    │                 │
│  │  图片编辑器 (tui-image-editor + 去背景)        │                 │
│  │  知识库面板 · 智能模板 · 保存/导出对话框         │                 │
│  │  压缩解压面板 · 字体管理 · 设置中心              │                 │
│  │  AuthModal · TitleBar · WindowListMenu        │                 │
│  └──────────────────────────────────────────────┘                 │
│  多窗口：每个 BrowserWindow 独立渲染进程，通过 URL query 传递 windowId │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ IPC (contextBridge)
┌────────────────────────────────┼─────────────────────────────────┐
│               Layer 2: IPC 服务层 (electron/services/)             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ model-ipc + model-secrets-store  用户大模型 API Key 管理   │    │
│  │ knowledge-service               资料库 RAG（lowdb）        │    │
│  │ memory-service                  记忆与智能模板（lowdb）     │    │
│  │ font-ipc + font-service         字体管理/子集化/推荐       │    │
│  │ export-service + export-routes  导出服务（Pandoc/AI排版）   │    │
│  │ zip-ipc + zip-service           7za 压缩解压               │    │
│  │ jcode-ipc + jcode-launcher      jcode 高性能AI引擎         │    │
│  │ auth-store                       自托管JWT认证             │    │
│  │ user-data-service               electron-store 偏好存储    │    │
│  │ free-quota-ipc                   Token配额（已废弃V1.1）    │    │
│  │ local-server.js                  本地服务编排               │    │
│  │ token-* / commercial-font-*      商业字体Token（已废弃）    │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Node.js API
┌────────────────────────────────┼─────────────────────────────────┐
│               Layer 1: Electron 主进程 (electron/)                 │
│  main.js          应用生命周期 · 窗口管理 · IPC注册 · CSP · 菜单    │
│  window-manager.js 多窗口池(≤8个) · focus · close-guard · 广播     │
│  preload.js        contextBridge 暴露 ~40 个安全 IPC 通道          │
│  file-open.js      文件关联打开 · 拖拽导入                          │
│  auth-protocol.js  wpx:// 协议回调（已简化为应用内AuthModal）       │
│  about-update.js   版本检查 · 应用信息                              │
│  debug-port.js     开发调试端口管理                                 │
│  resources/bin/    7za.exe · subset_font.py · pandoc/              │
│  resources/fonts/  内置8款免费字体（子集化）                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 各层详细说明

### 3.1 Layer 1: Electron 主进程

| 文件 | 职责 | 状态 |
|:---|:---|:---:|
| `electron/main.js` (1053行) | 应用启动、生命周期、IPC handler 注册、CSP 配置、菜单构建、系统托盘、全局快捷键、退出流程 | ✅ |
| `electron/window-manager.js` (251行) | 多窗口池 Map、createWindow、focusWindow、closeWindow、窗口列表管理、8窗口上限 | ✅ |
| `electron/preload.js` (183行) | contextBridge 暴露 electronAPI / wpx.window，涵盖 tray/app/window/files/preferences/auth/models/knowledge/memory/zip/fonts/jcode/shell 共 ~40 个安全通道 | ✅ |
| `electron/file-open.js` | 文件关联打开（.md/.txt/.wpx/.7z/.zip）、拖拽导入、关联文件 payload 读取 | ✅ |
| `electron/file-associations.js` | 文件关联注册/取消 | ✅ |
| `electron/auth-protocol.js` | wpx:// 协议回调处理（已简化为 AuthModal 内嵌登录） | ✅ |

### 3.2 Layer 2: IPC 服务层

| 服务模块 | 文件 | 功能 | 状态 |
|:---|:---|:---|:---:|
| 模型管理 | `model-ipc.js` + `model-secrets-store.js` | 用户自定义大模型 API Key 的增删改查、AES 加密存储、测试连接 | ✅ |
| 资料库 | `knowledge-service.js` | 资料上传/删除/列表、lowdb 存储、PDF/Word/网页解析、跨窗口广播 | ✅ |
| 记忆系统 | `memory-service.js` | 用户习惯记录、智能模板生成/管理、跨窗口广播 | ✅ |
| 字体系统 | `font-ipc.js` + `font-service.js` | 内置字体/在线字体/本地导入管理、推荐检测、子集化导出、下载进度 | ✅ |
| 导出服务 | `export-service.js` + `export-routes.js` (509行) | Pandoc 调用、AI 排版建议、docx/PDF/HTML 导出、虚拟纸张参数传递 | ✅ |
| 压缩解压 | `zip-ipc.js` + `zip-service.js` | 7za 调用、compress/extract/list/cancel、进度推送、密码支持 | ✅ |
| jcode 引擎 | `jcode-ipc.js` + `jcode-launcher.js` + `jcode-detector.js` | 安装检测、启动/停止/状态、Swarm 调用、流式进度、设置管理 | ✅ |
| 用户认证 | `auth-store.js` | JWT token/refresh_token 加密存储、读取、清除 | ✅ |
| 用户偏好 | `user-data-service.js` | electron-store 偏好读写、跨窗口广播 preferences-changed | ✅ |
| 免费配额 | `free-quota-ipc.js` + `free-quota-store.js` | Token 配额管理（V1.1 已废弃，保留兼容） | ⚠️ |
| 商业字体 | `commercial-font-routes.js` + `commercial-font-store.js` + `token-routes.js` + `token-store.js` | 商业字体 Token 管理（V1.1 已废弃） | ❌ |
| 本地服务 | `local-server.js` | 启动/停止 Express 子服务集群，统一端口管理 | ✅ |

### 3.3 Layer 3: 前端应用 (wpx-app/src/)

#### 3.3.1 核心架构

| 模块 | 文件 | 说明 |
|:---|:---|:---|
| 入口 | `main.js` → `Root.vue` → `App.vue` | 应用初始化、windowId 识别、Pinia 注入、路由同步 |
| 路由 | `router/` | Vue Router 5，含 /editor、/settings、/about、/blog 等 |
| 状态管理 | `stores/` | editor、app、auth、preferences、fonts、knowledge 等 Pinia stores |
| 窗口上下文 | `utils/windowContext.js` | 解析 windowId、注入到 Pinia |

#### 3.3.2 功能模块组件

| 模块 | 组件 | 功能 | 状态 |
|:---|:---|:---|:---:|
| **AI 助手** | `AiAvatar.vue` | 右下角固定头像，点击唤起对话窗 | ✅ |
| | `AiChatWindow.vue` (2089行) | 可拖拽/缩放/钉住浮动对话窗、多模型切换、流式响应 | ✅ |
| | `AiAssistantPlaceholder.vue` | 组装入口+对话窗，编排业务流 | ✅ |
| | `JcodeStatusIndicator.vue` | jcode 引擎状态指示器 | ✅ |
| | `LocalCommandMessage.vue` | 本地指令消息（MD排版/格式转换等） | ✅ |
| | `AiMarkdownContent.vue` | AI 回复 Markdown 渲染 | ✅ |
| **编辑器** | `EditorCore.vue` (1319行) | Tiptap 核心编辑器、选区管理、替换指令 | ✅ |
| | `FindReplaceDialog.vue` | 查找替换 | ✅ |
| | `FontFamilySelect.vue` | 字体族选择器（含分类标签） | ✅ |
| | `FormatTemplateSelector.vue` | 排版模板选择器 | ✅ |
| | `ImageBubbleMenu.vue` | 图片浮动菜单 | ✅ |
| | `ImageUrlDialog.vue` | 图片 URL 插入 | ✅ |
| | `TableBubbleMenu.vue` | 表格浮动菜单 | ✅ |
| | `TableInsertDialog.vue` | 插入表格 | ✅ |
| | `PdfImportDialog.vue` | PDF 导入 | ✅ |
| | `SlideDeckNodeView.vue` | 幻灯片预览节点 | ✅ |
| **图片** | `ImageEditor.vue` (1162行) | tui-image-editor 集成、裁剪/标注/调色/AI去背景 | ✅ |
| **导出** | `ExportMenu.vue` | 导出菜单（MD/HTML/PDF/DOCX/PPTX） | ✅ |
| | `ExportOptionsConfirm.vue` | 导出选项确认（纸张/页边距/分页等） | ✅ |
| | `ExportTemplateIndicator.vue` | 导出母版指示器 | ✅ |
| **知识库** | `KnowledgePanel.vue` (1082行) | 资料列表、上传、预览、删除、搜索 | ✅ |
| | `KnowledgeTrigger.vue` | @ 引用触发 | ✅ |
| | `WebUrlImportSheet.vue` | 网页 URL 导入 | ✅ |
| **文库** | `SaveDialog.vue` | 保存对话框（含智能分类建议） | ✅ |
| | `CloseConfirmDialog.vue` | 关闭确认（保存/不保存/取消） | ✅ |
| | `WikiBrowser.vue` | Wiki 浏览器 | ✅ |
| **压缩解压** | `ArchivePreview.vue` | 压缩包内容预览 | ✅ |
| | `CompressDialog.vue` | 压缩设置 | ✅ |
| | `ExtractConflictDialog.vue` | 解压冲突处理 | ✅ |
| | `PasswordDialog.vue` | 密码输入 | ✅ |
| | `ProgressBar.vue` | 操作进度条 | ✅ |
| **幻灯片** | `SlideDeck.vue` | 幻灯片预览容器（翻页/全屏） | ✅ |
| | `CoverSlide.vue` / `TocSlide.vue` / `TextSlide.vue` / `ImageTextSlide.vue` / `ChartSlide.vue` / `TableSlide.vue` / `EndSlide.vue` | 7 种幻灯片组件 | ✅ |
| **字体** | `FontMarketCard.vue` | 字体卡片 | ✅ |
| | `FontPreviewDialog.vue` | 字体预览 | ✅ |
| | `FontRecommendationDialog.vue` | 字体推荐 | ✅ |
| | `ExportFontConfirm.vue` | 导出字体确认 | ✅ |
| **认证** | `AuthModal.vue` | 嵌入式登录/注册模态框 | ✅ |
| | `LoginGuide.vue` | 登录引导 | ✅ |
| **布局** | `TitleBar.vue` | 自定义标题栏（窗口控制/窗口菜单/设置入口） | ✅ |
| | `WindowListMenu.vue` | 多窗口列表浮层菜单 | ✅ |
| | `AppLayout.vue` | 应用布局 | ✅ |
| | `UserAccountMenu.vue` | 用户账户菜单 | ✅ |
| **模板** | `SmartTemplate.vue` | 智能模板展示 | ✅ |
| **Skills** | `SkillInputForm.vue` | Skills 输入表单 | ✅ |
| **通用** | `EmptyState.vue` / `ThemeToggle.vue` / `ToastNotification.vue` / `TraySimulator.vue` / `AppPicture.vue` / `LazySection.vue` | UI 辅助组件 | ✅ |

#### 3.3.3 Composables（核心逻辑）

| Composable | 功能 | 状态 |
|:---|:---|:---:|
| `useAiChat.js` | AI 对话管理：模型配置读取、流式响应、Skills 调度、选区改写 | ✅ |
| `useAuth.js` | 认证流程：登录/注册/登出/Token刷新 | ✅ |
| `useDragDrop.js` | 文件拖拽导入 | ✅ |
| `useEditorFonts.js` | 编辑器字体管理 | ✅ |
| `useAutoSave.js` | 自动保存 | ✅ |
| `useLocalCommands.js` | 本地指令系统（MD排版等纯前端AI指令） | ✅ |
| `usePPTWorkflow.js` | PPT 生成四步流程 | ✅ |
| `useSlideExport.js` | 幻灯片导出 | ✅ |
| `useHtmlImporter.js` | HTML 网页导入 | ✅ |
| `useHtmlFormatter.js` | HTML 排版引擎 | ✅ |
| `useMarkdownFormatter.js` | MD 排版引擎 | ✅ |
| `useWindowCloseInterceptor.js` | 窗口关闭拦截（未保存检查） | ✅ |
| `useArchiveDrop.js` | 压缩包拖入处理 | ✅ |
| `useEditorRegistry.js` | 编辑器实例注册 | ✅ |
| `useGlobalShortcuts.js` | 全局快捷键 | ✅ |
| `useCreateAppWindow.js` | 新建窗口 | ✅ |

### 3.4 Layer 4: 本地服务

| 服务 | 启动方式 | 功能 | 状态 |
|:---|:---|:---|:---:|
| Export Service | `node src/server/export-service.js` | Pandoc 调用，MD↔DOCX/PDF/HTML 转换 | ✅ |
| Remove-BG Service | `python src/server/remove-bg-service.py` | rembg U²-Net AI 去背景 | ✅ |
| Knowledge Service | `python src/server/knowledge-service.py` | 文档解析/切片/向量化 | ⚠️ 部分 |
| Library Service | `python src/server/library-service.py` | 智能文库管理 | ⚠️ 部分 |
| AI Proxy Service | `node src/server/ai-proxy-service.js` | AI API 代理转发 | ✅ |
| CopilotKit Runtime | `node src/server/copilotkit-runtime.js` | Agent 编排、A2UI 组件映射 | ✅ |

### 3.5 Layer 5: 子项目

| 子项目 | 技术栈 | 功能 | 状态 |
|:---|:---|:---|:---:|
| `landing/` | Vue3 + Vite + Tailwind CSS | 营销官网（首页/功能/定价/FAQ/下载） | ✅ |
| `admin/` | Vue3 + Vite + Tailwind CSS | 管理后台（base=/admin/） | ✅ |
| `about/` | 静态 HTML | 关于页面 | ✅ |
| `blog/` | 静态 HTML | 博客页面 | ✅ |

### 3.6 Layer 6: 云端服务

| 模块 | 文件 | 功能 | 状态 |
|:---|:---|:---|:---:|
| 应用入口 | `server/app.js` | Express 应用工厂，CORS/Helmet/日志 | ✅ |
| 路由 | `server/routes/` | RESTful API 路由定义 | ✅ |
| 认证 | `server/controllers/auth.controller.js` | 注册/登录/登出/Token刷新/邮箱验证/密码重置 | ✅ |
| 管理后台 | `server/controllers/admin.controller.js` | 仪表盘/用户/模型/字体/Skills/Token/公告管理 | ✅ |
| 数据模型 | `server/models/` | User、AdminUser、Font、Skill、Token、Announcement、Version、Stats、AiModel、Setting、Log | ✅ |
| 中间件 | `server/middleware/` | JWT 认证、错误处理、请求日志、请求ID | ✅ |
| 数据库 | PostgreSQL + Redis | 主存储 + 缓存/Session | ✅ |
| 部署 | Docker + Nginx | `prowpx.com` 反向代理 + SSL | ✅ |

---

## 4. IPC 通道全景图

### 4.1 渲染进程 → 主进程 (invoke/send)

| 通道 | 功能 | 来源 |
|:---|:---|:---|
| `tray:*` | 托盘控制（显示/隐藏/设置最近文档） | preload |
| `app:quit` | 退出应用 | preload |
| `window:minimize/maximize/unmaximize/close` | 窗口控制 | preload |
| `window:request-close` | 发起关闭请求（触发保存检查） | preload |
| `window:confirm-close` | 确认关闭 | preload |
| `window:cancel-close` | 取消关闭 | preload |
| `window:list-request` | 获取窗口列表 | preload |
| `window:focus-other` | 聚焦其他窗口 | preload |
| `window:create` | 新建窗口 | preload |
| `file:read-document` | 读取文件内容 | main.js |
| `file:write-document` | 写入文件 | main.js |
| `file:get-modified-time` | 获取文件修改时间 | main.js |
| `local-server:get-base-url` | 获取本地服务 URL | main.js |
| `shell:open-external` | 用系统浏览器打开链接 | main.js |
| `file-associations:*` | 文件关联开关 | main.js |
| `about:*` | 应用信息/更新检查/许可证 | main.js |
| `data:preferences:get/set` | 用户偏好读写 | user-data-service |
| `auth:store-token/get-token/clear-token` | JWT Token 管理 | auth-store |
| `models:api-key:*` | 模型 API Key 管理 | model-ipc |
| `models:test-connection` | 测试模型连接 | model-ipc |
| `knowledge:*` | 资料库 CRUD | knowledge-service |
| `data:memory:record` | 记录用户操作习惯 | memory-service |
| `memory:templates:*` | 智能模板管理 | memory-service |
| `memory:clear` | 清除记忆数据 | memory-service |
| `zip:compress/extract/list/cancel` | 压缩解压操作 | zip-ipc |
| `zip:pick-save-path/pick-directory/pick-archive` | 文件选择对话框 | zip-ipc |
| `font:*` | 字体管理全套 | font-ipc |
| `jcode:detect/get-status/start/stop` | jcode 生命周期 | jcode-ipc |
| `jcode:call-swarm/stream` | jcode 推理调用 | jcode-ipc |
| `jcode:get-settings/set-settings` | jcode 偏好设置 | jcode-ipc |
| `jcode:clear-memory` | 清除 jcode 记忆 | jcode-ipc |
| `free-quota:*` | 免费配额管理（V1.1 已废弃） | free-quota-ipc |

### 4.2 主进程 → 渲染进程 (send/广播)

| 通道 | 功能 |
|:---|:---|
| `window:close-check` | 通知渲染进程进行保存检查 |
| `window:focus / window:blur` | 通知窗口焦点变化 |
| `shortcut:ai-chat-toggle` | 全局快捷键触发 AI 面板 |
| `file:open` | 文件关联打开通知 |
| `file:open-archive` | 压缩包打开通知 |
| `app:open-settings` | 打开设置页 |
| `tray:open-recent` | 托盘最近文档 |
| `data:preferences:changed` | 偏好变更广播 |
| `data:knowledge:updated` | 资料库变更广播 |
| `data:templates:updated` | 模板变更广播 |
| `zip:progress` | 压缩解压进度推送 |
| `font:download-progress` | 字体下载进度 |
| `jcode:status-changed` | jcode 状态变更广播 |
| `jcode:stream-event` | jcode 流式结果推送 |
| `jcode:settings-changed` | jcode 设置变更广播 |

---

## 5. 技术选型（实际使用）

| 层级 | 技术 | 说明 |
|:---|:---|:---|
| 桌面框架 | Electron 42 | 跨平台桌面应用 |
| 前端框架 | Vue 3.5 + Vite 8 | 响应式 UI 框架 |
| 状态管理 | Pinia 3 | Vue3 官方状态管理 |
| 路由 | Vue Router 5 | SPA 路由 |
| CSS 框架 | Tailwind CSS 4 | 实用优先的 CSS 框架 |
| 编辑器核心 | Tiptap 3.27 (ProseMirror) | 富文本/Markdown 编辑器 |
| AI SDK | @ai-sdk/vue + @ai-sdk/openai-compatible + ai 6 | 流式 AI 对话 |
| Agent 框架 | @copilotkit/vue + @copilotkit/runtime 1.61 | Agent 编排与 A2UI |
| 图片编辑 | tui-image-editor 3.15 | 开源图片编辑器 |
| 图表 | ECharts 5 | 幻灯片图表渲染 |
| 拖拽 | vue3-draggable-resizable | AI 对话窗拖拽缩放 |
| 图标 | @lucide/vue | SVG 图标库 |
| PPT 导出 | pptxgenjs 3.12 | PPTX 文件生成 |
| Markdown 解析 | markdown-it 14 | MD 渲染 |
| 压缩解压 | 7za (内置) | 7-Zip 独立命令行版 |
| 文档转换 | Pandoc (内置) | MD/DOCX/PDF/HTML 互转 |
| AI 去背景 | rembg (Python) | U²-Net 模型 |
| 字体子集化 | subset-font + Python subset_font.py | 字体压缩 |
| 本地存储 | lowdb 7 + electron-store 11 | 轻量数据持久化 |
| 后端框架 | Express 5 | API 服务 |
| 数据库 | PostgreSQL + Redis | 主存储 + 缓存 |
| 部署 | Docker + Nginx | 容器化部署 |

---

## 6. 开发进展总览

### 6.1 核心模块完成度

| 模块 | 完成度 | 说明 |
|:---|:---:|:---|
| 多窗口架构 | 100% | 73/73 检查点全部通过，验收报告已确认 |
| Tiptap 编辑器 | 100% | Markdown + 富文本 + 表格 + 幻灯片节点 |
| AI 助手对话窗 | 100% | 浮动窗口 + 多模型切换 + 选区改写 + 流式响应 |
| 用户自定义模型配置 | 100% | 12+ 国产大模型预设 + 自定义 OpenAI 兼容 |
| 导出服务 (Pandoc) | 100% | MD/HTML/PDF/DOCX 四格式导出 |
| 7za 压缩解压 | 100% | 压缩/解压/预览/密码/进度/取消 |
| 字体系统 | 100% | 8款内置 + 9款在线 + 本地导入 + 子集化 |
| 资料库 RAG | 90% | 上传/解析/列表/删除/搜索，向量化存储待完善 |
| 用户记忆与模板 | 85% | 习惯记录 + 智能模板生成，学习算法待优化 |
| PPT 生成器 | 90% | 四步流程 + 7种幻灯片 + PPTX/HTML导出 |
| jcode 集成 | 80% | 检测/启动/状态/IPC，Swarm 调用待联调 |
| MD 智能排版引擎 | 100% | 5 种模板 + 本地指令触发 |
| HTML 网页导入 | 100% | 导入+缓存源码+A4模式排版 |
| 虚拟纸张/导出母版 | 100% | 焦点模式 + AI 排版 + 导出确认 |
| 用户认证系统 | 100% | 注册/登录/JWT/AuthModal/邮箱验证/密码重置 |
| 用户中心/设置 | 100% | Agent/Skills/模型/字体/通用/隐私/关于 |
| Skills 系统 | 90% | 内置 15+ Skills + 大学生/教师专用 Skills |
| 本地指令系统 | 100% | LocalCommandMessage + MD排版触发 |
| 管理后台 (server/) | 90% | 后端 API 完成，前端 admin/ 完善中 |
| 营销网站 (landing/) | 100% | 首页/功能/定价/FAQ/下载 |
| CopilotKit Runtime | 85% | Agent 编排 + A2UI 基础框架 |

### 6.2 已废弃模块（V1.1 变更）

| 模块 | 原因 |
|:---|:---|
| WPX 公共大模型 | 平台不再提供内置大模型 API |
| 公共 Token 配额（每日 100M） | 随公共模型一起下线 |
| 商业字体商店 | 平台不经营字体售卖 |
| 字体 Token 充值/消费 | 字体 Token 机制全部下线 |
| 字体导出扣费/水印 | 商业字体业务终止 |

---

## 7. 数据流核心路径

### 7.1 AI 对话流程
```
用户输入 → AiChatWindow → useAiChat
  → 检查模型配置 (model-secrets-store via IPC)
  → 构建 System Prompt (Agent人设 + Skills + 编辑器上下文)
  → 发送 HTTP 请求至用户配置的第三方 API Endpoint
  → 流式响应 → AiChatWindow 渲染 Markdown
  → 若为选区改写 → editorStore.requestReplace → EditorCore 替换文本
```

### 7.2 导出流程
```
用户点击导出 → ExportMenu → ExportOptionsConfirm
  → IPC 调用 export-routes
  → 读取编辑器 JSON → 转换 Markdown
  → AI 排版引擎（分页/图片适配/页眉页脚）
  → Pandoc 转换为目标格式（DOCX/PDF/HTML）
  → 子集化嵌入字体（如需要）
  → 输出文件到用户指定路径
```

### 7.3 多窗口同步流程
```
窗口A 修改偏好 → IPC preferences:set → user-data-service 写入 electron-store
  → broadcastPreferencesChanged() → 遍历所有 webContents send
  → 窗口B/C/D... 收到 preferences-changed → preferencesStore.applyPreferences()
```

---

## 8. 项目文件规模

| 目录 | 文件数（估算） | 说明 |
|:---|:---|:---|
| `electron/` | ~40 | 主进程 + 服务 + 测试 |
| `wpx-app/src/` | ~320 | Vue3 前端源码 |
| `server/` | ~30 (不含node_modules) | 后端 API |
| `landing/src/` | ~15 | 营销网站 |
| `admin/src/` | ~12 | 管理后台 |
| `docs/` | 21 | 需求与设计文档 |
| `scripts/` | ~20 | 构建/测试/工具脚本 |
| `resources/` | ~10 | 7za/pandoc/字体等资源 |

---

## 9. 关键设计决策记录

| 决策 | 选择 | 原因 |
|:---|:---|:---|
| 桌面框架 | Electron（非 Tauri） | 生态成熟，Vue3/Vite 集成简单，社区资源丰富 |
| 编辑器 | Tiptap（非 Slate/Quill） | 插件生态全，JSON 驱动适配 AI，社区活跃 |
| AI 模型 | 用户自配（非平台提供） | 完全免费模式，降低运营成本与法律风险 |
| 多窗口 | 独立渲染进程（非 tab 页） | 每个文档独立状态，崩溃隔离，复用同一前端代码 |
| 本地数据库 | lowdb + electron-store（非 SQLite） | MVP 阶段轻量够用，后续可迁移 |
| 压缩引擎 | 内置 7za（非调用系统 7-Zip） | 开箱即用，不依赖用户安装第三方软件 |
| 文档转换 | 内置 Pandoc（非在线服务） | 本地处理保护隐私，不依赖网络 |
| 认证方式 | 应用内嵌 AuthModal（非外部浏览器） | 减少攻击面，提升用户体验 |

---

**文档结束**
