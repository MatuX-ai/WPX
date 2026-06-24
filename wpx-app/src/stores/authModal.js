import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 应用内嵌 AuthModal 状态管理。
 *
 * 替代旧的"打开外部浏览器→ wpx:// 回调"流程：
 * 任何组件可通过 `authModalStore.open({ mode })` 唤起登录/注册表单，
 * 等待用户提交或关闭后获得结果 Promise。
 */
export const useAuthModalStore = defineStore('authModal', () => {
  const visible = ref(false)
  const mode = ref('login') // 'login' | 'register'
  const busy = ref(false)
  const initialError = ref('')

  /** @type {((value: AuthModalResult) => void) | null} */
  let pendingResolve = null
  /** @type {Promise<AuthModalResult> | null} */
  let pendingPromise = null

  /**
   * @param {{ mode?: 'login' | 'register', error?: string }} [options]
   * @returns {Promise<AuthModalResult>}
   */
  function open(options = {}) {
    if (pendingPromise) return pendingPromise

    mode.value = options.mode === 'register' ? 'register' : 'login'
    initialError.value = options.error ? String(options.error) : ''
    visible.value = true

    pendingPromise = new Promise((resolve) => {
      pendingResolve = (value) => {
        pendingPromise = null
        pendingResolve = null
        resolve(value)
      }
    })

    return pendingPromise
  }

  /**
   * @param {AuthModalResult} result
   */
  function resolveWith(result) {
    visible.value = false
    busy.value = false
    pendingResolve?.(result)
  }

  function dismiss() {
    resolveWith({ success: false, reason: 'dismissed' })
  }

  /**
   * @param {boolean} value
   */
  function setBusy(value) {
    busy.value = !!value
  }

  /**
   * 切换到注册模式（模态框内 Tab 切换）。
   */
  function switchToRegister() {
    if (busy.value) return
    mode.value = 'register'
  }

  function switchToLogin() {
    if (busy.value) return
    mode.value = 'login'
  }

  return {
    visible,
    mode,
    busy,
    initialError,
    open,
    dismiss,
    setBusy,
    switchToRegister,
    switchToLogin,
    resolveWith
  }
})

/**
 * @typedef {{
 *   success: boolean,
 *   reason?: 'dismissed' | 'completed' | string,
 *   user?: object | null,
 *   token?: string,
 *   refreshToken?: string,
 *   error?: string
 * }} AuthModalResult
 */
