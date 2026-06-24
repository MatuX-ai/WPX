/**
 * useSlideExport - 幻灯片 HTML 导出（composable 版）
 *
 * 与 utils/slideExport.js 中 exportSlidesAsHtml 的差异：
 *  - 使用 reveal.js（CDN）作为渲染引擎，自带翻页动画 / 键盘导航 / 触摸滑动
 *  - 图表通过 ECharts（CDN）渲染，支持 bar / line / pie
 *  - 自带右下角缩略图导航面板
 *  - 内置全屏模式（按钮触发 + 键盘 F）
 *  - 主题色由 --wpx-accent 等 CSS 变量驱动，与 WPX 设计系统对齐
 *
 * API：
 *  - exportToHTML(slides, options) → { html, filename, blob, objectUrl, size, download() }
 *    直接传 slides 数组与 options，返回可直接下载的 Blob/URL/HTML 字符串。
 *  - useSlideExport() → { exportToHTML, downloadHtml }
 *    以 Vue composable 形式暴露（与已有代码风格一致）。
 *
 * @see https://revealjs.com/
 * @see https://echarts.apache.org/
 */

/* ───────── 默认 CDN 配置 ───────── */

const DEFAULT_REVEAL_VERSION = '5.1.0'
const DEFAULT_ECHARTS_VERSION = '5.4.3'

function pickCdn(version, path) {
  return `https://cdn.jsdelivr.net/npm/${path}@${version}/dist/${path}.min.js`
}

/* ───────── 安全：HTML 转义 ───────── */

function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 仅在渲染层调用 escapeHtml，避免双重转义导致 &lt; -> &amp;lt;。
 * props 在这里保持原始值，由 renderSlideToSection 在拼接时按需 escape。
 */

/* ───────── 组件 → reveal.js section 渲染 ───────── */

/**
 * 把单张 slide 数据编译成 reveal.js `<section>` HTML 字符串。
 *
 * 支持组件：
 *  - CoverSlide / EndSlide：居中标题 + 副标题
 *  - TextSlide：标题 + 要点列表（按顺序淡入）
 *  - ChartSlide：标题 + ECharts 容器（柱状/折线/饼）
 *  - ImageTextSlide：标题 + 图（object/iframe/img）+ 文字
 *  - 其它类型：降级为 TextSlide
 */
