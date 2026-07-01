# WPX 管理后台 · 部署指南

本文档说明如何将 `admin/` 项目构建并部署到 `https://prowpx.com/admin`（SPA `base=/admin/`），包含 **Cloudflare Pages** 与 **Vercel** 两种方案（与 landing 项目共享同服务商）。

## 📦 目录

1. [构建产物](#1-构建产物)
2. [架构概览](#2-架构概览)
3. [Cloudflare Pages 部署](#3-cloudflare-pages-部署)
4. [Vercel 部署](#4-vercel-部署)
5. [自定义域名与 HTTPS](#5-自定义域名与-https)
6. [API 反向代理 / CORS](#6-api-反向代理--cors)
7. [环境变量清单](#7-环境变量清单)
8. [初始管理员账号](#8-初始管理员账号)
9. [部署后检查清单](#9-部署后检查清单)

---

## 1. 构建产物

```bash
cd admin
npm install
npm run build
```

输出目录：`admin/dist/`

> Vite 已开启 `manualChunks` 与 `chunkSizeWarningLimit`，构建产物按需懒加载，首屏仅加载 30KB JS（gzip 后）。

---

## 2. 架构概览

```
[浏览器] https://prowpx.com/admin
   │
   ├── 静态资源 (HTML/CSS/JS) ─┐
   │                            ├──> Cloudflare Pages / Vercel CDN（边缘节点）
   └── /admin/api/* 业务请求 ──┘         │
                                         ▼
                              Functions / Serverless 反向代理
                                         │
                                         ▼
                              https://www.prowpx.com/admin/api/* （同源，API_TARGET）
                              https://www.prowpx.com/api/auth/* (认证服务，同源)
```

- **业务 API**：`/admin/api/*` 通过 Pages Functions / Vercel Serverless Function 反向代理到 `https://www.prowpx.com/admin/api/*`（同源，避免 CORS）
- **认证 API**：登录页直接调用 `https://www.prowpx.com/api/auth/*`（同源），由本项目后端在 CORS 白名单中放行前端 origin

---

## 3. Cloudflare Pages 部署

### 3.1 通过 Git 集成（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 选择 `WPX` 仓库，**Project name** 填 `wpx-admin`，**Build settings**：
   - **Framework preset**: `Vue`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `admin`
3. **Environment variables**（在创建项目时或后续 Settings → Environment variables）配置（参见[第 7 节](#7-环境变量清单)）
4. 点击 **Save and Deploy**

### 3.2 通过 Wrangler CLI

```bash
cd admin
npm install -g wrangler      # 首次使用
wrangler login                # 浏览器授权
wrangler pages deploy dist --project-name wpx-admin --branch main
```

### 3.3 反向代理

Cloudflare Pages Functions 已包含在 `admin/functions/` 目录，构建时会自动部署：

- `admin/functions/api/[[path]].js` 处理 `/admin/api/*` 全部请求
- `admin/public/_redirects` 配置 SPA fallback：`/admin/* → /index.html 200`

---

## 4. Vercel 部署

### 4.1 通过 Git 集成（推荐）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. 导入 `WPX` 仓库，**Root Directory** 设为 `admin`
3. Framework Preset 自动识别为 **Vite**
4. **Environment Variables** 配置（参见[第 7 节](#7-环境变量清单)）
5. 点击 **Deploy**

### 4.2 通过 Vercel CLI

```bash
cd admin
npm install -g vercel
vercel login
vercel --prod
```

### 4.3 反向代理

- `admin/vercel.json` 已配置：
  - `rewrites: /admin/api/* → /api/proxy?path=*`
  - `rewrites: /admin/* → /index.html`（SPA fallback）
- `admin/api/proxy.js` 是 Vercel Serverless Function，处理 `/api/*` 反代
- **注意**：由于 SPA 部署在 `prowpx.com/admin`，所有静态资源走 `base='/admin/'`；Functions 路径前缀 `/admin/api/*`。

---

## 5. 自定义域名与 HTTPS

### 5.1 Cloudflare Pages

1. Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入 `prowpx.com`（主域名），子路径 `/admin/` 由 SPA `base` 配置决定
3. Cloudflare 会要求在 `prowpx.com` 域名 DNS 添加 CNAME 记录：
   - **Name**: `@`（或 `prowpx.com`）
   - **Target**: `wpx-landing-prowpx.pages.dev`（首次配置时显示）
   - **Proxy**: ✓ Proxied（橙色云朵）
4. 等待 DNS 生效（通常 1-5 分钟）
5. **SSL/TLS 加密模式** 设为 `Full (Strict)`
6. **Always Use HTTPS**: 开启（自动 301 重定向 HTTP → HTTPS）
7. Cloudflare 自动签发 **Edge Certificate** + 续期

### 5.2 Vercel

1. Project → **Settings** → **Domains** → **Add**
2. 输入 `prowpx.com`（主域名，部署到 `/admin/` 路径）
3. 在域名 DNS 添加：
   - **A 记录**: `76.76.21.21`（Vercel 官方 IP，可改用 CNAME `cname.vercel-dns.com`）
   - 或 **CNAME**: `cname.vercel-dns.com`
4. Vercel 自动签发 Let's Encrypt 证书
5. **Settings** → **Domains** 确认 SSL 状态为 `Valid`

### 5.3 推荐：统一 HTTPS 配置

| 服务商 | 推荐 SSL 模式 | 自动续期 |
|--------|----------------|---------|
| Cloudflare Pages | Full (Strict) | ✓ Cloudflare Edge |
| Vercel | Automatic (Let's Encrypt) | ✓ Vercel 自动 |
| 自定义证书 | 不需要 | —— |

---

## 6. API 反向代理 / CORS

### 6.1 反向代理（推荐，避免 CORS）

admin 项目默认采用**反代模式**（`.env.production` 中 `VITE_API_BASE_URL=/api`）：

- **Cloudflare Pages**：通过 `functions/api/[[path]].js`（待实现）转发 `/api/*` → `/admin/api/*`
- **Vercel**：`api/proxy.js` 转发 `/api/*` → `https://www.prowpx.com/admin/api/*`（默认 `API_TARGET`，同源）

优势：
- 浏览器看到的是同源请求，无 CORS 限制
- 不暴露后端真实域名
- Functions 自带日志、监控

如需自定义目标，配置环境变量 `API_TARGET`：

```bash
# Cloudflare Pages / Vercel 同源反代目标地址（推荐）
# 默认就是 https://www.prowpx.com/admin/api（同源，不会有 CORS 跨域问题）
# 仅当后端部署到独立域名（如 staging 环境）时才需要覆盖：
# API_TARGET=https://staging.prowpx.com/admin/api
```

### 6.2 直连后端（CORS 模式）

如不想走反代（例如后端部署到独立域名），可修改 `.env.production`：

```env
# 示例：staging 环境独立部署的后端（实际使用时替换为你的后端域名）
VITE_API_BASE_URL=https://staging.prowpx.com/admin/api
```

此时需要后端在响应头中放行 `https://www.prowpx.com` 与 `https://prowpx.com`：

```nginx
# Nginx 示例
add_header Access-Control-Allow-Origin https://www.prowpx.com always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
add_header Access-Control-Allow-Credentials true always;

if ($request_method = OPTIONS) {
    return 204;
}
```

> ⚠️ **直连模式下严禁使用 apex 域名 `https://prowpx.com` 作为 baseURL**，原因：
> 当前 Vercel 项目对 apex 域名（`prowpx.com`）配置了 "Redirect to www"（308 重定向，
> 在 Vercel Dashboard 的 Domain Settings 里手动启用），跨子域请求会让 CORS preflight
> 被 308 阻断，POST 完全失败：
>
> ```
> Access to XMLHttpRequest at 'https://prowpx.com/api/auth/login' from origin
> 'https://www.prowpx.com' has been blocked by CORS policy: Response to preflight
> request doesn't pass access control check: Redirect is not allowed for a
> preflight request.
> ```
>
> 解决办法：要么用 `https://www.prowpx.com`（同子域），要么用反代模式（同源）。
> 同理 `VITE_ACCOUNT_BASE_URL` 也不能设为 `https://prowpx.com`。

### 6.3 认证服务 CORS

认证接口由本项目后端（`prowpx.com/api/auth/*`）提供，必须在后端的 CORS 白名单中添加：

```
Access-Control-Allow-Origin: https://prowpx.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
```

后端 `.env` 中配置：

```env
CORS_ORIGIN=https://prowpx.com,https://www.prowpx.com,http://localhost:5174,http://localhost:5175
```

> ⚠️ 同 6.2 节：CORS 白名单中不要包含独立的 `api.*` 子域作为 Origin，应该
> 放行真正的"调用方"（即前端页面所在域名 www.prowpx.com 等）。

---

## 7. 环境变量清单

| 变量名 | 必填 | 默认值 | 说明 |
|--------|:---:|--------|------|
| `VITE_APP_TITLE` | ✗ | `WPX 管理后台` | 浏览器标签标题 |
| `VITE_APP_SHORT_NAME` | ✗ | `WPX Admin` | PWA 短名称 |
| `VITE_THEME_COLOR` | ✗ | `#4F46E5` | 品牌主色 |
| `VITE_API_BASE_URL` | ✓ | `/api` | 业务 API 入口（走反代，同源）。**必须用相对路径**，不要写成 apex 域名 |
| `VITE_ACCOUNT_BASE_URL` | ✓ | `/` | 自托管认证入口。**必须用相对路径`** `/`，不要写 `https://prowpx.com` |
| `API_TARGET` | ✗ | `https://www.prowpx.com/admin/api` | 反代目标地址（仅 Cloudflare Pages / Vercel Functions 使用） |

> ⚠️ **`VITE_API_BASE_URL` 与 `VITE_ACCOUNT_BASE_URL` 必须用相对路径（`/`、`/api`）**。
> 历史经验（2026-06-30）：曾经误把 `VITE_ACCOUNT_BASE_URL` 设为 `https://prowpx.com`，
> 前端硬编码为 apex 域名，触发跨子域请求；又因为当前 Vercel 项目对 apex 配置了 "Redirect to www"
> 的 308 重定向（在 Vercel Dashboard → Domain Settings → Redirect to www 里手动启用），
> CORS preflight 被阻断，POST `/api/auth/login` 完全失败：
>
> ```
> Response to preflight request doesn't pass access control check:
> Redirect is not allowed for a preflight request.
> ```
>
> 修复办法：用相对路径让 axios 解析为同源 URL，走 `/api/* → /api/proxy` 同源反代，
> 不再触发跨子域 preflight。

### Cloudflare Pages 配置

项目 → **Settings** → **Environment variables**：

| Variable name | Value | Environment |
|---------------|-------|-------------|
| `VITE_API_BASE_URL` | `/api` | Production / Preview |
| `VITE_ACCOUNT_BASE_URL` | `/` | Production / Preview |
| `API_TARGET` | `https://www.prowpx.com/admin/api` | Production |
| `API_TARGET` | `https://staging.prowpx.com/admin/api` | Preview（仅当 staging 后端真实存在时配置） |

### Vercel 配置

Project → **Settings** → **Environment Variables**：

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_API_BASE_URL` | `/api` | All |
| `VITE_ACCOUNT_BASE_URL` | `/` | All |
| `API_TARGET` | `https://www.prowpx.com/admin/api` | Production |
| `API_TARGET` | `https://staging.prowpx.com/admin/api` | Preview（仅当 staging 后端真实存在时配置） |

> **Vercel 配置变更历史**：
> - 早期版本：错误配置为 `VITE_ACCOUNT_BASE_URL=https://prowpx.com`，导致登录 CORS 308 阻断
> - 当前版本（2026-06-30 修复）：改为 `/`，恢复同源反代

---

## 8. 初始管理员账号

详见 [ADMIN_INIT.md](./ADMIN_INIT.md)。

快速开始：

1. 在后端数据库插入初始超级管理员（邮箱 `super@prowpx.com`，初始密码 `Wpx@2026!Init`）
2. 访问 https://prowpx.com/admin/login
3. 使用上述凭据登录
4. **立即修改初始密码**
5. 创建团队成员账号

---

## 9. 部署后检查清单

| ✓ | 项目 | 验证方式 |
|---|------|----------|
| ☐ | `https://prowpx.com/admin` 可访问且 HTTPS 锁图标正常 | 浏览器打开 |
| ☐ | 首页 200，控制台无 404 | DevTools Network |
| ☐ | 登录页正常渲染 | `/admin/login` |
| ☐ | 凭据登录成功，token 写入 localStorage | DevTools Application |
| ☐ | 登录后跳转 `/admin/dashboard` 且数据正常 | 仪表盘 6 个指标 |
| ☐ | `/admin/api/*` 请求经 Functions/Serverless 反代 | Network → /admin/api/orders/recharge 状态 200 |
| ☐ | 静态资源加载 200（`/admin/assets/*.js`） | Network |
| ☐ | 浏览器刷新任意子页面（如 `/admin/users`）不报 404 | F5 |
| ☐ | 401 拦截跳转到登录页 | 删除 token 后访问 `/admin/dashboard` |
| ☐ | Cloudflare/Vercel 函数日志中无 5xx 错误 | 控制台 Logs |

---

## 常见问题

### Q1. 部署后访问首页白屏

检查 `index.html` 是否正确生成；清除浏览器缓存后重试。Cloudflare/Vercel 默认开启 `Cache-Control: public, max-age=...` 静态资源永久缓存。

### Q2. `/api/*` 一直返回 502

检查 `API_TARGET` 环境变量是否正确；查看 Functions/Serverless 日志中 `[api/proxy] error` 详情。

### Q3. 登录后跳回登录页

JWT 未被后端识别。检查 `prowpx.com/api/auth/login` 是否正确签发 token，以及 `http.js` 拦截器是否正确读取 `wpx_admin_token` localStorage 项。

### Q4. 路由刷新 404

Cloudflare Pages `_redirects` 与 Vercel `vercel.json` 均已配置 SPA fallback。如仍 404，请确认 `_redirects` 文件在 `public/` 目录且未在 `dist/` 中被覆盖。

### Q5. 跨域错误（CORS preflight 308 阻断）

**症状**：登录报错：

```
Access to XMLHttpRequest at 'https://prowpx.com/api/auth/login' from origin
'https://www.prowpx.com' has been blocked by CORS policy: Response to preflight
request doesn't pass access control check: Redirect is not allowed for a
preflight request.
```

**原因**：前端硬编码 `VITE_ACCOUNT_BASE_URL=https://prowpx.com`（apex 域名），加上
当前 Vercel 项目对 apex 域名配置了 "Redirect to www"（308 重定向，在 Vercel Dashboard
的 Domain Settings 里手动启用），跨子域请求的 CORS preflight 被 308 阻断。

**修复**：
1. 检查 `.env` / Vercel 环境变量：删除 `VITE_ACCOUNT_BASE_URL=https://prowpx.com` ，
   改用默认值 `/`（同源）。
2. 重新构建：`cd admin && npm run build && cd .. && node scripts/build-frontend.js`。
3. 重新部署：`vercel --prod` 或 push 到 main 触发自动部署。
4. 验证：浏览器 DevTools Network 中看到 POST `/api/auth/login` 走的是 www.prowpx.com
   （同源），不是 apex 域名。

更彻底的办法：始终使用反代模式（`VITE_API_BASE_URL=/api`），浏览器与后端同源，
从根上避免跨域 CORS。

### Q6. 自定义构建参数

当前 `admin/` 已固定 `base: '/admin/'`，所有静态资源走 `/admin/assets/*`、路由前缀 `/admin/`。

如需变更 base path（如 `/manage/`），修改 `vite.config.js` 并相应调整 `vercel.json` 的 `rewrites.source` 与 `public/_redirects`。
