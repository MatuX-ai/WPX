import { defineStore } from 'pinia'
import { ref } from 'vue'

export const STORAGE_KEY = 'wpx-user-habits'
const MAX_SAVE_RECORDS = 200

export function createEmptyStats() {
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
  }
}

function normalizeDocumentType(documentType) {
  const trimmed = String(documentType || '').trim()
  return trimmed || '_default'
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

function loadFromStorage() {
  if (typeof localStorage === 'undefined') {
    return createDefaultState()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return createDefaultState()

    return {
      version: parsed.version ?? 1,
      byDocumentType: {
        _default: createEmptyStats(),
        ...(parsed.byDocumentType || {}),
      },
      saves: Array.isArray(parsed.saves) ? parsed.saves : [],
    }
  } catch {
    return createDefaultState()
  }
}

function persistToStorage(state) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[userHabits] Failed to persist habits:', error)
  }
}

export function normalizeFormatSnapshot(format = {}) {
  return {
    font: format.font ?? null,
    fontSize: format.fontSize ?? null,
    lineHeight: format.lineHeight ?? null,
    heading: format.heading ?? null,
  }
}

export function recordFormatToStats(stats, format) {
  const snapshot = normalizeFormatSnapshot(format)
  incrementCounter(stats.font, snapshot.font)
  incrementCounter(stats.fontSize, snapshot.fontSize)
  incrementCounter(stats.lineHeight, snapshot.lineHeight)
  incrementCounter(stats.heading, snapshot.heading ?? 'paragraph')
}

export const useUserHabitsStore = defineStore('userHabits', () => {
  const data = ref(loadFromStorage())
  const sessionDocumentType = ref('')

  function persist() {
    persistToStorage(data.value)
  }

  function ensureDocumentTypeStats(documentType) {
    const typeKey = normalizeDocumentType(documentType)
    if (!data.value.byDocumentType[typeKey]) {
      data.value.byDocumentType[typeKey] = createEmptyStats()
    }
    return data.value.byDocumentType[typeKey]
  }

  function setSessionDocumentType(documentType) {
    sessionDocumentType.value = normalizeDocumentType(documentType)
  }

  function recordFormatUsage(documentType, format) {
    const typeKey = normalizeDocumentType(documentType || sessionDocumentType.value)
    const stats = ensureDocumentTypeStats(typeKey)
    recordFormatToStats(stats, format)
    persist()
  }

  function recordSave(documentType, format) {
    const typeKey = normalizeDocumentType(documentType)
    const snapshot = normalizeFormatSnapshot(format)
    const stats = ensureDocumentTypeStats(typeKey)

    recordFormatToStats(stats, snapshot)
    sessionDocumentType.value = typeKey

    data.value.saves.unshift({
      documentType: typeKey === '_default' ? '' : typeKey,
      savedAt: new Date().toISOString(),
      format: snapshot,
    })

    if (data.value.saves.length > MAX_SAVE_RECORDS) {
      data.value.saves.length = MAX_SAVE_RECORDS
    }

    persist()
  }

  function getHabits(documentType) {
    const typeKey = normalizeDocumentType(documentType)
    const stats =
      data.value.byDocumentType[typeKey] ||
      data.value.byDocumentType._default ||
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

  function getRecentDocumentTypes(limit = 8) {
    const seen = new Set()
    const result = []

    for (const save of data.value.saves) {
      const label = String(save.documentType || '').trim()
      if (!label || seen.has(label)) continue
      seen.add(label)
      result.push(label)
      if (result.length >= limit) break
    }

    return result
  }

  /**
   * 同类文档保存 3 次以上时生成智能模板推荐。
   * @param {number} [limit]
   */
  function getSmartTemplates(limit = 5) {
    const byType = new Map()

    for (const save of data.value.saves) {
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
      .filter((item) => item.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  function resetHabits() {
    data.value = createDefaultState()
    sessionDocumentType.value = ''
    persist()
  }

  return {
    data,
    sessionDocumentType,
    setSessionDocumentType,
    recordFormatUsage,
    recordSave,
    getHabits,
    getRecentDocumentTypes,
    getSmartTemplates,
    resetHabits,
  }
})
