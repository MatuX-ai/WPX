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

/* ───────── 教师专用课件渲染器（lesson-ppt） ───────── */

/**
 * OutlineSlide - 教学目标页（三维目标：知识与技能 / 过程与方法 / 情感态度价值观）
 *  props: { title, objectives: [{dimension, items: string[]}], theme }
 */
function renderOutlineSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addText(props.title || '教学目标', {
    x: SAFE_MARGIN,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: 0.9,
    fontFace: theme.fontFace,
    fontSize: 32,
    bold: true,
    color: theme.accent,
  })
  // 标题下紫绿渐变色条（用纯色近似）
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 1.42,
    w: 1.6,
    h: 0.06,
    fill: { color: theme.accent },
  })

  const objectives = Array.isArray(props.objectives) ? props.objectives : []
  if (!objectives.length) {
    slide0.addText('（未填写教学目标）', {
      x: SAFE_MARGIN,
      y: SLIDE_H / 2 - 0.5,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 1,
      fontFace: theme.fontFace,
      fontSize: 16,
      italic: true,
      color: theme.muted,
      align: 'center',
    })
    return
  }

  // 三维目标配色
  const DIMENSION_COLORS = ['1976D2', '43A047', 'FB8C00', '7B1FA2']
  const startY = 1.7
  const usableH = SLIDE_H - startY - 0.4
  const rowH = Math.max(0.9, usableH / objectives.length)

  objectives.forEach((obj, idx) => {
    const dimColor = DIMENSION_COLORS[idx % DIMENSION_COLORS.length]
    const rowY = startY + idx * rowH
    // 左侧维度色块
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y: rowY + 0.05,
      w: 1.7,
      h: rowH - 0.15,
      fill: { color: dimColor },
      line: { color: dimColor, width: 0 },
    })
    slide0.addText(obj.dimension || `维度${idx + 1}`, {
      x: SAFE_MARGIN,
      y: rowY + 0.05,
      w: 1.7,
      h: rowH - 0.15,
      fontFace: theme.fontFace,
      fontSize: 14,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
    })
    // 右侧要点列表
    const items = Array.isArray(obj.items)
      ? obj.items.filter((s) => typeof s === 'string' && s.trim())
      : []
    if (items.length) {
      const itemTexts = items.map((item, i) => ({
        text: item,
        options: {
          bullet: { code: '25CF' },
          color: theme.fg,
          paraSpaceAfter: i === items.length - 1 ? 0 : 4,
        },
      }))
      slide0.addText(itemTexts, {
        x: SAFE_MARGIN + 1.9,
        y: rowY + 0.1,
        w: SLIDE_W - SAFE_MARGIN * 2 - 1.9,
        h: rowH - 0.25,
        fontFace: theme.fontFace,
        fontSize: 13,
        color: theme.fg,
        valign: 'middle',
      })
    } else {
      slide0.addText('（暂无要点）', {
        x: SAFE_MARGIN + 1.9,
        y: rowY + 0.1,
        w: SLIDE_W - SAFE_MARGIN * 2 - 1.9,
        h: rowH - 0.25,
        fontFace: theme.fontFace,
        fontSize: 12,
        italic: true,
        color: theme.muted,
        valign: 'middle',
      })
    }
  })
}

/**
 * KeyPointsSlide - 教学重难点（双栏）
 *  props: { title, keyPoints: string[], difficulties: string[], theme }
 */
function renderKeyPointsSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addText(props.title || '教学重难点', {
    x: SAFE_MARGIN,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: 0.9,
    fontFace: theme.fontFace,
    fontSize: 32,
    bold: true,
    color: theme.accent,
  })

  const colW = (SLIDE_W - SAFE_MARGIN * 2 - 0.5) / 2
  const colY = 1.7
  const colH = SLIDE_H - 2.3

  // 左栏：重点
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'E3F2FD' },
    line: { color: '1976D2', width: 1 },
  })
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: colY,
    w: 1.3,
    h: 0.5,
    fill: { color: '1976D2' },
  })
  slide0.addText('教学重点', {
    x: SAFE_MARGIN,
    y: colY,
    w: 1.3,
    h: 0.5,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  const keyPoints = Array.isArray(props.keyPoints)
    ? props.keyPoints.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (keyPoints.length) {
    const lines = keyPoints.map((p) => ({
      text: `★ ${p}`,
      options: { color: theme.fg, paraSpaceAfter: 6 },
    }))
    slide0.addText(lines, {
      x: SAFE_MARGIN + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（未填写重点）', {
      x: SAFE_MARGIN + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }

  // 右栏：难点
  const rightX = SAFE_MARGIN + colW + 0.5
  slide0.addShape(pres.ShapeType.rect, {
    x: rightX,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'FFF3E0' },
    line: { color: 'FB8C00', width: 1 },
  })
  slide0.addShape(pres.ShapeType.rect, {
    x: rightX,
    y: colY,
    w: 1.3,
    h: 0.5,
    fill: { color: 'FB8C00' },
  })
  slide0.addText('教学难点', {
    x: rightX,
    y: colY,
    w: 1.3,
    h: 0.5,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  const difficulties = Array.isArray(props.difficulties)
    ? props.difficulties.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (difficulties.length) {
    const lines = difficulties.map((p) => ({
      text: `⚡ ${p}`,
      options: { color: theme.fg, paraSpaceAfter: 6 },
    }))
    slide0.addText(lines, {
      x: rightX + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（未填写难点）', {
      x: rightX + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }
}

/**
 * LeadInSlide - 课堂导入页（情境 + 引导问题）
 *  props: { title, scenario, questions: string[], mediaUrl, theme }
 */
function renderLeadInSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  // 头部 chip + 标题
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: 'FB8C00' },
  })
  slide0.addText('导入', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '课堂导入', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.05,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  const colW = (SLIDE_W - SAFE_MARGIN * 2 - 0.5) / 2
  const colY = 1.5
  const colH = SLIDE_H - colY - 0.4

  // 左栏：情境
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'FFF3E0' },
    line: { color: 'FB8C00', width: 1, dashType: 'dash' },
  })
  slide0.addText('📖 情境', {
    x: SAFE_MARGIN + 0.2,
    y: colY + 0.15,
    w: colW - 0.4,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 16,
    bold: true,
    color: 'FB8C00',
  })
  if (props.scenario) {
    slide0.addText(props.scenario, {
      x: SAFE_MARGIN + 0.2,
      y: colY + 0.7,
      w: colW - 0.4,
      h: colH - 0.85,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
      paraSpaceAfter: 6,
    })
  } else {
    slide0.addText('（未填写导入情境）', {
      x: SAFE_MARGIN + 0.2,
      y: colY + 0.7,
      w: colW - 0.4,
      h: colH - 0.85,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }

  // 右栏：引导问题
  const rightX = SAFE_MARGIN + colW + 0.5
  slide0.addShape(pres.ShapeType.rect, {
    x: rightX,
    y: colY,
    w: 1.6,
    h: 0.5,
    fill: { color: '1976D2' },
  })
  slide0.addText('引导问题', {
    x: rightX,
    y: colY,
    w: 1.6,
    h: 0.5,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  const questions = Array.isArray(props.questions)
    ? props.questions.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (questions.length) {
    const qLines = questions.map((q, i) => ({
      text: `${i + 1}. ${q}`,
      options: { color: theme.fg, paraSpaceAfter: 8 },
    }))
    slide0.addText(qLines, {
      x: rightX,
      y: colY + 0.65,
      w: colW,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（未填写引导问题）', {
      x: rightX,
      y: colY + 0.65,
      w: colW,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }
}

/**
 * ConceptSlide - 概念讲解（新知讲授）
 *  props: { title, definition, keyPoints: string[], formula?, formulaLatex?, theme }
 */
function renderConceptSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 1.05,
    h: 0.45,
    fill: { color: '1976D2' },
  })
  slide0.addText('新知讲授', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 1.05,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 13,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '新知讲授', {
    x: SAFE_MARGIN + 1.25,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.25,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  let y = 1.5
  if (props.definition) {
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y,
      w: 0.15,
      h: 0.95,
      fill: { color: '1976D2' },
    })
    slide0.addText(
      [
        { text: '定义  ', options: { bold: true, color: '1976D2', fontSize: 14 } },
        { text: props.definition, options: { color: theme.fg, fontSize: 14 } },
      ],
      {
        x: SAFE_MARGIN + 0.3,
        y,
        w: SLIDE_W - SAFE_MARGIN * 2 - 0.3,
        h: 0.95,
        fontFace: theme.fontFace,
        valign: 'middle',
      },
    )
    y += 1.15
  } else {
    slide0.addText('（未填写定义）', {
      x: SAFE_MARGIN,
      y,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 0.5,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
    })
    y += 0.55
  }

  const keyPoints = Array.isArray(props.keyPoints)
    ? props.keyPoints.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (keyPoints.length) {
    const lines = keyPoints.map((p, i) => ({
      text: `${i + 1}. ${p}`,
      options: { color: theme.fg, paraSpaceAfter: 6, bullet: false },
    }))
    slide0.addText(lines, {
      x: SAFE_MARGIN + 0.2,
      y,
      w: SLIDE_W - SAFE_MARGIN * 2 - 0.2,
      h: Math.min(3.5, (keyPoints.length * 0.45 + 0.3)),
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
    y += keyPoints.length * 0.45 + 0.3
  } else if (!props.definition) {
    slide0.addText('（未填写要点）', {
      x: SAFE_MARGIN,
      y,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 0.5,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
    })
    y += 0.55
  }

  const formula = props.formulaLatex || props.formula
  if (formula) {
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y: y + 0.1,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 0.85,
      fill: { color: 'FFF8E1' },
      line: { color: 'FFB300', width: 1, dashType: 'dash' },
    })
    slide0.addText(
      [
        { text: '公式  ', options: { bold: true, color: 'FFB300', fontSize: 13 } },
        { text: formula, options: { color: 'B26500', italic: true, fontSize: 16, fontFace: 'Cambria Math' } },
      ],
      {
        x: SAFE_MARGIN + 0.25,
        y: y + 0.1,
        w: SLIDE_W - SAFE_MARGIN * 2 - 0.5,
        h: 0.85,
        fontFace: theme.fontFace,
        valign: 'middle',
      },
    )
  }
}

/**
 * ExampleSlide - 例题讲解（题目 + 解答）
 *  props: { title, problem, solution: string[], analysis?, tips?, theme }
 */
function renderExampleSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: '43A047' },
  })
  slide0.addText('例题', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '例题讲解', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.05,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  const colW = (SLIDE_W - SAFE_MARGIN * 2 - 0.5) / 2
  const colY = 1.5
  const colH = SLIDE_H - colY - 0.4

  // 左栏：题目
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'E8F5E9' },
    line: { color: '43A047', width: 1 },
  })
  slide0.addText('题目', {
    x: SAFE_MARGIN + 0.2,
    y: colY + 0.15,
    w: colW - 0.4,
    h: 0.4,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: '43A047',
  })
  if (props.problem) {
    slide0.addText(props.problem, {
      x: SAFE_MARGIN + 0.2,
      y: colY + 0.65,
      w: colW - 0.4,
      h: 1.6,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（未填写题目）', {
      x: SAFE_MARGIN + 0.2,
      y: colY + 0.65,
      w: colW - 0.4,
      h: 0.6,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
    })
  }
  if (props.analysis) {
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN + 0.2,
      y: colY + 2.35,
      w: colW - 0.4,
      h: 0.95,
      fill: { color: 'FFF8E1' },
      line: { color: 'FB8C00', width: 0 },
    })
    slide0.addText(
      [
        { text: '思路分析\n', options: { bold: true, color: 'FB8C00', fontSize: 11 } },
        { text: props.analysis, options: { color: theme.fg, fontSize: 12 } },
      ],
      {
        x: SAFE_MARGIN + 0.35,
        y: colY + 2.4,
        w: colW - 0.7,
        h: 0.85,
        fontFace: theme.fontFace,
        valign: 'top',
      },
    )
  }
  if (props.tips) {
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN + 0.2,
      y: colY + 3.45,
      w: colW - 0.4,
      h: 0.85,
      fill: { color: 'E3F2FD' },
      line: { color: '1976D2', width: 0 },
    })
    slide0.addText(
      [
        { text: '解题提示\n', options: { bold: true, color: '1976D2', fontSize: 11 } },
        { text: props.tips, options: { color: theme.fg, fontSize: 12 } },
      ],
      {
        x: SAFE_MARGIN + 0.35,
        y: colY + 3.5,
        w: colW - 0.7,
        h: 0.75,
        fontFace: theme.fontFace,
        valign: 'top',
      },
    )
  }

  // 右栏：解答
  const rightX = SAFE_MARGIN + colW + 0.5
  slide0.addShape(pres.ShapeType.rect, {
    x: rightX,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'E3F2FD' },
    line: { color: '1976D2', width: 1 },
  })
  slide0.addText('解答', {
    x: rightX + 0.2,
    y: colY + 0.15,
    w: colW - 0.4,
    h: 0.4,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: '1976D2',
  })
  const solution = Array.isArray(props.solution)
    ? props.solution.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (solution.length) {
    const solLines = solution.map((s, i) => ({
      text: `${i + 1}. ${s}`,
      options: { color: theme.fg, paraSpaceAfter: 8 },
    }))
    slide0.addText(solLines, {
      x: rightX + 0.2,
      y: colY + 0.65,
      w: colW - 0.4,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（未填写解答步骤）', {
      x: rightX + 0.2,
      y: colY + 0.65,
      w: colW - 0.4,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }
}

/**
 * PracticeSlide - 课堂练习
 *  props: { title, questions: [{stem, type?, options?, difficulty?, answer?}], answerVisible, theme }
 */
function renderPracticeSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  // 头部
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: 'FB8C00' },
  })
  slide0.addText('练习', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '课堂练习', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 2.0,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  const showAnswer = Boolean(props.answerVisible)
  slide0.addShape(pres.ShapeType.rect, {
    x: SLIDE_W - SAFE_MARGIN - 1.8,
    y: 0.55,
    w: 1.8,
    h: 0.45,
    fill: { color: showAnswer ? 'FB8C00' : 'FFFFFF' },
    line: { color: 'FB8C00', width: 1 },
  })
  slide0.addText(showAnswer ? '隐藏答案' : '显示答案', {
    x: SLIDE_W - SAFE_MARGIN - 1.8,
    y: 0.55,
    w: 1.8,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 12,
    bold: true,
    color: showAnswer ? 'FFFFFF' : 'FB8C00',
    align: 'center',
    valign: 'middle',
  })

  const questions = Array.isArray(props.questions) ? props.questions : []
  if (!questions.length) {
    slide0.addText('（暂无练习题）', {
      x: SAFE_MARGIN,
      y: SLIDE_H / 2 - 0.5,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 1,
      fontFace: theme.fontFace,
      fontSize: 16,
      italic: true,
      color: theme.muted,
      align: 'center',
    })
    return
  }

  const yStart = 1.5
  const maxH = SLIDE_H - yStart - 0.4
  const maxPerSlide = 3
  const displayed = questions.slice(0, maxPerSlide)
  const itemH = Math.min(maxH / displayed.length, 1.85)

  displayed.forEach((q, i) => {
    const itemY = yStart + i * itemH
    // 题目卡片
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y: itemY,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: itemH - 0.1,
      fill: { color: 'FFF8E1' },
      line: { color: 'FB8C00', width: 1 },
    })
    // 题号
    slide0.addText(`${i + 1}.`, {
      x: SAFE_MARGIN + 0.15,
      y: itemY + 0.1,
      w: 0.5,
      h: 0.4,
      fontFace: theme.fontFace,
      fontSize: 16,
      bold: true,
      color: 'FB8C00',
    })
    // 类型
    slide0.addText(q.type || '解答题', {
      x: SAFE_MARGIN + 0.55,
      y: itemY + 0.13,
      w: 1.0,
      h: 0.32,
      fontSize: 10,
      bold: true,
      color: 'FB8C00',
      align: 'left',
      valign: 'middle',
    })
    // 难度
    const diff = Math.max(0, Math.min(3, Number(q.difficulty) || 1))
    slide0.addText('★'.repeat(diff) + '☆'.repeat(3 - diff), {
      x: SLIDE_W - SAFE_MARGIN - 1.5,
      y: itemY + 0.13,
      w: 1.3,
      h: 0.32,
      fontFace: theme.fontFace,
      fontSize: 12,
      color: 'FB8C00',
      align: 'right',
      valign: 'middle',
    })
    // 题干
    slide0.addText(q.stem || '', {
      x: SAFE_MARGIN + 0.2,
      y: itemY + 0.5,
      w: SLIDE_W - SAFE_MARGIN * 2 - 0.4,
      h: itemH - 0.6,
      fontFace: theme.fontFace,
      fontSize: 13,
      color: theme.fg,
      valign: 'top',
    })
    // 选项
    if (Array.isArray(q.options) && q.options.length) {
      const optLines = q.options.map((opt, oi) => ({
        text: `${String.fromCharCode(65 + oi)}. ${opt}`,
        options: { color: theme.fg, paraSpaceAfter: 2 },
      }))
      slide0.addText(optLines, {
        x: SAFE_MARGIN + 0.5,
        y: itemY + 0.85,
        w: SLIDE_W - SAFE_MARGIN * 2 - 0.7,
        h: Math.min(0.75, itemH - 0.95),
        fontFace: theme.fontFace,
        fontSize: 12,
        color: theme.fg,
        valign: 'top',
      })
    }
    // 答案
    if (showAnswer && q.answer) {
      slide0.addShape(pres.ShapeType.rect, {
        x: SAFE_MARGIN + 0.5,
        y: itemY + itemH - 0.45,
        w: SLIDE_W - SAFE_MARGIN * 2 - 0.7,
        h: 0.32,
        fill: { color: 'C8E6C9' },
        line: { color: '43A047', width: 0 },
      })
      slide0.addText(`答案：${q.answer}`, {
        x: SAFE_MARGIN + 0.6,
        y: itemY + itemH - 0.45,
        w: SLIDE_W - SAFE_MARGIN * 2 - 0.9,
        h: 0.32,
        fontFace: theme.fontFace,
        fontSize: 12,
        bold: true,
        color: '2E7D32',
        valign: 'middle',
      })
    }
  })
}

