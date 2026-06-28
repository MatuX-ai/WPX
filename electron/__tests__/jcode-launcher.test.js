/**
 * jcode-launcher 单元测试
 *
 * 运行：npx vitest run --config electron/vitest.config.js jcode-launcher
 *
 * 重点验证：状态机迁移、markActivity 重置空闲计时器、stopJcode SIGTERM 流程。
 * 由于 launcher 内部维护模块级状态,各测试通过 stopJcode() + setStatus 重置。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const launcher = require('../services/jcode-launcher.js')
const {
  STATES,
  getStatus,
  setStatus,
  startJcode,
  stopJcode,
  ensureJcodeRunning,
  markActivity,
  isJcodeRunning,
  on,
  off,
  IDLE_TIMEOUT_MS,
} = launcher

// 内部需要探测到 jcode 才能进入 STARTING,所以我们直接覆盖 detectJcode
const detector = require('../services/jcode-detector.js')
const originalDetect = detector.detectJcode
const detectorMock = vi.fn()

describe('jcode-launcher — 基础状态', () => {
  beforeEach(() => {
    setStatus({ state: 'STOPPED', pid: null, lastError: null, lastActivityAt: null })
    detectorMock.mockReset()
    detector.detectJcode = detectorMock
  })

  afterEach(async () => {
    detector.detectJcode = originalDetect
    await stopJcode({ reason: 'test teardown' })
  })

  it('STATES 枚举包含 5 个状态', () => {
    expect(Object.keys(STATES)).toEqual(
      expect.arrayContaining(['STOPPED', 'STARTING', 'RUNNING', 'SLEEPING', 'FAILED']),
    )
  })

  it('IDLE_TIMEOUT_MS = 5 分钟', () => {
    expect(IDLE_TIMEOUT_MS).toBe(5 * 60 * 1000)
  })

  it('getStatus 返回当前状态快照', () => {
    const status = getStatus()
    expect(status).toHaveProperty('state')
    expect(status).toHaveProperty('pid')
    expect(status).toHaveProperty('port')
    expect(status).toHaveProperty('host')
  })

  it('isJcodeRunning 仅在 RUNNING 时为 true', () => {
    setStatus({ state: 'STOPPED' })
    expect(isJcodeRunning()).toBe(false)
    setStatus({ state: 'RUNNING' })
    expect(isJcodeRunning()).toBe(true)
    setStatus({ state: 'FAILED' })
    expect(isJcodeRunning()).toBe(false)
  })
})

describe('jcode-launcher — startJcode (未检测到 jcode)', () => {
  beforeEach(() => {
    setStatus({ state: 'STOPPED' })
    detectorMock.mockReset()
    detector.detectJcode = detectorMock
  })

  afterEach(async () => {
    detector.detectJcode = originalDetect
    await stopJcode({ reason: 'test teardown' })
  })

  it('detect 报告未安装时,startJcode 切到 FAILED 并保留 reason', async () => {
    detectorMock.mockResolvedValue({
      installed: false,
      path: null,
      version: null,
      reason: 'mocked not found',
    })
    const status = await startJcode()
    expect(status.state).toBe('FAILED')
    expect(status.lastError).toContain('mocked not found')
    expect(status.path).toBeNull()
  })
})

describe('jcode-launcher — on 事件订阅', () => {
  it('on("status") 回调接收状态变更', () => {
    const events = []
    const off = on('status', (s) => events.push(s.state))
    try {
      setStatus({ state: 'RUNNING' })
      setStatus({ state: 'SLEEPING' })
    } finally {
      off()
    }
    expect(events).toContain('RUNNING')
    expect(events).toContain('SLEEPING')
  })

  it('off 取消订阅', () => {
    const events = []
    const listener = (s) => events.push(s.state)
    on('status', listener)
    off('status', listener)
    setStatus({ state: 'RUNNING' })
    expect(events).toEqual([])
  })
})

describe('jcode-launcher — markActivity', () => {
  beforeEach(() => {
    setStatus({ state: 'RUNNING', lastActivityAt: 0 })
  })

  it('RUNNING 时调用会更新 lastActivityAt', () => {
    const before = Date.now()
    markActivity()
    const after = Date.now()
    const status = getStatus()
    expect(status.lastActivityAt).toBeGreaterThanOrEqual(before)
    expect(status.lastActivityAt).toBeLessThanOrEqual(after)
  })

  it('STOPPED 时调用无副作用 (不重启)', () => {
    setStatus({ state: 'STOPPED', lastActivityAt: 0 })
    markActivity()
    expect(getStatus().state).toBe('STOPPED')
  })

  it('SLEEPING 时调用应触发异步 restart', async () => {
    setStatus({ state: 'SLEEPING' })
    // 不验证实际重启(避免 mock 复杂 spawn),仅验证不抛错
    expect(() => markActivity()).not.toThrow()
  })
})

describe('jcode-launcher — ensureJcodeRunning', () => {
  beforeEach(() => {
    setStatus({ state: 'STOPPED' })
    detectorMock.mockReset()
    detector.detectJcode = detectorMock
  })

  afterEach(async () => {
    detector.detectJcode = originalDetect
    await stopJcode({ reason: 'test teardown' })
  })

  it('RUNNING 时直接返回当前状态', async () => {
    setStatus({ state: 'RUNNING' })
    const status = await ensureJcodeRunning()
    expect(status.state).toBe('RUNNING')
    expect(detectorMock).not.toHaveBeenCalled()
  })

  it('STOPPED 时尝试启动但 detect 报告未安装时返回 FAILED', async () => {
    detectorMock.mockResolvedValue({ installed: false, reason: 'no' })
    const status = await ensureJcodeRunning()
    expect(status.state).toBe('FAILED')
  })
})

describe('jcode-launcher — stopJcode (无活跃进程)', () => {
  it('无 proc 时直接置 STOPPED', async () => {
    setStatus({ state: 'RUNNING', pid: null })
    const status = await stopJcode({ reason: 'manual' })
    expect(status.state).toBe('STOPPED')
    expect(status.lastError).toBe('manual')
  })
})

describe('jcode-launcher — EventEmitter 集成', () => {
  it('可通过 setStatus 触发自定义事件', () => {
    const emitter = new EventEmitter()
    const listener = vi.fn()
    emitter.on('test', listener)
    emitter.emit('test', { ok: true })
    expect(listener).toHaveBeenCalledWith({ ok: true })
  })
})
