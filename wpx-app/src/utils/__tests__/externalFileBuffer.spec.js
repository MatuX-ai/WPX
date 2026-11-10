/**
 * externalFileBuffer.spec.js —— 渲染层入口早期缓冲单元测试（TASK-06 A 场景修复）
 *
 * 被测：wpx-app/src/utils/externalFileBuffer.js
 * 关注语义：
 *  1. 未 arm 时事件丢失（模拟修复前的现状：payload 落在无人监听窗口）
 *  2. arm 后按到达顺序缓冲 N 条
 *  3. drain 一次性 + 幂等（二次为空）
 *  4. drain 之后到达的事件只交给实时订阅，不重复投递（缓冲与实时订阅互斥）
 *  5. file:open 与 file:open-archive 两条通道互不干扰
 * 运行：npm --prefix wpx-app run test -- externalFileBuffer
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { electronMock } = vi.hoisted(() => ({
  electronMock: {
    isElectron: vi.fn(() => true),
    getElectronAPI: vi.fn(),
  },
}))

vi.mock('@/utils/electron', () => electronMock)

/**
 * 模拟 preload 暴露的 API：同一 IPC 通道的多个方法名都指向同一组监听器，
 * 以便检测「同通道重复订阅 → 重复缓冲」这类缺陷。
 */
function createFakeApi() {
  const handlers = new Map([
    ['file:open', new Set()],
    ['file:open-archive', new Set()],
  ])

  const subscribe = (channel) => (callback) => {
    handlers.get(channel).add(callback)
    return () => handlers.get(channel).delete(callback)
  }

  const api = {
    files: {
      onOpenFile: subscribe('file:open'),
      onOpenMarkdown: subscribe('file:open'),
      onOpenArchive: subscribe('file:open-archive'),
    },
    onOpenFile: subscribe('file:open'),
    onOpenMarkdownFile: subscribe('file:open'),
    onOpenArchive: subscribe('file:open-archive'),
  }

  return {
    api,
    emit(channel, payload) {
      for (const handler of [...handlers.get(channel)]) handler(payload)
    },
    listenerCount(channel) {
      return handlers.get(channel).size
    },
  }
}

async function loadBuffer(api) {
  vi.resetModules()
  electronMock.isElectron.mockReturnValue(true)
  electronMock.getElectronAPI.mockReturnValue(api)
  return import('@/utils/externalFileBuffer')
}

