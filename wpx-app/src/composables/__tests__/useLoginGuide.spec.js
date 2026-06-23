import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLoginGuideStore } from '@/stores/loginGuide'
import { useAuthStore } from '@/stores/auth'

describe('useLoginGuideStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('open 显示弹窗并在 dismiss 时 resolve false', async () => {
    const store = useLoginGuideStore()
    const promise = store.open()

    expect(store.visible).toBe(true)

    store.dismiss()
    await expect(promise).resolves.toBe(false)
    expect(store.visible).toBe(false)
  })

  it('complete(true) resolve true', async () => {
    const store = useLoginGuideStore()
    const promise = store.open()

    store.complete(true)
    await expect(promise).resolves.toBe(true)
  })
})

describe('useLoginGuide composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('已登录用户 open 直接返回 true', async () => {
    const authStore = useAuthStore()
    await authStore.login('token', 'refresh', {
      id: 'user-1',
      nickname: '测试用户',
      avatar: '',
    })

    const { useLoginGuide } = await import('@/composables/useLoginGuide')
    const { open } = useLoginGuide()

    await expect(open()).resolves.toBe(true)
    expect(useLoginGuideStore().visible).toBe(false)
  })
})
