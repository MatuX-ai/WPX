import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { getElectronAPI, isElectron } from '@/utils/electron'
import {
  cancelWindowClose,
  confirmWindowClose,
} from '@/utils/windowControls'

/** @type {(() => void) | null} */
let activeCloseHandler = null

/** @type {(() => void) | null} */
let unsubscribeCloseCheck = null

function fallbackCloseCheck() {
  const appStore = useAppStore()
  const dirty =
    appStore.hasOpenDocument &&
    (appStore.documentSaveStatus === 'unsaved' || appStore.documentSaveStatus === 'saving')

  if (!dirty) {
    confirmWindowClose()
    return
  }

  cancelWindowClose()
}

function ensureCloseCheckListener() {
  if (unsubscribeCloseCheck || !isElectron()) return

  const api = getElectronAPI()
  if (typeof api?.onCloseCheck !== 'function') return

  unsubscribeCloseCheck = api.onCloseCheck(() => {
    if (activeCloseHandler) {
      activeCloseHandler()
      return
    }
    fallbackCloseCheck()
  })
}

// 尽早注册关闭监听，避免白屏/未进入 EditorLayout 时 Alt+F4 无法退出
if (typeof window !== 'undefined') {
  setTimeout(() => {
    ensureCloseCheckListener()
  }, 0)
}

/**
 * 监听主进程 window:close-check，在 EditorLayout 中处理未保存拦截。
 * @param {() => void} handler
 */
export function useWindowCloseInterceptor(handler) {
  onMounted(() => {
    ensureCloseCheckListener()
    activeCloseHandler = handler
  })

  onUnmounted(() => {
    if (activeCloseHandler === handler) {
      activeCloseHandler = null
    }
  })
}
