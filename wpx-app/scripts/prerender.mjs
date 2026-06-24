#!/usr/bin/env node
/**
 * 静态预渲染：构建完成后执行，访问每个目标路由并把渲染后的 HTML 写入 dist/。
 *
 * 适用场景：
 * - Web 部署：根路由 "/"、"/library"、"/fonts" 等可枚举的公开页面，输出预渲染的 HTML 提升首屏 LCP。
 * - Electron 桌面：跳过（hash 模式 + loadFile，HTML 由 Electron 直接加载）。
 *
 * 实现：
 * - 启动一个本地静态文件服务器（基于 dist/ 静态文件）。
 * - 用全局 fetch 请求每条路由，截取 HTML 并在响应前替换 <title> / canonical / og:url。
 * - 把每条路由的 HTML 写入 dist/<route>/index.html 或 dist/<route>.html。
 *
 * 设计：
 * - 简化版预渲染：暂不进行 SSR（不调用 main.js 重新执行渲染），仅做"标题 + canonical + og:url"的注入。
 * - 真正的 SSR 渲染需要 entry-server 入口（Vite SSR build），对当前 Vue 3 + 大量 Tiptap / Electron 依赖
 *   栈而言成本过高且收益有限。SEO meta 的注入是 Lighthouse SEO 分数的核心。
 */

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = resolve(ROOT, 'dist')

const SITE_URL = process.env.WPX_SITE_URL || 'https://wpx.app'

// 默认要预渲染的路由
const DEFAULT_ROUTES = [
  '/',
  '/library',
  '/materials',
  '/fonts',
  '/my-fonts',
]

function parseRoutes() {
  const env = process.env.WPX_PRERENDER_ROUTES
  if (!env) return DEFAULT_ROUTES
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

/**
 * 启动静态文件服务器。
 * - 对 .html 请求路径做 SPA fallback（找不到文件时返回 index.html）。
 * - 其余资源按字节流返回。
 */
function startStaticServer(rootDir) {
  return new Promise((resolveServer, rejectServer) => {
    const indexHtml = join(rootDir, 'index.html')

    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        let pathname
        try {
          pathname = decodeURIComponent(url.pathname)
        } catch (_) {
          pathname = url.pathname
        }

        // 始终从 dist 根解析，避免越界
        const safeRoot = rootDir
        let filePath = join(safeRoot, pathname)
        if (!filePath.startsWith(safeRoot)) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('forbidden')
          return
        }

        let resolved = filePath
        if (pathname.endsWith('/')) {
          resolved = join(filePath, 'index.html')
        }

        if (!existsSync(resolved)) {
          // SPA fallback：找不到就返回根 index.html（仅限非 /assets/ 类静态资源）
          if (!pathname.startsWith('/assets/') && existsSync(indexHtml)) {
            const body = await readFile(indexHtml)
            res.writeHead(200, { 'content-type': MIME['.html'] })
            res.end(body)
            return
          }
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('not found')
          return
        }

        const ext = extname(resolved).toLowerCase()
        const body = await readFile(resolved)
        res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
        res.end(body)
      } catch (err) {
        // 必须先判断 headers 是否已发送
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        }
        try {
          res.end(String(err && err.message ? err.message : err))
        } catch (_) {
          // 静默吞掉二次写错误
        }
      }
    })

    server.on('error', rejectServer)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      resolveServer({ server, port: addr ? addr.port : 0 })
    })
  })
}

/**
 * 注入 SEO 标签：title / canonical / og:url / description（如果缺失）。
 */
