const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fsp = require('node:fs/promises')
const fs = require('node:fs')
const { randomUUID } = require('node:crypto')

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const ALLOWED_EXTENSIONS = {
  '.pdf': 'pdf',
  '.docx': 'word',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
}

/** @type {import('lowdb').Low<import('lowdb').GenericObject> | null} */
let db = null
let knowledgeDir = ''
let filesDir = ''
let textDir = ''

function utcNowIso() {
  return new Date().toISOString()
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeFilename(filename) {
  return String(filename || 'untitled')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .slice(0, 180)
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  if (Array.isArray(data)) return Buffer.from(data)
  throw new Error('无效的文件数据')
}

async function ensureDirs() {
  await fsp.mkdir(filesDir, { recursive: true })
  await fsp.mkdir(textDir, { recursive: true })
}

async function readDbItems() {
  if (!db) return []
  await db.read()
  db.data ||= { items: [] }
  if (!Array.isArray(db.data.items)) {
    db.data.items = []
  }
  return db.data.items
}

async function writeDbItems(items) {
  if (!db) throw new Error('[knowledge-service] Database not initialized')
  db.data.items = items
  await db.write()
}

async function extractTextFile(data) {
  const encodings = ['utf8', 'utf-8', 'latin1']
  for (const encoding of encodings) {
    try {
      return normalizeText(data.toString(encoding))
    } catch {
      // try next encoding
    }
  }
  return normalizeText(data.toString('utf8'))
}

async function extractPdf(data) {
  const pdfParse = require('pdf-parse')
  const result = await pdfParse(data)
  return normalizeText(result.text || '')
}

async function extractDocx(data) {
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer: data })
  return normalizeText(result.value || '')
}

async function extractUrl(url) {
  const trimmed = String(url || '').trim()
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('请输入有效的 http/https URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('请输入有效的 http/https URL')
  }

  const response = await fetch(trimmed, {
    headers: {
      'User-Agent': 'WPX/1.0 (+https://wpx.app)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`无法抓取该网页（HTTP ${response.status}）`)
  }

  const html = await response.text()
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch
    ? normalizeText(titleMatch[1].replace(/<[^>]+>/g, ''))
    : parsed.hostname

  const text = normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '\n')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>'),
  )

  if (!text) {
    throw new Error('未能从网页提取正文内容')
  }

  return {
    filename: `${title || parsed.hostname}.web`,
    content: text,
  }
}

async function parseUpload(filename, data) {
  const ext = path.extname(filename).toLowerCase()
  const docType = ALLOWED_EXTENSIONS[ext]
  if (!docType) {
    const allowed = Object.keys(ALLOWED_EXTENSIONS).join(', ')
    throw new Error(`不支持的文件类型，仅支持：${allowed}`)
  }

  let content = ''
  if (docType === 'pdf') {
    content = await extractPdf(data)
  } else if (docType === 'word') {
    content = await extractDocx(data)
  } else {
    content = await extractTextFile(data)
  }

  if (!content) {
    throw new Error('未能从文件中提取文本内容')
  }

  return { docType, content }
}

function publicItem(item) {
  return {
    id: item.id,
    filename: item.filename,
    type: item.type,
    source: item.source,
    uploadedAt: item.uploadedAt,
    charCount: item.charCount ?? 0,
    parseStatus: item.parseStatus ?? 'parsed',
    errorMessage: item.errorMessage || '',
  }
}

function broadcastKnowledgeUpdated() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send('data:knowledge:updated')
  }
}

async function getKnowledgeList() {
  const items = await readDbItems()
  return items.map(publicItem)
}

async function getKnowledgePreview(id) {
  const items = await readDbItems()
  const item = items.find((entry) => entry.id === id)
  if (!item) {
    throw new Error('资料不存在')
  }

  const textPath = path.join(textDir, `${id}.txt`)
  if (!fs.existsSync(textPath)) {
    throw new Error('资料内容不存在')
  }

  const content = await fsp.readFile(textPath, 'utf8')
  return {
    ...publicItem(item),
    content,
  }
}

