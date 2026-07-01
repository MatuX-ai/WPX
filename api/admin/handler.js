// Vercel Serverless Function: WPX Admin 后端（生产实现）
// 路由：/admin/api/* （通过 Vercel rewrites 路由）
//
// 设计动机（2026-06-30）：
//  WPX 是营销站，但 admin 后台要真实可用。
//  把现有 server/（完整 Express + PostgreSQL + Redis + SMTP + JWT）作为
//  Vercel Function 运行，避免重复开发后端业务逻辑。
//
// 架构：
//   server/         - 完整 Node.js + Express 后端（PG/Redis/JWT/SMTP/bcrypt）
//   api/admin/handler.js - Vercel Function 入口（薄包装）
//
// 为什么不在 Vercel 跑 server/server.js（启动 listen）：
//  Vercel Function 是无服务器模式，每个请求可视为独立进程；
//  Express app 本质是 (req, res) → Promise 的中间件链，
//  把 app 作为 (req, res) 函数直接调用即可，无需 listen。
//  pg.Pool/redis client 都在模块加载时实例化并跨请求复用，
//  Vercel Function 容器复用机制会保持连接（避免每次冷启动都新建连接）。
//
// 路径处理：
//  Vercel rewrites 把 /admin/api/* → /api/admin/handler?path=<rest>
//  server/ 内部路由全是 /api/* 形式（/api/auth/login 等）；
//  本 handler 必须把入站 url 改写成 /api/* 形式再交给 Express。

'use strict'

const path = require('path')
const fs = require('fs')
const { parseBody, installParsedBody } = require('../_shared/parse-body')

// 加载项目根 _server/app.js（Vercel 部署后位于 /var/task/_server/app.js）
// _server/ 是项目根顶层目录，不在 api/ 下，Vercel 不会扫描其中 .js 为 Function。
const ROOT_UNDERSCORE_SERVER = path.join(__dirname, '..', '..', '_server', 'app.js')
const serverAppPath = fs.existsSync(ROOT_UNDERSCORE_SERVER)
  ? ROOT_UNDERSCORE_SERVER
  : (() => {
      // 兑底：老路径 _server/（项目根 api/ 下的下划线目录），兼容旧部署。
      const candidate = path.join(__dirname, '_server', 'app.js')
      if (fs.existsSync(candidate)) return candidate
      throw new Error(
        `[wpx-admin-handler] _server/app.js not found. checked: ${ROOT_UNDERSCORE_SERVER} and ${candidate}`
      )
    })()
// eslint-disable-next-line no-console
console.log('[wpx-admin-handler] loading', serverAppPath)

// 加载 server/ 后端
const { createApp } = require(serverAppPath)

// 单例 Express app（Vercel Function 容器复用 + pg pool 复用）
let cachedApp = null
function getApp() {
  if (!cachedApp) cachedApp = createApp()
  return cachedApp
}

// 错误兑底中间件（防止异步异常泄漏到 Vercel）
function safeError(res, err) {
  // eslint-disable-next-line no-console
  console.error('[wpx-admin-handler] unhandled error', err)
  if (!res.headersSent) {
    try {
      const debugMode = String(process.env.WPX_DEBUG_ERROR || '').toLowerCase() === 'true'
      const body = debugMode
        ? {
            ok: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: '服务器内部错误',
              debug: {
                name: err.name,
                message: err.message,
                stack: (err.stack || '').split('\n').slice(0, 10).join('\n')
              }
            }
          }
        : {
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
          }
      res.status(500).json(body)
    } catch (_) {
      // ignore
    }
  }
}

module.exports = async function handler(req, res) {
  try {
    // /admin/api/* → /api/*
    // Vercel rewrites 把 path 写到 ?path= 查询参数；
    // req.url 通常是 /api/admin/handler?path=auth/login
    // 我们要把 req.url 改写成 /api/auth/login 再交给 Express
    const originalUrl = req.url || '/'

    // 方案 A: Vercel rewrites 用 ?path= 参数（/admin/api/(.*) → /api/admin/handler?path=$1）
    let rewrittenUrl = originalUrl
    try {
      const u = new URL(originalUrl, 'http://localhost')
      const p = u.searchParams.get('path')
      if (p) {
        // 移除 ?path= 参数（Express 会自己读 req.query）
        u.searchParams.delete('path')
        rewrittenUrl = u.pathname + (u.search ? u.search : '')
      }
    } catch (_) {
      // URL 解析失败就用原 url
    }

    // 兜底：如果 url 仍然包含 /admin 前缀，手动剥除
    // （兼容直接调用 /admin/api/auth/login 而非 rewrite 场景）
    rewrittenUrl = rewrittenUrl.replace(/^\/admin/, '') || '/'

    req.url = rewrittenUrl

    // 诊断捷径（rewrite 后）：req.url 现在是 /api/health
    if (req.url === '/api/health' || req.url.startsWith('/api/health?') || req.url.startsWith('/api/health/')) {
      const diag = {
        url: req.url,
        method: req.method,
        ct: req.headers['content-type'] || null,
        cl: req.headers['content-length'] || null,
        nodeEnv: process.env.NODE_ENV || null,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasPgHost: Boolean(process.env.PG_HOST),
        pgHost: process.env.PG_HOST || null,
        pgPort: process.env.PG_PORT || null,
        pgDb: process.env.PG_DATABASE || null,
        pgSsl: process.env.PG_SSL || null,
        hasRedis: Boolean(process.env.REDIS_URL),
        hasJwt: Boolean(process.env.ACCOUNT_JWT_SECRET),
        ts: new Date().toISOString()
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-WPX-Diag', Buffer.from(JSON.stringify(diag)).toString('base64').slice(0, 768))
      res.status(200).end(JSON.stringify({ ok: true, diag }))
      return
    }

    // 业务层 body 解析兑底：detailed comment in api/_shared/parse-body.js
    // 1) 顶先预解析，避免 Express body-parser 访问 Vercel getter 抛 'invalid media type'
    // 2) 装到 req.body 并打 _body 标记，让后续 body-parser 跳过
    const preParsed = await parseBody(req)
    installParsedBody(req, preParsed)

    const app = getApp()
    await new Promise((resolve, reject) => {
      const onFinish = () => resolve()
      const onClose = () => resolve()
      const onError = (err) => reject(err)
      res.once('finish', onFinish)
      res.once('close', onClose)
      res.once('error', onError)
      try {
        app(req, res)
      } catch (err) {
        reject(err)
      }
    })
  } catch (err) {
    safeError(res, err)
  }
}

// 兼容 Vercel Node.js Function 导出风格
module.exports.default = module.exports