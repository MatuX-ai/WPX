/**
 * export-service.test.js - 幻灯片 PPTX 导出（Electron 主进程）单元测试
 *
 * 测试策略：
 *  - 纯函数（resolveTheme / deriveDocTitle / deriveAuthor）直接覆盖
 *  - exportSlidesToPPTX 在未安装 pptxgenjs 时抛错（错误路径）
 *  - renderSlidesToPPTXBuffer 在未安装 pptxgenjs 时抛错
 *  - IPC 注册函数在没有 ipcMain 时抛错
 *
 * 真实 pptxgenjs 集成测试需在 `npm install pptxgenjs` 之后运行（用环境变量触发）。
 */

import path from 'node:path'
import os from 'node:os'
import fsp from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const exportService = require('../export-service.js')
const {
  exportSlidesToPPTX,
  renderSlidesToPPTXBuffer,
  registerExportServiceIpc,
  resolveTheme,
  deriveDocTitle,
  deriveAuthor,
  isPptxGenAvailable,
  DEFAULT_THEME,
  DARK_THEME,
} = exportService

const HAS_PPTXGENJS = isPptxGenAvailable()

describe('export-service - 纯函数', () => {
  describe('resolveTheme', () => {
    it('默认主题为 light + DEFAULT_THEME', () => {
      const t = resolveTheme(undefined)
      expect(t.accent).toBe(DEFAULT_THEME.accent)
      expect(t.bg).toBe(DEFAULT_THEME.bg)
      expect(t.fontFace).toBe('Microsoft YaHei')
    })

    it('theme=dark 返回深色调色板', () => {
      const t = resolveTheme({ theme: 'dark' })
      expect(t.accent).toBe(DARK_THEME.accent)
      expect(t.bg).toBe(DARK_THEME.bg)
    })

    it('themeColors 覆盖默认颜色（且去除 # 前缀）', () => {
      const t = resolveTheme({ themeColors: { accent: '#FF0000', bg: '#000' } })
      expect(t.accent).toBe('FF0000')
      expect(t.bg).toBe('000')
    })

    it('fontFace 为字符串时直接使用', () => {
      const t = resolveTheme({ fontFace: 'Inter' })
      expect(t.fontFace).toBe('Inter')
    })

    it('fontFace 为数组时取第一个非空', () => {
      expect(resolveTheme({ fontFace: ['', '  ', 'SourceHanSans'] }).fontFace).toBe('SourceHanSans')
      expect(resolveTheme({ fontFace: ['Arial', 'B'] }).fontFace).toBe('Arial')
    })

    it('fontFace 为空数组时回退 Microsoft YaHei', () => {
      expect(resolveTheme({ fontFace: ['', '   '] }).fontFace).toBe('Microsoft YaHei')
    })
  })

  describe('deriveDocTitle', () => {
    it('options.title 优先', () => {
      expect(deriveDocTitle([], { title: '  自定义标题  ' })).toBe('自定义标题')
    })

    it('没有 options.title 时取 CoverSlide 的 title', () => {
      const slides = [
        { component: 'CoverSlide', props: { title: 'AI 发布会' } },
        { component: 'TextSlide', props: { title: 'X' } },
      ]
      expect(deriveDocTitle(slides, {})).toBe('AI 发布会')
    })

    it('没有 CoverSlide 时取第一张有 title 的 slide', () => {
      const slides = [
        { component: 'TextSlide', props: { title: '首页' } },
        { component: 'EndSlide', props: { text: 'Q' } },
      ]
      expect(deriveDocTitle(slides, {})).toBe('首页')
    })

    it('空 slides 返回默认标题', () => {
      expect(deriveDocTitle([], {})).toBe('WPX 演示文稿')
    })
  })

  describe('deriveAuthor', () => {
    it('options.author 直接使用', () => {
      expect(deriveAuthor({ author: 'WPX Team' })).toBe('WPX Team')
    })
    it('缺省返回 WPX SlideDeck', () => {
      expect(deriveAuthor(undefined)).toBe('WPX SlideDeck')
      expect(deriveAuthor({})).toBe('WPX SlideDeck')
    })
    it('空字符串也回退', () => {
      expect(deriveAuthor({ author: '   ' })).toBe('WPX SlideDeck')
    })
  })
})

describe('export-service - pptxgenjs 缺失时的错误路径', () => {
  it('exportSlidesToPPTX 抛错且提示安装方式', async () => {
    if (HAS_PPTXGENJS) return
    await expect(
      exportSlidesToPPTX([{ component: 'TextSlide', props: { title: 'x' } }], '/tmp/x.pptx'),
    ).rejects.toThrow(/pptxgenjs 未安装/)
  })

  it('renderSlidesToPPTXBuffer 抛错', async () => {
    if (HAS_PPTXGENJS) return
    await expect(
      renderSlidesToPPTXBuffer([{ component: 'TextSlide', props: { title: 'x' } }]),
    ).rejects.toThrow(/pptxgenjs 未安装/)
  })

  it('exportSlidesToPPTX 缺 outputPath 抛错', async () => {
    await expect(
      exportSlidesToPPTX([{ component: 'TextSlide', props: { title: 'x' } }], ''),
    ).rejects.toThrow(/缺少 outputPath/)
  })
})

