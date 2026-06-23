import { useWindowStore } from '@/stores/window'
import { getElectronAPI, isElectron } from '@/utils/electron'

/** @type {(() => void) | null} */
let teardown = null

function bindWindowFocusListeners() {
  const windowStore = useWindowStore()

  function handleFocus() {
    windowStore.setWindowFocused(true)
  }

  function handleBlur() {
    windowStore.setWindowFocused(false)
  }

  if (isElectron()) {
    const api = getElectronAPI()
    const unsubscribeFocus = api?.onWindowFocus?.(handleFocus)
    const unsubscribeBlur = api?.onWindowBlur?.(handleBlur)

    return () => {
      unsubscribeFocus?.()
      unsubscribeBlur?.()
    }
  }

  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('focus', handleFocus)
  window.addEventListener('blur', handleBlur)

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      handleFocus()
      return
    }
    handleBlur()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('blur', handleBlur)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

/**
 * 监听窗口焦点变化，同步 Pinia `isWindowFocused`。
 */
export function useWindowFocus() {
  if (!teardown) {
    teardown = bindWindowFocusListeners()
  }

  return useWindowStore()
}

/** 重置监听（主要用于测试） */
export function resetWindowFocus() {
  teardown?.()
  teardown = null
}
