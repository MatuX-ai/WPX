import { onMounted, onUnmounted } from 'vue'
import { isElectron } from '@/utils/electron'

/**
 * Web 端通过 ?open= URL 参数打开文件。
 * Electron 桌面端由 EditorCore.vue 监听主进程 file:open IPC。
 * @param {(payload: { path?: string, content: string, title?: string, format?: object | null }) => void} onOpen
 */
export function useElectronFileOpen(onOpen) {
  let unsubscribe = null

  async function loadFileFromQuery() {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const openPath = params.get('open')
    if (!openPath) return

    try {
      const response = await fetch(openPath)
      if (!response.ok) return
      const content = await response.text()
      const title = openPath.split('/').pop()?.replace(/\.(md|txt|wpx)$/i, '') || '导入文档'
      onOpen?.({ path: openPath, content, title })
      params.delete('open')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    } catch {
      // ignore invalid open param
    }
  }

  onMounted(() => {
    if (isElectron()) return
    loadFileFromQuery()
  })

  onUnmounted(() => {
    unsubscribe?.()
  })
}
