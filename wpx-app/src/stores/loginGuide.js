import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoginGuideStore = defineStore('loginGuide', () => {
  const visible = ref(false)
  const loggingIn = ref(false)

  /** @type {((value: boolean) => void) | null} */
  let pendingResolve = null

  /** @type {Promise<boolean> | null} */
  let pendingPromise = null

  function open() {
    if (pendingPromise) {
      return pendingPromise
    }

    visible.value = true
    pendingPromise = new Promise((resolve) => {
      pendingResolve = (value) => {
        pendingPromise = null
        resolve(value)
      }
    })

    return pendingPromise
  }

  function dismiss() {
    visible.value = false
    loggingIn.value = false
    pendingResolve?.(false)
    pendingResolve = null
  }

  /**
   * @param {boolean} success
   */
  function complete(success) {
    visible.value = false
    loggingIn.value = false
    pendingResolve?.(success)
    pendingResolve = null
  }

  /**
   * @param {boolean} value
   */
  function setLoggingIn(value) {
    loggingIn.value = value
  }

  return {
    visible,
    loggingIn,
    open,
    dismiss,
    complete,
    setLoggingIn,
  }
})