describe('externalFileBuffer —— 早期缓冲语义', () => {
  beforeEach(() => {
    electronMock.isElectron.mockReturnValue(true)
    electronMock.getElectronAPI.mockReturnValue(null)
  })

  it('未 arm 时事件丢失（模拟修复前现状：payload 无人接收）', async () => {
    const fake = createFakeApi()
    const buffer = await loadBuffer(fake.api)

    // 入口尚未 arm（等价于修复前：只有挂载后的组件订阅存在，此刻还没有任何监听）
    fake.emit('file:open', { path: 'i:/docs/a.md', content: '# A', title: 'a.md' })
    fake.emit('file:open-archive', { archivePath: 'i:/docs/a.zip' })

    expect(fake.listenerCount('file:open')).toBe(0)
    expect(fake.listenerCount('file:open-archive')).toBe(0)
    expect(buffer.drainExternalFileOpens()).toEqual([])
    expect(buffer.drainExternalFileArchives()).toEqual([])
  })

  it('arm 后缓冲 N 条，保持到达顺序，且同通道只订阅一次', async () => {
    const fake = createFakeApi()
    const buffer = await loadBuffer(fake.api)

    expect(buffer.armExternalFileBuffer()).toBe(true)
    expect(buffer.isExternalFileBufferArmed()).toBe(true)
    // files.onOpenFile / files.onOpenMarkdown / onOpenMarkdownFile 都是 'file:open'
    expect(fake.listenerCount('file:open')).toBe(1)
    expect(fake.listenerCount('file:open-archive')).toBe(1)

    const payloads = [
      { path: 'i:/docs/1.md', content: '# 1', title: '1.md' },
      { path: 'i:/docs/2.docx', content: '<p>2</p>', title: '2.docx', contentType: 'html' },
      { path: 'i:/docs/3.pptx', content: null, title: '3.pptx', contentType: 'pptx', slides: [] },
    ]
    payloads.forEach((payload) => fake.emit('file:open', payload))

    const drained = buffer.drainExternalFileOpens()
    expect(drained).toHaveLength(3)
    expect(drained.map((item) => item.path)).toEqual([
      'i:/docs/1.md',
      'i:/docs/2.docx',
      'i:/docs/3.pptx',
    ])
  })

  it('drain 幂等：二次 drain 为空，缓冲被一次性取空', async () => {
    const fake = createFakeApi()
    const buffer = await loadBuffer(fake.api)
    buffer.armExternalFileBuffer()

    fake.emit('file:open', { path: 'i:/docs/once.md', content: '# once' })

    expect(buffer.drainExternalFileOpens()).toHaveLength(1)
    expect(buffer.drainExternalFileOpens()).toEqual([])
    expect(buffer.drainExternalFileOpens()).toEqual([])
  })

  it('drain 之后到达的实时事件不进缓冲（与实时订阅互斥，只投递一次）', async () => {
    const fake = createFakeApi()
    const buffer = await loadBuffer(fake.api)
    buffer.armExternalFileBuffer()

    // 早期 payload（入口 → 挂载之间）
    const early = { path: 'i:/docs/early.md', content: '# early' }
    fake.emit('file:open', early)
    expect(buffer.drainExternalFileOpens()).toEqual([early])

    // 组件 onMounted：注册实时订阅（同一同步块内紧跟 drain，此处 drain 已返回空）
    const realtime = vi.fn()
    fake.api.files.onOpenFile(realtime)

    const later = { path: 'i:/docs/later.md', content: '# later' }
    fake.emit('file:open', later)

    expect(realtime).toHaveBeenCalledTimes(1)
    expect(realtime).toHaveBeenCalledWith(later)
    // 缓冲不再收集 → 不会二次投递 loadMarkdown
    expect(buffer.drainExternalFileOpens()).toEqual([])
  })

  it('file:open 与 file:open-archive 两条通道互不干扰，archive drain 同样幂等', async () => {
    const fake = createFakeApi()
    const buffer = await loadBuffer(fake.api)
    buffer.armExternalFileBuffer()

    fake.emit('file:open-archive', { archivePath: 'i:/docs/b.zip' })
    fake.emit('file:open', { path: 'i:/docs/b.md', content: '# b' })

    expect(buffer.drainExternalFileArchives()).toEqual([{ archivePath: 'i:/docs/b.zip' }])
    expect(buffer.drainExternalFileArchives()).toEqual([])
    // archive 已 drain 不影响 open 通道
    expect(buffer.drainExternalFileOpens()).toHaveLength(1)
  })

  it('arm 幂等：重复 arm 不重复订阅、不重复缓冲', async () => {
    const fake = createFakeApi()
    const buffer = await loadBuffer(fake.api)

    expect(buffer.armExternalFileBuffer()).toBe(true)
    expect(buffer.armExternalFileBuffer()).toBe(false)

    expect(fake.listenerCount('file:open')).toBe(1)
    expect(fake.listenerCount('file:open-archive')).toBe(1)

    fake.emit('file:open', { path: 'i:/docs/idempotent.md', content: '# i' })
    expect(buffer.drainExternalFileOpens()).toHaveLength(1)
  })

  it('非 Electron 环境：arm 不注册监听，drain 恒为空', async () => {
    vi.resetModules()
    electronMock.isElectron.mockReturnValue(false)
    electronMock.getElectronAPI.mockReturnValue(null)

    const buffer = await import('@/utils/externalFileBuffer')

    expect(buffer.armExternalFileBuffer()).toBe(false)
    expect(buffer.drainExternalFileOpens()).toEqual([])
    expect(buffer.drainExternalFileArchives()).toEqual([])
  })
})
