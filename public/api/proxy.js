// Vercel Serverless Function: API 反向代理
// 路由：/api/*  ->  https://api.prowpx.com/admin/*
// 用途：避免浏览器跨域（CORS），让 prowpx.com 与业务 API 同源
// 管理后台部署在 https://prowpx.com/admin 下，前端 /api/* 请求
// 由本 Serverless Function 反代到后端 https://api.prowpx.com/admin/*
//
// 环境变量（在 Vercel 控制台配置）：
//   API_TARGET = https://api.prowpx.com/admin   （默认）
//   ALLOWED_ORIGINS = https://prowpx.com        （逗号分隔）

const TARGET = process.env.API_TARGET || 'https://api.prowpx.com/admin'

// 允许触发反代的来源白名单（逗号分隔）。为空时默认允许同源请求。
// 防止本反代函数被外部站点滥用为开放 HTTP 代理。
// 默认同时放行 apex 与 www 子域，避免 www → apex 308 重定向阻断 preflight。
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://prowpx.com,https://www.prowpx.com')
  .split(',')
  .map((s) => s.trim().toLowerCase().replace(/\/$/, ''))
  .filter(Boolean)

// 允许反代的路径前缀白名单。仅 admin 业务 API 需要经过此代理，
// 拒绝对未知路径的请求，降低被用作通用 HTTP 代理的风险。
// 兼容直接调用 /api/auth/* 与被重写后的 /admin/api/* 两种来源。
const FORWARDABLE_PATH_PREFIXES = [
  'auth/',
  'admin/',
  'users/',
  'models/',
  'fonts/',
  'skills/',
  'orders/',
  'announcements/',
  'settings/',
  'logs/',
  'feedbacks/',
  'dashboard/',
  'token/',
]

// 同源白名单（用于反射 Access-Control-Allow-Origin，必须精确匹配）
// 包含所有需要走该反代的前端入口（apex / www / 任意预览环境）。
const CORS_ALLOW_LIST = (process.env.CORS_ALLOW_LIST || 'https://prowpx.com,https://www.prowpx.com')
  .split(',')
  .map((s) => s.trim().toLowerCase().replace(/\/$/, ''))
  .filter(Boolean)

function resolveCorsOrigin(req) {
  const origin = (req.headers.origin || '').trim().toLowerCase().replace(/\/$/, '')
  if (!origin) return ''
  return CORS_ALLOW_LIST.includes(origin) ? origin : ''
}

// 请求超时（毫秒）
const REQUEST_TIMEOUT = 25000

// 不透传的请求头（hop-by-hop + 主机头）
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length'
])

function buildHeaders(req) {
  const out = {}
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (v == null) continue
    const lk = k.toLowerCase()
    if (HOP_BY_HOP.has(lk)) continue
    out[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  // 标识真实来源（供后端审计）
  out['X-Forwarded-Host'] = req.headers.host || ''
  out['X-Forwarded-Proto'] = 'https'
  return out
}

function buildTargetUrl(req) {
  // /api/proxy?path=xxx&...
  // 重写规则：/api/foo/bar -> /api/proxy?path=foo/bar
  const path = (req.query && req.query.path) || ''
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  // 把原 query 去掉 path 参数后拼到目标 URL
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === 'path') continue
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x))
    else if (v != null) params.append(k, String(v))
  }
  const qs = params.toString()
  const tail = qs ? '?' + qs : ''
  return `${TARGET}/${path}${tail}`
}

function validateOrigin(req) {
  if (ALLOWED_ORIGINS.length === 0) return true
  const origin = (req.headers.origin || req.headers.referer || '').trim().toLowerCase().replace(/\/$/, '')
  if (!origin) return true // 同源请求通常不带 origin，放行
  return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))
}

function validatePath(path) {
  if (!path) return false
  const normalized = path.replace(/^\/+/, '')
  return FORWARDABLE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

module.exports = async (req, res) => {
  // CORS 预检：本函数直接响应，**绝不**转发到上游，避免上游 30x 让 preflight 失败
  // （CORS 规范：preflight 响应不允许 3xx 状态码，浏览器会直接阻断）
  if (req.method === 'OPTIONS') {
    const allowOrigin = resolveCorsOrigin(req)
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Max-Age', '86400')
    }
    res.status(204).end()
    return
  }

  // 对真实请求也主动回写 CORS 头，覆盖代理链上缺失或被剥离的 CORS 头
  const allowOrigin = resolveCorsOrigin(req)
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  const path = (req.query && req.query.path) || ''

  // 安全校验：拒绝非授权来源的请求
  if (!validateOrigin(req)) {
    res.status(403).json({ code: 403, message: 'Forbidden: origin not allowed' })
    return
  }

  // 安全校验：拒绝未知路径的请求，防止被用作开放代理
  if (!validatePath(path)) {
    res.status(403).json({ code: 403, message: 'Forbidden: path not allowed' })
    return
  }

  const url = buildTargetUrl(req)

  // 构造 fetch 选项
  const init = {
    method: req.method,
    headers: buildHeaders(req),
    redirect: 'manual'
  }

  // 仅对有 body 的方法转发 body
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
      // Vercel 默认已解析 JSON / 文本
      init.body = JSON.stringify(req.body)
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json'
    } else if (req.body != null) {
      init.body = req.body
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    const upstream = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timer)

    // 透传响应头（去除 hop-by-hop + 禁用 CORS 相关头）
    const headers = upstream.headers
    const passthrough = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'content-disposition',
      'x-request-id',
      'x-trace-id'
    ]
    for (const k of passthrough) {
      const v = headers.get(k)
      if (v) res.setHeader(k, v)
    }

    res.status(upstream.status)
    // 透传 body
    if (upstream.body) {
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.end(buf)
    } else {
      res.end()
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/proxy] error:', err)
    const isTimeout = err && err.name === 'AbortError'
    res.status(isTimeout ? 504 : 502).json({
      code: isTimeout ? 504 : 502,
      message: isTimeout
        ? 'API gateway timeout'
        : 'API gateway error'
    })
  }
}

// Vercel Function 运行时配置
// 绕过 vercel.json 中 `functions` 字段的 glob 模式匹配问题
// (CLI 54.10.2 回归 bug + 自定义 Root Directory 项目)
module.exports.config = {
  memory: 256,
  maxDuration: 10
}
