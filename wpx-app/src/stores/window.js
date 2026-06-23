import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWindowStore = defineStore('window', () => {
  const isWindowFocused = ref(true)
  /** 窗口每次获得焦点时递增，供保存状态等逻辑刷新 */
  const focusGeneration = ref(0)

  /**
   * @param {boolean} focused
   */
  function setWindowFocused(focused) {
    if (isWindowFocused.value === focused) return

    isWindowFocused.value = focused
    if (focused) {
      focusGeneration.value += 1
    }
  }

  return {
    isWindowFocused,
    focusGeneration,
    setWindowFocused,
  }
})
