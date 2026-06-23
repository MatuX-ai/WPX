import { useToast } from '@/composables/useToast'
import {
  WINDOW_CREATE_ERROR_MESSAGES,
} from '@/constants/windowCreate'
import { getElectronAPI, isElectron } from '@/utils/electron'

/**
 * 通过主进程创建新的应用窗口（Electron）。
 * @param {string} [docPath]
 * @returns {Promise<{ ok: boolean, windowId?: number, error?: string }>}
 */
export async function requestCreateAppWindow(docPath) {
  if (!isElectron()) {
    return { ok: false, error: 'UNSUPPORTED' }
  }

  const api = getElectronAPI()
  if (typeof api?.createWindow !== 'function') {
    return { ok: false, error: 'UNSUPPORTED' }
  }

  try {
    const result = await api.createWindow(docPath)
    if (!result?.ok && result?.error) {
      const message = WINDOW_CREATE_ERROR_MESSAGES[result.error]
      if (message) {
        useToast().warning(message)
      }
    }
    return result ?? { ok: false, error: 'UNKNOWN' }
  } catch (error) {
    console.error('[useCreateAppWindow] Failed to create window:', error)
    return { ok: false, error: 'UNKNOWN' }
  }
}
