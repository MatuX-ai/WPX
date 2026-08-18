/**
 * sseParser —— OpenAI SSE 流解析（M4 打磨）
 *
 * 网关 /api/hermes/stream（透传 /v1/chat/completions stream:true）返回
 * text/event-stream：每行 `data: {...}`，结束标记 `data: [DONE]`。
 *
 * createSseParser 按块消费（fetch ReadableStream reader.read() 的 Uint8Array/String），
 * 自动跨块拼接不完整行，并把解析结果回调给调用方。
 */
/** 将 Uint8Array 解码为字符串（兼容 fetch body chunk；跨 realm 用 byteLength 判定，避免 instanceof 失效） */
export function decodeChunk(chunk) {
  if (typeof chunk === 'string') return chunk
  if (
    chunk &&
    typeof chunk === 'object' &&
    typeof chunk.length === 'number' &&
    typeof chunk.byteLength === 'number'
  ) {
    return new TextDecoder().decode(chunk)
  }
  return String(chunk ?? '')
}

/**
 * 从 OpenAI chat.completions SSE data 事件中提取增量文本
 * @param {any} data JSON.parse 后的 data 载荷
 * @returns {string} delta.content（可能为空串）
 */
export function extractDeltaText(data) {
  if (!data || typeof data !== 'object') return ''
  return String(data.choices?.[0]?.delta?.content ?? '')
}

/**
 * 创建按块消费的 SSE 解析器
 * @param {(event: { type: 'data', data: any } | { type: 'done' } | { type: 'error', message: string }) => void} onEvent
 * @returns {(chunk: string | Uint8Array) => void}
 */
export function createSseParser(onEvent) {
  let buffer = ''

  return function push(chunk) {
    buffer += decodeChunk(chunk)
    const lines = buffer.split(/\r?\n/)
    // 最后一段可能是不完整行，留待下个 chunk
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      if (payload === '[DONE]') {
        onEvent({ type: 'done' })
        continue
      }
      try {
        onEvent({ type: 'data', data: JSON.parse(payload) })
      } catch {
        onEvent({ type: 'error', message: 'SSE 载荷解析失败' })
      }
    }
  }
}

export default { decodeChunk, extractDeltaText, createSseParser }
