import { getElectronAPI, isElectron } from '@/utils/electron'

/**
 * @typedef {object} SmartTemplate
 * @property {string} documentType
 * @property {number} count
 * @property {object | null} format
 */

function getMemoryApi() {
  if (!isElectron()) return null
  return getElectronAPI()?.memory ?? null
}

/**
 * @param {{ action: 'format' | 'save', documentType?: string, format?: object }} payload
 */
export async function recordMemoryEvent(payload) {
  const api = getMemoryApi()
  if (!api?.record) return null
  return api.record(payload)
}

/**
 * @returns {Promise<SmartTemplate[]>}
 */
export async function fetchSmartTemplates() {
  const api = getMemoryApi()
  if (api?.getTemplates) {
    const result = await api.getTemplates()
    return result?.templates ?? []
  }
  return []
}

/**
 * @returns {Promise<SmartTemplate[]>}
 */
export async function regenerateSmartTemplates() {
  const api = getMemoryApi()
  if (api?.regenerateTemplates) {
    const result = await api.regenerateTemplates()
    return result?.templates ?? []
  }
  return []
}

export async function clearMemoryData() {
  const api = getMemoryApi()
  if (api?.clear) {
    return api.clear()
  }
  return { success: true }
}

// ── M2 / M2.1：四层记忆 IPC 封装 ─────────────────

/**
 * 记录一条情景记忆（仅桌面端生效）
 * @param {{ task: string, summary?: string, outcome?: 'success'|'failure', feedback?: 'positive'|'negative'|null, documentType?: string, format?: object }} payload
 */
export async function recordEpisode(payload) {
  const api = getMemoryApi()
  if (!api?.recordEpisode) return null
  return api.recordEpisode(payload)
}

/** @returns {Promise<Array<object>>} */
export async function listEpisodes(options = {}) {
  const api = getMemoryApi()
  if (!api?.listEpisodes) return []
  return api.listEpisodes(options)
}

/** @returns {Promise<{ success: boolean, key: string } | null>} */
export async function setFact(payload) {
  const api = getMemoryApi()
  if (!api?.setFact) return null
  return api.setFact(payload)
}

/** @returns {Promise<object | null>} */
export async function getFact(key) {
  const api = getMemoryApi()
  if (!api?.getFact) return null
  return api.getFact(key)
}

/** @returns {Promise<Array<object>>} */
export async function listFacts() {
  const api = getMemoryApi()
  if (!api?.listFacts) return []
  return api.listFacts()
}

/** @returns {Promise<object | null>} 学习循环结果 */
export async function runLearning(options = {}) {
  const api = getMemoryApi()
  if (!api?.runLearning) return null
  return api.runLearning(options)
}

/** @returns {Promise<object | null>} 学习设置（含 recordEpisodes / enabled 等） */
export async function getLearnSettings() {
  const api = getMemoryApi()
  if (!api?.getLearnSettings) return null
  return api.getLearnSettings()
}

/** @returns {Promise<object | null>} */
export async function setLearnSettings(partial) {
  const api = getMemoryApi()
  if (!api?.setLearnSettings) return null
  return api.setLearnSettings(partial)
}

/** @returns {Promise<object | null>} 记忆状态（episodeCount / factCount / eligible 等） */
export async function getLearnStatus() {
  const api = getMemoryApi()
  if (!api?.getLearnStatus) return null
  return api.getLearnStatus()
}

/**
 * @param {(payload?: { templates?: SmartTemplate[] }) => void} callback
 */
export function onTemplatesUpdated(callback) {
  const api = getMemoryApi()
  if (typeof api?.onTemplatesUpdated === 'function') {
    return api.onTemplatesUpdated(callback)
  }
  return () => {}
}
