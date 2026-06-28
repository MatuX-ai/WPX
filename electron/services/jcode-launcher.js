const { EventEmitter } = require('node:events')
const { spawn } = require('node:child_process')
const net = require('node:net')

const detector = require('./jcode-detector')

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8765
const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const READY_TIMEOUT_MS = 3000
const SHUTDOWN_GRACE_MS = 5000

const STATES = Object.freeze({
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  SLEEPING: 'sleeping',
  FAILED: 'failed',
})

/**
 * @typedef {{
 *   state: keyof typeof STATES,
 *   pid: number | null,
 *   port: number,
 *   host: string,
 *   version: string | null,
 *   path: string | null,
 *   lastError: string | null,
 *   startedAt: number | null,
 *   lastActivityAt: number | null,
 * }} JcodeStatus
 */

/** @type {JcodeStatus} */
let status = {
  state: 'STOPPED',
  pid: null,
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  version: null,
  path: null,
  lastError: null,
  startedAt: null,
  lastActivityAt: null,
}

/** @type {import('node:child_process').ChildProcess | null} */
let proc = null
/** @type {NodeJS.Timeout | null} */
let readyTimer = null
/** @type {NodeJS.Timeout | null} */
let idleTimer = null

const emitter = new EventEmitter()

function setStatus(patch) {
  const next = { ...status, ...patch }
  status = next
  emitter.emit('status', next)
  if (typeof globalThis.__wpxBroadcastJcodeStatus === 'function') {
    try { globalThis.__wpxBroadcastJcodeStatus(next) } catch { /* ignore */ }
  }
  return next
}

function getStatus() {
  return { ...status }
}

function on(event, listener) {
  emitter.on(event, listener)
  return () => emitter.off(event, listener)
}

function off(event, listener) {
  emitter.off(event, listener)
}

function clearReadyTimer() {
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = null
  }
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function probePort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    let resolved = false
    const timer = setTimeout(() => {
      if (resolved) return
      resolved = true
      socket.destroy()
      resolve(false)
    }, timeoutMs)
    socket.once('connect', () => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      socket.end()
      resolve(true)
    })
    socket.once('error', () => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      socket.destroy()
      resolve(false)
    })
  })
}

async function waitReady(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await probePort(host, port, 250)
    if (ok) return true
  }
  return false
}

function scheduleIdleSleep() {
  clearIdleTimer()
  if (status.state !== 'RUNNING') return
  idleTimer = setTimeout(() => {
    idleTimer = null
    if (status.state === 'RUNNING') {
      setStatus({ state: 'SLEEPING' })
      // 异步触发实际停止，避免在 timer 回调中同步阻塞
      stopJcode().catch((err) => {
        setStatus({ state: 'FAILED', lastError: err?.message || String(err) })
      })
    }
  }, IDLE_TIMEOUT_MS)
}

function markActivity() {
  if (status.state !== 'RUNNING' && status.state !== 'SLEEPING') return
  setStatus({ lastActivityAt: Date.now() })
  if (status.state === 'SLEEPING') {
    // 唤醒：异步重启
    startJcode().catch(() => { /* swallow, status already set */ })
    return
  }
  scheduleIdleSleep()
}

/**
 * 启动 jcode 守护进程。若未指定 binaryPath，会先调 detectJcode 探测。
 * @param {{ binaryPath?: string, port?: number, host?: string, autoStart?: boolean }} [options]
 */
