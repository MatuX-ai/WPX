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