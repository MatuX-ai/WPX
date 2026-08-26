/**
 * 文库路由（移植自 wpx-app/src/server/library-service.py）
 *
 * 端点：
 *   GET  /api/library/health
 *   POST /api/library/analyze
 *   POST /api/library/save
 *   GET  /api/library/tree
 *   GET  /api/library/search
 *   GET  /api/library/document
 *
 * 关键变更：
 *  - Python FastAPI 服务仅在 `npm run library-service` 手动启动时可用，
 *    Electron 桌面端不会自动 spawn Python 进程，导致 /api/library/* 请求
 *    fetch 报 "Failed to fetch"（相对路径在 file:// 协议下不可达）。
 *  - 本路由由 Electron 的 local-server 注册，使用 Node.js 内置 fs/path
 *    持久化到 Electron userData 目录，避免引入额外依赖。
 *  - 数据格式与 Python 版完全兼容（frontmatter 写入规范、manifest 字段一致），
 *    web 端 / 桌面端可共享同一份文库。
 */
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const { app } = require('electron')
const { getPreferences } = require('../user-data-service')

/** 文库可索引的文档扩展名（含导出产物） */
const DOCUMENT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.html',
  '.htm',
  '.docx',
  '.pdf',
  '.xlsx',
  '.xls',
  '.xlsm',
  '.csv',
])

/** 可在编辑器中直接打开编辑的文本格式 */
const EDITABLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

/** 保存接口支持的 format → 扩展名 */
const SAVE_FORMAT_EXT = {
  md: '.md',
  txt: '.txt',
  html: '.html',
  docx: '.docx',
  pdf: '.pdf',
  xlsx: '.xlsx',
  xls: '.xls',
  csv: '.csv',
}

const BINARY_SAVE_FORMATS = new Set(['docx', 'pdf', 'xlsx', 'xls'])

const TAG_KEYWORDS = [
  ['周报', '周报'],
  ['需求', '需求文档'],
  ['方案', '方案'],
  ['会议', '会议纪要'],
  ['总结', '总结'],
  ['计划', '计划'],
  ['报告', '报告'],
  ['教程', '教程'],
  ['笔记', '笔记'],
  ['api', 'API'],
  ['设计', '设计'],
  ['测试', '测试'],
]

const PATH_RULES = [
  [['周报', 'weekly'], '工作/周报'],
  [['需求', 'requirement', 'prd'], '工作/需求文档'],
  [['会议', '纪要', 'meeting'], '工作/会议纪要'],
  [['方案', 'proposal', '设计'], '工作/方案'],
  [['总结', '复盘', 'review'], '工作/总结'],
  [['计划', 'plan', 'roadmap'], '工作/计划'],
  [['教程', 'guide', 'how to'], '知识库/教程'],
  [['笔记', 'note'], '知识库/笔记'],
  [['api', '接口', 'endpoint'], '技术/API'],
  [['测试', 'test', 'qa'], '技术/测试'],
]

/** @type {string} 文库根目录（缓存） */
let libraryRoot = ''
/** @type {string} 元数据目录（manifest / path-corrections） */
let metaDir = ''
let manifestPath = ''
let correctionsPath = ''

/**
 * 解析文库根目录。
 * 优先 `general.libraryRootPath`（通用设置面板），
 * 其次顶层 `libraryRootPath`（历史 settings store），
 * 都为空时回退到 `<userData>/library`。
 *
 * 与 knowledge-service.resolveKnowledgeRoot 保持一致策略，
 * 便于后期在 UI 中共享同一份「数据根目录」设置。
 */
function resolveLibraryRoot(prefs) {
  const generalPath = prefs?.general?.libraryRootPath?.trim?.()
  const legacyPath = prefs?.libraryRootPath?.trim?.()
  const customRoot = generalPath || legacyPath || ''
  if (customRoot) return customRoot
  return path.join(app.getPath('userData'), 'library')
}