/**
 * SummarySlide - 课堂小结（要点 + 思维导图）
 *  props: { title, keyPoints: string[], mindMap: {nodes: [{id,label}], edges: [{from,to}]}, theme }
 */
function renderSummarySlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  // 头部
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: theme.accent },
  })
  slide0.addText('小结', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '课堂小结', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.05,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  const colW = (SLIDE_W - SAFE_MARGIN * 2 - 0.5) / 2
  const colY = 1.5
  const colH = SLIDE_H - colY - 0.4

  // 左栏：要点
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'F5F5F5' },
    line: { color: theme.border, width: 1 },
  })
  const keyPoints = Array.isArray(props.keyPoints)
    ? props.keyPoints.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (keyPoints.length) {
    const lines = keyPoints.map((p, i) => ({
      text: `${i + 1}. ${p}`,
      options: { color: theme.fg, paraSpaceAfter: 8 },
    }))
    slide0.addText(lines, {
      x: SAFE_MARGIN + 0.25,
      y: colY + 0.25,
      w: colW - 0.5,
      h: colH - 0.5,
      fontFace: theme.fontFace,
      fontSize: 15,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（未填写小结要点）', {
      x: SAFE_MARGIN + 0.25,
      y: colY + 0.25,
      w: colW - 0.5,
      h: colH - 0.5,
      fontFace: theme.fontFace,
      fontSize: 14,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }

  // 右栏：思维导图（文字版）
  const rightX = SAFE_MARGIN + colW + 0.5
  slide0.addShape(pres.ShapeType.rect, {
    x: rightX,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'E8F5E9' },
    line: { color: '43A047', width: 1 },
  })
  slide0.addText('🧠 知识网络', {
    x: rightX + 0.2,
    y: colY + 0.15,
    w: colW - 0.4,
    h: 0.4,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: '43A047',
  })

  const mindMap = props.mindMap
  const nodes = Array.isArray(mindMap && mindMap.nodes) ? mindMap.nodes : []
  if (nodes.length) {
    const nodeLines = nodes.map((n) => `• ${n.label || n.id || ''}`)
    slide0.addText(nodeLines.join('\n'), {
      x: rightX + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.85,
      fontFace: theme.fontFace,
      fontSize: 13,
      color: theme.fg,
      valign: 'top',
      paraSpaceAfter: 6,
    })
  } else {
    slide0.addText('（未提供思维导图）', {
      x: rightX + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.85,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }
}

/**
 * BlackboardSlide - 板书设计（深绿底色 + 黄色重点标记）
 *  props: { title, layout: 'linear'|'tree'|'table', sections: [{label, content}], theme }
 */
function renderBlackboardSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  // 强制使用黑板底色（覆盖 masterName 默认底色）
  slide0.background = { color: '1E3A2E' }

  // 标题栏（黑板顶部）
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: 'FFF8E1' },
  })
  slide0.addText('板书', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: '1E3A2E',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '板书设计', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.05,
    h: 0.6,
    fontFace: 'KaiTi',
    fontSize: 26,
    bold: true,
    color: 'FFEB3B',
    valign: 'middle',
  })

  const boardY = 1.45
  const boardH = SLIDE_H - boardY - 0.3
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: boardY,
    w: SLIDE_W - SAFE_MARGIN * 2,
    h: boardH,
    fill: { color: '1E3A2E' },
    line: { color: 'FFF8E1', width: 2 },
  })

  const sections = Array.isArray(props.sections)
    ? props.sections.filter((s) => s && typeof s.label === 'string')
    : []
  if (!sections.length) {
    slide0.addText('（暂无板书内容）', {
      x: SAFE_MARGIN + 0.5,
      y: boardY + boardH / 2 - 0.3,
      w: SLIDE_W - SAFE_MARGIN * 2 - 1,
      h: 0.6,
      fontFace: 'KaiTi',
      fontSize: 16,
      italic: true,
      color: 'FFF8E1',
      align: 'center',
    })
    return
  }

  const layout = props.layout || 'linear'
  let y = boardY + 0.4

  if (layout === 'linear') {
    sections.forEach((s) => {
      slide0.addText(s.label, {
        x: SAFE_MARGIN + 0.5,
        y,
        w: 2.0,
        h: 0.5,
        fontFace: 'KaiTi',
        fontSize: 18,
        bold: true,
        color: 'FFEB3B',
        valign: 'middle',
      })
      slide0.addText(s.content || '', {
        x: SAFE_MARGIN + 2.6,
        y,
        w: SLIDE_W - SAFE_MARGIN * 2 - 3.1,
        h: 0.5,
        fontFace: 'KaiTi',
        fontSize: 18,
        color: 'FFF8E1',
        valign: 'middle',
      })
      y += 0.7
    })
  } else if (layout === 'tree') {
    sections.forEach((s) => {
      slide0.addShape(pres.ShapeType.rect, {
        x: SAFE_MARGIN + 0.4,
        y,
        w: 0.06,
        h: 0.85,
        fill: { color: 'FFEB3B' },
      })
      slide0.addText(s.label, {
        x: SAFE_MARGIN + 0.6,
        y,
        w: SLIDE_W - SAFE_MARGIN * 2 - 1,
        h: 0.4,
        fontFace: 'KaiTi',
        fontSize: 17,
        bold: true,
        color: 'FFEB3B',
      })
      if (s.content) {
        slide0.addText(s.content, {
          x: SAFE_MARGIN + 0.85,
          y: y + 0.42,
          w: SLIDE_W - SAFE_MARGIN * 2 - 1.25,
          h: 0.45,
          fontFace: 'KaiTi',
          fontSize: 16,
          color: 'FFF8E1',
        })
      }
      y += 1.0
    })
  } else {
    // table 布局
    sections.forEach((s) => {
      slide0.addText(s.label, {
        x: SAFE_MARGIN + 0.5,
        y,
        w: 2.2,
        h: 0.5,
        fontFace: 'KaiTi',
        fontSize: 17,
        bold: true,
        color: 'FFEB3B',
        valign: 'middle',
      })
      slide0.addText('|', {
        x: SAFE_MARGIN + 2.8,
        y,
        w: 0.2,
        h: 0.5,
        fontFace: 'KaiTi',
        fontSize: 18,
        color: 'FFF8E1',
        align: 'center',
        valign: 'middle',
      })
      slide0.addText(s.content || '', {
        x: SAFE_MARGIN + 3.05,
        y,
        w: SLIDE_W - SAFE_MARGIN * 2 - 3.55,
        h: 0.5,
        fontFace: 'KaiTi',
        fontSize: 17,
        color: 'FFF8E1',
        valign: 'middle',
      })
      // 分割线
      slide0.addShape(pres.ShapeType.line, {
        x: SAFE_MARGIN + 0.5,
        y: y + 0.55,
        w: SLIDE_W - SAFE_MARGIN * 2 - 1,
        h: 0,
        line: { color: 'FFF8E1', width: 0.5, dashType: 'dash' },
      })
      y += 0.6
    })
  }
}

