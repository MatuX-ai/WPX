# WPX 用户注册与账户系统需求文档

**版本**：V2.2（已实现）  
**状态**：已实现（自托管认证体系全部就绪）  
**关联文档**：PRD、用户中心（设置）、字体库需求、部署域名、[技术架构总览 V2.0](./WPX%20技术架构总览%20V2.0.md)  
**最后更新**：2026-06-28

---

## 〇、业务模式变更说明（V2.0 → V2.1）

> **重要变更**：自 V2.1 起，WPX 取消与平台大模型相关的账户价值：

1. **取消「WPX 公共大模型」与每日 Token 额度**：不再有「注册即得 100M Token/天」等机制；不再有「公共大模型 Token 配额」按 Token 计量。
2. **取消「商业字体 Token 充值」**：不再与 Font Market、Token 充值打通；字体需求由用户自行处理（详见 [WPX 字体库需求文档](./WPX%20字体库需求文档.md)）。
3. **保留自托管认证体系**：邮箱+密码+验证邮件认证、JWT Token 机制、CORS 白名单、安全规范等**保留不变**（仍可作为跨设备偏好同步的接入点）。
4. **账户核心价值重新定位**：账号仅作为「跨设备偏好同步」「设置与 Skills 状态备份」的标识；不再提供「AI 算力额度」「字体 Token」等与 WPX 平台服务相关的资源。
5. **「我的模型」页调整**：仅保留「用户自定义大模型 API」配置入口；**完全移除**「WPX 公共大模型」单选项及所有相关文案。

本文档下述章节已按上述变更同步更新。

---

## 1. 概述

WPX 采用**访客优先、按需注册**的认证策略。用户无需注册即可使用全部编辑器功能；AI 对话需用户在「我的模型」中自行配置第三方大模型 API Key 后即可使用。**WPX 不再提供任何公共大模型或字体 Token 服务**。

**核心原则**：

- 不强制注册，工具免费，算力与内容由用户自供。
- 访客数据完全本地，注册后可选择云同步（仅同步偏好与 Skills 状态，**不**同步文档）。
- **自托管认证服务**，统一域名 `prowpx.com`，所有认证接口走 `https://prowpx.com/api/auth/*`。
- **完全免费使用**：无任何 Token、积分、配额等计费机制。

---

## 2. 两种用户状态

### 2.1 访客（未登录）

| 维度 | 说明 |
|:---|:---|
| **标识** | 本地生成匿名设备 ID，无个人身份 |
| **可用功能** | 全部编辑器、表格、图片处理、skillhub 免费 Skills、内置免费字体、自导入字体 |
| **AI 能力** | 可在「我的模型」配置自己的大模型 API（Endpoint / API Key / 模型名），配置后直接使用；**WPX 不提供任何公共大模型服务** |
| **自定义模型** | 可见且可配置；API Key 仅 AES 加密存储在本机，不上传服务器 |
| **字体** | 使用内置免费字体或「导入本地字体」；**不提供商业字体商店与 Token 充值** |
| **数据存储** | 全部存储在本地（Electron `userData`），不清除缓存则保留 |
| **跨设备** | 不支持 |

### 2.2 注册用户（已登录）

| 维度 | 说明 |
|:---|:---|
| **标识** | 通过自托管邮箱+密码登录，凭 JWT token 绑定用户 ID |
| **可用功能** | 访客全部功能 + 偏好与 Skills 状态跨设备同步 |
| **AI 能力** | 与访客一致：仅可使用「我的模型」中配置的第三方大模型 API；**WPX 不提供任何公共大模型或配额** |
| **自定义模型** | 可配置文本 / 图片识别模型，加密存储 API Key（与访客相同，仅本地） |
| **字体** | 与访客一致：内置免费字体 + 本地导入；**不提供商业字体** |
| **数据存储** | 本地存储 + 可选的偏好与 Skills 状态云端同步（未来） |
| **跨设备** | 登录后偏好和 Skills 状态可同步（未来） |

---

## 3. 认证流程

### 3.1 应用启动

1. 应用启动，检查本地是否存在有效 JWT。
2. 有 token → 调用 `https://prowpx.com/api/auth/me` 校验有效性（Bearer JWT）。
   - 有效 → 进入登录状态，加载用户偏好。
   - token 过期 → 调用 `https://prowpx.com/api/auth/refresh` 换取新 token；失败则清除本地 token，进入访客模式。
3. 无 token → 进入访客模式，生成或读取本地匿名设备 ID。

### 3.2 登录（嵌入式 AuthModal）

1. 用户点击界面上的「登录 / 注册」按钮（TitleBar 或 AI 对话窗顶部）。
2. 应用内弹出 **AuthModal** 组件（`role="dialog"`），**不**跳转外部浏览器。
3. AuthModal 包含：邮箱、密码、「登录」按钮、「立即注册」链接、关闭按钮。
4. 用户填写邮箱 + 密码，点击 **「登录」**。
5. 应用发起 `POST https://prowpx.com/api/auth/login { email, password }` 请求。
6. 后端校验通过后返回 `{ token, refresh_token, user }`。
7. 前端 `useAuth().loginDirect()` 调用 `authStore.login()`，将 token 写入 Electron `safeStorage` 加密存储。
8. AuthModal 自动关闭，TitleBar 切换为已登录状态。

