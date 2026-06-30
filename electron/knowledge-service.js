const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fsp = require('node:fs/promises')
const fs = require('node:fs')
const { randomUUID } = require('node:crypto')
const { extractUrl, fetchUrlPreview, buildWebImportRecord } = require('./services/url-extractor')
const { getPreferences } = require('./user-data-service')

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
let versionsDir = ''

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
  await fsp.mkdir(versionsDir, { recursive: true })
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

// =========================
// 版本管理
// =========================

/**
 * 归档当前文档版本（在覆盖前调用）
 */
async function archiveVersion(docId, currentRecord) {
  const textPath = path.join(textDir, `${docId}.txt`)
  if (!fs.existsSync(textPath)) return

  const verId = randomUUID()
  const verDir = path.join(versionsDir, docId)
  await fsp.mkdir(verDir, { recursive: true })

  const content = await fsp.readFile(textPath, 'utf8')
  const verMeta = {
    verId,
    docId,
    createdAt: utcNowIso(),
    charCount: content.length,
    filename: currentRecord.filename || '',
    source: currentRecord.source || 'file',
  }

  await fsp.writeFile(path.join(verDir, `${verId}.txt`), content, 'utf8')
  await fsp.writeFile(path.join(verDir, `${verId}.json`), JSON.stringify(verMeta, null, 2), 'utf8')

  const manifestPath = path.join(verDir, 'manifest.json')
  let manifest = []
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) } catch { manifest = [] }
  }
  manifest.unshift(verMeta)
  if (manifest.length > 10) {
    const removed = manifest.splice(10)
    for (const r of removed) {
      await fsp.rm(path.join(verDir, `${r.verId}.txt`), { force: true })
      await fsp.rm(path.join(verDir, `${r.verId}.json`), { force: true })
    }
  }
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  return verMeta
}

