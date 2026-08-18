const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const MAX_SAVE_RECORDS = 200
const DEFAULT_TEMPLATE_LIMIT = 5
const MIN_TEMPLATE_COUNT = 3

// ── M2 (Phase 2) 四层记忆常量 ───────────────────
const MAX_EPISODES = 500
const DEFAULT_MIN_EPISODES_BEFORE_LEARN = 5
const DEFAULT_MIN_LEARN_INTERVAL_HOURS = 24
const DEFAULT_LEARN_CHECK_MS = 15 * 60 * 1000
/** 学习生成的模板按文档类型最少出现次数（较 saves 的 3 次放宽，便于快速沉淀） */
const LEARN_MIN_TEMPLATE_COUNT = 2

function createEmptyStats() {
  return {
    font: {},
    fontSize: {},
    lineHeight: {},
    heading: {},
  }
}

function createDefaultLearning() {
  return {
    enabled: true,
    // M2.1：是否自动记录情景记忆（AI 对话成功后写 episodes）
    recordEpisodes: true,
    minEpisodesBeforeLearn: DEFAULT_MIN_EPISODES_BEFORE_LEARN,
    minIntervalHours: DEFAULT_MIN_LEARN_INTERVAL_HOURS,
    lastLearnAt: null,
    learnedTemplates: [],
  }
}

function createDefaultState() {
  return {
    version: 2,
    byDocumentType: {
      _default: createEmptyStats(),
    },
    saves: [],
    templates: [],
    templatesUpdatedAt: null,
    // L2 情景记忆：任务摘要 + 结果 + 反馈（仅结构，不含文档正文）
    episodes: [],
    // L3 语义记忆：显式偏好/事实（key → { value, scope, updatedAt }）
    facts: {},
    // 学习循环配置与状态
    learning: createDefaultLearning(),
  }
}

/** @type {import('lowdb').Low<import('lowdb').GenericObject> | null} */
let db = null

/** @type {NodeJS.Timeout | null} */
let learnTimer = null

/** 已初始化的记忆目录（供重复 init 返回） */
let currentMemoryDir = null

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

  // v1 → v2 无损迁移：保留旧字段，补齐新字段默认值
  const data = db.data
  if (!data.version || data.version < 2) {
    data.version = 2
  }
  data.byDocumentType = {
    _default: createEmptyStats(),
    ...(data.byDocumentType || {}),
  }
  data.saves = Array.isArray(data.saves) ? data.saves : []
  data.templates = Array.isArray(data.templates) ? data.templates : []
  data.templatesUpdatedAt = data.templatesUpdatedAt ?? null
  data.episodes = Array.isArray(data.episodes) ? data.episodes : []
  data.facts =
    data.facts && typeof data.facts === 'object' && !Array.isArray(data.facts)
      ? data.facts
      : {}
  data.learning = {
    ...createDefaultLearning(),
    ...(data.learning && typeof data.learning === 'object' ? data.learning : {}),
  }
  return data
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
  if (typeof BrowserWindow === 'undefined' || !BrowserWindow.getAllWindows) return
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

// ═════════════════════════════════════════════════
// L2 情景记忆（episodes）
// ═════════════════════════════════════════════════

function normalizeEpisode(payload = {}) {
  const docType = normalizeDocumentType(payload.documentType)
  return {
    id:
      payload.id ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    task: String(payload.task || '').slice(0, 500),
    summary: String(payload.summary || '').slice(0, 2000),
    outcome: ['success', 'failure'].includes(payload.outcome) ? payload.outcome : 'success',
    feedback: ['positive', 'negative'].includes(payload.feedback) ? payload.feedback : null,
    docType: docType === '_default' ? '' : docType,
    format: normalizeFormatSnapshot(payload.format),
    createdAt: new Date().toISOString(),
  }
}

