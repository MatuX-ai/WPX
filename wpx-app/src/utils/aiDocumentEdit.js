import { findNextMatch } from '@/utils/editorFindReplace'
import { getActiveEditor } from '@/composables/useEditorRegistry'
import { tiptapJsonToMarkdown } from '@/utils/tiptapToMarkdown'

/** 发给模型的文档全文上限（字符） */
export const DOCUMENT_EDIT_MAX_CHARS = 8000

/** @type {RegExp[]} */
const DOCUMENT_EDIT_INTENT_PATTERNS = [
  /写[：:为到]?/,
  /填[入写]?/,
  /改[成为到]?/,
  /替换/,
  /换成/,
  /修改/,
  /更新/,
  /删除/,
  /插入/,
  /添加/,
  /那里|这边|这一行|这段|此处/,
  /邮箱|姓名|电话|手机|地址|单位|职位|标题/,
]

/** @type {RegExp[]} */
const DOCUMENT_EDIT_CHITCHAT_PATTERNS = [
  /^你好[!！.?？]*$/i,
  /^hi[!！.?？]*$/i,
  /^hello[!！.?？]*$/i,
  /^在吗[!！.?？]*$/,
  /^谢谢[!！.?？]*$/,
  /^感谢[!！.?？]*$/,
]

/**
 * 判断用户输入是否像「要在文档里改一处」的指令（P1 意图门控）。
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeDocumentEditIntent(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (DOCUMENT_EDIT_CHITCHAT_PATTERNS.some((pattern) => pattern.test(value))) return false
  return DOCUMENT_EDIT_INTENT_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * @returns {{ reset: () => void, has: (fingerprint: string) => boolean, add: (fingerprint: string) => void }}
 */
export function createAssistantSyncTracker() {
  /** @type {Set<string>} */
  const synced = new Set()
  return {
    reset() {
      synced.clear()
    },
    has(fingerprint) {
      return synced.has(fingerprint)
    },
    add(fingerprint) {
      synced.add(fingerprint)
    },
  }
}

/**
 * @param {{ id?: string } | null | undefined} lastAssistant
 * @param {string} rawContent
 * @returns {string}
 */
export function getAssistantSyncFingerprint(lastAssistant, rawContent) {
  if (lastAssistant?.id) return `id:${lastAssistant.id}`
  return `content:${rawContent}`
}

/**
 * @typedef {'fill_label' | 'replace_match' | 'insert_after'} AiEditStrategy
 */

/**
 * @typedef {Object} AiDocumentEdit
 * @property {string} anchor
 * @property {string} text
 * @property {AiEditStrategy} [strategy]
 */

/**
 * @typedef {Object} AiDocumentEditResponse
 * @property {'document_edit' | 'chat'} type
 * @property {AiDocumentEdit[]} [edits]
 * @property {string} [summary]
 * @property {string} [message]
 */

/**
 * @param {string} markdown
 * @param {number} [maxChars]
 * @returns {string}
 */
export function truncateDocumentMarkdown(markdown, maxChars = DOCUMENT_EDIT_MAX_CHARS) {
  const source = typeof markdown === 'string' ? markdown : ''
  if (source.length <= maxChars) return source

  const omitted = source.length - maxChars
  const ellipsis = `\n\n…（中间省略 ${omitted} 字）…\n\n`
  const budget = maxChars - ellipsis.length
  if (budget <= 0) return source.slice(0, maxChars)

  const head = Math.floor(budget * 0.7)
  const tail = budget - head
  return `${source.slice(0, head)}${ellipsis}${source.slice(-tail)}`
}

/**
 * @returns {string}
 */
export function getActiveDocumentMarkdown() {
  const editor = getActiveEditor()
  if (!editor) return ''
  try {
    return tiptapJsonToMarkdown(editor.getJSON())
  } catch {
    return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
  }
}

/**
 * 无选区时：附带文档全文，要求模型返回结构化 edit JSON。
 * @param {string} userMessage
 * @param {string} documentMarkdown
 * @returns {string}
 */
