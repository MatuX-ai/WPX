/**
 * jcode-detector 单元测试
 *
 * 运行：npx vitest run --config electron/vitest.config.js jcode-detector
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const detector = require('../services/jcode-detector.js')
const { parseSemver, compareSemver, detectMeetsRequirement, detectJcode, MIN_JCODE_VERSION } = detector

describe('jcode-detector — parseSemver', () => {
  it('解析 v 前缀版本', () => {
    expect(parseSemver('jcode 0.9.2')).toBe('0.9.2')
    expect(parseSemver('jcode v1.2.3')).toBe('1.2.3')
  })

  it('解析裸 semver', () => {
    expect(parseSemver('0.9.0')).toBe('0.9.0')
    expect(parseSemver('1.10.20')).toBe('1.10.20')
  })

  it('空字符串 / 非 semver 返回 null', () => {
    expect(parseSemver('')).toBeNull()
    expect(parseSemver('not a version')).toBeNull()
    expect(parseSemver(null)).toBeNull()
    expect(parseSemver(undefined)).toBeNull()
  })
})

describe('jcode-detector — compareSemver', () => {
  it('主版本差异', () => {
    expect(compareSemver('1.0.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareSemver('0.9.0', '1.0.0')).toBeLessThan(0)
  })

  it('次版本差异', () => {
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0)
  })

  it('修订版本差异', () => {
    expect(compareSemver('0.9.2', '0.9.1')).toBeGreaterThan(0)
  })

  it('相等返回 0', () => {
    expect(compareSemver('0.9.2', '0.9.2')).toBe(0)
  })
})

describe('jcode-detector — detectMeetsRequirement', () => {
  it('达到最低版本', () => {
    expect(detectMeetsRequirement('0.9.0')).toBe(true)
    expect(detectMeetsRequirement('0.9.5')).toBe(true)
    expect(detectMeetsRequirement('1.0.0')).toBe(true)
  })

  it('低于最低版本', () => {
    expect(detectMeetsRequirement('0.8.9')).toBe(false)
    expect(detectMeetsRequirement('0.1.0')).toBe(false)
  })

  it('空值返回 false', () => {
    expect(detectMeetsRequirement(null)).toBe(false)
    expect(detectMeetsRequirement('')).toBe(false)
  })

  it('最低版本常量 = 0.9.0', () => {
    expect(MIN_JCODE_VERSION).toBe('0.9.0')
  })
})

describe('jcode-detector — detectJcode', () => {
  /** @type {Array<{platform: string, fsImpl: any, runCaptureImpl: any, expectedFirstCmd: string}>} */
  const cases = [
    { platform: 'win32', expectedFirstCmd: 'where' },
    { platform: 'darwin', expectedFirstCmd: 'which' },
    { platform: 'linux', expectedFirstCmd: 'which' },
  ]

  cases.forEach(({ platform, expectedFirstCmd }) => {
    it(`${platform}: which/where 失败时返回 installed=false`, async () => {
      const calls = []
      const runCaptureImpl = vi.fn(async (cmd, args, opts) => {
        calls.push({ cmd, args, opts })
        return { ok: false, stdout: '', stderr: '', error: 'not found', code: 1 }
      })
      const fsImpl = { existsSync: () => false }
      const result = await detectJcode({ platform, fsImpl, runCaptureImpl })
      expect(calls[0].cmd).toBe(expectedFirstCmd)
      expect(result.installed).toBe(false)
      expect(result.path).toBeNull()
      expect(result.platform).toBe(platform)
    })

    it(`${platform}: which/where 命中但路径不存在时返回 installed=false`, async () => {
      const runCaptureImpl = vi.fn(async (cmd, args) => {
        if (cmd === expectedFirstCmd) return { ok: true, stdout: '/fake/jcode\n', stderr: '', code: 0 }
        return { ok: false, stdout: '', stderr: '', error: 'no exec', code: 1 }
      })
      const fsImpl = { existsSync: () => false }
      const result = await detectJcode({ platform, fsImpl, runCaptureImpl })
      expect(result.installed).toBe(false)
      expect(result.path).toBe('/fake/jcode')
    })

    it(`${platform}: 完整成功路径返回 installed=true 与版本`, async () => {
      const runCaptureImpl = vi.fn(async (cmd, args) => {
        if (cmd === expectedFirstCmd) return { ok: true, stdout: '/usr/bin/jcode\n', stderr: '', code: 0 }
        if (cmd === '/usr/bin/jcode' && args[0] === '--version') {
          return { ok: true, stdout: 'jcode 0.9.2\n', stderr: '', code: 0 }
        }
        return { ok: false, stdout: '', stderr: '', error: 'unknown', code: 1 }
      })
      const fsImpl = { existsSync: () => true }
      const result = await detectJcode({ platform, fsImpl, runCaptureImpl })
      expect(result.installed).toBe(true)
      expect(result.path).toBe('/usr/bin/jcode')
      expect(result.version).toBe('0.9.2')
      expect(result.meetsRequirement).toBe(true)
    })

    it(`${platform}: --version 返回非 semver 时 installed=true 但 version=null`, async () => {
      const runCaptureImpl = vi.fn(async (cmd, args) => {
        if (cmd === expectedFirstCmd) return { ok: true, stdout: '/usr/bin/jcode\n', stderr: '', code: 0 }
        if (cmd === '/usr/bin/jcode') return { ok: true, stdout: 'weird output\n', stderr: '', code: 0 }
        return { ok: false, stdout: '', stderr: '', error: 'unknown', code: 1 }
      })
      const fsImpl = { existsSync: () => true }
      const result = await detectJcode({ platform, fsImpl, runCaptureImpl })
      expect(result.installed).toBe(true)
      expect(result.version).toBeNull()
      expect(result.meetsRequirement).toBe(false)
    })

    it(`${platform}: Windows 下 which 使用 shell=true,类 Unix 平台 shell=false`, async () => {
      const runCaptureImpl = vi.fn(async () => ({ ok: false, stdout: '', stderr: '', error: 'x', code: 1 }))
      const fsImpl = { existsSync: () => false }
      await detectJcode({ platform, fsImpl, runCaptureImpl })
      const firstCall = runCaptureImpl.mock.calls[0]
      expect(firstCall[0]).toBe(expectedFirstCmd)
      expect(Boolean(firstCall[2]?.shell)).toBe(platform === 'win32')
    })
  })

  it('platform 默认为 process.platform', async () => {
    const runCaptureImpl = vi.fn(async () => ({ ok: false, stdout: '', stderr: '', error: 'x', code: 1 }))
    const fsImpl = { existsSync: () => false }
    const result = await detectJcode({ runCaptureImpl, fsImpl })
    expect(result.platform).toBe(process.platform)
  })
})
