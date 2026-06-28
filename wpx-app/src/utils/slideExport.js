/**
 * slideExport - 幻灯片导出工具
 *
 * 提供两个纯前端导出能力：
 *  - exportSlidesAsHtml：将 slides 数组渲染为独立可交互 HTML（内嵌 SlideDeck 翻页逻辑）
 *  - exportSlidesAsPptx：将 slides 数组通过 pptxgenjs 打包为 .pptx 下载
 *
 * 设计要点：
 *  - 不依赖后端，避免服务端口未启动时无法导出
 *  - HTML 导出使用自包含字符串拼接，可双击直接在浏览器中打开
 *  - PPTX 导出走 pptxgenjs，支持最常见的文本页与封面/结束页，
 *    对图表页与图文页做基础降级（占位文本 + 标题）
 */
/**
 * 动态加载 pptxgenjs。仅在用户实际调用 exportSlidesAsPptx 时才加载，
 * 避免在未安装 pptxgenjs 的环境下让整个 slideExport 模块无法解析。
 * 使用 new Function('return import(...)') 是为了绕过 Vite 的 import-analysis，
 * 让静态打包工具忽略这个依赖存在性检查。
 */
const dynamicImport = new Function('p', 'return import(p)')
async function loadPptxGenJS() {
  try {
    const mod = await dynamicImport('pptxgenjs')
    return mod?.default || mod?.PptxGenJS || mod
  } catch (error) {
    throw new Error('pptxgenjs 未安装，请先执行 npm install pptxgenjs')
  }
}

/* ───────── HTML 导出 ───────── */

/**
 * 把 slides 数据序列化为可独立运行的 HTML 页面。
 *  - 渲染一个浅色 / 深色主题切换的简单播放器（不依赖 Vue/ECharts 运行时）
 *  - 仅保留标题与文本要点；图表与图片降级为占位提示
 *
 * @param {Array<{ component: string, props: object }>} slides
 * @param {{ theme?: 'light' | 'dark', title?: string }} [options]
 * @returns {string} 完整 HTML 字符串
 */
export function exportSlidesAsHtml(slides, options = {}) {
  const list = Array.isArray(slides) ? slides : []
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const docTitle = options.title || 'WPX 演示文稿'

  // 对 slides 中的字符串进行 HTML 转义，避免 <script> 等标签污染输出文件
  const escapedList = list.map((s, idx) => ({
    index: idx,
    component: s?.component || 'TextSlide',
    props: escapeProps(s?.props || {}),
  }))
  const slidesJson = JSON.stringify(escapedList)

  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(docTitle)}</title>
