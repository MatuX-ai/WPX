function applyMarks(text, marks = []) {
  let result = text
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`
        break
      case 'italic':
        result = `*${result}*`
        break
      case 'code':
        result = `\`${result}\``
        break
      case 'strike':
        result = `~~${result}~~`
        break
      case 'link':
        result = `[${result}](${mark.attrs?.href || ''})`
        break
      default:
        break
    }
  }
  return result
}

function serializeInline(node) {
  if (node.type === 'text') {
    return applyMarks(node.text || '', node.marks)
  }
  if (node.type === 'hardBreak') {
    return '\n'
  }
  if (node.content) {
    return node.content.map(serializeInline).join('')
  }
  return ''
}

function serializeBlock(node) {
  if (!node) return ''

  switch (node.type) {
    case 'doc':
      return node.content?.map(serializeBlock).join('').trimEnd()
    case 'paragraph':
      return `${serializeChildren(node)}\n\n`
    case 'heading': {
      const level = node.attrs?.level || 1
      return `${'#'.repeat(level)} ${serializeChildren(node).trim()}\n\n`
    }
    case 'bulletList':
      return node.content?.map((item) => serializeListItem(item, '- ')).join('') + '\n'
    case 'orderedList': {
      let index = node.attrs?.start || 1
      return (
        node.content
          ?.map((item) => {
            const line = serializeListItem(item, `${index}. `)
            index += 1
            return line
          })
          .join('') + '\n'
      )
    }
    case 'listItem':
      return serializeChildren(node)
    case 'blockquote':
      return (
        serializeChildren(node)
          .trimEnd()
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n') + '\n\n'
      )
    case 'codeBlock': {
      const lang = node.attrs?.language || ''
      const code = node.content?.map((n) => n.text || '').join('') || ''
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`
    }
    case 'horizontalRule':
      return '---\n\n'
    case 'image': {
      const alt = node.attrs?.alt || ''
      const src = node.attrs?.src || ''
      return `![${alt}](${src})\n\n`
    }
    case 'table':
      return serializeMarkdownTable(node)
    case 'tableRow':
    case 'tableCell':
    case 'tableHeader':
      return serializeChildren(node)
    default:
      return serializeChildren(node)
  }
}

function serializeChildren(node) {
  if (!node.content) return ''
  return node.content.map((child) => {
    if (child.type === 'text' || child.type === 'hardBreak') {
      return serializeInline(child)
    }
    return serializeBlock(child)
  }).join('')
}

function serializeListItem(item, prefix) {
  const lines = []
  let body = ''

  for (const child of item.content || []) {
    if (child.type === 'paragraph') {
      body += serializeChildren(child)
    } else {
      body += serializeBlock(child)
    }
  }

  const contentLines = body.trimEnd().split('\n')
  lines.push(`${prefix}${contentLines[0] || ''}`)
  for (let i = 1; i < contentLines.length; i += 1) {
    lines.push(`  ${contentLines[i]}`)
  }
  return `${lines.join('\n')}\n`
}

function serializeMarkdownTable(tableNode) {
  const rows = []

  for (const rowNode of tableNode.content || []) {
    const cells = []
    for (const cellNode of rowNode.content || []) {
      const text = serializeChildren(cellNode).trim().replace(/\n+/g, ' ')
      cells.push(text)
    }
    if (cells.length) rows.push(cells)
  }

  if (!rows.length) return ''

  const columnCount = Math.max(...rows.map((row) => row.length))
  const normalized = rows.map((row) => {
    const copy = [...row]
    while (copy.length < columnCount) copy.push('')
    return copy
  })

  const header = normalized[0]
  const separator = `| ${header.map(() => '---').join(' | ')} |`
  const body = normalized.map((row) => `| ${row.join(' | ')} |`)

  if (body.length === 1) {
    return `${body[0]}\n${separator}\n\n`
  }

  return `${body[0]}\n${separator}\n${body.slice(1).join('\n')}\n\n`
}

export function tiptapJsonToMarkdown(json) {
  if (!json) return ''
  return serializeBlock(json).trimEnd()
}