/**
 * HomeworkSlide - 作业布置（按必做/选做/实践分组）
 *  props: { title, tasks: [{type: '必做'|'选做'|'实践', description, source?}], theme }
 */
function renderHomeworkSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: '7B1FA2' },
  })
  slide0.addText('作业', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '作业布置', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.05,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  const tasks = Array.isArray(props.tasks)
    ? props.tasks.filter((t) => t && typeof t.description === 'string')
    : []
  if (!tasks.length) {
    slide0.addText('（暂无作业）', {
      x: SAFE_MARGIN,
      y: SLIDE_H / 2 - 0.5,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: 1,
      fontFace: theme.fontFace,
      fontSize: 16,
      italic: true,
      color: theme.muted,
      align: 'center',
    })
    return
  }

  const typeColors = {
    必做: '1976D2',
    选做: '43A047',
    实践: 'FB8C00',
  }
  // 按类型分组
  const groups = { 必做: [], 选做: [], 实践: [] }
  for (const t of tasks) {
    const k = t.type && groups[t.type] ? t.type : '必做'
    groups[k].push(t)
  }

  let y = 1.4
  const groupKeys = ['必做', '选做', '实践']
  for (const key of groupKeys) {
    const group = groups[key]
    if (!group.length) continue
    const groupColor = typeColors[key]
    const groupH = Math.min(2.0, 0.55 + group.length * 0.5)
    if (y + groupH > SLIDE_H - 0.3) break

    // 分组卡片
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y,
      w: SLIDE_W - SAFE_MARGIN * 2,
      h: groupH - 0.05,
      fill: { color: 'FAFAFA' },
      line: { color: groupColor, width: 1 },
    })
    // 左侧色条
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN,
      y,
      w: 0.12,
      h: groupH - 0.05,
      fill: { color: groupColor },
      line: { color: groupColor, width: 0 },
    })
    // 类型 chip
    slide0.addShape(pres.ShapeType.rect, {
      x: SAFE_MARGIN + 0.3,
      y: y + 0.12,
      w: 0.7,
      h: 0.36,
      fill: { color: groupColor },
    })
    slide0.addText(key, {
      x: SAFE_MARGIN + 0.3,
      y: y + 0.12,
      w: 0.7,
      h: 0.36,
      fontFace: theme.fontFace,
      fontSize: 12,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
    })
    slide0.addText(`共 ${group.length} 项`, {
      x: SAFE_MARGIN + 1.1,
      y: y + 0.12,
      w: 2.0,
      h: 0.36,
      fontFace: theme.fontFace,
      fontSize: 11,
      color: theme.muted,
      valign: 'middle',
    })

    // 任务列表
    const lines = group.map((t, i) => ({
      text: `${i + 1}. ${t.description}${t.source ? `（来源：${t.source}）` : ''}`,
      options: { color: theme.fg, paraSpaceAfter: 4 },
    }))
    slide0.addText(lines, {
      x: SAFE_MARGIN + 0.4,
      y: y + 0.55,
      w: SLIDE_W - SAFE_MARGIN * 2 - 0.6,
      h: groupH - 0.7,
      fontFace: theme.fontFace,
      fontSize: 13,
      color: theme.fg,
      valign: 'top',
    })

    y += groupH + 0.1
  }
}

