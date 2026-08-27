import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  buildDocumentEditPrompt,
  parseDocumentEditResponse,
  normalizeDocumentEditPayload,
  truncateDocumentMarkdown,
  resolveFillLabelRange,
  applyDocumentEdits,
  tryApplyDocumentEditFromResponse,
  looksLikeDocumentEditIntent,
  createAssistantSyncTracker,
  getAssistantSyncFingerprint,
  resolveDocumentEditSync,
} from '@/utils/aiDocumentEdit'

function makeEditor(content) {
  return new Editor({
    extensions: [StarterKit],
    content,
  })
}

describe('looksLikeDocumentEditIntent', () => {
  it('表单填写类指令应命中', () => {
    expect(looksLikeDocumentEditIntent('邮箱那里写 1055603323@qq.com')).toBe(true)
    expect(looksLikeDocumentEditIntent('把第三段改成简洁版')).toBe(true)
  })

  it('寒暄不应命中', () => {
    expect(looksLikeDocumentEditIntent('你好')).toBe(false)
    expect(looksLikeDocumentEditIntent('谢谢')).toBe(false)
  })
})

describe('resolveDocumentEditSync', () => {
  let editor
  let syncTracker

  beforeEach(() => {
    editor = makeEditor('<p>邮箱：</p>')
    syncTracker = createAssistantSyncTracker()
  })

  afterEach(() => {
    editor?.destroy()
  })

  it('编辑意图 + document_edit 应应用且仅应用一次', () => {
    const raw =
      '{"type":"document_edit","edits":[{"anchor":"邮箱","text":"a@b.com","strategy":"fill_label"}],"summary":"已填入邮箱"}'
    const lastAssistant = { id: 'assistant-1' }

    const first = resolveDocumentEditSync({
      rawContent: raw,
      userText: '邮箱那里写 a@b.com',
      editor,
      syncTracker,
      lastAssistant,
    })
    const second = resolveDocumentEditSync({
      rawContent: raw,
      userText: '邮箱那里写 a@b.com',
      editor,
      syncTracker,
      lastAssistant,
    })

    expect(first.status).toBe('synced')
    expect(first.applied).toBe(1)
    expect(second.status).toBe('duplicate')
    expect(editor.state.doc.textContent.match(/a@b.com/g)).toHaveLength(1)
  })

  it('非编辑意图应跳过', () => {
    const result = resolveDocumentEditSync({
      rawContent: '{"type":"chat","message":"你好，我是助手"}',
      userText: '你好',
      editor,
      syncTracker,
      lastAssistant: { id: 'assistant-2' },
    })
    expect(result.status).toBe('skipped')
    expect(editor.state.doc.textContent).not.toContain('助手')
  })
})

describe('getAssistantSyncFingerprint', () => {
  it('优先使用 assistant id', () => {
    expect(getAssistantSyncFingerprint({ id: 'a-1' }, 'content')).toBe('id:a-1')
  })
})

describe('truncateDocumentMarkdown', () => {
  it('短文档不截断', () => {
    expect(truncateDocumentMarkdown('姓名：张三', 100)).toBe('姓名：张三')
  })

  it('超长文档保留头尾并注明省略', () => {
    const long = 'a'.repeat(5000)
    const result = truncateDocumentMarkdown(long, 100)
    expect(result).toContain('中间省略')
    expect(result.length).toBeLessThan(long.length)
  })
})

describe('buildDocumentEditPrompt', () => {
  it('应包含用户指令与文档全文', () => {
    const prompt = buildDocumentEditPrompt('邮箱写 test@qq.com', '姓名：\n邮箱：')
    expect(prompt).toContain('邮箱写 test@qq.com')
    expect(prompt).toContain('姓名：')
    expect(prompt).toContain('"type": "document_edit"')
  })
})