async function startJcode(options = {}) {
  if (proc && status.state !== 'STOPPED' && status.state !== 'SLEEPING' && status.state !== 'FAILED') {
    return getStatus()
  }

  const port = Number(options.port) || DEFAULT_PORT
  const host = String(options.host || DEFAULT_HOST)

  let binaryPath = options.binaryPath
  let version = status.version
  if (!binaryPath) {
    const detection = await detector.detectJcode()
    if (!detection.installed) {
      return setStatus({
        state: 'FAILED',
        lastError: detection.reason || 'jcode 未安装',
        path: null,
        version: null,
      })
    }
    binaryPath = detection.path
    version = detection.version
  }

  setStatus({
    state: 'STARTING',
    port,
    host,
    path: binaryPath,
    version,
    lastError: null,
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  })

  try {
    proc = spawn(binaryPath, ['serve', `--port=${port}`, `--host=${host}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, WPX_JCODE_PORT: String(port) },
    })
  } catch (error) {
    proc = null
    return setStatus({
      state: 'FAILED',
      lastError: error?.message || String(error),
    })
  }

  proc.stdout?.on('data', (chunk) => {
    const text = String(chunk)
    process.stdout.write(`[jcode] ${text}`)
    if (/ready|listening/i.test(text)) {
      clearReadyTimer()
      setStatus({ state: 'RUNNING', lastError: null })
      scheduleIdleSleep()
    }
  })
  proc.stderr?.on('data', (chunk) => {
    const text = String(chunk)
    process.stderr.write(`[jcode:err] ${text}`)
    if (/error|panic|fatal/i.test(text) && status.state === 'STARTING') {
      setStatus({ lastError: text.trim().slice(0, 200) })
    }
  })
  proc.on('error', (error) => {
    clearReadyTimer()
    proc = null
    setStatus({ state: 'FAILED', lastError: error?.message || String(error) })
  })
  proc.on('exit', (code, signal) => {
    clearReadyTimer()
    clearIdleTimer()
    const wasRunning = status.state === 'RUNNING' || status.state === 'STARTING'
    proc = null
    if (wasRunning) {
      setStatus({
        state: code === 0 ? 'STOPPED' : 'FAILED',
        pid: null,
        lastError: code === 0 ? null : `退出码 ${code}（signal ${signal || '-'}）`,
      })
    } else {
      // 已是 STOPPED / FAILED / SLEEPING,只更新 pid
      setStatus({ pid: null })
    }
  })

  setStatus({ pid: proc.pid || null })

  // 端口探活兜底
  const ready = await waitReady(host, port, READY_TIMEOUT_MS)
  if (ready && status.state === 'STARTING') {
    clearReadyTimer()
    setStatus({ state: 'RUNNING', lastError: null })
    scheduleIdleSleep()
  } else if (status.state === 'STARTING') {
    // 端口未就绪但子进程仍在：先进入 RUNNING 但标记 lastError，由调用方决定是否重试
    setStatus({ state: 'RUNNING', lastError: status.lastError || '端口探活超时，已就绪但未确认' })
    scheduleIdleSleep()
  }

  return getStatus()
}

async function stopJcode({ reason } = {}) {
  clearReadyTimer()
  clearIdleTimer()
  if (!proc) {
    return setStatus({
      state: 'STOPPED',
      pid: null,
      lastError: reason || null,
    })
  }
  const child = proc
  proc = null
  setStatus({ state: 'STOPPED', pid: null, lastError: reason || null })
  await new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(killTimer)
      resolve()
    }
    const killTimer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* ignore */ }
      finish()
    }, SHUTDOWN_GRACE_MS)
    child.once('exit', finish)
    try { child.kill('SIGTERM') } catch { finish() }
  })
  return getStatus()
}

async function restartJcode(options = {}) {
  await stopJcode()
  return startJcode(options)
}

async function ensureJcodeRunning(options = {}) {
  if (status.state === 'RUNNING') return getStatus()
  if (status.state === 'STARTING') {
    // 等待最久 2s
    const start = Date.now()
    while (Date.now() - start < 2000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100))
      if (status.state === 'RUNNING' || status.state === 'FAILED') return getStatus()
    }
    return getStatus()
  }
  return startJcode(options)
}

function isJcodeRunning() {
  return status.state === 'RUNNING'
}

module.exports = {
  STATES,
  getStatus,
  setStatus,
  startJcode,
  stopJcode,
  restartJcode,
  ensureJcodeRunning,
  markActivity,
  isJcodeRunning,
  on,
  off,
  DEFAULT_HOST,
  DEFAULT_PORT,
  IDLE_TIMEOUT_MS,
  READY_TIMEOUT_MS,
}
