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

const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)(?:\s*\([^)]*\))?$/
const HR_LINE_RE = /^(-{3,}|\*{3,}|_{3,})$/

function renderImageHtml(alt, src) {
  const safeSrc = escapeAttr(src.trim())
  const safeAlt = escapeAttr(alt)
  return (
    `<img src="${safeSrc}" alt="${safeAlt}" class="editor-image" ` +
    `data-align="left" data-float="left" />`
  )
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

  for (const line of lines) {
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

    const imageMatch = trimmed.match(IMAGE_LINE_RE)
    if (imageMatch) {
      html.push(renderImageHtml(imageMatch[1], imageMatch[2]))
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
