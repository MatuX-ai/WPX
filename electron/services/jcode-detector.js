const { spawn } = require('node:child_process')

const MIN_JCODE_VERSION = '0.9.0'
const SEMVER_RE = /v?(\d+)\.(\d+)\.(\d+)/

/**
 * 解析 jcode --version 输出，返回形如 '0.9.2'，失败返回 null。
 * @param {string} text
 */
function parseSemver(text) {
  const raw = String(text || '')
  const match = raw.match(SEMVER_RE)
  if (!match) return null
  return `${match[1]}.${match[2]}.${match[3]}`
}

function compareSemver(a, b) {
  const [a1, a2, a3] = String(a).split('.').map(Number)
  const [b1, b2, b3] = String(b).split('.').map(Number)
  if (a1 !== b1) return a1 - b1
  if (a2 !== b2) return a2 - b2
  return a3 - b3
}

function detectMeetsRequirement(version) {
  if (!version) return false
  return compareSemver(version, MIN_JCODE_VERSION) >= 0
}

/**
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
      child = spawn(cmd, args, {
        shell: Boolean(options.shell),
        windowsHide: true,
      })
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
 * 跨平台查找 jcode 可执行文件。
 * 命中后取 --version 解析 semver。
 */
async function detectJcode({ platform = process.platform, fsImpl = require('node:fs'), runCaptureImpl = runCapture } = {}) {
  const isWin = platform === 'win32'
  const which = isWin ? 'where' : 'which'
  const whichResult = await runCaptureImpl(which, ['jcode'], { shell: isWin, timeoutMs: 4000 })

  if (!whichResult.ok) {
    return {
      installed: false,
      path: null,
      version: null,
      meetsRequirement: false,
      minVersion: MIN_JCODE_VERSION,
      reason: whichResult.error || `${which} jcode 命令未找到`,
      platform,
      checkedAt: Date.now(),
    }
  }

  // Windows 下 where 可能返回多行；取首条非空
  const lines = String(whichResult.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const jcodePath = lines[0] || null

  if (!jcodePath) {
    return {
      installed: false,
      path: null,
      version: null,
      meetsRequirement: false,
      minVersion: MIN_JCODE_VERSION,
      reason: '未找到有效 jcode 路径',
      platform,
      checkedAt: Date.now(),
    }
  }

  let pathExists = false
  try { pathExists = fsImpl.existsSync(jcodePath) } catch { pathExists = false }
  if (!pathExists) {
    return {
      installed: false,
      path: jcodePath,
      version: null,
      meetsRequirement: false,
      minVersion: MIN_JCODE_VERSION,
      reason: `路径 ${jcodePath} 不存在`,
      platform,
      checkedAt: Date.now(),
    }
  }

  const versionResult = await runCaptureImpl(jcodePath, ['--version'], { timeoutMs: 4000 })
  if (!versionResult.ok) {
    return {
      installed: true,
      path: jcodePath,
      version: null,
      meetsRequirement: false,
      minVersion: MIN_JCODE_VERSION,
      reason: versionResult.stderr?.trim() || versionResult.error || '无法获取 --version',
      platform,
      checkedAt: Date.now(),
    }
  }

  const version = parseSemver(versionResult.stdout)
  if (!version) {
    return {
      installed: true,
      path: jcodePath,
      version: null,
      meetsRequirement: false,
      minVersion: MIN_JCODE_VERSION,
      reason: `无法从 '${versionResult.stdout.trim()}' 解析 semver`,
      platform,
      checkedAt: Date.now(),
    }
  }

  return {
    installed: true,
    path: jcodePath,
    version,
    meetsRequirement: detectMeetsRequirement(version),
    minVersion: MIN_JCODE_VERSION,
    platform,
    checkedAt: Date.now(),
  }
}

module.exports = {
  detectJcode,
  parseSemver,
  compareSemver,
  detectMeetsRequirement,
  runCapture,
  MIN_JCODE_VERSION,
}