/**
 * 记录一条情景记忆（任务摘要 + 结果 + 反馈 + 格式快照）
 * 注意：episode 只含结构化摘要，不含文档正文（数据主权约束）。
 */
async function recordEpisode(payload = {}) {
  const state = await readState()
  const episode = normalizeEpisode(payload)
  if (!episode.task) {
    throw new Error('缺少 episode 任务描述')
  }
  state.episodes.unshift(episode)
  if (state.episodes.length > MAX_EPISODES) {
    state.episodes.length = MAX_EPISODES
  }
  await writeState()
  return { success: true, episode }
}

async function listEpisodes({ limit = 50, offset = 0 } = {}) {
  const state = await readState()
  const start = Math.max(0, Number(offset) || 0)
  const end = start + Math.max(1, Number(limit) || 50)
  return state.episodes.slice(start, end)
}

// ═════════════════════════════════════════════════
// L3 语义记忆（facts）
// ═════════════════════════════════════════════════

async function setFact({ key, value, scope = 'user' } = {}) {
  const k = String(key || '').trim()
  if (!k) throw new Error('缺少 fact key')
  const state = await readState()
  state.facts[k] = { value, scope, updatedAt: new Date().toISOString() }
  await writeState()
  return { success: true, key: k }
}

async function getFact(key) {
  const state = await readState()
  const k = String(key || '')
  const entry = state.facts[k]
  return entry ? { key: k, ...entry } : null
}

async function listFacts() {
  const state = await readState()
  return Object.entries(state.facts).map(([key, entry]) => ({ key, ...entry }))
}

// ═════════════════════════════════════════════════
// 学习循环（借鉴 Hermes：归因 → 提炼 → 产出 → 回写）
// ═════════════════════════════════════════════════

function isEligibleForLearning(state) {
  const learning = state.learning
  if (!learning.enabled) {
    return { ok: false, reason: 'learning_disabled' }
  }
  if (learning.lastLearnAt) {
    const hours = (Date.now() - new Date(learning.lastLearnAt).getTime()) / 36e5
    if (hours < (learning.minIntervalHours || DEFAULT_MIN_LEARN_INTERVAL_HOURS)) {
      return { ok: false, reason: 'interval_not_elapsed' }
    }
  }
  const eligible = state.episodes.filter((e) => e.outcome === 'success')
  const need = learning.minEpisodesBeforeLearn || DEFAULT_MIN_EPISODES_BEFORE_LEARN
  if (eligible.length < need) {
    return { ok: false, reason: 'not_enough_episodes', count: eligible.length }
  }
  return { ok: true, count: eligible.length }
}

/** 汇总一组成功 episode 的格式偏好（多数决） */
function aggregateFormat(episodes) {
  const counters = { font: {}, fontSize: {}, lineHeight: {}, heading: {} }
  for (const ep of episodes) {
    const format = ep.format || {}
    incrementCounter(counters.font, format.font)
    incrementCounter(counters.fontSize, format.fontSize)
    incrementCounter(counters.lineHeight, format.lineHeight)
    incrementCounter(counters.heading, format.heading)
  }
  const out = {}
  for (const [field, counter] of Object.entries(counters)) {
    const best = pickMostCommon(counter)
    if (best != null) out[field] = best
  }
  return Object.keys(out).length ? out : null
}

/** 从成功 episodes 生成专属模板（仅结构，无正文） */
function buildLearnedTemplates(state) {
  const byType = new Map()
  for (const ep of state.episodes) {
    if (ep.outcome !== 'success') continue
    const label = String(ep.docType || '').trim()
    if (!label) continue
    if (!byType.has(label)) {
      byType.set(label, { documentType: label, count: 0, format: null })
    }
    const entry = byType.get(label)
    entry.count += 1
    if (!entry.format && ep.format && Object.values(ep.format).some(Boolean)) {
      entry.format = ep.format
    }
  }
  return Array.from(byType.values())
    .filter((item) => item.count >= LEARN_MIN_TEMPLATE_COUNT)
    .sort((a, b) => b.count - a.count)
    .slice(0, DEFAULT_TEMPLATE_LIMIT)
    .map((item) => ({
      ...item,
      format: normalizeFormatSnapshot(item.format),
      habits: null,
      learned: true,
    }))
}

