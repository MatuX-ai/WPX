const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const MAX_SAVE_RECORDS = 200
const DEFAULT_TEMPLATE_LIMIT = 5
const MIN_TEMPLATE_COUNT = 3

function createEmptyStats() {
  return {
    font: {},
    fontSize: {},
    lineHeight: {},
    heading: {},
  }
}

function createDefaultState() {
  return {
    version: 1,
    byDocumentType: {
      _default: createEmptyStats(),
    },
    saves: [],
    templates: [],
    templatesUpdatedAt: null,
  }
}

/** @type {import('lowdb').Low<import('lowdb').GenericObject> | null} */
let db = null

function normalizeDocumentType(documentType) {
  const trimmed = String(documentType || '').trim()
  return trimmed || '_default'
}

function normalizeFormatSnapshot(format = {}) {
  return {
    font: format.font ?? null,
    fontSize: format.fontSize ?? null,
    lineHeight: format.lineHeight ?? null,
    heading: format.heading ?? null,
  }
}

function incrementCounter(counter, value) {
  if (value == null || value === '') return
  const key = String(value)
  counter[key] = (counter[key] || 0) + 1
}

function pickMostCommon(counter) {
  let best = null
  let bestCount = 0

  for (const [value, count] of Object.entries(counter || {})) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }

  return best == null ? null : best
}

function countSamples(stats) {
  return Object.values(stats || {}).reduce((total, counter) => {
    return total + Object.values(counter || {}).reduce((sum, count) => sum + count, 0)
  }, 0)
}

function recordFormatToStats(stats, format) {
  const snapshot = normalizeFormatSnapshot(format)
  incrementCounter(stats.font, snapshot.font)
  incrementCounter(stats.fontSize, snapshot.fontSize)
  incrementCounter(stats.lineHeight, snapshot.lineHeight)
  incrementCounter(stats.heading, snapshot.heading ?? 'paragraph')
}

async function readState() {
  if (!db) return createDefaultState()
  await db.read()
  const defaults = createDefaultState()
  db.data ||= defaults
  db.data.byDocumentType = {
    _default: createEmptyStats(),
    ...(db.data.byDocumentType || {}),
  }
  db.data.saves = Array.isArray(db.data.saves) ? db.data.saves : []
  db.data.templates = Array.isArray(db.data.templates) ? db.data.templates : []
  return db.data
}

async function writeState() {
  if (!db) throw new Error('[memory-service] Database not initialized')
  await db.write()
}

function ensureDocumentTypeStats(state, documentType) {
  const typeKey = normalizeDocumentType(documentType)
  if (!state.byDocumentType[typeKey]) {
    state.byDocumentType[typeKey] = createEmptyStats()
  }
  return state.byDocumentType[typeKey]
}

function analyzeHabits(state, documentType) {
  const typeKey = normalizeDocumentType(documentType)
  const stats =
    state.byDocumentType[typeKey] ||
    state.byDocumentType._default ||
    createEmptyStats()

  const heading = pickMostCommon(stats.heading)

  return {
    font: pickMostCommon(stats.font),
    fontSize: pickMostCommon(stats.fontSize),
    lineHeight: pickMostCommon(stats.lineHeight),
    heading: heading === 'paragraph' ? null : heading,
    sampleCount: countSamples(stats),
    documentType: typeKey === '_default' ? '' : typeKey,
  }
}

function buildSmartTemplates(state, limit = DEFAULT_TEMPLATE_LIMIT) {
  const byType = new Map()

  for (const save of state.saves) {
    const label = String(save.documentType || '').trim()
    if (!label) continue

    if (!byType.has(label)) {
      byType.set(label, {
        documentType: label,
        count: 0,
        format: save.format || null,
      })
    }

    const entry = byType.get(label)
    entry.count += 1
    if (!entry.format && save.format) {
      entry.format = save.format
    }
  }

  return Array.from(byType.values())
    .filter((item) => item.count >= MIN_TEMPLATE_COUNT)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => {
      const habits = analyzeHabits(state, item.documentType)
      return {
        ...item,
        format: {
          ...normalizeFormatSnapshot(item.format),
          font: item.format?.font ?? habits.font,
          fontSize: item.format?.fontSize ?? habits.fontSize,
          lineHeight: item.format?.lineHeight ?? habits.lineHeight,
          heading: item.format?.heading ?? habits.heading,
        },
        habits,
      }
    })
}

function broadcastTemplatesUpdated(templates) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send('data:templates:updated', { templates })
  }
}

async function regenerateTemplates({ broadcast = true } = {}) {
  const state = await readState()
  const templates = buildSmartTemplates(state)
  state.templates = templates
  state.templatesUpdatedAt = new Date().toISOString()
  await writeState()

  if (broadcast) {
    broadcastTemplatesUpdated(templates)
  }

  return templates
}

async function recordMemoryEvent(payload = {}) {
  const action = payload.action || payload.type
  if (!action) {
    throw new Error('缺少 memory 记录类型')
  }

  const state = await readState()
  const documentType = normalizeDocumentType(payload.documentType)
  const format = normalizeFormatSnapshot(payload.format)

  if (action === 'format') {
    const stats = ensureDocumentTypeStats(state, documentType)
    recordFormatToStats(stats, format)
    await writeState()
    return { success: true }
  }

  if (action === 'save') {
    const stats = ensureDocumentTypeStats(state, documentType)
    recordFormatToStats(stats, format)

    state.saves.unshift({
      documentType: documentType === '_default' ? '' : documentType,
      savedAt: new Date().toISOString(),
      format,
    })

    if (state.saves.length > MAX_SAVE_RECORDS) {
      state.saves.length = MAX_SAVE_RECORDS
    }

    await writeState()
    const templates = await regenerateTemplates({ broadcast: true })
    return { success: true, templates }
  }

  throw new Error(`不支持的 memory 记录类型：${action}`)
}

async function getTemplates() {
  const state = await readState()
  if (!state.templates.length) {
    const templates = buildSmartTemplates(state)
    state.templates = templates
    state.templatesUpdatedAt = new Date().toISOString()
    await writeState()
    return templates
  }
  return state.templates
}

async function clearMemoryData() {
  const state = createDefaultState()
  if (!db) {
    return { success: true }
  }

  db.data = state
  await writeState()
  broadcastTemplatesUpdated([])
  return { success: true }
}

function registerMemoryIpcHandlers() {
  ipcMain.handle('data:memory:record', async (_event, payload) => {
    return recordMemoryEvent(payload)
  })

  ipcMain.handle('memory:templates:get', async () => {
    const templates = await getTemplates()
    return { templates }
  })

  ipcMain.handle('memory:templates:regenerate', async () => {
    const templates = await regenerateTemplates({ broadcast: true })
    return { templates }
  })

  ipcMain.handle('memory:clear', async () => {
    return clearMemoryData()
  })
}

async function initMemoryService() {
  if (db) return

  const memoryDir = path.join(app.getPath('userData'), 'memory')
  const dbPath = path.join(memoryDir, 'db.json')

  const fsp = require('node:fs/promises')
  await fsp.mkdir(memoryDir, { recursive: true })

  const { Low } = await import('lowdb')
  const { JSONFile } = await import('lowdb/node')
  const adapter = new JSONFile(dbPath)
  db = new Low(adapter, createDefaultState())
  await db.read()
  db.data ||= createDefaultState()

  registerMemoryIpcHandlers()
  await regenerateTemplates({ broadcast: false })
}

module.exports = {
  initMemoryService,
  recordMemoryEvent,
  getTemplates,
  regenerateTemplates,
  clearMemoryData,
}
