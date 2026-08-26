/**
 * documentFile.spec.js —— 本地文件保存工具单元测试
 *
 * 被测：wpx-app/src/utils/documentFile.js
 * 运行：npm --prefix wpx-app run test -- documentFile
 */
import { describe, expect, it, vi } from 'vitest'

// ══════════════════════════════════════════════════════════════
// 1. Mock 基础设施
// ══════════════════════════════════════════════════════════════

function makeFakeFilesApi(overrides = {}) {
  return {
    showSaveDialog: vi.fn(),
    writeDocument: vi.fn(() => Promise.resolve({ ok: true })),
    writeBinary: vi.fn(() => Promise.resolve({ ok: true })),
    ...overrides,
  }
}

function makeFakeElectronAPI(filesApi = makeFakeFilesApi()) {
  return {
    files: filesApi,
  }
}

async function loadModule({ isElectronVal = true, electronAPI = null } = {}) {
  vi.resetModules()
  vi.doMock('@/utils/electron', () => ({
    isElectron: vi.fn(() => isElectronVal),
    getElectronAPI: vi.fn(() => electronAPI),
  }))
  return import('../documentFile.js')
}

// ══════════════════════════════════════════════════════════════
// 2. Tests — isLocalSaveAvailable
// ══════════════════════════════════════════════════════════════

describe('documentFile — isLocalSaveAvailable', () => {
  it('非 Electron 环境 → false', async () => {
    const mod = await loadModule({ isElectronVal: false })
    expect(mod.isLocalSaveAvailable()).toBe(false)
  })

  it('Electron 但无 electronAPI → false', async () => {
    const mod = await loadModule({ isElectronVal: true, electronAPI: null })
    expect(mod.isLocalSaveAvailable()).toBe(false)
  })

  it('Electron 但 files.showSaveDialog 缺失 → false', async () => {
    const mod = await loadModule({
      isElectronVal: true,
      electronAPI: { files: { writeDocument: vi.fn() } },
    })
    expect(mod.isLocalSaveAvailable()).toBe(false)
  })

  it('Electron 但 files.writeBinary 缺失 → false', async () => {
    const mod = await loadModule({
      isElectronVal: true,
      electronAPI: { files: { showSaveDialog: vi.fn(), writeDocument: vi.fn() } },
    })
    expect(mod.isLocalSaveAvailable()).toBe(false)
  })

  it('三条 IPC 通道均存在 → true', async () => {
    const mod = await loadModule({
      isElectronVal: true,
      electronAPI: makeFakeElectronAPI(),
    })
    expect(mod.isLocalSaveAvailable()).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// 3. Tests — saveMarkdownToLocalFile
// ══════════════════════════════════════════════════════════════

describe('documentFile — saveMarkdownToLocalFile', () => {
  it('非 Electron 环境直接返回 canceled + error', async () => {
    const mod = await loadModule({ isElectronVal: false })
    const result = await mod.saveMarkdownToLocalFile({ title: 'x', content: 'y' })
    expect(result.canceled).toBe(true)
    expect(result.error).toBeDefined()
  })

  it('用户取消 → 返回 canceled:true，不调用 writeDocument', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: null })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    const result = await mod.saveMarkdownToLocalFile({ title: 'x', content: 'y' })

    expect(result).toEqual({ canceled: true })
    expect(filesApi.writeDocument).not.toHaveBeenCalled()
  })

  it('用户选择路径 → 写入磁盘 → 返回 filePath', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: false, filePath: 'D:\\out\\notes.md' }),
      ),
      writeDocument: vi.fn(() => Promise.resolve({ ok: true })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    const result = await mod.saveMarkdownToLocalFile({
      title: '我的文档',
      content: '# Hello',
    })

    expect(result).toEqual({ canceled: false, filePath: 'D:\\out\\notes.md' })
    expect(filesApi.showSaveDialog).toHaveBeenCalledTimes(1)
    expect(filesApi.writeDocument).toHaveBeenCalledWith('D:\\out\\notes.md', '# Hello')
  })

  it('showSaveDialog 抛错 → 返回 error', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() => Promise.reject(new Error('dialog crashed'))),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    const result = await mod.saveMarkdownToLocalFile({ title: 'x', content: 'y' })

    expect(result.canceled).toBe(false)
    expect(result.error).toBe('dialog crashed')
  })

  it('writeDocument 返回 ok:false → 返回 error', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: false, filePath: 'D:\\out\\notes.md' }),
      ),
      writeDocument: vi.fn(() => Promise.resolve({ ok: false, error: '磁盘满' })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    const result = await mod.saveMarkdownToLocalFile({ title: 'x', content: 'y' })

    expect(result).toEqual({ canceled: false, error: '磁盘满' })
  })

  it('writeDocument 抛错 → 返回 error', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: false, filePath: 'D:\\out\\notes.md' }),
      ),
      writeDocument: vi.fn(() => Promise.reject(new Error('EACCES'))),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    const result = await mod.saveMarkdownToLocalFile({ title: 'x', content: 'y' })

    expect(result.canceled).toBe(false)
    expect(result.error).toBe('EACCES')
  })
})

