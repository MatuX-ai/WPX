export function buildSelectionPrompt(userMessage, selectedText) {
  return `用户指令：${userMessage}

【选中文本】
${selectedText}

请直接输出修改后的文本，不要添加解释、引号或 markdown 代码块。`
}

export function extractReplacementText(text) {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:[\w-]*\n)?([\s\S]*?)```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

export function toEditorContent(text) {
  const lines = text.split('\n')

  if (lines.length === 1) {
    return text
  }

  return lines.map((line) => ({
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line }] : [],
  }))
}