function renderSlideToSection(slide, index) {
  const component = String(slide?.component || 'TextSlide')
  const props = slide?.props || {}
  const inner = []

  // 工具：根据 props 读取并 escape 字符串
  const t = (key, def = '') => escapeHtml(props[key] ?? def)
  const tArr = (key) => (Array.isArray(props[key]) ? props[key].map((v) => escapeHtml(v)) : [])

  switch (component) {
    case 'CoverSlide': {
      inner.push(`<h1 class="wpx-cover-title">${t('title', '未命名演示')}</h1>`)
      if (props.subtitle) {
        inner.push(`<h3 class="wpx-cover-subtitle">${t('subtitle')}</h3>`)
      }
      if (props.author) {
        inner.push(`<p class="wpx-cover-meta">${t('author')}</p>`)
      }
      return `<section data-component="CoverSlide" data-index="${index}">
        <div class="wpx-cover">${inner.join('\n')}</div>
      </section>`
    }

    case 'EndSlide': {
      inner.push(`<h1 class="wpx-end-title">${t('text') || t('title', '谢谢观看')}</h1>`)
      if (props.subtitle) {
        inner.push(`<h3 class="wpx-end-subtitle">${t('subtitle')}</h3>`)
      }
      return `<section data-component="EndSlide" data-index="${index}">
        <div class="wpx-end">${inner.join('\n')}</div>
      </section>`
    }

    case 'TextSlide': {
      inner.push(`<h2 class="wpx-text-title">${t('title')}</h2>`)
      const points = []
      if (typeof props.body === 'string' && props.body.trim()) {
        points.push(`<li class="fragment">${escapeHtml(props.body)}</li>`)
      }
      const bullets = tArr('bulletPoints')
      for (const p of bullets) {
        points.push(`<li class="fragment">${p}</li>`)
      }
      if (typeof props.bulletPoints === 'string' && props.bulletPoints.trim() && points.length === 0) {
        points.push(`<li class="fragment">${escapeHtml(props.bulletPoints)}</li>`)
      }
      if (points.length) inner.push(`<ul class="wpx-text-bullets">${points.join('')}</ul>`)
      if (props.note) inner.push(`<p class="wpx-text-note">${t('note')}</p>`)
      return `<section data-component="TextSlide" data-index="${index}">${inner.join('\n')}</section>`
    }

    case 'ChartSlide': {
      const chartType = props.chartType || 'bar'
      inner.push(`<h2 class="wpx-chart-title">${t('title', '数据图表')}</h2>`)
      // data-* 携带图表数据，避免脚本注入
      inner.push(
        `<div class="wpx-echart" data-chart-type="${escapeHtml(chartType)}" ` +
          `data-chart-data='${escapeHtml(props.chartData || '')}' ` +
          `data-chart-x="${escapeHtml(props.xAxis || '')}" ` +
          `data-chart-y="${escapeHtml(props.yAxis || '')}" ` +
          `style="width:100%;height:60vh;"></div>`,
      )
      if (props.note) inner.push(`<p class="wpx-text-note">${t('note')}</p>`)
      return `<section data-component="ChartSlide" data-index="${index}">${inner.join('\n')}</section>`
    }

    case 'ImageTextSlide': {
      inner.push(`<h2 class="wpx-text-title">${t('title')}</h2>`)
      const url = props.imageUrl || props.image || ''
      if (url) {
        inner.push(
          `<div class="wpx-img-wrap"><img class="wpx-img" src="${escapeHtml(url)}" alt="${t('title')}" /></div>`,
        )
      } else {
        inner.push(`<div class="wpx-img-wrap wpx-img-placeholder">图片占位</div>`)
      }
      if (props.text) inner.push(`<p class="wpx-text-body">${t('text')}</p>`)
      return `<section data-component="ImageTextSlide" data-index="${index}">${inner.join('\n')}</section>`
    }

    default: {
      // 降级：尝试展示 title + body
      const title = props.title || props.text || ''
      const body = props.body || props.text || ''
      return `<section data-component="${escapeHtml(component)}" data-index="${index}">
        <h2 class="wpx-text-title">${escapeHtml(title)}</h2>
        ${body ? `<p class="wpx-text-body">${escapeHtml(body)}</p>` : ''}
      </section>`
    }
  }
}

/* ───────── 文件名清理 ───────── */

function sanitizeFilename(name) {
  const fallback = 'WPX 演示文稿'
  if (!name || typeof name !== 'string') return `${fallback}.html`
  let cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  if (!cleaned) cleaned = fallback
  return `${cleaned}.html`
}

/* ───────── 内部：从 slides 推断标题 ───────── */

function deriveTitle(slides, options) {
  if (options?.title && typeof options.title === 'string') return options.title.trim() || 'WPX 演示文稿'
  // 取第一张 CoverSlide 的 title 或第一个标题
  for (const s of slides || []) {
    if (s?.component === 'CoverSlide' && s.props?.title) return String(s.props.title).trim()
  }
  for (const s of slides || []) {
    if (s?.props?.title) return String(s.props.title).trim()
  }
  return 'WPX 演示文稿'
}

/* ───────── 完整 HTML 模板 ───────── */

