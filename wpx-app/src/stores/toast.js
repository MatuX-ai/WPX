import { defineStore } from 'pinia'
import { ref } from 'vue'

/** @typedef {'success' | 'error' | 'warning' | 'info'} ToastType */

const MAX_TOASTS = 3

/** @type {Record<ToastType, number>} */
const DEFAULT_DURATIONS = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 4000,
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useToastStore = defineStore('toast', () => {
  /** @type {import('vue').Ref<Array<{ id: string, type: ToastType, message: string, duration: number, closable: boolean }>>} */
  const toasts = ref([])

  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map()

  function clearTimer(id) {
    const timer = timers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  function scheduleDismiss(id, duration) {
    if (duration <= 0) return

    clearTimer(id)
    const timer = setTimeout(() => {
      remove(id)
    }, duration)
    timers.set(id, timer)
  }

  /**
   * @param {{ type: ToastType, message: string, duration?: number, closable?: boolean }} options
   */
  function show({ type, message, duration, closable = true }) {
    const resolvedDuration = duration ?? DEFAULT_DURATIONS[type] ?? 4000
    const id = createToastId()
    const toast = {
      id,
      type,
      message,
      duration: resolvedDuration,
      closable,
    }

    if (toasts.value.length >= MAX_TOASTS) {
      const oldest = toasts.value[0]
      if (oldest) {
        remove(oldest.id)
      }
    }

    toasts.value.push(toast)
    scheduleDismiss(id, resolvedDuration)
    return id
  }

  function success(message, options = {}) {
    return show({ type: 'success', message, ...options })
  }

  function error(message, options = {}) {
    return show({ type: 'error', message, ...options })
  }

  function warning(message, options = {}) {
    return show({ type: 'warning', message, ...options })
  }

  function info(message, options = {}) {
    return show({ type: 'info', message, ...options })
  }

  function remove(id) {
    clearTimer(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function clear() {
    for (const id of timers.keys()) {
      clearTimer(id)
    }
    toasts.value = []
  }

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    remove,
    clear,
  }
})