// ══════════════════════════════════════════════════════════════
// 4. Tests — 文件名清洗（通过 showSaveDialog 的 defaultPath 验证）
// ══════════════════════════════════════════════════════════════

describe('documentFile — 文件名清洗', () => {
  async function captureDefaultPath(title) {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: true, filePath: null }),
      ),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })
    await mod.saveMarkdownToLocalFile({ title, content: '' })
    const callArgs = filesApi.showSaveDialog.mock.calls[0][0]
    return callArgs.defaultPath
  }

  it('正常标题 → 末尾追加 .md 后缀', async () => {
    const defaultPath = await captureDefaultPath('我的笔记')
    expect(defaultPath).toBe('我的笔记.md')
  })

  it('剥除 Windows 非法字符（\\/:*?"<>|）', async () => {
    const defaultPath = await captureDefaultPath('a\\b/c:d*e?f"g<h>i|j')
    expect(defaultPath).not.toMatch(/[\\/:*?"<>|]/)
    expect(defaultPath).toBe('a_b_c_d_e_f_g_h_i_j.md')
  })

  it('剥除控制字符（\\x00-\\x1F）', async () => {
    const defaultPath = await captureDefaultPath('before bias')
    // 控制字符被替换为 _；这里只检查无原始控制字符 + 末尾 .md
    expect(defaultPath.endsWith('.md')).toBe(true)
    expect(defaultPath).not.toMatch(/[\x00-\x1F]/)
  })

  it('Windows 保留名（CON/PRN/AUX/NUL/COM1/LPT1）前加下划线', async () => {
    expect(await captureDefaultPath('CON')).toBe('_CON.md')
    expect(await captureDefaultPath('PRN')).toBe('_PRN.md')
    expect(await captureDefaultPath('AUX')).toBe('_AUX.md')
    expect(await captureDefaultPath('NUL')).toBe('_NUL.md')
    expect(await captureDefaultPath('COM1')).toBe('_COM1.md')
    expect(await captureDefaultPath('LPT1')).toBe('_LPT1.md')
    expect(await captureDefaultPath('com9')).toBe('_com9.md')
  })

  it('保留名的大小写不敏感匹配', async () => {
    expect(await captureDefaultPath('con')).toBe('_con.md')
    expect(await captureDefaultPath('Con')).toBe('_Con.md')
  })

  it('空标题 / 仅空白 → 回退「未命名文档.md」', async () => {
    expect(await captureDefaultPath('')).toBe('未命名文档.md')
    expect(await captureDefaultPath('   ')).toBe('未命名文档.md')
    expect(await captureDefaultPath(null)).toBe('未命名文档.md')
    expect(await captureDefaultPath(undefined)).toBe('未命名文档.md')
  })

  it('标题超长（> 120 字符）会被截断', async () => {
    const longTitle = 'a'.repeat(200)
    const defaultPath = await captureDefaultPath(longTitle)
    // 截断 120 + .md 后缀 = 123
    expect(defaultPath.length).toBeLessThanOrEqual(123)
    expect(defaultPath.endsWith('.md')).toBe(true)
  })

  it('传入 defaultPath 时优先使用 defaultPath（跳过清洗）', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: true, filePath: null }),
      ),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    await mod.saveMarkdownToLocalFile({
      title: '应该被忽略的标题',
      content: '',
      defaultPath: 'D:\\my-custom-path.md',
    })

    const callArgs = filesApi.showSaveDialog.mock.calls[0][0]
    expect(callArgs.defaultPath).toBe('D:\\my-custom-path.md')
  })

  it('defaultPath 仅为空白时也回退到清洗后的标题', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: true, filePath: null }),
      ),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    await mod.saveMarkdownToLocalFile({
      title: '正常标题',
      content: '',
      defaultPath: '   ',
    })

    const callArgs = filesApi.showSaveDialog.mock.calls[0][0]
    expect(callArgs.defaultPath).toBe('正常标题.md')
  })

  it('传入自定义 filters 时透传，否则使用格式默认 filters', async () => {
    // 场景 A：未传 filters，使用 md 默认
    const filesApiA = makeFakeFilesApi({
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: null })),
    })
    const modA = await loadModule({ electronAPI: makeFakeElectronAPI(filesApiA) })
    await modA.saveMarkdownToLocalFile({ title: 'x', content: '' })
    expect(filesApiA.showSaveDialog.mock.calls[0][0].filters).toEqual([
      { name: 'Markdown', extensions: ['md'] },
    ])

    // 场景 B：传自定义 filters，透传
    const customFilters = [{ name: 'Custom', extensions: ['foo'] }]
    const filesApiB = makeFakeFilesApi({
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: null })),
    })
    const modB = await loadModule({ electronAPI: makeFakeElectronAPI(filesApiB) })
    await modB.saveMarkdownToLocalFile({ title: 'x', content: '', filters: customFilters })
    expect(filesApiB.showSaveDialog.mock.calls[0][0].filters).toEqual(customFilters)

    // 场景 C：空数组 filters，回退默认
    const filesApiC = makeFakeFilesApi({
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: null })),
    })
    const modC = await loadModule({ electronAPI: makeFakeElectronAPI(filesApiC) })
    await modC.saveMarkdownToLocalFile({ title: 'x', content: '', filters: [] })
    expect(filesApiC.showSaveDialog.mock.calls[0][0].filters).toEqual([
      { name: 'Markdown', extensions: ['md'] },
    ])
  })

  it('showSaveDialog payload.title 固定为「保存到本地文件」', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: null })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })
    await mod.saveMarkdownToLocalFile({ title: 'x', content: '' })
    expect(filesApi.showSaveDialog.mock.calls[0][0].title).toBe('保存到本地文件')
  })
})

