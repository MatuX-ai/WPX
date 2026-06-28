---
name: jcode-integration
description: >-
  WPX 集成 jcode 高性能 AI 引擎的开发工作流。在新增/修改 jcode 检测、启动器、IPC、
  local-server 适配、AI 调度中心、设置面板、状态指示器或对应测试时使用。
---

# jcode 集成开发工作流

## 架构

```
WPX 前端 (Vue3 + Tiptap + CopilotKit)
    ↓
WPX 主进程 (Electron + Node.js)
    ↓
┌─────────────────────────────────────┐
│         AI 调度中心                  │
│   - 任务复杂度判断 (ai-router)       │
│   - 引擎路由 (jcode / 云端 API)      │
│   - 降级策略                        │
└─────────────────────────────────────┘
    ↓                           ↓
┌───────────────┐       ┌───────────────┐
│   jcode 引擎   │       │  云端 AI API   │
│ (可选外挂)     │       │ (DeepSeek等)   │
│ 127.0.0.1:8765│       │               │
└───────────────┘       └───────────────┘
```

## 模块清单

| 层 | 文件 | 职责 |
|---|---|---|
| 主进程 service | `electron/services/jcode-store.js` | 偏好持久化(enabled/preStart/useForComplexTasks) |
| 主进程 service | `electron/services/jcode-detector.js` | 跨平台检测 `jcode` 可执行文件 + 版本解析 |
| 主进程 service | `electron/services/jcode-launcher.js` | 启动/停止 jcode 守护进程、5min 空闲休眠 |
| 主进程 service | `electron/services/jcode-routes.js` | local-server 上的 `/api/jcode/*` HTTP/Stream 端点 |
| 主进程 IPC | `electron/jcode-ipc.js` | 10 个 `jcode:*` IPC 通道 + 状态广播 |
| 主进程桥接 | `electron/jcode-memory-bridge.js` | 清除 jcode 记忆时联动 memory-service |
| 本地服务 | `wpx-app/src/server/ai-router.js` | `shouldUseJcode` + `routeTask`(降级透明) |
| 前端 util | `wpx-app/src/utils/jcodeApi.js` | 封装 `electronAPI.jcode.*` |
| 前端 store | `wpx-app/src/stores/jcodeSettings.js` | jcode 状态 + 偏好 + 实时订阅 |
| 前端 UI | `wpx-app/src/views/settings/JcodeSettings.vue` | 设置面板(状态徽章 + 三开关) |
| 前端 UI | `wpx-app/src/components/ai/JcodeStatusIndicator.vue` | AiAvatar 旁的状态圆点 |

## 端口与协议

- jcode 默认监听 `127.0.0.1:8765`
- WPX local-server 暴露:
  - `GET  /api/jcode/health`
  - `POST /api/jcode/swarm` (HTTP 同步,60s 超时)
  - `POST /api/jcode/swarm/stream` (chunked 流式)
  - `POST /api/jcode/memory/clear`
- Vite proxy: `/api/jcode → http://127.0.0.1:<local-server-port>`

## 路由规则(ai-router 决策表)

| 命中模式 | 路由 |
|---|---|
| `教案|PPT|幻灯片|论文|开题报告|文献综述|分析.*资料库|多章节|长篇|全书|高性能模式` | jcode |
| `润色|改写|翻译|总结|摘要|缩写|扩写|改.*字体|换.*颜色|加粗|斜体` | 云端 API |
| 字数 > 200 或含「然后」 | jcode |
| 用户强制 `forceJcode=true` | jcode |

降级触发:未安装/未启动/超时/异常 → 自动回退到云端,响应带 `fallbackReason: 'jcode_unavailable'`,前端 toast 提示。

## 空闲休眠策略

- `markActivity()` 每次任务完成调用,重置 5 分钟计时器
- 计时器到期 → 保存会话状态 → `stopJcode()`(SIGTERM → 5s 后 SIGKILL)
- 用户开启 `preStart` 时,WPX 启动后静默 `startJcode()` 消除首次延迟

## 合规边界

- **仅支持官方 API Key**:jcode-store 不存储任何 Key,Key 仍由 model-secrets-store 加密保管
- **记忆本地化**:jcode 记忆文件存 `userData/jcode/memory/`,清除时同步清 WPX memory-service
- **非官方渠道风险提示**:设置面板底部固定黄色提示,不可关闭
- **降级 100% 透明**:用户感受不到路由切换,功能不中断

## 实施阶段

| 阶段 | 内容 | 关键文件 |
|---|---|---|
| 0 | Skill + MCP | 本文件 + `.cursor/mcp/wpx-jcode-server.mjs` |
| 1 | 主进程 service 三件套 | jcode-store / detector / launcher |
| 2 | 主进程 IPC | jcode-ipc / memory-bridge / main.js 接线 |
| 3 | local-server 适配 | jcode-routes / local-server 注册 |
| 4 | AI 调度中心 | ai-router / copilotkit-runtime 集成 |
| 5 | 前端 UI | jcodeApi / store / 设置面板 / 状态指示器 |
| 6 | Vite proxy + 测试 | vite.config + 4 个 vitest spec |
| 7 | 文档同步 + 验收 | 更新现有 3 个 skill + 验证脚本 |

## 调试技巧

- 用 MCP `wpx_jcode_detect` 看本地 jcode 状态
- 用 MCP `wpx_jcode_health` 探活
- 用 MCP `wpx_jcode_call_swarm` 模拟一次复杂任务
- DevTools console 直接调 `window.electronAPI.jcode.*`
- 主进程日志搜 `[jcode]` 前缀

## 常见陷阱

- PowerShell 用 `;` 分隔命令,不要用 `&&`
- 跨平台:Windows `where jcode`(shell:true),macOS/Linux `which jcode`
- 卸载命令三平台不同:Windows `winget uninstall`,macOS `brew uninstall`,Linux 提示手动
- 多窗口:状态广播走 `webContents.send` 推到所有窗口
- jcode 引擎本身**不在本任务范围**,安装按钮是引导用户到 `https://jcode.dev/install`
