export function stripFrontmatter(markdown) {
  const text = String(markdown || '').replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return text

  const match = text.match(/^---\s*\n[\s\S]*?\n---\s*\n?/)
  if (!match) return text
  return text.slice(match[0].length)
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/'/g, '&#39;')
}

function applyInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

// 识别行尾尺寸后缀： (1280×720) / (1280x720)
const DIM_SUFFIX_RE = /\s+\(\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\)$/
// 图片行核心正则：alt 可含 \]、url 可含任意字符（含 ( )）
const IMAGE_LINE_RE = /^!\[((?:\\.|[^\]\\])*)\]\((.+)\)$/
const HR_LINE_RE = /^(-{3,}|\*{3,}|_{3,})$/
// Markdown 表格行：允许前导/尾部 | 与空白
const TABLE_LINE_RE = /^\s*\|?\s*([^|]+?(\|[^|]+?)+)\s*\|?\s*$/
// 表格分隔行：| --- | :---: | ---: |
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/

function splitTableCells(line) {
  // 去掉首尾 |，再按 | 拆分；trim 每格
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function renderTableHtml(tableLines) {
  // tableLines 形如：[header, row1, row2, ...]
  // 注意：检测时只取了 separator 判断类型，不会加入 tableLines
  const header = splitTableCells(tableLines[0])
  const bodyRows = tableLines.slice(1).map(splitTableCells)
  const out = ['<table><thead><tr>']
  for (const cell of header) {
    out.push(`<th>${applyInlineMarkdown(cell)}</th>`)
  }
  out.push('</tr></thead><tbody>')
  for (const row of bodyRows) {
    out.push('<tr>')
    for (const cell of row) {
      out.push(`<td>${applyInlineMarkdown(cell)}</td>`)
    }
    out.push('</tr>')
  }
  out.push('</tbody></table>')
  return out.join('')
}

function renderImageHtml(alt, src) {
  // 去掉上游 markdown 里的反斜杠转义（\( \) \[ \] \\）
  const cleanedSrc = String(src).trim().replace(/\\(.)/g, '$1')
  const cleanedAlt = String(alt).replace(/\\(.)/g, '$1')
  const safeSrc = escapeAttr(cleanedSrc)
  const safeAlt = escapeAttr(cleanedAlt)
  return (
    `<img src="${safeSrc}" alt="${safeAlt}" class="editor-image" ` +
    `data-align="left" data-float="left" />`
  )
}

function tryParseImageLine(line) {
  const stripped = line.replace(DIM_SUFFIX_RE, '')
  const m = stripped.match(IMAGE_LINE_RE)
  if (!m) return null
  return { alt: m[1], src: m[2] }
}

export function markdownToHtml(markdown) {
  const body = stripFrontmatter(markdown)
  const lines = body.split('\n')
  const html = []
  let inCode = false
  let codeLines = []

  function flushCode() {
    if (!codeLines.length) return
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) continue

    // Markdown 表格识别：表头 + 分隔行 + 至少 1 个数据行
    if (
      TABLE_LINE_RE.test(trimmed) &&
      i + 1 < lines.length &&
      TABLE_SEP_RE.test(lines[i + 1].trim())
    ) {
      const tableLines = [trimmed]
      let j = i + 2
      while (j < lines.length && TABLE_LINE_RE.test(lines[j].trim())) {
        tableLines.push(lines[j].trim())
        j++
      }
      html.push(renderTableHtml(tableLines))
      i = j - 1 // for 会 +1，跳过已消费的行
      continue
    }

    const imageMatch = tryParseImageLine(trimmed)
    if (imageMatch) {
      html.push(renderImageHtml(imageMatch.alt, imageMatch.src))
      continue
    }

    if (HR_LINE_RE.test(trimmed)) {
      html.push('<hr />')
      continue
    }

    if (trimmed.startsWith('### ')) {
      html.push(`<h3>${applyInlineMarkdown(trimmed.slice(4))}</h3>`)
    } else if (trimmed.startsWith('## ')) {
      html.push(`<h2>${applyInlineMarkdown(trimmed.slice(3))}</h2>`)
    } else if (trimmed.startsWith('# ')) {
      html.push(`<h1>${applyInlineMarkdown(trimmed.slice(2))}</h1>`)
    } else if (trimmed.startsWith('- ')) {
      html.push(`<ul><li>${applyInlineMarkdown(trimmed.slice(2))}</li></ul>`)
    } else if (trimmed.startsWith('> ')) {
      html.push(`<blockquote><p>${applyInlineMarkdown(trimmed.slice(2))}</p></blockquote>`)
    } else {
      html.push(`<p>${applyInlineMarkdown(trimmed)}</p>`)
    }
  }

  flushCode()
  return html.join('') || '<p></p>'
}
