# WPX Server - 部署指南

本文档覆盖 `server/` 目录从零到上线的全部步骤，包括 PostgreSQL/Redis 接入、Nginx 反代、PM2 守护进程、Docker 一体化部署，以及 Railway / Render / 阿里云 ECS 的差异点。

---

## 1. 部署拓扑

```
                 ┌─────────────────┐
                 │   Cloudflare    │  ← DNS / WAF / HTTPS 终结
                 └────────┬────────┘
                          │
              api.prowpx.com ──► Nginx (443) ──► 127.0.0.1:3000 (PM2)
                                                      │
                                              ┌───────┴───────┐
                                              ▼               ▼
                                         PostgreSQL        Redis
                                       (RDS/自建)       (Upstash/自建)
```

辅助域名（前端）：

| 域名 | 用途 | 部署目标 |
| --- | --- | --- |
| `prowpx.com` | 营销站 | Cloudflare Pages / Vercel |
| `prowpx.com/admin` | 管理后台前端 | Cloudflare Pages / Vercel（SPA `base=/admin/`） |
| `api.prowpx.com` | **本服务（Node.js API）** | Nginx + PM2 / Docker |
| `prowpx.com/api/auth/*` | **自托管认证入口**（同本服务） | 同上 |
| `skillhub.prowpx.com` | 在线 Skills 数据源 | Cloudflare Pages / Vercel |

---

## 2. 部署方式选择

| 场景 | 推荐方式 |
| --- | --- |
| 阿里云 ECS（CentOS / Ubuntu） | **PM2 + Nginx**（推荐） |
| 容器化 / K8s | **Docker + docker-compose** 或 Dockerfile 单镜像 |
| Railway / Render | 直接部署 GitHub 仓库，使用托管 PG/Redis |

> ⚠️ 不论哪种方式，都必须**先**准备 PostgreSQL + Redis（托管或自建）。

---

## 3. 通用前置：环境变量

复制 `.env.example` 为 `.env` 并按实际环境填写：

```bash
cp .env.example .env
vi .env
```

关键变量：

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `NODE_ENV` | `production` | `production` |
| `PORT` | 监听端口（默认 3000） | `3000` |
| `PUBLIC_HOST` | 进程对外 URL | `https://api.prowpx.com` |
| `API_DOMAIN` | API 主域 | `api.prowpx.com` |
| `TRUST_PROXY_HOPS` | 信任的反代层数 | `1`（仅 Nginx）/ `2`（SLB+Nginx） |
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DATABASE` | PG 连接 | — |
| `PG_SSL` | 云 PG 需开启 | `true` |
| `REDIS_URL` | Redis 连接 | `rediss://default:xxx@host:6379` |
| `ACCOUNT_JWT_SECRET` | 自托管认证共享密钥 | — |
| `ACCOUNT_JWT_ALG` / `ISSUER` / `AUDIENCE` | 默认 `HS256` / `prowpx.com` / `wpx-server` | — |
| `AUTH_BYPASS` | **生产必须 `false`** | `false` |
| `CORS_ORIGIN` | 逗号分隔白名单 | `https://prowpx.com,https://www.prowpx.com,https://api.prowpx.com,http://localhost:5174,http://localhost:5175` |
| `CORS_CREDENTIALS` | 是否带 cookie | `true` |
| `CDN_BASE` | 可选 CDN 域名 | `https://cdn.prowpx.com` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 邮件发送（SMTP） | 留空时使用 log 模式（开发环境） |
| `BCRYPT_COST` | bcryptjs 哈希强度（默认 12） | `12` |
| `PUBLIC_WEB_BASE` | 邮件中的验证/重置链接前缀 | `https://prowpx.com` |
| `LOG_LEVEL` | `info` / `warn` | `info` |
| `BODY_LIMIT` | 请求体上限 | `2mb` |

---

## 4. 方案 A：阿里云 ECS（PM2 + Nginx）

### 4.1 系统准备

```bash
# CentOS / RHEL
sudo yum install -y epel-release
sudo yum install -y nodejs-20 nginx postgresql redis

# Ubuntu
sudo apt update
sudo apt install -y nodejs-20 nginx postgresql redis-server
```

