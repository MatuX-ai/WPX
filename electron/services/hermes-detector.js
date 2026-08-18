/**
 * hermes-detector —— Hermes Agent / Python 环境探测（Phase 3 / M3）
 *
 * 探测两件事：
 * 1. Python 解释器（>= MIN_PYTHON_VERSION）：`python --version`，Windows 回退 `py -3 --version`
 * 2. hermes CLI：`hermes --version`
 *
 * 设计：与 jcode-detector 同款依赖注入（platform / fsImpl / runCaptureImpl），
 * 便于在无 Python 环境（CI / 本沙箱）中单测全部分支。
 */
const { spawn } = require('node:child_process')

/** Python 最低版本（Hermes Agent 对版本敏感，社区 FAQ 表明版本不符是常见坑） */
const MIN_PYTHON_VERSION = '3.11.0'
/** hermes CLI 最低版本（未严格核实，锁定上游 git tag 时以 pyproject 为准） */
const MIN_HERMES_VERSION = '0.1.0'

const PYTHON_RE = /Python\s+(\d+)\.(\d+)\.(\d+)/
const SEMVER_RE = /v?(\d+)\.(\d+)\.(\d+)/

/**
 * 解析 `python --version` 输出为 '3.12.1'，失败返回 null
 * @param {string} text
 */
function parsePythonVersion(text) {
  const match = String(text || '').match(PYTHON_RE)
  if (!match) return null
  return `${match[1]}.${match[2]}.${match[3]}`
}

/**
 * 解析 `hermes --version` 输出为 '0.19.0'，失败返回 null
 * @param {string} text
 */
function parseHermesVersion(text) {
  const match = String(text || '').match(SEMVER_RE)
  if (!match) return null
  return `${match[1]}.${match[2]}.${match[3]}`
}

function compareSemver(a, b) {
  const pa = String(a || '').split('.').map(Number)
  const pb = String(b || '').split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function detectMeetsRequirement(version, min = MIN_PYTHON_VERSION) {
  if (!version) return false
  return compareSemver(version, min) >= 0
}

/**
 * 执行命令并捕获输出（带超时）
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ shell?: boolean, timeoutMs?: number }} [options]
 */
function runCapture(cmd, args, options = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let child
    try {
      child = spawn(cmd, args, { shell: Boolean(options.shell), windowsHide: true })
    } catch (error) {
      resolve({ ok: false, stdout: '', stderr: '', error: error?.message || String(error), code: -1 })
      return
    }
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        try { child.kill('SIGKILL') } catch { /* ignore */ }
        resolve({ ok: false, stdout, stderr, error: `${cmd} ${args.join(' ')} 超时`, code: -1 })
      }
    }, options.timeoutMs || 5000)

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ok: false, stdout, stderr, error: error?.message || String(error), code: -1 })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ok: code === 0, stdout, stderr, code })
    })
  })
}

/**
 * 探测 Python 解释器
 * Windows 依次尝试 `python`、`py -3`；类 Unix 尝试 `python3`、`python`
 * @param {{ platform?: string, runCaptureImpl?: typeof runCapture, timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, command: string | null, version: string | null, meetsRequirement: boolean, detail: string }>}
 */
async function detectPython(options = {}) {
  const platform = options.platform || process.platform
  const exec = options.runCaptureImpl || runCapture
  const timeoutMs = options.timeoutMs || 5000

  const candidates = platform === 'win32'
    ? [['python', ['--version']], ['py', ['-3', '--version']]]
    : [['python3', ['--version']], ['python', ['--version']]]

  for (const [cmd, args] of candidates) {
    const result = await exec(cmd, args, { timeoutMs })
    const version = result.ok ? parsePythonVersion(result.stdout + result.stderr) : null
    if (version) {
      return {
        ok: true,
        command: cmd,
        version,
        meetsRequirement: detectMeetsRequirement(version),
        detail: `${cmd} → Python ${version}`,
      }
    }
  }
  return {
    ok: false,
    command: null,
    version: null,
    meetsRequirement: false,
    detail: '未检测到 Python（已尝试 python / python3 / py -3）',
  }
}

/**
 * 探测 hermes CLI
 * @param {{ runCaptureImpl?: typeof runCapture, timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, version: string | null, meetsRequirement: boolean, detail: string }>}
 */
async function detectHermesCli(options = {}) {
  const exec = options.runCaptureImpl || runCapture
  const timeoutMs = options.timeoutMs || 5000

  const result = await exec('hermes', ['--version'], { timeoutMs })
  const version = result.ok ? parseHermesVersion(result.stdout + result.stderr) : null
  if (version) {
    return {
      ok: true,
      version,
      meetsRequirement: detectMeetsRequirement(version, MIN_HERMES_VERSION),
      detail: `hermes ${version}`,
    }
  }
  return { ok: false, version: null, meetsRequirement: false, detail: '未检测到 hermes CLI' }
}

/**
 * 综合探测：Python + hermes CLI
 * @param {{ platform?: string, runCaptureImpl?: typeof runCapture, timeoutMs?: number }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   state: 'available' | 'missing_python' | 'python_too_old' | 'missing_hermes',
 *   python: { command: string | null, version: string | null },
 *   hermes: { version: string | null },
 *   detail: string,
 * }>}
 */
async function detectHermes(options = {}) {
  const python = await detectPython(options)
  if (!python.ok) {
    return {
      ok: false,
      state: 'missing_python',
      python: { command: null, version: null },
      hermes: { version: null },
      detail: python.detail,
    }
  }
  if (!python.meetsRequirement) {
    return {
      ok: false,
      state: 'python_too_old',
      python: { command: python.command, version: python.version },
      hermes: { version: null },
      detail: `Python ${python.version} 低于要求 ${MIN_PYTHON_VERSION}`,
    }
  }
  const hermes = await detectHermesCli(options)
  if (!hermes.ok) {
    return {
      ok: false,
      state: 'missing_hermes',
      python: { command: python.command, version: python.version },
      hermes: { version: null },
      detail: hermes.detail,
    }
  }
  return {
    ok: true,
    state: 'available',
    python: { command: python.command, version: python.version },
    hermes: { version: hermes.version },
    detail: `Python ${python.version} + hermes ${hermes.version}`,
  }
}

module.exports = {
  MIN_PYTHON_VERSION,
  MIN_HERMES_VERSION,
  parsePythonVersion,
  parseHermesVersion,
  compareSemver,
  detectMeetsRequirement,
  runCapture,
  detectPython,
  detectHermesCli,
  detectHermes,
}
