/**
 * export-service.js - 幻灯片 PPTX 导出（Electron 主进程）
 *
 * 提供：
 *  - exportSlidesToPPTX(slides, outputPath, options?)     // 写入到磁盘文件
 *  - renderSlidesToPPTXBuffer(slides, options?)            // 返回 Buffer（供 IPC 下载）
 *  - registerExportServiceIpc({ ipcMain, dialog, app })    // 一键注册 IPC handlers
 *
 * 与 wpx-app/src/utils/slideExport.js 的差异：
 *  - 在 Electron 主进程运行，可直接 fs.writeFile 到任意路径
 *  - 走 pptxgenjs 原生图表 (addChart) 而非 ECharts / 占位
 *  - 主题色 / 字体与 font-service 协同
 *  - 输出完整的 PowerPoint 文件并触发浏览器下载（前端通过 IPC 拿到 Buffer）
 *
 * pptxgenjs 在 wpx-app 中已声明；如果未安装，本模块会在导出时抛出明确报错。
 */
'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

/* ───────── pptxgenjs 懒加载 ───────── */

let _pptxgenModule = null
let _pptxgenLoadAttempted = false

function pickConstructable(mod) {
  if (!mod) return null
  if (typeof mod === 'function') return mod
  if (typeof mod.PptxGenJS === 'function') return mod.PptxGenJS
  if (typeof mod.default === 'function') return mod.default
  return null
}

function loadPptxGenJS() {
  if (_pptxgenLoadAttempted) {
    if (!_pptxgenModule) {
      throw new Error('pptxgenjs 未安装或不可用（之前的加载尝试失败）')
    }
    return _pptxgenModule
  }
  _pptxgenLoadAttempted = true
  const errors = []
  const candidates = [
    ['node_modules/pptxgenjs', () => require('pptxgenjs')],
    [
      'wpx-app/node_modules/pptxgenjs',
      () => require(path.join(__dirname, '..', 'wpx-app', 'node_modules', 'pptxgenjs')),
    ],
  ]
  for (const [label, load] of candidates) {
    try {
      const mod = load()
      const Ctor = pickConstructable(mod)
      if (Ctor) {
        _pptxgenModule = Ctor
        return _pptxgenModule
      }
      errors.push(`${label}: 加载但未导出可构造的类`)
    } catch (e) {
      errors.push(`${label}: ${e?.message || e}`)
    }
  }
  _pptxgenModule = null
  throw new Error(
    'pptxgenjs 未安装。请在 wpx-app 目录执行 `npm install pptxgenjs`，' +
      '或在根目录执行 `npm install pptxgenjs`。\n' +
      `尝试路径：\n  - ${errors.join('\n  - ')}`,
  )
}

/**
 * 暴露给测试：返回当前是否已成功加载 pptxgenjs。
 */
function isPptxGenAvailable() {
  try {
    loadPptxGenJS()
    return true
  } catch (_) {
    return false
  }
}

/* ───────── 默认主题（与 WPX 设计系统对齐） ───────── */

const DEFAULT_THEME = {
  // 颜色：与 wpx-app/src/composables/useSlideExport.js 一致
  accent: '7C3AED',       // 紫色主色
  accentSecondary: 'EC4899', // 粉
  fg: '0F172A',           // 正文
  muted: '475569',        // 副文
  border: 'E2E8F0',       // 边框
  bg: 'FFFFFF',           // 卡片背景
  bgPage: 'F8FAFC',       // 页面背景
  shadow: '94A3B8',       // 阴影
}

const DARK_THEME = {
  accent: 'A78BFA',
  accentSecondary: 'F472B6',
  fg: 'F1F5F9',
  muted: '94A3B8',
  border: '1E293B',
  bg: '0F172A',
  bgPage: '020617',
  shadow: '1E293B',
}

/* ───────── 字体解析 ───────── */