### 4.2 应用部署

```bash
# 拉代码
sudo mkdir -p /var/www/wpx-server
sudo chown -R $USER:$USER /var/www/wpx-server
cd /var/www/wpx-server
git clone git@github.com:proclaw-team/wpx.git .

# 仅安装生产依赖
cd server
npm ci --omit=dev

# 准备 .env
cp .env.example .env
vi .env

# 初始化数据库
psql "host=$PG_HOST port=$PG_PORT user=$PG_USER dbname=$PG_DATABASE" \
  -v ON_ERROR_STOP=1 -f sql/init.sql
```

### 4.3 PM2 守护

```bash
# 全局安装 PM2
npm i -g pm2

# 启动（首次自动保存进程列表）
pm2 start ecosystem.config.cjs
pm2 save

# 设置开机自启
pm2 startup    # 按提示执行它打印的命令
pm2 save

# 常用命令
pm2 status
pm2 logs wpx-api --lines 200
pm2 reload wpx-api    # 平滑重载
pm2 restart wpx-api
```

### 4.4 Nginx 反代

```bash
# 复制配置
sudo cp nginx/api.prowpx.com.conf /etc/nginx/conf.d/

# 申请证书（acme.sh 或 certbot 任选）
sudo certbot --nginx -d api.prowpx.com

# 校验并重载
sudo nginx -t
sudo nginx -s reload
```

> 关键要点：
> - 上游是阿里云 SLB 时，请把 `set_real_ip_from` 收紧为 SLB 内网段（如 `100.64.0.0/10`）。
> - `app.js` 已读取 `TRUST_PROXY_HOPS`，SLB+Nginx 双层场景设为 `2`。

### 4.5 防火墙与安全组

阿里云 ECS 安全组需放通：
- 入站 80/443（Nginx 对外）
- 出站 5432（→ RDS）、6379（→ Redis）、22（运维）

---

## 5. 方案 B：Docker（一体化）

### 5.1 本地一体化（开发）

```bash
cd server
docker compose up -d
# 等待健康检查通过
curl http://localhost:3000/healthz
```

### 5.2 生产单镜像

```bash
# 构建
docker build -t wpx-server:1.0.0 .

# 运行（外部 PG/Redis 必须已就绪）
docker run -d \
  --name wpx-server \
  --restart=unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  wpx-server:1.0.0
```

### 5.3 K8s（参考）

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: wpx-server }
spec:
  replicas: 2
  selector: { matchLabels: { app: wpx-server } }
  template:
    metadata: { labels: { app: wpx-server } }
    spec:
      containers:
        - name: wpx-server
          image: wpx-server:1.0.0
          ports: [{ containerPort: 3000 }]
          envFrom:
            - secretRef: { name: wpx-server-env }
          readinessProbe:
            httpGet: { path: /healthz, port: 3000 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /healthz, port: 3000 }
            initialDelaySeconds: 30
            periodSeconds: 30
          resources:
            requests: { cpu: 200m, memory: 256Mi }
            limits:   { cpu: 1000m, memory: 512Mi }
```

---

## 6. 方案 C：Railway / Render

### 6.1 Railway

1. 创建项目 → Deploy from GitHub repo（指向 `server/` 目录）。
2. 添加 Postgres 与 Redis 插件 → 复制连接字符串到 `.env`。
3. 设置环境变量：`NODE_ENV=production`、JWT、CORS 等。
4. Health Check Path 设为 `/healthz`。
5. 自定义域名：在 Railway 控制台添加 `api.prowpx.com`，CNAME 指向 Railway 提供的目标。

### 6.2 Render

1. New → Web Service → 选仓库，Root Directory 填 `server`。
2. Build Command：`npm ci --omit=dev`
3. Start Command：`node server.js`
4. Health Check Path：`/healthz`
5. 添加 Render PostgreSQL / Redis，URL 注入到环境变量。
6. Custom Domains → `api.prowpx.com` → 按提示配 CNAME。

> Railway/Render 默认在反代后面 → 设置 `TRUST_PROXY_HOPS=2`，确保 `req.ip` 拿到真实客户端 IP。

---

## 7. 数据库初始化

### 7.1 一次性执行

```bash
# 通过脚本（Linux/macOS）
bash scripts/init-db.sh