export function buildDocumentEditPrompt(userMessage, documentMarkdown) {
  const doc = truncateDocumentMarkdown(documentMarkdown)

  return `用户指令：${userMessage}

【当前文档全文】
${doc || '（文档为空）'}

请理解用户意图，在文档中定位需要修改的位置，并仅输出 JSON（可放在 \`\`\`json 代码块内，不要输出其它解释文字）。

若需要在文档中修改，输出：
\`\`\`json
{
  "type": "document_edit",
  "edits": [
    { "anchor": "定位用的原文片段", "text": "要写入的内容", "strategy": "fill_label" }
  ],
  "summary": "面向用户的一行说明，如：已在「邮箱」处填入 xxx@qq.com"
}
\`\`\`

strategy 说明：
- fill_label：在标签（如「邮箱」「姓名」）后的同一行填入 text（适合表单字段）
- replace_match：将 anchor 首次匹配到的文本替换为 text
- insert_after：在 anchor 之后插入 text

若仅需回答问题、无法定位或不应修改文档，输出：
\`\`\`json
{ "type": "chat", "message": "你的回复" }
\`\`\`

不要输出 JSON 以外的内容。`
}

/**
 * @param {unknown} value
 * @returns {AiDocumentEditResponse | null}
 */
export function normalizeDocumentEditPayload(value) {
  if (!value || typeof value !== 'object') return null
  const type = value.type
  if (type === 'chat') {
    const message = typeof value.message === 'string' ? value.message.trim() : ''
    return message ? { type: 'chat', message } : null
  }
  if (type !== 'document_edit') return null

  const edits = Array.isArray(value.edits)
    ? value.edits
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const anchor = typeof item.anchor === 'string' ? item.anchor.trim() : ''
          const text = typeof item.text === 'string' ? item.text : String(item.text ?? '')
          if (!anchor) return null
          const strategy = item.strategy
          const allowed = ['fill_label', 'replace_match', 'insert_after']
          return {
            anchor,
            text,
            strategy: allowed.includes(strategy) ? strategy : 'fill_label',
          }
        })
        .filter(Boolean)
    : []

  if (!edits.length) return null

  const summary = typeof value.summary === 'string' ? value.summary.trim() : ''
  return {
    type: 'document_edit',
    edits,
    summary,
  }
}

/**
 * @param {string} text
 * @returns {AiDocumentEditResponse | null}
 */
export function parseDocumentEditResponse(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = fenced ? [fenced[1].trim(), trimmed] : [trimmed]

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      const normalized = normalizeDocumentEditPayload(parsed)
      if (normalized) return normalized
    } catch {
      // try next candidate
    }
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return normalizeDocumentEditPayload(JSON.parse(trimmed))
    } catch {
      return null
    }
  }

  return null
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} anchor
 * @returns {{ from: number, to: number, variant: string } | null}
 */
export function findAnchorRange(editor, anchor) {
  if (!editor || !anchor) return null

  const variants = [`${anchor}：`, `${anchor}:`, anchor]
  for (const variant of variants) {
    const match = findNextMatch(editor, variant, { caseSensitive: false })
    if (match) {
      return { ...match, variant }
    }
  }
  return null
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} anchor
 * @returns {{ from: number, to: number } | null}
 */
