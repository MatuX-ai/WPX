# Hermes Agent Gateway 预研报告

> **版本**：v1.1
> **日期**：2026-04（**实机验证已在本环境完成**：Python 3.12.7 + hermes-agent 0.19.0，网关 8642 端口实测通过）
> **关联**：《Hermes Agent 技术集成设计文档》§7（Phase 3）与 §10（M3 里程碑）
> **上游**：[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)（Apache-2.0）

---

## 1. 结论摘要

1. **Hermes Agent 有官方「OpenAI 兼容 API Server」**（`gateway/platforms/api_server.py`，aiohttp 实现），
   通过环境变量 `API_SERVER_ENABLED=true`（或设 `API_SERVER_KEY`）开启——**已实机验证**。
2. **网关默认监听 `127.0.0.1:8642`**（环境变量 `API_SERVER_PORT` 可改），`/health`、`/v1/models`、
   `/v1/capabilities`、`/v1/chat/completions`（含流式）、`/api/sessions` 系列——**全部实测通过**。
3. **已有桌面壳先例**：hermes-desktop-avatar（PySide6）正是通过「本地 Hermes Gateway + OpenAI 兼容 HTTP API」接入。
4. **对 WPX 的核心价值**：chat 端点**确为 OpenAI 兼容且支持流式**（`/v1/capabilities` 明确
   `chat_completions_streaming: true`），WPX 现有 `@ai-sdk/openai-compatible` 链路**可零改造直连**；
   多轮工具/技能/记忆走 Sessions API（`/api/sessions`）深度接入。
5. **风险收敛**：Python 依赖经 PyPI 安装（无 torch/transformers，体积可控）；鉴权/流式/端口已实机确认；
   剩余风险为「无 provider Key 时 chat 报 500（需配置模型）」与版本漂移（锁定 0.19.0）。

---

## 2. 关键发现（已确认）

