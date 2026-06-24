# WPX Server

WPX 后端服务，基于 Node.js + Express，对接自托管 JWT 鉴权（`prowpx.com` 体系，应用内嵌 AuthModal 登录）。

## 技术栈

- Node.js >= 18
- Express 4
- PostgreSQL（`pg`）
- Redis（`redis` v4）
- JWT 鉴权（`jsonwebtoken`）
- Helmet / CORS 安全中间件
- 自研轻量日志器（JSON 输出，可按 level 过滤）

## 目录结构

```
server/
├── app.js                  # Express 应用工厂
├── server.js               # 启动入口
├── config/                 # 环境变量与配置
│   └── index.js
├── routes/                 # 路由层
│   ├── index.js            #   汇总
│   ├── health.routes.js
│   ├── auth.routes.js
│   ├── user.routes.js
│   └── admin.routes.js
├── controllers/            # 控制器
│   ├── health.controller.js
│   ├── auth.controller.js
│   ├── user.controller.js
│   └── admin.controller.js
├── models/                 # 数据访问层
│   ├── db.js               #   PostgreSQL 连接池
│   ├── redis.js            #   Redis 客户端
│   ├── user.js             #   user_profiles 模型
│   └── stats.js            #   仪表盘/趋势统计
├── middleware/             # 中间件
│   ├── auth.js             #   JWT 鉴权
│   ├── error-handler.js    #   错误处理 + 404
│   └── request-logger.js   #   请求 ID + 访问日志
├── utils/                  # 工具
│   ├── async-handler.js
│   ├── errors.js           #   业务错误类型
│   ├── logger.js
│   └── response.js
├── sql/                    # 初始化 SQL
│   └── init.sql
├── package.json
├── .env.example
└── .gitignore
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 准备 .env
cp .env.example .env
# 编辑 .env，填入真实的 PG/Redis/JWT 配置

# 3. 初始化数据库表（首次）
psql -U postgres -d wpx -f sql/init.sql
# 或：bash scripts/init-db.sh

# 4. 启动
npm run dev    # nodemon 热重载
npm start      # 生产模式
```

## 部署

完整部署指南见 [DEPLOY.md](./DEPLOY.md)，包含：

- 阿里云 ECS（PM2 + Nginx）
- Docker / docker-compose 一体化
- Railway / Render 平台部署
- CORS / Nginx / 反向代理配置

核心命令：

```bash
# PM2
pm2 start ecosystem.config.cjs
pm2 reload ecosystem.config.cjs   # 零停机重载

# Docker
docker compose up -d              # 本地一体化
docker build -t wpx-server:1.0.0 . # 生产镜像
```

## 环境变量

完整列表见 [.env.example](./.env.example)。最常用：

| 变量 | 含义 | 默认值 |
| --- | --- | --- |
| `PORT` | 监听端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |
| `PUBLIC_HOST` | 进程对外 URL | `http://localhost:3000` |
| `API_DOMAIN` | API 主域 | `api.prowpx.com` |
| `TRUST_PROXY_HOPS` | 信任的反代跳数 | `1` |
| `CORS_ORIGIN` | 跨域白名单（逗号分隔，`*` 或显式 origin 列表） | `*` |
| `CORS_CREDENTIALS` | 是否带 cookie | `true` |
| `CDN_BASE` | 可选 CDN 前缀 | — |
| `BODY_LIMIT` | 请求体大小 | `1mb` |
| `LOG_LEVEL` | 日志级别 (`debug/info/warn/error`) | `info` |
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DATABASE` | PG 连接信息 | - |
| `PG_POOL_MAX` | 连接池最大数 | `10` |
| `PG_SSL` | 云 PG 需开启 | `false` |
| `REDIS_URL` | Redis 连接 URL | `redis://127.0.0.1:6379` |
| `REDIS_PASSWORD` / `REDIS_DB` | Redis 认证/库号 | - |
| `ACCOUNT_JWT_SECRET` | 账户中心 JWT 共享密钥/公钥 | - |
| `ACCOUNT_JWT_ALG` | 签名算法 | `HS256` |
| `ACCOUNT_JWT_ISSUER` | 期望的签发者 | `prowpx.com` |
| `ACCOUNT_JWT_AUDIENCE` | 期望的受众 | `wpx-server` |
| `AUTH_BYPASS` | `true` 时跳过 JWT 校验（**仅本地开发**） | `false` |
| `AUTH_BYPASS_ROLES` | bypass 时使用的角色 | `dev` |

## 鉴权

所有受保护接口都使用 `Authorization: Bearer <token>` 头，token 由 `prowpx.com` 自托管认证服务（`/api/auth/login`）颁发。