function ensureMetaDirs() {
  if (!fs.existsSync(libraryRoot)) {
    fs.mkdirSync(libraryRoot, { recursive: true })
  }
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true })
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJson(filePath, data) {
  ensureMetaDirs()
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * 规范化路径：将 `\\` 与 `/` 统一为 `/`，
 * 去除空段、`.`、`..`，避免跨目录遍历。
 */
function normalizePath(input) {
  const cleaned = String(input || '')
    .replace(/[\\/]+/g, '/')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  const parts = cleaned.split('/').filter((part) => part && part !== '.' && part !== '..')
  return parts.join('/')
}

function sanitizeFilename(name) {
  const cleaned = String(name || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || '未命名文档'
}

function tokenize(text) {
  const lowered = String(text || '').toLowerCase()
  const tokens = new Set()
  const cjkMatches = lowered.match(/[\u4e00-\u9fff]{2,}/g) || []
  for (const match of cjkMatches) tokens.add(match)
  const wordMatches = lowered.match(/[a-zA-Z]{3,}/g) || []
  for (const match of wordMatches) tokens.add(match)
  const parts = lowered.split(/\s+/).filter((word) => word.length >= 2)
  for (const part of parts) tokens.add(part)
  return tokens
}

function extractTitle(content, fallback = '') {
  const lines = String(content || '').split(/\r?\n/)
  for (const line of lines) {
    const match = line.trim().match(/^#\s+(.+)$/)
    if (match) return match[1].trim()
  }
  const trimmed = String(fallback || '').trim()
  return trimmed || '未命名文档'
}

function extractSummary(content, maxLen = 160) {
  const lines = []
  for (const line of String(content || '').split(/\r?\n/)) {
    const stripped = line.trim()
    if (!stripped || stripped.startsWith('#')) continue
    const cleaned = stripped.replace(/[*_`>\[\]()!]/g, '').trim()
    if (cleaned) lines.push(cleaned)
    if (lines.join('').length >= maxLen) break
  }
  let text = lines.join(' ').trim()
  if (!text) text = String(content || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).replace(/\s+\S*$/, '') + '…'
}

function extractTags(content, title) {
  const haystack = `${title}\n${content}`.toLowerCase()
  const tags = []
  for (const [keyword, tag] of TAG_KEYWORDS) {
    if (haystack.includes(keyword.toLowerCase()) && !tags.includes(tag)) {
      tags.push(tag)
    }
  }
  if (tags.length === 0) {
    const tokens = Array.from(tokenize(haystack))
    for (const token of tokens.slice(0, 3)) {
      if (token.length >= 2) tags.push(token.slice(0, 12))
    }
  }
  return tags.slice(0, 6)
}

function extractPathFromContent(content) {
  return String(content || '').slice(0, 500)
}

function scoreCorrection(content, title, correction) {
  const contentTokens = tokenize(`${title}\n${content}`)
  const titleTokens = tokenize(title)
  const corrTitleTokens = tokenize(correction.title || '')

  let score = 0
  score += intersectionSize(contentTokens, corrTitleTokens) * 2

  if (Array.isArray(correction.tags) && correction.tags.length) {
    const tagTokens = tokenize(correction.tags.join(' '))
    score += intersectionSize(contentTokens, tagTokens) * 1.5
  }

  const suggested = normalizePath(correction.suggestedPath || '')
  if (suggested && suggested.includes(normalizePath(extractPathFromContent(content)))) {
    score += 1
  }

  score += intersectionSize(titleTokens, corrTitleTokens) * 3
  return score
}

function intersectionSize(setA, setB) {
  let count = 0
  for (const item of setA) {
    if (setB.has(item)) count += 1
  }
  return count
}

function suggestPath(content, title, corrections) {
  if (Array.isArray(corrections) && corrections.length) {
    const ranked = [...corrections].sort(
      (a, b) => scoreCorrection(content, title, b) - scoreCorrection(content, title, a),
    )
    const best = ranked[0]
    if (best && scoreCorrection(content, title, best) >= 2) {
      return normalizePath(best.chosenPath)
    }
  }

  const haystack = `${title}\n${content}`.toLowerCase()
  for (const [keywords, route] of PATH_RULES) {
    if (keywords.some((kw) => haystack.includes(kw))) return route
  }
  return '未分类'
}

async function recordPathCorrection(suggested, chosen, title, tags) {
  const suggestedPath = normalizePath(suggested)
  const chosenPath = normalizePath(chosen)
  if (!suggestedPath || !chosenPath || suggestedPath === chosenPath) return

  const list = await readJson(correctionsPath, [])
  list.unshift({
    id: crypto.randomUUID(),
    suggestedPath,
    chosenPath,
    title,
    tags,
    recordedAt: new Date().toISOString(),
  })
  await writeJson(correctionsPath, list.slice(0, 500))
}

function isDocumentFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) return false
  return DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

/**
 * 解析 frontmatter（与 Python 版协议一致）。
 * 仅解析简单的 key: value 与 tags: [a, b, c] 形式。
 */
function parseFrontmatter(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return { meta: {}, body: text }

  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!match) return { meta: {}, body: text }

  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const colonAt = line.indexOf(':')
    if (colonAt < 0) continue
    const key = line.slice(0, colonAt).trim()
    let value = line.slice(colonAt + 1).trim()
    if (!key) continue

    if (key === 'tags') {
      const cleaned = value.replace(/^['"]|['"]$/g, '')
      try {
        meta[key] = JSON.parse(cleaned.replace(/'/g, '"'))
      } catch {
        meta[key] = cleaned
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
      }
    } else {
      meta[key] = value.replace(/^['"]|['"]$/g, '')
    }
  }
  return { meta, body: text.slice(match[0].length) }
}

function buildTreeNode(name, route, children) {
  return { name, type: 'folder', path: route, children }
}

function buildDirectoryTree(docs) {
  const root = { name: '', type: 'folder', path: '', children: [] }
  const folderMap = new Map([['', root]])

  const folderPaths = new Set()
  for (const doc of docs) {
    folderPaths.add(doc.path)
    const parts = doc.path.split('/').filter(Boolean)
    for (let i = 0; i < parts.length; i += 1) {
      folderPaths.add(parts.slice(0, i + 1).join('/'))
    }
  }

  const sortedFolders = Array.from(folderPaths).sort(
    (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b),
  )
  for (const folderPath of sortedFolders) {
    if (folderPath === '' || folderMap.has(folderPath)) continue
    const parts = folderPath.split('/').filter(Boolean)
    const parentPath = parts.slice(0, -1).join('/')
    const parent = folderMap.get(parentPath) || root
    const node = buildTreeNode(parts[parts.length - 1], folderPath, [])
    parent.children.push(node)
    folderMap.set(folderPath, node)
  }

  for (const doc of docs) {
    const folder = folderMap.get(doc.path) || root
    folder.children.push({
      name: doc.name,
      type: 'file',
      title: doc.title,
      relativePath: doc.relativePath,
      path: doc.path,
      tags: doc.tags,
      summary: doc.summary,
      savedAt: doc.savedAt,
    })
  }

  const sortChildren = (node) => {
    node.children.sort((a, b) => {
      const aFolder = a.type === 'folder' ? 0 : 1
      const bFolder = b.type === 'folder' ? 0 : 1
      if (aFolder !== bFolder) return aFolder - bFolder
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })
    for (const child of node.children) {
      if (child.type === 'folder') sortChildren(child)
    }
  }
  sortChildren(root)
  return root
}

function buildTagCloud(docs) {
  const counter = new Map()
  for (const doc of docs) {
    for (const tag of doc.tags || []) {
      const label = String(tag).trim()
      if (!label) continue
      counter.set(label, (counter.get(label) || 0) + 1)
    }
  }
  return Array.from(counter.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

function makeSnippet(text, query, radius = 60) {
  const lowered = String(text || '').toLowerCase()
  const index = lowered.indexOf(String(query || '').toLowerCase())
  if (index < 0) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim()
    return compact.slice(0, 120) + (compact.length > 120 ? '…' : '')
  }
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + String(query).length + radius)
  let snippet = text.slice(start, end).trim()
  if (start > 0) snippet = '…' + snippet
  if (end < text.length) snippet += '…'
  return snippet
}

function listDocuments() {
  if (!libraryRoot || !fs.existsSync(libraryRoot)) return []

  const docs = []
  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (isDocumentFile(fullPath)) {
        docs.push(readDocumentRecord(fullPath))
      }
    }
  }
  walk(libraryRoot)
  docs.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return docs
}

function readDocumentRecord(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const relativePath = path.relative(libraryRoot, filePath).replace(/\\/g, '/')
  const folderPath = normalizePath(path.relative(libraryRoot, path.dirname(filePath)).replace(/\\/g, '/'))
  const editable = EDITABLE_EXTENSIONS.has(ext)
  const format = ext.replace(/^\./, '') || 'md'

  // 二进制或非编辑器文本：只返回元数据，避免按 UTF-8 误读
  if (!editable && (ext === '.docx' || ext === '.pdf' || ext === '.xlsx' || ext === '.xls' || ext === '.xlsm')) {
    return {
      id: relativePath,
      title: path.basename(filePath, ext),
      name: path.basename(filePath),
      relativePath,
      path: folderPath,
      tags: [],
      summary: '',
      content: '',
      savedAt: undefined,
      format,
      editable: false,
    }
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const { meta, body } = parseFrontmatter(raw)
  const title = String(meta.title || path.basename(filePath, ext))
  const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => String(tag)) : []
  return {
    id: relativePath,
    title,
    name: path.basename(filePath),
    relativePath,
    path: folderPath,
    tags,
    summary: String(meta.summary || extractSummary(body)),
    content: body,
    savedAt: meta.savedAt,
    format: editable ? (ext === '.txt' ? 'txt' : 'md') : format,
    editable,
  }
}

function resolveLibraryFile(relativePath) {
  const normalized = normalizePath(String(relativePath || '').replace(/\\/g, '/'))
  if (!normalized) {
    const err = new Error('文档路径无效')
    err.statusCode = 400
    throw err
  }
  const candidate = path.resolve(libraryRoot, normalized)
  const root = path.resolve(libraryRoot)
  if (!candidate.startsWith(root + path.sep) && candidate !== root) {
    const err = new Error('文档路径无效')
    err.statusCode = 400
    throw err
  }
  if (!isDocumentFile(candidate)) {
    const err = new Error('文档不存在')
    err.statusCode = 404
    throw err
  }
  return candidate
}

function searchDocuments(query) {
  const keyword = String(query || '').trim()
  if (!keyword) return []
  const needle = keyword.toLowerCase()
  const docs = listDocuments()
  const results = []
  for (const doc of docs) {
    const title = (doc.title || '').toLowerCase()
    const tagText = (doc.tags || []).join(' ').toLowerCase()
    const body = (doc.content || '').toLowerCase()
    let score = 0
    if (title.includes(needle)) score += 5
    if (tagText.includes(needle)) score += 3
    if (body.includes(needle)) score += 1
    if (score <= 0) continue
    results.push({
      title: doc.title,
      relativePath: doc.relativePath,
      path: doc.path,
      tags: doc.tags,
      summary: doc.summary,
      snippet: makeSnippet(doc.content, keyword),
      score,
    })
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return results
}

function buildFrontmatter(title, route, tags, summary, savedAt) {
  const safeSummary = String(summary || '')
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .trim()
  const safeTags = Array.isArray(tags)
    ? tags.map((tag) => JSON.stringify(String(tag))).join(', ')
    : ''
  return [
    '---',
    `title: "${title}"`,
    `path: ${route}`,
    `tags: [${safeTags}]`,
    `summary: "${safeSummary}"`,
    `savedAt: ${savedAt}`,
    '---',
    '',
  ].join('\n')
}

function ensureRoutesRegistered() {
  if (libraryRoot) return
  const prefs = getPreferences()
  libraryRoot = resolveLibraryRoot(prefs)
  metaDir = path.join(libraryRoot, '.wpx-meta')
  manifestPath = path.join(metaDir, 'manifest.json')
  correctionsPath = path.join(metaDir, 'path-corrections.json')
  ensureMetaDirs()
}

function registerLibraryRoutes(expressApp) {
  if (!expressApp) throw new Error('[library-routes] expressApp is required')

  expressApp.get('/api/library/health', async (_req, res) => {
    try {
      ensureRoutesRegistered()
      const docs = listDocuments()
      res.json({
        status: 'ok',
        libraryRoot,
        documents: docs.length,
      })
    } catch (err) {
      res.status(500).json({ error: err?.message || String(err) })
    }
  })

  expressApp.post('/api/library/analyze', async (req, res) => {
    try {
      ensureRoutesRegistered()
      const body = req.body || {}
      const content = String(body.content || '').trim()
      if (!content) {
        return res.status(400).json({ error: '文档内容不能为空' })
      }
      const title = extractTitle(content, body.title)
      const path = suggestPath(content, title, body.pathCorrections || [])
      const tags = extractTags(content, title)
      const summary = extractSummary(content)
      res.json({ title, path, tags, summary })
    } catch (err) {
      res.status(500).json({ error: err?.message || String(err) })
    }
  })

  expressApp.post('/api/library/save', async (req, res) => {
    try {
      ensureRoutesRegistered()
      const body = req.body || {}
      const formatRaw = String(body.format || 'md').toLowerCase()
      const format = SAVE_FORMAT_EXT[formatRaw] ? formatRaw : 'md'
      const ext = SAVE_FORMAT_EXT[format]
      const content = String(body.content || '')
      const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64 : ''

      if (BINARY_SAVE_FORMATS.has(format)) {
        if (!contentBase64) {
          return res.status(400).json({ error: `保存 ${format} 需要提供转换后的文件数据` })
        }
      } else if (!(format === 'html' && contentBase64) && !(format === 'csv' && contentBase64) && !content.trim()) {
        return res.status(400).json({ error: '文档内容不能为空' })
      }

      const title = sanitizeFilename(body.title || extractTitle(content))
      const route = normalizePath(body.path)
      if (!route) {
        return res.status(400).json({ error: '分类路径不能为空' })
      }
      const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : []
      const summary = String(body.summary || '').trim()

      const targetDir = path.join(libraryRoot, ...route.split('/'))
      await fsp.mkdir(targetDir, { recursive: true })

      let targetPath = path.join(targetDir, `${title}${ext}`)
      if (fs.existsSync(targetPath)) {
        const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)
        targetPath = path.join(targetDir, `${title}_${stamp}${ext}`)
      }

      const savedAt = new Date().toISOString()

      if (BINARY_SAVE_FORMATS.has(format) || (format === 'html' && contentBase64) || (format === 'csv' && contentBase64)) {
        await fsp.writeFile(targetPath, Buffer.from(contentBase64, 'base64'))
      } else if (format === 'md') {
        const frontmatter = buildFrontmatter(title, route, tags, summary, savedAt)
        await fsp.writeFile(targetPath, `${frontmatter}${content.trim()}\n`, 'utf8')
      } else if (format === 'html') {
        await fsp.writeFile(targetPath, `${content.trim()}\n`, 'utf8')
      } else {
        // txt：纯正文，不写 frontmatter
        await fsp.writeFile(targetPath, `${content.trim()}\n`, 'utf8')
      }

      if (body.suggestedPath) {
        await recordPathCorrection(body.suggestedPath, route, title, tags)
      }

      const relativePath = path.relative(libraryRoot, targetPath).replace(/\\/g, '/')
      const entry = {
        id: crypto.randomUUID(),
        title,
        path: route,
        tags,
        summary,
        relativePath,
        savedAt,
        format,
        editable: EDITABLE_EXTENSIONS.has(ext),
      }

      const manifest = await readJson(manifestPath, [])
      manifest.unshift(entry)
      await writeJson(manifestPath, manifest.slice(0, 1000))

      res.json({
        success: true,
        item: entry,
        filePath: targetPath,
      })
    } catch (err) {
      res.status(500).json({ error: err?.message || String(err) })
    }
  })

  expressApp.get('/api/library/tree', async (_req, res) => {
    try {
      ensureRoutesRegistered()
      const docs = listDocuments()
      res.json({
        root: libraryRoot,
        tree: buildDirectoryTree(docs),
        tags: buildTagCloud(docs),
        total: docs.length,
      })
    } catch (err) {
      res.status(500).json({ error: err?.message || String(err) })
    }
  })

  expressApp.get('/api/library/search', async (req, res) => {
    try {
      ensureRoutesRegistered()
      const query = String(req.query.q || '').trim()
      if (!query) {
        return res.json({ query: '', items: [] })
      }
      res.json({ query, items: searchDocuments(query) })
    } catch (err) {
      res.status(500).json({ error: err?.message || String(err) })
    }
  })

  expressApp.get('/api/library/document', async (req, res) => {
    try {
      ensureRoutesRegistered()
      const relativePath = String(req.query.relativePath || '').trim()
      const filePath = resolveLibraryFile(relativePath)
      const record = readDocumentRecord(filePath)
      if (record.editable === false) {
        return res.status(415).json({
          error: '该格式无法在编辑器中直接打开，请在文库文件夹中用系统默认程序打开',
          format: record.format,
          relativePath: record.relativePath,
          title: record.title,
        })
      }
      res.json({
        title: record.title,
        relativePath: record.relativePath,
        path: record.path,
        tags: record.tags,
        summary: record.summary,
        content: record.content,
        savedAt: record.savedAt,
        format: record.format,
        editable: record.editable !== false,
      })
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message || String(err) })
    }
  })
}

module.exports = {
  registerLibraryRoutes,
  resolveLibraryRoot,
}