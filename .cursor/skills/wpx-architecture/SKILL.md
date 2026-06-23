---
name: wpx-architecture
description: >-
  WPX 系统架构与模块边界。在设计新功能、改 IPC/多窗口、接入 AI 或本地服务、
  阅读需求文档时使用。
---

# WPX 架构速查

## 技术栈

- **壳**：Electron 42 + electron-builder
- **前端**：Vue 3 + Pinia + Vite + Tailwind 4 + TipTap
- **AI**：Vercel AI SDK（经 `ai-proxy-service` 代理）
- **本地服务**：Node（export、ai-proxy）+ Python FastAPI（knowledge、library、remove-bg）

## 分层

```
Electron 主进程 (electron/)
  ├── window-manager.js    # 多窗口生命周期
  ├── main.js              # IPC、菜单、文件关联
  └── services/            # 主进程侧导出等

Vue 渲染进程 (wpx-app/src/)
  ├── components/editor/   # TipTap 编辑器核心
  ├── components/ai/       # AI 头像、对话窗、浮动窗
  ├── components/layout/   # 编辑器布局、占位符
  ├── stores/              # Pinia 状态
  └── utils/localApi.js    # 调用本地 HTTP API

本地微服务 (wpx-app/src/server/)
  ├── export-service.js
  ├── ai-proxy-service.js
  ├── knowledge-service.py
  ├── library-service.py
  └── remove-bg-service.py
```

## 多窗口模型

每个 Electron 窗口 = 独立编辑器实例。窗口间通过主进程 IPC 协调，**不共享** Pinia store。详见 `docs/WPX 多窗口独立编辑器架构设计.md`。

## AI 交互流

1. 用户选中编辑器文本或打开 AI 对话窗
2. 前端经 `/api/ai` 调用 ai-proxy（端口 3005）
3. ai-proxy 转发至配置的 LLM provider
4. 流式响应回填 UI；文本替换经 TipTap command 应用

浮动窗状态由 `useFloatingWindowState` 管理；注意 Ref 解包问题。

## 知识库 / 素材库

- Knowledge：`/api/knowledge` → ChromaDB + 文档解析（pypdf、docx、trafilatura）
- Library：`/api/library` → 本地素材索引与管理

## 图片处理

- 去背景：`/api/remove-bg`（rembg + onnxruntime）
- 编辑器内裁剪：前端 `@imgly/background-removal` 等

## 文档导出

`/api/export` 支持多格式（见 `export-service.js` 的 `SUPPORTED_FORMATS`）。Electron 主进程 `export-routes.js` 也有导出路径。

## 关键需求文档

| 文档 | 主题 |
|------|------|
| `docs/WPX-AI智能文档编辑器 - 产品需求文档 (PRD).md` | 产品总览 |
| `docs/AI助手-V1-需求文档.md` | AI 助手 V1 |
| `docs/WPX 多窗口独立编辑器架构设计.md` | 多窗口 |
| `docs/WPX桌面端 UIUX 设计规范 V1.0.md` | UI/UX |
| `docs/WPX 文件压缩解压缩功能需求文档.md` | 压缩功能（待实现） |

用 `wpx_list_docs` MCP 获取最新列表与摘要。

## 扩展新功能 checklist

1. 确认需求文档范围
2. 判断归属：渲染进程 / 主进程 / 独立微服务
3. 新 API 走 Vite proxy，在 `vite.config.js` 注册
4. 多窗口场景：状态是否 per-window
5. 补充 Vitest；用户流加 Playwright spec