> 备选流程：用户点击「立即注册」→ 表单切换到注册模式 → 提交 `POST /api/auth/register { email, password, nickname? }` → 后端同时发送验证邮件 → 自动登录态。

### 3.3 登出

1. 用户点击「退出登录」。
2. 应用发起 `POST https://prowpx.com/api/auth/logout` 请求（携带 Bearer JWT）。
3. 清除本地存储的 JWT / refresh_token / 用户偏好缓存。
4. 恢复为访客模式；若未配置自定义 API，AI 需引导用户前往「我的模型」配置。
5. 本地文档和字体保留，不受影响。

### 3.4 Token 刷新

- JWT 短期有效（默认 **2 小时**），refresh_token 长期有效（默认 **30 天**）。
- 每次调用 `https://prowpx.com/api/auth/*` 时，若 token 即将过期（或返回 401），自动用 refresh_token 换取新 token：
  - `POST https://prowpx.com/api/auth/refresh { refresh_token }` → `{ token, refresh_token, user }`
- 刷新失败则强制登出，提示重新登录。

### 3.5 邮箱验证与密码重置

- **邮箱验证**：
  1. 用户注册成功后，后端生成 `email_verify_token` 并通过 SMTP 发送验证邮件。
  2. 邮件链接：`https://prowpx.com/auth/verify-email?token=<token>`
  3. 用户点击链接，应用跳转到 `VerifyEmailView`，自动 `GET /api/auth/verify-email?token=...`。
  4. 后端校验 token 未过期 → 设置 `email_verified=true` → 返回成功。
- **密码重置**：
  1. AuthModal 提供「忘记密码」入口，跳转 `ForgotPasswordView`。
  2. 用户填写邮箱 → `POST /api/auth/forgot-password { email }` → 后端发送重置邮件。
  3. 邮件链接：`https://prowpx.com/auth/reset-password?token=<token>`
  4. 用户点击链接，跳转 `ResetPasswordView`，输入新密码 → `POST /api/auth/reset-password { token, password }`。
  5. 后端校验 token → 更新 `password_hash`（bcryptjs cost=12）→ 返回成功。

---

## 4. 功能限制与引导（V2.1 简化版）

> **V2.1 起**：WPX 不再提供任何公共大模型服务。以下 4.1~4.3 节为 V2.0 历史内容，**已废弃**。

### 4.1 当前模型调用（V2.1+）

1. **用户自定义模型**（唯一可用路径）— 用户在「我的模型」中配置第三方 API，AES 加密存储在本机。
2. **未配置时**：AI 对话窗显示引导卡片与「去配置」按钮。
3. **WPX 公共大模型** — **V2.1 已下线，不存在**。

### ~~4.1 模型调用优先级（V2.0，已废弃）~~

~~1. **用户自定义模型**（已保存 API Key 且来源为「自定义」）— 最高优先级，不消耗 WPX 公共 Token 额度。~~
~~2. **WPX 公共大模型** — 仅**已登录**用户可用；消耗每日免费 Token 额度或账户充值 Token。~~
~~3. **访客** — 无 WPX 公共模型权限；未配置自定义 API 时，AI 提示配置接口并提供「去配置」入口。~~

### ~~4.2 公共大模型 Token 配额（V2.0，已废弃）~~

~~WPX 向上游采购大模型按 **Token** 计费，因此对用户的公共模型免费额度也按 **Token** 计量。~~ 自 V2.1 起，公共大模型及所有 Token 配额机制**全部下线**。

### ~~4.3 引导登录 / 配置的场景（V2.0，已废弃）~~

~~V2.0 时期的引导策略已不再适用。V2.1+ 的引导策略：AI 对话窗在用户未配置自定义 API 时显示引导卡片。~~

---

## 5. 对接 `https://prowpx.com/api/auth/*` 接口

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| `/api/auth/register` | POST | 邮箱 + 密码注册新账号（同时发验证邮件） |
| `/api/auth/login` | POST | 邮箱 + 密码登录，返回 token / refresh_token / user |
| `/api/auth/refresh` | POST | 用 refresh_token 换新 token |
| `/api/auth/logout` | POST | 登出，作废 refresh_token |
| `/api/auth/me` | GET | 获取当前用户基本信息（Bearer JWT） |
| `/api/auth/forgot-password` | POST | 请求密码重置邮件 |
| `/api/auth/reset-password` | POST | 用 token + 新密码重置密码 |
| `/api/auth/verify-email` | GET | 用 token 验证邮箱 |

**响应通用字段**：
- `token` (JWT access token，2h 有效)
- `refresh_token` (30d 有效)
- `user`：`{ id, email, nickname, avatar, email_verified, status, roles, created_at }`

