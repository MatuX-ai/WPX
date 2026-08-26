/**
 * zip.spec.js —— 压缩/解压 Pinia store 单元测试
 *
 * 被测：wpx-app/src/stores/zip.js
 * 对照：docs/文件压缩解压模块测试用例设计.md ZIP-STORE-001 ~ 016
 * 运行：npm --prefix wpx-app run test -- stores/__tests__/zip
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const zipApiMock = vi.hoisted(() => ({
  cancelZipOperation: vi.fn(),
  compressPaths: vi.fn(),
  extractArchive: vi.fn(),
  isZipCancelled: vi.fn((result) => Boolean(result?.cancelled || result?.code === 'CANCELLED')),
  listArchive: vi.fn(),
  subscribeZipProgress: vi.fn(() => vi.fn()),
}))

vi.mock('@/utils/zipApi', () => zipApiMock)

import { MAX_ZIP_PROGRESS_ITEMS, useZipStore } from '@/stores/zip'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  zipApiMock.subscribeZipProgress.mockReturnValue(vi.fn())
  zipApiMock.isZipCancelled.mockImplementation((result) =>
    Boolean(result?.cancelled || result?.code === 'CANCELLED'),
  )
})

describe('zip store — 成功状态流转（ZIP-STORE-001 / 002）', () => {
  it('runCompress 成功：running → success，percent=100', async () => {
    zipApiMock.compressPaths.mockResolvedValue({
      ok: true,
      outputPath: 'C:\\out\\a.7z',
    })
    const store = useZipStore()

    const result = await store.runCompress({
      sources: ['C:\\src\\f.txt'],
      outputPath: 'C:\\out\\a.7z',
    })

    expect(result.ok).toBe(true)
    expect(result.operationId).toBeTruthy()
    expect(store.operations).toHaveLength(1)
    expect(store.operations[0].status).toBe('success')
    expect(store.operations[0].type).toBe('compress')
    expect(store.operations[0].percent).toBe(100)
    expect(store.isBusy).toBe(false)
    expect(store.progress).toBeNull()
  })

  it('runExtract 成功：running → success', async () => {
    zipApiMock.extractArchive.mockResolvedValue({
      ok: true,
      outputDir: 'C:\\out',
    })
    const store = useZipStore()

    const result = await store.runExtract({
      archivePath: 'C:\\a.7z',
      outputDir: 'C:\\out',
    })

    expect(result.ok).toBe(true)
    expect(result.operationId).toBeTruthy()
    expect(store.operations[0].status).toBe('success')
    expect(store.operations[0].type).toBe('extract')
  })
})

describe('zip store — progress / isBusy（ZIP-STORE-003）', () => {
  it('有 running 操作时 progress 指向它，isBusy=true', () => {
    const store = useZipStore()
    store.beginOperation({ operationId: 'op-1', label: '压缩中', type: 'compress' })

    expect(store.isBusy).toBe(true)
    expect(store.progress?.operationId).toBe('op-1')
    expect(store.progress?.percent).toBe(0)

    store.completeOperation('op-1', { status: 'success' })
    expect(store.isBusy).toBe(false)
    expect(store.progress).toBeNull()
  })
})

describe('zip store — 进度事件（ZIP-STORE-004 / 012）', () => {
  it('进度回调仅更新匹配的 running 操作', () => {
    let progressCb
    zipApiMock.subscribeZipProgress.mockImplementation((cb) => {
      progressCb = cb
      return vi.fn()
    })
    const store = useZipStore()
    store.beginOperation({ operationId: 'op-1', label: '压缩', type: 'compress' })
    store.beginOperation({ operationId: 'op-2', label: '解压', type: 'extract' })

    progressCb({ operationId: 'op-1', percent: 55, currentFile: 'x.txt' })

    expect(store.operations[0].percent).toBe(55)
    expect(store.operations[0].currentFile).toBe('x.txt')
    expect(store.operations[1].percent).toBe(0)
  })

  it('迟到进度事件（操作已非 running）被忽略', () => {
    let progressCb
    zipApiMock.subscribeZipProgress.mockImplementation((cb) => {
      progressCb = cb
      return vi.fn()
    })
    const store = useZipStore()
    store.beginOperation({ operationId: 'op-1', label: '压缩', type: 'compress' })
    store.completeOperation('op-1', { status: 'success' })

    progressCb({ operationId: 'op-1', percent: 90, currentFile: 'late.txt' })
    expect(store.operations[0].percent).toBe(100)
    expect(store.operations[0].currentFile).toBe('')
  })
})

describe('zip store — 失败 / 取消 / 异常（ZIP-STORE-005~008）', () => {
  it('压缩失败（ok=false）置 error 并 reject', async () => {
    zipApiMock.compressPaths.mockResolvedValue({
      ok: false,
      error: '磁盘空间不足',
    })
    const store = useZipStore()

    await expect(
      store.runCompress({ sources: ['a'], outputPath: 'b.7z' }),
    ).rejects.toThrow('磁盘空间不足')

    expect(store.operations[0].status).toBe('error')
    expect(store.operations[0].error).toBe('磁盘空间不足')
  })

  it('IPC 抛异常时若仍为 running 则置 error 并 rethrow', async () => {
    zipApiMock.compressPaths.mockRejectedValue(new Error('IPC 断开'))
    const store = useZipStore()

    await expect(
      store.runCompress({ sources: ['a'], outputPath: 'b.7z' }),
    ).rejects.toThrow('IPC 断开')

    expect(store.operations[0].status).toBe('error')
    expect(store.operations[0].error).toBe('IPC 断开')
  })

  it('返回取消结果时 status=cancelled，不抛错', async () => {
    zipApiMock.compressPaths.mockResolvedValue({
      cancelled: true,
      code: 'CANCELLED',
    })
    const store = useZipStore()

    const result = await store.runCompress({ sources: ['a'], outputPath: 'b.7z' })
    expect(result).toEqual({ cancelled: true, operationId: expect.any(String) })
    expect(store.operations[0].status).toBe('cancelled')
  })

  it('cancelOperation 仅对 running 生效', async () => {
    zipApiMock.cancelZipOperation.mockResolvedValue({ ok: true })
    const store = useZipStore()
    store.beginOperation({ operationId: 'op-done', label: '完成', type: 'compress' })
    store.completeOperation('op-done', { status: 'success' })
    store.beginOperation({ operationId: 'op-run', label: '运行中', type: 'compress' })

    await expect(store.cancelOperation('op-done')).resolves.toBe(false)
    await expect(store.cancelOperation('missing')).resolves.toBe(false)
    expect(zipApiMock.cancelZipOperation).not.toHaveBeenCalled()

    await expect(store.cancelOperation('op-run')).resolves.toBe(true)
    expect(zipApiMock.cancelZipOperation).toHaveBeenCalledWith('op-run')
    expect(store.operations.find((o) => o.operationId === 'op-run')?.status).toBe('cancelled')
  })
})

describe('zip store — loadArchiveEntries（ZIP-STORE-009）', () => {
  it('list 失败抛错；成功返回 files（默认 []）', async () => {
    const store = useZipStore()
    zipApiMock.listArchive.mockResolvedValue({
      ok: false,
      error: '无法读取压缩包',
    })
    await expect(store.loadArchiveEntries('a.zip')).rejects.toThrow('无法读取压缩包')

    zipApiMock.listArchive.mockResolvedValue({ ok: true })
    await expect(store.loadArchiveEntries('a.zip')).resolves.toEqual([])

    zipApiMock.listArchive.mockResolvedValue({
      ok: true,
      files: [{ name: 'a.txt' }],
    })
    await expect(store.loadArchiveEntries('a.zip')).resolves.toEqual([{ name: 'a.txt' }])
  })
})

describe('zip store — 挂起状态一致性（ZIP-STORE-010）', () => {
  it('compressPaths 永不 resolve 时保持 running / isBusy', async () => {
    zipApiMock.compressPaths.mockReturnValue(new Promise(() => {}))
    const store = useZipStore()

    const pending = store.runCompress({ sources: ['a'], outputPath: 'b.7z' })
    // 让微任务跑完 beginOperation
    await Promise.resolve()

    expect(store.isBusy).toBe(true)
    expect(store.progress?.status).toBe('running')
    expect(store.operations[0].status).toBe('running')

    // 不 await pending，避免挂死；释放引用即可
    void pending
  })
})

describe('zip store — 裁剪 / 清理 / 移除（ZIP-STORE-011 / 013 / 014）', () => {
  it('完成操作数量超上限时裁剪最早的非 running 项，running 保留', () => {
    const store = useZipStore()
    // 3 个已完成 + 1 个 running = 4，complete running 后 trim 到 MAX=3
    for (const id of ['op-1', 'op-2', 'op-3']) {
      store.beginOperation({ operationId: id, label: id, type: 'compress' })
      store.completeOperation(id, { status: 'success' })
    }
    store.beginOperation({ operationId: 'op-run', label: 'running', type: 'compress' })
    expect(store.operations).toHaveLength(4)

    store.completeOperation('op-run', { status: 'success' })
    expect(store.operations.length).toBe(MAX_ZIP_PROGRESS_ITEMS)
    // 最早的 op-1 被裁掉
    expect(store.operations.map((o) => o.operationId)).toEqual(['op-2', 'op-3', 'op-run'])
  })

  it('clearProgress 仅保留 running', () => {
    const store = useZipStore()
    store.beginOperation({ operationId: 'r', label: 'run', type: 'compress' })
    store.beginOperation({ operationId: 's', label: 'ok', type: 'compress' })
    store.completeOperation('s', { status: 'success' })
    store.beginOperation({ operationId: 'e', label: 'err', type: 'extract' })
    store.completeOperation('e', { status: 'error', error: 'fail' })

    store.clearProgress()
    expect(store.operations).toHaveLength(1)
    expect(store.operations[0].operationId).toBe('r')
  })

  it('removeOperation 仅移除指定项', () => {
    const store = useZipStore()
    store.beginOperation({ operationId: 'a', label: 'a', type: 'compress' })
    store.beginOperation({ operationId: 'b', label: 'b', type: 'extract' })
    store.removeOperation('a')
    expect(store.operations.map((o) => o.operationId)).toEqual(['b'])
  })
})

describe('zip store — 订阅幂等与并发（ZIP-STORE-015）', () => {
  it('多次 beginOperation 只订阅一次进度；多 running 时 isBusy=true', () => {
    const store = useZipStore()
    store.beginOperation({ operationId: 'op-1', label: '1', type: 'compress' })
    store.beginOperation({ operationId: 'op-2', label: '2', type: 'extract' })

    expect(zipApiMock.subscribeZipProgress).toHaveBeenCalledTimes(1)
    expect(store.isBusy).toBe(true)
  })
})

describe('zip store — createOperationId 兜底（ZIP-STORE-016）', () => {
  it('crypto.randomUUID 不可用时仍生成非空唯一 id', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    })

    try {
      zipApiMock.compressPaths.mockResolvedValue({ ok: true, outputPath: 'x.7z' })
      const store = useZipStore()
      const a = await store.runCompress({ sources: ['a'], outputPath: 'b.7z' })
      const b = await store.runCompress({ sources: ['c'], outputPath: 'd.7z' })
      expect(a.operationId).toBeTruthy()
      expect(b.operationId).toBeTruthy()
      expect(a.operationId).not.toBe(b.operationId)
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      })
    }
  })
})
