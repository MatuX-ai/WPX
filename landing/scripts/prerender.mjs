/**
 * prerender.mjs · 静态预渲染脚本
 *
 * 流程：
 *  1. 执行 vite build（客户端，dist/）
 *  2. 执行 vite build --ssr（服务端，dist/server/）
 *  3. 读取 dist/index.html 作为模板
 *  4. 对 PRERENDER_ROUTES 中的每个路径：
 *     a. 动态 import dist/server/entry-server.js
 *     b. render(url) → { html, meta }
 *     c. 模板替换：
 *        - <!--ssr-outlet--> → 渲染的 HTML
 *        - <title>...</title> → meta.title
 *        - <meta name="description" content="..."> → meta.description
 *        - <link rel="canonical" href="..."> → siteUrl + route.path
 *     d. 写入 dist/<route>/index.html
 *  5. 生成 dist/sitemap.xml + dist/robots.txt
 *
 * 用法：
 *   node scripts/prerender.mjs
 *   或： npm run build  (内部已串好)
 */

import { build } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

// ========== 配置 ==========
// 生产环境：https://prowpx.com
// 可以通过环境变量 VITE_SITE_URL 覆盖（Vite 与此脚本都读取该变量）
const SITE_URL = process.env.VITE_SITE_URL || 'https://prowpx.com'
const PRERENDER_ROUTES = [
  { path: '/', outFile: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { path: '/blog', outFile: 'blog/index.html', priority: '0.7', changefreq: 'weekly' },
  { path: '/about', outFile: 'about/index.html', priority: '0.6', changefreq: 'monthly' },
  { path: '/changelog', outFile: 'changelog/index.html', priority: '0.6', changefreq: 'weekly' },
  { path: '/docs', outFile: 'docs/index.html', priority: '0.6', changefreq: 'weekly' },
  { path: '/skills', outFile: 'skills/index.html', priority: '0.6', changefreq: 'weekly' },
  { path: '/fonts', outFile: 'fonts/index.html', priority: '0.6', changefreq: 'weekly' },
  { path: '/legal/privacy', outFile: 'legal/privacy/index.html', priority: '0.4', changefreq: 'monthly' },
  { path: '/legal/terms', outFile: 'legal/terms/index.html', priority: '0.4', changefreq: 'monthly' },
  { path: '/legal/licenses', outFile: 'legal/licenses/index.html', priority: '0.4', changefreq: 'monthly' }
]

// ========== 工具函数 ==========
function ensureDir(p) {
  const dir = path.dirname(p)
  fs.mkdirSync(dir, { recursive: true })
}

function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeXml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
}

// ========== 步骤 1：客户端 build ==========
console.log('[prerender] 步骤 1/4 · 客户端 build...')
await build({
  configFile: path.join(ROOT, 'vite.config.js'),
  mode: 'production',
  logLevel: 'warn'
})

// ========== 步骤 2：服务端 build ==========
console.log('[prerender] 步骤 2/4 · 服务端 build...')
await build({
  configFile: path.join(ROOT, 'vite.config.js'),
  mode: 'production',
  logLevel: 'warn',
  build: {
    ssr: 'src/entry-server.js',
    outDir: path.join(DIST, 'server'),
    rollupOptions: {
      input: { 'entry-server': 'src/entry-server.js' },
      output: { entryFileNames: '[name].js', format: 'es' }
    },
    emptyOutDir: true,
    minify: false
  }
})

// ========== 步骤 3：预渲染每条路由 ==========
console.log('[prerender] 步骤 3/4 · 预渲染路由...')

// 加载服务端入口（fresh import：每个进程一次）
const ssrEntryPath = path.join(DIST, 'server', 'entry-server.js')
const ssrUrl = 'file:///' + ssrEntryPath.replace(/\\/g, '/')
const { render } = await import(ssrUrl)

const templateHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8')

for (const route of PRERENDER_ROUTES) {
  try {
    console.log(`  - ${route.path}`)
    const { html, meta } = await render(route.path)
    const finalHtml = applyTemplate(templateHtml, route, html, meta)
    const outPath = path.join(DIST, route.outFile)
    ensureDir(outPath)
    fs.writeFileSync(outPath, finalHtml, 'utf-8')
  } catch (err) {
    console.error(`  ! 渲染 ${route.path} 失败:`, err.message)
  }
}

// ========== 步骤 4：生成 sitemap.xml + robots.txt ==========
console.log('[prerender] 步骤 4/4 · 生成 sitemap.xml + robots.txt...')

const lastmod = new Date().toISOString().slice(0, 10)

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PRERENDER_ROUTES.map((r) => `  <url>
    <loc>${escapeXml(SITE_URL.replace(/\/$/, '') + r.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
</urlset>
`
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap, 'utf-8')

const robots = `# WPX robots.txt
# https://wpx.app

User-agent: *
Allow: /
Disallow: /api/

# Sitemap
Sitemap: ${SITE_URL.replace(/\/$/, '')}/sitemap.xml
`
fs.writeFileSync(path.join(DIST, 'robots.txt'), robots, 'utf-8')

console.log('[prerender] ✅ 完成！输出：', DIST)

// ========== 模板替换 ==========
function applyTemplate(template, route, appHtml, meta) {
  let out = template

  // 1) SSR 注入点：把渲染的 HTML 放到 #app 容器内
  //    使用正则：vite-plugin-html 的 minify 可能删除占位注释
  //    同时 <script> 通常被注入到 head 中，不在 #app 后面
  out = out.replace(
    /<div id="app"[^>]*>[\s\S]*?<\/div>/i,
    `<div id="app">${appHtml}</div>`
  )

  // 2) 替换 <title>
  if (meta.title) {
    out = out.replace(
      /<title>[^<]*<\/title>/i,
      `<title>${escapeHtml(meta.title)}</title>`
    )
  }

  // 3) 替换 description / keywords
  if (meta.description) {
    out = out.replace(
      /<meta name="description" content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`
    )
  }
  if (meta.keywords) {
    out = out.replace(
      /<meta name="keywords" content="[^"]*"\s*\/?>/i,
      `<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`
    )
  }

  // 4) 替换 og:title / og:description / og:url
  const fullUrl = SITE_URL.replace(/\/$/, '') + route.path
  if (meta.title) {
    out = out.replace(
      /<meta property="og:title" content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
    )
    out = out.replace(
      /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
    )
  }
  if (meta.description) {
    out = out.replace(
      /<meta property="og:description" content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
    )
    out = out.replace(
      /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
    )
  }
  out = out.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeXml(fullUrl)}" />`
  )
  out = out.replace(
    /<meta name="twitter:url" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:url" content="${escapeXml(fullUrl)}" />`
  )

  // 5) 替换 og:type
  if (meta.type) {
    out = out.replace(
      /<meta property="og:type" content="[^"]*"\s*\/?>/i,
      `<meta property="og:type" content="${escapeHtml(meta.type)}" />`
    )
  }

  // 6) 替换 canonical
  out = out.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeXml(fullUrl)}" />`
  )

  // 7) robots noindex
  if (meta.noindex) {
    if (/<meta name="robots"/i.test(out)) {
      out = out.replace(
        /<meta name="robots" content="[^"]*"\s*\/?>/i,
        `<meta name="robots" content="noindex, nofollow" />`
      )
    } else {
      out = out.replace('</head>', `<meta name="robots" content="noindex, nofollow" />\n  </head>`)
    }
  }

  return out
}