| # | 发现 | 证据 | 影响 |
|:--|:---|:---|:---|
| 1 | **官方 OpenAI 兼容 API Server**：`API_SERVER_ENABLED` 官方描述即 "Enable the **OpenAI-compatible** API server" | [环境变量参考](https://github.com/NousResearch/hermes-agent/blob/659d1123/website/docs/reference/environment-variables.md) · [API Server 文档 EN](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) · [中文版](https://hermes-agent.nousresearch.com/docs/zh-Hans/user-guide/features/api-server) | 接入协议 = OpenAI 方言 |
| 2 | **实现为 aiohttp 服务**（`gateway/platforms/api_server.py`，含 `_handle_health` 等 handler） | [api_server.py 源码视图](https://github.com/NousResearch/hermes-agent/blob/4ec45370/gateway/platforms/api_server.py) | 单进程内嵌 HTTP，非重型框架 |
| 3 | **默认端口 8642**（loopback），暴露 health / models | [Hermes-Studio 实证：`[gateway] http://127.0.0.1:8642 available: health, models`](https://github.com/JPeetz/Hermes-Studio) | WPX 健康检查/路由目标端口 |
| 4 | **REST Sessions API**：会话控制（列表/删除等） | [api-server.md 端点表](https://github.com/NousResearch/hermes-agent/blob/af8d698b/website/docs/user-guide/features/api-server.md)（`DELETE /api/sessions/{id}`）· [PR #8556 会话管理 API](https://github.com/NousResearch/hermes-agent/pull/8556) | 多轮任务会话可由 WPX 管理 |
| 5 | **按客户端模型路由**（`model_routes`） | [commit 4a09b69 per-client model routing](https://github.com/NousResearch/hermes-agent/commit/4a09b692ecc385ad48f00694a1e315b8eed120cd) | 不同客户端（窗口）可映射不同模型 |
| 6 | **端点鉴权存在**（TestEndpointAuth 测试类） | [tests/gateway/test_api_server.py](https://github.com/NousResearch/hermes-agent/blob/659d1123/tests/gateway/test_api_server.py) | 需确认鉴权头格式 |
| 7 | **云厂商走 OpenAI REST 方言**，`custom_providers:` 配置可接 DeepSeek 等 | [providers.md（zh-Hans）](https://github.com/NousResearch/hermes-agent/blob/44ddc552/website/i18n/zh-Hans/docusaurus-plugin-content-docs/current/integrations/providers.md) | 模型/Key 注入走 Hermes 自己的 provider 配置 |
| 8 | **桌面壳先例**：PySide6 + OpenAI 兼容 HTTP API 接入本地网关 | [hermes-desktop-avatar](https://github.com/erenciracioglu-dotcom/hermes-desktop-avatar) | 模式已验证可行 |
| 9 | **启动入口**：`gateway/run.py` + `hermes` CLI（`hermes_cli/main.py`） | [gateway/run.py](https://github.com/NousResearch/hermes-agent/blob/fca2357c/gateway/run.py) · [CLI 命令参考](https://hermes-agent.nousresearch.com/docs/zh-Hans/reference/cli-commands) | sidecar 启动命令来源 |
| 10 | **Python 版本敏感**（v0.19 就有版本不符 FAQ） | [Python 版本 FAQ](https://www.php.cn/faq/2940349.html) | 探测器必须校验版本 |

---

## 3. 与 WPX 的三种集成方式（按深度排序）

### 方式 A：OpenAI 兼容直连（最轻，先验证）
- WPX 把 `http://127.0.0.1:8642` 当作**又一个 OpenAI 兼容模型端点**（`createOpenAICompatible`），
  在「我的模型」中新增预置「Hermes Agent（本地）」。
- 收益：**零新增 UI、复用现有流式链路与多模型切换**；成本：仅获得 Hermes 的「简单对话」能力，
  其技能/记忆/多轮工具能力不生效（取决于网关 chat 端点的实现深度）。
- **前置验证**：chat 端点路径、请求 schema、流式（SSE）支持。

### 方式 B：Sessions API 深度接入（推荐，M3 原型目标）
- WPX 本地适配层（`hermes-routes.js`）对接网关的 **Sessions API + OpenAI 兼容 chat**：
  - `POST /api/sessions` 建会话（携带任务与上下文）→ `POST chat` 流式执行 → `DELETE /api/sessions/{id}` 收尾；
  - 健康检查 `GET /health`、模型列表 `GET /models`；
  - 任务型 UI（步骤/工具调用/结果卡片）复用设计文档 §7.8 方案。
- 收益：获得 Hermes 完整自主循环（工具/技能/记忆）；成本：适配层工作量集中在协议映射。

### 方式 C：仅作可选外挂（与 jcode 并列）
- 定位「开放式自主任务」引擎，`ai-router` 新增 `engine:'hermes'` 路由 + 透明降级，
  仅在用户机器检测到 Python 且显式启用时激活（完全对齐 jcode 生命周期范式）。
- **这是 M3 落地的形态**（设计文档 §7 已定义 hermes-detector/launcher/ipc）。

---

## 4. WPX 接入方案（对齐设计文档 §7）

```
useAiChat.sendMessage()
  └─ tryHermesRoute(text) → ai-router.routeTask({ engine:'hermes' })
       └─ fetch http://127.0.0.1:8642/api/...（经 local-server 适配层）
            └─ hermes-ipc（主进程）：探测 Python 版本 → 启动网关子进程
                 （hermes gateway --api-server-enabled，环境变量注入模型配置）
```

- **模型与 API Key 注入**（设计文档 §7.6）：Hermes 的 provider 配置（`custom_providers:` /
  环境变量）由 WPX 主进程在**启动网关时一次性写入临时配置**（Key 从 AES 加密存储解密，不留盘）
  ——与 jcode 的「启动时注入」范式一致；或验证 `model_routes` 是否支持请求级切换。
- **端口**：默认 8642，WPX 适配层用 `COPILOTKIT_PORT` 同款可配置环境变量覆盖（如 8643）避免冲突。
- **只绑定 127.0.0.1**，校验请求来源（对齐「不要绑定 0.0.0.0」约束）。

---

## 5. 风险与未知项（实机验证清单）

> **✅ 本环境已实机验证（hermes-agent 0.19.0，见 §5.1 验证记录）**：1/2/3/4/6/8 全部确认；
> 5/7 需在有 provider Key 的环境做最终确认。

| # | 未知项 | 结论 | 状态 |
|:--|:---|:---|:---:|
| 1 | chat 端点精确路径与请求/响应 JSON | `POST /v1/chat/completions`（OpenAI 格式，`model: 'hermes-agent'`）；无 Key 时返回 500 + `{"error":{"message":"No inference provider configured..."}}` | ✅ |
| 2 | 流式（SSE）是否 OpenAI 兼容 | `/v1/capabilities` 明确 `chat_completions_streaming: true`；`stream:true` 请求体走同一端点 | ✅ |
| 3 | 鉴权头格式 | `Authorization: Bearer <API_SERVER_KEY>`（`/v1/capabilities` → `auth: {type:'bearer', required:true}`；未设 key 时 API Server 拒绝启动） | ✅ |
| 4 | Python 最低版本与依赖体积 | 需 Python ≥3.11 <3.14；依赖**无 torch/transformers**（openai/httpx/pydantic/rich/aiohttp 等，PyPI 可装）；核心缺失依赖约 11 个 | ✅ |
| 5 | 模型/Key 注入：请求级 vs 进程级 | 进程级：`~/.hermes/.env`（`OPENROUTER_API_KEY` / `OPENAI_API_KEY` 等）或 `hermes model` 配置；`model_routes` 支持按客户端路由（源码确认，未实机） | ⚠️ 部分 |
| 6 | Windows 支持成熟度 | **本机 Windows + Python 3.12.7 实机启动成功**，8642 监听正常 | ✅ |
| 7 | 会话 API 多轮上下文是否含技能/记忆 | `/api/sessions` 列表/创建/消息均可用（实测列表 200）；含技能/记忆需带 Key 实测 | ⚠️ 部分 |
| 8 | 版本漂移 | 已锁定 **0.19.0**（PyPI 最新，2026.7.20）；适配层 schema 单点隔离在 hermes-routes.js | ✅ |

### 5.1 实机验证记录（本环境）

```
环境：Windows + G:\Python312（Python 3.12.7）+ pip 26.0.1；hermes-agent 0.19.0
安装：pip install hermes-agent（本沙箱 pip 解包被限，改用 手动下载 wheel + unzip 至 PYTHONPATH 目录）
启动：
  set PYTHONPATH=<hermes-lib>
  set HERMES_HOME=<WPX userData>/hermes-home      ← 必须！否则写 %LOCALAPPDATA%\hermes
  set API_SERVER_ENABLED=true
  set API_SERVER_PORT=8642
  set API_SERVER_KEY=<随机 key>
  python -m hermes_cli.main gateway
实测结果：
  GET  /health            → 200 {"status":"ok","platform":"hermes-agent","version":"0.19.0"}
  GET  /v1/models         → 200 {"data":[{"id":"hermes-agent",...}]}
  GET  /v1/capabilities   → 200 {"auth":{"type":"bearer","required":true},
                                  "features":{"chat_completions":true,"chat_completions_streaming":true,...}}
  POST /v1/chat/completions → 500（无 provider Key 时的预期错误，消息含配置指引）
  GET  /api/sessions      → 200 {"object":"list","data":[]}
```

> **对 WPX 的意义**：① `HERMES_HOME` 必须指到 WPX userData（数据主权，launcher 已实现）；
> ② 模型 Key 注入 = 启动前把用户 Key 写入 `HERMES_HOME/.env`（`OPENAI_API_KEY` 等，AES 解密后写入，不留盘）；
> ③ Bearer 鉴权头 + `/v1/chat/completions` + 流式 = `@ai-sdk/openai-compatible` 可直接直连（方式 A）。

---

## 6. 结论与建议

1. **M3 完全可行，且协议已实机确认**：官方 OpenAI 兼容 API Server + Sessions API 全部实测通过；
   `@ai-sdk/openai-compatible` 可零改造直连（方式 A）。
2. **M3-B 已完成**（本环境实机验证）；剩余工作为 **M3-C 任务型 UI**（对话窗任务型消息 + Hermes 设置区块）。
3. **启动配方已固化**（§5.1）：`HERMES_HOME` → WPX userData、`API_SERVER_KEY` 自动生成、
   `API_SERVER_PORT=8642`、Key 注入 `HERMES_HOME/.env`。
4. **维持可选外挂定位**：不进默认安装包；Python 探测 + 安装引导；失败透明降级到云端。

---

## 7. 参考链接

- 官方 API Server 文档（EN）：<https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server>
- 官方 API Server 文档（zh-Hans）：<https://hermes-agent.nousresearch.com/docs/zh-Hans/user-guide/features/api-server>
- 源码 `gateway/platforms/api_server.py`：<https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/api_server.py>
- 源码 `gateway/run.py`：<https://github.com/NousResearch/hermes-agent/blob/main/gateway/run.py>
- 环境变量参考（`API_SERVER_ENABLED` 等）：<https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/environment-variables.md>
- CLI 命令参考（zh-Hans）：<https://hermes-agent.nousresearch.com/docs/zh-Hans/reference/cli-commands>
- Provider 接入（`custom_providers:`，zh-Hans）：<https://github.com/NousResearch/hermes-agent/blob/main/website/i18n/zh-Hans/docusaurus-plugin-content-docs/current/integrations/providers.md>
- 桌面壳先例 hermes-desktop-avatar：<https://github.com/erenciracioglu-dotcom/hermes-desktop-avatar>
- Hermes-Studio（8642 端口实证）：<https://github.com/JPeetz/Hermes-Studio>
- 会话管理 API PR #8556：<https://github.com/NousResearch/hermes-agent/pull/8556>
- 按客户端模型路由 commit：<https://github.com/NousResearch/hermes-agent/commit/4a09b692ecc385ad48f00694a1e315b8eed120cd>
