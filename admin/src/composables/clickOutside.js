/**
 * v-click-outside 指令：点击元素外部时触发回调
 *
 * 用法：
 *   <div v-click-outside="() => (open = false)">...</div>
 */
export const vClickOutside = {
  mounted(el, binding) {
    if (typeof binding.value !== 'function') return
    el._clickOutsideHandler = (event) => {
      if (el === event.target || el.contains(event.target)) return
      binding.value(event)
    }
    // 延迟挂载，避免与触发元素自身的 click 事件竞争
    setTimeout(() => {
      document.addEventListener('click', el._clickOutsideHandler, true)
    }, 0)
  },
  unmounted(el) {
    if (el._clickOutsideHandler) {
      document.removeEventListener('click', el._clickOutsideHandler, true)
      el._clickOutsideHandler = null
    }
  }
}