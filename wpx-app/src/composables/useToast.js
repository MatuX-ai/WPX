import { useToastStore } from '@/stores/toast'

/**
 * Ergonomic toast API backed by the Pinia toast store.
 */
export function useToast() {
  const store = useToastStore()

  return {
    show: store.show,
    success: store.success,
    error: store.error,
    warning: store.warning,
    info: store.info,
    remove: store.remove,
    clear: store.clear,
  }
}
