import { useAppStore } from '@/stores/app'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { getDocPathFromUrl } from '@/utils/windowContext'

/**
 * 记录文档来源路径及已知修改时间（打开文件时调用）。
 * @param {string} [filePath]
 */
export async function syncDocumentSource(filePath) {
  const appStore = useAppStore()

  if (!filePath) {
    appStore.clearDocumentSource()
    return
  }

  let mtimeMs = null
  if (isElectron()) {
    try {
      const stat = await getElectronAPI()?.files?.getModifiedTime?.(filePath)
      mtimeMs = stat?.mtimeMs ?? null
    } catch {
      mtimeMs = null
    }
  }

  appStore.setDocumentSource({ path: filePath, mtimeMs })
}

/**
 * 窗口重新获得焦点时刷新保存状态（含外部文件修改检测）。
 */
export async function refreshDocumentSaveStatusOnFocus() {
  const appStore = useAppStore()
  const filePath = appStore.documentSourcePath || getDocPathFromUrl()

  if (!filePath) {
    appStore.bumpSaveStatusRefresh()
    return
  }

  if (!isElectron()) {
    appStore.bumpSaveStatusRefresh()
    return
  }

  try {
    const stat = await getElectronAPI()?.files?.getModifiedTime?.(filePath)
    if (!stat?.mtimeMs) {
      appStore.bumpSaveStatusRefresh()
      return
    }

    const knownMtime = appStore.documentSourceMtime
    if (knownMtime != null && stat.mtimeMs > knownMtime) {
      appStore.setDocumentSource({ path: filePath, mtimeMs: stat.mtimeMs })
      appStore.markDocumentDirty()
      return
    }

    if (appStore.documentSaveStatus !== 'unsaved' && appStore.documentSaveStatus !== 'saving') {
      appStore.markDocumentSaved()
    }

    appStore.bumpSaveStatusRefresh()
  } catch (error) {
    console.warn('[useDocumentFocusRefresh] Failed to check file modification:', error)
    appStore.bumpSaveStatusRefresh()
  }
}