/** 合并学习生成的模板：同文档类型已有模板时不覆盖（尊重用户调整） */
function mergeTemplates(state, generated) {
  const existing = new Set(state.templates.map((t) => t.documentType))
  for (const tpl of generated) {
    if (!existing.has(tpl.documentType)) {
      state.templates.push(tpl)
      existing.add(tpl.documentType)
    }
  }
  state.templates = state.templates.slice(0, DEFAULT_TEMPLATE_LIMIT * 2)
}

/**
 * 执行学习循环
 * - force=true 跳过 enabled/间隔/数量检查（手动触发）
 * - 只分析 episodes 的结构化字段（task/summary/outcome/feedback/docType/format），
 *   不读取任何文档正文。
 */
async function runLearning({ force = false } = {}) {
  const state = await readState()
  const check = isEligibleForLearning(state)
  if (!force && !check.ok) {
    return { ok: false, reason: check.reason, count: check.count }
  }

  const learnedFacts = []
  const byDocType = new Map()
  for (const ep of state.episodes) {
    if (ep.outcome !== 'success') continue
    const key = ep.docType || '_default'
    if (!byDocType.has(key)) byDocType.set(key, [])
    byDocType.get(key).push(ep)
  }

  // 1) 归因/提炼：按文档类型汇总格式偏好 → 写入 facts（scope: learned）
  for (const [docType, eps] of byDocType) {
    const format = aggregateFormat(eps)
    if (format) {
      const factKey = docType === '_default' ? 'preferred-format' : `preferred-format:${docType}`
      state.facts[factKey] = {
        value: format,
        scope: 'learned',
        updatedAt: new Date().toISOString(),
      }
      learnedFacts.push(factKey)
    }
  }

  // 2) 产出模板：成功 episodes → 专属模板 → 合并进 templates
  const generated = buildLearnedTemplates(state)
  if (generated.length > 0) {
    mergeTemplates(state, generated)
    state.templatesUpdatedAt = new Date().toISOString()
    const learnedTypes = generated.map((t) => t.documentType)
    state.learning.learnedTemplates = [
      ...new Set([...(state.learning.learnedTemplates || []), ...learnedTypes]),
    ].slice(-50)
  }

  // 3) 回写 + 广播
  state.learning.lastLearnAt = new Date().toISOString()
  await writeState()
  broadcastTemplatesUpdated(state.templates)

  return {
    ok: true,
    facts: learnedFacts,
    generated: generated.length,
    templates: state.templates,
  }
}

async function getLearningSettings() {
  const state = await readState()
  return { ...state.learning }
}

async function setLearningSettings(partial = {}) {
  const state = await readState()
  const allowed = ['enabled', 'recordEpisodes', 'minEpisodesBeforeLearn', 'minIntervalHours']
  for (const key of allowed) {
    if (partial[key] !== undefined) state.learning[key] = partial[key]
  }
  await writeState()
  return { ...state.learning }
}

async function getLearningStatus() {
  const state = await readState()
  const check = isEligibleForLearning(state)
  return {
    enabled: state.learning.enabled,
    recordEpisodes: state.learning.recordEpisodes !== false,
    episodeCount: state.episodes.length,
    factCount: Object.keys(state.facts).length,
    lastLearnAt: state.learning.lastLearnAt,
    learnedTemplates: state.learning.learnedTemplates || [],
    eligible: check.ok,
    reason: check.ok ? null : check.reason,
  }
}

