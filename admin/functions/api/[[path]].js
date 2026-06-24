// Cloudflare Pages Functions: API 反向代理
// 路由：/api/*  ->  https://api.prowpx.com/admin/*
// 用途：让 prowpx.com 与业务 API 同源，避免浏览器 CORS
// 管理后台部署在 https://prowpx.com/admin 下，前端 /api/* 请求
// 由本 Functions 反代到后端 https://api.prowpx.com/admin/*
//
// 环境变量（在 Cloudflare Pages 控制台 -> Settings -> Environment variables 配置）：
//   API_TARGET = https://api.prowpx.com/admin   （默认）

const TARGET = 'https://api.prowpx.com/admin'

// 不透传的 hop-by-hop 请求头
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

function passthroughHeaders(request) {
  const out = {}
  for (const [k, v] of request.headers.entries()) {
    const lk = k.toLowerCase()
    if (HOP_BY_HOP.has(lk)) continue
    out[k] = v
  }
  out['X-Forwarded-Host'] = request.headers.get('host') || ''
  out['X-Forwarded-Proto'] = 'https'
  return out
}

export async function onRequest(context) {
  const { request, env } = context
  const targetBase = env.API_TARGET || TARGET

  // 构造目标 URL：把 /api/<path> 映射到 <targetBase>/<path>
  const url = new URL(request.url)
  const restPath = url.pathname.replace(/^\/api\/?/, '')
  const targetUrl = `${targetBase}/${restPath}${url.search}`

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  // 透传 body（避免重复读取）
  const init = {
    method: request.method,
    headers: passthroughHeaders(request),
    redirect: 'manual'
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body
  }

  try {
    const upstream = await fetch(targetUrl, init)

    // 透传白名单响应头
    const passthrough = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'content-disposition',
      'x-request-id',
      'x-trace-id'
    ]
    const outHeaders = new Headers()
    for (const k of passthrough) {
      const v = upstream.headers.get(k)
      if (v) outHeaders.set(k, v)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        code: 502,
        message: 'API gateway error: ' + (err && err.message ? err.message : 'unknown')
      }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    )
  }
}
