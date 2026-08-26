/**
 * zipApi.spec.js —— 压缩/解压渲染进程 API 封装单元测试
 *
 * 被测：wpx-app/src/utils/zipApi.js
 * 对照：docs/文件压缩解压模块测试用例设计.md ZIP-API-001 ~ 014
 * 运行：npm --prefix wpx-app run test -- zipApi
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { electronMock, libraryApiMock } = vi.hoisted(() => ({
  electronMock: {
    isElectron: vi.fn(() => true),
    getElectronAPI: vi.fn(),
  },
  libraryApiMock: {
    fetchLibraryHealth: vi.fn(),
  },
}))

vi.mock('@/utils/electron', () => electronMock)
vi.mock('@/utils/libraryApi', () => libraryApiMock)

function makeZipApi(overrides = {}) {
  return {
    compress: vi.fn(),
    extract: vi.fn(),
    list: vi.fn(),
    cancel: vi.fn(),
    pickSavePath: vi.fn(),
    pickDirectory: vi.fn(),
    pickArchive: vi.fn(),
    onProgress: vi.fn(() => vi.fn()),
    ...overrides,
  }
}

async function loadZipApi() {
  vi.resetModules()
  return import('@/utils/zipApi')
}

beforeEach(() => {
  vi.clearAllMocks()
  electronMock.isElectron.mockReturnValue(true)
  electronMock.getElectronAPI.mockReturnValue({ zip: makeZipApi() })
  libraryApiMock.fetchLibraryHealth.mockResolvedValue({ libraryRoot: 'D:\\library' })
})

describe('zipApi — 核心方法委托（ZIP-API-001）', () => {
  it('compressPaths / extractArchive / listArchive / cancelZipOperation 透传 electronAPI.zip', async () => {
    const zip = makeZipApi()
    zip.compress.mockResolvedValue({ ok: true, outputPath: 'C:\\out\\a.7z' })
    zip.extract.mockResolvedValue({ ok: true, outputDir: 'C:\\out' })
    zip.list.mockResolvedValue({ ok: true, files: [{ name: 'a.txt' }] })
    zip.cancel.mockResolvedValue({ ok: true })
    electronMock.getElectronAPI.mockReturnValue({ zip })

    const api = await loadZipApi()
    const compressPayload = { sources: ['C:\\src\\f.txt'], outputPath: 'C:\\out\\a.7z' }
    const extractPayload = { archivePath: 'C:\\a.7z', outputDir: 'C:\\out' }

    await expect(api.compressPaths(compressPayload)).resolves.toEqual({
      ok: true,
      outputPath: 'C:\\out\\a.7z',
    })
    await expect(api.extractArchive(extractPayload)).resolves.toEqual({
      ok: true,
      outputDir: 'C:\\out',
    })
    await expect(api.listArchive('C:\\a.7z', 'secret')).resolves.toEqual({
      ok: true,
      files: [{ name: 'a.txt' }],
    })
    await expect(api.cancelZipOperation('op-1')).resolves.toEqual({ ok: true })

    expect(zip.compress).toHaveBeenCalledWith(compressPayload)
    expect(zip.extract).toHaveBeenCalledWith(extractPayload)
    expect(zip.list).toHaveBeenCalledWith({ archivePath: 'C:\\a.7z', password: 'secret' })
    expect(zip.cancel).toHaveBeenCalledWith('op-1')
  })
})

describe('zipApi — listArchive 参数归一化（ZIP-API-002）', () => {
  it('字符串与对象两种形式均归一为 { archivePath, password }', async () => {
    const zip = makeZipApi()
    zip.list.mockResolvedValue({ ok: true, files: [] })
    electronMock.getElectronAPI.mockReturnValue({ zip })
    const api = await loadZipApi()

    await api.listArchive('a.zip')
    expect(zip.list).toHaveBeenCalledWith({ archivePath: 'a.zip', password: undefined })

    await api.listArchive({ archivePath: 'b.7z', password: 'p' })
    expect(zip.list).toHaveBeenCalledWith({ archivePath: 'b.7z', password: 'p' })
  })
})

describe('zipApi — 扩展名判断（ZIP-API-003）', () => {
  it('isArchivePath 识别 8 种归档扩展名（大小写不敏感）', async () => {
    const api = await loadZipApi()
    for (const ext of ['.7z', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.wim']) {
      expect(api.isArchivePath(`file${ext}`)).toBe(true)
      expect(api.isArchivePath(`FILE${ext.toUpperCase()}`)).toBe(true)
    }
    expect(api.isArchivePath('notes.txt')).toBe(false)
    expect(api.isArchivePath('')).toBe(false)
    expect(api.isArchivePath(null)).toBe(false)
  })

  it('isZipOr7zArchive 仅 .7z / .zip 为 true', async () => {
    const api = await loadZipApi()
    expect(api.isZipOr7zArchive('a.7z')).toBe(true)
    expect(api.isZipOr7zArchive('b.ZIP')).toBe(true)
    expect(api.isZipOr7zArchive('c.tar')).toBe(false)
    expect(api.isZipOr7zArchive('')).toBe(false)
  })
})

describe('zipApi — 非 Electron 环境（ZIP-API-004）', () => {
  it('无 zip API 时核心方法抛出桌面端提示', async () => {
    electronMock.getElectronAPI.mockReturnValue(null)
    const api = await loadZipApi()

    await expect(api.compressPaths({})).rejects.toThrow('压缩/解压缩功能仅在 WPX 桌面端可用')
    await expect(api.extractArchive({})).rejects.toThrow('压缩/解压缩功能仅在 WPX 桌面端可用')
    expect(() => api.subscribeZipProgress(() => {})).toThrow('压缩/解压缩功能仅在 WPX 桌面端可用')
  })
})

describe('zipApi — 错误/取消识别（ZIP-API-005 / 006）', () => {
  it('isPasswordRelatedError 识别密码相关文案', async () => {
    const api = await loadZipApi()
    expect(api.isPasswordRelatedError('Wrong password')).toBe(true)
    expect(api.isPasswordRelatedError('口令错误')).toBe(true)
    expect(api.isPasswordRelatedError('Can not open encrypted archive')).toBe(true)
    expect(api.isPasswordRelatedError('Wrong CRC')).toBe(true)
    expect(api.isPasswordRelatedError('磁盘空间不足')).toBe(false)
  })

  it('isZipCancelled 识别取消结果', async () => {
    const api = await loadZipApi()
    expect(api.isZipCancelled({ cancelled: true })).toBe(true)
    expect(api.isZipCancelled({ code: 'CANCELLED' })).toBe(true)
    expect(api.isZipCancelled({})).toBe(false)
    expect(api.isZipCancelled(null)).toBe(false)
  })
})

describe('zipApi — subscribeZipProgress（ZIP-API-007）', () => {
  it('无 onProgress 时返回 no-op；有时返回 unsubscribe', async () => {
    const unsubscribe = vi.fn()
    const zip = makeZipApi({ onProgress: undefined })
    electronMock.getElectronAPI.mockReturnValue({ zip })
    let api = await loadZipApi()
    const noop = api.subscribeZipProgress(() => {})
    expect(typeof noop).toBe('function')
    expect(() => noop()).not.toThrow()

    zip.onProgress = vi.fn(() => unsubscribe)
    electronMock.getElectronAPI.mockReturnValue({ zip })
    api = await loadZipApi()
    const cb = vi.fn()
    const unsub = api.subscribeZipProgress(cb)
    expect(zip.onProgress).toHaveBeenCalledWith(cb)
    expect(unsub).toBe(unsubscribe)
  })
})

describe('zipApi — 文件名与路径工具（ZIP-API-008~011）', () => {
  it('suggestArchiveName 净化非法字符并去扩展名', async () => {
    const api = await loadZipApi()
    // < > : / | ? * 与控制字符均替换为 _，再去掉原扩展名
    expect(api.suggestArchiveName('a<b>:c/d|e?*\u0001.txt')).toBe('a_b__c_d_e___.7z')
    expect(api.suggestArchiveName('报告.docx', 'zip')).toBe('报告.zip')
    expect(api.suggestArchiveName('')).toBe('archive.7z')
    expect(api.suggestArchiveName('   ')).toBe('archive.7z')
  })

  it('deriveArchiveBaseName 单文件/多文件/空数组规则', async () => {
    const api = await loadZipApi()
    expect(api.deriveArchiveBaseName(['C:\\docs\\notes.md'])).toBe('notes')
    expect(api.deriveArchiveBaseName(['C:\\docs\\a.txt', 'C:\\docs\\b.txt'])).toBe('archive')
    expect(api.deriveArchiveBaseName([])).toBe('archive')
    expect(api.deriveArchiveBaseName(['C:\\docs\\README'])).toBe('README')
  })

  it('buildDefaultOutputPath 拼接父目录与默认名', async () => {
    const api = await loadZipApi()
    expect(api.buildDefaultOutputPath(['C:\\docs\\notes.md'])).toBe('C:\\docs\\notes.7z')
    expect(api.buildDefaultOutputPath(['C:\\docs\\a.txt', 'C:\\docs\\b.txt'])).toBe(
      'C:\\docs\\archive.7z',
    )
    expect(api.buildDefaultOutputPath(['notes.md'])).toBe('notes.7z')
    expect(api.buildDefaultOutputPath([])).toBe('archive.7z')
    expect(api.buildDefaultOutputPath(['/tmp/doc.md'], 'zip')).toBe('/tmp/doc.zip')
  })

  it('joinLibraryAbsolutePath 去除重复分隔符', async () => {
    const api = await loadZipApi()
    expect(api.joinLibraryAbsolutePath('D:\\library\\', '工作/周报\\笔记.md')).toBe(
      'D:\\library\\工作\\周报\\笔记.md',
    )
    expect(api.joinLibraryAbsolutePath('D:\\library', '')).toBe('D:\\library')
  })
})

describe('zipApi — getLibraryRoot 缓存（ZIP-API-012）', () => {
  it('连续调用仅请求一次 health', async () => {
    libraryApiMock.fetchLibraryHealth.mockResolvedValue({ libraryRoot: 'E:\\wpx-lib' })
    const api = await loadZipApi()

    await expect(api.getLibraryRoot()).resolves.toBe('E:\\wpx-lib')
    await expect(api.getLibraryRoot()).resolves.toBe('E:\\wpx-lib')
    expect(libraryApiMock.fetchLibraryHealth).toHaveBeenCalledTimes(1)
  })
})

describe('zipApi — DataTransfer / 环境判断（ZIP-API-013 / 014）', () => {
  it('getArchivePathsFromDataTransfer 仅返回归档绝对路径', async () => {
    electronMock.isElectron.mockReturnValue(true)
    const api = await loadZipApi()
    const dataTransfer = {
      files: [
        { path: 'C:\\a.zip' },
        { path: 'C:\\b.txt' },
        { path: 'C:\\c.7z' },
        { path: '' },
      ],
    }

    expect(api.getArchivePathsFromDataTransfer(dataTransfer)).toEqual([
      'C:\\a.zip',
      'C:\\c.7z',
    ])
    expect(api.hasArchiveFilesInDataTransfer(dataTransfer)).toBe(true)
  })

  it('非 Electron 或空 dataTransfer 返回 []', async () => {
    electronMock.isElectron.mockReturnValue(false)
    const api = await loadZipApi()
    expect(
      api.getArchivePathsFromDataTransfer({
        files: [{ path: 'C:\\a.zip' }],
      }),
    ).toEqual([])
    expect(api.getArchivePathsFromDataTransfer(null)).toEqual([])
  })

  it('zipFeatureAvailable 三场景', async () => {
    electronMock.isElectron.mockReturnValue(true)
    electronMock.getElectronAPI.mockReturnValue({ zip: makeZipApi() })
    let api = await loadZipApi()
    expect(api.zipFeatureAvailable()).toBe(true)

    electronMock.getElectronAPI.mockReturnValue({})
    api = await loadZipApi()
    expect(api.zipFeatureAvailable()).toBe(false)

    electronMock.isElectron.mockReturnValue(false)
    electronMock.getElectronAPI.mockReturnValue({ zip: makeZipApi() })
    api = await loadZipApi()
    expect(api.zipFeatureAvailable()).toBe(false)
  })
})
