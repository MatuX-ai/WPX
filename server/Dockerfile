# =============================================================================
# WPX Server - 多阶段构建
# 构建：docker build -t wpx-server:1.0.0 .
# 运行：docker run -d --name wpx-server -p 3000:3000 --env-file .env wpx-server:1.0.0
# =============================================================================

# ---- 构建阶段：仅安装 dev deps 用于依赖完整性校验（生产 npm ci --omit=dev）----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- 运行阶段 ----
FROM node:20-alpine AS runtime
LABEL maintainer="WPX Team <ops@proclaw.cc>"

# 基础工具（用于健康检查）
RUN apk add --no-cache curl tini

# 非 root 用户
RUN addgroup -S wpx && adduser -S wpx -G wpx

WORKDIR /app

# 仅复制生产依赖与源码
COPY --from=deps --chown=wpx:wpx /app/node_modules ./node_modules
COPY --chown=wpx:wpx package.json ./
COPY --chown=wpx:wpx server.js ./
COPY --chown=wpx:wpx app.js ./
COPY --chown=wpx:wpx config ./config
COPY --chown=wpx:wpx routes ./routes
COPY --chown=wpx:wpx controllers ./controllers
COPY --chown=wpx:wpx models ./models
COPY --chown=wpx:wpx middleware ./middleware
COPY --chown=wpx:wpx utils ./utils
COPY --chown=wpx:wpx sql ./sql

USER wpx

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# tini 负责转发信号 + 回收 zombie
ENTRYPOINT ["/sbin/tini", "--"]

# 等待 process.send('ready') 后再视为健康
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]