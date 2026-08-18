/**
 * hermes-launcher 单元测试（Phase 3 / M3，mock spawnImpl + 短 readyDelayMs）
 *
 * 运行：npm --prefix wpx-app run test:zip -- hermes-launcher
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const launcher = require('../services/hermes-launcher.js')

const READY_DELAY_MS = 5

/** 构造假子进程：EventEmitter + pid + kill */
function makeFakeChild() {
  const child = new EventEmitter()
  child.pid = 4242
  child.exitCode = null
  child.kill = vi.fn(() => {
    child.exitCode = 0
    return true
  })
  return child
}

/** 等待就绪定时器触发 */
function settle() {
  return new Promise((r) => setTimeout(r, 30))
}

afterEach(() => {
  launcher._resetForTests()
})

describe('hermes-launcher — startHermesGateway', () => {
  it('spawn 成功且存活 → RUNNING，携带正确参数与环境变量', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)

    const promise = launcher.startHermesGateway({ port: 8642, spawnImpl, readyDelayMs: READY_DELAY_MS })
    await settle()
    const status = await promise

    expect(status.state).toBe('RUNNING')
    expect(status.port).toBe(8642)
    expect(status.pid).toBe(4242)
    expect(spawnImpl).toHaveBeenCalledTimes(1)
    const [cmd, args, opts] = spawnImpl.mock.calls[0]
    expect(cmd).toBe('hermes')
    expect(args).toContain('gateway')
    expect(opts.env.API_SERVER_ENABLED).toBe('true')
    expect(opts.env.API_SERVER_PORT).toBe('8642')
    // 未提供 key 时自动生成（API Server 未设 key 拒绝启动）
    expect(opts.env.API_SERVER_KEY).toMatch(/^wpx-[0-9a-f]{32}$/)
    expect(status.apiKey).toBe(opts.env.API_SERVER_KEY)
  })

  it('显式传入 apiKey 时原样使用', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    await launcher.startHermesGateway({
      spawnImpl,
      readyDelayMs: READY_DELAY_MS,
      apiKey: 'sk-test-123',
    })
    await settle()
    const opts = spawnImpl.mock.calls[0][2]
    expect(opts.env.API_SERVER_KEY).toBe('sk-test-123')
    expect(launcher.getStatus().apiKey).toBe('sk-test-123')
  })

  it('传入 hermesHome 时设置 HERMES_HOME（数据主权：改指 WPX userData）', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    await launcher.startHermesGateway({
      spawnImpl,
      readyDelayMs: READY_DELAY_MS,
      hermesHome: 'C:\\Users\\x\\AppData\\Roaming\\WPX\\hermes-home',
    })
    await settle()
    const opts = spawnImpl.mock.calls[0][2]
    expect(opts.env.HERMES_HOME).toBe('C:\\Users\\x\\AppData\\Roaming\\WPX\\hermes-home')
  })

  it('未传 hermesHome 时不设置 HERMES_HOME', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    await launcher.startHermesGateway({ spawnImpl, readyDelayMs: READY_DELAY_MS })
    await settle()
    const opts = spawnImpl.mock.calls[0][2]
    expect(opts.env.HERMES_HOME).toBeUndefined()
  })

  it('spawn 抛异常 → ERROR', async () => {
    const spawnImpl = vi.fn(() => {
      throw new Error('hermes not found')
    })
    const status = await launcher.startHermesGateway({ spawnImpl })
    expect(status.state).toBe('ERROR')
    expect(status.lastError).toContain('hermes not found')
  })

  it('子进程 error 事件 → ERROR', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    const promise = launcher.startHermesGateway({ spawnImpl })
    fakeChild.emit('error', new Error('spawn ENOENT'))
    const status = await promise
    expect(status.state).toBe('ERROR')
    expect(status.lastError).toContain('ENOENT')
  })

  it('已在运行时不重复启动', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    await launcher.startHermesGateway({ spawnImpl, readyDelayMs: READY_DELAY_MS })
    await settle()
    const second = await launcher.startHermesGateway({ spawnImpl })
    expect(spawnImpl).toHaveBeenCalledTimes(1)
    expect(second.state).toBe('RUNNING')
  })
})

describe('hermes-launcher — stopHermesGateway', () => {
  it('运行中停止 → STOPPED（kill + close）', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    await launcher.startHermesGateway({ spawnImpl, readyDelayMs: READY_DELAY_MS })
    await settle()

    const promise = launcher.stopHermesGateway()
    fakeChild.emit('close', 0)
    const status = await promise
    expect(status.state).toBe('STOPPED')
    expect(status.pid).toBeNull()
    expect(fakeChild.kill).toHaveBeenCalled()
  })

  it('已停止时直接返回 STOPPED', async () => {
    const status = await launcher.stopHermesGateway()
    expect(status.state).toBe('STOPPED')
  })
})

// ═════════════════════════════════════════════════
// M4：healthCheck 就绪轮询
// ═════════════════════════════════════════════════
describe('hermes-launcher — healthCheck 就绪轮询（M4）', () => {
  it('healthCheck 立即通过 → RUNNING', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    const healthCheck = vi.fn(async () => true)

    const promise = launcher.startHermesGateway({
      spawnImpl,
      readyDelayMs: READY_DELAY_MS,
      timeoutMs: 2000,
      healthCheck,
    })
    await settle()
    const status = await promise

    expect(status.state).toBe('RUNNING')
    expect(healthCheck).toHaveBeenCalledTimes(1)
    expect(healthCheck.mock.calls[0][0]).toEqual(expect.objectContaining({ port: 8642 }))
  })

  it('healthCheck 先失败后成功 → 轮询直到 RUNNING', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    const healthCheck = vi.fn()
    healthCheck.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true)

    const promise = launcher.startHermesGateway({
      spawnImpl,
      readyDelayMs: READY_DELAY_MS,
      timeoutMs: 3000,
      healthCheck,
    })
    await settle()
    const status = await promise

    expect(status.state).toBe('RUNNING')
    expect(healthCheck.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('healthCheck 一直失败 → 健康检查超时转 ERROR 并杀进程', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    const healthCheck = vi.fn(async () => false)

    const promise = launcher.startHermesGateway({
      spawnImpl,
      readyDelayMs: READY_DELAY_MS,
      timeoutMs: 120,
      healthCheck,
    })
    const status = await promise

    expect(status.state).toBe('ERROR')
    expect(status.lastError).toContain('健康检查超时')
    expect(fakeChild.kill).toHaveBeenCalled()
  })

  it('healthCheck 抛异常按未就绪处理', async () => {
    const fakeChild = makeFakeChild()
    const spawnImpl = vi.fn(() => fakeChild)
    const healthCheck = vi.fn(async () => {
      throw new Error('boom')
    })

    const promise = launcher.startHermesGateway({
      spawnImpl,
      readyDelayMs: READY_DELAY_MS,
      timeoutMs: 120,
      healthCheck,
    })
    const status = await promise
    expect(status.state).toBe('ERROR')
    expect(status.lastError).toContain('健康检查超时')
  })
})

describe('hermes-launcher — getStatus', () => {
  it('返回副本（不共享引用）', () => {
    const a = launcher.getStatus()
    a.state = 'MUTATED'
    expect(launcher.getStatus().state).not.toBe('MUTATED')
  })
})