export function resolveFillLabelRange(editor, anchor) {
  const match = findAnchorRange(editor, anchor)
  if (!match) return null

  const doc = editor.state.doc
  let pos = match.to

  while (pos < doc.content.size) {
    const ch = doc.textBetween(pos, pos + 1, '')
    if (ch === '：' || ch === ':' || ch === ' ' || ch === '\t') {
      pos += 1
      continue
    }
    break
  }

  let lineEnd = pos
  while (lineEnd < doc.content.size) {
    const ch = doc.textBetween(lineEnd, lineEnd + 1, '')
    if (ch === '\n') break
    lineEnd += 1
  }

  return { from: pos, to: lineEnd }
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {AiDocumentEdit} edit
 * @returns {{ from: number, to: number } | null}
 */
export function resolveEditRange(editor, edit) {
  if (!editor || !edit?.anchor) return null

  const strategy = edit.strategy || 'fill_label'

  if (strategy === 'fill_label') {
    return resolveFillLabelRange(editor, edit.anchor)
  }

  if (strategy === 'replace_match') {
    const match = findNextMatch(editor, edit.anchor, { caseSensitive: false })
    return match ? { from: match.from, to: match.to } : null
  }

  if (strategy === 'insert_after') {
    const match = findAnchorRange(editor, edit.anchor)
    return match ? { from: match.to, to: match.to } : null
  }

  return null
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {AiDocumentEdit[]} edits
 * @returns {{ applied: number, failures: string[], summary: string }}
 */
export function applyDocumentEdits(editor, edits) {
  if (!editor || !Array.isArray(edits) || edits.length === 0) {
    return { applied: 0, failures: ['无有效编辑操作'], summary: '' }
  }

  /** @type {string[]} */
  const failures = []
  let applied = 0

  for (const edit of edits) {
    const range = resolveEditRange(editor, edit)
    if (!range) {
      failures.push(`未能定位：${edit.anchor}`)
      continue
    }

    editor
      .chain()
      .focus()
      .insertContentAt({ from: range.from, to: range.to }, edit.text || '')
      .run()

    applied += 1
  }

  const summary =
    applied > 0
      ? edits.length === 1 && edits[0]?.anchor
        ? `已在「${edits[0].anchor}」处更新内容`
        : `已应用 ${applied} 处修改`
      : ''

  return { applied, failures, summary }
}

/**
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {AiDocumentEditResponse} response
 * @returns {{ ok: boolean, message: string, applied?: number }}
 */
export function applyDocumentEditResponse(editor, response) {
  if (!response) {
    return { ok: false, message: '无法解析 AI 修订响应' }
  }

  if (response.type === 'chat') {
    return { ok: true, message: response.message || '' }
  }

  if (!editor) {
    return { ok: false, message: '编辑器未就绪，无法应用修改' }
  }

  const result = applyDocumentEdits(editor, response.edits || [])
  const summary = response.summary || result.summary

  if (result.applied > 0) {
    const detail = result.failures.length ? `\n${result.failures.join('\n')}` : ''
    return {
      ok: true,
      message: `${summary || result.summary}${detail}`.trim(),
      applied: result.applied,
    }
  }

  return {
    ok: false,
    message: result.failures.join('；') || summary || '未能应用修改',
  }
}

/**
 * 无选区 + 编辑意图：解析 assistant 回复并应用 document_edit（含去重）。
 * @param {{
 *   rawContent: string,
 *   userText: string,
 *   editor?: import('@tiptap/core').Editor | null,
 *   syncTracker: ReturnType<typeof createAssistantSyncTracker>,
 *   lastAssistant?: { id?: string } | null,
 * }} options
 * @returns {{
 *   status: 'duplicate' | 'skipped' | 'none' | 'synced',
 *   kind?: 'edit' | 'chat',
 *   message?: string,
 *   applied?: number,
 *   documentEditApplied?: boolean,
 *   documentEditFailed?: boolean,
 * }}
 */
export function resolveDocumentEditSync(options) {
  const { rawContent, userText, editor, syncTracker, lastAssistant } = options
  const fingerprint = getAssistantSyncFingerprint(lastAssistant, rawContent)

  if (syncTracker.has(fingerprint)) {
    return { status: 'duplicate' }
  }

  if (!looksLikeDocumentEditIntent(userText)) {
    return { status: 'skipped' }
  }

  const editOutcome = tryApplyDocumentEditFromResponse(rawContent, editor)
  if (editOutcome.kind !== 'edit' && editOutcome.kind !== 'chat') {
    return { status: 'none' }
  }

  if (!editOutcome.message) {
    return { status: 'none' }
  }

  syncTracker.add(fingerprint)

  return {
    status: 'synced',
    kind: editOutcome.kind,
    message: editOutcome.message,
    applied: editOutcome.applied,
    documentEditApplied: editOutcome.kind === 'edit' && (editOutcome.applied ?? 0) > 0,
    documentEditFailed: editOutcome.kind === 'edit' && !(editOutcome.applied ?? 0),
  }
}

/**
 * 尝试从 AI 原始回复中提取并应用 document_edit。
 * @param {string} rawText
 * @param {import('@tiptap/core').Editor | null | undefined} [editor]
 * @returns {{ kind: 'edit' | 'chat' | 'none', message: string, applied?: number }}
 */
export function tryApplyDocumentEditFromResponse(rawText, editor = getActiveEditor()) {
  const parsed = parseDocumentEditResponse(rawText)
  if (!parsed) return { kind: 'none', message: '' }

  if (parsed.type === 'chat') {
    return { kind: 'chat', message: parsed.message || '' }
  }

  const outcome = applyDocumentEditResponse(editor, parsed)
  if (outcome.applied && outcome.applied > 0) {
    return { kind: 'edit', message: outcome.message, applied: outcome.applied }
  }

  if (parsed.type === 'document_edit' && outcome.message) {
    return { kind: 'edit', message: outcome.message, applied: 0 }
  }

  return { kind: 'none', message: '' }
}