中间件会校验：
- 签名算法与共享密钥（`ACCOUNT_JWT_SECRET`）
- `iss` 是否匹配 `ACCOUNT_JWT_ISSUER`
- `aud` 是否匹配 `ACCOUNT_JWT_AUDIENCE`
- 过期时间

校验成功后 `req.user` 形如：

```js
{
  id: '<sub/accountId>',
  accountId: '<accountId>',
  email: '...',
  nickname: '...',
  roles: ['user'],
  raw: { /* 原始 payload */ }
}
```

可在路由中通过 `requireAuth` 强制鉴权，或使用 `requireRole('admin')` 限制角色。

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/` | 否 | 服务基本信息 |
| GET | `/healthz` | 否 | 存活探针 |
| GET | `/readyz` | 否 | 就绪探针（探测 PG/Redis） |
| GET | `/api/auth/me` | 是 | 当前登录用户 |
| GET | `/api/auth/verify` | 是 | 主动校验 token |
| GET | `/api/users/me` | 是 | 当前用户本地画像 |
| POST | `/api/users/me/sync` | 是 | 同步当前用户画像 |
| GET | `/api/admin/users` | admin | 用户列表（搜索/筛选/分页） |
| GET | `/api/admin/users/:id` | admin | 用户详情（画像 + 最近活动 + 累计统计） |
| PUT | `/api/admin/users/:id/status` | admin | 启用/禁用用户 |
| DELETE | `/api/admin/users/:id` | admin | 删除用户 |
| GET | `/api/admin/stats/dashboard` | admin | 仪表盘（DAU/新增/调用量/收入） |
| GET | `/api/admin/stats/trends` | admin | 趋势（`range=7d` 或 `30d`） |
| GET | `/api/admin/models` | admin | 模型列表（搜索/筛选/分页） |
| POST | `/api/admin/models` | admin | 添加模型 |
| PUT | `/api/admin/models/:id` | admin | 编辑模型 |
| GET | `/api/admin/models/monitor` | admin | 调用监控（`window=1h\|24h\|7d`、`groupBy=model\|kind\|status`） |
| GET | `/api/admin/fonts` | admin | 字体列表（搜索/分类/状态/分页） |
| POST | `/api/admin/fonts` | admin | 添加字体 |
| PUT | `/api/admin/fonts/:id` | admin | 编辑字体 |
| PUT | `/api/admin/fonts/:id/status` | admin | 上下架（`active`/`inactive`/`reviewing`） |
| GET | `/api/admin/fonts/:id/stats` | admin | 字体使用统计（`window=1h\|24h\|7d\|30d`、`kind=preview\|download\|apply\|embed`） |
| GET | `/api/admin/skills` | admin | Skills 列表（搜索/分类/启用/分页） |
| POST | `/api/admin/skills` | admin | 添加 Skill |
| PUT | `/api/admin/skills/:id` | admin | 编辑 Skill |
| GET | `/api/admin/token/orders` | admin | 充值订单列表（订单号/邮箱/状态/支付方式/时间） |
| POST | `/api/admin/token/refund` | admin | 手动退款（`{ orderNo, amountCents?, reason? }`） |
| GET | `/api/admin/token/consumption` | admin | 消费记录（用户/资源/类型/时间） |
| GET | `/api/admin/token/revenue` | admin | 收入统计（今日/本周/本月/累计 + 按包分布 + 30 天趋势） |
| GET | `/api/admin/announcements` | admin | 公告列表（搜索/状态/分页） |
| GET | `/api/admin/announcements/:id` | admin | 公告详情 |
| POST | `/api/admin/announcements` | admin | 新增公告 |
| PUT | `/api/admin/announcements/:id` | admin | 编辑公告 |
| DELETE | `/api/admin/announcements/:id` | admin | 删除公告 |
| GET | `/api/admin/versions` | admin | 版本列表（搜索/渠道/分页） |
| GET | `/api/admin/versions/:id` | admin | 版本详情 |
| POST | `/api/admin/versions` | admin | 新增版本 |
| PUT | `/api/admin/versions/:id` | admin | 编辑版本 |
| DELETE | `/api/admin/versions/:id` | admin | 删除版本 |
| GET | `/api/admin/settings` | admin | 系统设置列表（搜索/分类/分页） |
| PUT | `/api/admin/settings` | admin | 批量 UPSERT 系统设置 |
| GET | `/api/admin/admins` | admin | 管理员列表（搜索/角色/状态/分页） |
| GET | `/api/admin/admins/:id` | admin | 管理员详情 |
| POST | `/api/admin/admins` | admin | 新增管理员 |
| PUT | `/api/admin/admins/:id` | admin | 编辑管理员 |
| DELETE | `/api/admin/admins/:id` | admin | 删除管理员（不能删除超级管理员/自己） |
| GET | `/api/admin/logs` | admin | 操作日志（筛选/分页） |
| GET | `/api/admin/logs/export` | admin | 导出 CSV（默认 1 万行，上限 5 万行） |

### 响应格式

```json
// 成功
{ "ok": true, "data": { ... } }

