import { inject, provide } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLoginGuideStore } from '@/stores/loginGuide'

export const LoginGuideKey = Symbol('loginGuide')

/**
 * @returns {{
 *   open: () => Promise<boolean>,
 *   requireAuth: () => Promise<boolean>,
 *   dismiss: () => void,
 * }}
 */
function createLoginGuideApi() {
  const store = useLoginGuideStore()
  const authStore = useAuthStore()

  async function open() {
    if (!authStore.isGuest) {
      return true
    }

    return store.open()
  }

  async function requireAuth() {
    if (!authStore.isGuest) {
      return true
    }

    const accepted = await open()
    return accepted && !authStore.isGuest
  }

  function dismiss() {
    store.dismiss()
  }

  return {
    open,
    requireAuth,
    dismiss,
  }
}

/**
 * 在应用根组件调用，供子组件 inject。
 */
export function provideLoginGuide() {
  const api = createLoginGuideApi()
  provide(LoginGuideKey, api)
  return api
}

/**
 * 全局登录引导弹窗 API。优先 inject，否则回退到 Pinia store。
 */
export function useLoginGuide() {
  const injected = inject(LoginGuideKey, null)
  if (injected) {
    return injected
  }

  return createLoginGuideApi()
}