function pickThemeFont(fontHints) {
  // 优先第一个非空 hint；否则用平台安全字体栈
  if (Array.isArray(fontHints)) {
    for (const f of fontHints) {
      if (typeof f === 'string' && f.trim()) return f.trim()
    }
  }
  if (typeof fontHints === 'string' && fontHints.trim()) return fontHints.trim()
  return 'Microsoft YaHei'
}

function resolveTheme(options) {
  const base = options?.theme === 'dark' ? DARK_THEME : DEFAULT_THEME
  // 允许 options.themeColors 覆盖
  const merged = { ...base, ...(options?.themeColors || {}) }
  return {
    ...merged,
    // 移除颜色前缀 '#'（pptxgenjs 颜色字符串不接受 #）
    accent: (merged.accent || '').replace(/^#/, ''),
    accentSecondary: (merged.accentSecondary || '').replace(/^#/, ''),
    fg: (merged.fg || '').replace(/^#/, ''),
    muted: (merged.muted || '').replace(/^#/, ''),
    border: (merged.border || '').replace(/^#/, ''),
    bg: (merged.bg || '').replace(/^#/, ''),
    bgPage: (merged.bgPage || '').replace(/^#/, ''),
    fontFace: pickThemeFont(options?.fontFace),
  }
}

/* ───────── 标题与作者元数据 ───────── */

function deriveDocTitle(slides, options) {
  if (options?.title && typeof options.title === 'string') return options.title.trim()
  for (const s of slides || []) {
    if (s?.component === 'CoverSlide' && s.props?.title) return String(s.props.title).trim()
  }
  for (const s of slides || []) {
    if (s?.props?.title) return String(s.props.title).trim()
  }
  return 'WPX 演示文稿'
}

function deriveAuthor(options) {
  const a = options?.author
  if (typeof a === 'string' && a.trim()) return a.trim()
  return 'WPX SlideDeck'
}

/* ───────── 通用版式常量 ───────── */

const SLIDE_W = 13.333 // 16:9 inch
const SLIDE_H = 7.5
const SAFE_MARGIN = 0.5

function setupBaseMasters(pres, theme, author) {
  // 通用主版式：白底/暗底，加右下角作者与主题色条
  pres.defineSlideMaster({
    title: 'WPX_BASE_LIGHT',
    background: { color: theme.bgPage },
    objects: [
      { rect: { x: 0, y: SLIDE_H - 0.18, w: SLIDE_W, h: 0.18, fill: { color: theme.accent } } },
      {
        text: {
          text: author,
          options: {
            x: 0.4,
            y: SLIDE_H - 0.55,
            w: 6,
            h: 0.3,
            fontFace: theme.fontFace,
            fontSize: 9,
            color: theme.muted,
          },
        },
      },
    ],
  })

  pres.defineSlideMaster({
    title: 'WPX_BASE_DARK',
    background: { color: theme.bgPage },
    objects: [
      { rect: { x: 0, y: SLIDE_H - 0.18, w: SLIDE_W, h: 0.18, fill: { color: theme.accent } } },
      {
        text: {
          text: author,
          options: {
            x: 0.4,
            y: SLIDE_H - 0.55,
            w: 6,
            h: 0.3,
            fontFace: theme.fontFace,
            fontSize: 9,
            color: theme.muted,
          },
        },
      },
    ],
  })

  pres.defineSlideMaster({
    title: 'WPX_COVER',
    background: { color: theme.bgPage },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: SLIDE_W,
          h: SLIDE_H,
          fill: { color: theme.bgPage },
        },
      },
      {
        rect: {
          x: 0,
          y: 0,
          w: 0.5,
          h: SLIDE_H,
          fill: { color: theme.accent },
        },
      },
      {
        rect: {
          x: SLIDE_W - 0.5,
          y: 0,
          w: 0.5,
          h: SLIDE_H,
          fill: { color: theme.accentSecondary },
        },
      },
    ],
  })

  pres.defineSlideMaster({
    title: 'WPX_END',
    background: { color: theme.bgPage },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: SLIDE_W,
          h: SLIDE_H,
          fill: { color: theme.bgPage },
        },
      },
      {
        rect: {
          x: 0,
          y: SLIDE_H / 2 - 0.4,
          w: SLIDE_W,
          h: 0.8,
          fill: { color: theme.accent, transparency: 85 },
        },
      },
    ],
  })
}

/* ───────── slide 渲染分派 ───────── */

function renderCoverSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const slide0 = pres.addSlide({ masterName: 'WPX_COVER' })
  // 标题（紫粉渐变用纯色近似；pptxgenjs 不支持渐变文字，使用主色 + 大字号）
  slide0.addText(
    [
      {
        text: props.title || '未命名演示',
        options: {
          fontFace: theme.fontFace,
          fontSize: 54,
          bold: true,
          color: theme.accent,
          breakLine: true,
        },
      },
    ],
    {
      x: 1.5,
      y: SLIDE_H / 2 - 1.4,
      w: SLIDE_W - 3,
      h: 1.6,
      align: 'center',
      valign: 'middle',
    },
  )

  if (props.subtitle) {
    slide0.addText(props.subtitle, {
      x: 1.5,
      y: SLIDE_H / 2 + 0.4,
      w: SLIDE_W - 3,
      h: 0.6,
      fontFace: theme.fontFace,
      fontSize: 22,
      color: theme.muted,
      align: 'center',
      valign: 'top',
    })
  }

  if (props.author) {
    slide0.addText(props.author, {
      x: 1.5,
      y: SLIDE_H / 2 + 1.2,
      w: SLIDE_W - 3,
      h: 0.4,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.muted,
      align: 'center',
      italic: true,
    })
  }
}

function renderTextSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addText(props.title || '', {
    x: SAFE_MARGIN,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: 0.9,
    fontFace: theme.fontFace,
    fontSize: 32,
    bold: true,
    color: theme.accent,
  })

  // 要点列表
  const bullets = []
  if (typeof props.body === 'string' && props.body.trim()) {
    bullets.push({ text: props.body, options: { bullet: { code: '25CF' } } })
  }
  if (Array.isArray(props.bulletPoints)) {
    for (const p of props.bulletPoints) {
      if (typeof p === 'string' && p.trim()) {
        bullets.push({ text: p, options: { bullet: { code: '25CF' } } })
      }
    }
  } else if (typeof props.bulletPoints === 'string' && props.bulletPoints.trim()) {
    bullets.push({ text: props.bulletPoints, options: { bullet: { code: '25CF' } } })
  }

  if (bullets.length) {
    slide0.addText(bullets, {
      x: SAFE_MARGIN + 0.3,
      y: 1.7,
      w: SLIDE_W - SAFE_MARGIN * 2 - 0.3,
      h: SLIDE_H - 2.5,
      fontFace: theme.fontFace,
      fontSize: 18,
      color: theme.fg,
      paraSpaceAfter: 8,
      valign: 'top',
    })
  }

  if (props.note) {
    slide0.addText(props.note, {
      x: SAFE_MARGIN,
      y: SLIDE_H - 1.1,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 0.6,
      fontFace: theme.fontFace,
      fontSize: 12,
      italic: true,
      color: theme.muted,
    })
  }
}

function renderChartSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addText(props.title || '数据图表', {
    x: SAFE_MARGIN,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: 0.9,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    align: 'center',
  })

  // 解析图表数据
  const chartType = String(props.chartType || 'bar').toLowerCase()
  let data = []
  try {
    const raw = props.chartData
    if (typeof raw === 'string') data = JSON.parse(raw)
    else if (Array.isArray(raw)) data = raw
  } catch (_) {
    data = []
  }
  if (!Array.isArray(data) || data.length === 0) {
    // 占位：图表不可用时给一个提示框
    slide0.addText('图表数据缺失或格式无效', {
      x: SAFE_MARGIN,
      y: SLIDE_H / 2 - 0.5,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 1,
      fontFace: theme.fontFace,
      fontSize: 16,
      color: theme.muted,
      align: 'center',
      italic: true,
    })
    return
  }

  const labels = data.map((d) => d.name || '')
  const values = data.map((d) => Number(d.value || 0))

  const PptxGenJSChartType =
    chartType === 'pie' ? pres.ChartType.pie :
    chartType === 'line' ? pres.ChartType.line :
    pres.ChartType.bar

  slide0.addChart(PptxGenJSChartType, [
    {
      name: props.title || '数据',
      labels,
      values,
    },
  ], {
    x: SAFE_MARGIN,
    y: 1.5,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: SLIDE_H - 2.5,
    chartColors: [theme.accent, theme.accentSecondary, '06B6D4', '10B981', 'F59E0B', 'EF4444'],
    showLegend: chartType === 'pie',
    legendPos: 'b',
    showTitle: false,
    catAxisLabelFontFace: theme.fontFace,
    catAxisLabelFontSize: 11,
    valAxisLabelFontFace: theme.fontFace,
    valAxisLabelFontSize: 11,
    catAxisLabelColor: theme.muted,
    valAxisLabelColor: theme.muted,
    showCatAxisTitle: false,
    showValAxisTitle: false,
  })

  if (props.note) {
    slide0.addText(props.note, {
      x: SAFE_MARGIN,
      y: SLIDE_H - 1.1,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 0.6,
      fontFace: theme.fontFace,
      fontSize: 12,
      italic: true,
      color: theme.muted,
    })
  }
}

function renderImageTextSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addText(props.title || '', {
    x: SAFE_MARGIN,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: 0.9,
    fontFace: theme.fontFace,
    fontSize: 30,
    bold: true,
    color: theme.accent,
  })

  const url = props.imageUrl || props.image || ''
  if (url) {
    // 优先按 URL 处理；如果是 data URI 也能直接传给 pptxgenjs
    try {
      slide0.addImage({
        path: url,
        x: SAFE_MARGIN,
        y: 1.7,
        w: 6,
        h: 4.5,
        sizing: { type: 'contain', w: 6, h: 4.5 },
      })
    } catch (e) {
      // 如果 url 是远程地址或 base64 失败，退化为占位框
      slide0.addShape(pres.ShapeType.rect, {
        x: SAFE_MARGIN,
        y: 1.7,
        w: 6,
        h: 4.5,
        fill: { color: theme.bg },
        line: { color: theme.border, width: 1, dashType: 'dash' },
      })
      slide0.addText('图片占位', {
        x: SAFE_MARGIN,
        y: 1.7,
        w: 6,
        h: 4.5,
        fontFace: theme.fontFace,
        fontSize: 14,
        color: theme.muted,
        align: 'center',
        valign: 'middle',
      })
    }
  } else {
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y: 1.7,
      w: 6,
      h: 4.5,
      fill: { color: theme.bg },
      line: { color: theme.border, width: 1, dashType: 'dash' },
    })
    slide0.addText('图片占位', {
      x: SAFE_MARGIN,
      y: 1.7,
      w: 6,
      h: 4.5,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }

  if (props.text) {
    slide0.addText(props.text, {
      x: 7,
      y: 1.9,
      w: SLIDE_W - 7 - SAFE_MARGIN,
      h: 4,
      fontFace: theme.fontFace,
      fontSize: 16,
      color: theme.fg,
      valign: 'top',
    })
  }
}

function renderEndSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const slide0 = pres.addSlide({ masterName: 'WPX_END' })

  slide0.addText(props.text || props.title || '谢谢观看', {
    x: 1.5,
    y: SLIDE_H / 2 - 0.9,
    w: SLIDE_W - 3,
    h: 1.8,
    fontFace: theme.fontFace,
    fontSize: 56,
    bold: true,
    color: theme.accent,
    align: 'center',
    valign: 'middle',
  })

  if (props.subtitle) {
    slide0.addText(props.subtitle, {
      x: 1.5,
      y: SLIDE_H / 2 + 1.0,
      w: SLIDE_W - 3,
      h: 0.6,
      fontFace: theme.fontFace,
      fontSize: 20,
      color: theme.muted,
      align: 'center',
    })
  }
}

function renderUnknownSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })
  slide0.addText(props.title || props.text || '未命名页', {
    x: SAFE_MARGIN,
    y: SLIDE_H / 2 - 0.8,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: 1,
    fontFace: theme.fontFace,
    fontSize: 24,
    bold: true,
    color: theme.accent,
    align: 'center',
  })
  if (props.body || props.text) {
    slide0.addText(props.body || props.text, {
      x: SAFE_MARGIN,
      y: SLIDE_H / 2 + 0.3,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 1,
      fontFace: theme.fontFace,
      fontSize: 16,
      color: theme.fg,
      align: 'center',
    })
  }
}

const RENDERERS = {
  CoverSlide: renderCoverSlide,
  TextSlide: renderTextSlide,
  ChartSlide: renderChartSlide,
  ImageTextSlide: renderImageTextSlide,
  EndSlide: renderEndSlide,
}

/* ───────── 主入口：renderSlidesToPPTXBuffer ───────── */

/**
 * 把 slides 数组渲染为 PPTX Buffer（不写入磁盘）。
 * @param {Array<{ component: string, props: object }>} slides
 * @param {object} [options]
 * @param {string} [options.title]            演示文稿标题（影响 docProperties + 文件名推断）
 * @param {string} [options.author]           作者（右下角与 docProperties）
 * @param {'light'|'dark'} [options.theme]    主题；默认 'light'
 * @param {object} [options.themeColors]      覆盖主题色（accent / fg / muted / bg ...）
 * @param {string|string[]} [options.fontFace] 主题字体；默认 'Microsoft YaHei'
 * @returns {Promise<{ buffer: Buffer, size: number, title: string }>}
 */
async function renderSlidesToPPTXBuffer(slides, options) {
  const PptxGenJS = loadPptxGenJS()
  const list = Array.isArray(slides) ? slides : []
  const theme = resolveTheme(options || {})
  const title = deriveDocTitle(list, options)
  const author = deriveAuthor(options)

  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5
  pres.title = title
  pres.author = author
  pres.company = 'WPX'
  pres.subject = options?.subject || '演示文稿'
  pres.theme = { headFontFace: theme.fontFace, bodyFontFace: theme.fontFace }

  setupBaseMasters(pres, theme, author)

  for (const slide of list) {
    const component = String(slide?.component || 'TextSlide')
    const renderer = RENDERERS[component] || renderUnknownSlide
    try {
      renderer(slide, pres, theme)
    } catch (err) {
      // 单页失败不影响整体生成；记录到 stderr 便于排查
      // eslint-disable-next-line no-console
      console.error('[export-service] slide render failed:', component, err?.message || err)
      renderUnknownSlide(slide, pres, theme)
    }
  }

  const buffer = await pres.write({ outputType: 'arraybuffer' })
  const nodeBuffer = Buffer.from(buffer)
  return { buffer: nodeBuffer, size: nodeBuffer.length, title }
}

/* ───────── 主入口：exportSlidesToPPTX（写入文件） ───────── */

/**
 * 导出 slides 到指定 PPTX 文件。
 *
 * @param {Array<{ component: string, props: object }>} slides
 * @param {string} outputPath  目标 .pptx 路径（目录不存在会自动创建）
 * @param {object} [options]   与 renderSlidesToPPTXBuffer 相同
 * @returns {Promise<{ ok: boolean, outputPath: string, size: number, title: string }>}
 */
