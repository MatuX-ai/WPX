# 认证与模型配额 — 手工测试清单

与 [WPX 用户注册与账户系统需求文档.md](../../WPX%20用户注册与账户系统需求文档.md) 及 [docs/用户认证与模型配额需求.md](../../docs/用户认证与模型配额需求.md) 对齐。

> **架构变更（v1.x → v2.x）**：旧 `account.proclaw.cc` 统一认证服务已下线，
> WPX 改为 **自托管邮箱+密码+验证邮件** 体系：
> - 认证接口：`https://prowpx.com/api/auth/*`（`login`、`register`、`refresh`、`me`、`logout`、`forgot-password`、`reset-password`、`verify-email`）
> - 登录入口：应用内嵌 **AuthModal** 组件（不再跳转外部浏览器 / `wpx://` 协议回调）
> - 用户数据：本项目后端 PostgreSQL（`users` 表），密码 bcryptjs 哈希、邮箱验证 token、密码重置 token
> - AI 子域：`https://ai.prowpx.com/api/free/quota`

| # | 场景 | 自动化 E2E | 手工 |
|---|------|------------|------|
| 1 | 首次启动访客，TitleBar 显示登录 | ✅ | 可选复核 |
| 2 | 访客可打开「我的模型」并配置自定义 API | ✅ | 可选复核 |
| 3 | 访客未配置 API 时 AI 提示去配置 | ✅ | 可选复核 |
| 4 | 点击登录弹出嵌入式 AuthModal，提交后登录成功 | ✅ | 可选复核 |
| 4b | 点击登录后关闭 AuthModal 保持访客 | ✅ | 可选复核 |
| 4c | 在 AuthModal 中切换到「注册」并提交 | ✅ | 可选复核 |
| 5 | 登录后 TitleBar 显示用户，可退出 | ✅ | 可选复核 |
| 6 | 登录后可配置 API 并测试连接 | ✅ | 可选复核 |
| 7 | 登录后可充值 Token、商业字体导出 | ✅ | 可选复核 |
| 8 | 退出后访客仍可进「我的模型」，字体页受限 | ✅ | 可选复核 |
| 9 | 重启后 JWT 有效则保持登录 | ✅ | 可选复核 |
| 10 | JWT 刷新失败恢复访客 | ✅ | 可选复核 |
| 11 | 登录用户公共 Token 额度用尽 → 去配置 | ✅ | 可选复核 |

---

## 详细步骤

### 1. 首次启动为访客

**前置**：清除凭据（删除用户数据目录中的 auth / free-quota store，或全新安装）。

1. 启动应用，进入编辑器
2. TitleBar 显示 **「登录」**，无账户菜单

---

### 2. 访客可打开「我的模型」

1. 打开 **设置 → 我的模型**
2. 无「登录后解锁」遮罩
3. 可见 Endpoint / API Key / 模型名称、**「你的 API Key 仅加密存储在本机，不会上传」**
4. **不**显示「WPX 公共大模型」单选项
5. **不**显示「今日剩余 x 次」类次数配额（访客无公共额度）

---

### 3. 访客未配置 API 时使用 AI

1. 打开 AI 写作助手，发送消息
2. 提示含：**您无需注册，但是需要配置自己的大模型 API 接口**
3. 有 **「去配置」** 按钮，可跳转「我的模型」

---

### 4. 点击登录弹出嵌入式 AuthModal（v2.x 自托管）

**前置**：`POST https://prowpx.com/api/auth/login` 已部署。

1. TitleBar 点击 **「登录」**
2. 应用内弹出 **AuthModal**（`role="dialog"`），无需跳转外部浏览器
3. 表单包含：邮箱、密码、「登录」按钮、「立即注册」链接、关闭按钮
4. 输入邮箱 + 密码，点击 **「登录」**
5. 请求 `POST /api/auth/login { email, password }`，响应 `{ token, refresh_token, user }`
6. 登录成功 → AuthModal 自动关闭，TitleBar 显示账户菜单（昵称 + 头像）

> 副路径：
> - **4b** 点击关闭按钮 → AuthModal 关闭，仍是访客
> - **4c** 点击「立即注册」→ 表单切换，提交 `POST /api/auth/register { email, password, nickname? }`，收到 token 自动登录

---

### 4–5. 登录 / 登出

同 E2E `auth-workflow.spec.js`。

---

### 6. 登录后模型配置

1. **我的模型** 可选 **WPX 公共大模型（消耗 Token）** 或自定义
2. 测试连接：成功绿色 ✓，失败红色 ✕

---

### 7. 注册与验证邮件（手工）

1. AuthModal 切换到「立即注册」
2. 邮箱 + 密码 + 可选昵称，提交
3. 后端返回 token（用户处于"待验证"状态）；同时后端通过 SMTP 发送 **验证邮件**
4. 用户邮箱点击链接：`https://prowpx.com/auth/verify-email?token=...`
5. 应用跳转到 `VerifyEmailView`，自动调用 `GET /api/auth/verify-email?token=...`，成功后显示「邮箱已验证」

### 7b. 忘记密码（手工）

1. AuthModal 切换到登录模式 → 点击「忘记密码」
2. 输入邮箱，提交 `POST /api/auth/forgot-password`
3. 后端发送密码重置邮件：`https://prowpx.com/auth/reset-password?token=...`
4. 点击链接跳转到 `ResetPasswordView`，输入新密码
5. 提交 `POST /api/auth/reset-password { token, password }` → 成功提示，可用新密码登录

---

### 11. 公共模型 Token 额度用尽（已登录、无自定义 Key）

**前置**：将当日公共模型 **Token** 用量扣至限额（非按次数 mock）。

1. 使用 WPX 公共模型对话直至拦截
2. 提示：**免费 Token 额度已用完**（或等价文案），**去配置** 自有 API
3. 配置自定义 Key 后应不再消耗公共 Token 池

**注意**：配额实现须按 `usage.total_tokens` 累加，不得 `+1` 次/请求。

---

### 8. 退出登录

1. **我的模型** 仍可用（仅自定义）
2. **字体与 Token** 显示登录遮罩