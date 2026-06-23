import { onBeforeUnmount, unref, watch } from 'vue'

/**
 * 在 source 为 true 时监听 Esc，触发 handler。
 * @param {import('vue').MaybeRefOrGetter<boolean>} source
 * @param {(event: KeyboardEvent) => void} handler
 */
export function useEscapeKey(source, handler) {
  let attached = false

  function onKeydown(event) {
    if (event.key !== 'Escape') return
    if (!unref(source)) return
    handler(event)
  }

  function syncListener(active) {
    if (active && !attached) {
      window.addEventListener('keydown', onKeydown)
      attached = true
      return
    }

    if (!active && attached) {
      window.removeEventListener('keydown', onKeydown)
      attached = false
    }
  }

  watch(() => unref(source), syncListener, { immediate: true })

  onBeforeUnmount(() => {
    syncListener(false)
  })
}
