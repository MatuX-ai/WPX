/**
 * hermes-launcher —— Hermes Gateway 子进程生命周期（Phase 3 / M3）
 *
 * 启动方式（实机源码确认，hermes-agent 0.19.0）：
 * - `hermes gateway` 前台运行；API Server 由 API_SERVER_ENABLED=true（或设置 API_SERVER_KEY）启用
 * - 端口环境变量为 API_SERVER_PORT（默认 8642，见 gateway/config.py）
 * - 鉴权：API Server 未设 API_SERVER_KEY 时拒绝启动（api_server.py connect()），
 *   故启动时必须生成随机 API_SERVER_KEY，调用方经 Authorization: Bearer <key> 访问
 *
 * 设计：spawnImpl 可注入（默认 child_process.spawn），状态机与 jcode-launcher 对齐。
 */
const { spawn } = require('node:child_process')
const { randomBytes } = require('node:crypto')

const DEFAULT_GATEWAY_PORT = 8642
const DEFAULT_TIMEOUT_MS = 30_000

/** @type {{ state: string, pid: number | null, port: number, apiKey: string | null, lastError: string | null, startedAt: number | null }} */
let status = {
  state: 'STOPPED', // STOPPED | STARTING | RUNNING | STOPPING | ERROR
  pid: null,
  port: DEFAULT_GATEWAY_PORT,
  apiKey: null,
  lastError: null,
  startedAt: null,
}

/** @type {ReturnType<typeof spawn> | null} */
let child = null

function getStatus() {
  return { ...status }
}

/**
 * 启动 Hermes Gateway 子进程
 * @param {{
 *   port?: number,
 *   apiKey?: string,
 *   hermesHome?: string,
 *   healthCheck?: (ctx: { port: number, apiKey: string }) => Promise<boolean>,
 *   extraEnv?: Record<string, string>,
 *   spawnImpl?: typeof spawn,
 *   timeoutMs?: number,
 *   readyDelayMs?: number,
 * }} [options]
 *  hermesHome：HERMES_HOME（hermes 数据/日志/配置目录，实机验证确认其默认落在 %LOCALAPPDATA%，
 *   WPX 必须改指到 userData 以守住数据主权）
 *  healthCheck：提供时轮询真实 /health 判定 RUNNING（替代 readyDelay 存活猜测）
 * @returns {Promise<ReturnType<typeof getStatus>>}
 */
function startHermesGateway(options = {}) {
  const port = Number(options.port) || DEFAULT_GATEWAY_PORT
  const spawnImpl = options.spawnImpl || spawn
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const readyDelayMs = Number(options.readyDelayMs) || 1500
  // API Server 未设 key 时拒绝启动 → 自动生成
  const apiKey = options.apiKey || `wpx-${randomBytes(16).toString('hex')}`

  if (status.state === 'RUNNING' || status.state === 'STARTING') {
    return Promise.resolve(getStatus())
  }

  status = { ...status, state: 'STARTING', port, apiKey, lastError: null }

  return new Promise((resolve) => {
    let settled = false
    let childProcess
    try {
      childProcess = spawnImpl('hermes', ['gateway'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          API_SERVER_ENABLED: 'true',
          API_SERVER_PORT: String(port),
          API_SERVER_KEY: apiKey,
          // 实机验证（hermes-agent 0.19.0）：必须设 HERMES_HOME，否则写 %LOCALAPPDATA%\hermes
          ...(options.hermesHome ? { HERMES_HOME: options.hermesHome } : {}),
          ...(options.extraEnv || {}),
        },
      })
    } catch (error) {
      status = { ...status, state: 'ERROR', lastError: error?.message || String(error) }
      resolve(getStatus())
      return
    }

    child = childProcess
    status = { ...status, pid: childProcess.pid, port }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        status = { ...status, state: 'ERROR', lastError: `网关启动超时（${timeoutMs}ms）` }
        try { childProcess.kill('SIGKILL') } catch { /* ignore */ }
        resolve(getStatus())
      }
    }, timeoutMs)

    const healthCheck = typeof options.healthCheck === 'function' ? options.healthCheck : null

    // 就绪判定：提供 healthCheck 时轮询真实健康（GET /health），否则退化为 readyDelay 存活判定
    const readyTimer = setTimeout(async () => {
      if (settled) return
      if (!healthCheck) {
        if (childProcess.exitCode === null) {
          settled = true
          clearTimeout(timer)
          status = { ...status, state: 'RUNNING', startedAt: Date.now() }
          resolve(getStatus())
        }
        return
      }
      // 进入健康轮询后由轮询自身管理超时（避免与 spawn 超时定时器竞争）
      clearTimeout(timer)
      // 轮询 /health：每 500ms 一次，直到就绪或总超时
      const healthDeadline = Date.now() + timeoutMs
      for (;;) {
        if (settled || childProcess.exitCode !== null) return
        let ok = false
        try {
          ok = await healthCheck({ port, apiKey })
        } catch {
          ok = false
        }
        if (ok) {
          settled = true
          status = { ...status, state: 'RUNNING', startedAt: Date.now() }
          resolve(getStatus())
          return
        }
        if (Date.now() > healthDeadline) {
          settled = true
          status = { ...status, state: 'ERROR', lastError: '网关健康检查超时（/health 未就绪）' }
          try { childProcess.kill('SIGKILL') } catch { /* ignore */ }
          resolve(getStatus())
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }
    }, readyDelayMs)

    childProcess.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(readyTimer)
      status = { ...status, state: 'ERROR', lastError: error?.message || String(error) }
      resolve(getStatus())
    })

    childProcess.on('close', (code) => {
      child = null
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(readyTimer)
      status = { ...status, state: code === 0 ? 'STOPPED' : 'ERROR', lastError: code === 0 ? null : `网关退出（code ${code}）` }
      resolve(getStatus())
    })
  })
}

/**
 * 停止网关（若在运行）
 * @returns {Promise<ReturnType<typeof getStatus>>}
 */
function stopHermesGateway() {
  if (status.state !== 'RUNNING' && status.state !== 'STARTING') {
    status = { ...status, state: 'STOPPED' }
    return Promise.resolve(getStatus())
  }
  status = { ...status, state: 'STOPPING' }
  return new Promise((resolve) => {
    const current = child
    if (!current) {
      status = { ...status, state: 'STOPPED', pid: null }
      resolve(getStatus())
      return
    }
    current.once('close', () => {
      child = null
      status = { ...status, state: 'STOPPED', pid: null }
      resolve(getStatus())
    })
    try {
      current.kill('SIGTERM')
    } catch (error) {
      status = { ...status, state: 'ERROR', lastError: error?.message || String(error) }
      resolve(getStatus())
    }
    // 兜底：5s 内未退出则强杀
    setTimeout(() => {
      if (status.state === 'STOPPING') {
        try { current.kill('SIGKILL') } catch { /* ignore */ }
      }
    }, 5000)
  })
}

module.exports = {
  DEFAULT_GATEWAY_PORT,
  getStatus,
  startHermesGateway,
  stopHermesGateway,
  /** 仅供单元测试重置单例状态 */
  _resetForTests() {
    child = null
    status = {
      state: 'STOPPED',
      pid: null,
      port: DEFAULT_GATEWAY_PORT,
      lastError: null,
      startedAt: null,
    }
  },
}