describe('parseDocumentEditResponse', () => {
  it('解析 json 代码块中的 document_edit', () => {
    const raw = '```json\n{"type":"document_edit","edits":[{"anchor":"邮箱","text":"a@b.com","strategy":"fill_label"}],"summary":"已填入"}\n```'
    const parsed = parseDocumentEditResponse(raw)
    expect(parsed?.type).toBe('document_edit')
    expect(parsed?.edits).toHaveLength(1)
    expect(parsed?.summary).toBe('已填入')
  })

  it('解析 chat 类型', () => {
    const parsed = parseDocumentEditResponse('{"type":"chat","message":"这是解释"}')
    expect(parsed).toEqual({ type: 'chat', message: '这是解释' })
  })

  it('普通文本返回 null', () => {
    expect(parseDocumentEditResponse('请提供更多信息')).toBeNull()
  })
})

describe('normalizeDocumentEditPayload', () => {
  it('非法 strategy 回退 fill_label', () => {
    const normalized = normalizeDocumentEditPayload({
      type: 'document_edit',
      edits: [{ anchor: '邮箱', text: 'x', strategy: 'unknown' }],
    })
    expect(normalized?.edits?.[0]?.strategy).toBe('fill_label')
  })
})

describe('applyDocumentEdits', () => {
  let editor

  beforeEach(() => {
    editor = makeEditor('<p>姓名：张三</p><p>邮箱：</p>')
  })

  afterEach(() => {
    editor?.destroy()
  })

  it('fill_label 应在标签后写入内容', () => {
    const result = applyDocumentEdits(editor, [
      { anchor: '邮箱', text: '1055603323@qq.com', strategy: 'fill_label' },
    ])
    expect(result.applied).toBe(1)
    expect(editor.state.doc.textContent).toContain('1055603323@qq.com')
  })

  it('replace_match 应替换 anchor 文本', () => {
    editor.commands.setContent('<p>非常厉害</p>')
    const result = applyDocumentEdits(editor, [
      { anchor: '非常', text: '极其', strategy: 'replace_match' },
    ])
    expect(result.applied).toBe(1)
    expect(editor.state.doc.textContent).toContain('极其厉害')
  })

  it('定位失败时记录 failures', () => {
    const result = applyDocumentEdits(editor, [
      { anchor: '不存在的字段', text: 'x', strategy: 'fill_label' },
    ])
    expect(result.applied).toBe(0)
    expect(result.failures[0]).toContain('未能定位')
  })
})

describe('resolveFillLabelRange', () => {
  let editor

  beforeEach(() => {
    editor = makeEditor('<p>邮箱：旧地址</p>')
  })

  afterEach(() => {
    editor?.destroy()
  })

  it('应覆盖标签后同一行内容', () => {
    const range = resolveFillLabelRange(editor, '邮箱')
    expect(range).not.toBeNull()
    const replaced = editor.state.doc.textBetween(range.from, range.to, '')
    expect(replaced).toBe('旧地址')
  })
})

describe('tryApplyDocumentEditFromResponse', () => {
  let editor

  beforeEach(() => {
    editor = makeEditor('<p>邮箱：</p>')
  })

  afterEach(() => {
    editor?.destroy()
  })

  it('应用 document_edit 并返回 summary', () => {
    const raw =
      '{"type":"document_edit","edits":[{"anchor":"邮箱","text":"a@b.com","strategy":"fill_label"}],"summary":"已在邮箱处填入"}'
    const result = tryApplyDocumentEditFromResponse(raw, editor)
    expect(result.kind).toBe('edit')
    expect(result.message).toContain('已在邮箱处填入')
    expect(result.applied).toBe(1)
  })

  it('chat 类型不改文档', () => {
    const result = tryApplyDocumentEditFromResponse('{"type":"chat","message":"请先选中"}', editor)
    expect(result.kind).toBe('chat')
    expect(result.message).toBe('请先选中')
    expect(editor.state.doc.textContent).not.toContain('请先选中')
  })
})