/**
 * ReflectionSlide - 教学反思（亮点 + 待改进）
 *  props: { title, highlights: string[], improvements: string[], theme }
 */
function renderReflectionSlide(slide, pres, theme) {
  const props = slide?.props || {}
  const masterName = theme.bg === DEFAULT_THEME.bg ? 'WPX_BASE_LIGHT' : 'WPX_BASE_DARK'
  const slide0 = pres.addSlide({ masterName })

  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fill: { color: '7B1FA2' },
  })
  slide0.addText('反思', {
    x: SAFE_MARGIN,
    y: 0.55,
    w: 0.85,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  })
  slide0.addText(props.title || '教学反思', {
    x: SAFE_MARGIN + 1.05,
    y: 0.5,
    w: SLIDE_W - SAFE_MARGIN * 2 - 1.05,
    h: 0.6,
    fontFace: theme.fontFace,
    fontSize: 28,
    bold: true,
    color: theme.accent,
    valign: 'middle',
  })

  const colW = (SLIDE_W - SAFE_MARGIN * 2 - 0.5) / 2
  const colY = 1.5
  const colH = SLIDE_H - colY - 0.4

  // 左栏：亮点
  slide0.addShape(pres.ShapeType.rect, {
    x: SAFE_MARGIN,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'E8F5E9' },
    line: { color: '43A047', width: 1 },
  })
  slide0.addText('✨ 教学亮点', {
    x: SAFE_MARGIN + 0.2,
    y: colY + 0.15,
    w: colW - 0.4,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 16,
    bold: true,
    color: '43A047',
  })
  const highlights = Array.isArray(props.highlights)
    ? props.highlights.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (highlights.length) {
    const lines = highlights.map((p) => ({
      text: `+ ${p}`,
      options: { color: theme.fg, paraSpaceAfter: 6 },
    }))
    slide0.addText(lines, {
      x: SAFE_MARGIN + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（待补充）', {
      x: SAFE_MARGIN + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
    })
  }

  // 右栏：待改进
  const rightX = SAFE_MARGIN + colW + 0.5
  slide0.addShape(pres.ShapeType.rect, {
    x: rightX,
    y: colY,
    w: colW,
    h: colH,
    fill: { color: 'FFF3E0' },
    line: { color: 'FB8C00', width: 1 },
  })
  slide0.addText('🔧 待改进', {
    x: rightX + 0.2,
    y: colY + 0.15,
    w: colW - 0.4,
    h: 0.45,
    fontFace: theme.fontFace,
    fontSize: 16,
    bold: true,
    color: 'FB8C00',
  })
  const improvements = Array.isArray(props.improvements)
    ? props.improvements.filter((s) => typeof s === 'string' && s.trim())
    : []
  if (improvements.length) {
    const lines = improvements.map((p) => ({
      text: `→ ${p}`,
      options: { color: theme.fg, paraSpaceAfter: 6 },
    }))
    slide0.addText(lines, {
      x: rightX + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 14,
      color: theme.fg,
      valign: 'top',
    })
  } else {
    slide0.addText('（待补充）', {
      x: rightX + 0.25,
      y: colY + 0.65,
      w: colW - 0.5,
      h: colH - 0.8,
      fontFace: theme.fontFace,
      fontSize: 13,
      italic: true,
      color: theme.muted,
      align: 'center',
      valign: 'middle',
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
  // 教师专用课件（lesson-ppt）：依据需求文档中的 10 个页面类型
  OutlineSlide: renderOutlineSlide,
  KeyPointsSlide: renderKeyPointsSlide,
  LeadInSlide: renderLeadInSlide,
  ConceptSlide: renderConceptSlide,
  ExampleSlide: renderExampleSlide,
  PracticeSlide: renderPracticeSlide,
  SummarySlide: renderSummarySlide,
  BlackboardSlide: renderBlackboardSlide,
  HomeworkSlide: renderHomeworkSlide,
  ReflectionSlide: renderReflectionSlide,
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