async function uploadKnowledgeFile(filename, data, mimeType = '') {
  const buffer = toBuffer(data)
  if (!buffer.length) {
    throw new Error('文件为空')
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`文件过大，最大支持 ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`)
  }

  const safeName = sanitizeFilename(filename)
  const ext = path.extname(safeName).toLowerCase()
  const docType = ALLOWED_EXTENSIONS[ext]
  if (!docType) {
    const allowed = Object.keys(ALLOWED_EXTENSIONS).join(', ')
    throw new Error(`不支持的文件类型，仅支持：${allowed}`)
  }

  const id = randomUUID()
  const uploadedAt = utcNowIso()
  const storedFilename = `${id}${ext}`
  const storedFilePath = path.join(filesDir, storedFilename)
  const textPath = path.join(textDir, `${id}.txt`)

  await fsp.writeFile(storedFilePath, buffer)

  const items = await readDbItems()
  const record = {
    id,
    filename: safeName,
    type: docType,
    source: 'file',
    uploadedAt,
    mimeType: mimeType || '',
    storedFilename,
    charCount: 0,
    parseStatus: 'pending',
    errorMessage: '',
  }

  items.unshift(record)
  await writeDbItems(items)
  broadcastKnowledgeUpdated()

  try {
    const { docType: parsedType, content } = await parseUpload(safeName, buffer)
    await fsp.writeFile(textPath, content, 'utf8')

    record.type = parsedType
    record.charCount = content.length
    record.parseStatus = 'parsed'
    record.errorMessage = ''
  } catch (error) {
    record.parseStatus = 'failed'
    record.errorMessage = error.message || '解析失败'
  }

  const nextItems = await readDbItems()
  const index = nextItems.findIndex((entry) => entry.id === id)
  if (index >= 0) {
    nextItems[index] = record
    await writeDbItems(nextItems)
  }

  broadcastKnowledgeUpdated()
  return publicItem(record)
}

async function uploadKnowledgeUrl(url) {
  const id = randomUUID()
  const uploadedAt = utcNowIso()
  const textPath = path.join(textDir, `${id}.txt`)

  const items = await readDbItems()
  const record = {
    id,
    filename: '抓取中…',
    type: 'web',
    source: 'url',
    uploadedAt,
    mimeType: 'text/html',
    storedFilename: '',
    charCount: 0,
    parseStatus: 'pending',
    errorMessage: '',
    sourceUrl: String(url || '').trim(),
  }

  items.unshift(record)
  await writeDbItems(items)
  broadcastKnowledgeUpdated()

  try {
    const { filename, content } = await extractUrl(url)
    await fsp.writeFile(textPath, content, 'utf8')

    record.filename = filename
    record.charCount = content.length
    record.parseStatus = 'parsed'
    record.errorMessage = ''
  } catch (error) {
    record.parseStatus = 'failed'
    record.errorMessage = error.message || 'URL 抓取失败'
  }

  const nextItems = await readDbItems()
  const index = nextItems.findIndex((entry) => entry.id === id)
  if (index >= 0) {
    nextItems[index] = record
    await writeDbItems(nextItems)
  }

  broadcastKnowledgeUpdated()
  return publicItem(record)
}

async function uploadKnowledge(payload = {}) {
  if (payload.url) {
    return uploadKnowledgeUrl(payload.url)
  }

  if (payload.filename && payload.data != null) {
    return uploadKnowledgeFile(payload.filename, payload.data, payload.mimeType)
  }

  throw new Error('请上传文件或提供 URL')
}

async function deleteKnowledge(id) {
  if (!id) {
    throw new Error('缺少资料 ID')
  }

  const items = await readDbItems()
  const index = items.findIndex((entry) => entry.id === id)
  if (index < 0) {
    throw new Error('资料不存在')
  }

  const [removed] = items.splice(index, 1)
  await writeDbItems(items)

  const deleteTasks = [fsp.rm(path.join(textDir, `${id}.txt`), { force: true })]
  if (removed.storedFilename) {
    deleteTasks.push(fsp.rm(path.join(filesDir, removed.storedFilename), { force: true }))
  }
  await Promise.allSettled(deleteTasks)

  broadcastKnowledgeUpdated()
  return { success: true, id }
}

async function clearKnowledgeIndex() {
  const items = await readDbItems()
  await writeDbItems([])
  broadcastKnowledgeUpdated()
  return { success: true, cleared: items.length }
}

function registerKnowledgeIpcHandlers() {
  ipcMain.handle('knowledge:list', async () => {
    const items = await getKnowledgeList()
    return { items }
  })

  ipcMain.handle('knowledge:preview', async (_event, id) => {
    return getKnowledgePreview(id)
  })

  ipcMain.handle('knowledge:upload', async (_event, payload) => {
    const item = await uploadKnowledge(payload)
    return { success: true, item }
  })

  ipcMain.handle('knowledge:delete', async (_event, id) => {
    return deleteKnowledge(id)
  })

  ipcMain.handle('knowledge:clear-index', async () => {
    return clearKnowledgeIndex()
  })
}

async function initKnowledgeService() {
  if (db) return

  knowledgeDir = path.join(app.getPath('userData'), 'knowledge')
  filesDir = path.join(knowledgeDir, 'files')
  textDir = path.join(knowledgeDir, 'text')
  const dbPath = path.join(knowledgeDir, 'db.json')

  await ensureDirs()

  const { Low } = await import('lowdb')
  const { JSONFile } = await import('lowdb/node')
  const adapter = new JSONFile(dbPath)
  db = new Low(adapter, { items: [] })
  await db.read()
  db.data ||= { items: [] }

  registerKnowledgeIpcHandlers()
}

module.exports = {
  initKnowledgeService,
  getKnowledgeList,
  uploadKnowledge,
  deleteKnowledge,
  clearKnowledgeIndex,
  getKnowledgePreview,
}
