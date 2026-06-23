import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { getElectronAPI, hasTraySupport, isElectron } from '@/utils/electron'
import { requestCreateAppWindow } from '@/composables/useCreateAppWindow'

export const TRAY_RECENT_STORAGE_KEY = 'wpx-tray-recent-documents'
const MAX_RECENT_DOCUMENTS = 8

function loadRecentFromStorage() {
  if (typeof localStorage === 'undefined') return []

  try {
    const raw = localStorage.getItem(TRAY_RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistRecentToStorage(items) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(TRAY_RECENT_STORAGE_KEY, JSON.stringify(items))
  } catch (error) {
    console.warn('[tray] Failed to persist recent documents:', error)
  }
}

/**
 * 系统托盘状态（Web 端模拟；Electron 端与主进程托盘同步）
 */
export const useTrayStore = defineStore('tray', () => {
  const mainWindowVisible = ref(true)
  const trayVisible = ref(false)
  const contextMenuOpen = ref(false)
  const recentDocuments = ref(loadRecentFromStorage())

  const isHiddenToTray = computed(() => !mainWindowVisible.value && trayVisible.value)

  function setContextMenuOpen(open) {
    contextMenuOpen.value = open
  }

  function addRecentDocument(item) {
    if (!item?.title) return

    const entry = {
      id: item.id || item.path || `${item.title}-${Date.now()}`,
      title: item.title,
      path: item.path || '',
      savedAt: item.savedAt || new Date().toISOString(),
    }

    const next = [
      entry,
      ...recentDocuments.value.filter((doc) => doc.id !== entry.id),
    ].slice(0, MAX_RECENT_DOCUMENTS)

    recentDocuments.value = next
    persistRecentToStorage(next)
  }

  async function invokeNativeTray(method) {
    if (!isElectron() || !hasTraySupport()) return

    const trayApi = getElectronAPI()?.tray
    if (typeof trayApi?.[method] === 'function') {
      await trayApi[method]()
    }
  }

  /**
   * 最小化到托盘：Electron 调 native API，Web 仅更新 store 模拟
   */
  async function hideMainWindowToTray() {
    if (isElectron()) {
      await invokeNativeTray('hideMainWindow')
      await invokeNativeTray('show')
    }

    mainWindowVisible.value = false
    trayVisible.value = true
    contextMenuOpen.value = false
  }

  /**
   * 从托盘恢复主窗口
   */
  async function showMainWindowFromTray() {
    if (isElectron()) {
      await invokeNativeTray('showMainWindow')
    }

    mainWindowVisible.value = true
    contextMenuOpen.value = false
  }

  /**
   * 托盘菜单：新建文档
   */
  async function trayNewDocument() {
    if (isElectron()) {
      await requestCreateAppWindow()
      await showMainWindowFromTray()
      contextMenuOpen.value = false
      return
    }

    const appStore = useAppStore()
    appStore.requestNewDocument()
    showMainWindowFromTray()
    contextMenuOpen.value = false
  }

  /**
   * 托盘菜单：打开最近文档（当前仅恢复窗口并更新标题，完整加载留待桌面端对接）
   * @param {{ id: string, title: string, path?: string }} doc
   */
  function trayOpenRecentDocument(doc) {
    if (!doc) return

    const appStore = useAppStore()
    appStore.setDocumentTitle(doc.title)
    showMainWindowFromTray()
    contextMenuOpen.value = false
  }

  /**
   * 托盘菜单：退出应用
   */
  async function trayExit() {
    contextMenuOpen.value = false

    if (isElectron()) {
      const quit = getElectronAPI()?.app?.quit
      if (typeof quit === 'function') {
        await quit()
        return
      }
    }

    trayVisible.value = false
    mainWindowVisible.value = true
    console.info('[tray] Web 模拟：退出应用（桌面端将调用 app.quit）')
  }

  return {
    mainWindowVisible,
    trayVisible,
    contextMenuOpen,
    recentDocuments,
    isHiddenToTray,
    setContextMenuOpen,
    addRecentDocument,
    hideMainWindowToTray,
    showMainWindowFromTray,
    trayNewDocument,
    trayOpenRecentDocument,
    trayExit,
  }
})