# 通过 psql 直接执行
psql "$PG_URL" -v ON_ERROR_STOP=1 -f sql/init.sql
```

### 7.2 幂等性

`sql/init.sql` 中所有 DDL 使用 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`，可重复执行。

> ⚠️ 触发器 `trg_set_updated_at` 是公共函数 `CREATE OR REPLACE`，脚本可重复跑。

---

## 8. CORS 配置

后端支持两种 CORS 模式（`.env` 中 `CORS_ORIGIN` 控制）：

| 值 | 行为 | 适用 |
| --- | --- | --- |
| `*` | 放行任意 origin，但 `credentials` 自动关闭 | 仅本地调试 |
| `https://a.com,https://b.com` | 仅白名单内带 CORS 头，其他 origin 直接不返回 CORS 头（浏览器阻断） | **生产** |

推荐生产配置：

```env
CORS_ORIGIN=https://prowpx.com,https://www.prowpx.com,https://api.prowpx.com,http://localhost:5174,http://localhost:5175
CORS_CREDENTIALS=true
```

> 营销站与后台**不需要直接调用**本服务的 `api.prowpx.com`，它们各自走 `/api/*` 反代（同源）；`api.prowpx.com` 主要服务：
> - 桌面端（Electron / Native Fetch）
> - 移动端 App
> - 第三方开放接口
> 
> **自托管认证**接口 `POST /api/auth/login`、`GET /api/auth/me` 等直接挂在 `prowpx.com/api/auth/*`（由 `api.prowpx.com` 反代），无需单独子域。

---

## 9. 验证部署

```bash
# 健康检查（不走认证）
curl -i https://api.prowpx.com/healthz

# 就绪探针（探测 PG/Redis）
curl -i https://api.prowpx.com/readyz

# 服务信息
curl -s https://api.prowpx.com/ | jq

# 鉴权检查（无 token 应 401）
curl -i https://api.prowpx.com/api/admin/skills
```

预期：

```
HTTP/2 200
content-type: application/json
{"ok":true,"data":{"name":"wpx-server","env":"production", ...}}
```

---

## 10. 监控与日志

- **PM2**：`pm2 logs wpx-api` / `pm2 monit`
- **日志目录**：`server/logs/pm2.{out,error}.log`
- **结构化字段**：`requestId / method / url / status / durationMs / ip / ua / userId`
- **云监控**：阿里云日志服务 SLS / Datadog / Loki + Grafana（任选）

---

## 11. 升级流程

```bash
cd /var/www/wpx-server
git pull origin main
cd server
npm ci --omit=dev
psql "$PG_URL" -v ON_ERROR_STOP=1 -f sql/init.sql   # 幂等
pm2 reload ecosystem.config.cjs --env production
```

> `pm2 reload` 在 cluster 模式下是 zero-downtime 滚动重载；DB schema 变更通常向后兼容（`IF NOT EXISTS`），复杂迁移请用工具如 `node-pg-migrate`。

---

## 12. 常见问题

| 问题 | 排查 |
| --- | --- |
| CORS 跨域报错 | 检查 `.env` 的 `CORS_ORIGIN` 是否包含前端完整 origin（含 `https://`，无尾斜杠） |
| JWT 验证失败 | 确认 `ACCOUNT_JWT_SECRET` 在所有环境一致；`iss` / `aud` 匹配（默认 `prowpx.com` / `wpx-server`） |
| `req.ip` 一直是 `127.0.0.1` | 设置 `TRUST_PROXY_HOPS` = 反代层数（SLB+Nginx 通常为 2） |
| `/readyz` 返回 503 | 检查 PG/Redis 连通性；阿里云安全组是否放通 5432/6379 |
| 文件上传 413 | 调大 Nginx `client_max_body_size` 与 `BODY_LIMIT` |
| CSV 导出被截断 | Nginx `proxy_buffering off; proxy_request_buffering off;`（本配置已默认设置） |