// ══════════════════════════════════════════════════════════════
// 5. Tests — content 为空 / null / undefined
// ══════════════════════════════════════════════════════════════

describe('documentFile — content 边界', () => {
  it('content 为 null 时写入空字符串', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: false, filePath: 'D:\\out\\empty.md' }),
      ),
      writeDocument: vi.fn(() => Promise.resolve({ ok: true })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    await mod.saveMarkdownToLocalFile({ title: 't', content: null })

    expect(filesApi.writeDocument).toHaveBeenCalledWith('D:\\out\\empty.md', '')
  })

  it('content 为 undefined 时写入空字符串', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: false, filePath: 'D:\\out\\empty.md' }),
      ),
      writeDocument: vi.fn(() => Promise.resolve({ ok: true })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    await mod.saveMarkdownToLocalFile({ title: 't' })

    expect(filesApi.writeDocument).toHaveBeenCalledWith('D:\\out\\empty.md', '')
  })
})

describe('documentFile — pickLocalSavePath / writeBinaryToLocalFile', () => {
  it('pickLocalSavePath 仅返回路径，不写入', async () => {
    const filesApi = makeFakeFilesApi({
      showSaveDialog: vi.fn(() =>
        Promise.resolve({ canceled: false, filePath: 'D:\\out\\report.pdf' }),
      ),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })

    const result = await mod.pickLocalSavePath({
      fileTitle: '报告',
      format: 'pdf',
    })

    expect(result).toEqual({ canceled: false, filePath: 'D:\\out\\report.pdf' })
    expect(filesApi.writeDocument).not.toHaveBeenCalled()
    expect(filesApi.writeBinary).not.toHaveBeenCalled()
  })

  it('writeBinaryToLocalFile 通过 base64 写入二进制', async () => {
    const filesApi = makeFakeFilesApi({
      writeBinary: vi.fn(() => Promise.resolve({ ok: true })),
    })
    const mod = await loadModule({ electronAPI: makeFakeElectronAPI(filesApi) })
    const bytes = new Uint8Array([1, 2, 3])

    const result = await mod.writeBinaryToLocalFile('D:\\out\\file.pdf', bytes)

    expect(result).toEqual({ ok: true, filePath: 'D:\\out\\file.pdf' })
    expect(filesApi.writeBinary).toHaveBeenCalledWith('D:\\out\\file.pdf', 'AQID')
  })

  it('replacePathExtension 替换扩展名', async () => {
    const mod = await loadModule()
    expect(mod.replacePathExtension('D:\\docs\\report.pdf', 'docx')).toBe('D:\\docs\\report.docx')
    expect(mod.replacePathExtension('D:\\docs\\report', 'pdf')).toBe('D:\\docs\\report.pdf')
  })
})
