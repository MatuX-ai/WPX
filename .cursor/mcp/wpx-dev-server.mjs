#!/usr/bin/env node
/**
 * WPX 项目本地开发 MCP 服务
 * 提供：服务健康检查、端口映射、文档索引、常用命令
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..')

const SERVICES = [
  { name: 'vite', port: 5173, healthPath: '/', proxy: null },
  { name: 'export', port: 3001, healthPath: '/api/health', proxy: '/api/export' },
  { name: 'remove-bg', port: 3002, healthPath: '/api/remove-bg/health', proxy: '/api/remove-bg' },
  {
    name: 'knowledge',
    port: Number(process.env.KNOWLEDGE_SERVICE_PORT || 3003),
    healthPath: '/api/knowledge/health',
    proxy: '/api/knowledge',
  },
  { name: 'library', port: 3004, healthPath: '/api/library/health', proxy: '/api/library' },
  { name: 'ai-proxy', port: 3005, healthPath: '/api/ai/health', proxy: '/api/ai' },
]

async function probeService(service) {
  const url = `http://127.0.0.1:${service.port}${service.healthPath}`
  const started = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return {
      name: service.name,
      port: service.port,
      proxy: service.proxy,
      url,
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    return {
      name: service.name,
      port: service.port,
      proxy: service.proxy,
      url,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      error: err?.message || String(err),
    }
  }
}

async function listDocs() {
  const docsDir = join(PROJECT_ROOT, 'docs')
  const entries = await readdir(docsDir, { withFileTypes: true })
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md'))
  const result = []
  for (const file of files) {
    const path = join(docsDir, file.name)
    const content = await readFile(path, 'utf8')
    const title = content.match(/^#\s+(.+)$/m)?.[1] || file.name.replace(/\.md$/, '')
    const summary = content
      .replace(/^#.+$/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
    result.push({ file: `docs/${file.name}`, title, summary })
  }
  return result
}

const PROJECT_MAP = {
  root: PROJECT_ROOT,
  frontend: 'wpx-app/src',
  electron: 'electron',
  services: 'wpx-app/src/server',
  tests: {
    unit: 'wpx-app/src/**/__tests__',
    e2e: 'wpx-app/e2e',
  },
  docs: 'docs',
  ports: SERVICES.reduce((acc, s) => {
    acc[s.name] = s.port
    return acc
  }, {}),
  commands: {
    dev: 'npm run electron:dev',
    devMulti: 'npm run electron:dev:multi',
    unitTest: 'cd wpx-app && npm test',
    e2e: 'cd wpx-app && npm run test:e2e',
    build: 'npm run electron:build',
  },
}

const server = new McpServer({
  name: 'wpx-dev',
  version: '1.0.0',
})

server.tool(
  'wpx_check_services',
  '检查 WPX 本地开发服务（Vite + 各后端微服务）是否在线',
  {},
  async () => {
    const results = await Promise.all(SERVICES.map(probeService))
    const online = results.filter((r) => r.ok).map((r) => r.name)
    const offline = results.filter((r) => !r.ok).map((r) => r.name)
    const text = JSON.stringify({ online, offline, details: results }, null, 2)
    return { content: [{ type: 'text', text }] }
  },
)

server.tool(
  'wpx_project_map',
  '返回 WPX 项目目录结构、端口映射与常用开发命令',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(PROJECT_MAP, null, 2) }],
  }),
)

server.tool(
  'wpx_list_docs',
  '列出 docs/ 目录下的需求与设计文档（含标题与摘要）',
  {},
  async () => {
    const docs = await listDocs()
    return { content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