async function getDocVersions(docId) {
  if (!docId) throw new Error('缺少文档 ID')
  const verDir = path.join(versionsDir, docId)
  const manifestPath = path.join(verDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return { versions: [] }
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'))
  return { docId, versions: manifest }
}

async function getVersionContent(docId, verId) {
  if (!docId || !verId) throw new Error('缺少文档 ID 或版本 ID')
  const verPath = path.join(versionsDir, docId, `${verId}.txt`)
  if (!fs.existsSync(verPath)) throw new Error('版本内容不存在')
  const content = await fsp.readFile(verPath, 'utf8')
  const metaPath = path.join(versionsDir, docId, `${verId}.json`)
  let meta = {}
  if (fs.existsSync(metaPath)) meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'))
  return { docId, verId, content, meta }
}

async function rollbackToVersion(docId, verId) {
  const verData = await getVersionContent(docId, verId)
  const items = await readDbItems()
  const record = items.find((entry) => entry.id === docId)
  if (record && record.parseStatus === 'parsed') {
    await archiveVersion(docId, record)
  }
  const textPath = path.join(textDir, `${docId}.txt`)
  await fsp.writeFile(textPath, verData.content, 'utf8')
  if (record) {
    record.charCount = verData.content.length
    record.parseStatus = 'parsed'
    await writeDbItems(items)
  }
  broadcastKnowledgeUpdated()
  return { success: true, docId, verId, charCount: verData.content.length }
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

  // 检查是否有同名文档，如有则归档旧版本
  const existingIndex = items.findIndex(
    (entry) => entry.filename === safeName && entry.source === 'file'
  )
  if (existingIndex >= 0) {
    const existing = items[existingIndex]
    if (existing.parseStatus === 'parsed') {
      await archiveVersion(existing.id, existing)
    }
    // 删除旧文件
    if (existing.storedFilename) {
      await fsp.rm(path.join(filesDir, existing.storedFilename), { force: true })
    }
    await fsp.rm(path.join(textDir, `${existing.id}.txt`), { force: true })
    items.splice(existingIndex, 1)
  }

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

async function uploadKnowledgeUrl(payload) {
  const url = typeof payload === 'string' ? payload : String(payload?.url || '').trim()
  const webImport = typeof payload === 'object' ? payload.webImport : null

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
    sourceUrl: url || String(webImport?.sourceUrl || '').trim(),
  }

  items.unshift(record)
  await writeDbItems(items)
  broadcastKnowledgeUpdated()

  try {
    let filename
    let content

    if (webImport) {
      ;({ filename, content } = buildWebImportRecord(webImport))
    } else {
      ;({ filename, content } = await extractUrl(url))
    }

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
  if (payload.webImport || payload.url) {
    return uploadKnowledgeUrl(payload)
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

  ipcMain.handle('knowledge:fetch-url-preview', async (_event, url) => {
    try {
      const preview = await fetchUrlPreview(url)
      return { success: true, preview }
    } catch (error) {
      if (error?.code === 'ANTI_BOT' || error?.code === 'DYNAMIC_PAGE') {
        return { success: false, code: error.code, message: error.message }
      }
      throw error
    }
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

  ipcMain.handle('knowledge:search', async (_event, { query, topK = 5 } = {}) => {
    if (!query || !String(query).trim()) {
      return { results: [], error: 'query 不能为空' }
    }
    const K_PORT = process.env.KNOWLEDGE_SERVICE_PORT || '3003'
    const url = `http://127.0.0.1:${K_PORT}/api/knowledge/search`
    try {
      const formData = new URLSearchParams()
      formData.append('query', String(query).trim())
      formData.append('top_k', String(Math.max(1, Math.min(20, Number(topK) || 5))))
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return { results: [], error: `知识库搜索失败 (HTTP ${res.status}): ${text.slice(0, 200)}` }
      }
      return await res.json()
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        return { results: [], error: '知识库搜索超时' }
      }
      return { results: [], error: err?.message || String(err) }
    }
  })

  // 版本管理 IPC
  ipcMain.handle('knowledge:versions', async (_event, docId) => {
    return getDocVersions(docId)
  })

  ipcMain.handle('knowledge:version-content', async (_event, docId, verId) => {
    return getVersionContent(docId, verId)
  })

  ipcMain.handle('knowledge:rollback', async (_event, docId, verId) => {
    return rollbackToVersion(docId, verId)
  })

  // 全文搜索 IPC
  ipcMain.handle('knowledge:fulltext-search', async (_event, { query, limit = 20 } = {}) => {
    if (!query || !String(query).trim()) {
      return { results: [], error: 'query 不能为空' }
    }
    const K_PORT = process.env.KNOWLEDGE_SERVICE_PORT || '3003'
    const url = `http://127.0.0.1:${K_PORT}/api/knowledge/fulltext-search`
    try {
      const formData = new URLSearchParams()
      formData.append('query', String(query).trim())
      formData.append('limit', String(Math.max(1, Math.min(50, Number(limit) || 20))))
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return { results: [], error: err?.message || String(err) }
    }
  })

  // 标签云 IPC
  ipcMain.handle('knowledge:tags', async () => {
    const K_PORT = process.env.KNOWLEDGE_SERVICE_PORT || '3003'
    const url = `http://127.0.0.1:${K_PORT}/api/knowledge/tags`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return { tags: [], totalDocs: 0, error: err?.message || String(err) }
    }
  })

  // 自动索引 IPC
  ipcMain.handle('knowledge:index', async () => {
    const K_PORT = process.env.KNOWLEDGE_SERVICE_PORT || '3003'
    const url = `http://127.0.0.1:${K_PORT}/api/knowledge/index`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return { groups: [], totalDocs: 0, error: err?.message || String(err) }
    }
  })

  // 跨文档引用 IPC
  ipcMain.handle('knowledge:links', async (_event, docId) => {
    if (!docId) return { references: [] }
    const K_PORT = process.env.KNOWLEDGE_SERVICE_PORT || '3003'
    const url = `http://127.0.0.1:${K_PORT}/api/knowledge/${encodeURIComponent(docId)}/links`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return { docId, references: [], error: err?.message || String(err) }
    }
  })
}

async function initKnowledgeService() {
  if (db) return

  // 尝试从用户偏好读取自定义资料库根目录
  const prefs = getPreferences()
  const customRoot = prefs.libraryRootPath?.trim()

  if (customRoot) {
    knowledgeDir = path.join(customRoot, 'knowledge')
  } else {
    knowledgeDir = path.join(app.getPath('userData'), 'knowledge')
  }

  filesDir = path.join(knowledgeDir, 'files')
  textDir = path.join(knowledgeDir, 'text')
  versionsDir = path.join(knowledgeDir, 'versions')
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
  getDocVersions,
  getVersionContent,
  rollbackToVersion,
}