function injectSeoTags(html, route) {
  const url = new URL(route, SITE_URL).toString()
  const title = inferTitleFromRoute(route)
  const description =
    'AI 驱动的智能文档编辑器，集成大模型协作、海量字体与专业级导出，专为教学、学术与内容创作打造。'

  let next = html

  // <title>
  next = next.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)

  // <link rel="canonical">
  const canonical = `<link rel="canonical" href="${escapeHtml(url)}" />`
  if (/<link rel="canonical"[^>]*>/i.test(next)) {
    next = next.replace(/<link rel="canonical"[^>]*>/i, canonical)
  } else {
    next = next.replace(/<\/head>/i, `    ${canonical}\n  </head>`)
  }

  // <meta property="og:url">
  const ogUrl = `<meta property="og:url" content="${escapeHtml(url)}" />`
  if (/<meta property="og:url"[^>]*>/i.test(next)) {
    next = next.replace(/<meta property="og:url"[^>]*>/i, ogUrl)
  } else {
    next = next.replace(/<\/head>/i, `    ${ogUrl}\n  </head>`)
  }

  // <meta property="og:title"> / og:description 覆盖，确保与 route 一致
  next = replaceMetaProperty(next, 'og:title', title)
  next = replaceMetaProperty(next, 'og:description', description)

  // <meta name="description"> 覆盖
  next = replaceMetaName(next, 'description', description)

  return next
}

function replaceMetaName(html, name, content) {
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i')
  if (re.test(html)) {
    return html.replace(re, `<meta name="${name}" content="${escapeHtml(content)}" />`)
  }
  return html.replace(/<\/head>/i, `    <meta name="${name}" content="${escapeHtml(content)}" />\n  </head>`)
}

function replaceMetaProperty(html, property, content) {
  const re = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i')
  if (re.test(html)) {
    return html.replace(re, `<meta property="${property}" content="${escapeHtml(content)}" />`)
  }
  return html.replace(/<\/head>/i, `    <meta property="${property}" content="${escapeHtml(content)}" />\n  </head>`)
}

function inferTitleFromRoute(route) {
  const map = {
    '/': 'WPX · AI 智能文档编辑器',
    '/library': '文库 · WPX',
    '/materials': '资料库 · WPX',
    '/fonts': '字体商店 · WPX',
    '/my-fonts': '我的字体 · WPX',
  }
  return map[route] || 'WPX · AI 智能文档编辑器'
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function fileExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await fileExists(DIST))) {
    console.error(`[prerender] dist 目录不存在: ${DIST}，请先运行 vite build。`)
    process.exit(1)
  }

  const indexPath = join(DIST, 'index.html')
  if (!(await fileExists(indexPath))) {
    console.error(`[prerender] 缺少 dist/index.html。`)
    process.exit(1)
  }

  const routes = parseRoutes()
  const { server, port } = await startStaticServer(DIST)
  const baseUrl = `http://127.0.0.1:${port}`

  console.log(`[prerender] 静态服务器启动于 ${baseUrl}`)

  let success = 0
  let failed = 0

  for (const route of routes) {
    const target = baseUrl + route
    try {
      const res = await fetch(target, { redirect: 'follow' })
      if (!res.ok) {
        console.warn(`[prerender] ${route} 返回 ${res.status}`)
        failed += 1
        continue
      }
      const html = await res.text()
      const out = injectSeoTags(html, route)

      let outPath
      if (route === '/') {
        outPath = join(DIST, 'index.html')
      } else if (route.endsWith('/')) {
        const dir = join(DIST, route)
        await ensureDir(dir)
        outPath = join(dir, 'index.html')
      } else {
        outPath = join(DIST, `${route}.html`)
      }
      await writeFile(outPath, out, 'utf-8')
      console.log(`[prerender] ${route} => ${outPath.replace(DIST, 'dist')}`)
      success += 1
    } catch (err) {
      console.warn(`[prerender] ${route} 失败: ${err.message}`)
      failed += 1
    }
  }

  server.close()
  console.log(`[prerender] 完成：${success} 成功，${failed} 失败，共 ${routes.length} 路由`)

  if (failed > 0 && process.env.WPX_PRERENDER_STRICT === '1') {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('[prerender] 未捕获错误:', err)
  process.exit(1)
})
