#!/usr/bin/env node
/**
 * WPX jcode 集成 MCP 服务
 * 提供 4 个工具：本地 jcode 检测、健康探活、模拟复杂任务、清理记忆
 *
 * 启动方式（IDE 读取 .cursor/mcp.json 自动拉起）：
 *   node .cursor/mcp/wpx-jcode-server.mjs
 */
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const require = createRequire(import.meta.url)
const path = require('node:path')
const os = require('node:os')

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const JCODE_PORT = Number(process.env.JCODE_PORT || 8765)
const JCODE_HOST = process.env.JCODE_HOST || '127.0.0.1'
const JCODE_HEALTH_URL = `http://${JCODE_HOST}:${JCODE_PORT}/jcode/health`
const JCODE_SWARM_URL = `http://${JCODE_HOST}:${JCODE_PORT}/jcode/swarm`
const WPX_USER_DATA = process.env.WPX_USER_DATA
  || path.join(os.homedir(), 'AppData', 'Roaming', 'wpx', 'jcode', 'memory')
  || path.join(PROJECT_ROOT, 'electron', '__tests__', '.tmp-jcode-memory')

const SEMVER_RE = /v?(\d+)\.(\d+)\.(\d+)/
const MIN_JCODE_VERSION = '0.9.0'

function compareSemver(a, b) {
  const [a1, a2, a3] = a.split('.').map(Number)
  const [b1, b2, b3] = b.split('.').map(Number)
  if (a1 !== b1) return a1 - b1
  if (a2 !== b2) return a2 - b2
  return a3 - b3
}

function parseSemver(text) {
  const match = String(text || '').match(SEMVER_RE)
  if (!match) return null
  return `${match[1]}.${match[2]}.${match[3]}`
}

function execCapture(cmd, args, options = {}) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { ...options, shell: false })
      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
      const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs || 5000)
      child.on('error', (err) => {
        clearTimeout(timer)
        resolve({ ok: false, stdout, stderr, error: err?.message || String(err) })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ ok: code === 0, stdout, stderr, code })
      })
    } catch (err) {
      resolve({ ok: false, stdout: '', stderr: '', error: err?.message || String(err) })
    }
  })
}

async function detectJcode() {
  const isWin = process.platform === 'win32'
  const which = isWin ? 'where' : 'which'
  const whichResult = await execCapture(which, ['jcode'], { shell: isWin, timeoutMs: 4000 })
  if (!whichResult.ok) {
    return {
      installed: false,
      path: null,
      version: null,
      meetsRequirement: false,
      reason: whichResult.error || `${which} jcode 命令未找到`,
    }
  }
  const lines = whichResult.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const jcodePath = lines[0] || null
  if (!jcodePath || !existsSync(jcodePath)) {
    return { installed: false, path: null, version: null, meetsRequirement: false, reason: '未找到有效 jcode 路径' }
  }
  const versionResult = await execCapture(jcodePath, ['--version'], { timeoutMs: 4000 })
  if (!versionResult.ok) {
    return { installed: true, path: jcodePath, version: null, meetsRequirement: false, reason: versionResult.stderr || '无法获取 --version' }
  }
  const version = parseSemver(versionResult.stdout)
  if (!version) {
    return { installed: true, path: jcodePath, version: null, meetsRequirement: false, reason: '版本号解析失败' }
  }
  return {
    installed: true,
    path: jcodePath,
    version,
    meetsRequirement: compareSemver(version, MIN_JCODE_VERSION) >= 0,
    minVersion: MIN_JCODE_VERSION,
  }
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 2000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

async function probeHealth() {
  const started = Date.now()
  try {
    const res = await fetchWithTimeout(JCODE_HEALTH_URL, {}, 2000)
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 200) } }
    return {
      ok: res.ok,
      url: JCODE_HEALTH_URL,
      status: res.status,
      latencyMs: Date.now() - started,
      body,
    }
  } catch (err) {
    return {
      ok: false,
      url: JCODE_HEALTH_URL,
      status: 0,
      latencyMs: Date.now() - started,
      error: err?.message || String(err),
    }
  }
}

async function callSwarm({ task, sessionId, params, context }) {
  const payload = {
    task: String(task || 'smoke'),
    session_id: String(sessionId || `mcp-${Date.now()}`),
    params: params && typeof params === 'object' ? params : { topic: 'smoke-test' },
    context: context && typeof context === 'object' ? context : { use_memory: false },
  }
  const started = Date.now()
  try {
    const res = await fetchWithTimeout(JCODE_SWARM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, 60_000)
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 200) } }
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
      payload,
      body,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      payload,
      error: err?.message || String(err),
    }
  }
}

async function clearMemory() {
  if (!WPX_USER_DATA) {
    return { ok: false, reason: 'WPX_USER_DATA 路径未解析' }
  }
  try {
    await rm(WPX_USER_DATA, { recursive: true, force: true })
    return { ok: true, path: WPX_USER_DATA, removed: true }
  } catch (err) {
    return { ok: false, path: WPX_USER_DATA, error: err?.message || String(err) }
  }
}

const server = new McpServer({ name: 'wpx-jcode', version: '1.0.0' })

server.tool(
  'wpx_jcode_detect',
  '跨平台探测本地 jcode 可执行文件、版本与最低版本校验。',
  {},
  async () => {
    const result = await detectJcode()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

server.tool(
  'wpx_jcode_health',
  '对本地 jcode 引擎 (默认 http://127.0.0.1:8765/jcode/health) 做 2s 探活。',
  {},
  async () => {
    const result = await probeHealth()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

server.tool(
  'wpx_jcode_call_swarm',
  'POST /jcode/swarm 模拟一次复杂任务调用，便于开发期调试 AI 调度中心。',
  {
    task: { type: 'string', description: '任务类型,如 generate_lesson_plan' },
    sessionId: { type: 'string', description: '会话 ID' },
    params: { type: 'object', description: '任务参数' },
    context: { type: 'object', description: '上下文(use_memory/style)' },
  },
  async ({ task, sessionId, params, context }) => {
    const result = await callSwarm({ task, sessionId, params, context })
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

server.tool(
  'wpx_jcode_clear_memory',
  '清理 jcode 本地语义记忆文件(默认 WPX_USER_DATA/jcode/memory)。',
  {},
  async () => {
    const result = await clearMemory()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