// ── 学习调度（低频定时器，替代"空闲检测"，避免 powerMonitor 复杂度） ──
function startLearningScheduler() {
  if (learnTimer) return
  learnTimer = setInterval(() => {
    runLearning().catch((error) => {
      console.warn('[memory-service] 学习循环失败:', error?.message || error)
    })
  }, DEFAULT_LEARN_CHECK_MS)
  if (learnTimer.unref) learnTimer.unref()
}

function stopLearningScheduler() {
  if (learnTimer) {
    clearInterval(learnTimer)
    learnTimer = null
  }
}

// ═════════════════════════════════════════════════
// 原有记录逻辑（保留兼容）
// ═════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════
// IPC
// ═════════════════════════════════════════════════

function registerMemoryIpcHandlers(deps = {}) {
  const ipc = deps.ipcMain || ipcMain
  if (!ipc || typeof ipc.handle !== 'function') {
    console.warn('[memory-service] ipcMain 不可用，跳过 IPC 注册')
    return
  }

  ipc.handle('data:memory:record', async (_event, payload) => {
    return recordMemoryEvent(payload)
  })

  ipc.handle('memory:templates:get', async () => {
    const templates = await getTemplates()
    return { templates }
  })

  ipc.handle('memory:templates:regenerate', async () => {
    const templates = await regenerateTemplates({ broadcast: true })
    return { templates }
  })

  ipc.handle('memory:clear', async () => {
    return clearMemoryData()
  })

  // ── M2：情景记忆 / 语义记忆 / 学习循环 ──
  ipc.handle('memory:episode:record', async (_event, payload) => {
    return recordEpisode(payload)
  })

  ipc.handle('memory:episode:list', async (_event, options) => {
    return listEpisodes(options)
  })

  ipc.handle('memory:fact:set', async (_event, payload) => {
    return setFact(payload)
  })

  ipc.handle('memory:fact:get', async (_event, key) => {
    return getFact(key)
  })

  ipc.handle('memory:fact:list', async () => {
    return listFacts()
  })

  ipc.handle('memory:learn:run', async (_event, options) => {
    return runLearning(options)
  })

  // 传入 partial 视为更新，不传视为查询
  ipc.handle('memory:learn:settings', async (_event, partial) => {
    return partial && typeof partial === 'object'
      ? setLearningSettings(partial)
      : getLearningSettings()
  })

  ipc.handle('memory:learn:status', async () => {
    return getLearningStatus()
  })
}

async function initMemoryService(options = {}) {
  if (db) return { memoryDir: currentMemoryDir }

  const userDataPath = options.userDataPath || app.getPath('userData')
  const memoryDir = path.join(userDataPath, 'memory')
  const dbPath = path.join(memoryDir, 'db.json')

  const fsp = require('node:fs/promises')
  await fsp.mkdir(memoryDir, { recursive: true })

  const { Low } = await import('lowdb')
  const { JSONFile } = await import('lowdb/node')
  const adapter = new JSONFile(dbPath)
  db = new Low(adapter, createDefaultState())
  await db.read()
  db.data ||= createDefaultState()
  currentMemoryDir = memoryDir

  if (options.registerIpc !== false) {
    registerMemoryIpcHandlers({ ipcMain })
  }
  await regenerateTemplates({ broadcast: false })
  startLearningScheduler()

  return { memoryDir, dbPath }
}

/** 仅供单元测试重置单例 */
function resetMemoryServiceForTests() {
  stopLearningScheduler()
  db = null
  currentMemoryDir = null
}

module.exports = {
  initMemoryService,
  recordMemoryEvent,
  getTemplates,
  regenerateTemplates,
  clearMemoryData,
  // M2
  recordEpisode,
  listEpisodes,
  setFact,
  getFact,
  listFacts,
  runLearning,
  getLearningSettings,
  setLearningSettings,
  getLearningStatus,
  startLearningScheduler,
  stopLearningScheduler,
  registerMemoryIpcHandlers,
  resetMemoryServiceForTests,
  MAX_EPISODES,
}