function buildRevealHtml({ title, theme, sections, revealCdn, echartsCdn, chartCount }) {
  const safeTitle = escapeHtml(title)
  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="generator" content="WPX SlideDeck" />
<title>${safeTitle}</title>
<link rel="stylesheet" href="${revealCdn.css}" />
<style>
  :root {
    --wpx-bg: #ffffff;
    --wpx-fg: #0f172a;
    --wpx-muted: #475569;
    --wpx-accent: #7c3aed;
    --wpx-accent-soft: #ede9fe;
    --wpx-border: #e2e8f0;
    --wpx-card: #ffffff;
    --wpx-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
    --wpx-radius: 14px;
  }
  html[data-theme="dark"] {
    --wpx-bg: #0b1020;
    --wpx-fg: #f1f5f9;
    --wpx-muted: #94a3b8;
    --wpx-accent: #a78bfa;
    --wpx-accent-soft: rgba(167, 139, 250, 0.15);
    --wpx-border: #1e293b;
    --wpx-card: #0f172a;
    --wpx-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  html, body, .reveal-viewport { background: var(--wpx-bg); color: var(--wpx-fg); }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', Inter, system-ui, sans-serif; }
  .reveal .slides { text-align: left; }
  .reveal .slides section {
    background: var(--wpx-card);
    border: 1px solid var(--wpx-border);
    border-radius: var(--wpx-radius);
    box-shadow: var(--wpx-shadow);
    padding: 48px 56px;
    color: var(--wpx-fg);
  }
  .reveal h1, .reveal h2, .reveal h3 { color: var(--wpx-fg); letter-spacing: -0.01em; }
  .reveal h1 { font-size: 2.6rem; margin: 0 0 12px; line-height: 1.2; }
  .reveal h2 { font-size: 1.9rem; margin: 0 0 16px; line-height: 1.3; color: var(--wpx-accent); }
  .reveal h3 { font-size: 1.2rem; margin: 0 0 8px; color: var(--wpx-muted); font-weight: 500; }
  .reveal .wpx-cover, .reveal .wpx-end {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; min-height: 60vh; gap: 12px;
  }
  .reveal .wpx-cover-title { font-size: 3.2rem; background: linear-gradient(135deg, var(--wpx-accent), #ec4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .reveal .wpx-cover-subtitle, .reveal .wpx-end-subtitle { color: var(--wpx-muted); font-weight: 400; }
  .reveal .wpx-text-title { color: var(--wpx-accent); }
  .reveal .wpx-text-bullets { font-size: 1.25rem; line-height: 1.85; padding-left: 1.6rem; }
  .reveal .wpx-text-bullets li { margin-bottom: 10px; }
  .reveal .wpx-text-note, .reveal .wpx-text-body { color: var(--wpx-muted); margin-top: 24px; }
  .reveal .wpx-chart-title { text-align: center; }
  .reveal .wpx-img-wrap { display: flex; justify-content: center; align-items: center; margin: 16px 0; min-height: 30vh; }
  .reveal .wpx-img { max-width: 60%; max-height: 50vh; object-fit: contain; border-radius: 8px; }
  .reveal .wpx-img-placeholder {
    background: var(--wpx-accent-soft); color: var(--wpx-muted);
    padding: 40px; border-radius: 12px; border: 1px dashed var(--wpx-border);
  }
  /* 控制栏 */
  .wpx-floating-toolbar {
    position: fixed; right: 24px; bottom: 24px; z-index: 30;
    display: flex; gap: 8px; align-items: center;
    background: var(--wpx-card); border: 1px solid var(--wpx-border);
    border-radius: 999px; padding: 6px 10px; box-shadow: var(--wpx-shadow);
  }
  .wpx-floating-toolbar button {
    width: 36px; height: 36px; border-radius: 50%;
    border: none; background: transparent; color: var(--wpx-fg);
    cursor: pointer; font-size: 16px; display: inline-flex; align-items: center; justify-content: center;
  }
  .wpx-floating-toolbar button:hover { background: var(--wpx-accent-soft); color: var(--wpx-accent); }
  .wpx-floating-toolbar .wpx-page-info { color: var(--wpx-muted); font-variant-numeric: tabular-nums; padding: 0 8px; font-size: 13px; }
  /* 缩略图面板 */
  .wpx-thumbs {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center;
    padding: 32px; overflow: auto;
  }
  .wpx-thumbs.open { display: flex; }
  .wpx-thumbs__grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px; width: 100%; max-width: 1200px;
  }
  .wpx-thumbs__item {
    background: var(--wpx-card); border: 2px solid var(--wpx-border);
    border-radius: 10px; padding: 12px; cursor: pointer;
    transition: transform 0.15s, border-color 0.15s;
    aspect-ratio: 16/9; overflow: hidden; display: flex; flex-direction: column; gap: 6px;
  }
  .wpx-thumbs__item:hover { transform: translateY(-2px); border-color: var(--wpx-accent); }
  .wpx-thumbs__item.current { border-color: var(--wpx-accent); box-shadow: 0 0 0 3px var(--wpx-accent-soft); }
  .wpx-thumbs__item h4 { font-size: 14px; margin: 0; color: var(--wpx-fg); }
  .wpx-thumbs__item small { font-size: 11px; color: var(--wpx-muted); }
  .wpx-thumbs__close {
    position: fixed; top: 24px; right: 24px; z-index: 51;
    background: var(--wpx-card); border: 1px solid var(--wpx-border);
    border-radius: 999px; width: 40px; height: 40px; cursor: pointer; font-size: 18px;
  }
  /* reveal.js 主题兼容覆盖 */
  .reveal .controls { color: var(--wpx-accent); }
  .reveal .progress { color: var(--wpx-accent); }
  /* 触摸：更宽 hit area */
  .reveal .touch-link { background: none; }
  /* 全屏占位 */
  .wpx-fullscreen-target:fullscreen { background: var(--wpx-bg); }
</style>
</head>
<body>
<div class="reveal">
  <div class="slides">
${sections.join('\n')}
  </div>
</div>

<!-- 浮动工具栏：缩略图 / 全屏 / 页码 -->
<div class="wpx-floating-toolbar" role="toolbar" aria-label="演示文稿控制">
  <button id="wpx-thumbs-toggle" type="button" title="缩略图导航 (T)" aria-label="缩略图导航">🗂️</button>
  <button id="wpx-fullscreen-toggle" type="button" title="全屏 (F)" aria-label="全屏">⛶</button>
  <span class="wpx-page-info" id="wpx-page-info">1 / ${sections.length}</span>
</div>

<!-- 缩略图面板 -->
<div class="wpx-thumbs" id="wpx-thumbs" role="dialog" aria-label="缩略图导航">
  <button class="wpx-thumbs__close" type="button" aria-label="关闭">×</button>
  <div class="wpx-thumbs__grid" id="wpx-thumbs-grid"></div>
</div>

<script src="${revealCdn.js}"></script>
${chartCount > 0 ? `<script src="${echartsCdn}"></script>` : ''}
<script>
(function () {
  'use strict';

  function init() {
    if (typeof Reveal === 'undefined') {
      console.error('[WPX SlideDeck] reveal.js 加载失败');
      return;
    }

    Reveal.initialize({
      hash: true,
      controls: true,
      controlsTutorial: false,
      progress: true,
      slideNumber: 'c/t',
      keyboard: true,
      touch: true,
      fragment: true,
      fragments: true,
      transition: 'slide',
      backgroundTransition: 'fade',
      width: 1280,
      height: 720,
      margin: 0.06,
      minScale: 0.2,
      maxScale: 2.0,
      pdf: false,
    });

    buildThumbs();
    bindToolbar();
    bindThumbs();

    Reveal.on('slidechanged', syncPageInfo);
    Reveal.on('ready', syncPageInfo);
    ${chartCount > 0 ? 'Reveal.on("ready", initCharts); Reveal.on("slidechanged", maybeUpdateChart);' : ''}
  }

  function syncPageInfo(event) {
    var idx = (event && event.indexh != null) ? event.indexh : (Reveal.getIndices ? Reveal.getIndices().h : 0);
    var totalEl = document.querySelectorAll('.reveal .slides > section').length;
    var info = document.getElementById('wpx-page-info');
    if (info) info.textContent = (idx + 1) + ' / ' + totalEl;
    highlightThumb(idx);
  }

  function buildThumbs() {
    var grid = document.getElementById('wpx-thumbs-grid');
    var slides = document.querySelectorAll('.reveal .slides > section');
    if (!grid || !slides.length) return;
    var html = '';
    slides.forEach(function (s, i) {
      var titleEl = s.querySelector('h1, h2');
      var title = titleEl ? (titleEl.textContent || '').trim().slice(0, 30) : '第 ' + (i + 1) + ' 页';
      var comp = s.getAttribute('data-component') || 'TextSlide';
      html += '<div class="wpx-thumbs__item" data-index="' + i + '" role="button" tabindex="0">'
        + '<small>' + (i + 1) + ' · ' + comp + '</small>'
        + '<h4>' + escapeText(title) + '</h4>'
        + '</div>';
    });
    grid.innerHTML = html;
  }

  function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function bindThumbs() {
    var grid = document.getElementById('wpx-thumbs-grid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var item = e.target.closest('.wpx-thumbs__item');
      if (!item) return;
      var idx = parseInt(item.getAttribute('data-index') || '0', 10);
      Reveal.slide(idx);
      closeThumbs();
    });
    grid.addEventListener('keydown', function (e) {
      var item = e.target.closest('.wpx-thumbs__item');
      if (!item) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var idx = parseInt(item.getAttribute('data-index') || '0', 10);
        Reveal.slide(idx);
        closeThumbs();
      }
    });
    document.querySelector('.wpx-thumbs__close').addEventListener('click', closeThumbs);
  }

  function openThumbs() {
    var panel = document.getElementById('wpx-thumbs');
    panel.classList.add('open');
    var idx = Reveal.getIndices().h;
    highlightThumb(idx);
  }
  function closeThumbs() {
    var panel = document.getElementById('wpx-thumbs');
    panel.classList.remove('open');
  }

  function highlightThumb(idx) {
    var items = document.querySelectorAll('.wpx-thumbs__item');
    items.forEach(function (it, i) {
      it.classList.toggle('current', i === idx);
    });
  }

  function bindToolbar() {
    document.getElementById('wpx-thumbs-toggle').addEventListener('click', openThumbs);
    document.getElementById('wpx-fullscreen-toggle').addEventListener('click', toggleFullscreen);

    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 't' || e.key === 'T') {
        var panel = document.getElementById('wpx-thumbs');
        if (panel.classList.contains('open')) closeThumbs(); else openThumbs();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        closeThumbs();
      }
    });
  }

  function toggleFullscreen() {
    var target = document.documentElement;
    if (!document.fullscreenElement) {
      var req = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
      if (req) req.call(target);
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) exit.call(document);
    }
  }

  ${chartCount > 0 ? buildChartScript() : ''}

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(init);
})();
</script>
</body>
</html>`
}

function buildChartScript() {
  return `
  function parseChartData(el) {
    var raw = el.getAttribute('data-chart-data') || '';
    try { return JSON.parse(raw); } catch (e) { return []; }
  }
  function buildOption(type, data) {
    var colors = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    var dataset = Array.isArray(data) ? data : [];
    if (type === 'pie') {
      return {
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [{
          type: 'pie',
          radius: ['35%', '65%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}: {d}%' },
          data: dataset.map(function (d, i) { return { name: d.name || ('项 ' + (i + 1)), value: d.value || 0 }; }),
          color: colors,
        }],
      };
    }
    var categories = dataset.map(function (d) { return d.name || ''; });
    var values = dataset.map(function (d) { return Number(d.value || 0); });
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: categories, axisLabel: { color: '#64748b' } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b' } },
      series: [{
        type: type === 'line' ? 'line' : 'bar',
        data: values,
        smooth: type === 'line',
        itemStyle: { color: colors[0] },
        areaStyle: type === 'line' ? { color: 'rgba(124,58,237,0.15)' } : undefined,
        barWidth: '46%',
      }],
    };
  }
  function initCharts() {
    if (typeof echarts === 'undefined') return;
    var charts = document.querySelectorAll('.wpx-echart');
    charts.forEach(function (el, i) {
      var type = el.getAttribute('data-chart-type') || 'bar';
      var data = parseChartData(el);
      var inst = echarts.init(el, null, { renderer: 'canvas' });
      inst.setOption(buildOption(type, data));
      el.__echartInstance = inst;
    });
    window.addEventListener('resize', function () {
      charts.forEach(function (el) {
        if (el.__echartInstance) el.__echartInstance.resize();
      });
    });
  }
  function maybeUpdateChart(event) {
    // 当切到含有图表的页面时让 ECharts 重绘以适应尺寸
    if (!event || !event.currentSlide) return;
    var chart = event.currentSlide.querySelector('.wpx-echart');
    if (chart && chart.__echartInstance) {
      chart.__echartInstance.resize();
    }
  }