**错误响应**：
- `400 Bad Request`：参数缺失或格式错误
- `401 Unauthorized`：JWT 无效或过期
- `403 Forbidden`：账号被禁用 / 封禁
- `404 Not Found`：资源不存在
- `409 Conflict`：邮箱已注册 / token 已使用
- `429 Too Many Requests`：接口限流（密码重置等敏感操作）

WPX 前端（Electron / Web / Admin）通过相对路径或环境变量 `VITE_API_BASE_URL` 拼接 `prowpx.com/api/auth/*`；其他服务（skillhub、ai、字体商店）通过 WPX 后端中转或直接调用时附带 JWT。

---

## 6. 数据隔离与隐私

- **访客数据**：所有文档、上传资料、对话历史存于本地，不上传服务器。
- **登录用户**：本地数据不变，用户可选择开启云端同步（未来功能，同步到 `prowpx.com` 关联的存储服务）。
- **API Key 存储**：无论访客还是登录用户，自定义 API Key 均 AES 加密存储在本地，不经过 WPX 服务器。
- **Token 消费记录**：仅登录用户产生，存储在 WPX 后端，关联用户 ID。
- **密码存储**：服务端 bcryptjs 哈希（cost factor 12），**永远不**明文存储或返回。

---

## 7. 界面元素

### 7.1 登录状态指示

- TitleBar 右侧或 AI 对话窗顶部显示用户状态：
  - 访客：显示「未登录」文字 + 登录按钮。
  - 登录用户：显示头像（可选）+ 昵称，点击弹出「我的设置」「退出登录」菜单。

### 7.2 AuthModal 嵌入式登录表单

- 组件：`src/components/auth/AuthModal.vue`
- 触发：`useAuth().login()` / `useAuth().register()`
- 表单字段：
  - 邮箱（type=email, autocomplete=email, required）
  - 密码（type=password，可切换显示）
  - 昵称（仅注册模式，可选）
- 行为：
  - 登录模式 / 注册模式切换
  - 邮箱格式正则校验：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - 密码长度 ≥ 8 位（注册）
  - 提交后按钮禁用 + 「登录中…/注册中…」文案
  - 成功后自动关闭模态框

### 7.3 设置页调整

- **「我的模型」**：访客与登录用户均可进入；访客仅自定义模型，登录用户可选公共模型或自定义。
- **字体与 Token**：访客模式下显示引导登录遮罩，不展示充值等完整功能。

---

## 8. 安全考虑

- JWT 存储在 Electron 的 `safeStorage` 或 `electron-store` 加密字段；Web 端 `sessionStorage`（E2E 测试用）。
- **不再**使用 `wpx://` 自定义协议回调（已移除以减少攻击面）；所有认证交互在应用内完成。
- 每次启动时校验 token 有效性，防止过期 token 被盗用。
- 所有到 `prowpx.com` 的请求使用 HTTPS。
- 密码哈希使用 bcryptjs（cost=12）；token 通过 HS256 JWT + issuer/audience 校验。
- SMTP 邮件中的验证 / 重置 token 24h 过期，单次有效。
- 密码重置接口限流（建议 1 分钟 1 次、每小时 5 次）。
- CORS 白名单：仅允许 `https://prowpx.com`、`https://www.prowpx.com`、`https://admin.prowpx.com`（即 `prowpx.com/admin`）以及开发环境 localhost。

---

## 9. 验收标准

1. 首次启动应用，无需登录，进入访客模式，可正常编辑文档。 ✅
2. 访客未配置自定义 API 时，AI 提示配置大模型接口并提供「去配置」；**不**提供公共大模型免费额度。 ✅
3. 访客可在「我的模型」配置 Endpoint / API Key / 模型名，保存后 AI 使用自定义模型。 ✅
4. 点击登录，弹出嵌入式 AuthModal，填写邮箱+密码后立即变为登录状态。 ✅
5. 登录后，可添加自定义 API Key，或使用 WPX 公共大模型；自定义优先于公共模型。 ✅
6. 登录用户使用公共模型时，配额按 **Token** 扣减（非按次数）；默认每日约 100M Token 免费额度（可后台配置）。 ✅
7. 公共 Token 额度用尽且未配置自定义 Key 时，提示配置自有 API 并提供「去配置」。 ✅
8. 登录后，可充值 Token 并使用商业字体导出。 ✅
9. 退出登录后，恢复访客模式；「我的模型」仍可用（仅自定义），字体 Token 页受限。 ✅
10. 本地 JWT 过期后自动 refresh；refresh 失败则强制登出。 ✅
11. 导入的字体、本地文档在登出后仍保留。 ✅
12. 注册时后端通过 SMTP 发送验证邮件，点击邮件链接后 `email_verified=true`。 ✅
13. 忘记密码流程可走通：填写邮箱 → 收到重置邮件 → 点击链接 → 输入新密码 → 可用新密码登录。 ✅

---

**关联 docs 摘要**：[docs/用户认证与模型配额需求.md](docs/用户认证与模型配额需求.md)（Token 配额与模型策略速查）。