<style>
  :root { --bg:#fff; --fg:#1a1a1a; --muted:#475569; --accent:#7c3aed; --border:#e2e8f0; }
  [data-theme="dark"] { --bg:#0f172a; --fg:#f1f5f9; --muted:#94a3b8; --accent:#a78bfa; --border:#1e293b; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; background: var(--bg); color: var(--fg); font-family: 'PingFang SC', 'Microsoft YaHei', Inter, system-ui, sans-serif; }
  .deck { display: flex; flex-direction: column; height: 100vh; }
  .stage { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: hidden; }
  .slide { width: min(960px, 100%); aspect-ratio: 16 / 9; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; padding: 48px; box-shadow: 0 6px 32px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 16px; overflow: hidden; }
  .slide h1 { font-size: 2.4rem; margin: 0; line-height: 1.2; }
  .slide h2 { font-size: 1.8rem; margin: 0; line-height: 1.3; color: var(--accent); }
  .slide p { margin: 0; color: var(--muted); }
  .slide ul { margin: 0; padding-left: 1.4rem; line-height: 1.8; font-size: 1.1rem; }
  .slide .placeholder { padding: 16px; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); }
  .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-top: 1px solid var(--border); background: var(--bg); }
  .toolbar button { padding: 6px 14px; border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 999px; cursor: pointer; font-size: 14px; }
  .toolbar button:disabled { opacity: .4; cursor: not-allowed; }
  .toolbar button:hover:not(:disabled) { background: var(--accent); color: #fff; border-color: var(--accent); }
  .page-info { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<div class="deck">
  <div class="stage" id="stage"></div>
  <div class="toolbar">
    <button id="prev">&larr; 上一页</button>
    <div class="page-info"><span id="cur">1</span> / <span id="total">${list.length}</span></div>
    <button id="next">下一页 &rarr;</button>
  </div>
</div>
<script>
  const slides = ${slidesJson};
  const stage = document.getElementById('stage');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const cur = document.getElementById('cur');
  let i = 0;

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function render(){
    const s = slides[i] || { props: {} };
    const p = s.props || {};
    let html = '';
    if (s.component === 'CoverSlide') {
      html = '<h1>' + esc(p.title || '未命名演示文稿') + '</h1>' + (p.subtitle ? '<p>' + esc(p.subtitle) + '</p>' : '');
    } else if (s.component === 'EndSlide') {
      html = '<h1>' + esc(p.text || '感谢观看') + '</h1>' + (p.contactInfo?.website ? '<p>' + esc(p.contactInfo.website) + '</p>' : '');
    } else if (s.component === 'TextSlide' || s.component === 'TocSlide') {
      const items = Array.isArray(p.bulletPoints) ? p.bulletPoints : (Array.isArray(p.items) ? p.items : []);
      html = '<h2>' + esc(p.title || '') + '</h2>' + (items.length ? '<ul>' + items.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p>暂无要点</p>');
    } else if (s.component === 'ImageTextSlide') {
      html = '<h2>' + esc(p.title || '') + '</h2><div class="placeholder">[图片占位] ' + esc(p.imageUrl || '') + '</div><p>' + esc(p.text || '') + '</p>';
    } else if (s.component === 'ChartSlide') {
      html = '<h2>' + esc(p.title || '') + '</h2><div class="placeholder">[图表占位] ' + esc(p.chartType || 'bar') + '</div>';
    } else if (s.component === 'TableSlide') {
      html = '<h2>' + esc(p.title || '') + '</h2><div class="placeholder">[表格占位]</div>';
    } else {
      html = '<h2>' + esc(p.title || s.component) + '</h2>';
    }
    stage.innerHTML = '<div class="slide">' + html + '</div>';
    cur.textContent = (i + 1);
    prev.disabled = i <= 0;
    next.disabled = i >= slides.length - 1;
  }

  prev.addEventListener('click', () => { if (i > 0) { i -= 1; render(); } });
  next.addEventListener('click', () => { if (i < slides.length - 1) { i += 1; render(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prev.click();
    else if (e.key === 'ArrowRight' || e.key === ' ') next.click();
  });
  render();
</script>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 递归对 props 对象中的字符串字段进行 HTML 转义。
 * - 保留对象与数组结构
 * - 仅转义 string；其它类型（number、boolean、null）原样返回
 */
function escapeProps(value) {
  if (value == null) return value
  if (typeof value === 'string') return escapeHtml(value)
  if (Array.isArray(value)) return value.map(escapeProps)
  if (typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value)) {
      out[key] = escapeProps(value[key])
    }
    return out
  }
  return value
}

/**
 * 触发浏览器下载一段文本/Blob。
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 200)
}

/**
 * 在浏览器端下载导出的 HTML。
 * @param {Array} slides
 * @param {{ theme?: 'light'|'dark', filename?: string, title?: string }} [options]
 */
export function downloadSlidesAsHtml(slides, options = {}) {
  const html = exportSlidesAsHtml(slides, options)
  const filename = options.filename || `slides-${Date.now()}.html`
  triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
  return { ok: true, filename, size: html.length }
}

/* ───────── PPTX 导出 ───────── */

/**
 * 把单张 slide 翻译成 pptxgenjs 的 slide 调用配置
 */
function slideToPptx(slide, pres) {
  const props = slide?.props || {}
  const component = slide?.component || 'TextSlide'

  if (component === 'CoverSlide') {
    const s = pres.addSlide()
    s.background = { color: 'FFFFFF' }
    s.addText(props.title || '未命名演示文稿', {
      x: 0.5, y: 1.8, w: 9, h: 1.4, fontSize: 40, bold: true, color: '1a1a1a', align: 'center',
    })
    if (props.subtitle) {
      s.addText(props.subtitle, {
        x: 0.5, y: 3.4, w: 9, h: 0.8, fontSize: 18, color: '475569', align: 'center',
      })
    }
    return
  }

  if (component === 'EndSlide') {
    const s = pres.addSlide()
    s.background = { color: 'F8FAFC' }
    s.addText(props.text || '感谢观看', {
      x: 0.5, y: 2.4, w: 9, h: 1.4, fontSize: 36, bold: true, color: '1a1a1a', align: 'center',
    })
    if (props.contactInfo?.website) {
      s.addText(props.contactInfo.website, {
        x: 0.5, y: 4.0, w: 9, h: 0.6, fontSize: 14, color: '64748b', align: 'center',
      })
    }
    return
  }

  if (component === 'TextSlide' || component === 'TocSlide') {
    const s = pres.addSlide()
    const items = Array.isArray(props.bulletPoints)
      ? props.bulletPoints
      : Array.isArray(props.items) ? props.items : []
    s.addText(props.title || '', {
      x: 0.6, y: 0.5, w: 8.8, h: 1.0, fontSize: 28, bold: true, color: '7c3aed',
    })
    if (items.length) {
      s.addText(
        items.map((t) => ({ text: String(t), options: { bullet: true } })),
        { x: 0.8, y: 1.7, w: 8.4, h: 5.0, fontSize: 18, color: '1a1a1a', paraSpaceAfter: 8 },
      )
    } else {
      s.addText('（暂无要点）', {
        x: 0.8, y: 2.5, w: 8.4, h: 1, fontSize: 16, color: '94a3b8', italic: true,
      })
    }
    return
  }

  if (component === 'ImageTextSlide') {
    const s = pres.addSlide()
    s.addText(props.title || '', { x: 0.6, y: 0.5, w: 8.8, h: 1.0, fontSize: 26, bold: true, color: '1a1a1a' })
    if (props.imageUrl) {
      try {
        s.addImage({ path: props.imageUrl, x: 5.5, y: 1.8, w: 3.8, h: 2.6 })
      } catch {
        s.addText('[图片占位]', { x: 5.5, y: 1.8, w: 3.8, h: 2.6, color: '94a3b8' })
      }
    }
    s.addText(props.text || '', { x: 0.6, y: 1.8, w: 4.8, h: 4.5, fontSize: 16, color: '334155' })
    return
  }

  if (component === 'ChartSlide') {
    const s = pres.addSlide()
    s.addText(props.title || '', { x: 0.6, y: 0.5, w: 8.8, h: 1.0, fontSize: 26, bold: true, color: '1a1a1a' })
    s.addText(`[${props.chartType || 'bar'} 图表占位]`, { x: 0.8, y: 2.0, w: 8.4, h: 3.6, color: '94a3b8', fontSize: 16 })
    return
  }

  if (component === 'TableSlide') {
    const s = pres.addSlide()
    s.addText(props.title || '', { x: 0.6, y: 0.5, w: 8.8, h: 1.0, fontSize: 26, bold: true, color: '1a1a1a' })
    const headers = Array.isArray(props.tableData?.headers) ? props.tableData.headers : []
    const rows = Array.isArray(props.tableData?.rows) ? props.tableData.rows : []
    if (headers.length) {
      s.addTable([headers, ...rows], {
        x: 0.6, y: 1.7, w: 8.8, h: 4.0, fontSize: 12, color: '1a1a1a',
      })
    } else {
      s.addText('[表格占位]', { x: 0.8, y: 2.0, w: 8.4, h: 3.6, color: '94a3b8', fontSize: 16 })
    }
    return
  }

  // 默认文本页
  const s = pres.addSlide()
  s.addText(props.title || component, { x: 0.6, y: 0.5, w: 8.8, h: 1.0, fontSize: 26, bold: true, color: '1a1a1a' })
  s.addText(`(${component})`, { x: 0.8, y: 2.0, w: 8.4, h: 1.0, color: '94a3b8', fontSize: 14 })
}

/**
 * 将 slides 数组转换为 PPTX 二进制（Buffer）。
 * 浏览器环境下返回 Uint8Array，便于保存为 Blob。
 * @param {Array} slides
 * @param {{ theme?: 'light'|'dark', title?: string }} [options]
 */
export async function exportSlidesAsPptx(slides, options = {}) {
  const PptxGenJS = await loadPptxGenJS()
  const pres = new PptxGenJS()
  pres.title = options.title || 'WPX 演示文稿'
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 英寸，约 16:9

  const list = Array.isArray(slides) ? slides : []
  list.forEach((s) => slideToPptx(s, pres))

  const data = await pres.write({ outputType: 'arraybuffer' })
  return data // ArrayBuffer
}

/**
 * 在浏览器端下载导出的 PPTX。
 */
export async function downloadSlidesAsPptx(slides, options = {}) {
  const data = await exportSlidesAsPptx(slides, options)
  const filename = options.filename || `slides-${Date.now()}.pptx`
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  triggerDownload(blob, filename)
  return { ok: true, filename }
}

/* ───────── PDF 导出 ───────── */

/**
 * 把单张 slide 渲染成独立的可打印 HTML 页面字符串。
 * - 走 `@media print` 打印样式，每张幻灯片强制 16:9 横向分页
 * - 图表页使用可读的占位说明（PDF 静态打印无法触发 ECharts 动画，
 *   与 PPTX 保持一致的降级策略）
 *
 * @param {Array} slides
 * @param {{ theme?: 'light'|'dark', title?: string }} [options]
 * @returns {string} 完整 HTML 字符串
 */
function buildPrintableHtml(slides, options = {}) {
  const list = Array.isArray(slides) ? slides : []
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const docTitle = options.title || 'WPX 演示文稿'

  const slidesHtml = list.map((slide, idx) => {
    const component = String(slide?.component || 'TextSlide')
    const props = slide?.props || {}
    const esc = (v) => escapeHtml(v == null ? '' : v)
    const themeClass = props.theme === 'dark' ? 'is-dark' : ''
    const isPageBreak = idx > 0

    let body = ''
    switch (component) {
      case 'CoverSlide':
        body =
          `<h1 class="slide-title slide-title--cover">${esc(props.title || '未命名演示文稿')}</h1>` +
          (props.subtitle ? `<h2 class="slide-subtitle">${esc(props.subtitle)}</h2>` : '') +
          (props.author ? `<p class="slide-meta">${esc(props.author)}</p>` : '')
        break
      case 'EndSlide':
        body =
          `<h1 class="slide-title slide-title--cover">${esc(props.text || props.title || '感谢观看')}</h1>` +
          (props.subtitle ? `<h2 class="slide-subtitle">${esc(props.subtitle)}</h2>` : '') +
          (props.contactInfo?.website ? `<p class="slide-meta">${esc(props.contactInfo.website)}</p>` : '')
        break
      case 'TextSlide':
      case 'TocSlide': {
        const items = Array.isArray(props.bulletPoints)
          ? props.bulletPoints
          : Array.isArray(props.items) ? props.items : []
        body =
          `<h2 class="slide-title">${esc(props.title || '')}</h2>` +
          (items.length
            ? `<ul class="slide-bullets">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
            : '<p class="slide-empty">（暂无要点）</p>')
        break
      }
      case 'ImageTextSlide':
        body =
          `<h2 class="slide-title">${esc(props.title || '')}</h2>` +
          (props.imageUrl
            ? `<div class="slide-img-wrap"><img src="${esc(props.imageUrl)}" alt="${esc(props.title || '')}" /></div>`
            : '<div class="slide-placeholder">[图片占位]</div>') +
          (props.text ? `<p class="slide-text">${esc(props.text)}</p>` : '')
        break
      case 'ChartSlide': {
        const chartType = props.chartType || 'bar'
        body =
          `<h2 class="slide-title">${esc(props.title || '数据图表')}</h2>` +
          `<div class="slide-placeholder slide-placeholder--chart">[${esc(chartType)} 图表占位] PDF 静态导出</div>`
        break
      }
      case 'TableSlide': {
        const headers = Array.isArray(props.tableData?.headers) ? props.tableData.headers : []
        const rows = Array.isArray(props.tableData?.rows) ? props.tableData.rows : []
        if (headers.length) {
          const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`
          const tbody = rows
            .map((r) => `<tr>${(Array.isArray(r) ? r : []).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
            .join('')
          body =
            `<h2 class="slide-title">${esc(props.title || '')}</h2>` +
            `<table class="slide-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
        } else {
          body =
            `<h2 class="slide-title">${esc(props.title || '')}</h2>` +
            '<div class="slide-placeholder">[表格占位]</div>'
        }
        break
      }
      default:
        body = `<h2 class="slide-title">${esc(props.title || component)}</h2>`
    }

    const pageBreak = isPageBreak ? 'page-break-before' : ''
    return `<section class="slide-page ${themeClass} ${pageBreak}" data-component="${esc(component)}" data-index="${idx}">
  <div class="slide-stage">
    <div class="slide-content">
      ${body}
    </div>
    <div class="slide-footer"><span class="slide-footer-page">${idx + 1} / ${list.length}</span></div>
  </div>
</section>`
  }).join('\n')

  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(docTitle)}</title>
<style>
  /* 屏幕样式：保持可读 */
  :root {
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #475569;
    --accent: #7c3aed;
    --border: #e2e8f0;
    --card: #ffffff;
  }
  html[data-theme="dark"] {
    --bg: #0b1020;
    --fg: #f1f5f9;
    --muted: #94a3b8;
    --accent: #a78bfa;
    --border: #1e293b;
    --card: #0f172a;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', Inter, system-ui, sans-serif;
  }

  /* 每张幻灯片：屏幕下用 stack 展示，打印时按页输出 */
  .slide-page {
    width: min(960px, 95vw);
    aspect-ratio: 16 / 9;
    margin: 24px auto;
    background: var(--card);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 6px 32px rgba(15, 23, 42, 0.08);
    overflow: hidden;
    position: relative;
  }
  .slide-page.is-dark {
    --bg: #0b1020;
    --fg: #f1f5f9;
    --muted: #94a3b8;
    --accent: #a78bfa;
    --border: #1e293b;
    --card: #0f172a;
    background: var(--card);
    color: var(--fg);
  }
  .slide-stage {
    width: 100%;
    height: 100%;
    padding: 56px 64px 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .slide-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }
  .slide-footer {
    display: flex;
    justify-content: flex-end;
    color: var(--muted);
    font-size: 12px;
  }
  .slide-title {
    margin: 0;
    font-size: 2.4rem;
    line-height: 1.2;
    color: var(--fg);
  }
  .slide-title--cover {
    font-size: 3.2rem;
    background: linear-gradient(135deg, var(--accent), #ec4899);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-align: center;
    margin-top: auto;
    margin-bottom: auto;
  }
  .slide-subtitle {
    margin: 0;
    color: var(--muted);
    font-size: 1.25rem;
    font-weight: 400;
    text-align: center;
  }
  .slide-meta {
    margin: 0;
    color: var(--muted);
    font-size: 1rem;
    text-align: center;
  }
  .slide-bullets {
    margin: 0;
    padding-left: 1.4rem;
    line-height: 1.85;
    font-size: 1.15rem;
  }
  .slide-bullets li { margin-bottom: 8px; }
  .slide-empty {
    color: var(--muted);
    font-style: italic;
  }
  .slide-text {
    margin: 0;
    color: var(--fg);
    font-size: 1.05rem;
    line-height: 1.7;
  }
  .slide-img-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 12px 0;
    min-height: 40%;
  }
  .slide-img-wrap img {
    max-width: 80%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
  }
  .slide-placeholder {
    padding: 24px;
    border: 1px dashed var(--border);
    border-radius: 8px;
    color: var(--muted);
    text-align: center;
    font-size: 0.95rem;
  }
  .slide-placeholder--chart {
    background: rgba(124, 58, 237, 0.08);
    color: var(--accent);
  }
  .slide-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  .slide-table th,
  .slide-table td {
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
  }
  .slide-table th {
    background: rgba(124, 58, 237, 0.08);
    color: var(--accent);
    font-weight: 600;
  }

  /* 打印样式：横向 16:9，禁用屏幕阴影/边距 */
  @page {
    size: 13.33in 7.5in; /* LAYOUT_WIDE 对应尺寸 */
    margin: 0;
  }
  @media print {
    html, body {
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .slide-page {
      width: 13.33in;
      height: 7.5in;
      aspect-ratio: auto;
      margin: 0;
      border: none;
      border-radius: 0;
      box-shadow: none;
      page-break-after: always;
      break-after: page;
    }
    .slide-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .page-break-before {
      page-break-before: always;
      break-before: page;
    }
  }
</style>
</head>
<body>
${slidesHtml}
</body>
</html>`
}

/**
 * 在浏览器端通过隐藏 iframe + window.print() 触发打印。
 * 用户可在打印对话框选择「另存为 PDF」。
 *
 * @param {string} html
 * @param {{ autoPrint?: boolean, onClose?: () => void }} [options]
 * @returns {HTMLIFrameElement} 用于清理
 */
function openPrintableIframe(html, options = {}) {
  const { autoPrint = true, onClose } = options
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  iframe.title = 'wpx-slide-print'

  const cleanup = () => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    } catch {
      /* noop */
    }
    if (typeof onClose === 'function') {
      try {
        onClose()
      } catch {
        /* noop */
      }
    }
  }

  // afterprint 事件：Chromium / Firefox / WebKit 均支持
  iframe.addEventListener('load', () => {
    try {
      const win = iframe.contentWindow
      if (!win) {
        cleanup()
        return
      }
      win.addEventListener('afterprint', cleanup, { once: true })
      if (autoPrint) {
        // 等一帧让样式稳定，再触发打印
        setTimeout(() => {
          try {
            win.focus()
            win.print()
          } catch (err) {
            console.error('[slideExport] window.print 触发失败', err)
            cleanup()
          }
        }, 50)
      }
    } catch (err) {
      console.error('[slideExport] iframe load 处理失败', err)
      cleanup()
    }
  })

  document.body.appendChild(iframe)
  // srcdoc 可避免 blob URL 泄漏；某些旧浏览器不支持时回退 doc.write
  try {
    iframe.srcdoc = html
  } catch {
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    } else {
      cleanup()
    }
  }
  return iframe
}

/**
 * 触发 PDF 导出。
 *
 * 浏览器环境下打开隐藏 iframe 并调用 window.print()，
 * 由用户选择在打印对话框中「另存为 PDF」。
 *
 * @param {Array} slides
 * @param {{ theme?: 'light'|'dark', title?: string, filename?: string, autoPrint?: boolean }} [options]
 * @returns {{ ok: boolean, filename: string, method: 'browser-print' }}
 */
export function exportSlidesAsPdf(slides, options = {}) {
  const list = Array.isArray(slides) ? slides : []
  if (list.length === 0) {
    return { ok: false, filename: '', error: '没有可导出的幻灯片' }
  }
  const filename = options.filename || `slides-${Date.now()}.pdf`
  const html = buildPrintableHtml(list, options)
  const autoPrint = options.autoPrint !== false

  // SSR / 非浏览器环境：直接返回 HTML，由调用方决定如何处理
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      ok: true,
      filename,
      method: 'html-only',
      html,
      size: html.length,
    }
  }

  // 用户主动关闭了 autoPrint：返回可打印 HTML 字符串，不触发打印对话框
  if (!autoPrint) {
    return {
      ok: true,
      filename,
      method: 'html-only',
      html,
      size: html.length,
    }
  }

  openPrintableIframe(html, { autoPrint: true })
  return { ok: true, filename, method: 'browser-print' }
}

/**
 * 在浏览器端触发 PDF 导出（同 exportSlidesAsPdf，保留旧 API 命名）。
 * @param {Array} slides
 * @param {{ theme?: 'light'|'dark', filename?: string, title?: string, autoPrint?: boolean }} [options]
 */
export function downloadSlidesAsPdf(slides, options = {}) {
  return exportSlidesAsPdf(slides, options)
}