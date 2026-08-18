/**
 * hermes-detector 单元测试（Phase 3 / M3）
 *
 * 运行：npm --prefix wpx-app run test:zip -- hermes-detector
 */
import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const detector = require('../services/hermes-detector.js')
const {
  parsePythonVersion,
  parseHermesVersion,
  compareSemver,
  detectMeetsRequirement,
  detectPython,
  detectHermesCli,
  detectHermes,
  MIN_PYTHON_VERSION,
} = detector

// ═════════════════════════════════════════════════
// 1. 版本解析
// ═════════════════════════════════════════════════
describe('hermes-detector — 版本解析', () => {
  it('解析 python --version 输出', () => {
    expect(parsePythonVersion('Python 3.12.1\n')).toBe('3.12.1')
    expect(parsePythonVersion('Python 3.11.9')).toBe('3.11.9')
    expect(parsePythonVersion('3.10.0')).toBeNull()
    expect(parsePythonVersion('')).toBeNull()
    expect(parsePythonVersion(null)).toBeNull()
  })

  it('解析 hermes --version 输出（含 v 前缀）', () => {
    expect(parseHermesVersion('Hermes Agent v0.19.0\n')).toBe('0.19.0')
    expect(parseHermesVersion('hermes 0.1.0')).toBe('0.1.0')
    expect(parseHermesVersion('not a version')).toBeNull()
  })

  it('compareSemver 大小比较', () => {
    expect(compareSemver('3.11.0', '3.10.9')).toBeGreaterThan(0)
    expect(compareSemver('3.11.0', '3.11.0')).toBe(0)
    expect(compareSemver('3.9.9', '3.11.0')).toBeLessThan(0)
  })

  it('detectMeetsRequirement 最低版本 3.11', () => {
    expect(MIN_PYTHON_VERSION).toBe('3.11.0')
    expect(detectMeetsRequirement('3.11.0')).toBe(true)
    expect(detectMeetsRequirement('3.12.1')).toBe(true)
    expect(detectMeetsRequirement('3.10.0')).toBe(false)
    expect(detectMeetsRequirement(null)).toBe(false)
  })
})

// ═════════════════════════════════════════════════
// 2. detectPython / detectHermesCli（mock runCapture）
// ═════════════════════════════════════════════════
describe('hermes-detector — detectPython', () => {
  it('win32：python 命中', async () => {
    const runCaptureImpl = vi.fn(async (cmd) => {
      if (cmd === 'python') return { ok: true, stdout: 'Python 3.12.1\n', stderr: '', code: 0 }
      return { ok: false, stdout: '', stderr: '', error: 'x', code: 1 }
    })
    const result = await detectPython({ platform: 'win32', runCaptureImpl })
    expect(result.ok).toBe(true)
    expect(result.command).toBe('python')
    expect(result.version).toBe('3.12.1')
    expect(result.meetsRequirement).toBe(true)
  })

  it('win32：python 缺失时回退 py -3', async () => {
    const runCaptureImpl = vi.fn(async (cmd) => {
      if (cmd === 'py') return { ok: true, stdout: 'Python 3.11.9\r\n', stderr: '', code: 0 }
      return { ok: false, stdout: '', stderr: '', error: 'not found', code: 1 }
    })
    const result = await detectPython({ platform: 'win32', runCaptureImpl })
    expect(result.ok).toBe(true)
    expect(result.command).toBe('py')
    expect(result.version).toBe('3.11.9')
  })

  it('类 Unix：python3 命中', async () => {
    const runCaptureImpl = vi.fn(async (cmd) => {
      if (cmd === 'python3') return { ok: true, stdout: 'Python 3.12.1\n', stderr: '', code: 0 }
      return { ok: false, stdout: '', stderr: '', error: 'x', code: 1 }
    })
    const result = await detectPython({ platform: 'darwin', runCaptureImpl })
    expect(result.ok).toBe(true)
    expect(result.command).toBe('python3')
  })

  it('全部缺失 → ok:false', async () => {
    const runCaptureImpl = vi.fn(async () => ({ ok: false, stdout: '', stderr: '', error: 'x', code: 1 }))
    const result = await detectPython({ platform: 'linux', runCaptureImpl })
    expect(result.ok).toBe(false)
    expect(result.version).toBeNull()
    expect(result.detail).toContain('Python')
  })

  it('版本过低 → meetsRequirement:false', async () => {
    const runCaptureImpl = vi.fn(async (cmd) => {
      if (cmd === 'python') return { ok: true, stdout: 'Python 3.9.2\n', stderr: '', code: 0 }
      return { ok: false, stdout: '', stderr: '', error: 'x', code: 1 }
    })
    const result = await detectPython({ platform: 'win32', runCaptureImpl })
    expect(result.ok).toBe(true)
    expect(result.meetsRequirement).toBe(false)
  })
})

describe('hermes-detector — detectHermesCli', () => {
  it('hermes 命中', async () => {
    const runCaptureImpl = vi.fn(async () => ({ ok: true, stdout: 'Hermes Agent v0.19.0\n', stderr: '', code: 0 }))
    const result = await detectHermesCli({ runCaptureImpl })
    expect(result.ok).toBe(true)
    expect(result.version).toBe('0.19.0')
  })

  it('未安装 → ok:false', async () => {
    const runCaptureImpl = vi.fn(async () => ({ ok: false, stdout: '', stderr: '', error: 'command not found', code: 127 }))
    const result = await detectHermesCli({ runCaptureImpl })
    expect(result.ok).toBe(false)
    expect(result.version).toBeNull()
  })
})

// ═════════════════════════════════════════════════
// 3. detectHermes 综合状态机
// ═════════════════════════════════════════════════
describe('hermes-detector — detectHermes', () => {
  function makeExec({ python = '3.12.1', hermes = '0.19.0' } = {}) {
    return vi.fn(async (cmd) => {
      if (cmd === 'python' || cmd === 'python3') {
        return python ? { ok: true, stdout: `Python ${python}\n`, stderr: '', code: 0 } : { ok: false, stdout: '', stderr: '', error: 'x', code: 1 }
      }
      if (cmd === 'hermes') {
        return hermes ? { ok: true, stdout: `Hermes Agent v${hermes}\n`, stderr: '', code: 0 } : { ok: false, stdout: '', stderr: '', error: 'x', code: 127 }
      }
      return { ok: false, stdout: '', stderr: '', error: 'unknown', code: 1 }
    })
  }

  it('完整可用：available', async () => {
    const result = await detectHermes({ platform: 'win32', runCaptureImpl: makeExec() })
    expect(result.ok).toBe(true)
    expect(result.state).toBe('available')
    expect(result.python.version).toBe('3.12.1')
    expect(result.hermes.version).toBe('0.19.0')
  })

  it('无 Python：missing_python', async () => {
    const result = await detectHermes({ platform: 'win32', runCaptureImpl: makeExec({ python: null }) })
    expect(result.ok).toBe(false)
    expect(result.state).toBe('missing_python')
  })

  it('Python 过旧：python_too_old', async () => {
    const result = await detectHermes({ platform: 'win32', runCaptureImpl: makeExec({ python: '3.9.0' }) })
    expect(result.ok).toBe(false)
    expect(result.state).toBe('python_too_old')
  })

  it('无 hermes CLI：missing_hermes', async () => {
    const result = await detectHermes({ platform: 'win32', runCaptureImpl: makeExec({ hermes: null }) })
    expect(result.ok).toBe(false)
    expect(result.state).toBe('missing_hermes')
    expect(result.python.version).toBe('3.12.1')
  })
})