`
}

/* ───────── 公共 API：exportToHTML ───────── */

/**
 * @typedef {Object} ExportToHTMLOptions
 * @property {string} [title]   演示文稿标题；同时影响 <title> 与下载文件名。
 * @property {'light'|'dark'} [theme='light']
 * @property {string} [revealVersion='5.1.0']
 * @property {string} [echartsVersion='5.4.3']
 * @property {string} [filename] 直接覆盖下载文件名（必须以 .html 结尾）。
 * @property {string} [revealCdn] 自定义 reveal.js CDN base URL（高级）。
 * @property {string} [echartsCdn] 自定义 echarts CDN URL（高级）。
 */

/**
 * @typedef {Object} ExportToHTMLResult
 * @property {string} html       完整 HTML 字符串
 * @property {Blob} blob         HTML Blob（text/html;charset=utf-8）
 * @property {string} objectUrl  可用于 <a href> 的对象 URL（需 revoke）
 * @property {string} filename   下载文件名
 * @property {number} size       字节数
 * @property {() => void} download 在浏览器中触发下载
 */

/**
 * 把 slides 数组生成为独立可下载的 HTML 文件。
 * 返回的 result 可以拿到 html 字符串、Blob、objectUrl 与 download() 方法。
 *
 * @param {Array<{ component: string, props: object }>} slides
 * @param {ExportToHTMLOptions} [options]
 * @returns {ExportToHTMLResult}
 */
export function exportToHTML(slides, options = {}) {
  const list = Array.isArray(slides) ? slides : []
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const title = deriveTitle(list, options)
  const filenameRaw = options.filename
    ? options.filename.replace(/\.html$/i, '')
    : title
  const filename = sanitizeFilename(filenameRaw)

  const revealVersion = options.revealVersion || DEFAULT_REVEAL_VERSION
  const echartsVersion = options.echartsVersion || DEFAULT_ECHARTS_VERSION
  const revealCdn = {
    css: options.revealCdn
      ? options.revealCdn
      : `https://cdn.jsdelivr.net/npm/reveal.js@${revealVersion}/dist/reveal.css`,
    js: options.revealCdn
      ? options.revealCdn.replace(/\.css$/, '.js')
      : `https://cdn.jsdelivr.net/npm/reveal.js@${revealVersion}/dist/reveal.js`,
  }
  const echartsCdn = options.echartsCdn || pickCdn(echartsVersion, 'echarts')

  // 渲染所有 section
  const sections = list.map((s, i) => renderSlideToSection(s, i))
  // 统计图表页数（决定是否引入 ECharts）
  const chartCount = list.filter((s) => String(s?.component || '') === 'ChartSlide').length

  const html = buildRevealHtml({
    title,
    theme,
    sections,
    revealCdn,
    echartsCdn,
    chartCount,
  })

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const objectUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : ''
  const size = blob.size

  function download() {
    if (typeof document === 'undefined') return
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return { html, blob, objectUrl, filename, size, download }
}

/* ───────── Vue Composable 入口 ───────── */

/**
 * 以 composable 形式暴露，便于在 setup() 中直接拿到 exportToHTML。
 *
 * 用法：
 *   const { exportToHTML } = useSlideExport()
 *   const result = exportToHTML(slides, { title: '发布会' })
 *   result.download()
 */
export function useSlideExport() {
  return {
    /**
     * @type {(slides: Array<any>, options?: ExportToHTMLOptions) => ExportToHTMLResult}
     */
    exportToHTML,

    /**
     * 一行下载：slides + options → 直接触发浏览器下载。
     * @param {Array<any>} slides
     * @param {ExportToHTMLOptions} [options]
     * @returns {ExportToHTMLResult}
     */
    downloadHtml(slides, options) {
      const result = exportToHTML(slides, options)
      result.download()
      return result
    },
  }
}

export default useSlideExport
