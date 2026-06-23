/**
 * Plain-text find/replace helpers for TipTap documents.
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} query
 * @param {{ caseSensitive?: boolean, from?: number }} [options]
 * @returns {{ from: number, to: number } | null}
 */
export function findNextMatch(editor, query, options = {}) {
  if (!editor || !query) return null

  const doc = editor.state.doc
  const caseSensitive = Boolean(options.caseSensitive)
  const needle = caseSensitive ? query : query.toLowerCase()
  const startPos = Math.max(0, options.from ?? editor.state.selection.to)

  let match = null

  doc.nodesBetween(startPos, doc.content.size, (node, pos) => {
    if (match || !node.isText || !node.text) return

    const haystack = caseSensitive ? node.text : node.text.toLowerCase()
    const index = haystack.indexOf(needle)

    if (index >= 0) {
      match = {
        from: pos + index,
        to: pos + index + query.length,
      }
      return false
    }
  })

  if (match) return match

  doc.nodesBetween(0, startPos, (node, pos) => {
    if (match || !node.isText || !node.text) return

    const haystack = caseSensitive ? node.text : node.text.toLowerCase()
    const index = haystack.indexOf(needle)

    if (index >= 0) {
      match = {
        from: pos + index,
        to: pos + index + query.length,
      }
      return false
    }
  })

  return match
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ query: string, replacement: string, caseSensitive?: boolean }} payload
 * @returns {boolean}
 */
export function replaceCurrentSelection(editor, payload) {
  const { query, replacement, caseSensitive } = payload
  const { from, to } = editor.state.selection
  const selected = editor.state.doc.textBetween(from, to, '')

  const matches = caseSensitive
    ? selected === query
    : selected.toLowerCase() === query.toLowerCase()

  if (!matches) return false

  editor.chain().focus().insertContentAt({ from, to }, replacement).run()
  return true
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ query: string, replacement: string, caseSensitive?: boolean }} payload
 * @returns {number}
 */
export function replaceAllMatches(editor, payload) {
  const { query, replacement, caseSensitive } = payload
  if (!query) return 0

  const fullText = editor.getText()
  const flags = caseSensitive ? 'g' : 'gi'
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, flags)
  const nextText = fullText.replace(regex, replacement)
  const count = (fullText.match(regex) || []).length

  if (count === 0) return 0

  editor.commands.setContent(nextText)
  return count
}
