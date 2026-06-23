---
name: wpx-development
description: >-
  WPX 本地开发与调试工作流。在启动应用、修改 Electron/Vue 代码、调用本地 API、
  排查多窗口或代理问题时使用。涵盖目录结构、端口、启动命令与常见陷阱。
---

# WPX 开发工作流

## 项目结构

| 路径 | 用途 |
|------|------|
| `wpx-app/src/` | Vue 3 前端（TipTap 编辑器、AI 组件、Pinia stores） |
| `electron/` | Electron 主进程、窗口管理、IPC |
| `wpx-app/src/server/` | 本地微服务（Node + Python FastAPI） |
| `docs/` | PRD、架构、UI 规范等需求文档 |

## 启动命令

```bash
# 完整 Electron 开发（Vite 5173 + Electron）
npm run electron:dev

# 多窗口调试（默认 3 个窗口）
npm run electron:dev:multi

# 仅前端 Vite
cd wpx-app && npm run dev
```

PowerShell 用 `;` 分隔命令，不要用 `&&`。

## 本地服务端口

| 服务 | 端口 | Vite 代理 |
|------|------|-----------|
| Vite dev | 5173 | — |
| export | 3001 | `/api/export`, `/api/health` |
| remove-bg | 3002 | `/api/remove-bg` |
| knowledge | 3003 | `/api/knowledge` |
| library | 3004 | `/api/library` |
| ai-proxy | 3005 | `/api/ai` |

前端通过 Vite proxy 访问，不要硬编码 `localhost:300x`（除 E2E mock 外）。

## MCP 工具

优先使用 `wpx-dev` MCP：
- `wpx_check_services` — 检查各服务是否在线
- `wpx_project_map` — 端口与命令速查
- `wpx_list_docs` — 需求文档索引

浏览器调试 E2E 流程时用 `playwright` MCP（`http://localhost:5173`）。

## Vue / Pinia 注意点

1. **Ref 在对象属性中不会自动解包**：`useFloatingWindowState` 返回的 computed 嵌在普通对象里时，模板传 props 需用 computed 再解包（见 `AiAssistantPlaceholder.vue`）。
2. **路径别名**：`@` → `wpx-app/src`。
3. **UI 文案为中文**：选择器、aria-label 优先用中文可见文案。

## Electron 多窗口

- 入口：`electron/run-dev.js`，`--multi` 或 `--windows=N` 控制初始窗口数。
- 各窗口独立编辑器状态，调试时注意 `window-manager.js` 与 IPC 通道。
- 开发默认开启 DevTools：`WPX_DEV_AUTO_DEVTOOLS=1`。

## 修改后端服务后

Python 服务需手动重启；Node 服务（export、ai-proxy）同理。改 `vite.config.js` proxy 后重启 Vite。

## 需求变更前

先查 `docs/` 或调用 `wpx_list_docs`，确认与 PRD / 架构文档一致再实现。