// 失败
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "无效的访问令牌"
  }
}
```

## 管理后台接口

所有 `/api/admin/*` 路由除需 JWT 鉴权外，还要求 `roles` 包含 `admin`，未通过将返回 `403 FORBIDDEN`。

### 用户管理

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | `q` 关键字；`status=active\|disabled\|banned`；`page`、`pageSize`（最大 100）；`sort` 字段（`created_at` / `updated_at` / `nickname` / `email` / `status`）；`order=asc\|desc` | 列表 + 分页元信息 |
| GET | `/api/admin/users/:id` | — | 画像 + 最近 10 条使用事件 + 最近 10 条支付 + 累计统计 |
| PUT | `/api/admin/users/:id/status` | `{ status: 'active'\|'disabled'\|'banned', reason?: string }` | 启用/禁用/封禁，同时将操作人/时间/原因写入 `meta` |
| DELETE | `/api/admin/users/:id` | — | 硬删除 `user_profiles`（事件/支付保留用于审计） |

### 统计

| 方法 | 路径 | Query | 返回 |
| --- | --- | --- | --- |
| GET | `/api/admin/stats/dashboard` | — | `{ dau, newUsers24h, calls24h, revenue24h, totals: { users, activeUsers, disabledUsers } }` |
| GET | `/api/admin/stats/trends` | `range=7d` 或 `30d`，默认 `7d` | `{ range, series: [{ date, dau, calls, newUsers, revenue }] }` |

收入单位为分（`amount_cents`），前端按需除以 100。

### 模型与字体管理

**模型字段**：`id`、`name`、`code`（唯一）、`provider`、`type`（`chat`/`embedding`/`image`/`layout`/`rerank`）、`enabled`、`rateLimit`（每分钟请求数）、`config`（JSONB）、`description`。所有写操作主键/唯一约束冲突返回 `409 CONFLICT`。

**字体字段**：`id`、`name`、`family`（CSS family）、`url`、`format`（`woff2`/`woff`/`ttf`/`otf`/`eot`）、`category`（`chinese`/`english`/`mono`/`display`/`handwriting`）、`license`、`fileSize`、`status`（`active`/`inactive`/`reviewing`）、`tags`（TEXT[]）、`meta`（JSONB）。

**监控输出**（`/api/admin/models/monitor`）：
- `summary`：调用总量、成功率、失败/超时计数、平均延迟、token 总量、活跃用户数
- `series`：按 `groupBy` 维度（model/kind/status）聚合的 top 50
- `timeline`：按小时分桶的调用趋势

### Skills 管理

**字段**：`id`、`name`、`code`（唯一）、`category`（`student`/`teacher`/`general`）、`description`、`systemPrompt`、`enabled`、`builtin`（内置不可删）、`tags`（TEXT[]）、`config` / `meta`（JSONB）。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/skills` | `q` / `category` / `enabled` / `page` / `pageSize` / `sort` / `order` | 列表 + 分页 |
| POST | `/api/admin/skills` | `{ id, name, code, category?, description?, systemPrompt?, enabled?, builtin?, tags?, config?, meta? }` | 新增（id/code 唯一冲突返回 `409 CONFLICT`） |
| PUT | `/api/admin/skills/:id` | 部分字段 | 编辑 |

### Token 管理（充值订单 / 消费记录 / 收入统计）

**充值订单字段**：`order_no`、`account_id`、`email`、`package`、`amount_cents`、`currency`、`pay_method`（`alipay`/`wechat`/`stripe`/`paypal`/`manual`）、`status`（`pending`/`paid`/`refunded`/`failed`/`cancelled`）、`paid_at`、`refunded_at`、`refund_amount_cents`、`refund_reason`。

**消费记录字段**：`account_id`、`email`、`kind`（`ai_chat`/`ai_layout`/`font_apply`/`export`/...）、`target_id`、`target_name`、`quantity`（字数）、`tokens`、`amount_cents`。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/token/orders` | `q` / `status` / `payMethod` / `start` / `end` / 分页 | 订单列表 + 总额 |
| POST | `/api/admin/token/refund` | `{ orderNo, amountCents?, reason? }` | 仅 `paid` 订单可退；不传 `amountCents` 默认全额；状态变为 `refunded` |
| GET | `/api/admin/token/consumption` | `q` / `kind` / `start` / `end` / 分页 | 消费记录 + 字数/token/金额合计 |
| GET | `/api/admin/token/revenue` | — | `{ summary: { todayCents, weekCents, monthCents, allTimeCents, paidOrders, refundedOrders, payingUsers }, byPackage, dailyTrend }` |

`allTimeCents` 公式：`SUM(paid.amount_cents) - SUM(refund_amount_cents)`。

### 公告管理

**字段**：`title`、`body_md`、`status`（`draft`/`pending`/`active`/`expired`/`offline`）、`pinned`、`start_at`、`end_at`、`meta`（JSONB）。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/announcements` | `q` / `status` / 分页 | 列表，置顶项优先 |
| GET | `/api/admin/announcements/:id` | — | 详情 |
| POST | `/api/admin/announcements` | `{ title, bodyMd, status?, pinned?, startAt?, endAt?, meta? }` | 新增 |
| PUT | `/api/admin/announcements/:id` | 部分字段 | 编辑 |
| DELETE | `/api/admin/announcements/:id` | — | 删除 |

### 版本管理

**字段**：`version`（唯一，semver 字符串）、`channel`（`stable`/`beta`/`alpha`）、`release_notes`、`downloads`（JSONB，按平台 `{windows,macos,linux}`）、`force_update`、`min_supported_version`、`published_at`。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/versions` | `q` / `channel` / 分页 | 列表 |
| GET | `/api/admin/versions/:id` | — | 详情 |
| POST | `/api/admin/versions` | `{ version, channel?, releaseNotes?, downloads?, forceUpdate?, minSupportedVersion?, publishedAt? }` | 新增（version 唯一冲突返回 `409 CONFLICT`） |
| PUT | `/api/admin/versions/:id` | 部分字段 | 编辑 |
| DELETE | `/api/admin/versions/:id` | — | 删除 |

### 系统设置

**字段**：`key`（主键）、`value`（JSONB）、`category`、`description`、`is_public`、`updated_by`、`updated_at`。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/settings` | `q` / `category` / `page` / `pageSize` | 列表（默认 50/页，上限 200） |
| PUT | `/api/admin/settings` | `{ items: [{ key, value, category?, description?, isPublic? }, ...] }` | 批量 UPSERT，同一事务；非空 items，写入人自动记入 `updated_by` |

### 管理员账号

**字段**：`account_id`（唯一）、`email`、`nickname`、`role`（`super`/`ops`/`editor`）、`status`（`active`/`disabled`）、`last_login_at`、`meta`。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/admins` | `q` / `role` / `status` / 分页 | 列表 |
| GET | `/api/admin/admins/:id` | — | 详情 |
| POST | `/api/admin/admins` | `{ accountId, email?, nickname?, role?, status?, meta? }` | 新增（account_id 唯一冲突返回 `409 CONFLICT`） |
| PUT | `/api/admin/admins/:id` | 部分字段 | 编辑 |
| DELETE | `/api/admin/admins/:id` | — | 删除；**不能删除 `super`** 或当前操作者自己 |

### 操作日志

**字段**：`account_id`、`email`、`role`、`action`（如 `user.disable` / `skill.create` / `token.refund` / `setting.update`）、`resource_type`、`resource_id`、`method`、`path`、`status_code`、`payload`（JSONB）、`ip`、`ua`、`duration_ms`、`meta`、`created_at`。

| 方法 | 路径 | Query / Body | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/logs` | `q` / `action` / `accountId` / `resourceType` / `resourceId` / `status=success\|error` / `start` / `end` / 分页 | 列表 + 分页 |
| GET | `/api/admin/logs/export` | 同上 + `limit`（默认 10000，上限 50000） | 返回 `text/csv`（UTF-8 BOM），文件名 `operation-logs-YYYYMMDD-HHmmss.csv`，同时返回 `X-Total-Count` 响应头 |

业务层写入日志请直接调用 `models/log.js#record(...)`，记录失败仅 warn，不影响主流程。

## 错误处理

- 业务层抛出 `HttpError` 子类（`BadRequestError` / `UnauthorizedError` / ...）
- 异步控制器使用 `utils/async-handler` 自动捕获 reject
- 全局 `errorHandler` 统一返回 `{ ok:false, error:{ code, message, details? } }`
- `unhandledRejection` / `uncaughtException` 由 `installProcessHandlers` 兜底日志

## 优雅关闭

服务监听 `SIGINT` / `SIGTERM`，会先停 HTTP 监听，再关闭 PG 池和 Redis 连接，10s 内未完成则强制退出。