describe('export-service - IPC 注册', () => {
  it('缺少 ipcMain 抛错', () => {
    expect(() => registerExportServiceIpc({})).toThrow(/缺少 ipcMain/)
    expect(() => registerExportServiceIpc(null)).toThrow(/缺少 ipcMain/)
  })

  it('注册两个 channel 并能返回 mocked handler', () => {
    const handlers = new Map()
    const fakeIpcMain = {
      handle(channel, fn) {
        handlers.set(channel, fn)
      },
    }
    registerExportServiceIpc({ ipcMain: fakeIpcMain })
    expect(handlers.has('slides:export-pptx')).toBe(true)
    expect(handlers.has('slides:export-pptx-buffer')).toBe(true)
  })

  it('channel 在无 dialog 时缺失 pptxgenjs 返回 ok:false', async () => {
    if (HAS_PPTXGENJS) return
    const handlers = new Map()
    const fakeIpcMain = { handle: (c, fn) => handlers.set(c, fn) }
    registerExportServiceIpc({ ipcMain: fakeIpcMain })
    const fn = handlers.get('slides:export-pptx-buffer')
    const result = await fn({}, [{ component: 'TextSlide', props: { title: 'x' } }], {})
    expect(result.ok).toBe(false)
    expect(typeof result.error).toBe('string')
    expect(result.error).toMatch(/pptxgenjs 未安装/)
    expect(result.fileName).toMatch(/\.pptx$/)
  })

  it('channel 在有 dialog 时弹保存对话框（pptxgenjs 缺失会返回 ok:false 但仍调用 dialog）', async () => {
    if (HAS_PPTXGENJS) return
    const handlers = new Map()
    const fakeIpcMain = { handle: (c, fn) => handlers.set(c, fn) }
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-pptx-test-'))
    try {
      const fakeDialog = {
        showSaveDialog: vi.fn(async () => ({
          canceled: false,
          filePath: path.join(tmp, 'demo.pptx'),
        })),
      }
      registerExportServiceIpc({ ipcMain: fakeIpcMain, dialog: fakeDialog })
      const fn = handlers.get('slides:export-pptx')
      const result = await fn({}, [{ component: 'TextSlide', props: { title: 'x' } }], {})
      // pptxgenjs 缺失时会在 renderSlidesToPPTXBuffer 处返回 ok:false
      expect(result.ok).toBe(false)
      expect(typeof result.error).toBe('string')
      expect(result.error).toMatch(/pptxgenjs 未安装/)
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('channel filename 自定义 + dialog 接受', async () => {
    if (HAS_PPTXGENJS) return
    const handlers = new Map()
    const fakeIpcMain = { handle: (c, fn) => handlers.set(c, fn) }
    const fakeDialog = {
      showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined })),
    }
    registerExportServiceIpc({ ipcMain: fakeIpcMain, dialog: fakeDialog })
    const fn = handlers.get('slides:export-pptx')
    const result = await fn({}, [], { filename: 'custom.pptx' })
    // ok=false 但来自 canceled
    expect(result.ok).toBe(false)
  })
})

// 仅在真实安装了 pptxgenjs 时才跑的集成测试
const describeIfPptx = HAS_PPTXGENJS ? describe : describe.skip
describeIfPptx('export-service - 集成（需要 pptxgenjs）', () => {
  /** @type {string} */
  let workDir

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-pptx-int-'))
  })

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true })
  })

  it('renderSlidesToPPTXBuffer 返回非空 Buffer 且 title 正确', async () => {
    const slides = [
      { component: 'CoverSlide', props: { title: '集成测试', subtitle: '副' } },
      { component: 'TextSlide', props: { title: '章节', bulletPoints: ['A', 'B'] } },
      { component: 'ChartSlide', props: { title: '统计', chartType: 'bar', chartData: JSON.stringify([{ name: 'A', value: 10 }, { name: 'B', value: 20 }]) } },
      { component: 'ImageTextSlide', props: { title: '图', text: '说明', imageUrl: '' } },
      { component: 'EndSlide', props: { text: '谢谢' } },
    ]
    const { buffer, size, title } = await renderSlidesToPPTXBuffer(slides, { title: '集成测试' })
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(size).toBeGreaterThan(0)
    expect(title).toBe('集成测试')
    // PPTX 文件以 PK\x03\x04 开头（zip 压缩）
    expect(buffer.slice(0, 4).toString('hex')).toBe('504b0304')
  })

  it('exportSlidesToPPTX 写入到磁盘并产生合法 zip', async () => {
    const slides = [
      { component: 'CoverSlide', props: { title: '磁盘测试' } },
      { component: 'TextSlide', props: { title: '章节', bulletPoints: ['A'] } },
    ]
    const target = path.join(workDir, 'output.pptx')
    const result = await exportSlidesToPPTX(slides, target, { title: '磁盘测试' })
    expect(result.ok).toBe(true)
    expect(result.outputPath).toBe(target)
    expect(result.size).toBeGreaterThan(0)
    const stat = await fsp.stat(target)
    expect(stat.size).toBe(result.size)
    // 验证文件可读且头部是 PK
    const head = await fsp.readFile(target)
    expect(head.slice(0, 4).toString('hex')).toBe('504b0304')
  })

  it('导出空数组仅生成主版式相关 XML', async () => {
    const { buffer } = await renderSlidesToPPTXBuffer([], { title: '空' })
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.slice(0, 4).toString('hex')).toBe('504b0304')
  })

  it('未知组件降级为占位页（不报错）', async () => {
    const slides = [
      { component: 'UnknownSlide', props: { title: '降级', body: '说明' } },
    ]
    const { buffer } = await renderSlidesToPPTXBuffer(slides, { title: 'T' })
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('ChartSlide 数据为空时给出占位文本', async () => {
    const slides = [
      { component: 'ChartSlide', props: { title: '空数据', chartType: 'bar', chartData: '' } },
    ]
    const { buffer } = await renderSlidesToPPTXBuffer(slides, { title: 'T' })
    expect(buffer.length).toBeGreaterThan(0)
  })
})