async function exportSlidesToPPTX(slides, outputPath, options) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('[exportSlidesToPPTX] 缺少 outputPath')
  }
  const resolved = path.resolve(outputPath)
  await fsp.mkdir(path.dirname(resolved), { recursive: true })
  const { buffer, size, title } = await renderSlidesToPPTXBuffer(slides, options)
  await fsp.writeFile(resolved, buffer)
  return { ok: true, outputPath: resolved, size, title }
}

/* ───────── IPC 注册：让前端触发下载 ───────── */

/**
 * 把 PPTX 导出能力注册为 IPC 通道。
 *
 * 注册的 channel：
 *  - 'slides:export-pptx'(slides, options?) → { ok, outputPath?, size, title, fileName, base64? }
 *      若提供了 dialog 则弹出保存对话框写入磁盘，返回 outputPath + size；
 *      否则把 PPTX 编码为 base64 返回，前端用 Blob 触发浏览器下载。
 *  - 'slides:export-pptx-buffer'(slides, options?) → { ok, base64, size, title, fileName }
 *      不写盘，直接返回 base64，用于前端下载。
 *
 * @param {object} ctx
 * @param {Electron.IpcMain} ctx.ipcMain  - 必填
 * @param {Electron.Dialog}  [ctx.dialog] - 可选，提供则支持保存到磁盘
 * @param {string}            [ctx.defaultDir] - 保存对话框的默认目录
 */
function registerExportServiceIpc(ctx) {
  if (!ctx || !ctx.ipcMain) {
    throw new Error('[registerExportServiceIpc] 缺少 ipcMain')
  }
  const { ipcMain, dialog, defaultDir } = ctx
  const sanitizeFilename = (name) => {
    const fallback = 'WPX-Deck'
    if (!name || typeof name !== 'string') return `${fallback}-${Date.now()}.pptx`
    const cleaned = name
      .trim()
      .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 80)
    return `${cleaned || fallback}-${Date.now()}.pptx`
  }

  ipcMain.handle('slides:export-pptx', async (_event, slides, options) => {
    const opts = options || {}
    const fileName = sanitizeFilename(opts.filename || deriveDocTitle(slides || [], opts))
    let buffer
    let title
    try {
      const r = await renderSlidesToPPTXBuffer(slides, opts)
      buffer = r.buffer
      title = r.title
    } catch (err) {
      return { ok: false, error: err?.message || String(err), fileName }
    }

    if (dialog) {
      try {
        const result = await dialog.showSaveDialog({
          title: '导出 PPTX',
          defaultPath: defaultDir ? path.join(defaultDir, fileName) : fileName,
          filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
        })
        if (result.canceled || !result.filePath) {
          return { ok: false, canceled: true, title, fileName }
        }
        await fsp.mkdir(path.dirname(result.filePath), { recursive: true })
        await fsp.writeFile(result.filePath, buffer)
        return { ok: true, outputPath: result.filePath, size: buffer.length, title, fileName }
      } catch (err) {
        return { ok: false, error: err?.message || String(err), title, fileName }
      }
    }

    // 不写盘：返回 base64 让前端 Blob 下载
    return {
      ok: true,
      title,
      fileName,
      size: buffer.length,
      base64: buffer.toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
  })

  ipcMain.handle('slides:export-pptx-buffer', async (_event, slides, options) => {
    const opts = options || {}
    const fileName = sanitizeFilename(opts.filename || deriveDocTitle(slides || [], opts))
    try {
      const { buffer, title } = await renderSlidesToPPTXBuffer(slides, opts)
      return {
        ok: true,
        title,
        fileName,
        size: buffer.length,
        base64: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }
    } catch (err) {
      return { ok: false, error: err?.message || String(err), fileName }
    }
  })
}

module.exports = {
  exportSlidesToPPTX,
  renderSlidesToPPTXBuffer,
  registerExportServiceIpc,
  // 暴露便于测试或扩展：
  resolveTheme,
  deriveDocTitle,
  deriveAuthor,
  isPptxGenAvailable,
  DEFAULT_THEME,
  DARK_THEME,
  SLIDE_W,
  SLIDE_H,
}
