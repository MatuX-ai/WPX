# WPX 用户注册与账户系统需求文档

**版本**：V2.0  
**状态**：定稿（架构迁移到自托管认证）  
**关联文档**：PRD、用户中心（设置）、字体库需求、部署域名

> **架构变更摘要（v1.x → v2.x）**：
> - 取消对接外部 `account.proclaw.cc` 统一认证服务
> - 改为 **自托管邮箱+密码+验证邮件** 认证体系，统一由 `https://prowpx.com` 提供
> - 应用内嵌 **AuthModal** 登录/注册表单，**不再**跳转外部浏览器或 `wpx://` 协议回调
> - 后端 PostgreSQL 新增 `users` 表（密码 bcryptjs 哈希、邮箱验证 token、密码重置 token）
> - SMTP 服务发送验证邮件与密码重置邮件

---

## 1. 概述

WPX 采用**访客优先、按需注册**的认证策略。用户无需注册即可使用大部分功能；**AI 对话**在未注册时可自行配置本地大模型 API 免费使用，**WPX 公共大模型**与**字体 Token 购买**需登录。注册用户可获得 WPX 公共大模型的每日 Token 额度及商业字体授权。

**核心原则**：

- 不强制注册，工具免费，算力与内容付费。
- 访客数据完全本地，注册后可选择云同步。
- **自托管认证服务**，统一域名 `prowpx.com`，所有认证接口走 `https://prowpx.com/api/auth/*`。
- **公共大模型配额按 Token 计量**（与平台向上游采购大模型的计费方式一致），不按「调用次数」计数。

---

## 2. 两种用户状态

### 2.1 访客（未登录）

| 维度 | 说明 |
|:---|:---|
| **标识** | 本地生成匿名设备 ID，无个人身份 |
| **可用功能** | 全部编辑器、表格、图片处理、skillhub 免费 Skills、内置免费字体、自导入字体 |
| **AI 能力** | **不提供** WPX 公共大模型免费额度；可在「我的模型」页配置自己的大模型 API（Endpoint / API Key / 模型名），配置后直接使用 |
| **自定义模型** | **可见且可配置**；API Key 仅 AES 加密存储在本机，不上传服务器 |
| **字体 Token** | 不可购买，不可使用 WPX 字体商店商业字体导出 |
| **数据存储** | 全部存储在本地（Electron `userData`），不清除缓存则保留 |
| **跨设备** | 不支持 |

### 2.2 注册用户（已登录）

| 维度 | 说明 |
|:---|:---|
| **标识** | 通过自托管邮箱+密码登录，凭 JWT token 绑定用户 ID |
| **可用功能** | 访客全部功能 + 以下增强 |
| **AI 能力** | 可使用 WPX 公共大模型（消耗每日 Token 额度或充值 Token），也可配置自己的 API Key 使用第三方模型；**优先使用自定义模型** |
| **自定义模型** | 可配置文本 / 图片识别模型，加密存储 API Key（与访客相同，仅本地） |
| **字体 Token** | 可充值购买 Token，使用 WPX 字体商店商业字体导出 |
| **数据存储** | 本地存储 + 可选的云端同步（未来） |
| **跨设备** | 登录后偏好和设置可同步（未来） |

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

## 4. 功能限制与引导

### 4.1 模型调用优先级

1. **用户自定义模型**（已保存 API Key 且来源为「自定义」）— 最高优先级，不消耗 WPX 公共 Token 额度。
2. **WPX 公共大模型** — 仅**已登录**用户可用；消耗每日免费 Token 额度或账户充值 Token。
3. **访客** — 无 WPX 公共模型权限；未配置自定义 API 时，AI 提示配置接口并提供「去配置」入口。

### 4.2 公共大模型 Token 配额（不按次数）

WPX 向上游采购大模型按 **Token** 计费，因此对用户的公共模型免费额度也按 **Token** 计量，**不得**按「每日调用次数」计数。

| 项目 | 说明 |
|:---|:---|
| **计量单位** | Token（通常取模型返回的 `total_tokens`，含输入 + 输出；若无 usage 字段则按平台约定估算） |
| **访客** | **0 Token/天** — 不提供公共大模型免费额度 |
| **注册用户** | 后台可配置每日免费 Token 额度，默认建议 **100M Token/天**（按用户 ID 累计，每日 0 点重置） |
| **扣减时机** | 每次平台模型对话**完成后**，按本次实际消耗 Token 数累加至当日已用量 |
| **调用前检查** | 发起平台模型请求前，检查当日剩余 Token > 0；否则拦截并提示 |
| **额度用尽** | 若用户**未配置**自定义 API Key：提示「免费 Token 额度已用完。你可以配置自己的大模型 API（免费）继续使用 AI 能力。」并提供「去配置」 |
| **额度用尽（已配置自定义 Key）** | 提示充值 Token 或次日再试 |

**说明**：最后一次请求可能略超出剩余额度（实际消耗大于剩余时仍完成当次回复），次日重置后恢复。

### 4.3 引导登录 / 配置的场景

| 触发点 | 引导语 / 行为 |
|:---|:---|
| 访客未配置 API 使用 AI | 「您无需注册，但是需要配置自己的大模型 API 接口才能使用 AI 能力。」→ **去配置**；可选 **注册 / 登录** |
| 「我的模型」页（访客） | 仅展示自定义模型配置；隐藏「WPX 公共大模型」选项；可提示注册后获得每日约 100M Token 公共额度 |
| 「我的模型」页（已登录） | 可选 WPX 公共大模型（消耗 Token）或自定义模型 |
| 字体商店 | 「登录后可购买 Token，使用商业字体导出」 |
| Token 充值页 | 「登录后可充值 Token，管理余额」 |
| 公共 Token 额度用尽（已登录、无自定义 Key） | 「免费 Token 额度已用完…」→ **去配置** |
| Skills 中需要登录的 | 「该高级技能需要登录后使用」 |

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