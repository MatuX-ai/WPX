import { computed, readonly, ref } from 'vue'
import { useToastStore } from '@/stores/toast'

export const OFFLINE_NETWORK_TOOLTIP = '需要网络连接'

function readOnlineStatus() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

function createOnlineStatusManager() {
  const isOnline = ref(readOnlineStatus())
  let listening = false

  function handleOnline() {
    if (isOnline.value) return
    isOnline.value = true
    useToastStore().success('网络已连接')
  }

  function handleOffline() {
    if (!isOnline.value) return
    isOnline.value = false
  }

  function syncOnlineStatus() {
    isOnline.value = readOnlineStatus()
  }

  function ensureListening() {
    if (listening || typeof window === 'undefined') return
    listening = true
    syncOnlineStatus()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  const isOffline = computed(() => !isOnline.value)

  return {
    isOnline: readonly(isOnline),
    isOffline,
    networkRequiredTooltip: OFFLINE_NETWORK_TOOLTIP,
    ensureListening,
    syncOnlineStatus,
  }
}

let manager = null

/**
 * 全局在线状态（单例，监听 navigator.onLine）
 */
export function useOnlineStatus() {
  if (!manager) {
    manager = createOnlineStatusManager()
  }

  manager.ensureListening()
  return manager
}

/** 重置单例（主要用于测试） */
export function resetOnlineStatus() {
  manager = null
}
