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
